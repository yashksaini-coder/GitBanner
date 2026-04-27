import type { Theme } from '../../types.js';
import { iconByKey, renderIcon } from '../icons.js';
import { escapeXml, fitFontSize, truncate } from '../util.js';

export interface ProjectTileProps {
  x: number;
  y: number;
  w: number;
  h: number;
  iconKey: string;
  iconColor: string;
  label: string;
  projectName: string;
  subLine: string;
  theme: Theme;
}

export function renderProjectTile(p: ProjectTileProps): string {
  const { x, y, w, h, theme, label, projectName, subLine } = p;

  const icon = renderIcon({
    path: iconByKey(p.iconKey),
    size: 22,
    stroke: p.iconColor,
    strokeWidth: 2,
  });

  const truncatedName = truncate(projectName, 22);
  const nameFontSize = fitFontSize(truncatedName, w - 56, [44, 36, 30, 26]);

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="22" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1.5"/>
      <g transform="translate(28, 26)">${icon}</g>
      <text x="60" y="44" class="gb-text" font-size="20" fill="${theme.textSecondary}">${escapeXml(label)}</text>

      <text x="28" y="${Math.round(h / 2 + 18)}" class="gb-display" font-size="${nameFontSize}" fill="${theme.textPrimary}">${escapeXml(truncatedName)}</text>
      <text x="28" y="${h - 28}" class="gb-text" font-size="20" fill="${theme.textSecondary}">${escapeXml(subLine)}</text>
    </g>
  `;
}
