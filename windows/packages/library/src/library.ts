import { randomUUID } from "node:crypto";
import {
  catalogFromGames,
  cloneGame,
  findSameTitle,
  gamesList,
  insertGame,
  removeGame,
  type Catalog,
} from "./catalog.ts";
import { readDocument, writeDocumentAtomic } from "./persist.ts";
import { fetchGamesPage } from "./rawg/client.ts";
import { decodeSearchPayload } from "./rawg/decode.ts";
import {
  allowArtworkURL,
  defaultPersonalFields,
  isOpenableSourceURL,
  foldTitle,
  normalizeRating,
  normalizeTitle,
  resolveStorePlatform,
} from "./rules.ts";
import type {
  ApplyCommand,
  ApplyOutcome,
  BulkStatus,
  EmptyKind,
  Game,
  GameId,
  ImportProgress,
  KeyVault,
  LibraryDocument,
  LibraryOpenOptions,
  RawgCandidate,
  RawgOp,
  RawgResult,
  ShelfId,
  ShelfQuery,
  ShelfSnapshot,
  StatusFlag,
} from "./types.ts";

type Writer = (path: string, doc: LibraryDocument) => void;

export class Library {
  #path: string;
  #keyVault: KeyVault;
  #fetch: typeof fetch;
  #now: () => Date;
  #pause: (ms: number) => Promise<void>;
  #write: Writer;
  #catalog: Catalog;
  #importProgress: ImportProgress;
  #busy = false;
  #abort: AbortController | null = null;
  #lastError: BulkStatus["lastError"] = null;

  private constructor(
    path: string,
    keyVault: KeyVault,
    fetchImpl: typeof fetch,
    now: () => Date,
    pause: (ms: number) => Promise<void>,
    write: Writer,
    doc: LibraryDocument,
  ) {
    this.#path = path;
    this.#keyVault = keyVault;
    this.#fetch = fetchImpl;
    this.#now = now;
    this.#pause = pause;
    this.#write = write;
    this.#catalog = catalogFromGames(doc.games);
    this.#importProgress = { ...doc.importProgress };
  }

  static async open(options: LibraryOpenOptions): Promise<Library> {
    const doc = readDocument(options.path);
    return new Library(
      options.path,
      options.keyVault,
      options.fetch ?? globalThis.fetch.bind(globalThis),
      options.now ?? (() => new Date()),
      options.pause ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      options.write ?? writeDocumentAtomic,
      doc,
    );
  }

