import type { Theme } from '../../types.js';
import { escapeXml } from '../util.js';

export interface ScatterPoint3 {
  /** All three normalized 0..1 by the caller. */
  x: number;
  y: number;
  z: number;
  /** Optional tiny label rendered just above the dot. */
  value?: string;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** z shear: one unit of depth pushes right by this fraction of the x unit. */
const KX = 0.55;
/** z drop: one unit of depth pushes down by this fraction of the y unit. */
const KY = 0.32;
/** Slack between the projected cube and the box edges. */
const PAD = 2;

/**
 * Axonometric projection of the unit cube into (0,0)-(box.w, box.h) with PAD
 * px slack on every side: x + KX·z spans [0, 1+KX] horizontally and
 * (1−y) + KY·z spans [0, 1+KY] vertically, so scaling each by the padded box
 * lands all 8 corners exactly inside. z=0 is FAR (upper-left), z=1 is NEAR
 * (lower-right). Affine, so cube edges project to straight lines.
 */
export function isoProject(
  x: number,
  y: number,
  z: number,
  box: { w: number; h: number },
): { sx: number; sy: number } {
  const ux = (box.w - 2 * PAD) / (1 + KX);
  const uy = (box.h - 2 * PAD) / (1 + KY);
  return {
    sx: PAD + (x + KX * z) * ux,
    sy: PAD + (1 - y + KY * z) * uy,
  };
}

/** Margins around the cube for axis labels, in local px. */
const ML = 24;
const MR = 30;
const MT = 10;
const MB = 14;

/**
 * Isometric 3D scatter in local (0,0)-(w,h): hairline grid box (floor, back
 * wall, left wall), axis tick labels, and one glowing dot per point with a
 * floor shadow. Points draw far-to-near so near dots overlap far ones.
 */
export function renderScatter3D(p: {
  w: number;
  h: number;
  points: ScatterPoint3[];
  xLabels: [string, string];
  yLabels: [string, string];
  zLabels: string[];
  accent: string;
  gradId: string;
  theme: Theme;
}): string {
  const { w, h, points, accent, gradId, theme } = p;

  if (points.length === 0) {
    return `<text x="${r2(w / 2)}" y="${r2(h / 2)}" text-anchor="middle" class="gb-text" font-size="13" fill="${theme.textMuted}">no reviews yet</text>`;
  }

  const box = { w: w - ML - MR, h: h - MT - MB };
  const pr = (x: number, y: number, z: number): { sx: number; sy: number } => {
    const { sx, sy } = isoProject(x, y, z, box);
    return { sx: r2(sx + ML), sy: r2(sy + MT) };
  };

  const line = (a: [number, number, number], b: [number, number, number]): string => {
    const p1 = pr(...a);
    const p2 = pr(...b);
    return `<line x1="${p1.sx}" y1="${p1.sy}" x2="${p2.sx}" y2="${p2.sy}" stroke="${theme.divider}" stroke-width="1"/>`;
  };

  // Grid box: floor (y=0), back wall (z=0), left wall (x=0). For each face,
  // lines at t = 0, 1/3, 2/3, 1 in both directions: the t=0/1 lines are the
  // quad outline, the thirds are the 2 interior gridlines. No fills.
  const grid: string[] = [];
  for (const t of [0, 1 / 3, 2 / 3, 1]) {
    grid.push(
      line([t, 0, 0], [t, 0, 1]),
      line([0, 0, t], [1, 0, t]), // floor
      line([t, 0, 0], [t, 1, 0]),
      line([0, t, 0], [1, t, 0]), // back wall
      line([0, t, 0], [0, t, 1]),
      line([0, 0, t], [0, 1, t]), // left wall
    );
  }
  // Complete the cube outline: the remaining top/right/near edges, so every
  // point is visually INSIDE the frame (without these, a near high dot looks
  // like it escaped the chart).
  grid.push(
    line([1, 1, 0], [1, 1, 1]),
    line([0, 1, 1], [1, 1, 1]),
    line([1, 0, 1], [1, 1, 1]),
    line([0, 1, 1], [0, 0, 1]),
    line([1, 0, 1], [1, 0, 0]),
    line([0, 0, 1], [1, 0, 1]),
    line([1, 1, 0], [1, 0, 0]),
    line([0, 1, 1], [0, 1, 0]),
  );

  const labels: string[] = [];
  // z ticks (years) along the LEFT floor edge (x=0), anchored away from the
  // cube — the right side belongs to near/high dots and the x-max label.
  const zn = p.zLabels.length;
  p.zLabels.forEach((lb, i) => {
    const pt = pr(0, 0, zn > 1 ? i / (zn - 1) : 0.5);
    labels.push(
      `<text x="${r2(pt.sx - 6)}" y="${r2(pt.sy + 8)}" text-anchor="end" class="gb-mono" font-size="8" fill="${theme.textMuted}">${escapeXml(lb)}</text>`,
    );
  });
  // x labels (min/max) under the two ends of the front floor edge (z=1).
  ([0, 1] as const).forEach((x, i) => {
    const pt = pr(x, 0, 1);
    labels.push(
      `<text x="${pt.sx}" y="${r2(pt.sy + 12)}" text-anchor="${x === 0 ? 'middle' : 'end'}" class="gb-mono" font-size="8" fill="${theme.textMuted}">${escapeXml(p.xLabels[i])}</text>`,
    );
  });
  // y labels (0/max) beside the BACK-left vertical edge (x=0, z=0), which is
  // the top-left of the projection — clear of the year ticks below.
  ([0, 1] as const).forEach((y, i) => {
    const pt = pr(0, y, 0);
    labels.push(
      `<text x="${r2(pt.sx - 6)}" y="${r2(pt.sy - 2)}" text-anchor="end" class="gb-mono" font-size="8" fill="${theme.textMuted}">${escapeXml(p.yLabels[i])}</text>`,
    );
  });

  // Padded region so the 3px blur is not clipped at the tiny circle bounds.
  const glowFilter = `<filter id="${gradId}-glow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="3"/></filter>`;

  // Far-to-near: z=1 projects lower-right (nearest), so ascending z draws far
  // dots first and the nearest last, on top.
  const dots = [...points]
    .sort((a, b) => a.z - b.z || a.x - b.x)
    .map((pt) => {
      const dot = pr(pt.x, pt.y, pt.z);
      const shadow = pr(pt.x, 0, pt.z);
      return (
        `<ellipse cx="${shadow.sx}" cy="${shadow.sy}" rx="6" ry="2.5" fill="${accent}" fill-opacity="0.12"/>` +
        `<circle cx="${dot.sx}" cy="${dot.sy}" r="6" fill="${accent}" opacity="0.5" filter="url(#${gradId}-glow)"/>` +
        `<circle cx="${dot.sx}" cy="${dot.sy}" r="3.5" fill="${accent}" stroke="${theme.tile}" stroke-width="1.5"/>` +
        (pt.value
          ? `<text x="${dot.sx}" y="${r2(dot.sy - 8)}" text-anchor="middle" class="gb-mono" font-size="9" fill="${theme.textSecondary}">${escapeXml(pt.value)}</text>`
          : '')
      );
    })
    .join('');

  return `<defs>${glowFilter}</defs>` + grid.join('') + labels.join('') + dots;
}
