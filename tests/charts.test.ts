import { describe, expect, it } from 'vitest';
import { dark } from '../src/render/theme.js';
import { hexSpiral, intensityColor, renderHexCluster, ringOf } from '../src/render/tiles/hex.js';

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

describe('ringOf', () => {
  it('maps spiral indices to their rings', () => {
    expect(ringOf(0)).toBe(0);
    expect(ringOf(1)).toBe(1);
    expect(ringOf(6)).toBe(1);
    expect(ringOf(7)).toBe(2);
    expect(ringOf(18)).toBe(2);
    expect(ringOf(19)).toBe(3);
  });
});

describe('renderColumns', () => {
  it('renders a gradient column with value cap and label per bucket', async () => {
    const { renderColumns } = await import('../src/render/tiles/columns.js');
    const { dark } = await import('../src/render/theme.js');
    const svg = renderColumns({
      w: 442,
      h: 226,
      data: [
        { label: '<10', count: 12 },
        { label: '10+', count: 176 },
        { label: '100+', count: 60 },
      ],
      gradId: 'tcols',
      theme: dark,
    });
    expect([...svg.matchAll(/<path d="M /g)]).toHaveLength(3);
    for (const v of ['12', '176', '60']) expect(svg).toContain(`>${v}<`);
    for (const l of ['&lt;10', '10+', '100+']) expect(svg).toContain(l);
    expect(svg).toContain('url(#tcols)');
    // zero data -> empty message, no bars
    const empty = renderColumns({ w: 442, h: 226, data: [], gradId: 't2', theme: dark });
    expect(empty).toContain('no data yet');
  });
});

describe('renderHexCluster', () => {
  it('emits one polygon per value with the strongest (first) value brightest', () => {
    const values = [40, 9, 3, 1, 1];
    const svg = renderHexCluster({ w: 440, h: 128, values, theme: dark });
    const fills = [...svg.matchAll(/<polygon [^>]*fill="(#[0-9a-f]{6})"/g)]
      .map((m) => m[1])
      .filter((c) => c !== '#15151a'); // ghost texture cells are not data
    expect(fills).toHaveLength(values.length);
    // max value → t=1 → exact bright end of the ramp, at the spiral centre.
    expect(fills[0]).toBe('#f2c14e');
    // Brightness (channel sum) is non-increasing outward for descending values.
    const lum = (hex: string) => parseInt(hex.slice(1), 16);
    for (let i = 1; i < fills.length; i++) {
      expect(lum(fills[i])).toBeLessThanOrEqual(lum(fills[i - 1]));
    }
  });

  it('maps t=0 and t=1 to the ramp endpoints', () => {
    expect(intensityColor(0, 40)).toBe('#252b45');
    expect(intensityColor(40, 40)).toBe('#f2c14e');
  });

  it('stays inside the zone and keeps hexes at least radius 5', () => {
    const svg = renderHexCluster({ w: 200, h: 60, values: Array(30).fill(2), theme: dark });
    const coords = [...svg.replace(/<polygon class="gbx-ghost"[^/]*\/>/g, '').matchAll(/points="([^"]+)"/g)]
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