  view(query: ShelfQuery): ShelfSnapshot {
    const all = gamesList(this.#catalog);
    const badges = {
      all: all.length,
      library: all.filter((g) => g.isInLibrary).length,
      wishlist: all.filter((g) => g.isWishlisted).length,
      toPlay: all.filter((g) => g.isToPlay).length,
      favorites: all.filter((g) => g.isFavorite).length,
    };

    const shelfGames = all.filter((g) => matchesShelf(g, query.shelf));
    const titleQuery = query.titleQuery.trim();
    let rows = shelfGames;
    if (query.storePlatform != null) {
      rows = rows.filter((g) => g.storePlatform === query.storePlatform);
    }
    if (titleQuery) {
      const q = foldTitle(titleQuery);
      rows = rows.filter((g) => foldTitle(g.title).includes(q));
    }
    rows = [...rows].sort((a, b) => b.addedDate.localeCompare(a.addedDate));

    return {
      rows,
      badges,
      empty: emptyKind({
        rows,
        titleQuery,
        storePlatform: query.storePlatform,
        shelf: query.shelf,
        shelfGames,
      }),
    };
  }

  apply(command: ApplyCommand): ApplyOutcome {
    switch (command.type) {
      case "add-manual":
        return this.#addManual(command.title, command.confirmSeparate === true);
      case "add-rawg":
        return this.#addRawg(command.candidate, command.confirmSeparate === true);
      case "set-title":
        return this.#setTitle(command.id, command.title);
      case "set-status":
        return this.#setFlag(command.id, command.flag, command.value);
      case "set-favorite":
        return this.#setFlag(command.id, "isFavorite", command.value);
      case "set-rating":
        return this.#setRating(command.id, command.rating);
      case "set-store-platform":
        return this.#setStore(command.id, command.storePlatform);
      case "delete":
        return this.#delete(command.id);
      default: {
        const _exhaustive: never = command;
        return _exhaustive;
      }
    }
  }

  async rawg(op: RawgOp): Promise<RawgResult> {
    switch (op.type) {
      case "bulk-status":
        return { ok: true, bulk: this.#bulkStatus() };
      case "bulk-stop":
        this.#abort?.abort();
        return { ok: true, bulk: this.#bulkStatus() };
      case "search":
        return this.#search(op.query, op.page);
      case "bulk-start":
        return this.#bulkStart(op.restart === true);
      default: {
        const _exhaustive: never = op;
        return _exhaustive;
      }
    }
  }

  #document(): LibraryDocument {
    return {
      version: 1,
      games: gamesList(this.#catalog),
      importProgress: { ...this.#importProgress },
    };
  }

  #persist(): void {
    this.#write(this.#path, this.#document());
  }

  #addManual(rawTitle: string, confirmSeparate: boolean): ApplyOutcome {
    const parsed = normalizeTitle(rawTitle);
    if (!parsed.ok) return { outcome: "rejected", reason: "empty-title" };
    if (!confirmSeparate) {
      const matches = findSameTitle(this.#catalog, parsed.title);
      if (matches.length > 0) return { outcome: "same-title", matches };
    }
    const game = this.#newGame({
      title: parsed.title,
      source: "manual",
      externalID: null,
      sourceURL: null,
      releaseDate: null,
      platforms: [],
      artworkURL: null,
    });
    insertGame(this.#catalog, game);
    try {
      this.#persist();
    } catch {
      removeGame(this.#catalog, game.id);
      return { outcome: "save-failed", id: game.id };
    }
    return { outcome: "ok", id: game.id, game: cloneGame(game) };
  }

  #addRawg(candidate: RawgCandidate, confirmSeparate: boolean): ApplyOutcome {
    const existingId = this.#catalog.byRawgId.get(candidate.externalID);
    if (existingId) {
      const game = this.#catalog.byId.get(existingId)!;
      return { outcome: "exists", id: game.id, game: cloneGame(game) };
    }
    if (!confirmSeparate) {
      const matches = findSameTitle(this.#catalog, candidate.title);
      if (matches.length > 0) return { outcome: "same-title", matches };
    }
    const artworkURL = allowArtworkURL(candidate.artworkURL);
    const sourceURL = isOpenableSourceURL(candidate.sourceURL)
      ? candidate.sourceURL
      : "https://rawg.io/";
    const game = this.#newGame({
      title: candidate.title.trim() || candidate.title,
      source: "rawg",
      externalID: candidate.externalID,
      sourceURL,
      releaseDate: candidate.releaseDate,
      platforms: [...candidate.platforms].sort(),
      artworkURL,
    });
    insertGame(this.#catalog, game);
    try {
      this.#persist();
    } catch {
      removeGame(this.#catalog, game.id);
      return { outcome: "save-failed", id: game.id };
    }
    return { outcome: "ok", id: game.id, game: cloneGame(game) };
  }

  #newGame(fields: {
    title: string;
    source: Game["source"];
    externalID: number | null;
    sourceURL: string | null;
    releaseDate: string | null;
    platforms: string[];
    artworkURL: string | null;
  }): Game {
    return {
      id: randomUUID(),
      title: fields.title,
      addedDate: this.#now().toISOString(),
      source: fields.source,
      externalID: fields.externalID,
      sourceURL: fields.sourceURL,
      releaseDate: fields.releaseDate,
      platforms: fields.platforms,
      artworkURL: fields.artworkURL,
      ...defaultPersonalFields(),
    };
  }

  #setTitle(id: GameId, rawTitle: string): ApplyOutcome {
    const game = this.#catalog.byId.get(id);
    if (!game) return { outcome: "rejected", reason: "not-found" };
    const parsed = normalizeTitle(rawTitle);
    if (!parsed.ok) return { outcome: "rejected", reason: "empty-title" };
    const previous = game.title;
    game.title = parsed.title;
    try {
      this.#persist();
    } catch {
      game.title = previous;
      return { outcome: "save-failed", id };
    }
    return { outcome: "ok", id, game: cloneGame(game) };
  }

