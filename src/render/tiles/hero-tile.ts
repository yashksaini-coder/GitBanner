import type { Theme } from '../../types.js';
import { iconByKey, renderIcon } from '../icons.js';
import { escapeXml, fitText } from '../util.js';
import { renderBars } from './bars.js';

export interface HeroBar {
  label: string;
  value: number;
}

export interface HeroTileProps {
  x: number;
  y: number;
  w: number;
  h: number;
  iconKey: string;
  accent: string;
  value: string;
  label: string;
  caption: string;
  bars: HeroBar[];
  barCaption: string;
  theme: Theme;
}

const PAD = 28;
// Shares the stat-tile header grid: icon box 48 at (28,28), value beside it,
// label y=112, caption y=136, divider y=156.
const VALUE_X = 92;
const BAR_PITCH = 30;

/**
 * The one tile the banner leads with. Exactly one hero per view: everything
 * else is a supporting stat tile, which is what keeps the eye landing here
 * first instead of on five numbers of equal weight.
 *
 * The top-project list is a magnitude comparison, so it is drawn as bars — a
 * single series in one hue, values direct-labelled at the tip.
 */
export function renderHeroTile(p: HeroTileProps): string {
  const { x, y, w, h, theme, value, label, caption, bars } = p;

  const icon = renderIcon({
    path: iconByKey(p.iconKey),
    size: 24,
    stroke: p.accent,
    strokeWidth: 2.2,
  });

  const heroSize = fitText(value, w - VALUE_X - PAD, [56, 48, 42], 0.6);
  const valueBaseline = 52 + Math.round(heroSize.size * 0.36);
  // Prose overflows long before the figure does — fit both, never clip.
  const fittedLabel = fitText(label, w - 2 * PAD, [19, 17, 15]);
  const fittedCaption = fitText(caption, w - 2 * PAD, [13, 12]);
  const dividerY = 156;
  const barsTop = 194;

  const barsSvg = renderBars({
    entries: bars,
    w: w - 2 * PAD,
    pitch: BAR_PITCH,
    gradId: 'gbh-grad',
    gradFrom: '#184f95',
    gradTo: '#3987e5',
    theme,
  });

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="24" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1"/>
      <g transform="translate(28, 28)">
        <rect width="48" height="48" rx="12" fill="${p.accent}" fill-opacity="0.16"/>
        <g transform="translate(12, 12)">${icon}</g>
      </g>

      <text x="${VALUE_X}" y="${valueBaseline}" class="gb-display" font-size="${heroSize.size}" fill="${theme.textPrimary}">${escapeXml(heroSize.text)}</text>
      <text x="${PAD}" y="112" class="gb-text" font-size="${fittedLabel.size}" fill="${theme.textPrimary}">${escapeXml(fittedLabel.text)}</text>
      <text x="${PAD}" y="136" class="gb-text" font-size="${fittedCaption.size}" fill="${theme.textMuted}">${escapeXml(fittedCaption.text)}</text>

      <line x1="${PAD}" y1="${dividerY}" x2="${w - PAD}" y2="${dividerY}" stroke="${theme.divider}" stroke-width="1"/>
      <text x="${PAD}" y="${barsTop - 12}" class="gb-text" font-size="12" letter-spacing="0.08em" fill="${theme.textMuted}">${escapeXml(p.barCaption)}</text>

      <g transform="translate(${PAD}, ${barsTop})">${barsSvg}</g>
    </g>
  `;
}
