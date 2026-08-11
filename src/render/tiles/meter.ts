import type { Theme } from '../../types.js';
import { escapeXml } from '../util.js';

const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * SVG arc segment on the circle at (cx, cy) radius r, from angle a0 to a1
 * (radians, a0 < a1), sweeping clockwise in screen coordinates. Spans over
 * half a turn set the large-arc flag.
 */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
): string {
  const x0 = r2(cx + r * Math.cos(a0));
  const y0 = r2(cy + r * Math.sin(a0));
  const x1 = r2(cx + r * Math.cos(a1));
  const y1 = r2(cy + r * Math.sin(a1));
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/**
 * Meter rule: the track is a dark step of the SAME hue as the fill, never
 * gray — the ramp stays one colour story.
 */
const TRACK_STEP: Record<string, string> = {
  '#199e70': '#0e3524',
  '#3987e5': '#132c49',
};

function trackColor(accent: string): string {
  const known = TRACK_STEP[accent.toLowerCase()];
  if (known) return known;
  // ponytail: fallback darkens the accent by scaling channels to ~1/3; add an
  // exact hand-picked step to TRACK_STEP if a new accent ever feeds a meter.
  const m = /^#?([0-9a-f]{6})$/i.exec(accent);
  if (!m) return '#0e3524';
  const v = parseInt(m[1], 16);
  const step = (c: number) =>
    Math.round(c * 0.33)
      .toString(16)
      .padStart(2, '0');
  return `#${step((v >> 16) & 255)}${step((v >> 8) & 255)}${step(v & 255)}`;
}

/**
 * 180° arc meter: a semicircle from 180° to 360° (left to right over the
 * top). Full-sweep track in the dark step of the accent hue, pct of the
 * sweep filled in the accent with a soft glow, and a two-line centre label.
 */
export function renderMeter(p: {
  cx: number;
  cy: number;
  r: number;
  pct: number;
  centerTop: string;
  centerBottom: string;
  accent: string;
  theme: Theme;
}): string {
  const { cx, cy, r, accent, theme } = p;
  const pct = Math.min(100, Math.max(0, p.pct));
  const a0 = Math.PI;
  const track = arcPath(cx, cy, r, a0, 2 * Math.PI);
  const fillArc = pct > 0 ? arcPath(cx, cy, r, a0, a0 + (pct / 100) * Math.PI) : '';

  // Generous filter region so the blur is not clipped at the group bounds.
  const glowFilter = `<filter id="gbm-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter>`;

  const fill = fillArc
    ? `<g filter="url(#gbm-glow)"><path d="${fillArc}" fill="none" stroke="${accent}" stroke-width="14" stroke-opacity="0.4" stroke-linecap="round"/></g>` +
      `<path d="${fillArc}" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>`
    : '';

  return (
    `<defs>${glowFilter}</defs>` +
    `<path d="${track}" fill="none" stroke="${trackColor(accent)}" stroke-width="10" stroke-linecap="round"/>` +
    fill +
    `<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="gb-display" font-size="24" fill="${theme.textPrimary}">${escapeXml(p.centerTop)}</text>` +
    `<text x="${cx}" y="${cy + 16}" text-anchor="middle" class="gb-text" font-size="11" fill="${theme.textMuted}">${escapeXml(p.centerBottom)}</text>`
  );
}