  #setFlag(
    id: GameId,
    flag: StatusFlag | "isFavorite",
    value: boolean,
  ): ApplyOutcome {
    const game = this.#catalog.byId.get(id);
    if (!game) return { outcome: "rejected", reason: "not-found" };
    const previous = game[flag];
    game[flag] = value;
    try {
      this.#persist();
    } catch {
      game[flag] = previous;
      return { outcome: "save-failed", id };
    }
    return { outcome: "ok", id, game: cloneGame(game) };
  }

  #setRating(id: GameId, rating: number | null): ApplyOutcome {
    const game = this.#catalog.byId.get(id);
    if (!game) return { outcome: "rejected", reason: "not-found" };
    const parsed = normalizeRating(game.rating, rating);
    if (!parsed.ok) return { outcome: "rejected", reason: "unchanged" };
    const previous = game.rating;
    game.rating = parsed.rating;
    try {
      this.#persist();
    } catch {
      game.rating = previous;
      return { outcome: "save-failed", id };
    }
    return { outcome: "ok", id, game: cloneGame(game) };
  }

  #setStore(
    id: GameId,
    storePlatform: string | null,
  ): ApplyOutcome {
    const game = this.#catalog.byId.get(id);
    if (!game) return { outcome: "rejected", reason: "not-found" };
    const previous = game.storePlatform;
    game.storePlatform = resolveStorePlatform(storePlatform);
    try {
      this.#persist();
    } catch {
      game.storePlatform = previous;
      return { outcome: "save-failed", id };
    }
    return { outcome: "ok", id, game: cloneGame(game) };
  }

  #delete(id: GameId): ApplyOutcome {
    const removed = removeGame(this.#catalog, id);
    if (!removed) return { outcome: "rejected", reason: "not-found" };
    try {
      this.#persist();
    } catch {
      insertGame(this.#catalog, removed);
      return { outcome: "save-failed", id };
    }
    return { outcome: "ok-deleted", id };
  }

  #bulkStatus(): BulkStatus {
    return {
      running: this.#busy && this.#abort != null,
      nextPage: this.#importProgress.nextPage,
      isComplete: this.#importProgress.isComplete,
      importedCount: this.#importProgress.importedCount,
      lastError: this.#lastError,
    };
  }

  async #search(query: string, page: number): Promise<RawgResult> {
    if (this.#busy) {
      return { ok: false, error: "offline", ignored: true };
    }
    const key = (await this.#keyVault.get())?.trim() ?? "";
    if (!key) return { ok: false, error: "missing-key" };

    this.#busy = true;
    const abort = new AbortController();
    this.#abort = abort;
    try {
      const fetched = await fetchGamesPage({
        key,
        page,
        search: query,
        fetch: this.#fetch,
        signal: abort.signal,
      });
      if ("error" in fetched) return { ok: false, error: fetched.error };
      const decoded = decodeSearchPayload(fetched.json, page);
      if ("error" in decoded) return { ok: false, error: "invalid" };
      return { ok: true, page: decoded };
    } finally {
      this.#busy = false;
      this.#abort = null;
    }
  }

  async #bulkStart(restart: boolean): Promise<RawgResult> {
    if (this.#busy) {
      return { ok: false, error: "offline", ignored: true };
    }
    const key = (await this.#keyVault.get())?.trim() ?? "";
    if (!key) return { ok: false, error: "missing-key" };

    if (restart) {
      this.#importProgress.nextPage = 1;
      this.#importProgress.isComplete = false;
      try {
        this.#persist();
      } catch {
        return { ok: false, error: "invalid" };
      }
    }

    if (this.#importProgress.isComplete) {
      this.#lastError = null;
      return { ok: true, bulk: this.#bulkStatus() };
    }

    this.#busy = true;
    this.#lastError = null;
    const abort = new AbortController();
    this.#abort = abort;

    try {
      const pageCap = 100;
      for (let i = 0; i < pageCap; i++) {
        if (abort.signal.aborted) break;
        if (this.#importProgress.isComplete) break;

        const page = this.#importProgress.nextPage;
        const fetched = await fetchGamesPage({
          key,
          page,
          fetch: this.#fetch,
          signal: abort.signal,
        });
        if (abort.signal.aborted) break;
        if ("error" in fetched) {
          if (abort.signal.aborted) break;
          this.#lastError = fetched.error;
          break;
        }
        const decoded = decodeSearchPayload(fetched.json, page);
        if ("error" in decoded) {
          this.#lastError = "invalid";
          break;
        }
        if (decoded.hasNext && decoded.results.length === 0) {
          this.#lastError = "invalid";
          break;
        }

        const seen = new Set<number>();
        let inserted = 0;
        const addedIds: GameId[] = [];
        for (const row of decoded.results) {
          if (!seen.add(row.externalID)) continue;
          if (this.#catalog.byRawgId.has(row.externalID)) continue;
          const game = this.#newGame({
            title: row.title,
            source: "rawg",
            externalID: row.externalID,
            sourceURL: isOpenableSourceURL(row.sourceURL)
              ? row.sourceURL
              : "https://rawg.io/",
            releaseDate: row.releaseDate,
            platforms: [...row.platforms],
            artworkURL: allowArtworkURL(row.artworkURL),
          });
          insertGame(this.#catalog, game);
          addedIds.push(game.id);
          inserted += 1;
        }

        const prevProgress = { ...this.#importProgress };
        this.#importProgress.nextPage = page + 1;
        this.#importProgress.isComplete = !decoded.hasNext;
        this.#importProgress.importedCount += inserted;

        try {
          this.#persist();
        } catch {
          for (const id of addedIds) removeGame(this.#catalog, id);
          this.#importProgress = prevProgress;
          this.#lastError = "invalid";
          break;
        }

        if (this.#importProgress.isComplete) break;
        if (abort.signal.aborted) break;
        await this.#pause(1000);
      }
    } finally {
      this.#busy = false;
      this.#abort = null;
    }
    return { ok: true, bulk: this.#bulkStatus() };
  }
}

function matchesShelf(game: Game, shelf: ShelfId): boolean {
  switch (shelf) {
    case "all":
      return true;
    case "library":
      return game.isInLibrary;
    case "wishlist":
      return game.isWishlisted;
    case "to-play":
      return game.isToPlay;
    case "favorites":
      return game.isFavorite;
  }
}

function emptyKind(args: {
  rows: Game[];
  titleQuery: string;
  storePlatform: ShelfQuery["storePlatform"];
  shelf: ShelfId;
  shelfGames: Game[];
}): EmptyKind {
  if (args.rows.length > 0) return "none";
  if (args.titleQuery) return "search-miss";
  if (args.storePlatform != null && args.shelfGames.length > 0) {
    return "platform-miss";
  }
  if (args.shelf === "favorites") return "favorites-empty";
  return "shelf-empty";
}
