import type { Theme } from '../../types.js';
import { iconByKey, renderIcon } from '../icons.js';
import { escapeXml, truncate } from '../util.js';

export interface RadarLanguage {
  name: string;
  color: string;
  repos: number;
}

/** A radar needs at least this many axes to be a shape rather than a line. */
export const RADAR_MIN_AXES = 3;
/** Past this the labels collide and the polygon turns into noise. */
export const RADAR_MAX_AXES = 8;

interface Pt {
  x: number;
  y: number;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Place one point per value on spokes around (cx, cy). The first spoke points
 * straight up and the rest proceed clockwise. Radii scale linearly between
 * rMin and rMax against the largest value, with a floor so small values stay
 * visibly off the hub instead of collapsing into the centre.
 */
export function radarLayout(
  values: number[],
  cx: number,
  cy: number,
  rMin: number,
  rMax: number,
): Pt[] {
  const max = Math.max(1, ...values);
  const floor = 0.18;
  return values.map((v, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / values.length;
    const t = Math.max(floor, v / max);
    const r = rMin + t * (rMax - rMin);
    return { x: r2(cx + r * Math.cos(angle)), y: r2(cy + r * Math.sin(angle)) };
  });
}

/**
 * Closed Catmull-Rom spline through the points, returned as one cubic Bézier
 * path per segment (P_i → P_{i+1}). Segments share endpoints exactly, so each
 * can carry its own gradient while the joined curve stays seamless.
 */
export function closedSegments(pts: Pt[]): string[] {
  const n = pts.length;
  const at = (i: number): Pt => pts[((i % n) + n) % n];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = { x: r2(p1.x + (p2.x - p0.x) / 6), y: r2(p1.y + (p2.y - p0.y) / 6) };
    const c2 = { x: r2(p2.x - (p3.x - p1.x) / 6), y: r2(p2.y - (p3.y - p1.y) / 6) };
    out.push(`M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`);
  }
  return out;
}

export interface RadarProps {
  /** Chart zone in tile-local coordinates. */
  cx: number;
  cy: number;
  rMax: number;
  languages: RadarLanguage[];
  theme: Theme;
}

/**
 * The signature chart: one smooth closed curve whose stroke interpolates
 * through each language's own colour at its spoke, over recessive polar grid
 * rings, with a soft glow so the curve reads as the tile's light source.
 * Caller guarantees RADAR_MIN_AXES ≤ languages.length ≤ RADAR_MAX_AXES.
 */
export function renderRadar(p: RadarProps): string {
  const { cx, cy, rMax, theme } = p;
  const langs = p.languages;
  const n = langs.length;
  const rMin = 10;

  const pts = radarLayout(langs.map((l) => l.repos), cx, cy, rMin, rMax);
  const segments = closedSegments(pts);

  // Grid: three rings plus one hairline spoke per axis.
  const rings = [1 / 3, 2 / 3, 1]
    .map((t) => `<circle cx="${cx}" cy="${cy}" r="${r2(rMax * t)}" fill="none" stroke="${theme.divider}" stroke-width="1"/>`)
    .join('');
  const spokes = langs
    .map((_, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return `<line x1="${cx}" y1="${cy}" x2="${r2(cx + rMax * Math.cos(angle))}" y2="${r2(cy + rMax * Math.sin(angle))}" stroke="${theme.divider}" stroke-width="1"/>`;
    })
    .join('');

  // One gradient per segment: this language's colour to the next one's, in
  // user space along the chord, so the hue arrives exactly at each spoke.
  const defs = segments
    .map((_, i) => {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const from = escapeXml(langs[i].color);
      const to = escapeXml(langs[(i + 1) % n].color);
      return `<linearGradient id="gbr-seg-${i}" gradientUnits="userSpaceOnUse" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;
    })
    .join('');
  const dominant = escapeXml(langs[0].color);
  const glowFill = `<radialGradient id="gbr-fill" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${rMax}"><stop offset="0" stop-color="${dominant}" stop-opacity="0.16"/><stop offset="1" stop-color="${dominant}" stop-opacity="0"/></radialGradient>`;
  // Generous filter region so the blur is not clipped at the group bounds.
  const glowFilter = `<filter id="gbr-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4.5"/></filter>`;

  const fillPath = `M ${pts[0].x} ${pts[0].y} ${segments
    .map((s) => s.slice(s.indexOf('C')))
    .join(' ')} Z`;

  const glow = segments
    .map((d, i) => `<path d="${d}" fill="none" stroke="url(#gbr-seg-${i})" stroke-width="9" stroke-linecap="round" stroke-opacity="0.5"/>`)
    .join('');
  const stroke = segments
    .map((d, i) => `<path d="${d}" fill="none" stroke="url(#gbr-seg-${i})" stroke-width="2.5" stroke-linecap="round"/>`)
    .join('');

  // Centre hub: the code glyph in a quiet ring, like the reference's diamond.
  const hubIcon = renderIcon({
    path: iconByKey('code-brackets'),
    size: 14,
    stroke: theme.textMuted,
    strokeWidth: 2,
  });

  const labels = langs
    .map((lang, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const lx = r2(cx + (rMax + 9) * cos);
      const ly = r2(cy + (rMax + 9) * sin);
      const anchor = cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle';
      const dy = sin > 0.35 ? 11 : sin < -0.35 ? -4 : 4;
      const name = truncate(lang.name, 9);
      return `<text x="${lx}" y="${ly + dy}" text-anchor="${anchor}" class="gb-text" font-size="10" fill="${theme.textSecondary}">${escapeXml(name)} <tspan class="gb-mono" font-size="9" fill="${theme.textMuted}">${lang.repos}</tspan></text>`;
    })
    .join('');

  return (
    `<defs>${defs}${glowFill}${glowFilter}</defs>` +
    rings +
    spokes +
    `<path d="${fillPath}" fill="url(#gbr-fill)"/>` +
    `<g filter="url(#gbr-glow)">${glow}</g>` +
    stroke +
    `<circle cx="${cx}" cy="${cy}" r="11" fill="${theme.tile}" stroke="${theme.divider}" stroke-width="1"/>` +
    `<g transform="translate(${r2(cx - 7)}, ${r2(cy - 7)})">${hubIcon}</g>` +
    labels
  );
}
