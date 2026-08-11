import type { Theme } from '../../types.js';
import { escapeXml } from '../util.js';

const r2 = (v: number): number => Math.round(v * 100) / 100;

export interface ColumnDatum {
  label: string;
  count: number;
}

export interface ColumnsProps {
  w: number;
  h: number;
  data: ColumnDatum[];
  gradId: string;
  theme: Theme;
  emptyText?: string;
}

/** Reference ramp: bright green cap fading through blue toward the base. */
const GRAD_STOPS: readonly (readonly [number, string, number])[] = [
  [0, '#2fd08a', 1],
  [0.55, '#3987e5', 0.95],
  [1, '#184f95', 0.4],
];

/**
 * Vertical gradient columns, reference style: value on every cap in mono,
 * label under every base, rounded top and square bottom (bars grow from the
 * baseline), one shared objectBoundingBox gradient so short bars keep the
 * bright cap. The honest form for discrete buckets — an area curve would
 * imply continuity between them.
 */
export function renderColumns(p: ColumnsProps): string {
  const { w, h, data, gradId, theme } = p;
  const LABEL_BAND = 16;
  const VALUE_BAND = 16;
  const baseline = h - LABEL_BAND;

  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return `<text x="${r2(w / 2)}" y="${r2(h / 2)}" text-anchor="middle" class="gb-text" font-size="13" fill="${theme.textMuted}">${escapeXml(p.emptyText ?? 'no data yet')}</text>`;
  }

  const n = data.length;
  const gap = Math.min(24, Math.max(10, Math.floor(w / (n * 4))));
  const bw = Math.min(44, Math.floor((w - (n - 1) * gap) / n));
  const x0 = Math.round((w - (n * bw + (n - 1) * gap)) / 2);
  const max = Math.max(...data.map((d) => d.count));
  const zone = baseline - VALUE_BAND;

  const gradient = `<linearGradient id="${escapeXml(gradId)}" x1="0" y1="0" x2="0" y2="1">${GRAD_STOPS.map(
    ([off, color, op]) => `<stop offset="${off}" stop-color="${color}" stop-opacity="${op}"/>`,
  ).join('')}</linearGradient>`;

  const bars = data
    .map((d, i) => {
      const bh = Math.max(6, Math.round((d.count / max) * zone));
      const x = x0 + i * (bw + gap);
      const y = baseline - bh;
      const rTop = Math.min(7, bw / 2, bh);
      // Rounded data-end, square baseline: cap radius only at the top.
      const path = `M ${x} ${r2(baseline)} L ${x} ${r2(y + rTop)} A ${rTop} ${rTop} 0 0 1 ${r2(x + rTop)} ${r2(y)} L ${r2(x + bw - rTop)} ${r2(y)} A ${rTop} ${rTop} 0 0 1 ${r2(x + bw)} ${r2(y + rTop)} L ${r2(x + bw)} ${r2(baseline)} Z`;
      return (
        `<path d="${path}" fill="url(#${escapeXml(gradId)})"/>` +
        `<text x="${r2(x + bw / 2)}" y="${r2(y - 6)}" text-anchor="middle" class="gb-mono" font-size="11" fill="${theme.textPrimary}">${d.count}</text>` +
        `<text x="${r2(x + bw / 2)}" y="${h - 3}" text-anchor="middle" class="gb-mono" font-size="9" fill="${theme.textMuted}">${escapeXml(d.label)}</text>`
      );
    })
    .join('');

  return `<defs>${gradient}</defs>` + bars;
}
