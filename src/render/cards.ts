import { topExternalByPrs } from '../compute.js';
import type { StatsPayload, Theme } from '../types.js';
import type { Box } from '../tiles.js';
import { escapeXml, fitText, truncate } from './util.js';

// Delta-positive green — same hue as the footprint accent, kept as a constant
// because it colours parts of *other* cards' delta lines too.
const GREEN = '#199e70';

// Gradient stops per bar chart (dark → accent, left → right).
const GRAD_BLUE: [string, string] = ['#184f95', '#3987e5'];
const GRAD_ORANGE: [string, string] = ['#8a3416', '#d95926'];

// Card-local geometry (spec-exact).
const CARD_H = 664;
const TITLE_BASELINE = 56;
const CHART_TOP = 84;
const CHART_BOTTOM = 348;
const STAT_SQUARE_Y = 385;
const STAT_LABEL_BASELINE = 394;
const STAT_VALUE_BASELINE = 438;
const STAT_DELTA_BASELINE = 462;
const TABLE_TOPS = [492, 544, 596];
const ROW_BASELINE_OFFSET = 33;

const n = (v: number): string => v.toLocaleString('en-US');

interface Stat {
  label: string;
  value: string;
  /** Rendered green with an NBSP before the muted part. */
  deltaPos?: string;
  deltaMuted: string;
}

interface Row {
  label: string;
  value: string;
}

function frame(w: number, theme: Theme, title: string): string {
  return (
    `<rect width="${w}" height="${CARD_H}" rx="28" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1.5"/>` +
    `<text x="32" y="${TITLE_BASELINE}" class="gb-display" font-size="26" fill="${theme.textPrimary}">${escapeXml(title)}</text>`
  );
}

function statBlock(colX: number, w: number, stat: Stat, accent: string, theme: Theme): string {
  const colW = (w - 64) / 2 - 16;
  const label = fitText(stat.label, colW - 14, [13]);
  const value = fitText(stat.value, colW, [34, 30, 26, 22]);
  const parts: string[] = [];
  if (stat.deltaPos) {
    parts.push(`<tspan fill="${GREEN}">${escapeXml(stat.deltaPos)}</tspan>`);
  }
  if (stat.deltaMuted) {
    const lead = stat.deltaPos ? ' ' : '';
    parts.push(`<tspan fill="${theme.textMuted}">${escapeXml(lead + stat.deltaMuted)}</tspan>`);
  }
  return (
    `<rect x="${colX}" y="${STAT_SQUARE_Y}" width="6" height="6" rx="2" fill="${accent}"/>` +
    `<text x="${colX + 14}" y="${STAT_LABEL_BASELINE}" class="gb-text" font-size="${label.size}" fill="${theme.textMuted}">${escapeXml(label.text)}</text>` +
    `<text x="${colX}" y="${STAT_VALUE_BASELINE}" class="gb-display" font-size="${value.size}" fill="${theme.textPrimary}">${escapeXml(value.text)}</text>` +
    `<text x="${colX}" y="${STAT_DELTA_BASELINE}" class="gb-mono" font-size="12">${parts.join('')}</text>`
  );
}

function statPair(w: number, stats: [Stat, Stat], accent: string, theme: Theme): string {
  const col2 = 32 + (w - 64) / 2 + 16;
  return statBlock(32, w, stats[0], accent, theme) + statBlock(col2, w, stats[1], accent, theme);
}

/** Rows render top-down; dividers only for rendered rows (windowed cards drop some). */
function table(w: number, rows: Row[], theme: Theme): string {
  return rows
    .slice(0, 3)
    .map((row, i) => {
      const top = TABLE_TOPS[i];
      const baseline = top + ROW_BASELINE_OFFSET;
      // Reserve the value's width (mono ≈ 0.6em/char) plus a 16px gutter.
      const valueW = row.value.length * 15 * 0.6;
      const label = fitText(row.label, w - 64 - valueW - 16, [15]);
      return (
        `<line x1="32" y1="${top}" x2="${w - 32}" y2="${top}" stroke="${theme.divider}" stroke-width="1"/>` +
        `<text x="32" y="${baseline}" class="gb-text" font-size="15" fill="${theme.textSecondary}">${escapeXml(label.text)}</text>` +
        `<text x="${w - 32}" y="${baseline}" text-anchor="end" class="gb-mono" font-size="15" fill="${theme.textPrimary}">${escapeXml(row.value)}</text>`
      );
    })
    .join('');
}

