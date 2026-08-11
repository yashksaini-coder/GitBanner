import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregate } from '../src/compute.js';
import type { RawData, ReviewYear } from '../src/types.js';

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

describe('reviewPoints — synthetic', () => {
  it('drops own-repo entries and zero-review entries', () => {
    const stats = aggregate({
      ...base,
      reviewYears: [
        year(2024, [repo('me/mine', 9, 100), repo('acme/lib', 3, 50), repo('acme/dead', 0, 5)]),
      ],
    });
    expect(stats.reviewPoints).toEqual([
      { name: 'lib', year: 2024, reviews: 3, stars: 50 },
    ]);
  });

  it('is case-insensitive on the owner match', () => {
    const stats = aggregate({
      ...base,
      reviewYears: [year(2024, [repo('Me/mine', 4, 1)])],
    });
    expect(stats.reviewPoints).toEqual([]);
  });

  it('honours excludeRepos', () => {
    const stats = aggregate(
      { ...base, reviewYears: [year(2024, [repo('acme/lib', 3, 50), repo('acme/other', 2, 1)])] },
      { excludeRepos: ['lib'] },
    );
    expect(stats.reviewPoints.map((p) => p.name)).toEqual(['other']);
  });

  it('keeps one point per repo per year, never merging across years', () => {
    const stats = aggregate({
      ...base,
      reviewYears: [
        year(2023, [repo('acme/lib', 2, 50)]),
        year(2024, [repo('acme/lib', 7, 50)]),
      ],
    });
    expect(stats.reviewPoints).toEqual([
      { name: 'lib', year: 2024, reviews: 7, stars: 50 },
      { name: 'lib', year: 2023, reviews: 2, stars: 50 },
    ]);
  });

  it('sorts by reviews desc and caps at 14 points', () => {
    const byRepo = Array.from({ length: 10 }, (_, i) => repo(`acme/r${i}`, i + 1, i));
    const stats = aggregate({
      ...base,
      reviewYears: [year(2023, byRepo), year(2024, byRepo)],
    });
    expect(stats.reviewPoints).toHaveLength(14);
    const reviews = stats.reviewPoints.map((p) => p.reviews);
    expect(reviews).toEqual([...reviews].sort((a, b) => b - a));
    // The 14 kept are the biggest ones: nothing dropped outranks anything kept.
    expect(Math.min(...reviews)).toBe(4);
  });
});

describe('reviewPoints — fixture', () => {
  const stats = aggregate(raw);

  it('every point has reviews > 0 and stars >= 0', () => {
    expect(stats.reviewPoints.length).toBeGreaterThan(0);
    for (const p of stats.reviewPoints) {
      expect(p.reviews).toBeGreaterThan(0);
      expect(p.stars).toBeGreaterThanOrEqual(0);
    }
  });

  it('points never sum past the external review count', () => {
    const sum = stats.reviewPoints.reduce((s, p) => s + p.reviews, 0);
    expect(sum).toBeLessThanOrEqual(stats.reviewsExternal);
  });
});
