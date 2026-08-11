import { describe, expect, it } from 'vitest';
import { dark } from '../src/render/theme.js';
import { renderRidgeline, ridgeHue } from '../src/render/tiles/ridgeline.js';

const base = { w: 320, h: 140, gradId: 'g1', theme: dark };
const years = ['2023', '2024', '2025'];

/** Trailing "L x y Z" of each occluding tile-fill area: (firstX, baselineY). */
function areaAnchors(svg: string): { x: number; y: number }[] {
  return [...svg.matchAll(/<path d="[^"]* L ([\d.]+) (\d+) Z" fill="#0a0a0a"\/>/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));
}

/** First point (M x y) of each stroked curve, in draw order. */
function curveStarts(svg: string): { x: number; y: number }[] {
  return [...svg.matchAll(/<path d="M ([\d.]+) ([\d.]+)[^"]*" fill="none"/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));
}

describe('renderRidgeline', () => {
  it('puts the back ridge highest and rightmost, the front lowest and leftmost', () => {
    const svg = renderRidgeline({
      ...base,
      years,
      series: [
        { name: 'back', counts: [3, 2, 1] },
        { name: 'mid', counts: [1, 2, 1] },
        { name: 'front', counts: [1, 1, 2] },
      ],
    });
    const a = areaAnchors(svg);
    expect(a).toHaveLength(3);
    // Draw order is back → front: x strictly decreasing, baseline y increasing.
    expect(a[0].x).toBeGreaterThan(a[1].x);
    expect(a[1].x).toBeGreaterThan(a[2].x);
    expect(a[0].y).toBeLessThan(a[1].y);
    expect(a[1].y).toBeLessThan(a[2].y);
    // Front baseline at h - 22 starting at x = 8; each step is dx=14, dy=16.
    expect(a[2]).toEqual({ x: 8, y: base.h - 22 });
    expect(a[0]).toEqual({ x: 8 + 2 * 14, y: base.h - 22 - 2 * 16 });
  });

  it('shares one global scale: equal counts give equal peak height above own baselines', () => {
    const svg = renderRidgeline({
      ...base,
      years,
      series: [
        { name: 'a', counts: [4, 4, 4] },
        { name: 'b', counts: [4, 4, 4] },
      ],
    });
    const anchors = areaAnchors(svg);
    const starts = curveStarts(svg);
    expect(anchors).toHaveLength(2);
    expect(starts).toHaveLength(2);
    const heights = anchors.map((a, i) => a.y - starts[i].y);
    expect(heights[0]).toBeCloseTo(heights[1]);
    expect(heights[0]).toBeGreaterThan(0);
  });

  it('scales lower counts proportionally against the global max', () => {
    const svg = renderRidgeline({
      ...base,
      years,
      series: [
        { name: 'a', counts: [8, 8, 8] },
        { name: 'b', counts: [4, 4, 4] },
      ],
    });
    const anchors = areaAnchors(svg);
    const starts = curveStarts(svg);
    const heights = anchors.map((a, i) => a.y - starts[i].y);
    expect(heights[1]).toBeCloseTo(heights[0] / 2);
  });

  it('renders one occluding tile fill, one hue fill and one 2px stroke per ridge', () => {
    const svg = renderRidgeline({
      ...base,
      years,
      series: Array.from({ length: 6 }, (_, i) => ({ name: `r${i}`, counts: [1, 2, 3] })),
    });
    expect((svg.match(/fill="#0a0a0a"/g) ?? []).length).toBe(6);
    expect((svg.match(/fill-opacity="0.3"/g) ?? []).length).toBe(6);
    expect((svg.match(/stroke-width="2"/g) ?? []).length).toBe(6);
    expect(svg).not.toContain('filter');
  });

  it('interpolates ridge hues from #8b6cf0 (back) via #3987e5 to #2fd08a (front)', () => {
    expect(ridgeHue(0)).toBe('#8b6cf0');
    expect(ridgeHue(0.5)).toBe('#3987e5');
    expect(ridgeHue(1)).toBe('#2fd08a');
    const svg = renderRidgeline({
      ...base,
      years,
      series: [
        { name: 'back', counts: [1, 1, 1] },
        { name: 'mid', counts: [1, 1, 1] },
        { name: 'front', counts: [1, 1, 1] },
      ],
    });
    const strokes = [...svg.matchAll(/stroke="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
    expect(strokes).toEqual(['#8b6cf0', '#3987e5', '#2fd08a']);
  });

  it('labels every ridge with its escaped repo name', () => {
    const svg = renderRidgeline({
      ...base,
      years,
      series: [
        { name: '<&', counts: [2, 1, 1] },
        { name: 'plain', counts: [1, 1, 1] },
      ],
    });
    // Escaping happens after fitText truncation, so entities never split.
    expect(svg).toContain('>&lt;&amp;</text>');
    expect(svg).not.toContain('><&');
    expect(svg).toContain('>plain</text>');
    expect((svg.match(/font-size="9"/g) ?? []).length).toBe(2);

    const long = renderRidgeline({
      ...base,
      years,
      series: [
        { name: 'a-very-long-repository-name', counts: [2, 1, 1] },
        { name: 'front', counts: [1, 1, 1] },
      ],
    });
    // Still labelled, but truncated hard to what fits right of the ridge.
    expect(long).toContain('…</text>');
    expect(long).not.toContain('a-very-long-repository-name');
  });

  it('renders a year tick per year under the front ridge', () => {
    const svg = renderRidgeline({
      ...base,
      years,
      series: [
        { name: 'a', counts: [1, 2, 3] },
        { name: 'b', counts: [3, 2, 1] },
      ],
    });
    for (const y of years) expect(svg).toContain(`>${y}</text>`);
    const ticks = [...svg.matchAll(/<text x="([\d.]+)" y="132" [^>]*font-size="8"/g)];
    expect(ticks).toHaveLength(3);
    // First tick sits at the front ridge's first year x-position.
    expect(Number(ticks[0][1])).toBe(8);
  });

  it('shows the empty state for no series and for all-zero counts', () => {
    for (const series of [[], [{ name: 'a', counts: [0, 0, 0] }]]) {
      const svg = renderRidgeline({ ...base, years, series });
      expect(svg).toContain('no reviews yet');
      expect(svg).not.toContain('<path');
    }
  });

  it('handles a single-year window without NaN coordinates', () => {
    const svg = renderRidgeline({
      ...base,
      years: ['2025'],
      series: [
        { name: 'a', counts: [3] },
        { name: 'b', counts: [1] },
      ],
    });
    expect(svg).not.toContain('NaN');
    expect(svg).toContain('>2025</text>');
  });
});
