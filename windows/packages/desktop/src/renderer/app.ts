import type {
  ApplyOutcome,
  Game,
  GameId,
  RawgCandidate,
  ShelfId,
  ShelfSnapshot,
  StatusFlag,
  StorePlatform,
} from "@oyun/library";
import {
  emptyCopy,
  shelfLabels,
  statusLabels,
  storeLabels,
  ui,
  viewModeLabels,
} from "./labels-tr.ts";

type OyunApi = {
  view(query: {
    shelf: ShelfId;
    titleQuery: string;
    storePlatform: StorePlatform | null;
  }): Promise<ShelfSnapshot>;
  apply(command: unknown): Promise<ApplyOutcome>;
  rawg(op: unknown): Promise<
    | { ok: true; page: { results: RawgCandidate[]; hasNext: boolean; page: number } }
    | { ok: true; bulk: { running: boolean; nextPage: number; isComplete: boolean; importedCount: number; lastError: string | null } }
    | { ok: false; error: string; ignored?: boolean }
  >;
  hasKey(): Promise<boolean>;
  setKey(key: string): Promise<void>;
  clearKey(): Promise<void>;
  openExternal(url: string): Promise<void>;
};

declare global {
  interface Window {
    oyun: OyunApi;
  }
}

const api = window.oyun;

const state = {
  shelf: "all" as ShelfId,
  titleQuery: "",
  storePlatform: null as StorePlatform | null,
  viewMode: "list" as "list" | "window",
  selectedId: null as GameId | null,
  snap: null as ShelfSnapshot | null,
  addOpen: false,
  sameTitle: null as { title: string; kind: "manual" | "rawg"; candidate?: RawgCandidate } | null,
  searchResults: [] as RawgCandidate[],
  searchPage: 1,
  searchHasNext: false,
  searchError: null as string | null,
  bulkMessage: "",
  hasKey: false,
};

const root = document.getElementById("app")!;

async function refresh(): Promise<void> {
  state.snap = await api.view({
    shelf: state.shelf,
    titleQuery: state.titleQuery,
    storePlatform: state.storePlatform,
  });
  state.hasKey = await api.hasKey();
  render();
}

function selectedGame(): Game | null {
  if (!state.selectedId || !state.snap) return null;
  return (
    state.snap.rows.find((g) => g.id === state.selectedId) ??
    null
  );
}

async function loadSelectedFallback(): Promise<Game | null> {
  if (!state.selectedId) return null;
  const fromRows = selectedGame();
  if (fromRows) return fromRows;
  const all = await api.view({
    shelf: "all",
    titleQuery: "",
    storePlatform: null,
  });
  return all.rows.find((g) => g.id === state.selectedId) ?? null;
}

async function afterSuccessfulAdd(id: GameId): Promise<void> {
  state.shelf = "all";
  state.selectedId = id;
  state.addOpen = false;
  state.sameTitle = null;
  await refresh();
}

function render(): void {
  const snap = state.snap;
  if (!snap) {
    root.innerHTML = "<p>Yükleniyor…</p>";
    return;
  }

  const detailId = state.selectedId;
  void paint(snap, detailId);
}

async function paint(snap: ShelfSnapshot, detailId: GameId | null): Promise<void> {
  const detail = detailId
    ? snap.rows.find((g) => g.id === detailId) ?? (await loadSelectedFallback())
    : null;

  root.innerHTML = `
    <nav class="rail" aria-label="Raf">
      ${(["all", "library", "wishlist", "to-play", "favorites"] as ShelfId[])
        .map((id) => {
          const count =
            id === "all"
              ? snap.badges.all
              : id === "library"
                ? snap.badges.library
                : id === "wishlist"
                  ? snap.badges.wishlist
                  : id === "to-play"
                    ? snap.badges.toPlay
                    : snap.badges.favorites;
          return `<button type="button" data-shelf="${id}" class="${state.shelf === id ? "active" : ""}">${shelfLabels[id]}<span class="badge">${count}</span></button>`;
        })
        .join("")}
      <div style="flex:1"></div>
      <button type="button" data-action="open-add">${ui.addGame}</button>
    </nav>
    <section class="shelf">
      <div class="toolbar">
        <input type="search" id="title-query" placeholder="${ui.searchPlaceholder}" value="${escapeAttr(state.titleQuery)}" />
        <select id="store-filter">
          <option value="">${ui.allPlatforms}</option>
          ${Object.entries(storeLabels)
            .map(
              ([value, label]) =>
                `<option value="${value}" ${state.storePlatform === value ? "selected" : ""}>${label}</option>`,
            )
            .join("")}
        </select>
        <button type="button" data-view="list" class="${state.viewMode === "list" ? "active" : ""}">${viewModeLabels.list}</button>
        <button type="button" data-view="window" class="${state.viewMode === "window" ? "active" : ""}">${viewModeLabels.window}</button>
      </div>
      ${
        snap.rows.length === 0
          ? `<div class="empty"><h2>${emptyCopy[snap.empty].title}</h2><p>${emptyCopy[snap.empty].body}</p></div>`
          : `<div class="rows ${state.viewMode}">${snap.rows.map((g) => rowHtml(g)).join("")}</div>`
      }
    </section>
    <aside class="detail">
      ${detail ? detailHtml(detail) : `<p class="muted">Bir oyun seçin veya ekleyin.</p>`}
      <hr />
      <div class="stack">
        <label>${ui.apiKey}
          <input type="password" id="api-key" placeholder="${state.hasKey ? "••••••••" : ""}" />
        </label>
        <button type="button" data-action="save-key">${ui.saveKey}</button>
      </div>
    </aside>
    ${state.addOpen ? addModalHtml() : ""}
    ${state.sameTitle ? sameTitleModalHtml() : ""}
  `;

  bind(snap);
}

