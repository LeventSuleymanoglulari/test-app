import type { Game, StorePlatform } from "./types.ts";

export function normalizeTitle(
  raw: string,
): { ok: true; title: string } | { ok: false } {
  const title = raw.trim();
  if (!title) return { ok: false };
  return { ok: true, title };
}

export function titlesEqual(a: string, b: string): boolean {
  return foldTitle(a) === foldTitle(b);
}

export function foldTitle(raw: string): string {
  return raw
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en");
}

export function normalizeRating(
  current: number | null,
  incoming: number | null,
): { ok: true; rating: number | null } | { ok: false } {
  if (incoming === null) return { ok: true, rating: null };
  if (!Number.isInteger(incoming) || incoming < 1 || incoming > 10) {
    return { ok: false };
  }
  return { ok: true, rating: incoming };
}

export function allowArtworkURL(url: string | null | undefined): string | null {
  if (url == null || typeof url !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (parsed.hostname !== "media.rawg.io") return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.port !== "") return null;
  return url;
}

const SLUG_RE = /^[A-Za-z0-9_-]+$/;

export function buildSourceURL(slug: string | null | undefined): string {
  if (typeof slug === "string" && SLUG_RE.test(slug)) {
    return `https://rawg.io/games/${slug}`;
  }
  return "https://rawg.io/";
}

export function isOpenableSourceURL(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname !== "rawg.io") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port !== "") return false;
  if (parsed.search !== "") return false;
  if (parsed.hash !== "") return false;
  return true;
}

const LEGACY: Record<string, StorePlatform> = {
  Steam: "steam",
  "Epic Games": "epic",
  GOG: "gog",
  PC: "pc",
  PlayStation: "playstation",
  Xbox: "xbox",
  "Nintendo Switch": "nintendo-switch",
  Android: "android",
  iOS: "ios",
};

const RAW = new Set<string>([
  "steam",
  "epic",
  "gog",
  "pc",
  "playstation",
  "xbox",
  "nintendo-switch",
  "android",
  "ios",
]);

export function resolveStorePlatform(
  raw: string | null | undefined,
): StorePlatform | null {
  if (raw == null || raw === "") return null;
  if (RAW.has(raw)) return raw as StorePlatform;
  return LEGACY[raw] ?? null;
}

export function defaultPersonalFields(): Pick<
  Game,
  | "isInLibrary"
  | "isWishlisted"
  | "isToPlay"
  | "isPlayed"
  | "isCompleted"
  | "isFavorite"
  | "storePlatform"
  | "rating"
> {
  return {
    isInLibrary: false,
    isWishlisted: false,
    isToPlay: false,
    isPlayed: false,
    isCompleted: false,
    isFavorite: false,
    storePlatform: null,
    rating: null,
  };
}
