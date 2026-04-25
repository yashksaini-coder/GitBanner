import type { Theme } from '../../types.js';
import { iconByKey, renderIcon } from '../icons.js';

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

  const rowsSvg = rows
    .map((row, i) => {
      const rowY = rowsStartY + i * rowGap;
      const labelMax = row.value ? 14 : 28;
      return `
      <text x="32" y="${rowY}" class="gb-text" font-size="16" fill="${theme.textSecondary}">${escapeXml(truncate(row.label, labelMax))}</text>
      <text x="${w - 32}" y="${rowY}" text-anchor="end" class="gb-mono" font-size="17" fill="${row.color}">${escapeXml(row.value)}</text>
    `;
    })
    .join('');

  const valueFontSize = chooseValueFontSize(value, w);

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

function chooseValueFontSize(value: string, tileWidth: number): number {
  // Display weight ~= 0.6 px-per-char at the chosen font size.
  // Reserve 64px of horizontal padding inside the tile.
  const usable = tileWidth - 64;
  const measure = (size: number) => value.length * size * 0.55;
  for (const size of [64, 56, 48, 42, 36]) {
    if (measure(size) <= usable) return size;
  }
  return 32;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&apos;';
    }
  });
}
