import type { Theme } from '../../types.js';
import { escapeXml, fitText } from '../util.js';


export interface StatTileStat {
  value: string;
  label: string;
}

export interface StatTileProps {
  x: number;
  y: number;
  w: number;
  h: number;
  accent: string;
  /** Card title, reference style: bold, top-left, no icon. */
  title: string;
  caption: string;
  /** Chart markup in tile-local coordinates; the zone is CHART_TOP..CHART_BOTTOM. */
  chart?: string;
  /** Up to three stat columns BELOW the chart — the reference's number placement. */
  stats: StatTileStat[];
  theme: Theme;
}

const PAD = 28;
// Shared card grid, hyper-chart anatomy: title, chart, stats, rows. The type
// scale is set for the ~0.53x GitHub README render: nothing that must be read
// is authored below 15px (~8px effective).
const TITLE_Y = 44;
const CAPTION_Y = 68;
export const CHART_TOP = 78;
export const CHART_BOTTOM = 296;
const STAT_LABEL_Y = 324;
const STAT_VALUE_Y = 358;

/**
 * The one card scaffold every chart card uses: bold title (no icon — the
 * chart is the identity), the chart given the freed space, the headline
 * numbers below it, and metric rows at the bottom.
 */
export function renderStatTile(p: StatTileProps): string {
  const { x, y, w, h, theme, title, caption, stats } = p;

  const fittedTitle = fitText(title, w - 2 * PAD, [24, 22, 20]);
  const fittedCaption = fitText(caption, w - 2 * PAD, [17, 16, 15]);

  const cols = Math.max(1, Math.min(3, stats.length));
  const colW = (w - 2 * PAD) / cols;
  const statsSvg = stats
    .slice(0, 3)
    .map((stat, i) => {
      const colX = PAD + i * colW;
      const fittedValue = fitText(stat.value, colW - 18, [30, 26, 22, 19], 0.6);
      const fittedLabel = fitText(stat.label, colW - 17, [15, 14, 13, 12], 0.55);
      return (
        `<rect x="${colX}" y="${STAT_LABEL_Y - 8}" width="8" height="8" rx="2" fill="${p.accent}"/>` +
        `<text x="${colX + 13}" y="${STAT_LABEL_Y}" class="gb-text" font-size="${fittedLabel.size}" fill="${theme.textMuted}">${escapeXml(fittedLabel.text)}</text>` +
        `<text x="${colX}" y="${STAT_VALUE_Y}" class="gb-display" font-size="${fittedValue.size}" fill="${theme.textPrimary}">${escapeXml(fittedValue.text)}</text>`
      );
    })
    .join('');

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="24" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1"/>
      <text x="${PAD}" y="${TITLE_Y}" class="gb-text-bold" font-size="${fittedTitle.size}" fill="${theme.textPrimary}">${escapeXml(fittedTitle.text)}</text>
      <text x="${PAD}" y="${CAPTION_Y}" class="gb-text" font-size="${fittedCaption.size}" fill="${theme.textMuted}">${escapeXml(fittedCaption.text)}</text>
      ${p.chart ?? ''}
      ${statsSvg}
    </g>
  `;
}
