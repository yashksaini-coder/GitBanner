import type { Theme } from '../../types.js';
import { escapeXml } from '../util.js';

const r2 = (v: number): number => Math.round(v * 100) / 100;

export interface CandleDatum {
  value: number;
}

export interface CandlesProps {
  w: number;
  h: number;
  data: CandleDatum[];
  accent: string;
  theme: Theme;
  /** How many leading bars get their value on the cap. */
  labelTop?: number;
  emptyText?: string;
}

const TICK_BAND = 16;
const VALUE_BAND = 16;

/**
 * Candle-style ranked bars, reference style: rounded vertical bars floating
 * on a shared midline. Centre-anchoring keeps them honest — each bar is
 * symmetric about the midline and its LENGTH is the value (like the stream's
 * thickness), so the floating look never misstates a number. Rank ticks
 * (01..n) sit beneath; the leading bars carry their exact value on the cap.
 */
export function renderCandles(p: CandlesProps): string {
  const { w, h, data, accent, theme } = p;
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return `<text x="${r2(w / 2)}" y="${r2(h / 2)}" text-anchor="middle" class="gb-text" font-size="13" fill="${theme.textMuted}">${escapeXml(p.emptyText ?? 'no data yet')}</text>`;
  }

  const n = data.length;
  const mid = (h - TICK_BAND) / 2 + VALUE_BAND / 2;
  const zone = h - TICK_BAND - 2 * VALUE_BAND;
  const gap = Math.min(18, Math.max(8, Math.floor(w / (n * 3))));
  const bw = Math.min(16, Math.floor((w - (n - 1) * gap) / n));
  const x0 = Math.round((w - (n * bw + (n - 1) * gap)) / 2);
  const max = Math.max(...data.map((d) => d.value));
  const labelTop = p.labelTop ?? 3;

  const midline = `<line x1="0" y1="${r2(mid)}" x2="${w}" y2="${r2(mid)}" stroke="${theme.divider}" stroke-width="1"/>`;

  const bars = data
    .map((d, i) => {
      const len = Math.max(8, Math.round((d.value / max) * zone));
      const x = x0 + i * (bw + gap);
      const y = mid - len / 2;
      const cap =
        i < labelTop
          ? `<text x="${r2(x + bw / 2)}" y="${r2(y - 6)}" text-anchor="middle" class="gb-mono" font-size="10" fill="${theme.textPrimary}">${d.value}</text>`
          : '';
      const rank = `<text x="${r2(x + bw / 2)}" y="${h - 3}" text-anchor="middle" class="gb-mono" font-size="8" fill="${theme.textMuted}">${String(i + 1).padStart(2, '0')}</text>`;
      return (
        `<rect class="gbc-bar" x="${x}" y="${r2(y)}" width="${bw}" height="${len}" rx="${bw / 2}" fill="${accent}"/>` +
        cap +
        rank
      );
    })
    .join('');

  return midline + bars;
}
