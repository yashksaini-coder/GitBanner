import type { Theme } from '../../types.js';
import { escapeXml } from '../util.js';
import { intensityColor } from './hex.js';

const r2 = (v: number): number => Math.round(v * 100) / 100;

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** Perceived luminance 0..1, for flipping in-cell text on bright cells. */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export interface HeatGridProps {
  w: number;
  h: number;
  /** Oldest year first; null months haven't happened yet and are skipped. */
  rows: { year: number; months: (number | null)[] }[];
  theme: Theme;
}

/**
 * Value-labelled heat grid, reference style: one rounded cell per month with
 * its merge count inside, colour ramped by magnitude on the same heat scale
 * as the projects hex. Rows = years, columns = Jan..Dec; a left gutter
 * carries the year, a top gutter the month letters.
 */
export function renderHeatGrid(p: HeatGridProps): string {
  const { w, h, rows, theme } = p;
  if (rows.length === 0 || rows.every((r) => r.months.every((m) => !m))) {
    return `<text x="${r2(w / 2)}" y="${r2(h / 2)}" text-anchor="middle" class="gb-text" font-size="13" fill="${theme.textMuted}">no external merges yet</text>`;
  }

  const GUTTER_L = 30;
  const GUTTER_T = 16;
  const GAP = 4;
  const cellW = Math.floor((w - GUTTER_L - 11 * GAP) / 12);
  const cellH = Math.min(
    44,
    Math.floor((h - GUTTER_T - (rows.length - 1) * GAP) / rows.length),
  );
  // Centre the grid block vertically in the zone.
  const gridH = GUTTER_T + rows.length * cellH + (rows.length - 1) * GAP;
  const top = Math.max(0, Math.round((h - gridH) / 2));

  const max = Math.max(1, ...rows.flatMap((r) => r.months.map((m) => m ?? 0)));

  const monthLabels = MONTH_LETTERS.map((letter, m) => {
    const x = GUTTER_L + m * (cellW + GAP) + cellW / 2;
    return `<text x="${r2(x)}" y="${top + 10}" text-anchor="middle" class="gb-mono" font-size="8" fill="${theme.textMuted}">${letter}</text>`;
  }).join('');

  const cells = rows
    .map((row, ri) => {
      const y = top + GUTTER_T + ri * (cellH + GAP);
      const yearLabel = `<text x="${GUTTER_L - 8}" y="${r2(y + cellH / 2 + 3)}" text-anchor="end" class="gb-mono" font-size="9" fill="${theme.textMuted}">${String(row.year).slice(2)}</text>`;
      const monthCells = row.months
        .map((count, m) => {
          if (count === null) return '';
          const x = GUTTER_L + m * (cellW + GAP);
          const fill = intensityColor(count, max);
          const ink = luminance(fill) < 0.45 ? theme.textPrimary : '#0a0a0a';
          const textOpacity = count === 0 ? 0.45 : 1;
          return (
            `<rect x="${x}" y="${r2(y)}" width="${cellW}" height="${cellH}" rx="9" fill="${escapeXml(fill)}"/>` +
            `<text x="${r2(x + cellW / 2)}" y="${r2(y + cellH / 2 + 4)}" text-anchor="middle" class="gb-mono" font-size="11" fill="${ink}" fill-opacity="${textOpacity}">${count}</text>`
          );
        })
        .join('');
      return yearLabel + monthCells;
    })
    .join('');

  return monthLabels + cells;
}
