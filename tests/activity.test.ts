import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregate } from '../src/compute.js';
import { monotonePath, renderWave } from '../src/render/tiles/wave.js';
import { dark } from '../src/render/theme.js';
import type { RawData } from '../src/types.js';

const raw = JSON.parse(
  readFileSync(new URL('./fixtures/raw.json', import.meta.url), 'utf8'),
) as RawData;

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** UTC first-of-month `offset` months before now, plus a few days. */
function monthsAgo(offset: number): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 3),
  ).toISOString();
}

function syntheticRaw(mergedAts: string[]): RawData {
  return {
    profile: { login: 'me', name: null, createdAt: '2015-01-01T00:00:00Z', followers: 0, following: 0 },
    mergedPrs: mergedAts.map((mergedAt) => ({
      mergedAt,
      repo: { nameWithOwner: 'acme/proj', owner: 'acme', stars: 5, isPrivate: false, languages: [] },
    })),
    prTotals: { opened: 0, merged: 0, open: 0 },
    issueTotals: { opened: 0, closed: 0 },
    reviewYears: [],
    ownRepos: [],
    window: null,
  };
}

describe('aggregate — monthlyExternalMerges', () => {
  it('always has 12 non-negative buckets summing to at most the external total', () => {
    const stats = aggregate(raw);
    expect(stats.monthlyExternalMerges).toHaveLength(12);
    for (const b of stats.monthlyExternalMerges) {
      expect(b.count).toBeGreaterThanOrEqual(0);
      expect(MONTH_LETTERS).toContain(b.label);
    }
    const sum = stats.monthlyExternalMerges.reduce((s, b) => s + b.count, 0);
    // The 12 calendar-month window starts on a month boundary at or after the
    // rolling 365-day cutoff, so it can only be a subset of recentExternalPrs.
    expect(sum).toBeLessThanOrEqual(stats.recentExternalPrs);
    expect(sum).toBeLessThanOrEqual(stats.prsMergedExternal);
  });

  it('labels run oldest-first and end with the current UTC month', () => {
    const stats = aggregate(raw);
    const now = new Date();
    const labels = stats.monthlyExternalMerges.map((b) => b.label);
    const expected = Array.from({ length: 12 }, (_, i) =>
      MONTH_LETTERS[(((now.getUTCMonth() - 11 + i) % 12) + 12) % 12],
    );
    expect(labels).toEqual(expected);
  });

  it('places merges in the right buckets and drops ones outside the window', () => {
    const stats = aggregate(syntheticRaw([
      monthsAgo(0), // current month → last bucket
      monthsAgo(0),
      monthsAgo(1), // previous month → second-to-last
      monthsAgo(11), // oldest in-window month → first bucket
      monthsAgo(13), // outside the trailing 12 months → dropped
    ]));
    const counts = stats.monthlyExternalMerges.map((b) => b.count);
    expect(counts[11]).toBe(2);
    expect(counts[10]).toBe(1);
    expect(counts[0]).toBe(1);
    expect(counts.reduce((s, c) => s + c, 0)).toBe(4);
  });
});

/** Parse "M x y C c1x c1y c2x c2y x y C ..." into segments. */
function parseCubics(path: string) {
  const nums = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const start = { x: nums[0], y: nums[1] };
  const segs: { p0: { x: number; y: number }; c1: { x: number; y: number }; c2: { x: number; y: number }; p1: { x: number; y: number } }[] = [];
  let p0 = start;
  for (let i = 2; i + 5 < nums.length; i += 6) {
    const p1 = { x: nums[i + 4], y: nums[i + 5] };
    segs.push({
      p0,
      c1: { x: nums[i], y: nums[i + 1] },
      c2: { x: nums[i + 2], y: nums[i + 3] },
      p1,
    });
    p0 = p1;
  }
  return { start, segs };
}

