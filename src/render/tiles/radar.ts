import type { Theme } from '../../types.js';
import { iconByKey, renderIcon } from '../icons.js';
import { escapeXml, fitText } from '../util.js';

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
  /** Horizontal bounds labels must stay inside (tile-local x). */
  labelLeft: number;
  labelRight: number;
  languages: RadarLanguage[];
  theme: Theme;
}

export interface RadarLabelPos {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  cos: number;
  sin: number;
}

/** Labels sit 9px past the outer ring, at the spoke tip. */
const LABEL_GAP = 9;
/** Past this |cos| a spoke reads as sideways and its label anchors at the tip. */
const SIDE_COS = 0.35;

/**
 * Tip-side label placement: side spokes (|cos| > 0.35) anchor the text at the
 * tip growing away from the ring (dy +4); top/bottom spokes centre the text
 * above or below the vertex (dy -6 / +13). Exported so tests can prove every
 * label either grows outward from the ring or lives in the vertical band.
 */
export function radarLabelLayout(
  n: number,
  cx: number,
  cy: number,
  rMax: number,
): RadarLabelPos[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = r2(cx + (rMax + LABEL_GAP) * cos);
    const side = Math.abs(cos) > SIDE_COS;
    const anchor = side ? (cos > 0 ? 'start' : 'end') : 'middle';
    const dy = side ? 4 : sin < 0 ? -6 : 13;
    return { x, y: r2(cy + (rMax + LABEL_GAP) * sin + dy), anchor, cos, sin };
  });
}

/** Perceived luminance 0..1; used to keep dark brand colours readable. */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 1;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
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

  // Quiet neutral wash — the language dots carry the colour, not the shape.
  const glowFill = `<radialGradient id="gbr-fill" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${rMax}"><stop offset="0" stop-color="#ffffff" stop-opacity="0.05"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`;

  // Connecting lines in ink, no neon, no glow: the polygon is structure,
  // identity lives in the vertex dots.
  const stroke = `<path d="${shape}" fill="none" stroke="${theme.textSecondary}" stroke-width="1.5" stroke-opacity="0.8" stroke-linejoin="miter"/>`;

  // Colour notation: one large dot per vertex in the language's own colour,
  // with a tile-coloured ring so overlapping geometry never swallows it.
  const dots = pts
    .map((pt, i) => `<circle class="gbr-dot" cx="${pt.x}" cy="${pt.y}" r="5.5" fill="${escapeXml(langs[i].color)}" stroke="${theme.tile}" stroke-width="2"/>`)
    .join('');

  // Centre hub: the code glyph in a quiet ring, like the reference's diamond.
  const hubIcon = renderIcon({
    path: iconByKey('code-brackets'),
    size: 14,
    stroke: theme.textMuted,
    strokeWidth: 2,
  });

  const positions = radarLabelLayout(n, cx, cy, rMax);
  const labels = langs
    .map((lang, i) => {
      const pos = positions[i];
      // The name is colour-coded to its vertex dot; dark brand colours flip
      // to ink so they stay readable on the tile.
      const nameFill =
        luminance(lang.color) < 0.22 ? theme.textPrimary : escapeXml(lang.color);
      // Clamp the fitted text to the room its anchor leaves before the card
      // edge: side labels grow one way, centred labels split the room in two.
      const countW = (String(lang.repos).length + 1) * 9 * 0.62;
      const avail =
        pos.anchor === 'start'
          ? p.labelRight - pos.x
          : pos.anchor === 'end'
            ? pos.x - p.labelLeft
            : 2 * Math.min(pos.x - p.labelLeft, p.labelRight - pos.x);
      const name = fitText(lang.name, Math.max(34, avail - countW), [11, 10, 9], 0.55);
      // dx, not a space character: SVG whitespace collapsing eats a lone
      // space at a tspan boundary, gluing the count to the name.
      return `<text x="${pos.x}" y="${pos.y}" text-anchor="${pos.anchor}" class="gb-text-bold" font-size="${name.size}" fill="${nameFill}">${escapeXml(name.text)}<tspan class="gb-mono" font-size="9" dx="5" dy="-1" fill="${theme.textSecondary}">${lang.repos}</tspan></text>`;
    })
    .join('');

  return (
    `<defs>${glowFill}</defs>` +
    rings +
    spokes +
    `<path d="${shape}" fill="url(#gbr-fill)"/>` +
    stroke +
    `<circle cx="${cx}" cy="${cy}" r="11" fill="${theme.tile}" stroke="${theme.divider}" stroke-width="1"/>` +
    `<g transform="translate(${r2(cx - 7)}, ${r2(cy - 7)})">${hubIcon}</g>` +
    dots +
    labels
  );
}
