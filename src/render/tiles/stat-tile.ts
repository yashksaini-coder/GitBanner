import type { Theme } from '../../types.js';
import { iconByKey, renderIcon } from '../icons.js';
import { escapeXml, fitText, truncate } from '../util.js';

export { escapeXml };

export interface StatTileRow {
  label: string;
  value: string;
}

export interface StatTileProps {
  x: number;
  y: number;
  w: number;
  h: number;
  iconKey: string;
  accent: string;
  value: string;
  label: string;
  caption: string;
  rows: StatTileRow[];
  theme: Theme;
}

const PAD = 28;
// One shared grid across every top-row tile, hero included: icon box 48px at
// (28,28), value beside it, label y=112, caption y=136, divider y=156.
const VALUE_X = 92;
const LABEL_Y = 112;
const CAPTION_Y = 136;
const DIVIDER_Y = 156;
const ROW_START = 188;
const ROW_PITCH = 34;
const DOT_R = 4;

/**
 * Supporting tile beside the hero. Deliberately quieter: a smaller value, and
 * row text in ink tokens rather than the accent hue — a light hue is poor as
 * text, and identity belongs to the coloured dot beside it, not the text.
 */
export function renderStatTile(p: StatTileProps): string {
  const { x, y, w, h, theme, value, label, caption, rows } = p;

  const icon = renderIcon({
    path: iconByKey(p.iconKey),
    size: 24,
    stroke: p.accent,
    strokeWidth: 2.2,
  });

  // The value sits beside the icon, optically centred on the icon box.
  const fittedValue = fitText(value, w - VALUE_X - PAD, [40, 34, 30, 26, 22], 0.6);
  const valueBaseline = 52 + Math.round(fittedValue.size * 0.36);
  const fittedLabel = fitText(label, w - 2 * PAD, [17, 15, 14]);
  const fittedCaption = fitText(caption, w - 2 * PAD, [13, 12]);

  const rowsSvg = rows
    .map((row, i) => {
      const rowY = ROW_START + i * ROW_PITCH;
      // Value column is right-aligned, so reserve it before truncating the label.
      const valueW = row.value.length * 15 * 0.6;
      const labelChars = Math.max(6, Math.floor((w - 2 * PAD - 18 - valueW - 10) / (15 * 0.55)));
      return `
      <circle cx="${PAD + DOT_R}" cy="${rowY - 5}" r="${DOT_R}" fill="${p.accent}"/>
      <text x="${PAD + 18}" y="${rowY}" class="gb-text" font-size="15" fill="${theme.textSecondary}">${escapeXml(truncate(row.label, labelChars))}</text>
      <text x="${w - PAD}" y="${rowY}" text-anchor="end" class="gb-mono" font-size="15" fill="${theme.textPrimary}">${escapeXml(row.value)}</text>
    `;
    })
    .join('');

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="24" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1.5"/>
      <g transform="translate(28, 28)">
        <rect width="48" height="48" rx="12" fill="${p.accent}" fill-opacity="0.16"/>
        <g transform="translate(12, 12)">${icon}</g>
      </g>

      <text x="${VALUE_X}" y="${valueBaseline}" class="gb-display" font-size="${fittedValue.size}" fill="${theme.textPrimary}">${escapeXml(fittedValue.text)}</text>
      <text x="${PAD}" y="${LABEL_Y}" class="gb-text" font-size="${fittedLabel.size}" fill="${theme.textPrimary}">${escapeXml(fittedLabel.text)}</text>
      <text x="${PAD}" y="${CAPTION_Y}" class="gb-text" font-size="${fittedCaption.size}" fill="${theme.textMuted}">${escapeXml(fittedCaption.text)}</text>

      <line x1="${PAD}" y1="${DIVIDER_Y}" x2="${w - PAD}" y2="${DIVIDER_Y}" stroke="${theme.divider}" stroke-width="1"/>

      ${rowsSvg}
    </g>
  `;
}
