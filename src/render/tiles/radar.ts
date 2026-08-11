import type { Theme } from '../../types.js';
import { escapeXml, fitText, r2 } from '../util.js';

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

export interface RadarProps {
  /** Chart zone in tile-local coordinates. */
  cx: number;
  cy: number;
  rMax: number;
  /** Horizontal bounds labels must stay inside (tile-local x). */
  labelLeft: number;
  labelRight: number;
  /** Total language count, shown in the burst's centre hub. */
  count: number;
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

/** Labels sit 12px past the outer ring, at the spoke tip. */
const LABEL_GAP = 12;
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
    const dy = side ? 5 : sin < 0 ? -8 : 16;
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
 * Radial burst, reference style: one ray per language in its own colour,
 * length = projects using it, glowing softly, with the total in a centre
 * hub. Thin muted filler ticks between the data rays give the burst its
 * density; uniform length and hairline weight keep them reading as
 * structure, never data.
 * Caller guarantees RADAR_MIN_AXES ≤ languages.length ≤ RADAR_MAX_AXES.
 */
export function renderBurst(p: RadarProps): string {
  const { cx, cy, rMax, theme } = p;
  const langs = p.languages;
  const n = langs.length;
  const HUB_R = 20;

  const tips = radarLayout(langs.map((l) => l.repos), cx, cy, HUB_R + 14, rMax);

  // Filler ticks: two hairlines between each pair of data rays, uniform
  // length — radial grid texture, clearly not data.
  const fillers: string[] = [];
  for (let i = 0; i < n; i++) {
    for (const f of [1 / 3, 2 / 3]) {
      const angle = -Math.PI / 2 + ((i + f) * 2 * Math.PI) / n;
      const x1 = r2(cx + (HUB_R + 8) * Math.cos(angle));
      const y1 = r2(cy + (HUB_R + 8) * Math.sin(angle));
      const x2 = r2(cx + rMax * 0.85 * Math.cos(angle));
      const y2 = r2(cy + rMax * 0.85 * Math.sin(angle));
      fillers.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${theme.divider}" stroke-width="1"/>`);
    }
  }

  // Padded region so the blur is not clipped at the thin ray bounds.
  const glowFilter = `<filter id="gbr-ray-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3"/></filter>`;

  const rayStart = (i: number): Pt => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      x: r2(cx + (HUB_R + 6) * Math.cos(angle)),
      y: r2(cy + (HUB_R + 6) * Math.sin(angle)),
    };
  };
  const glow = langs
    .map((lang, i) => {
      const a = rayStart(i);
      const b = tips[i];
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${escapeXml(lang.color)}" stroke-width="9" stroke-linecap="round" stroke-opacity="0.35"/>`;
    })
    .join('');
  const rays = langs
    .map((lang, i) => {
      const a = rayStart(i);
      const b = tips[i];
      return `<line class="gbr-ray" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${escapeXml(lang.color)}" stroke-width="5" stroke-linecap="round"/>`;
    })
    .join('');

  const positions = radarLabelLayout(n, cx, cy, rMax);
  const labels = langs
    .map((lang, i) => {
      const pos = positions[i];
      // The name is colour-coded to its ray; dark brand colours flip to ink
      // so they stay readable on the tile.
      const nameFill =
        luminance(lang.color) < 0.22 ? theme.textPrimary : escapeXml(lang.color);
      const countW = (String(lang.repos).length + 1) * 13 * 0.62;
      const avail =
        pos.anchor === 'start'
          ? p.labelRight - pos.x
          : pos.anchor === 'end'
            ? pos.x - p.labelLeft
            : 2 * Math.min(pos.x - p.labelLeft, p.labelRight - pos.x);
      const name = fitText(lang.name, Math.max(40, avail - countW), [16, 15, 13], 0.55);
      // dx, not a space character: SVG whitespace collapsing eats a lone
      // space at a tspan boundary, gluing the count to the name.
      return `<text x="${pos.x}" y="${pos.y}" text-anchor="${pos.anchor}" class="gb-text-bold" font-size="${name.size}" fill="${nameFill}">${escapeXml(name.text)}<tspan class="gb-mono" font-size="13" dx="6" dy="-1" fill="${theme.textSecondary}">${lang.repos}</tspan></text>`;
    })
    .join('');

  // Centre hub: the total, reference style.
  const hub =
    `<circle cx="${cx}" cy="${cy}" r="${HUB_R}" fill="${theme.tile}" stroke="${theme.divider}" stroke-width="1"/>` +
    `<text x="${cx}" y="${cy + 6}" text-anchor="middle" class="gb-mono" font-size="17" fill="${theme.textPrimary}">${p.count}</text>`;

  return (
    `<defs>${glowFilter}</defs>` +
    fillers.join('') +
    `<g filter="url(#gbr-ray-glow)">${glow}</g>` +
    rays +
    hub +
    labels
  );
}
