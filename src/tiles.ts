import { topExternalByPrs, topExternalByStars } from './compute.js';
import { renderBars } from './render/tiles/bars.js';
import { renderHeroTile } from './render/tiles/hero-tile.js';
import { renderHexCluster } from './render/tiles/hex.js';
import { renderLanguagesTile } from './render/tiles/languages-tile.js';
import { renderMeter } from './render/tiles/meter.js';
import { renderMiniTile } from './render/tiles/mini-tile.js';
import { renderStatTile } from './render/tiles/stat-tile.js';
import { renderWave } from './render/tiles/wave.js';
import type { DataNeed, StatsPayload, Theme } from './types.js';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TileDef {
  /** `card` tiles fill the tall 3-column rows; `mini` tiles the short bottom row. */
  kind: 'card' | 'mini';
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

/** Chart zone shared by the card tiles: below the divider, inside the padding. */
const PAD = 28;
const CHART_TOP = 168;
/** Dot rows under a chart sit on a fixed grid near the card's bottom edge. */
const CHART_ROW_START = 320;
const CHART_ROW_PITCH = 32;

export const TILES: Record<string, TileDef> = {
  // --- the six chart cards ----------------------------------------------
  'merged-prs': {
    kind: 'card',
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

  activity: {
    kind: 'card',
    needs: ['prs'],
    render: (p, theme, box) =>
      renderStatTile({
        ...box,
        iconKey: 'trending-up',
        accent: theme.accents.prs,
        value: n(p.recentExternalPrs),
        label: 'Activity',
        caption: p.periodLabel ?? 'external merges · last 12 months',
        rows: [],
        chart: `<g transform="translate(${PAD}, ${CHART_TOP})">${renderWave({
          w: box.w - 2 * PAD,
          h: 344 - CHART_TOP,
          points: p.monthlyExternalMerges,
          accent: theme.accents.prs,
          gradId: 'gba-wave',
          theme,
        })}</g>`,
        theme,
      }),
  },

  'ships-in': {
    kind: 'card',
    needs: ['prs'],
    render: (p, theme, box) =>
      renderLanguagesTile({
        ...box,
        iconKey: 'code-brackets',
        accent: theme.accents.languages,
        count: p.languageCount,
        label: 'Ships in',
        caption: `top ${Math.min(8, p.languages.length)} by project count`,
        languages: p.languages.map((l) => ({ name: l.name, color: l.color, repos: l.repos })),
        overflow: Math.max(0, p.languageCount - p.languages.length),
        theme,
      }),
  },

  reviews: {
    kind: 'card',
    needs: ['reviews'],
    render: (p, theme, box) =>
      renderStatTile({
        ...box,
        iconKey: 'message-square',
        accent: theme.accents.reviews,
        value: n(p.reviewsExternal),
        label: 'Reviews for others',
        caption: `of ${n(p.reviewsTotal)} reviews total`,
        rows: [],
        chart: `<g transform="translate(${PAD}, 176)">${renderBars({
          entries: p.topReviewedRepos.slice(0, 4).map((r) => ({
            label: r.name,
            value: r.value,
          })),
          w: box.w - 2 * PAD,
          pitch: 42,
          gradId: 'gbrv-grad',
          gradFrom: '#8a3416',
          gradTo: '#d95926',
          theme,
        })}</g>`,
        theme,
      }),
  },

  projects: {
    kind: 'card',
    needs: ['prs'],
    render: (p, theme, box) =>
      renderStatTile({
        ...box,
        iconKey: 'package',
        accent: theme.accents.prs,
        value: n(p.externalRepoCount),
        label: 'Projects shipped to',
        caption: 'hex intensity = merged PRs',
        chart: `<g transform="translate(${PAD}, ${CHART_TOP})">${renderHexCluster({
          w: box.w - 2 * PAD,
          h: 296 - CHART_TOP,
          values: p.externalRepos.map((r) => r.mergedPrs),
          theme,
        })}</g>`,
        rows: topExternalByStars(p, 2).map((r) => ({
          label: trunc(r.name, 18),
          value: `${n(r.value)} stars`,
        })),
        rowStart: CHART_ROW_START,
        rowPitch: CHART_ROW_PITCH,
        theme,
      }),
  },

  issues: {
    kind: 'card',
    needs: ['issues'],
    render: (p, theme, box) => {
      const closed = p.issuesClosed;
      // Windowed cards can't show resolution: GitHub exposes issues opened in
      // a range but not issues closed in one — so no meter either.
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
        chart: renderMeter({
          cx: box.w / 2,
          cy: 268,
          r: 78,
          pct,
          centerTop: n(closed),
          centerBottom: `of ${n(p.issuesOpened)} resolved`,
          accent: theme.accents.issues,
          theme,
        }),
        // Resolved lives in the meter; the rows carry the other two numbers.
        rows: [
          { label: 'Opened', value: n(p.issuesOpened) },
          { label: 'Still open', value: n(Math.max(0, p.issuesOpened - closed)) },
        ],
        rowStart: CHART_ROW_START,
        rowPitch: CHART_ROW_PITCH,
        theme,
      });
    },
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
          ? `${n(p.biggestProject.stars)} stars · ${n(p.biggestProject.mergedPrs)} merged`
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
        value: n(p.ownStars),
        subLine: p.ownTopRepo
          ? `top: ${trunc(p.ownTopRepo.name, 16)} · ${n(p.ownTopRepo.stars)} stars`
          : `across ${n(p.ownRepoCount)} repos you built`,
        theme,
      }),
  },
};

export const DEFAULT_TILES = [
  'merged-prs',
  'activity',
  'ships-in',
  'reviews',
  'projects',
  'issues',
  'biggest-project',
  'merge-rate',
  'own-stars',
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

  return [...new Set(keys)];
}

/** Union of every selected tile's data requirements. */
export function neededData(tileKeys: string[]): Set<DataNeed> {
  const needs = new Set<DataNeed>();
  for (const key of tileKeys) {
    for (const need of TILES[key].needs) needs.add(need);
  }
  return needs;
}
