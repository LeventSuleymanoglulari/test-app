import type { RawgCandidate, RawgPage } from "../types.ts";
import { allowArtworkURL, buildSourceURL } from "../rules.ts";

export function decodeSearchPayload(
  json: unknown,
  page: number,
): RawgPage | { error: "invalid" } {
  if (!json || typeof json !== "object") return { error: "invalid" };
  const obj = json as Record<string, unknown>;
  if (!Array.isArray(obj.results)) return { error: "invalid" };

  const results: RawgCandidate[] = [];
  for (const row of obj.results) {
    const candidate = decodeRow(row);
    if (candidate) results.push(candidate);
  }

  return {
    results,
    hasNext: obj.next != null,
    page,
  };
}

function decodeRow(row: unknown): RawgCandidate | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "number" || !Number.isInteger(r.id) || r.id <= 0) {
    return null;
  }
  if (typeof r.name !== "string") return null;
  const title = r.name.trim();
  if (!title) return null;

  const slug = typeof r.slug === "string" ? r.slug : null;
  const releaseDate = typeof r.released === "string" ? r.released : null;
  const platforms = decodePlatforms(r.platforms);
  const artworkURL = allowArtworkURL(
    typeof r.background_image === "string" ? r.background_image : null,
  );

  return {
    externalID: r.id,
    title,
    releaseDate,
    platforms,
    artworkURL,
    sourceURL: buildSourceURL(slug),
    slug,
  };
}

function decodePlatforms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const names = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const platform = (entry as { platform?: { name?: unknown } }).platform;
    if (!platform || typeof platform.name !== "string") continue;
    const name = platform.name.trim();
    if (name) names.add(name);
  }
  return [...names].sort();
}
