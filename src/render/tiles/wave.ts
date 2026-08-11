import type { Theme } from '../../types.js';
import { escapeXml } from '../util.js';

export interface WavePoint {
  label: string;
  count: number;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Open cubic path through the points using Fritsch–Carlson monotone tangents.
 * A Catmull-Rom-style spline overshoots between knots, which on a count chart
 * invents values that never happened; monotone tangents keep every segment
 * inside the y-range of its two endpoints.
 */
export function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M ${r2(pts[0].x)} ${r2(pts[0].y)}`;

  // Secant slopes between consecutive points.
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x));
  }

  // Tangent init: one-sided at the ends, secant average inside — but zero at
  // any local extremum (sign change or flat), which is what kills overshoot.
  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }

  // Monotonicity clamp: on each interval alpha = m[i]/d[i], beta = m[i+1]/d[i]
  // must stay ≤ 3 or the cubic bulges past its endpoints.
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const alpha = m[i] / d[i];
    const beta = m[i + 1] / d[i];
    if (alpha > 3) m[i] = 3 * d[i];
    if (beta > 3) m[i + 1] = 3 * d[i];
  }

  let path = `M ${r2(pts[0].x)} ${r2(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = pts[i + 1].x - pts[i].x;
    const c1x = pts[i].x + h / 3;
    const c1y = pts[i].y + (m[i] * h) / 3;
    const c2x = pts[i + 1].x - h / 3;
    const c2y = pts[i + 1].y - (m[i + 1] * h) / 3;
    path += ` C ${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(pts[i + 1].x)} ${r2(pts[i + 1].y)}`;
  }
  return path;
}

export interface WaveProps {
  w: number;
  h: number;
  points: WavePoint[];
  accent: string;
  gradId: string;
  theme: Theme;
  /** Extra hues for a horizontal ridge-style stroke gradient (left→right). */
  strokeStops?: string[];
  /** Faint horizontal gridlines at thirds, hyper-chart style. */
  gridlines?: boolean;
  emptyText?: string;
  /** Tick label every Nth point (default 2 — every other month). */
  tickEvery?: number;
}

const TOP_PAD = 12;
/** Room under the baseline for the 9px month tick letters. */
const TICK_BAND = 14;
const X_PAD = 6;

/**
 * Gradient area wave in local (0,0)-(w,h): monotone curve over an accent
 * fade-to-baseline fill, glow under the stroke, month tick letters every
 * other month, and a dot + count on the peak and last months.
 */
export function renderWave(p: WaveProps): string {
  const { w, h, points, accent, gradId, theme } = p;
  const n = points.length;
  const baseline = h - TICK_BAND;
  const baselineLine = `<line x1="0" y1="${baseline}" x2="${w}" y2="${baseline}" stroke="${theme.divider}" stroke-width="1"/>`;

  if (n < 2 || points.every((pt) => pt.count === 0)) {
    const msg = p.emptyText ?? 'no external merges in the last 12 months';
    return (
      baselineLine +
      `<text x="${r2(w / 2)}" y="${r2(baseline / 2)}" text-anchor="middle" class="gb-text" font-size="13" fill="${theme.textMuted}">${escapeXml(msg)}</text>`
    );
  }

  const max = Math.max(...points.map((pt) => pt.count));
  const step = n > 1 ? (w - 2 * X_PAD) / (n - 1) : 0;
  const pts = points.map((pt, i) => ({
    x: X_PAD + i * step,
    y: baseline - (pt.count / max) * (baseline - TOP_PAD),
  }));

  const curve = monotonePath(pts);
  const area = `${curve} L ${r2(pts[n - 1].x)} ${baseline} L ${r2(pts[0].x)} ${baseline} Z`;

  const gradient = `<linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.3"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient>`;
  // Optional ridge-style stroke: hues drift left→right like the reference.
  const stops = p.strokeStops ?? [];
  const strokeGrad =
    stops.length > 1
      ? `<linearGradient id="${gradId}-stroke" x1="0" y1="0" x2="1" y2="0">${stops
          .map(
            (c, i) =>
              `<stop offset="${r2(i / (stops.length - 1))}" stop-color="${escapeXml(c)}"/>`,
          )
          .join('')}</linearGradient>`
      : '';
  const strokePaint = stops.length > 1 ? `url(#${gradId}-stroke)` : accent;
  // Generous filter region so the blur is not clipped at the group bounds.
  const glowFilter = `<filter id="${gradId}-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter>`;
  const grid = p.gridlines
    ? [1 / 3, 2 / 3]
        .map((t) => {
          const gy = r2(TOP_PAD + (baseline - TOP_PAD) * t);
          return `<line x1="0" y1="${gy}" x2="${w}" y2="${gy}" stroke="${theme.divider}" stroke-width="1"/>`;
        })
        .join('')
    : '';

  const tickEvery = p.tickEvery ?? 2;
  const ticks = points
    .map((pt, i) =>
      i % tickEvery === 0
        ? `<text x="${r2(pts[i].x)}" y="${h - 2}" text-anchor="middle" class="gb-mono" font-size="9" fill="${theme.textMuted}">${escapeXml(pt.label)}</text>`
        : '',
    )
    .join('');

  const peakIdx = points.reduce((best, pt, i) => (pt.count > points[best].count ? i : best), 0);
  const marked = peakIdx === n - 1 ? [peakIdx] : [peakIdx, n - 1];
  const markers = marked
    .map((i) => {
      // Clamp the label centre so the count never clips at the tile edge.
      const tx = Math.min(w - 12, Math.max(12, pts[i].x));
      return (
        `<circle cx="${r2(pts[i].x)}" cy="${r2(pts[i].y)}" r="3.5" fill="${accent}" stroke="${theme.tile}" stroke-width="2"/>` +
        `<text x="${r2(tx)}" y="${r2(pts[i].y - 8)}" text-anchor="middle" class="gb-mono" font-size="10" fill="${theme.textPrimary}">${points[i].count}</text>`
      );
    })
    .join('');

  return (
    `<defs>${gradient}${strokeGrad}${glowFilter}</defs>` +
    grid +
    `<path d="${area}" fill="url(#${gradId})"/>` +
    baselineLine +
    `<g filter="url(#${gradId}-glow)"><path d="${curve}" fill="none" stroke="${strokePaint}" stroke-width="8" stroke-opacity="0.45" stroke-linecap="round"/></g>` +
    `<path d="${curve}" fill="none" stroke="${strokePaint}" stroke-width="2.5" stroke-linecap="round"/>` +
    ticks +
    markers
  );
}
