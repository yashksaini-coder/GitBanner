import { DEFAULT_TILES, TILES, type Box } from '../tiles.js';
import type { StatsPayload, Theme, ThemeName } from '../types.js';
import { fontStyleBlock } from './fonts.js';
import { getTheme } from './theme.js';
import { escapeXml } from './util.js';

const CANVAS_W = 1600;
const MARGIN = 32;
const GAP = 20;
const COLS = 3;
const CARD_H = 360;
const MINI_H = 140;
/** Every card is the same width: three equal columns. */
const CARD_W = Math.floor((CANVAS_W - 2 * MARGIN - (COLS - 1) * GAP) / COLS);

export function toSvg(
  payload: StatsPayload,
  themeName: ThemeName = 'dark',
  tileKeys: string[] = DEFAULT_TILES,
): string {
  const theme = getTheme(themeName);

  const cards = tileKeys.filter((k) => TILES[k].kind !== 'mini');
  const minis = tileKeys.filter((k) => TILES[k].kind === 'mini');

  let y = MARGIN;
  const parts: string[] = [];

  for (const [keys, h] of [
    [cards, CARD_H],
    [minis, MINI_H],
  ] as const) {
    for (let i = 0; i < keys.length; i += COLS) {
      parts.push(renderRow(keys.slice(i, i + COLS), payload, theme, y, h));
      y += h + GAP;
    }
  }

  const canvasH = y - GAP + MARGIN;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${canvasH}" viewBox="0 0 ${CANVAS_W} ${canvasH}" role="img" aria-label="${escapeXml(ariaLabel(payload))}">
  <defs>
    <style>${fontStyleBlock()}</style>
  </defs>
  <rect width="${CANVAS_W}" height="${canvasH}" rx="36" fill="${theme.bg}"/>
  ${parts.join('')}
</svg>`;
}

/** One row of up to three equal-width tiles, left-aligned when partial. */
function renderRow(
  keys: string[],
  payload: StatsPayload,
  theme: Theme,
  y: number,
  h: number,
): string {
  return keys
    .map((key, i) => {
      const box: Box = { x: MARGIN + i * (CARD_W + GAP), y, w: CARD_W, h };
      return TILES[key].render(payload, theme, box);
    })
    .join('');
}

function ariaLabel(p: StatsPayload): string {
  const scope = p.periodLabel ? ` in ${p.periodLabel}` : '';
  return `Open source contributions by ${p.username}${scope}: ${p.prsMergedExternal} pull requests merged into other people's repositories across ${p.externalRepoCount} projects.`;
}



