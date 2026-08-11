import type { Theme } from '../../types.js';
import { escapeXml, r2 } from '../util.js';


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
  /** Override the body gradient (offset, colour, opacity), top to bottom. */
  stops?: readonly (readonly [number, string, number])[];
  /** Bright slab on each bar top, reference style; omit for plain bars. */
  capColor?: string;
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
  const LABEL_BAND = 22;
  const VALUE_BAND = 24;
  const baseline = h - LABEL_BAND;

  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return `<text x="${r2(w / 2)}" y="${r2(h / 2)}" text-anchor="middle" class="gb-text" font-size="16" fill="${theme.textMuted}">${escapeXml(p.emptyText ?? 'no data yet')}</text>`;
  }

  const n = data.length;
  const gap = Math.min(24, Math.max(10, Math.floor(w / (n * 4))));
  const bw = Math.min(44, Math.floor((w - (n - 1) * gap) / n));
  const x0 = Math.round((w - (n * bw + (n - 1) * gap)) / 2);
  const max = Math.max(...data.map((d) => d.count));
  const zone = baseline - VALUE_BAND;

  const gradient = `<linearGradient id="${escapeXml(gradId)}" x1="0" y1="0" x2="0" y2="1">${(p.stops ?? GRAD_STOPS)
    .map(
      ([off, color, op]) => `<stop offset="${off}" stop-color="${color}" stop-opacity="${op}"/>`,
    )
    .join('')}</linearGradient>`;

  // Rounded data-end, square baseline: cap radius only at the top.
  const barPath = (x: number, yTop: number, height: number): string => {
    const r = Math.min(7, bw / 2, height);
    const yBot = yTop + height;
    return `M ${x} ${r2(yBot)} L ${x} ${r2(yTop + r)} A ${r} ${r} 0 0 1 ${r2(x + r)} ${r2(yTop)} L ${r2(x + bw - r)} ${r2(yTop)} A ${r} ${r} 0 0 1 ${r2(x + bw)} ${r2(yTop + r)} L ${r2(x + bw)} ${r2(yBot)} Z`;
  };

  const bars = data
    .map((d, i) => {
      const bh = Math.max(6, Math.round((d.count / max) * zone));
      const x = x0 + i * (bw + gap);
      const y = baseline - bh;
      // Bright cap slab at the data end, reference style — clearly part of
      // the bar, never taller than it.
      const cap = p.capColor
        ? `<path d="${barPath(x, y, Math.min(5, bh))}" fill="${escapeXml(p.capColor)}"/>`
        : '';
      return (
        `<path d="${barPath(x, y, bh)}" fill="url(#${escapeXml(gradId)})"/>` +
        cap +
        `<text x="${r2(x + bw / 2)}" y="${r2(y - 8)}" text-anchor="middle" class="gb-mono" font-size="15" fill="${theme.textPrimary}">${d.count}</text>` +
        `<text x="${r2(x + bw / 2)}" y="${h - 5}" text-anchor="middle" class="gb-mono" font-size="14" fill="${theme.textMuted}">${escapeXml(d.label)}</text>`
      );
    })
    .join('');

  return `<defs>${gradient}</defs>` + bars;
}