function rowHtml(game: Game): string {
  const cover = game.artworkURL
    ? `<img src="${escapeAttr(game.artworkURL)}" alt="" />`
    : `<div class="cover"></div>`;
  return `<button type="button" class="row ${state.selectedId === game.id ? "selected" : ""}" data-select="${game.id}">
    ${cover}
    <div>
      <div>${escapeHtml(game.title)}</div>
      <div class="muted">${game.storePlatform ? storeLabels[game.storePlatform] ?? "" : ""}</div>
    </div>
  </button>`;
}

function detailHtml(game: Game): string {
  const flags: StatusFlag[] = [
    "isInLibrary",
    "isWishlisted",
    "isToPlay",
    "isPlayed",
    "isCompleted",
  ];
  return `
    <h2>${escapeHtml(game.title)}</h2>
    <label>Başlık <input id="detail-title" value="${escapeAttr(game.title)}" /></label>
    ${flags
      .map(
        (flag) =>
          `<label>${statusLabels[flag]} <input type="checkbox" data-flag="${flag}" ${game[flag] ? "checked" : ""} /></label>`,
      )
      .join("")}
    <label>${statusLabels.isFavorite} <input type="checkbox" data-favorite ${game.isFavorite ? "checked" : ""} /></label>
    <label>${ui.rating}
      <select id="detail-rating">
        <option value="">${ui.clearRating}</option>
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
          .map(
            (n) =>
              `<option value="${n}" ${game.rating === n ? "selected" : ""}>${n}/10</option>`,
          )
          .join("")}
      </select>
    </label>
    <label>${ui.storePlatform}
      <select id="detail-store">
        <option value="">—</option>
        ${Object.entries(storeLabels)
          .map(
            ([value, label]) =>
              `<option value="${value}" ${game.storePlatform === value ? "selected" : ""}>${label}</option>`,
          )
          .join("")}
      </select>
    </label>
    <div class="stack">
      <button type="button" data-action="save-title">Başlığı kaydet</button>
      <button type="button" class="danger" data-action="delete">${ui.delete}</button>
    </div>
  `;
}

function addModalHtml(): string {
  return `<div class="modal-backdrop" data-action="close-add"><div class="modal" onclick="event.stopPropagation()">
    <h3>${ui.addGame}</h3>
    <label>${ui.manualTitle} <input id="manual-title" /></label>
    <button type="button" data-action="add-manual">${ui.addManual}</button>
    <hr />
    <label>${ui.rawgSearch} <input id="rawg-query" /></label>
    <div class="stack" style="flex-direction:row;flex-wrap:wrap">
      <button type="button" data-action="rawg-search">${ui.searchAction}</button>
      <button type="button" data-action="rawg-next" ${state.searchHasNext ? "" : "disabled"}>${ui.nextPage}</button>
      <button type="button" data-action="rawg-retry">${ui.retry}</button>
    </div>
    ${state.searchError ? `<p class="danger">${escapeHtml(state.searchError)}</p>` : ""}
    <div>${state.searchResults.map((c) => candidateHtml(c)).join("")}</div>
    <hr />
    <p class="muted">${state.bulkMessage}</p>
    <div class="stack" style="flex-direction:row;flex-wrap:wrap">
      <button type="button" data-action="bulk-start">${ui.bulkStart}</button>
      <button type="button" data-action="bulk-stop">${ui.bulkStop}</button>
      <button type="button" data-action="bulk-restart">${ui.bulkRestart}</button>
    </div>
    <button type="button" data-action="close-add">${ui.cancel}</button>
  </div></div>`;
}

