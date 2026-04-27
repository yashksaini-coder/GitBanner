import type { Theme } from '../../types.js';
import { iconByKey, renderIcon } from '../icons.js';
import { escapeXml, fitText } from '../util.js';

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

const ICON_BOX = 56;
const ICON_SIZE = 28;
const PADDING = 28;
const TEXT_GAP = 16;
const RIGHT_GUTTER = 24;

export function renderHighlightTile(p: HighlightTileProps): string {
  const { x, y, w, h, theme, value, subLine } = p;

  const icon = renderIcon({
    path: iconByKey(p.iconKey),
    size: ICON_SIZE,
    stroke: p.iconStroke,
    strokeWidth: 2.4,
  });

  const textX = PADDING + ICON_BOX + TEXT_GAP;
  const textMaxWidth = w - textX - RIGHT_GUTTER;

  const fittedValue = fitText(value, textMaxWidth, [44, 38, 34, 30, 26, 22], 0.6);
  const fittedSub = fitText(subLine, textMaxWidth, [20, 18, 16], 0.55);

  const iconPad = (ICON_BOX - ICON_SIZE) / 2;

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="22" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1.5"/>

      <g transform="translate(${PADDING}, ${h / 2 - ICON_BOX / 2})">
        <rect width="${ICON_BOX}" height="${ICON_BOX}" rx="14" fill="${p.iconBgColor}" fill-opacity="0.18"/>
        <g transform="translate(${iconPad}, ${iconPad})">${icon}</g>
      </g>

      <text x="${textX}" y="${h / 2 + 4}" class="gb-display" font-size="${fittedValue.size}" fill="${theme.textPrimary}">${escapeXml(fittedValue.text)}</text>
      <text x="${textX}" y="${h / 2 + 32}" class="gb-text" font-size="${fittedSub.size}" fill="${theme.textSecondary}">${escapeXml(fittedSub.text)}</text>
    </g>
  `;
}
