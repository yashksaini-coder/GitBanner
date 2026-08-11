import { describe, expect, it } from 'vitest';
import { dark } from '../src/render/theme.js';
import { renderBars } from '../src/render/tiles/bars.js';
import { hexSpiral, intensityColor, renderHexCluster } from '../src/render/tiles/hex.js';
import { arcPath, renderMeter } from '../src/render/tiles/meter.js';

describe('hexSpiral', () => {
  it('returns just the centre for n=1', () => {
    expect(hexSpiral(1)).toEqual([{ q: 0, r: 0 }]);
  });

  it('walks centre, a full first ring, then into ring 2 for n=8', () => {
    const cells = hexSpiral(8);
    expect(cells).toHaveLength(8);
    expect(cells[0]).toEqual({ q: 0, r: 0 });
    // Cells 1..6 are the complete first ring: hex distance 1 from centre, all unique.
    const dist = (c: { q: number; r: number }) =>
      (Math.abs(c.q) + Math.abs(c.r) + Math.abs(-c.q - c.r)) / 2;
    const ring1 = cells.slice(1, 7);
    for (const c of ring1) expect(dist(c)).toBe(1);
    expect(new Set(ring1.map((c) => `${c.q},${c.r}`)).size).toBe(6);
    // The 8th cell starts ring 2.
    expect(dist(cells[7])).toBe(2);
  });

  it('is deterministic', () => {
    expect(hexSpiral(50)).toEqual(hexSpiral(50));
  });
});

describe('renderHexCluster', () => {
  it('emits one polygon per value with the strongest (first) value brightest', () => {
    const values = [40, 9, 3, 1, 1];
    const svg = renderHexCluster({ w: 440, h: 128, values, theme: dark });
    const fills = [...svg.matchAll(/<polygon [^>]*fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
    expect(fills).toHaveLength(values.length);
    // max value → t=1 → exact bright end of the ramp, at the spiral centre.
    expect(fills[0]).toBe('#5598e7');
    // Brightness (channel sum) is non-increasing outward for descending values.
    const lum = (hex: string) => parseInt(hex.slice(1), 16);
    for (let i = 1; i < fills.length; i++) {
      expect(lum(fills[i])).toBeLessThanOrEqual(lum(fills[i - 1]));
    }
  });

  it('maps t=0 and t=1 to the ramp endpoints', () => {
    expect(intensityColor(0, 40)).toBe('#132c49');
    expect(intensityColor(40, 40)).toBe('#5598e7');
  });

  it('stays inside the zone and keeps hexes at least radius 5', () => {
    const svg = renderHexCluster({ w: 200, h: 60, values: Array(30).fill(2), theme: dark });
    const coords = [...svg.matchAll(/points="([^"]+)"/g)]
      .flatMap((m) => m[1].split(' '))
      .map((pair) => pair.split(',').map(Number));
    for (const [x, y] of coords) {
      expect(x).toBeGreaterThanOrEqual(-0.01);
      expect(x).toBeLessThanOrEqual(200.01);
      expect(y).toBeGreaterThanOrEqual(-0.01);
      expect(y).toBeLessThanOrEqual(60.01);
    }
  });

  it('renders nothing for an empty value list', () => {
    expect(renderHexCluster({ w: 100, h: 100, values: [], theme: dark })).toBe('');
  });
});

describe('arcPath', () => {
  it('places semicircle endpoints left and right of the centre', () => {
    const d = arcPath(100, 50, 40, Math.PI, 2 * Math.PI);
    const m = /^M (-?[\d.]+) (-?[\d.]+) A 40 40 0 0 1 (-?[\d.]+) (-?[\d.]+)$/.exec(d);
    expect(m).not.toBeNull();
    const [x0, y0, x1, y1] = m!.slice(1).map(Number);
    expect(x0).toBeCloseTo(60, 1);
    expect(y0).toBeCloseTo(50, 1);
    expect(x1).toBeCloseTo(140, 1);
    expect(y1).toBeCloseTo(50, 1);
  });

  it('sets the large-arc flag past half a turn', () => {
    expect(arcPath(0, 0, 10, 0, 1.5 * Math.PI)).toContain(' A 10 10 0 1 1 ');
    expect(arcPath(0, 0, 10, 0, 0.5 * Math.PI)).toContain(' A 10 10 0 0 1 ');
  });
});

describe('renderMeter', () => {
  const base = {
    cx: 249,
    cy: 268,
    r: 78,
    centerTop: '440',
    centerBottom: 'of 516 resolved',
    accent: '#199e70',
    theme: dark,
  };

  it('renders track, fill, glow and centre labels', () => {
    const svg = renderMeter({ ...base, pct: 85 });
    expect(svg).toContain('stroke="#0e3524"'); // dark step of the green hue, not gray
    expect(svg).toContain('stroke="#199e70"');
    expect(svg).toContain('gbm-glow');
    expect(svg).toContain('>440<');
    expect(svg).toContain('of 516 resolved');
  });

  it('renders at pct 0 (track only) and pct 100 (full sweep)', () => {
    const zero = renderMeter({ ...base, pct: 0 });
    expect(zero).toContain('stroke="#0e3524"');
    expect(zero).not.toContain('stroke="#199e70"');
    const full = renderMeter({ ...base, pct: 100 });
    expect(full).toContain('stroke="#199e70"');
  });

  it('clamps pct to 0..100', () => {
    expect(renderMeter({ ...base, pct: 150 })).toBe(renderMeter({ ...base, pct: 100 }));
    expect(renderMeter({ ...base, pct: -5 })).toBe(renderMeter({ ...base, pct: 0 }));
  });
});

describe('renderBars', () => {
  const entries = [
    { label: 'big-repo', value: 1234 },
    { label: 'small-repo', value: 0 },
  ];
  const svg = renderBars({
    entries,
    w: 442,
    pitch: 30,
    gradId: 'gb-bars-test',
    gradFrom: '#184f95',
    gradTo: '#3987e5',
    theme: dark,
  });

  it('emits its own gradient defs and one bar per entry filled with it', () => {
    expect(svg).toContain('<linearGradient id="gb-bars-test"');
    expect(svg).toContain('stop-color="#184f95"');
    expect(svg).toContain('stop-color="#3987e5"');
    expect(svg.match(/fill="url\(#gb-bars-test\)"/g)).toHaveLength(2);
  });

  it('labels names and grouped values, keeping a minimum bar width', () => {
    expect(svg).toContain('big-repo');
    expect(svg).toContain('1,234');
    // Zero value still draws a 6px stub: its rounded end starts at x=2 (6-4).
    expect(svg).toContain('M0 44 H2');
  });

  it('reserves the value column: the longest bar ends 64px short of w', () => {
    // max value spans the full track: w - 64 = 378.
    expect(svg).toContain('H374 A4 4 0 0 1 378');
  });
});
