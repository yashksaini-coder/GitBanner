import { topExternalByPrs } from './compute.js';
import { renderHexCluster } from './render/tiles/hex.js';
import { renderLanguagesChart } from './render/tiles/languages-tile.js';
import { renderMiniTile } from './render/tiles/mini-tile.js';
import { renderScatter3D } from './render/tiles/scatter3d.js';
import { CHART_BOTTOM, CHART_TOP, renderStatTile } from './render/tiles/stat-tile.js';
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Chart zone shared by the card tiles, in card-local coordinates. */
const PAD = 28;
const CHART_H = CHART_BOTTOM - CHART_TOP;

function chartGroup(_w: number, inner: string): string {
  return `<g transform="translate(${PAD}, ${CHART_TOP})">${inner}</g>`;
}

/** Ridge-style hue drift for the activity wave, reference green→blue→violet. */
const RIDGE_STOPS = ['#2fd08a', '#3987e5', '#8b6cf0'];

export const TILES: Record<string, TileDef> = {
  // --- the six chart cards ----------------------------------------------
  'merged-prs': {
    kind: 'card',
    needs: ['prs'],
    render: (p, theme, box) => {
      const top = topExternalByPrs(p, 1)[0];
      return renderStatTile({
        ...box,
        accent: theme.accents.prs,
        title: 'Pull requests',
        caption: `merged PRs across the popularity spectrum · ${scope(p)}`,
        // Area under the curve = your merged work, laid out by how popular
        // the receiving project is (fixed log-decade star buckets).
        chart: chartGroup(box.w, renderWave({
          w: box.w - 2 * PAD,
          h: CHART_H,
          points: p.popularitySpectrum,
          accent: theme.accents.prs,
          gradId: 'gbh-wave',
          gridlines: true,
          tickEvery: 1,
          emptyText: 'no external merges yet',
          theme,
        })),
        stats: [
          { value: n(p.prsMergedExternal), label: 'merged for others' },
          { value: `${p.mergeRatePct}%`, label: 'merge rate' },
          top
            ? { value: top.name, label: `top repo · ${n(top.value)} merged` }
            : { value: '—', label: 'top repo' },
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
        caption: p.periodLabel ?? 'external merges by month · last 12 months',
        chart: chartGroup(box.w, renderWave({
          w: box.w - 2 * PAD,
          h: CHART_H,
          points: p.monthlyExternalMerges,
          accent: theme.accents.prs,
          gradId: 'gba-wave',
          strokeStops: RIDGE_STOPS,
          gridlines: true,
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
        chart: renderLanguagesChart({
          x: PAD,
          y: CHART_TOP,
          w: box.w - 2 * PAD,
          h: CHART_H,
          languages: p.languages.map((l) => ({ name: l.name, color: l.color, repos: l.repos })),
          overflow: Math.max(0, p.languageCount - p.languages.length),
          theme,
        }),
        stats: [
          { value: n(p.languageCount), label: 'languages' },
          { value: p.languages[0]?.name ?? '—', label: 'most used' },
          {
            value: p.languages[0] ? n(p.languages[0].repos) : '—',
            label: 'projects use it',
          },
        ],
        theme,
      }),
  },

  reviews: {
    kind: 'card',
    needs: ['reviews'],
    render: (p, theme, box) => {
      // Three honest axes per dot: x = repo stars (log), z = year, y = reviews.
      const pts = p.reviewPoints;
      const maxReviews = Math.max(1, ...pts.map((r) => r.reviews));
      const maxStars = Math.max(1, ...pts.map((r) => r.stars));
      const years = [...new Set(pts.map((r) => r.year))].sort((a, b) => a - b);
      const yearSpan = Math.max(1, years[years.length - 1] - years[0]);
      const top = pts[0];
      const compact = (v: number): string =>
        v >= 1000 ? `${Math.round(v / 1000)}k` : String(v);
      return renderStatTile({
        ...box,
        accent: theme.accents.reviews,
        title: 'Code review',
        caption: 'each dot = one repo · one year of reviews',
        chart: chartGroup(box.w, renderScatter3D({
          w: box.w - 2 * PAD,
          h: CHART_H,
          points: pts.map((r) => ({
            x: Math.log(1 + r.stars) / Math.log(1 + maxStars),
            // sqrt spreads the skewed low end; the 0 and max axis labels
            // remain exact since sqrt(0)=0 and sqrt(1)=1.
            y: Math.sqrt(r.reviews / maxReviews),
            z: years.length > 1 ? (r.year - years[0]) / yearSpan : 0.5,
            value: r === top ? String(r.reviews) : undefined,
          })),
          xLabels: [
            compact(Math.min(...pts.map((r) => r.stars))),
            `${compact(maxStars)} stars`,
          ],
          yLabels: ['0', String(maxReviews)],
          zLabels: years.map(String),
          accent: theme.accents.reviews,
          gradId: 'gbrv-sc',
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
      });
    },
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
      const wave = chartGroup(box.w, renderWave({
        w: box.w - 2 * PAD,
        h: CHART_H,
        points: p.issuesByYear.map((y) => ({
          label: String(y.year),
          month: 0,
          count: y.opened,
        })),
        accent: theme.accents.issues,
        gradId: 'gbi-wave',
        gridlines: true,
        tickEvery: 1,
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