function emptyChart(w: number, message: string, theme: Theme): string {
  const midY = (CHART_TOP + CHART_BOTTOM) / 2;
  return `<text x="${w / 2}" y="${midY}" text-anchor="middle" class="gb-text" font-size="14" fill="${theme.textMuted}">${escapeXml(message)}</text>`;
}

/** Horizontal bar, rounded (rx 4) on the data end only, square at x. */
function barPath(x: number, y: number, len: number, fill: string): string {
  const h = 16;
  const r = Math.min(4, len);
  return `<path d="M${x},${y} h${len - r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${len - r} z" fill="${fill}"/>`;
}

function barChart(
  entries: { name: string; value: number }[],
  w: number,
  theme: Theme,
  opts: { zoneTop: number; pitch: number; grad: [string, string]; gradId: string; empty: string },
): string {
  if (entries.length === 0) return emptyChart(w, opts.empty, theme);
  const track = w - 64 - 64;
  const max = Math.max(...entries.map((e) => e.value), 1);
  const out: string[] = [
    `<defs><linearGradient id="${opts.gradId}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${opts.grad[0]}"/><stop offset="1" stop-color="${opts.grad[1]}"/></linearGradient></defs>`,
  ];
  entries.forEach((e, i) => {
    const nameBaseline = opts.zoneTop + 14 + i * opts.pitch;
    const barY = opts.zoneTop + 22 + i * opts.pitch;
    const len = Math.max(6, Math.round((e.value / max) * track));
    const name = fitText(e.name, w - 64, [13]);
    out.push(
      `<text x="32" y="${nameBaseline}" class="gb-text" font-size="13" fill="${theme.textSecondary}">${escapeXml(name.text)}</text>`,
      barPath(32, barY, len, `url(#${opts.gradId})`),
      `<text x="${32 + len + 8}" y="${barY + 12}" class="gb-mono" font-size="13" fill="${theme.textPrimary}">${n(e.value)}</text>`,
    );
  });
  return out.join('');
}

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 1; // unknown format: leave the colour as-is
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Language cells, heatmap-reference style: 3 columns, up to 12 slots. */
function languageGrid(p: StatsPayload, w: number, theme: Theme): string {
  if (p.languages.length === 0) return emptyChart(w, 'no language data', theme);
  const cellW = Math.floor((w - 64 - 20) / 3);
  const cellH = 54;
  const shown = p.languages.slice(0, p.languageCount > 12 ? 11 : 12);
  const overflow = p.languageCount - shown.length;
  const cellXY = (i: number): [number, number] => [
    32 + (i % 3) * (cellW + 10),
    90 + Math.floor(i / 3) * (cellH + 10),
  ];
  const out = shown.map((lang, i) => {
    const [x, y] = cellXY(i);
    const color = escapeXml(lang.color);
    const name = fitText(lang.name, cellW - 24, [13]);
    // ponytail: quick perceived-luminance gate; full OKLab if this misjudges.
    const nameFill = luminance(lang.color) < 0.22 ? theme.textPrimary : color;
    return (
      `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="12" fill="${color}" fill-opacity="0.13" stroke="${color}" stroke-opacity="0.35" stroke-width="1"/>` +
      `<text x="${x + 12}" y="${y + 22}" class="gb-text-bold" font-size="13" fill="${nameFill}">${escapeXml(name.text)}</text>` +
      `<text x="${x + 12}" y="${y + 42}" class="gb-mono" font-size="14" fill="${theme.textPrimary}">${n(lang.repos)}</text>`
    );
  });
  if (overflow > 0) {
    const [x, y] = cellXY(shown.length);
    out.push(
      `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="12" fill="${theme.pillBg}" stroke="${theme.divider}" stroke-width="1"/>` +
        `<text x="${x + 12}" y="${y + 22}" class="gb-text-bold" font-size="13" fill="${theme.textMuted}">+${n(overflow)}</text>`,
    );
  }
  return out.join('');
}

function card(box: Box, inner: string): string {
  return `<g transform="translate(${box.x}, ${box.y})">${inner}</g>`;
}

