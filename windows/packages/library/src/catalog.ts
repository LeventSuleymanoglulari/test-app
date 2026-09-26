import type { Game, GameId } from "./types.ts";
import { titlesEqual } from "./rules.ts";

export type Catalog = {
  byId: Map<GameId, Game>;
  byRawgId: Map<number, GameId>;
};

export function catalogFromGames(games: Game[]): Catalog {
  const byId = new Map<GameId, Game>();
  const byRawgId = new Map<number, GameId>();
  for (const game of games) {
    byId.set(game.id, game);
    if (game.source === "rawg" && game.externalID != null) {
      byRawgId.set(game.externalID, game.id);
    }
  }
  return { byId, byRawgId };
}

export function findSameTitle(catalog: Catalog, title: string): Game[] {
  const matches: Game[] = [];
  for (const game of catalog.byId.values()) {
    if (titlesEqual(game.title, title)) matches.push(cloneGame(game));
  }
  return matches;
}

export function insertGame(catalog: Catalog, game: Game): void {
  catalog.byId.set(game.id, game);
  if (game.source === "rawg" && game.externalID != null) {
    catalog.byRawgId.set(game.externalID, game.id);
  }
}

export function removeGame(catalog: Catalog, id: GameId): Game | null {
  const game = catalog.byId.get(id);
  if (!game) return null;
  catalog.byId.delete(id);
  if (game.source === "rawg" && game.externalID != null) {
    catalog.byRawgId.delete(game.externalID);
  }
  return game;
}

export function gamesList(catalog: Catalog): Game[] {
  return [...catalog.byId.values()].map(cloneGame);
}

export function cloneGame(game: Game): Game {
  return {
    ...game,
    platforms: [...game.platforms],
  };
}
