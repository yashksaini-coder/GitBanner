import type { Theme } from '../../types.js';
import { iconByKey, renderIcon } from '../icons.js';
import { escapeXml } from './stat-tile.js';

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

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="22" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1.5"/>
      <g transform="translate(28, 26)">${icon}</g>
      <text x="60" y="44" class="gb-text" font-size="20" fill="${theme.textSecondary}">${escapeXml(label)}</text>

      <text x="28" y="${truncatedNameY(projectName, h)}" class="gb-display" font-size="${nameFontSize(projectName, w)}" fill="${theme.textPrimary}">${escapeXml(truncate(projectName, 22))}</text>
      <text x="28" y="${h - 28}" class="gb-text" font-size="20" fill="${theme.textSecondary}">${escapeXml(subLine)}</text>
    </g>
  `;
}

function nameFontSize(name: string, tileWidth: number): number {
  if (name.length <= 14) return 44;
  if (name.length <= 20) return 36;
  if (tileWidth >= 380) return 30;
  return 26;
}

function truncatedNameY(_name: string, h: number): number {
  return Math.round(h / 2 + 18);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
