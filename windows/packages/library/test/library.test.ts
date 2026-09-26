import assert from "node:assert/strict";
import {
  mkdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { Library, MemoryKeyVault } from "../src/index.ts";
import type {
  Game,
  LibraryDocument,
  RawgCandidate,
  StorePlatform,
} from "../src/types.ts";

const dirs: string[] = [];

afterEach(async () => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

async function openLibrary(opts: {
  key?: string | null;
  fetch?: typeof fetch;
  now?: () => Date;
  pause?: (ms: number) => Promise<void>;
  write?: (path: string, doc: LibraryDocument) => void;
  seed?: LibraryDocument;
}) {
  const dir = await mkdtemp(join(tmpdir(), "oyun-lib-"));
  dirs.push(dir);
  const path = join(dir, "library.json");
  if (opts.seed) {
    await writeFile(path, JSON.stringify(opts.seed), "utf8");
  }
  const library = await Library.open({
    path,
    keyVault: new MemoryKeyVault(opts.key ?? null),
    fetch: opts.fetch,
    now: opts.now,
    pause: opts.pause ?? (async () => {}),
    write: opts.write,
  });
  return { library, path };
}

function candidate(
  partial: Partial<RawgCandidate> & Pick<RawgCandidate, "externalID" | "title">,
): RawgCandidate {
  return {
    releaseDate: null,
    platforms: [],
    artworkURL: null,
    sourceURL: "https://rawg.io/",
    slug: null,
    ...partial,
  };
}

function personal(game: Game) {
  return {
    rating: game.rating,
    isInLibrary: game.isInLibrary,
    isWishlisted: game.isWishlisted,
    isToPlay: game.isToPlay,
    isPlayed: game.isPlayed,
    isCompleted: game.isCompleted,
    isFavorite: game.isFavorite,
    storePlatform: game.storePlatform,
  };
}

describe("manual add", () => {
  test("trims title and rejects whitespace-only", async () => {
    const { library } = await openLibrary({});
    const ok = library.apply({ type: "add-manual", title: "  Hades\n" });
    assert.equal(ok.outcome, "ok");
    if (ok.outcome !== "ok") return;
    assert.equal(ok.game.title, "Hades");
    assert.equal(ok.game.source, "manual");
    assert.equal(ok.game.externalID, null);
    assert.deepEqual(personal(ok.game), {
      rating: null,
      isInLibrary: false,
      isWishlisted: false,
      isToPlay: false,
      isPlayed: false,
      isCompleted: false,
      isFavorite: false,
      storePlatform: null,
    });

    const rejected = library.apply({ type: "add-manual", title: " \n\t " });
    assert.deepEqual(rejected, {
      outcome: "rejected",
      reason: "empty-title",
    });
    assert.equal(
      library.view({ shelf: "all", titleQuery: "", storePlatform: null }).rows
        .length,
      1,
    );
  });

  test("same-title case and diacritic match; confirmSeparate inserts", async () => {
    const { library } = await openLibrary({});
    const first = library.apply({ type: "add-manual", title: "İstanbul" });
    assert.equal(first.outcome, "ok");

    const same = library.apply({ type: "add-manual", title: "istanbul" });
    assert.equal(same.outcome, "same-title");
    if (same.outcome !== "same-title") return;
    assert.equal(same.matches.length, 1);
    assert.equal(same.matches[0]!.title, "İstanbul");

    const separate = library.apply({
      type: "add-manual",
      title: "istanbul",
      confirmSeparate: true,
    });
    assert.equal(separate.outcome, "ok");
    if (separate.outcome !== "ok") return;
    assert.equal(separate.game.title, "istanbul");
    assert.equal(
      library.view({ shelf: "all", titleQuery: "", storePlatform: null }).rows
        .length,
      2,
    );
  });
});

describe("add-rawg", () => {
  test("re-add returns exists and does not change rating or statuses", async () => {
    const { library } = await openLibrary({});
    const added = library.apply({
      type: "add-rawg",
      candidate: candidate({
        externalID: 7,
        title: "Hades",
        sourceURL: "https://rawg.io/games/hades",
        slug: "hades",
      }),
    });
    assert.equal(added.outcome, "ok");
    if (added.outcome !== "ok") return;

    library.apply({ type: "set-rating", id: added.id, rating: 9 });
    library.apply({
      type: "set-status",
      id: added.id,
      flag: "isPlayed",
      value: true,
    });
    library.apply({ type: "set-favorite", id: added.id, value: true });

    const again = library.apply({
      type: "add-rawg",
      candidate: candidate({
        externalID: 7,
        title: "Hades II",
        sourceURL: "https://rawg.io/games/hades",
      }),
    });
    assert.equal(again.outcome, "exists");
    if (again.outcome !== "exists") return;
    assert.equal(again.id, added.id);
    assert.equal(again.game.title, "Hades");
    assert.equal(again.game.rating, 9);
    assert.equal(again.game.isPlayed, true);
    assert.equal(again.game.isFavorite, true);
  });

  test("new id with matching manual title returns same-title until confirmSeparate", async () => {
    const { library } = await openLibrary({});
    library.apply({ type: "add-manual", title: "Celeste" });

    const blocked = library.apply({
      type: "add-rawg",
      candidate: candidate({ externalID: 42, title: "celeste" }),
    });
    assert.equal(blocked.outcome, "same-title");
    if (blocked.outcome !== "same-title") return;
    assert.equal(blocked.matches[0]!.source, "manual");
    assert.equal(
      library.view({ shelf: "all", titleQuery: "", storePlatform: null }).rows
        .length,
      1,
    );

    const inserted = library.apply({
      type: "add-rawg",
      candidate: candidate({ externalID: 42, title: "celeste" }),
      confirmSeparate: true,
    });
    assert.equal(inserted.outcome, "ok");
    if (inserted.outcome !== "ok") return;
    assert.equal(inserted.game.source, "rawg");
    assert.equal(inserted.game.externalID, 42);
    assert.equal(inserted.game.rating, null);
  });
});

describe("rating and status", () => {
  test("rating 9 stores, 0 leaves previous, null clears", async () => {
    const { library } = await openLibrary({});
    const added = library.apply({ type: "add-manual", title: "Hades" });
    assert.equal(added.outcome, "ok");
    if (added.outcome !== "ok") return;

    const nine = library.apply({ type: "set-rating", id: added.id, rating: 9 });
    assert.equal(nine.outcome, "ok");
    if (nine.outcome !== "ok") return;
    assert.equal(nine.game.rating, 9);

    const zero = library.apply({ type: "set-rating", id: added.id, rating: 0 });
    assert.deepEqual(zero, { outcome: "rejected", reason: "unchanged" });
    assert.equal(
      library.view({ shelf: "all", titleQuery: "", storePlatform: null }).rows[0]!
        .rating,
      9,
    );

    const cleared = library.apply({
      type: "set-rating",
      id: added.id,
      rating: null,
    });
    assert.equal(cleared.outcome, "ok");
    if (cleared.outcome !== "ok") return;
    assert.equal(cleared.game.rating, null);
  });

  test("set-status changes one flag only", async () => {
    const { library } = await openLibrary({});
    const added = library.apply({ type: "add-manual", title: "Hades" });
    assert.equal(added.outcome, "ok");
    if (added.outcome !== "ok") return;

    const result = library.apply({
      type: "set-status",
      id: added.id,
      flag: "isInLibrary",
      value: true,
    });
    assert.equal(result.outcome, "ok");
    if (result.outcome !== "ok") return;
    assert.equal(result.game.isInLibrary, true);
    assert.equal(result.game.isWishlisted, false);
    assert.equal(result.game.isToPlay, false);
    assert.equal(result.game.isPlayed, false);
    assert.equal(result.game.isCompleted, false);
    assert.equal(result.game.isFavorite, false);
  });

  test("throwing writer restores only the edited field", async () => {
    let throwsLeft = 0;
    const { library } = await openLibrary({
      write: (filePath, doc) => {
        if (throwsLeft > 0) {
          throwsLeft -= 1;
          throw new Error("disk full");
        }
        mkdirSync(dirname(filePath), { recursive: true });
        const tmp = `${filePath}.tmp`;
        writeFileSync(tmp, JSON.stringify(doc), "utf8");
        renameSync(tmp, filePath);
      },
    });
    const added = library.apply({ type: "add-manual", title: "Hades" });
    assert.equal(added.outcome, "ok");
    if (added.outcome !== "ok") return;

    library.apply({ type: "set-rating", id: added.id, rating: 8 });
    library.apply({
      type: "set-status",
      id: added.id,
      flag: "isPlayed",
      value: true,
    });

    throwsLeft = 1;
    const failed = library.apply({
      type: "set-rating",
      id: added.id,
      rating: 3,
    });
    assert.equal(failed.outcome, "save-failed");
    const row = library.view({
      shelf: "all",
      titleQuery: "",
      storePlatform: null,
    }).rows[0]!;
    assert.equal(row.rating, 8);
    assert.equal(row.isPlayed, true);
  });
});

describe("view", () => {
  test("shelf, search, store filter, badges, sort", async () => {
    let tick = 0;
    const { library } = await openLibrary({
      now: () => new Date(Date.UTC(2024, 0, 1 + tick++, 12)),
    });

    const a = library.apply({ type: "add-manual", title: "Alpha" });
    const b = library.apply({ type: "add-manual", title: "Beta" });
    const c = library.apply({ type: "add-manual", title: "Gamma" });
    assert.equal(a.outcome, "ok");
    assert.equal(b.outcome, "ok");
    assert.equal(c.outcome, "ok");
    if (a.outcome !== "ok" || b.outcome !== "ok" || c.outcome !== "ok") return;

    library.apply({
      type: "set-status",
      id: a.id,
      flag: "isInLibrary",
      value: true,
    });
    library.apply({ type: "set-favorite", id: b.id, value: true });
    library.apply({
      type: "set-store-platform",
      id: a.id,
      storePlatform: "steam",
    });
    library.apply({
      type: "set-store-platform",
      id: b.id,
      storePlatform: "epic",
    });

    const libraryShelf = library.view({
      shelf: "library",
      titleQuery: "",
      storePlatform: null,
    });
    assert.equal(libraryShelf.rows.length, 1);
    assert.equal(libraryShelf.rows[0]!.title, "Alpha");
    assert.deepEqual(libraryShelf.badges, {
      all: 3,
      library: 1,
      wishlist: 0,
      toPlay: 0,
      favorites: 1,
    });

    const search = library.view({
      shelf: "all",
      titleQuery: "bet",
      storePlatform: null,
    });
    assert.equal(search.rows.length, 1);
    assert.equal(search.rows[0]!.title, "Beta");
    assert.equal(search.empty, "none");
    assert.deepEqual(search.badges, {
      all: 3,
      library: 1,
      wishlist: 0,
      toPlay: 0,
      favorites: 1,
    });

    const miss = library.view({
      shelf: "all",
      titleQuery: "zzz",
      storePlatform: null,
    });
    assert.equal(miss.empty, "search-miss");

    const steam = library.view({
      shelf: "all",
      titleQuery: "",
      storePlatform: "steam" as StorePlatform,
    });
    assert.equal(steam.rows.length, 1);
    assert.equal(steam.rows[0]!.title, "Alpha");
    assert.ok(!steam.rows.some((g) => g.storePlatform === null));

    const gogMiss = library.view({
      shelf: "all",
      titleQuery: "",
      storePlatform: "gog",
    });
    assert.equal(gogMiss.rows.length, 0);
    assert.equal(gogMiss.empty, "platform-miss");

    const newestFirst = library.view({
      shelf: "all",
      titleQuery: "",
      storePlatform: null,
    });
    assert.deepEqual(
      newestFirst.rows.map((g) => g.title),
      ["Gamma", "Beta", "Alpha"],
    );

    const favPlatform = library.view({
      shelf: "favorites",
      titleQuery: "",
      storePlatform: "steam",
    });
    assert.equal(favPlatform.rows.length, 0);
    assert.equal(favPlatform.empty, "platform-miss");
  });
});

describe("rawg search", () => {
  test("missing key does not call fetch; fixture decodes and drops community rating", async () => {
    let fetchCalls = 0;
    const { library } = await openLibrary({
      key: null,
      fetch: async () => {
        fetchCalls += 1;
        return new Response("{}", { status: 200 });
      },
    });
    const missing = await library.rawg({
      type: "search",
      query: "hades",
      page: 1,
    });
    assert.deepEqual(missing, { ok: false, error: "missing-key" });
    assert.equal(fetchCalls, 0);

    const { library: withKey } = await openLibrary({
      key: "test-key-secret",
      fetch: async (input) => {
        fetchCalls += 1;
        const url = String(input);
        assert.ok(url.includes("search=hades"));
        assert.ok(url.includes("page_size=20"));
        return new Response(
          JSON.stringify({
            next: "https://api.rawg.io/api/games?page=2",
            results: [
              {
                id: 7,
                name: "  Hades ",
                rating: 4.8,
                background_image:
                  "https://media.rawg.io/media/games/hades.jpg",
                slug: "hades",
                platforms: [{ platform: { name: "PC" } }],
              },
              { id: 0, name: "Bad" },
              { id: 8, name: "" },
            ],
          }),
          { status: 200 },
        );
      },
    });
    fetchCalls = 0;
    const page = await withKey.rawg({
      type: "search",
      query: "hades",
      page: 1,
    });
    assert.equal(page.ok, true);
    if (!page.ok || !("page" in page)) return;
    assert.equal(fetchCalls, 1);
    assert.equal(page.page.hasNext, true);
    assert.equal(page.page.results.length, 1);
    assert.equal(page.page.results[0]!.externalID, 7);
    assert.equal(page.page.results[0]!.title, "Hades");
    assert.equal(
      page.page.results[0]!.artworkURL,
      "https://media.rawg.io/media/games/hades.jpg",
    );
    assert.equal(
      page.page.results[0]!.sourceURL,
      "https://rawg.io/games/hades",
    );
    assert.ok(!("rating" in page.page.results[0]!));

    const added = withKey.apply({
      type: "add-rawg",
      candidate: page.page.results[0]!,
    });
    assert.equal(added.outcome, "ok");
    if (added.outcome !== "ok") return;
    assert.equal(added.game.rating, null);
  });
});

describe("bulk import", () => {
  test("imports pages, skips rawg id, keeps manual, persists progress, restart keeps games", async () => {
    const pages: Record<number, object> = {
      1: {
        next: "https://api.rawg.io/api/games?page=2",
        results: [
          { id: 1, name: "One", slug: "one" },
          { id: 2, name: "Two", slug: "two" },
        ],
      },
      2: {
        next: null,
        results: [
          { id: 1, name: "One Again", slug: "one" },
          { id: 3, name: "Three", slug: "three" },
        ],
      },
    };
    let fetchCalls = 0;
    const { library, path } = await openLibrary({
      key: "bulk-key",
      pause: async () => {},
      fetch: async (input) => {
        fetchCalls += 1;
        const url = new URL(String(input));
        assert.equal(url.searchParams.has("search"), false);
        const page = Number(url.searchParams.get("page"));
        return new Response(JSON.stringify(pages[page]), { status: 200 });
      },
    });

    library.apply({ type: "add-manual", title: "Two" });
    library.apply({
      type: "add-rawg",
      candidate: candidate({ externalID: 99, title: "Preload" }),
    });

    const started = await library.rawg({ type: "bulk-start" });
    assert.equal(started.ok, true);
    if (!started.ok || !("bulk" in started)) return;
    assert.equal(started.bulk.running, false);
    assert.equal(started.bulk.isComplete, true);
    assert.equal(started.bulk.nextPage, 3);
    assert.equal(fetchCalls, 2);
    assert.equal(started.bulk.importedCount, 3);

    const rows = library.view({
      shelf: "all",
      titleQuery: "",
      storePlatform: null,
    }).rows;
    const titles = rows.map((g) => g.title).sort();
    assert.deepEqual(titles, ["One", "Preload", "Three", "Two", "Two"]);
    assert.equal(rows.filter((g) => g.externalID === 1).length, 1);
    assert.equal(
      rows.filter((g) => g.title === "Two" && g.source === "manual").length,
      1,
    );
    assert.equal(
      rows.filter((g) => g.title === "Two" && g.source === "rawg").length,
      1,
    );

    const doc = JSON.parse(await readFile(path, "utf8")) as LibraryDocument;
    assert.equal(doc.importProgress.nextPage, 3);
    assert.equal(doc.importProgress.isComplete, true);
    assert.equal(doc.importProgress.importedCount, 3);

    const beforeRestart = rows.length;
    const restarted = await library.rawg({
      type: "bulk-start",
      restart: true,
    });
    assert.equal(restarted.ok, true);
    if (!restarted.ok || !("bulk" in restarted)) return;
    assert.equal(restarted.bulk.isComplete, true);
    assert.equal(
      library.view({ shelf: "all", titleQuery: "", storePlatform: null }).rows
        .length,
      beforeRestart,
    );
  });
});

describe("stored file", () => {
  test("broken json is left untouched", async () => {
    const dir = await mkdtemp(join(tmpdir(), "oyun-lib-"));
    dirs.push(dir);
    const path = join(dir, "library.json");
    await writeFile(path, "{", "utf8");
    await assert.rejects(
      () => Library.open({ path, keyVault: new MemoryKeyVault(null) }),
      (err: unknown) =>
        err instanceof Error && err.name === "LibraryFileError",
    );
    assert.equal(await readFile(path, "utf8"), "{");
  });

  test("load folds search, legacy store labels, and unsafe urls", async () => {
    const dir = await mkdtemp(join(tmpdir(), "oyun-lib-"));
    dirs.push(dir);
    const path = join(dir, "library.json");
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        games: [
          {
            id: "g1",
            title: "İstanbul",
            addedDate: "2024-01-02T00:00:00.000Z",
            source: "manual",
            externalID: null,
            sourceURL: "https://evil.example/phish",
            releaseDate: null,
            platforms: [],
            isInLibrary: false,
            isWishlisted: false,
            isToPlay: false,
            isPlayed: false,
            isCompleted: false,
            isFavorite: false,
            storePlatform: "Epic Games",
            rating: null,
            artworkURL: "https://evil.example/a.png",
          },
        ],
        importProgress: { nextPage: 1, isComplete: false, importedCount: 0 },
      }),
      "utf8",
    );
    const library = await Library.open({
      path,
      keyVault: new MemoryKeyVault(null),
    });
    const view = library.view({
      shelf: "all",
      titleQuery: "istanbul",
      storePlatform: "epic",
    });
    assert.equal(view.rows.length, 1);
    assert.equal(view.rows[0]!.title, "İstanbul");
    assert.equal(view.rows[0]!.storePlatform, "epic");
    assert.equal(view.rows[0]!.artworkURL, null);
    assert.equal(view.rows[0]!.sourceURL, null);
  });
});

describe("errors", () => {
  test("401 error objects and messages never contain the key", async () => {
    const secret = "super-secret-key-value-xyz";
    const { library } = await openLibrary({
      key: secret,
      fetch: async () =>
        new Response(JSON.stringify({ detail: "auth" }), { status: 401 }),
    });
    const result = await library.rawg({
      type: "search",
      query: "x",
      page: 1,
    });
    assert.deepEqual(result, { ok: false, error: "unauthorized" });
    assert.ok(!JSON.stringify(result).includes(secret));
  });
});
