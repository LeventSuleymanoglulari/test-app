import type { RawgErrorKind } from "../types.ts";

const BASE = "https://api.rawg.io/api/games";
const TIMEOUT_MS = 30_000;

export async function fetchGamesPage(args: {
  key: string;
  page: number;
  search?: string;
  fetch: typeof fetch;
  signal: AbortSignal;
}): Promise<{ json: unknown } | { error: RawgErrorKind }> {
  const url = new URL(BASE);
  url.searchParams.set("page", String(args.page));
  url.searchParams.set("page_size", "20");
  url.searchParams.set("key", args.key);
  if (args.search !== undefined) {
    url.searchParams.set("search", args.search);
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  args.signal.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort("timeout"), TIMEOUT_MS);

  try {
    const response = await args.fetch(url, { signal: controller.signal });
    if (response.status === 401 || response.status === 403) {
      return { error: "unauthorized" };
    }
    if (response.status === 429) return { error: "rate-limited" };
    if (response.status >= 500 && response.status <= 599) {
      return { error: "server-error" };
    }
    if (response.status < 200 || response.status > 299) {
      return { error: "invalid" };
    }
    try {
      const json: unknown = await response.json();
      return { json };
    } catch {
      return { error: "invalid" };
    }
  } catch (err) {
    if (controller.signal.aborted && controller.signal.reason === "timeout") {
      return { error: "timed-out" };
    }
    if (args.signal.aborted) return { error: "timed-out" };
    if (isTimeoutError(err)) return { error: "timed-out" };
    return { error: "offline" };
  } finally {
    clearTimeout(timer);
    args.signal.removeEventListener("abort", onAbort);
  }
}

function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: string; cause?: unknown };
  if (e.name === "TimeoutError" || e.code === "ABORT_ERR") return true;
  if (e.cause) return isTimeoutError(e.cause);
  return false;
}
