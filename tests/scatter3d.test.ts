import { describe, expect, it } from 'vitest';
import { dark } from '../src/render/theme.js';
import { isoProject, renderScatter3D } from '../src/render/tiles/scatter3d.js';
import type { ScatterPoint3 } from '../src/render/tiles/scatter3d.js';

const box = { w: 300, h: 160 };
const corners: [number, number, number][] = [0, 1].flatMap((x) =>
  [0, 1].flatMap((y) => [0, 1].map((z) => [x, y, z] as [number, number, number])),
);

describe('isoProject', () => {
  it('lands all 8 cube corners inside the box with 2px slack', () => {
    for (const [x, y, z] of corners) {
      const { sx, sy } = isoProject(x, y, z, box);
      expect(sx).toBeGreaterThanOrEqual(1.99);
      expect(sx).toBeLessThanOrEqual(box.w - 1.99);
      expect(sy).toBeGreaterThanOrEqual(1.99);
      expect(sy).toBeLessThanOrEqual(box.h - 1.99);
    }
  });

  it('uses the full box: extreme corners touch the 2px inset on every side', () => {
    const xs = corners.map(([x, y, z]) => isoProject(x, y, z, box).sx);
    const ys = corners.map(([x, y, z]) => isoProject(x, y, z, box).sy);
    expect(Math.min(...xs)).toBeCloseTo(2);
    expect(Math.max(...xs)).toBeCloseTo(box.w - 2);
    expect(Math.min(...ys)).toBeCloseTo(2);
    expect(Math.max(...ys)).toBeCloseTo(box.h - 2);
  });

  it('is monotonic in y: higher y projects strictly higher on screen (smaller sy)', () => {
    let prev = isoProject(0.5, 0, 0.5, box).sy;
    for (const y of [0.25, 0.5, 0.75, 1]) {
      const { sy } = isoProject(0.5, y, 0.5, box);
      expect(sy).toBeLessThan(prev);
      prev = sy;
    }
  });

  it('is monotonic in z: deeper z strictly grows both sx and sy', () => {
    let prev = isoProject(0.5, 0.5, 0, box);
    for (const z of [0.25, 0.5, 0.75, 1]) {
      const cur = isoProject(0.5, 0.5, z, box);
      expect(cur.sx).toBeGreaterThan(prev.sx);
      expect(cur.sy).toBeGreaterThan(prev.sy);
      prev = cur;
    }
  });
});

describe('renderScatter3D', () => {
  const base = {
    w: 300,
    h: 160,
    xLabels: ['1', '10k'] as [string, string],
    yLabels: ['0', '9'] as [string, string],
    zLabels: ['2023', '2024', '2025'],
    accent: '#58a6ff',
    gradId: 'g1',
    theme: dark,
  };

  it('renders a shadow, glow and core dot per point', () => {
    const points: ScatterPoint3[] = Array.from({ length: 5 }, (_, i) => ({
      x: i / 4,
      y: i / 4,
      z: i / 4,
    }));
    const svg = renderScatter3D({ ...base, points });
    expect((svg.match(/<ellipse /g) ?? []).length).toBe(5); // floor shadows
    expect((svg.match(/ r="6"/g) ?? []).length).toBe(5); // glow dots
    expect((svg.match(/ r="3.5"/g) ?? []).length).toBe(5); // core dots
    expect(svg).toContain(`filter id="${base.gradId}-glow"`);
  });

  it('draws far points first: nearest (highest z) core dot comes last', () => {
    const near: ScatterPoint3 = { x: 0.5, y: 0.5, z: 1 };
    const far: ScatterPoint3 = { x: 0.5, y: 0.5, z: 0 };
    const svg = renderScatter3D({ ...base, points: [near, far] });
    const cores = [...svg.matchAll(/<circle cx="([\d.]+)"[^>]* r="3.5"/g)].map((m) =>
      Number(m[1]),
    );
    expect(cores).toHaveLength(2);
    // z grows sx, so the nearest dot has the larger cx and must be drawn last.
    expect(cores[1]).toBeGreaterThan(cores[0]);
  });

  it('renders axis labels', () => {
    const svg = renderScatter3D({ ...base, points: [{ x: 0.5, y: 0.5, z: 0.5 }] });
    for (const lb of ['2023', '2024', '2025', '1', '10k', '0', '9']) {
      expect(svg).toContain(`>${lb}</text>`);
    }
  });

  it('shows the empty state when there are no points', () => {
    const svg = renderScatter3D({ ...base, points: [] });
    expect(svg).toContain('no reviews yet');
    expect(svg).not.toContain('<circle');
  });

  it('escapes XML in the value label', () => {
    const svg = renderScatter3D({
      ...base,
      points: [{ x: 0.5, y: 0.5, z: 0.5, value: 'a<b&"c"' }],
    });
    expect(svg).toContain('a&lt;b&amp;&quot;c&quot;');
    expect(svg).not.toContain('a<b');
  });
});
