import type { Theme } from '../../types.js';
import { escapeXml } from '../util.js';

export interface AxialHex {
  q: number;
  r: number;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;
const SQRT3 = Math.sqrt(3);

/** Axial neighbour directions, pointy-top, ring-walk order. */
const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

/**
 * Axial hex coordinates in deterministic spiral order: the centre cell, then
 * each ring outward. Ring k has 6k cells and starts at direction 4 scaled by
 * k, walking k steps along each of the six sides.
 */
export function hexSpiral(n: number): AxialHex[] {
  const count = Math.min(n, 200);
  const out: AxialHex[] = [];
  if (count <= 0) return out;
  out.push({ q: 0, r: 0 });
  for (let k = 1; out.length < count; k++) {
    let q = DIRS[4][0] * k;
    let r = DIRS[4][1] * k;
    for (let side = 0; side < 6 && out.length < count; side++) {
      for (let step = 0; step < k && out.length < count; step++) {
        out.push({ q, r });
        q += DIRS[side][0];
        r += DIRS[side][1];
      }
    }
  }
  return out;
}

/**
 * Heat ramp, reference style: cool dark slate → ember red → gold core.
 * A multi-hue sequential ramp is legal only as semantic heat WITH a scale
 * legend — renderHexCluster always draws one.
 */
const HEAT_STOPS: readonly (readonly [number, number, number])[] = [
  [0x25, 0x2b, 0x45], // low: dark slate
  [0xc9, 0x3a, 0x3a], // mid: ember red
  [0xf2, 0xc1, 0x4e], // high: gold
];

/**
 * Piecewise-linear RGB over the heat stops, t = ln(1+v)/ln(1+max).
 * Log scale because the external-PR distribution is heavily skewed: a linear
 * ramp would leave every hex but the centre at the cold end.
 */
export function intensityColor(v: number, max: number): string {
  const t = max > 0 ? Math.log(1 + Math.max(0, v)) / Math.log(1 + max) : 0;
  const seg = Math.min(HEAT_STOPS.length - 2, Math.floor(t * (HEAT_STOPS.length - 1)));
  const local = t * (HEAT_STOPS.length - 1) - seg;
  const from = HEAT_STOPS[seg];
  const to = HEAT_STOPS[seg + 1];
  const channels = from.map((c, i) =>
    Math.round(c + local * (to[i] - c))
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${channels.join('')}`;
}

/** Pixel centre of an axial cell for pointy-top hexes of the given radius. */
function cellCenter(c: AxialHex, size: number): { x: number; y: number } {
  return { x: size * SQRT3 * (c.q + c.r / 2), y: size * 1.5 * c.r };
}

function bbox(cells: AxialHex[], size: number) {
  const hw = (size * SQRT3) / 2; // pointy-top: half-width √3/2·size, half-height size
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of cells) {
    const { x, y } = cellCenter(c, size);
    if (x - hw < minX) minX = x - hw;
    if (x + hw > maxX) maxX = x + hw;
    if (y - size < minY) minY = y - size;
    if (y + size > maxY) maxY = y + size;
  }
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}

/** Pointy-top hexagon corner list around (cx, cy). */
function hexPoints(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = ((60 * i - 30) * Math.PI) / 180;
    pts.push(`${r2(cx + size * Math.cos(a))},${r2(cy + size * Math.sin(a))}`);
  }
  return pts.join(' ');
}

/**
 * One pointy-top hex per value, spiralling out from the centre — the caller
 * passes values sorted descending, so the strongest value sits at the centre
 * and intensity fades outward. Fill is the single-hue log-scaled blue ramp;
 * a hairline black stroke is the surface gap between cells. Draws centred in
 * a local (0,0)-(w,h) zone.
 */
export function renderHexCluster(p: {
  w: number;
  h: number;
  values: number[];
  theme: Theme;
  /** Unique id prefix for the legend gradient. */
  gradId: string;
}): string {
  const { w, h, values, theme } = p;
  if (values.length === 0) return '';
  const cells = hexSpiral(values.length);

  // Largest integer hex radius (≥5) whose spiral bounding box fits the zone —
  // same brute-force fit loop as the language pills: try big, shrink until it fits.
  let size = 5;
  for (let s = Math.floor(Math.min(w, h) / 2); s >= 5; s--) {
    const b = bbox(cells, s);
    if (b.w <= w && b.h <= h) {
      size = s;
      break;
    }
  }

  const b = bbox(cells, size);
  const ox = w / 2 - (b.minX + b.maxX) / 2;
  const oy = h / 2 - (b.minY + b.maxY) / 2;
  const max = Math.max(...values);

  const hexes = cells
    .map((c, i) => {
      const { x, y } = cellCenter(c, size);
      return `<polygon points="${hexPoints(x + ox, y + oy, size)}" fill="${intensityColor(values[i], max)}" stroke="#000000" stroke-opacity="0.6" stroke-width="1"/>`;
    })
    .join('');

  // The scale legend that licenses the multi-hue heat ramp: a small gradient
  // strip with the min and max values, bottom-right of the zone.
  const lw = 56;
  const lx = w - lw - 30;
  const ly = h - 10;
  const min = Math.min(...values);
  const legendGrad = `<linearGradient id="${escapeXml(p.gradId)}-legend" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${intensityColor(min, max)}"/><stop offset="0.5" stop-color="${intensityColor(Math.exp(Math.log(1 + max) / 2) - 1, max)}"/><stop offset="1" stop-color="${intensityColor(max, max)}"/></linearGradient>`;
  const legend =
    `<defs>${legendGrad}</defs>` +
    `<text x="${r2(lx - 6)}" y="${ly + 3}" text-anchor="end" class="gb-mono" font-size="9" fill="${theme.textMuted}">${min}</text>` +
    `<rect x="${lx}" y="${ly - 6}" width="${lw}" height="7" rx="3.5" fill="url(#${escapeXml(p.gradId)}-legend)"/>` +
    `<text x="${r2(lx + lw + 6)}" y="${ly + 3}" class="gb-mono" font-size="9" fill="${theme.textMuted}">${max}</text>`;

  return hexes + legend;
}
