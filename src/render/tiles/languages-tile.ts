import type { Theme } from '../../types.js';
import { iconByKey, renderIcon } from '../icons.js';
import { escapeXml } from './stat-tile.js';

export interface LanguagesTileProps {
  x: number;
  y: number;
  w: number;
  h: number;
  iconKey: string;
  iconBgColor: string;
  iconStroke: string;
  count: number;
  label: string;
  languages: { name: string; color: string }[];
  overflow: number;
  theme: Theme;
}

export function renderLanguagesTile(p: LanguagesTileProps): string {
  const { x, y, w, h, theme, count, label, languages, overflow } = p;

  const icon = renderIcon({
    path: iconByKey(p.iconKey),
    size: 26,
    stroke: p.iconStroke,
    strokeWidth: 2.2,
  });

  const pillSvg = layoutPills(languages, overflow, w - 64, theme);

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="24" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1.5"/>
      <g transform="translate(28, 28)">
        <rect width="56" height="56" rx="14" fill="${p.iconBgColor}" fill-opacity="0.18"/>
        <g transform="translate(15, 15)">${icon}</g>
      </g>

      <text x="32" y="148" class="gb-display" font-size="64" fill="${theme.textPrimary}">${escapeXml(String(count))}</text>
      <text x="32" y="186" class="gb-text" font-size="22" fill="${theme.textSecondary}">${escapeXml(label)}</text>

      <line x1="32" y1="218" x2="${w - 32}" y2="218" stroke="${theme.divider}" stroke-width="1"/>

      <g transform="translate(32, 240)">${pillSvg}</g>
    </g>
  `;
}

function layoutPills(
  languages: { name: string; color: string }[],
  overflow: number,
  maxWidth: number,
  theme: Theme,
): string {
  const lineHeight = 38;
  const pillHeight = 30;
  const pillPaddingX = 14;
  const fontSize = 14;
  const charWidth = fontSize * 0.6;
  const gap = 8;

  let cursorX = 0;
  let cursorY = 0;
  const out: string[] = [];

  const items = languages.map((l) => ({ label: l.name, color: l.color }));
  if (overflow > 0) {
    items.push({ label: `+${overflow}`, color: theme.textMuted });
  }

  for (const item of items) {
    const pillWidth = Math.ceil(item.label.length * charWidth + pillPaddingX * 2);
    if (cursorX + pillWidth > maxWidth && cursorX > 0) {
      cursorX = 0;
      cursorY += lineHeight;
    }
    out.push(`
      <g transform="translate(${cursorX}, ${cursorY})">
        <rect width="${pillWidth}" height="${pillHeight}" rx="8" fill="${theme.pillBg}" stroke="${item.color}" stroke-width="1" stroke-opacity="0.4"/>
        <text x="${pillWidth / 2}" y="${pillHeight / 2 + 5}" text-anchor="middle" class="gb-text-bold" font-size="${fontSize}" fill="${item.color}">${escapeXml(item.label)}</text>
      </g>
    `);
    cursorX += pillWidth + gap;
  }

  return out.join('');
}
