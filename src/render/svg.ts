import { DEFAULT_TILES, TILES, type Box } from '../tiles.js';
import type { StatsPayload, Theme, ThemeName } from '../types.js';
import { fontStyleBlock } from './fonts.js';
import { getTheme } from './theme.js';
import { escapeXml } from './util.js';

const CANVAS_W = 1600;
const MARGIN = 28;
const GAP = 16;
const TOP_H = 360;
const MINI_H = 150;
const FOOTER_GAP = 24;
const FOOTER_DESCENT = 14;

/** A hero tile is worth two ordinary columns. */
const HERO_SPAN = 2;

export function toSvg(
  payload: StatsPayload,
  themeName: ThemeName = 'dark',
  tileKeys: string[] = DEFAULT_TILES,
): string {
  const theme = getTheme(themeName);

  const top = tileKeys.filter((k) => TILES[k].kind !== 'mini');
  const minis = tileKeys.filter((k) => TILES[k].kind === 'mini');

  let y = MARGIN;
  const parts: string[] = [];

  if (top.length > 0) {
    parts.push(renderSpannedRow(top, payload, theme, y, TOP_H));
    y += TOP_H + GAP;
  }
  if (minis.length > 0) {
    parts.push(renderSpannedRow(minis, payload, theme, y, MINI_H));
    y += MINI_H + GAP;
  }

  const footerBaseline = y - GAP + FOOTER_GAP;
  const canvasH = footerBaseline + FOOTER_DESCENT;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${canvasH}" viewBox="0 0 ${CANVAS_W} ${canvasH}" role="img" aria-label="${escapeXml(ariaLabel(payload))}">
  <defs>
    <style>${fontStyleBlock()}</style>
  </defs>
  <rect width="${CANVAS_W}" height="${canvasH}" rx="36" fill="${theme.bg}"/>
  ${parts.join('')}
  <text x="${CANVAS_W / 2}" y="${footerBaseline}" text-anchor="middle" class="gb-text" font-size="14" fill="${theme.textMuted}">${escapeXml(footer(payload))}</text>
</svg>`;
}

/**
 * Lay a row out in column units: hero tiles take two, everything else one, so
 * a row of [hero, stat, stat, stat] divides the width into six.
 */
function renderSpannedRow(
  keys: string[],
  payload: StatsPayload,
  theme: Theme,
  y: number,
  h: number,
): string {
  const spans = keys.map((k) => (TILES[k].kind === 'hero' ? HERO_SPAN : 1));
  const units = spans.reduce((a, b) => a + b, 0);
  const inner = CANVAS_W - 2 * MARGIN;
  const unitW = Math.floor((inner - GAP * (keys.length - 1)) / units);

  let x = MARGIN;
  const out: string[] = [];
  keys.forEach((key, i) => {
    const w = unitW * spans[i] + GAP * (spans[i] - 1);
    const box: Box = { x, y, w, h };
    out.push(TILES[key].render(payload, theme, box));
    x += w + GAP;
  });
  return out.join('');
}

function ariaLabel(p: StatsPayload): string {
  const scope = p.periodLabel ? ` in ${p.periodLabel}` : '';
  return `Open source contributions by ${p.username}${scope}: ${p.prsMergedExternal} pull requests merged into other people's repositories across ${p.externalRepoCount} projects.`;
}

function footer(p: StatsPayload): string {
  const parts = ['gitbanner', `github.com/${p.username}`];
  if (p.periodLabel) parts.push(p.periodLabel);
  parts.push(`${format(p.followers)} followers`, `${format(p.following)} following`);
  if (!p.periodLabel && p.bestYear.commits > 0) {
    parts.push(`best year: ${p.bestYear.year} (${format(p.bestYear.commits)} commits)`);
  }
  parts.push(`updated ${formatTimestamp(p.generatedAt)}`);
  return parts.join(' · ');
}

function format(value: number): string {
  return value.toLocaleString('en-US');
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
