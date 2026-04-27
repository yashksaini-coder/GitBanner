import type { Theme } from '../../types.js';
import { iconByKey, renderIcon } from '../icons.js';
import { escapeXml, fitFontSize } from '../util.js';

export interface HighlightTileProps {
  x: number;
  y: number;
  w: number;
  h: number;
  iconKey: string;
  iconBgColor: string;
  iconStroke: string;
  value: string;
  subLine: string;
  theme: Theme;
}

export function renderHighlightTile(p: HighlightTileProps): string {
  const { x, y, w, h, theme, value, subLine } = p;

  const icon = renderIcon({
    path: iconByKey(p.iconKey),
    size: 36,
    stroke: p.iconStroke,
    strokeWidth: 2.4,
  });

  // Reserve the icon column (124px from left) and a 24px right gutter.
  const textMaxWidth = w - 124 - 24;
  const valueFontSize = fitFontSize(value, textMaxWidth, [48, 42, 36, 32, 28]);
  const subLineFontSize = fitFontSize(subLine, textMaxWidth, [20, 18, 16]);

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="22" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1.5"/>

      <g transform="translate(28, ${h / 2 - 36})">
        <rect width="72" height="72" rx="16" fill="${p.iconBgColor}" fill-opacity="0.18"/>
        <g transform="translate(18, 18)">${icon}</g>
      </g>

      <text x="124" y="${h / 2 + 4}" class="gb-display" font-size="${valueFontSize}" fill="${theme.textPrimary}">${escapeXml(value)}</text>
      <text x="124" y="${h / 2 + 36}" class="gb-text" font-size="${subLineFontSize}" fill="${theme.textSecondary}">${escapeXml(subLine)}</text>
    </g>
  `;
}