export function renderPullRequestsCard(p: StatsPayload, theme: Theme, box: Box): string {
  const w = box.w;
  const accent = theme.accents.prs;
  const stat1: Stat = p.periodLabel
    ? {
        label: p.periodLabel,
        value: n(p.prsMergedExternal),
        deltaMuted: "merged into others' repos",
      }
    : {
        label: 'All time',
        value: n(p.prsMergedExternal),
        deltaPos: `↑ ${n(p.recentExternalPrs)}`,
        deltaMuted: 'in last 12 mo',
      };
  const stat2: Stat = {
    label: 'Merge rate',
    value: `${p.mergeRatePct}%`,
    deltaMuted: `${n(p.prsMerged)} of ${n(p.prsOpened)} opened`,
  };
  const rows: Row[] = [
    { label: 'Projects shipped to', value: n(p.externalRepoCount) },
    p.biggestProject
      ? { label: `Biggest · ${truncate(p.biggestProject.name, 14)}`, value: `${n(p.biggestProject.stars)} stars` }
      : { label: 'Biggest project', value: '—' },
    { label: 'Active this year', value: `${n(p.recentExternalRepoCount)} projects` },
  ];
  const chart = barChart(topExternalByPrs(p, 5), w, theme, {
    zoneTop: 90,
    pitch: 50,
    grad: GRAD_BLUE,
    gradId: 'gb-grad-pull-requests',
    empty: 'no external merges in this range',
  });
  return card(box, frame(w, theme, 'Pull requests') + chart + statPair(w, [stat1, stat2], accent, theme) + table(w, rows, theme));
}

export function renderCodeReviewCard(p: StatsPayload, theme: Theme, box: Box): string {
  const w = box.w;
  const accent = theme.accents.reviews;
  const stat1: Stat = {
    label: 'Reviews for others',
    value: n(p.reviewsExternal),
    deltaMuted: `of ${n(p.reviewsTotal)} total`,
  };
  let stat2: Stat;
  let rows: Row[];
  if (p.issuesClosed !== null) {
    const pct = p.issuesOpened === 0 ? 0 : Math.round((p.issuesClosed / p.issuesOpened) * 100);
    stat2 = {
      label: 'Issues resolved',
      value: `${pct}%`,
      deltaMuted: `${n(p.issuesClosed)} of ${n(p.issuesOpened)} filed`,
    };
    rows = [
      { label: 'Opened', value: n(p.issuesOpened) },
      { label: 'Resolved', value: n(p.issuesClosed) },
      { label: 'Still open', value: n(Math.max(0, p.issuesOpened - p.issuesClosed)) },
    ];
  } else {
    // Windowed: GitHub exposes issues opened in a range but not closed in one.
    stat2 = {
      label: 'Issues opened',
      value: n(p.issuesOpened),
      deltaMuted: p.periodLabel ?? '',
    };
    rows = [{ label: 'Opened', value: n(p.issuesOpened) }];
  }
  const chart = barChart(p.topReviewedRepos.slice(0, 4), w, theme, {
    zoneTop: 96,
    pitch: 56,
    grad: GRAD_ORANGE,
    gradId: 'gb-grad-code-review',
    empty: 'no reviews in this range',
  });
  return card(box, frame(w, theme, 'Code review') + chart + statPair(w, [stat1, stat2], accent, theme) + table(w, rows, theme));
}

export function renderFootprintCard(p: StatsPayload, theme: Theme, box: Box): string {
  const w = box.w;
  const accent = theme.accents.projects;
  const stat1: Stat = {
    label: 'Languages',
    value: n(p.languageCount),
    deltaMuted: 'generated files excluded',
  };
  const stat2: Stat = {
    label: 'Stars earned',
    value: n(p.ownStars),
    deltaMuted: `across ${n(p.ownRepoCount)} repos`,
  };
  const rows: Row[] = [
    p.ownTopRepo
      ? { label: `Top · ${truncate(p.ownTopRepo.name, 14)}`, value: `${n(p.ownTopRepo.stars)} stars` }
      : { label: 'Top repo', value: '—' },
    { label: 'Followers', value: n(p.followers) },
    { label: 'Following', value: n(p.following) },
  ];
  return card(box, frame(w, theme, 'Footprint') + languageGrid(p, w, theme) + statPair(w, [stat1, stat2], accent, theme) + table(w, rows, theme));
}
