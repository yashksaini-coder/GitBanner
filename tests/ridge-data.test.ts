import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregate } from '../src/compute.js';
import type { MergedPr, RawData, ReviewYear } from '../src/types.js';

const raw = JSON.parse(
  readFileSync(new URL('./fixtures/raw.json', import.meta.url), 'utf8'),
) as RawData;

const base: RawData = {
  profile: { login: 'me', name: null, createdAt: '2020-01-01T00:00:00Z', followers: 0, following: 0 },
  mergedPrs: [],
  prTotals: { opened: 0, merged: 0, open: 0 },
  issueTotals: { opened: 0, closed: 0 },
  reviewYears: [],
  ownRepos: [],
  window: null,
};

const year = (y: number, byRepo: ReviewYear['byRepo']): ReviewYear => ({
  year: y,
  reviews: byRepo.reduce((s, r) => s + r.count, 0),
  commits: 0,
  totalContributions: 0,
  issuesOpened: 0,
  prsOpened: 0,
  byRepo,
});

const repo = (nameWithOwner: string, count: number, stars = 0) => ({
  nameWithOwner,
  owner: nameWithOwner.split('/')[0],
  stars,
  count,
});

const pr = (nameWithOwner: string, mergedAt: string, stars = 0): MergedPr => ({
  mergedAt,
  repo: {
    nameWithOwner,
    owner: nameWithOwner.split('/')[0],
    stars,
    isPrivate: false,
    languages: [],
  },
});

const thisYear = new Date().getUTCFullYear();

describe('reviewRidges — synthetic', () => {
  it('aligns counts to ascending years and zero-fills missing years', () => {
    const stats = aggregate({
      ...base,
      reviewYears: [
        year(2024, [repo('acme/lib', 7)]),
        year(2022, [repo('acme/lib', 2), repo('acme/tool', 5)]),
        year(2023, [repo('acme/tool', 1)]),
      ],
    });
    expect(stats.reviewRidges.years).toEqual([2022, 2023, 2024]);
    expect(stats.reviewRidges.series).toEqual([
      { name: 'lib', counts: [2, 0, 7] },
      { name: 'tool', counts: [5, 1, 0] },
    ]);
  });

  it('keeps only external repos, case-insensitively, honouring excludeRepos', () => {
    const stats = aggregate(
      {
        ...base,
        reviewYears: [
          year(2024, [repo('Me/mine', 9), repo('acme/lib', 3), repo('acme/noise', 8)]),
        ],
      },
      { excludeRepos: ['noise'] },
    );
    expect(stats.reviewRidges.series).toEqual([{ name: 'lib', counts: [3] }]);
  });

  it('caps at 6 series ranked by total reviews desc', () => {
    const byRepo = Array.from({ length: 9 }, (_, i) => repo(`acme/r${i}`, i + 1));
    const stats = aggregate({
      ...base,
      reviewYears: [year(2023, byRepo), year(2024, byRepo)],
    });
    expect(stats.reviewRidges.series).toHaveLength(6);
    // r8 (total 18) down to r3 (total 8); r0..r2 dropped.
    expect(stats.reviewRidges.series.map((s) => s.name)).toEqual([
      'r8', 'r7', 'r6', 'r5', 'r4', 'r3',
    ]);
    const totals = stats.reviewRidges.series.map((s) =>
      s.counts.reduce((a, b) => a + b, 0),
    );
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
  });

  it('a zero-review entry never creates a series', () => {
    const stats = aggregate({
      ...base,
      reviewYears: [year(2024, [repo('acme/dead', 0), repo('acme/live', 1)])],
    });
    expect(stats.reviewRidges.series.map((s) => s.name)).toEqual(['live']);
  });
});

describe('popularitySpectrum — current-year scope', () => {
  it('a PR merged last year does not bucket; sum equals current-year merges', () => {
    const stats = aggregate({
      ...base,
      mergedPrs: [
        pr('acme/old', `${thisYear - 1}-06-01T00:00:00Z`, 50000),
        pr('acme/now', `${thisYear}-03-01T00:00:00Z`, 5),
        pr('acme/now', `${thisYear}-04-01T00:00:00Z`, 5),
      ],
    });
    const sum = stats.popularitySpectrum.reduce((s, b) => s + b.count, 0);
    expect(sum).toBe(2);
    expect(stats.popularitySpectrum.map((b) => b.count)).toEqual([2, 0, 0, 0, 0]);
    // The all-time headline still counts the old PR.
    expect(stats.prsMergedExternal).toBe(3);
  });

  it('keeps the window scope as-is on a windowed card, with no year filter', () => {
    const stats = aggregate({
      ...base,
      mergedPrs: [
        pr('acme/old', `${thisYear - 1}-06-01T00:00:00Z`, 50000),
        pr('acme/now', `${thisYear}-03-01T00:00:00Z`, 5),
      ],
      window: {
        since: `${thisYear - 1}-01-01T00:00:00Z`,
        until: `${thisYear}-12-31T23:59:59Z`,
        label: 'two years',
      },
    });
    const sum = stats.popularitySpectrum.reduce((s, b) => s + b.count, 0);
    expect(sum).toBe(2);
  });
});

describe('fixture invariants', () => {
  const stats = aggregate(raw);

  it('series counts never sum past the external review count', () => {
    const sum = stats.reviewRidges.series
      .flatMap((s) => s.counts)
      .reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(0);
    expect(sum).toBeLessThanOrEqual(stats.reviewsExternal);
  });

  it('every counts row aligns index-for-index with the years axis', () => {
    const years = stats.reviewRidges.years;
    expect(years).toEqual([...years].sort((a, b) => a - b));
    for (const s of stats.reviewRidges.series) {
      expect(s.counts).toHaveLength(years.length);
    }
  });
});