function candidateHtml(c: RawgCandidate): string {
  return `<div class="candidate">
    <div><strong>${escapeHtml(c.title)}</strong><div class="muted">${escapeHtml(c.releaseDate ?? "")}</div></div>
    <button type="button" data-add-rawg="${c.externalID}">Ekle</button>
  </div>`;
}

function sameTitleModalHtml(): string {
  return `<div class="modal-backdrop"><div class="modal">
    <p>${ui.sameTitlePrompt}</p>
    <button type="button" data-action="confirm-separate">${ui.confirmSeparate}</button>
    <button type="button" data-action="cancel-same">${ui.cancel}</button>
  </div></div>`;
}

function bind(_snap: ShelfSnapshot): void {
  root.querySelectorAll<HTMLButtonElement>("[data-shelf]").forEach((btn) => {
    btn.onclick = () => {
      state.shelf = btn.dataset.shelf as ShelfId;
      void refresh();
    };
  });
  root.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((btn) => {
    btn.onclick = () => {
      state.viewMode = btn.dataset.view as "list" | "window";
      render();
    };
  });
  root.querySelectorAll<HTMLButtonElement>("[data-select]").forEach((btn) => {
    btn.onclick = () => {
      state.selectedId = btn.dataset.select!;
      render();
    };
  });
  const search = root.querySelector<HTMLInputElement>("#title-query");
  if (search) {
    search.oninput = () => {
      state.titleQuery = search.value;
      void refresh();
    };
  }
  const store = root.querySelector<HTMLSelectElement>("#store-filter");
  if (store) {
    store.onchange = () => {
      state.storePlatform = (store.value || null) as StorePlatform | null;
      void refresh();
    };
  }

  const action = (name: string, fn: () => void | Promise<void>) => {
    root.querySelectorAll(`[data-action="${name}"]`).forEach((el) => {
      (el as HTMLButtonElement).onclick = () => void fn();
    });
  };

  action("open-add", () => {
    state.addOpen = true;
    render();
  });
  action("close-add", () => {
    state.addOpen = false;
    render();
  });
  action("save-key", async () => {
    const input = root.querySelector<HTMLInputElement>("#api-key");
    if (!input || !input.value.trim()) return;
    await api.setKey(input.value.trim());
    input.value = "";
    await refresh();
  });
  action("add-manual", async () => {
    const input = root.querySelector<HTMLInputElement>("#manual-title");
    if (!input) return;
    const result = await api.apply({ type: "add-manual", title: input.value });
    if (result.outcome === "same-title") {
      state.sameTitle = { title: input.value, kind: "manual" };
      render();
      return;
    }
    if (result.outcome === "ok") await afterSuccessfulAdd(result.id);
  });
  action("confirm-separate", async () => {
    if (!state.sameTitle) return;
    if (state.sameTitle.kind === "manual") {
      const result = await api.apply({
        type: "add-manual",
        title: state.sameTitle.title,
        confirmSeparate: true,
      });
      if (result.outcome === "ok") await afterSuccessfulAdd(result.id);
    } else if (state.sameTitle.candidate) {
      const result = await api.apply({
        type: "add-rawg",
        candidate: state.sameTitle.candidate,
        confirmSeparate: true,
      });
      if (result.outcome === "ok") await afterSuccessfulAdd(result.id);
    }
  });
  action("cancel-same", () => {
    state.sameTitle = null;
    render();
  });
  action("rawg-search", () => void runSearch(1));
  action("rawg-next", () => void runSearch(state.searchPage + 1));
  action("rawg-retry", () => void runSearch(state.searchPage || 1));
  action("bulk-start", async () => {
    const result = await api.rawg({ type: "bulk-start" });
    state.bulkMessage = describeBulk(result);
    render();
  });
  action("bulk-stop", async () => {
    const result = await api.rawg({ type: "bulk-stop" });
    state.bulkMessage = describeBulk(result);
    render();
  });
  action("bulk-restart", async () => {
    const result = await api.rawg({ type: "bulk-start", restart: true });
    state.bulkMessage = describeBulk(result);
    await refresh();
  });

  root.querySelectorAll<HTMLButtonElement>("[data-add-rawg]").forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.addRawg);
      const candidate = state.searchResults.find((c) => c.externalID === id);
      if (!candidate) return;
      const result = await api.apply({ type: "add-rawg", candidate });
      if (result.outcome === "same-title") {
        state.sameTitle = { title: candidate.title, kind: "rawg", candidate };
        render();
        return;
      }
      if (result.outcome === "exists" || result.outcome === "ok") {
        await afterSuccessfulAdd(result.id);
      }
    };
  });

  if (state.selectedId) {
    root.querySelectorAll<HTMLInputElement>("[data-flag]").forEach((el) => {
      el.onchange = async () => {
        await api.apply({
          type: "set-status",
          id: state.selectedId!,
          flag: el.dataset.flag as StatusFlag,
          value: el.checked,
        });
        await refresh();
      };
    });
    const fav = root.querySelector<HTMLInputElement>("[data-favorite]");
    if (fav) {
      fav.onchange = async () => {
        await api.apply({
          type: "set-favorite",
          id: state.selectedId!,
          value: fav.checked,
        });
        await refresh();
      };
    }
    const rating = root.querySelector<HTMLSelectElement>("#detail-rating");
    if (rating) {
      rating.onchange = async () => {
        const value = rating.value === "" ? null : Number(rating.value);
        await api.apply({
          type: "set-rating",
          id: state.selectedId!,
          rating: value,
        });
        await refresh();
      };
    }
    const storeSelect = root.querySelector<HTMLSelectElement>("#detail-store");
    if (storeSelect) {
      storeSelect.onchange = async () => {
        await api.apply({
          type: "set-store-platform",
          id: state.selectedId!,
          storePlatform: storeSelect.value || null,
        });
        await refresh();
      };
    }
    action("save-title", async () => {
      const input = root.querySelector<HTMLInputElement>("#detail-title");
      if (!input || !state.selectedId) return;
      await api.apply({
        type: "set-title",
        id: state.selectedId,
        title: input.value,
      });
      await refresh();
    });
    action("delete", async () => {
      if (!state.selectedId) return;
      const game = await loadSelectedFallback();
      const title = game?.title ?? "";
      const ok = confirm(
        `"${title}" silinsin mi?\n\nBu oyun kütüphaneden silinecek. Bu işlem geri alınamaz.`,
      );
      if (!ok) return;
      await api.apply({ type: "delete", id: state.selectedId });
      state.selectedId = null;
      await refresh();
    });
  }
}

