/** Opaque local row id. Not a RAWG id. */
export type GameId = string;

export type Source = "manual" | "rawg";

export type StorePlatform =
  | "steam"
  | "epic"
  | "gog"
  | "pc"
  | "playstation"
  | "xbox"
  | "nintendo-switch"
  | "android"
  | "ios";

export type StatusFlag =
  | "isInLibrary"
  | "isWishlisted"
  | "isToPlay"
  | "isPlayed"
  | "isCompleted";

export type Game = {
  id: GameId;
  title: string;
  addedDate: string;
  source: Source;
  externalID: number | null;
  sourceURL: string | null;
  releaseDate: string | null;
  platforms: string[];
  isInLibrary: boolean;
  isWishlisted: boolean;
  isToPlay: boolean;
  isPlayed: boolean;
  isCompleted: boolean;
  isFavorite: boolean;
  storePlatform: StorePlatform | null;
  rating: number | null;
  artworkURL: string | null;
};

export type ShelfId = "all" | "library" | "wishlist" | "to-play" | "favorites";

export type ShelfQuery = {
  shelf: ShelfId;
  titleQuery: string;
  storePlatform: StorePlatform | null;
};

export type EmptyKind =
  | "none"
  | "search-miss"
  | "platform-miss"
  | "favorites-empty"
  | "shelf-empty";

export type BadgeCounts = {
  all: number;
  library: number;
  wishlist: number;
  toPlay: number;
  favorites: number;
};

export type ShelfSnapshot = {
  rows: Game[];
  badges: BadgeCounts;
  empty: EmptyKind;
};

export type RawgCandidate = {
  externalID: number;
  title: string;
  releaseDate: string | null;
  platforms: string[];
  artworkURL: string | null;
  sourceURL: string;
  slug: string | null;
};

export type RawgPage = {
  results: RawgCandidate[];
  hasNext: boolean;
  page: number;
};

export type RawgErrorKind =
  | "missing-key"
  | "unauthorized"
  | "rate-limited"
  | "server-error"
  | "timed-out"
  | "offline"
  | "invalid";

export type ApplyCommand =
  | { type: "add-manual"; title: string; confirmSeparate?: boolean }
  | { type: "add-rawg"; candidate: RawgCandidate; confirmSeparate?: boolean }
  | { type: "set-title"; id: GameId; title: string }
  | { type: "set-status"; id: GameId; flag: StatusFlag; value: boolean }
  | { type: "set-favorite"; id: GameId; value: boolean }
  | { type: "set-rating"; id: GameId; rating: number | null }
  | {
      type: "set-store-platform";
      id: GameId;
      storePlatform: StorePlatform | null | string;
    }
  | { type: "delete"; id: GameId };

export type ApplyOutcome =
  | { outcome: "ok"; id: GameId; game: Game }
  | { outcome: "same-title"; matches: Game[] }
  | { outcome: "exists"; id: GameId; game: Game }
  | {
      outcome: "rejected";
      reason: "empty-title" | "not-found" | "unchanged";
    }
  | { outcome: "ok-deleted"; id: GameId }
  | { outcome: "save-failed"; id: GameId };

export type RawgOp =
  | { type: "search"; query: string; page: number }
  | { type: "bulk-start"; restart?: boolean }
  | { type: "bulk-stop" }
  | { type: "bulk-status" };

export type BulkStatus = {
  running: boolean;
  nextPage: number;
  isComplete: boolean;
  importedCount: number;
  lastError: RawgErrorKind | null;
};

export type RawgResult =
  | { ok: true; page: RawgPage }
  | { ok: true; bulk: BulkStatus }
  | { ok: false; error: RawgErrorKind; ignored?: boolean };

export type KeyVault = {
  get(): Promise<string | null>;
  set(key: string): Promise<void>;
  clear(): Promise<void>;
};

export type ImportProgress = {
  nextPage: number;
  isComplete: boolean;
  importedCount: number;
};

export type LibraryDocument = {
  version: 1;
  games: Game[];
  importProgress: ImportProgress;
};

export type LibraryOpenOptions = {
  path: string;
  keyVault: KeyVault;
  fetch?: typeof fetch;
  now?: () => Date;
  pause?: (ms: number) => Promise<void>;
  write?: (path: string, doc: LibraryDocument) => void;
};
