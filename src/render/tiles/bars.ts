import type { Theme } from '../../types.js';
import { escapeXml, fitText } from '../util.js';

export interface BarEntry {
  label: string;
  value: number;
}

const BAR_H = 16;
const BAR_RADIUS = 4;
/** Room reserved at the track's end so a full-length bar never pushes the tip value out. */
const VALUE_RESERVE = 64;
const MIN_BAR_W = 6;
const VALUE_GUTTER = 8;

/**
 * Shared horizontal gradient bars: one series, one hue, values direct-labelled
 * at the tip. Name 13px secondary above the bar, bar 16px with a rounded
 * data-end and a square baseline end, 13px mono value at tip+8. Draws in a
 * local (0,0) origin — the caller positions the group. Emits its own <defs>
 * gradient under the given id, so ids stay unique per consuming tile.
 */
export function renderBars(p: {
  entries: BarEntry[];
  w: number;
  pitch: number;
  gradId: string;
  gradFrom: string;
  gradTo: string;
  theme: Theme;
}): string {
  const { entries, w, pitch, gradId, theme } = p;
  const max = Math.max(1, ...entries.map((e) => e.value));
  const trackW = w - VALUE_RESERVE;

  const defs = `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.gradFrom}"/><stop offset="1" stop-color="${p.gradTo}"/></linearGradient></defs>`;

  const rows = entries
    .map((bar, i) => {
      const top = i * pitch;
      const barY = top + 14;
      const barW = Math.max(MIN_BAR_W, Math.round((bar.value / max) * trackW));
      const name = fitText(bar.label, trackW, [13]);
      return `
      <text x="0" y="${top + 10}" class="gb-text" font-size="${name.size}" fill="${theme.textSecondary}">${escapeXml(name.text)}</text>
      ${roundedEndBar(0, barY, barW, BAR_H, BAR_RADIUS, `url(#${gradId})`)}
      <text x="${barW + VALUE_GUTTER}" y="${barY + BAR_H / 2 + 4}" class="gb-mono" font-size="13" fill="${theme.textPrimary}">${bar.value.toLocaleString('en-US')}</text>
    `;
    })
    .join('');

  return defs + rows;
}

/**
 * Bar with a 4px rounded data-end and a square baseline end, so the bar reads
 * as growing from the axis rather than as a floating pill.
 */
function roundedEndBar(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
): string {
  const radius = Math.min(r, w);
  const right = x + w;
  return `<path d="M${x} ${y} H${right - radius} A${radius} ${radius} 0 0 1 ${right} ${y + radius} V${y + h - radius} A${radius} ${radius} 0 0 1 ${right - radius} ${y + h} H${x} Z" fill="${fill}"/>`;
}
