import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregate, topExternalByPrs, topExternalByStars } from '../src/compute.js';
import type { RawData } from '../src/types.js';

const raw = JSON.parse(
  readFileSync(new URL('./fixtures/raw.json', import.meta.url), 'utf8'),
) as RawData;

const LOGIN = raw.profile.login.toLowerCase();
const isExternal = (owner: string) => owner.toLowerCase() !== LOGIN;
const publicPrs = raw.mergedPrs.filter((p) => !p.repo.isPrivate);

describe('aggregate — external contribution metrics', () => {
  const stats = aggregate(raw);

  it('counts only PRs merged into repos the user does not own', () => {
    const expected = publicPrs.filter((p) => isExternal(p.repo.owner)).length;
    expect(stats.prsMergedExternal).toBe(expected);
    expect(stats.prsMergedExternal).toBeGreaterThan(0);
  });

  it('excludes private repos from external counts unless asked', () => {
    const withPrivate = aggregate(raw, { includePrivate: true });
    expect(raw.mergedPrs.some((p) => p.repo.isPrivate)).toBe(true);
    expect(withPrivate.prsMergedExternal).toBeGreaterThanOrEqual(stats.prsMergedExternal);
  });

  it('never leaks a private repo name into the external repo list', () => {
    const privateNames = new Set(
      raw.mergedPrs.filter((p) => p.repo.isPrivate).map((p) => p.repo.nameWithOwner),
    );
    for (const repo of stats.externalRepos) {
      expect(privateNames.has(repo.nameWithOwner)).toBe(false);
    }
  });

  it('groups external repos and counts distinct projects', () => {
    const all = aggregate(raw, { minMergedPrs: 1 });
    const expected = new Set(
      publicPrs.filter((p) => isExternal(p.repo.owner)).map((p) => p.repo.nameWithOwner),
    );
    expect(all.externalRepoCount).toBe(expected.size);
    expect(all.externalRepos).toHaveLength(expected.size);
  });

  it('sums merged PRs per repo without double counting', () => {
    const all = aggregate(raw, { minMergedPrs: 1 });
    const total = all.externalRepos.reduce((s, r) => s + r.mergedPrs, 0);
    expect(total).toBe(all.prsMergedExternal);
  });

  it('drops drive-by repos from repo-level claims but not from the PR count', () => {
    const all = aggregate(raw, { minMergedPrs: 1 });
    const strict = aggregate(raw, { minMergedPrs: 2 });

    // Every external merged PR is real work, so the headline count is unchanged...
    expect(strict.prsMergedExternal).toBe(all.prsMergedExternal);
    // ...but single-PR repos no longer inflate reach or the project count.
    expect(strict.externalRepoCount).toBeLessThan(all.externalRepoCount);
    for (const repo of strict.externalRepos) {
      expect(repo.mergedPrs).toBeGreaterThanOrEqual(2);
    }
  });

  it('defaults to the drive-by filter rather than counting every repo', () => {
    const explicit = aggregate(raw, { minMergedPrs: 2 });
    expect(stats.externalRepoCount).toBe(explicit.externalRepoCount);
  });

  it('falls back to every repo when the threshold would leave nothing', () => {
    // A newcomer whose contributions are all first PRs must not see "0 projects"
    // next to a non-zero merged count.
    const onlyDriveBys: RawData = {
      ...raw,
      mergedPrs: [
        { mergedAt: '2025-01-01T00:00:00Z', repo: { nameWithOwner: 'acme/one', owner: 'acme', stars: 10, isPrivate: false, languages: [{ name: 'Go', color: '#0ff' }] } },
        { mergedAt: '2025-02-01T00:00:00Z', repo: { nameWithOwner: 'acme/two', owner: 'acme', stars: 20, isPrivate: false, languages: [{ name: 'Go', color: '#0ff' }] } },
      ],
    };
    const out = aggregate(onlyDriveBys, { minMergedPrs: 5 });
    expect(out.prsMergedExternal).toBe(2);
    expect(out.externalRepoCount).toBe(2);
    expect(out.biggestProject).not.toBeNull();
  });

  it('ranks external repos by merged PRs, descending', () => {
    const counts = stats.externalRepos.map((r) => r.mergedPrs);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('reports the highest-starred own repo alongside the star sum', () => {
    const own = raw.ownRepos.filter((r) => !r.isFork && !r.isPrivate);
    const top = own.reduce((a, b) => (b.stars > a.stars ? b : a));
    expect(stats.ownTopRepo).toEqual({ name: top.name, stars: top.stars });
    expect(stats.ownRepoCount).toBe(own.length);
  });

  it('never reveals a private repo as the highest-starred own repo', () => {
    const inflated: RawData = {
      ...raw,
      ownRepos: [
        ...raw.ownRepos,
        { name: 'secret-sauce', isFork: false, isPrivate: true, stars: 99999 },
      ],
    };
    expect(aggregate(inflated).ownTopRepo?.name).not.toBe('secret-sauce');
    expect(aggregate(inflated, { includePrivate: true }).ownTopRepo?.name).toBe('secret-sauce');
  });

  it('picks the biggest project by stars, not by PR count', () => {
    const maxStars = Math.max(...stats.externalRepos.map((r) => r.stars));
    expect(stats.biggestProject?.stars).toBe(maxStars);
  });

  it('counts trailing-12-month momentum from external merges only', () => {
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const recent = publicPrs.filter(
      (p) => isExternal(p.repo.owner) && Date.parse(p.mergedAt) >= cutoff,
    );
    expect(stats.recentExternalPrs).toBe(recent.length);
    expect(stats.recentExternalRepoCount).toBe(
      new Set(recent.map((p) => p.repo.nameWithOwner)).size,
    );
    expect(stats.recentExternalPrs).toBeLessThanOrEqual(stats.prsMergedExternal);
  });

  it('computes merge rate from the PR totals', () => {
    expect(stats.mergeRatePct).toBe(
      Math.round((raw.prTotals.merged / raw.prTotals.opened) * 100),
    );
  });

  it('counts reviews on others repos separately from the total', () => {
    const total = raw.reviewYears.reduce((s, y) => s + y.reviews, 0);
    expect(stats.reviewsTotal).toBe(total);
    expect(stats.reviewsExternal).toBeLessThanOrEqual(stats.reviewsTotal);
    for (const entry of raw.reviewYears.flatMap((y) => y.byRepo)) {
      if (!isExternal(entry.owner)) {
        expect(stats.topReviewedRepos.map((r) => r.name)).not.toContain(
          entry.nameWithOwner.split('/')[1],
        );
      }
    }
  });

  it('counts every linguist language per project, not just the primary one', () => {
    const distinct = new Set(
      stats.externalRepos.flatMap((r) => r.languages.map((l) => l.name)),
    );
    expect(stats.languageCount).toBe(distinct.size);
    // Multi-language repos mean the count exceeds a primary-only tally.
    expect(stats.languageCount).toBeGreaterThan(
      new Set(stats.externalRepos.map((r) => r.languages[0]?.name).filter(Boolean)).size,
    );
    const counts = stats.languages.map((l) => l.repos);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    for (const lang of stats.languages) expect(lang.color).toMatch(/^#/);
  });

  it('sums own stars over non-fork repos only', () => {
    const expected = raw.ownRepos
      .filter((r) => !r.isFork && !r.isPrivate)
      .reduce((s, r) => s + r.stars, 0);
    expect(stats.ownStars).toBe(expected);
  });

  it('excludeRepos matches both bare name and owner/name', () => {
    const target = stats.externalRepos[0];
    const byFull = aggregate(raw, { excludeRepos: [target.nameWithOwner] });
    const byBare = aggregate(raw, { excludeRepos: [target.name] });
    for (const result of [byFull, byBare]) {
      expect(result.externalRepos.find((r) => r.nameWithOwner === target.nameWithOwner)).toBeUndefined();
      expect(result.prsMergedExternal).toBe(stats.prsMergedExternal - target.mergedPrs);
    }
  });
});

describe('aggregate — empty inputs', () => {
  // A tile set that skips a query leaves its collection empty; nothing should throw.
  const empty: RawData = {
    profile: { login: 'nobody', name: null, createdAt: '2024-01-01T00:00:00Z', followers: 0, following: 0 },
    mergedPrs: [],
    prTotals: { opened: 0, merged: 0, open: 0 },
    issueTotals: { opened: 0, closed: 0 },
    reviewYears: [],
    ownRepos: [],
    window: null,
  };

  it('produces a zeroed payload rather than throwing', () => {
    const stats = aggregate(empty);
    expect(stats.prsMergedExternal).toBe(0);
    expect(stats.externalRepoCount).toBe(0);
    expect(stats.biggestProject).toBeNull();
    expect(stats.ownTopRepo).toBeNull();
    expect(stats.mergeRatePct).toBe(0);
    expect(stats.recentExternalPrs).toBe(0);
    expect(stats.languages).toEqual([]);
    expect(topExternalByPrs(stats, 3)).toEqual([]);
    expect(topExternalByStars(stats, 3)).toEqual([]);
  });
});
