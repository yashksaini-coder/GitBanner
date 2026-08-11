import { DEFAULT_TILES, TILES, type Box } from '../tiles.js';
import type { StatsPayload, ThemeName } from '../types.js';
import { fontStyleBlock } from './fonts.js';
import { getTheme } from './theme.js';
import { escapeXml } from './util.js';

const CANVAS_W = 1600;
const CANVAS_H = 728;
const MARGIN = 32;
const GAP = 24;
const CARD_H = 664;

export function toSvg(
  payload: StatsPayload,
  themeName: ThemeName = 'dark',
  tileKeys: string[] = DEFAULT_TILES,
): string {
  const theme = getTheme(themeName);

  const count = tileKeys.length;
  const cardW = Math.floor((CANVAS_W - 2 * MARGIN - (count - 1) * GAP) / count);

  let x = MARGIN;
  const parts = tileKeys.map((key) => {
    const box: Box = { x, y: MARGIN, w: cardW, h: CARD_H };
    x += cardW + GAP;
    return TILES[key].render(payload, theme, box);
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" role="img" aria-label="${escapeXml(ariaLabel(payload))}">
  <defs>
    <style>${fontStyleBlock()}</style>
  </defs>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" rx="36" fill="${theme.bg}"/>
  ${parts.join('')}
</svg>`;
}

function ariaLabel(p: StatsPayload): string {
  const scope = p.periodLabel ? ` in ${p.periodLabel}` : '';
  return `Open source contributions by ${p.username}${scope}: ${p.prsMergedExternal} pull requests merged into other people's repositories across ${p.externalRepoCount} projects.`;
}