function bezierY(s: ReturnType<typeof parseCubics>['segs'][number], t: number): number {
  const u = 1 - t;
  return u * u * u * s.p0.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p1.y;
}

/** Every sampled y on every segment stays within the endpoints' range ± 0.5px. */
function assertContained(pts: { x: number; y: number }[]) {
  const { start, segs } = parseCubics(monotonePath(pts));
  expect(start).toEqual({ x: pts[0].x, y: pts[0].y });
  expect(segs).toHaveLength(pts.length - 1);
  segs.forEach((seg, i) => {
    expect(seg.p1.y).toBeCloseTo(pts[i + 1].y, 1);
    const lo = Math.min(pts[i].y, pts[i + 1].y) - 0.5;
    const hi = Math.max(pts[i].y, pts[i + 1].y) + 0.5;
    for (let k = 0; k <= 100; k++) {
      const y = bezierY(seg, k / 100);
      expect(y).toBeGreaterThanOrEqual(lo);
      expect(y).toBeLessThanOrEqual(hi);
    }
  });
}

describe('monotonePath — Fritsch–Carlson containment', () => {
  it('emits M then one C per interval through every point', () => {
    const pts = [{ x: 0, y: 10 }, { x: 50, y: 40 }, { x: 100, y: 20 }];
    const path = monotonePath(pts);
    expect(path.startsWith('M ')).toBe(true);
    expect(path.match(/C/g)).toHaveLength(2);
  });

  it('never overshoots on a monotone increasing series', () => {
    assertContained([
      { x: 0, y: 100 }, { x: 40, y: 98 }, { x: 80, y: 90 },
      { x: 120, y: 60 }, { x: 160, y: 15 }, { x: 200, y: 12 },
    ]);
  });

  it('never overshoots on a spiky series with flats and reversals', () => {
    assertContained([
      { x: 0, y: 100 }, { x: 40, y: 100 }, { x: 80, y: 5 },
      { x: 120, y: 95 }, { x: 160, y: 95 }, { x: 200, y: 10 },
      { x: 240, y: 60 }, { x: 280, y: 60 },
    ]);
  });

  it('handles empty and single-point inputs', () => {
    expect(monotonePath([])).toBe('');
    expect(monotonePath([{ x: 3, y: 4 }])).toBe('M 3 4');
  });
});

describe('renderWave', () => {
  const points = MONTH_LETTERS.map((label, i) => ({ label, count: i === 7 ? 9 : i % 3 }));

  it('draws gradient area, glow, stroke, ticks and peak/last markers', () => {
    const svg = renderWave({ w: 440, h: 176, points, accent: '#3987e5', gradId: 'gw', theme: dark });
    expect(svg).toContain('linearGradient id="gw"');
    expect(svg).toContain('fill="url(#gw)"');
    expect(svg).toContain('filter id="gw-glow"');
    expect(svg).toContain('stroke-width="2.5"');
    // Every-other-month ticks: 6 of the 12 letters.
    expect(svg.match(/font-size="9"/g)).toHaveLength(6);
    // Peak (9) and last month (count 2) both marked.
    expect(svg.match(/r="3.5"/g)).toHaveLength(2);
    expect(svg).toContain('>9</text>');
  });

  it('collapses the marker pair when the peak is the last month', () => {
    const rising = MONTH_LETTERS.map((label, i) => ({ label, count: i }));
    const svg = renderWave({ w: 440, h: 176, points: rising, accent: '#3987e5', gradId: 'gw2', theme: dark });
    expect(svg.match(/r="3.5"/g)).toHaveLength(1);
  });

  it('renders the empty-state message for an all-zero series', () => {
    const zero = MONTH_LETTERS.map((label) => ({ label, count: 0 }));
    const svg = renderWave({ w: 440, h: 176, points: zero, accent: '#3987e5', gradId: 'gw3', theme: dark });
    expect(svg).toContain('no external merges in the last 12 months');
    expect(svg).not.toContain('linearGradient');
  });
});
