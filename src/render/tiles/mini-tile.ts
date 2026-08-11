import type { Theme } from '../../types.js';
import { iconByKey, renderIcon } from '../icons.js';
import { escapeXml, fitText } from '../util.js';

export interface MiniTileProps {
  x: number;
  y: number;
  w: number;
  h: number;
  iconKey: string;
  iconColor: string;
  label: string;
  value: string;
  subLine: string;
  theme: Theme;
}

/** Short tile: small header label, one headline value, one supporting line. */
export function renderMiniTile(p: MiniTileProps): string {
  const { x, y, w, h, theme, label, value, subLine } = p;

  const icon = renderIcon({
    path: iconByKey(p.iconKey),
    size: 22,
    stroke: p.iconColor,
    strokeWidth: 2,
  });

  const maxWidth = w - 56;
  const fittedValue = fitText(value, maxWidth, [36, 32, 28, 24, 20], 0.6);
  const fittedSub = fitText(subLine, maxWidth, [16, 15, 14], 0.55);

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="22" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1"/>
      <g transform="translate(28, 24)">${icon}</g>
      <text x="58" y="41" class="gb-text" font-size="16" fill="${theme.textSecondary}">${escapeXml(label)}</text>

      <text x="28" y="${h - 56}" class="gb-display" font-size="${fittedValue.size}" fill="${theme.textPrimary}">${escapeXml(fittedValue.text)}</text>
      <text x="28" y="${h - 26}" class="gb-text" font-size="${fittedSub.size}" fill="${theme.textSecondary}">${escapeXml(fittedSub.text)}</text>
    </g>
  `;
}