async function runSearch(page: number): Promise<void> {
  const input = root.querySelector<HTMLInputElement>("#rawg-query");
  const query = input?.value.trim() ?? "";
  if (!query) return;
  const result = await api.rawg({ type: "search", query, page });
  if (!result.ok) {
    state.searchError = result.ignored
      ? "İstek yok sayıldı"
      : rawgErrorMessage(result.error);
    render();
    return;
  }
  if (!("page" in result)) return;
  state.searchResults = result.page.results;
  state.searchPage = result.page.page;
  state.searchHasNext = result.page.hasNext;
  state.searchError = null;
  render();
}

function describeBulk(
  result:
    | { ok: true; bulk: { running: boolean; nextPage: number; isComplete: boolean; importedCount: number; lastError: string | null } }
    | { ok: true; page: unknown }
    | { ok: false; error: string; ignored?: boolean },
): string {
  if (!result.ok) {
    return result.ignored
      ? "İstek yok sayıldı"
      : rawgErrorMessage(result.error);
  }
  if (!("bulk" in result)) return "";
  const b = result.bulk;
  if (b.lastError) return rawgErrorMessage(b.lastError);
  if (b.isComplete) return `Tamamlandı. ${b.importedCount} oyun aktarıldı.`;
  if (b.running) return `Çalışıyor… sonraki sayfa ${b.nextPage}`;
  return `Durum: sayfa ${b.nextPage}, ${b.importedCount} aktarıldı`;
}

function rawgErrorMessage(error: string): string {
  switch (error) {
    case "missing-key":
      return "RAWG API anahtarı gerekli.";
    case "unauthorized":
      return "RAWG API anahtarı veya erişim izni geçersiz.";
    case "rate-limited":
      return "RAWG istek kotası doldu.";
    case "server-error":
      return "RAWG şu anda yanıt veremiyor.";
    case "timed-out":
      return "RAWG isteği zaman aşımına uğradı.";
    case "offline":
      return "Ağ bağlantısı kurulamadı.";
    default:
      return "RAWG'den geçerli bir yanıt alınamadı.";
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

void refresh();
