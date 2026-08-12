import type { Theme } from '../../types.js';
import { escapeXml } from '../util.js';
import { RADAR_MAX_AXES, RADAR_MIN_AXES, renderBurst } from './radar.js';

export interface LanguagesChartProps {
  /** Chart zone in card-local coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
  languages: { name: string; color: string; repos: number }[];
  overflow: number;
  /** Total language count for the burst's centre hub. */
  count: number;
  theme: Theme;
}

/**
 * Chart-only languages content for the card scaffold: the radar when there
 * are enough axes to form a shape, pills below three, a message at zero.
 */
export function renderLanguagesChart(p: LanguagesChartProps): string {
  const { x, y, w, h, theme } = p;
  let inner: string;
  if (p.languages.length >= RADAR_MIN_AXES) {
    // Bounds reserve room for the 16px tip-anchored labels: 96px each side,
    // 34px above and below (ascender + gap), so a label can never reach back
    // into the ring, leave the card, or climb into the caption band.
    const rMax = Math.min(h / 2 - 34, w / 2 - 96);
    inner = renderBurst({
      cx: w / 2,
      cy: h / 2,
      rMax,
      labelLeft: 4,
      labelRight: w - 4,
      count: p.count,
      languages: p.languages.slice(0, RADAR_MAX_AXES),
      theme,
    });
  } else if (p.languages.length === 0) {
    inner = `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" class="gb-text" font-size="16" fill="${theme.textMuted}">no language data</text>`;
  } else {
    inner = `<g transform="translate(0, 8)">${layoutPills(p.languages, p.overflow, w, h - 16, theme)}</g>`;
  }
  return `<g transform="translate(${x}, ${y})">${inner}</g>`;
}

const LINE_HEIGHT = 38;
const PILL_HEIGHT = 30;
const PILL_PADDING_X = 14;
const PILL_FONT_SIZE = 14;
const PILL_GAP = 8;

interface Pill {
  label: string;
  color: string;
  x: number;
  y: number;
  w: number;
}

/**
 * Show as many language pills as fit in the box. Anything that doesn't fit is
 * rolled into the trailing "+N" pill rather than spilling past the tile border.
 * Tries the full list first and drops one language at a time until it fits —
 * at most 8 iterations, so the brute force is cheaper than the arithmetic.
 */
function layoutPills(
  languages: { name: string; color: string }[],
  overflow: number,
  maxWidth: number,
  maxHeight: number,
  theme: Theme,
): string {
  for (let shown = languages.length; shown >= 0; shown--) {
    const items = languages.slice(0, shown).map((l) => ({ label: l.name, color: l.color }));
    const hidden = overflow + (languages.length - shown);
    if (hidden > 0) items.push({ label: `+${hidden}`, color: theme.textMuted });

    const pills = place(items, maxWidth);
    const height = pills.length === 0 ? 0 : pills[pills.length - 1].y + PILL_HEIGHT;
    if (height <= maxHeight) return pills.map((pill) => toSvg(pill, theme)).join('');
  }
  return '';
}

function place(items: { label: string; color: string }[], maxWidth: number): Pill[] {
  let cursorX = 0;
  let cursorY = 0;
  const out: Pill[] = [];

  for (const item of items) {
    const w = Math.ceil(item.label.length * PILL_FONT_SIZE * 0.85 + PILL_PADDING_X * 2);
    if (cursorX + w > maxWidth && cursorX > 0) {
      cursorX = 0;
      cursorY += LINE_HEIGHT;
    }
    out.push({ ...item, x: cursorX, y: cursorY, w });
    cursorX += w + PILL_GAP;
  }

  return out;
}

function toSvg(pill: Pill, theme: Theme): string {
  const color = escapeXml(pill.color);
  return `
      <g transform="translate(${pill.x}, ${pill.y})">
        <rect width="${pill.w}" height="${PILL_HEIGHT}" rx="8" fill="${theme.pillBg}" stroke="${color}" stroke-width="1" stroke-opacity="0.4"/>
        <text x="${pill.w / 2}" y="${PILL_HEIGHT / 2 + 5}" text-anchor="middle" class="gb-text-bold" font-size="${PILL_FONT_SIZE}" fill="${color}">${escapeXml(pill.label)}</text>
      </g>
    `;
}
