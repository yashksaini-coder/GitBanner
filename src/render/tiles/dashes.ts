import type { Theme } from '../../types.js';
import { escapeXml, truncate } from '../util.js';

const r2 = (v: number): number => Math.round(v * 100) / 100;

export interface DashRow {
  label: string;
  value: number;
}

export interface DashRowsProps {
  w: number;
  h: number;
  rows: DashRow[];
  accent: string;
  theme: Theme;
  emptyText?: string;
}

const NAME_COL = 118;
const VALUE_COL = 44;
const SEG_H = 9;
const SEG_GAP = 6;

/**
 * Dash-segment leaderboard, reference style: one row per repo, a track of
 * rounded dashes filled in proportion to the value (dim track segments carry
 * the remainder), the exact value in mono at the row's end. At least one
 * segment lights for any non-zero value.
 */
export function renderDashRows(p: DashRowsProps): string {
  const { w, h, rows, accent, theme } = p;
  if (rows.length === 0 || rows.every((r) => r.value === 0)) {
    return `<text x="${r2(w / 2)}" y="${r2(h / 2)}" text-anchor="middle" class="gb-text" font-size="13" fill="${theme.textMuted}">${escapeXml(p.emptyText ?? 'no data yet')}</text>`;
  }

  const shown = rows.slice(0, 5);
  const pitch = Math.min(46, Math.floor(h / shown.length));
  const top = Math.round((h - pitch * shown.length) / 2);
  const trackW = w - NAME_COL - VALUE_COL;
  const segW = 16;
  const nSeg = Math.max(4, Math.floor((trackW + SEG_GAP) / (segW + SEG_GAP)));
  const max = Math.max(...shown.map((r) => r.value));

  return shown
    .map((row, i) => {
      const cy = top + i * pitch + pitch / 2;
      const filled = row.value === 0 ? 0 : Math.max(1, Math.round((row.value / max) * nSeg));
      const segs = Array.from({ length: nSeg }, (_, s) => {
        const x = NAME_COL + s * (segW + SEG_GAP);
        const fill = s < filled ? accent : theme.pillBg;
        const opacity = s < filled ? 1 : 0.9;
        return `<rect class="${s < filled ? 'gbd-on' : 'gbd-off'}" x="${r2(x)}" y="${r2(cy - SEG_H / 2)}" width="${segW}" height="${SEG_H}" rx="${SEG_H / 2}" fill="${fill}" fill-opacity="${opacity}"/>`;
      }).join('');
      return (
        `<text x="0" y="${r2(cy + 4)}" class="gb-text" font-size="13" fill="${theme.textSecondary}">${escapeXml(truncate(row.label, 13))}</text>` +
        segs +
        `<text x="${w}" y="${r2(cy + 4)}" text-anchor="end" class="gb-mono" font-size="13" fill="${theme.textPrimary}">${row.value}</text>`
      );
    })
    .join('');
}
