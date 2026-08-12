import type { Theme } from '../../types.js';
import { escapeXml, fitText } from '../util.js';

export interface MiniTileProps {
  x: number;
  y: number;
  w: number;
  h: number;
  accent: string;
  title: string;
  value: string;
  subLine: string;
  /**
   * Leaderboard mode: up to three ranked rows replace the big value and
   * sub-line (the card total belongs in the title then).
   */
  list?: { label: string; value: string }[];
  /** Right-side bar sparkline values; empty hides the spark. */
  spark: number[];
  theme: Theme;
}

const PAD = 24;
/** Sparkline zone geometry, reference style: rounded vertical bars, right side. */
const SPARK_W = 170;
const SPARK_TOP = 26;
const SPARK_BOTTOM = 114;

/**
 * Reference-style mini: title, big value, a muted sub-line, and a rounded-bar
 * sparkline on the right. No icons — the spark is the identity.
 */
export function renderMiniTile(p: MiniTileProps): string {
  const { x, y, w, h, theme, title, value, subLine, spark } = p;

  const textMax = w - 2 * PAD - (spark.length > 0 ? SPARK_W + 16 : 0);
  const fittedTitle = fitText(title, textMax, [19, 18, 17]);

  if (p.list && p.list.length > 0) {
    const rows = p.list.slice(0, 3).map((row, i) => {
      const rowY = 66 + i * 27;
      const valueW = Math.ceil(row.value.length * 16 * 0.62);
      const valueX = PAD + textMax;
      const name = fitText(row.label, textMax - 26 - valueW - 10, [16, 15, 14, 13], 0.55);
      return (
        `<text x="${PAD}" y="${rowY}" class="gb-mono" font-size="15" fill="${p.accent}">${i + 1}</text>` +
        `<text x="${PAD + 22}" y="${rowY}" class="gb-text" font-size="${name.size}" fill="${theme.textSecondary}">${escapeXml(name.text)}</text>` +
        `<text x="${valueX}" y="${rowY}" text-anchor="end" class="gb-mono" font-size="16" fill="${theme.textPrimary}">${escapeXml(row.value)}</text>`
      );
    });
    const sparkSvg = spark.length > 0 ? renderSpark(spark, w, p.accent) : '';
    return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="22" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1"/>
      <text x="${PAD}" y="40" class="gb-mono" font-size="${fittedTitle.size + 2}" fill="${theme.textPrimary}">${escapeXml(fittedTitle.text)}</text>
      ${rows.join('')}
      ${sparkSvg}
    </g>
  `;
  }
  const fittedValue = fitText(value, textMax, [34, 30, 26, 20], 0.6);
  const fittedSub = fitText(subLine, textMax, [15, 14], 0.55);

  const sparkSvg = spark.length > 0 ? renderSpark(spark, w, p.accent) : '';

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="22" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1"/>
      <text x="${PAD}" y="40" class="gb-mono" font-size="${fittedTitle.size + 2}" fill="${theme.textPrimary}">${escapeXml(fittedTitle.text)}</text>
      <text x="${PAD}" y="86" class="gb-display" font-size="${fittedValue.size}" fill="${theme.textPrimary}">${escapeXml(fittedValue.text)}</text>
      <text x="${PAD}" y="${h - 24}" class="gb-text" font-size="${fittedSub.size}" fill="${theme.textMuted}">${escapeXml(fittedSub.text)}</text>
      ${sparkSvg}
    </g>
  `;
}

/**
 * Rounded vertical bars, bottom-anchored on a shared baseline — the honest
 * take on the reference's candle look (centre-anchored bars would misstate
 * the values). Scaled to the largest value; minimum stub height 6px.
 */
function renderSpark(values: number[], w: number, accent: string): string {
  const n = Math.min(values.length, 12);
  const shown = values.slice(0, n);
  const max = Math.max(1, ...shown);
  const gap = 6;
  const bw = Math.max(4, Math.min(9, Math.floor((SPARK_W - (n - 1) * gap) / n)));
  const zoneH = SPARK_BOTTOM - SPARK_TOP;
  const x0 = w - PAD - n * bw - (n - 1) * gap;

  return shown
    .map((v, i) => {
      const bh = Math.max(6, Math.round((v / max) * zoneH));
      const bx = x0 + i * (bw + gap);
      const by = SPARK_BOTTOM - bh;
      return `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${bw / 2}" fill="${accent}" fill-opacity="${i === 0 ? 1 : 0.75}"/>`;
    })
    .join('');
}
