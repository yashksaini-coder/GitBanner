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
 * Straight-edged closed polygon through the points. Straight chords between
 * points that all satisfy r ≤ rMax can never leave the outer ring — unlike a
 * smoothing spline, whose curve overshoots between knots.
 */
export function polygonPath(pts: Pt[]): string {
  return (
    `M ${pts[0].x} ${pts[0].y} ` +
    pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ') +
    ' Z'
  );
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
 * The signature chart: a sharp closed polygon in the accent colour over
 * recessive polar grid rings, with a soft glow. Language identity is notation,
 * not stroke paint: a coloured dot sits on each vertex, ringed in the tile
 * colour so it stays legible where the shape crosses itself.
 * Caller guarantees RADAR_MIN_AXES ≤ languages.length ≤ RADAR_MAX_AXES.
 */
export function renderRadar(p: RadarProps): string {
  const { cx, cy, rMax, theme } = p;
  const langs = p.languages;
  const n = langs.length;
  const rMin = 10;
  const accent = theme.accents.languages;

  const pts = radarLayout(langs.map((l) => l.repos), cx, cy, rMin, rMax);
  const shape = polygonPath(pts);

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

  const glowFill = `<radialGradient id="gbr-fill" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${rMax}"><stop offset="0" stop-color="${accent}" stop-opacity="0.14"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>`;
  // Generous filter region so the blur is not clipped at the group bounds.
  const glowFilter = `<filter id="gbr-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter>`;

  const glow = `<path d="${shape}" fill="none" stroke="${accent}" stroke-width="8" stroke-linejoin="miter" stroke-opacity="0.45"/>`;
  const stroke = `<path d="${shape}" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linejoin="miter"/>`;

  // Colour notation: one dot per vertex in the language's own colour, with a
  // tile-coloured ring so overlapping geometry never swallows it.
  const dots = pts
    .map((pt, i) => `<circle class="gbr-dot" cx="${pt.x}" cy="${pt.y}" r="3.5" fill="${escapeXml(langs[i].color)}" stroke="${theme.tile}" stroke-width="2"/>`)
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
    `<defs>${glowFill}${glowFilter}</defs>` +
    rings +
    spokes +
    `<path d="${shape}" fill="url(#gbr-fill)"/>` +
    `<g filter="url(#gbr-glow)">${glow}</g>` +
    stroke +
    `<circle cx="${cx}" cy="${cy}" r="11" fill="${theme.tile}" stroke="${theme.divider}" stroke-width="1"/>` +
    `<g transform="translate(${r2(cx - 7)}, ${r2(cy - 7)})">${hubIcon}</g>` +
    dots +
    labels
  );
}
