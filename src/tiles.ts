import {
  renderCodeReviewCard,
  renderFootprintCard,
  renderPullRequestsCard,
} from './render/cards.js';
import type { DataNeed, StatsPayload, Theme } from './types.js';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TileDef {
  kind: 'card';
  /** Queries the fetcher must run for this card. Unselected cards cost nothing. */
  needs: DataNeed[];
  render(p: StatsPayload, theme: Theme, box: Box): string;
}

export const TILES: Record<string, TileDef> = {
  'pull-requests': { kind: 'card', needs: ['prs'], render: renderPullRequestsCard },
  'code-review': { kind: 'card', needs: ['reviews', 'issues'], render: renderCodeReviewCard },
  footprint: { kind: 'card', needs: ['prs', 'ownRepos'], render: renderFootprintCard },
};

export const DEFAULT_TILES = ['pull-requests', 'code-review', 'footprint'];

export const TILE_KEYS = Object.keys(TILES);

/**
 * Parse a comma-separated card list. Unknown keys are a hard error rather than
 * a silent drop — a typo in a workflow would otherwise quietly delete a card.
 */
export function parseTiles(input: string | undefined): string[] {
  if (!input || !input.trim()) return DEFAULT_TILES;
  const keys = input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const unknown = keys.filter((k) => !(k in TILES));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown tile(s): ${unknown.join(', ')}. Available: ${TILE_KEYS.join(', ')}`,
    );
  }
  if (keys.length === 0) return DEFAULT_TILES;

  return [...new Set(keys)];
}

/** Union of every selected card's data requirements. */
export function neededData(tileKeys: string[]): Set<DataNeed> {
  const needs = new Set<DataNeed>();
  for (const key of tileKeys) {
    for (const need of TILES[key].needs) needs.add(need);
  }
  return needs;
}
