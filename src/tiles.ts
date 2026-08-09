import { topExternalByPrs, topExternalByStars } from './compute.js';
import { renderHeroTile } from './render/tiles/hero-tile.js';
import { renderLanguagesTile } from './render/tiles/languages-tile.js';
import { renderMiniTile } from './render/tiles/mini-tile.js';
import { renderStatTile } from './render/tiles/stat-tile.js';
import type { DataNeed, StatsPayload, Theme } from './types.js';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TileDef {
  /**
   * `hero` is the one loud tile and takes two columns — exactly one belongs on
   * a card. `stat` supports it. `mini` sits in the short bottom row.
   */
  kind: 'hero' | 'stat' | 'mini';
  /** Queries the fetcher must run for this tile. Unselected tiles cost nothing. */
  needs: DataNeed[];
  render(p: StatsPayload, theme: Theme, box: Box): string;
}

const n = (value: number): string => value.toLocaleString('en-US');

function trunc(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

/** "in the last week" vs "all time" — keeps captions honest on a scoped card. */
function scope(p: StatsPayload): string {
  return p.periodLabel ?? 'all time';
}

export const TILES: Record<string, TileDef> = {
  // --- the hero ----------------------------------------------------------
  'merged-prs': {
    kind: 'hero',
    needs: ['prs'],
    render: (p, theme, box) =>
      renderHeroTile({
        ...box,
        iconKey: 'git-pull-request',
        accent: theme.accents.prs,
        value: n(p.prsMergedExternal),
        label: "Merged into other people's repos",
        caption: `${scope(p)} · ${n(p.externalRepoCount)} projects · ${p.mergeRatePct}% merge rate`,
        bars: topExternalByPrs(p, 5).map((r) => ({
          label: r.name,
          value: r.value,
        })),
        barCaption: 'WHERE THAT WORK LANDED',
        theme,
      }),
  },

  // --- supporting stat tiles --------------------------------------------
  reviews: {
    kind: 'stat',
    needs: ['reviews'],
    render: (p, theme, box) =>
      renderStatTile({
        ...box,
        iconKey: 'message-square',
        accent: theme.accents.reviews,
        value: n(p.reviewsExternal),
        label: 'Reviews for others',
        caption: `of ${n(p.reviewsTotal)} reviews total`,
        rows: p.topReviewedRepos.map((r) => ({
          label: trunc(r.name, 18),
          value: n(r.value),
        })),
        theme,
      }),
  },

  projects: {
    kind: 'stat',
    needs: ['prs'],
    render: (p, theme, box) =>
      renderStatTile({
        ...box,
        iconKey: 'package',
        accent: theme.accents.projects,
        value: n(p.externalRepoCount),
        label: 'Projects shipped to',
        caption: 'with 2+ merged PRs',
        rows: topExternalByStars(p, 4).map((r) => ({
          label: trunc(r.name, 16),
          value: `★ ${n(r.value)}`,
        })),
        theme,
      }),
  },

  issues: {
    kind: 'stat',
    needs: ['issues'],
    render: (p, theme, box) => {
      const closed = p.issuesClosed;
      // Windowed cards can't show resolution: GitHub exposes issues opened in
      // a range but not issues closed in one.
      if (closed === null) {
        return renderStatTile({
          ...box,
          iconKey: 'circle-dot',
          accent: theme.accents.issues,
          value: n(p.issuesOpened),
          label: 'Issues opened',
          caption: scope(p),
          rows: [{ label: 'Opened', value: n(p.issuesOpened) }],
          theme,
        });
      }
      // The proof is finishing what you file, so resolution leads.
      const pct = p.issuesOpened === 0 ? 0 : Math.round((closed / p.issuesOpened) * 100);
      return renderStatTile({
        ...box,
        iconKey: 'circle-dot',
        accent: theme.accents.issues,
        value: `${pct}%`,
        label: 'Issues resolved',
        caption: `${n(closed)} of ${n(p.issuesOpened)} you filed`,
        rows: [
          { label: 'Opened', value: n(p.issuesOpened) },
          { label: 'Resolved', value: n(closed) },
          { label: 'Still open', value: n(Math.max(0, p.issuesOpened - closed)) },
        ],
        theme,
      });
    },
  },

  'ships-in': {
    kind: 'stat',
    needs: ['prs'],
    render: (p, theme, box) =>
      renderLanguagesTile({
        ...box,
        iconKey: 'code-brackets',
        accent: theme.accents.languages,
        count: p.languageCount,
        label: 'Ships in',
        caption: 'generated files excluded',
        languages: p.languages.map((l) => ({ name: l.name, color: l.color })),
        overflow: Math.max(0, p.languageCount - p.languages.length),
        theme,
      }),
  },

  // --- mini tiles --------------------------------------------------------
  'biggest-project': {
    kind: 'mini',
    needs: ['prs'],
    render: (p, theme, box) =>
      renderMiniTile({
        ...box,
        iconKey: 'trophy',
        iconColor: theme.textMuted,
        label: 'Biggest project',
        value: p.biggestProject?.name ?? '—',
        subLine: p.biggestProject
          ? `★ ${n(p.biggestProject.stars)} · ${n(p.biggestProject.mergedPrs)} merged`
          : 'no external merges yet',
        theme,
      }),
  },

  'merge-rate': {
    kind: 'mini',
    needs: ['prs'],
    render: (p, theme, box) =>
      renderMiniTile({
        ...box,
        iconKey: 'check-circle',
        iconColor: theme.textMuted,
        label: 'Merge rate',
        value: `${p.mergeRatePct}%`,
        subLine: `${n(p.prsMerged)} of ${n(p.prsOpened)} PRs`,
        theme,
      }),
  },

  'own-stars': {
    kind: 'mini',
    needs: ['ownRepos'],
    render: (p, theme, box) =>
      renderMiniTile({
        ...box,
        iconKey: 'star',
        iconColor: theme.textMuted,
        label: 'Stars earned',
        value: `${n(p.ownStars)}★`,
        subLine: p.ownTopRepo
          ? `top: ${trunc(p.ownTopRepo.name, 16)} · ★ ${n(p.ownTopRepo.stars)}`
          : `across ${n(p.ownRepoCount)} repos you built`,
        theme,
      }),
  },

  momentum: {
    kind: 'mini',
    needs: ['prs'],
    render: (p, theme, box) =>
      renderMiniTile({
        ...box,
        iconKey: 'trending-up',
        iconColor: theme.textMuted,
        label: 'Last 12 months',
        value: n(p.recentExternalPrs),
        subLine: `external merges · ${n(p.recentExternalRepoCount)} projects`,
        theme,
      }),
  },
};

export const DEFAULT_TILES = [
  'merged-prs',
  'reviews',
  'projects',
  'ships-in',
  'issues',
  'biggest-project',
  'merge-rate',
  'own-stars',
  'momentum',
];

export const TILE_KEYS = Object.keys(TILES);

/**
 * Parse a comma-separated tile list. Unknown keys are a hard error rather than
 * a silent drop — a typo in a workflow would otherwise quietly delete a tile.
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

  const unique = [...new Set(keys)];
  const heroes = unique.filter((k) => TILES[k].kind === 'hero');
  if (heroes.length > 1) {
    throw new Error(
      `Only one hero tile can be shown at a time; got: ${heroes.join(', ')}`,
    );
  }
  return unique;
}

/** Union of every selected tile's data requirements. */
export function neededData(tileKeys: string[]): Set<DataNeed> {
  const needs = new Set<DataNeed>();
  for (const key of tileKeys) {
    for (const need of TILES[key].needs) needs.add(need);
  }
  return needs;
}
