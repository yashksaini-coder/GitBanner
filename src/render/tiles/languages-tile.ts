import type { Theme } from '../../types.js';
import { iconByKey, renderIcon } from '../icons.js';
import { escapeXml, fitText } from '../util.js';
import { RADAR_MAX_AXES, RADAR_MIN_AXES, renderRadar } from './radar.js';

export interface LanguagesTileProps {
  x: number;
  y: number;
  w: number;
  h: number;
  iconKey: string;
  accent: string;
  count: number;
  label: string;
  caption: string;
  languages: { name: string; color: string; repos: number }[];
  overflow: number;
  theme: Theme;
}

const PAD = 28;
// Same header grid as the stat tile, so the row reads as one system.
const VALUE_X = 92;
const PILLS_Y = 176;

export function renderLanguagesTile(p: LanguagesTileProps): string {
  const { x, y, w, h, theme, count, label } = p;

  const icon = renderIcon({
    path: iconByKey(p.iconKey),
    size: 24,
    stroke: p.accent,
    strokeWidth: 2.2,
  });

  const fittedLabel = fitText(label, w - 2 * PAD, [17, 15, 14]);
  const fittedCaption = fitText(p.caption, w - 2 * PAD, [13, 12]);

  // The radar is the tile's centrepiece, but it needs at least three axes to
  // be a shape — below that the pills carry the data instead.
  const chart = chartFor(p, w, h, theme);

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="24" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1"/>
      <g transform="translate(28, 28)">
        <rect width="48" height="48" rx="12" fill="${p.accent}" fill-opacity="0.16"/>
        <g transform="translate(12, 12)">${icon}</g>
      </g>

      <text x="${VALUE_X}" y="66" class="gb-display" font-size="40" fill="${theme.textPrimary}">${escapeXml(String(count))}</text>
      <text x="${PAD}" y="112" class="gb-text" font-size="${fittedLabel.size}" fill="${theme.textPrimary}">${escapeXml(fittedLabel.text)}</text>
      <text x="${PAD}" y="136" class="gb-text" font-size="${fittedCaption.size}" fill="${theme.textMuted}">${escapeXml(fittedCaption.text)}</text>

      <line x1="${PAD}" y1="156" x2="${w - PAD}" y2="156" stroke="${theme.divider}" stroke-width="1"/>

      ${chart}
    </g>
  `;
}

function chartFor(p: LanguagesTileProps, w: number, h: number, theme: Theme): string {
  if (p.languages.length >= RADAR_MIN_AXES) {
    // Vertical centre of the zone between the divider and the bottom padding,
    // with room reserved for one label line above and below the outer ring.
    const zoneTop = 168;
    const zoneBottom = h - 16;
    const cy = (zoneTop + zoneBottom) / 2;
    // Horizontal bound reserves 78px each side for tip-anchored labels, so a
    // side label can never reach back into the ring nor leave the card.
    const rMax = Math.min((zoneBottom - zoneTop) / 2 - 14, (w - 64) / 2 - 78);
    return renderRadar({
      cx: w / 2,
      cy,
      rMax,
      labelLeft: 10,
      labelRight: w - 10,
      languages: p.languages.slice(0, RADAR_MAX_AXES),
      theme,
    });
  }
  if (p.languages.length === 0) {
    return `<text x="${w / 2}" y="${(156 + h) / 2}" text-anchor="middle" class="gb-text" font-size="13" fill="${theme.textMuted}">no language data</text>`;
  }
  const pillSvg = layoutPills(p.languages, p.overflow, w - 2 * PAD, h - PILLS_Y - 18, theme);
  return `<g transform="translate(${PAD}, ${PILLS_Y})">${pillSvg}</g>`;
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
    const w = Math.ceil(item.label.length * PILL_FONT_SIZE * 0.6 + PILL_PADDING_X * 2);
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
