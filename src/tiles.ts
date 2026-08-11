import { topExternalByPrs } from './compute.js';
import { renderColumns } from './render/tiles/columns.js';
import { renderCandles } from './render/tiles/candles.js';
import { renderStream } from './render/tiles/stream.js';
import { renderHexCluster } from './render/tiles/hex.js';
import { renderLanguagesChart } from './render/tiles/languages-tile.js';
import { renderMiniTile } from './render/tiles/mini-tile.js';
import { renderRidgeline } from './render/tiles/ridgeline.js';
import { CHART_BOTTOM, CHART_TOP, renderStatTile } from './render/tiles/stat-tile.js';
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

/** "in the last week" vs "all time" — keeps captions honest on a scoped card. */
function scope(p: StatsPayload): string {
  return p.periodLabel ?? 'all time';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Chart zone shared by the card tiles, in card-local coordinates. */
const PAD = 28;
const CHART_H = CHART_BOTTOM - CHART_TOP;

function chartGroup(_w: number, inner: string): string {
  return `<g transform="translate(${PAD}, ${CHART_TOP})">${inner}</g>`;
}

export const TILES: Record<string, TileDef> = {
  // --- the six chart cards ----------------------------------------------
  'merged-prs': {
    kind: 'card',
    needs: ['prs'],
    render: (p, theme, box) => {
      return renderStatTile({
        ...box,
        accent: theme.accents.prs,
        title: 'Pull requests',
        caption: `top repos by merged PRs, ranked · ${p.periodLabel ?? new Date().getUTCFullYear()} · names in Top projects below`,
        chart: chartGroup(box.w, renderCandles({
          w: box.w - 2 * PAD,
          h: CHART_H,
          data: (p.topExternalThisYear.length > 0
            ? p.topExternalThisYear
            : topExternalByPrs(p, 12)
          ).slice(0, 12).map((r) => ({ value: r.value })),
          accent: theme.accents.prs,
          emptyText: 'no external merges yet',
          theme,
        })),
        stats: [
          { value: n(p.prsMergedExternal), label: 'merged for others' },
          { value: `${p.mergeRatePct}%`, label: 'merge rate' },
          { value: n(p.recentExternalRepoCount), label: 'projects this year' },
        ],
        theme,
      });
    },
  },

  activity: {
    kind: 'card',
    needs: ['prs'],
    render: (p, theme, box) => {
      const peak = p.monthlyExternalMerges.reduce(
        (best, m) => (m.count > best.count ? m : best),
        p.monthlyExternalMerges[0] ?? { label: '', month: 0, count: 0 },
      );
      return renderStatTile({
        ...box,
        accent: theme.accents.prs,
        title: 'Activity',
        caption: p.periodLabel ?? 'external merges per month · last 12 months',
        chart: chartGroup(box.w, renderColumns({
          w: box.w - 2 * PAD,
          h: CHART_H,
          data: p.monthlyExternalMerges,
          gradId: 'gba-cols',
          emptyText: 'no external merges in the last 12 months',
          theme,
        })),
        stats: [
          { value: n(p.recentExternalPrs), label: 'last 12 months' },
          {
            value: n(peak.count),
            label: peak.count > 0 ? `best month · ${MONTHS[peak.month]}` : 'best month',
          },
          { value: n(Math.round(p.recentExternalPrs / 12)), label: 'avg per month' },
        ],
        theme,
      });
    },
  },

  'ships-in': {
    kind: 'card',
    needs: ['prs'],
    render: (p, theme, box) =>
      renderStatTile({
        ...box,
        accent: theme.accents.languages,
        title: 'Ships in',
        caption: `top ${Math.min(8, p.languages.length)} of ${n(p.languageCount)} languages · by project count`,
        // No stat trio here — the freed body goes to the radar itself.
        chart: renderLanguagesChart({
          x: PAD,
          y: CHART_TOP,
          w: box.w - 2 * PAD,
          h: box.h - CHART_TOP - 26,
          languages: p.languages.map((l) => ({ name: l.name, color: l.color, repos: l.repos })),
          overflow: Math.max(0, p.languageCount - p.languages.length),
          count: p.languageCount,
          theme,
        }),
        stats: [],
        theme,
      }),
  },

  reviews: {
    kind: 'card',
    needs: ['reviews'],
    render: (p, theme, box) =>
      renderStatTile({
        ...box,
        accent: theme.accents.reviews,
        title: 'Code review',
        caption: 'reviews per year · one ridge per repo',
        chart: chartGroup(box.w, renderRidgeline({
          w: box.w - 2 * PAD,
          h: CHART_H,
          years: p.reviewRidges.years.map(String),
          series: p.reviewRidges.series.map((r) => ({
            name: r.name,
            counts: r.counts,
          })),
          gradId: 'gbrv-ridge',
          theme,
        })),
        stats: [
          { value: n(p.reviewsExternal), label: 'for others' },
          { value: n(p.reviewsTotal), label: 'total reviews' },
          {
            value: p.reviewsTotal > 0 ? `${Math.round((p.reviewsExternal / p.reviewsTotal) * 100)}%` : '—',
            label: 'external share',
          },
        ],
        theme,
      }),
  },

  projects: {
    kind: 'card',
    needs: ['prs'],
    render: (p, theme, box) => {
      const most = p.externalRepos[0];
      const maintainers = new Set(
        p.externalRepos.map((r) => r.nameWithOwner.split('/')[0].toLowerCase()),
      ).size;
      return renderStatTile({
        ...box,
        accent: theme.accents.prs,
        title: 'Projects shipped to',
        caption: 'one hex per open source project · heat = merged PRs',
        chart: chartGroup(box.w, renderHexCluster({
          w: box.w - 2 * PAD,
          h: CHART_H,
          values: p.externalRepos.map((r) => r.mergedPrs),
          theme,
        })),
        stats: [
          { value: n(p.externalRepoCount), label: 'projects · 2+ PRs' },
          { value: n(maintainers), label: 'maintainers & orgs' },
          { value: most ? n(most.mergedPrs) : '—', label: 'most in one repo' },
        ],
        theme,
      });
    },
  },

  issues: {
    kind: 'card',
    // Yearly issue counts ride on the contributions query, hence 'reviews'.
    needs: ['issues', 'reviews'],
    render: (p, theme, box) => {
      const closed = p.issuesClosed;
      const wave = chartGroup(box.w, renderStream({
        w: box.w - 2 * PAD,
        h: CHART_H,
        stations: p.issuesByYear.map((y) => ({
          label: String(y.year),
          value: y.opened,
        })),
        accent: theme.accents.issues,
        gradId: 'gbi-stream',
        emptyText: 'no issue history in range',
        theme,
      }));
      // Windowed cards can't show resolution: GitHub exposes issues opened in
      // a range but not issues closed in one.
      if (closed === null) {
        return renderStatTile({
          ...box,
          accent: theme.accents.issues,
          title: 'Issues',
          caption: `opened by you · ${scope(p)}`,
          chart: wave,
          stats: [{ value: n(p.issuesOpened), label: 'opened in range' }],
          theme,
        });
      }
      const pct = p.issuesOpened === 0 ? 0 : Math.round((closed / p.issuesOpened) * 100);
      return renderStatTile({
        ...box,
        accent: theme.accents.issues,
        title: 'Issues',
        caption: 'opened by you, per year · finishing what you file',
        chart: wave,
        stats: [
          { value: `${pct}%`, label: 'resolved' },
          { value: n(closed), label: `of ${n(p.issuesOpened)} opened` },
          { value: n(Math.max(0, p.issuesOpened - closed)), label: 'still open' },
        ],
        theme,
      });
    },
  },

  // --- mini tiles --------------------------------------------------------
  'biggest-project': {
    kind: 'mini',
    needs: ['prs'],
    render: (p, theme, box) => {
      // This year's ranking; an empty year falls back to all time, labelled.
      const year = new Date().getUTCFullYear();
      const thisYear = p.topExternalThisYear;
      const list = thisYear.length > 0 ? thisYear : topExternalByPrs(p, 8);
      const scopeLabel = p.periodLabel ?? (thisYear.length > 0 ? String(year) : 'all time');
      return renderMiniTile({
        ...box,
        accent: theme.accents.prs,
        title: `Top projects · ${scopeLabel}`,
        value: list[0]?.name ?? '—',
        subLine: list.length === 0 ? 'no external merges yet' : '',
        list: list.slice(0, 3).map((r) => ({ label: r.name, value: `${n(r.value)} merged` })),
        spark: list.map((r) => r.value),
        theme,
      });
    },
  },

  'merge-rate': {
    kind: 'mini',
    needs: ['prs'],
    render: (p, theme, box) =>
      renderMiniTile({
        ...box,
        accent: theme.accents.prs,
        title: 'Merge rate',
        value: `${p.mergeRatePct}%`,
        subLine: `${n(p.prsMerged)} of ${n(p.prsOpened)} PRs · spark: merges per month`,
        spark: p.monthlyExternalMerges.map((m) => m.count),
        theme,
      }),
  },

  'own-stars': {
    kind: 'mini',
    needs: ['ownRepos'],
    render: (p, theme, box) =>
      renderMiniTile({
        ...box,
        accent: theme.accents.languages,
        title: `Stars earned · ${n(p.ownStars)} total`,
        value: n(p.ownStars),
        subLine: p.ownTopRepos.length === 0 ? `across ${n(p.ownRepoCount)} repos you built` : '',
        list: p.ownTopRepos.slice(0, 3).map((r) => ({ label: r.name, value: `${n(r.stars)} stars` })),
        spark: p.ownTopRepos.map((r) => r.stars),
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
