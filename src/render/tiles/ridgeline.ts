import type { Theme } from '../../types.js';
import { escapeXml, fitText, r2 } from '../util.js';
import { monotonePath } from './wave.js';


/** Depth step per ridge: deeper ridges shift right and up. */
const DX = 14;
const DY = 16;
/** Left pad before the front ridge's first year position. */
const X_PAD = 8;

/** Reference palette: back → mid → front, linear RGB between stops. */
const HUE_STOPS: [number, number, number][] = [
  [0x8b, 0x6c, 0xf0],
  [0x39, 0x87, 0xe5],
  [0x2f, 0xd0, 0x8a],
];

/** t=0 back (#8b6cf0), t=0.5 mid (#3987e5), t=1 front (#2fd08a). */
export function ridgeHue(t: number): string {
  const seg = t <= 0.5 ? 0 : 1;
  const u = t <= 0.5 ? t * 2 : (t - 0.5) * 2;
  const [a, b] = [HUE_STOPS[seg], HUE_STOPS[seg + 1]];
  return (
    '#' +
    a
      .map((c, i) =>
        Math.round(c + (b[i] - c) * u)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/**
 * Ridgeline (joyplot) of review counts per year, one ridge per repo, in local
 * (0,0)-(w,h). series[0] is the biggest repo and draws at the BACK: highest
 * and rightmost, each nearer ridge DY lower and DX further left, front ridge
 * baseline at h - 22 starting at x = X_PAD. All ridges share one global y
 * scale so peak heights are comparable. Each ridge is occluded from the ones
 * behind it by a solid theme.tile fill under its translucent hue fill.
 */
export function renderRidgeline(p: {
  w: number;
  h: number;
  /** x tick labels, ascending. */
  years: string[];
  /** FIRST = biggest = BACK. */
  series: { name: string; counts: number[] }[];
  gradId: string;
  theme: Theme;
}): string {
  const { w, h, years, series, theme } = p;
  const n = series.length;
  const globalMax = Math.max(0, ...series.flatMap((s) => s.counts));

  if (n === 0 || globalMax === 0) {
    return `<text x="${r2(w / 2)}" y="${r2(h / 2)}" text-anchor="middle" class="gb-text" font-size="16" fill="${theme.textMuted}">no reviews yet</text>`;
  }

  const ridgeW = w - 112 - (n - 1) * DX; // 112: room for a 13px ridge label
  const ridgeH = h - 30 - (n - 1) * DY;
  const step = years.length > 1 ? ridgeW / (years.length - 1) : 0;

  const parts: string[] = [];
  // Back (i=0) first so nearer ridges paint over it.
  for (let i = 0; i < n; i++) {
    const depthFromFront = n - 1 - i;
    const offX = X_PAD + depthFromFront * DX;
    const baseY = h - 22 - depthFromFront * DY;
    const hue = ridgeHue(n > 1 ? i / (n - 1) : 1);

    const pts = series[i].counts.map((c, j) => ({
      // Single-year window: centre the lone point on the ridge.
      x: offX + (years.length > 1 ? j * step : ridgeW / 2),
      y: baseY - (c / globalMax) * ridgeH,
    }));
    const curve = monotonePath(pts);
    const area = `${curve} L ${r2(pts[pts.length - 1].x)} ${baseY} L ${r2(pts[0].x)} ${baseY} Z`;

    const labelX = offX + ridgeW + 4;
    const label = fitText(series[i].name, Math.max(0, w - labelX), [13, 12, 11], 0.6);

    parts.push(
      `<path d="${area}" fill="${theme.tile}"/>`,
      `<path d="${area}" fill="${hue}" fill-opacity="0.3"/>`,
      `<path d="${curve}" fill="none" stroke="${hue}" stroke-width="2" stroke-linejoin="round"/>`,
      `<text x="${r2(labelX)}" y="${baseY + 3}" class="gb-mono" font-size="${label.size}" fill="${theme.textSecondary}">${escapeXml(label.text)}</text>`,
    );
  }

  // Year ticks under the FRONT ridge's baseline at its year x-positions.
  const ticks = years
    .map((y, j) => {
      const tx = X_PAD + (years.length > 1 ? j * step : ridgeW / 2);
      return `<text x="${r2(tx)}" y="${h - 6}" text-anchor="middle" class="gb-mono" font-size="12" fill="${theme.textMuted}">${escapeXml(y)}</text>`;
    })
    .join('');

  return parts.join('') + ticks;
}
