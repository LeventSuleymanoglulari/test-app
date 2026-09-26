import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { Game, ImportProgress, LibraryDocument } from "./types.ts";
import {
  allowArtworkURL,
  isOpenableSourceURL,
  resolveStorePlatform,
} from "./rules.ts";

export class LibraryFileError extends Error {
  constructor(path: string) {
    super(`Library file is not valid JSON: ${path}`);
    this.name = "LibraryFileError";
  }
}

export function emptyDocument(): LibraryDocument {
  return {
    version: 1,
    games: [],
    importProgress: { nextPage: 1, isComplete: false, importedCount: 0 },
  };
}

export function readDocument(path: string): LibraryDocument {
  if (!existsSync(path)) return emptyDocument();
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    throw new LibraryFileError(path);
  }
  return normalizeDocument(raw);
}

export function writeDocumentAtomic(
  path: string,
  doc: LibraryDocument,
): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(doc, null, 2), "utf8");
  renameSync(tmp, path);
}

function normalizeDocument(raw: unknown): LibraryDocument {
  if (!raw || typeof raw !== "object") return emptyDocument();
  const obj = raw as Record<string, unknown>;
  const games = Array.isArray(obj.games)
    ? obj.games.map(normalizeGame).filter((g): g is Game => g != null)
    : [];
  const progress = normalizeProgress(obj.importProgress);
  return { version: 1, games, importProgress: progress };
}

function normalizeProgress(raw: unknown): ImportProgress {
  if (!raw || typeof raw !== "object") {
    return { nextPage: 1, isComplete: false, importedCount: 0 };
  }
  const p = raw as Record<string, unknown>;
  const nextPage =
    typeof p.nextPage === "number" && Number.isInteger(p.nextPage) && p.nextPage > 0
      ? p.nextPage
      : 1;
  return {
    nextPage,
    isComplete: p.isComplete === true,
    importedCount:
      typeof p.importedCount === "number" &&
      Number.isInteger(p.importedCount) &&
      p.importedCount >= 0
        ? p.importedCount
        : 0,
  };
}

function normalizeGame(raw: unknown): Game | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  if (typeof g.id !== "string" || typeof g.title !== "string") return null;
  if (g.source !== "manual" && g.source !== "rawg") return null;
  let externalID: number | null = null;
  if (g.source === "rawg") {
    if (typeof g.externalID !== "number" || !Number.isInteger(g.externalID) || g.externalID <= 0) {
      return null;
    }
    externalID = g.externalID;
  }
  return {
    id: g.id,
    title: g.title,
    addedDate: typeof g.addedDate === "string" ? g.addedDate : new Date(0).toISOString(),
    source: g.source,
    externalID,
    sourceURL:
      typeof g.sourceURL === "string" && isOpenableSourceURL(g.sourceURL)
        ? g.sourceURL
        : null,
    releaseDate: typeof g.releaseDate === "string" ? g.releaseDate : null,
    platforms: Array.isArray(g.platforms)
      ? g.platforms.filter((p): p is string => typeof p === "string")
      : [],
    isInLibrary: g.isInLibrary === true,
    isWishlisted: g.isWishlisted === true,
    isToPlay: g.isToPlay === true,
    isPlayed: g.isPlayed === true,
    isCompleted: g.isCompleted === true,
    isFavorite: g.isFavorite === true,
    storePlatform: resolveStorePlatform(
      typeof g.storePlatform === "string" ? g.storePlatform : null,
    ),
    rating:
      typeof g.rating === "number" &&
      Number.isInteger(g.rating) &&
      g.rating >= 1 &&
      g.rating <= 10
        ? g.rating
        : null,
    artworkURL: allowArtworkURL(
      typeof g.artworkURL === "string" ? g.artworkURL : null,
    ),
  };
}
