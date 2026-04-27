import type { Theme } from '../../types.js';
import { iconByKey, renderIcon } from '../icons.js';
import { escapeXml, fitFontSize, truncate } from '../util.js';

export { escapeXml };

export interface StatTileRow {
  label: string;
  value: string;
  color: string;
}

export interface StatTileProps {
  x: number;
  y: number;
  w: number;
  h: number;
  iconKey: string;
  iconBgColor: string;
  iconStroke: string;
  cornerIconKey?: string;
  cornerIconColor?: string;
  value: string;
  label: string;
  rows: StatTileRow[];
  rowValueColor: string;
  theme: Theme;
}

export function renderStatTile(p: StatTileProps): string {
  const { x, y, w, h, theme, value, label, rows } = p;

  const icon = renderIcon({
    path: iconByKey(p.iconKey),
    size: 26,
    stroke: p.iconStroke,
    strokeWidth: 2.2,
  });

  const cornerIcon = p.cornerIconKey
    ? renderIcon({
        path: iconByKey(p.cornerIconKey),
        size: 22,
        stroke: p.cornerIconColor ?? theme.textMuted,
        strokeWidth: 1.8,
      })
    : '';

  const dividerY = 218;
  const rowsStartY = 250;
  const rowGap = 34;

  const labelFontSize = 16;
  const valueRowFontSize = 17;
  const rowGutter = 12;

  const rowsSvg = rows
    .map((row, i) => {
      const rowY = rowsStartY + i * rowGap;
      // Estimate the value column width and reserve the rest for the label.
      const valueWidth = row.value ? row.value.length * valueRowFontSize * 0.6 : 0;
      const labelPxAvail = w - 64 - valueWidth - (row.value ? rowGutter : 0);
      const labelMaxChars = Math.max(8, Math.floor(labelPxAvail / (labelFontSize * 0.55)));
      return `
      <text x="32" y="${rowY}" class="gb-text" font-size="${labelFontSize}" fill="${theme.textSecondary}">${escapeXml(truncate(row.label, labelMaxChars))}</text>
      <text x="${w - 32}" y="${rowY}" text-anchor="end" class="gb-mono" font-size="${valueRowFontSize}" fill="${row.color}">${escapeXml(row.value)}</text>
    `;
    })
    .join('');

  const valueFontSize = fitFontSize(value, w - 64, [64, 56, 48, 42, 36, 32]);

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="24" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1.5"/>
      <g transform="translate(28, 28)">
        <rect width="56" height="56" rx="14" fill="${p.iconBgColor}" fill-opacity="0.18"/>
        <g transform="translate(15, 15)">${icon}</g>
      </g>
      ${cornerIcon ? `<g transform="translate(${w - 56}, 36)">${cornerIcon}</g>` : ''}

      <text x="32" y="148" class="gb-display" font-size="${valueFontSize}" fill="${theme.textPrimary}">${escapeXml(value)}</text>
      <text x="32" y="186" class="gb-text" font-size="22" fill="${theme.textSecondary}">${escapeXml(label)}</text>

      <line x1="32" y1="${dividerY}" x2="${w - 32}" y2="${dividerY}" stroke="${theme.divider}" stroke-width="1"/>

      ${rowsSvg}
    </g>
  `;
}

