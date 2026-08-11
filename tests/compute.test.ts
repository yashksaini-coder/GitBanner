import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregate, MIN_LANGUAGE_SHARE, NON_PROGRAMMING_LANGUAGES, topExternalByPrs, topExternalByStars } from '../src/compute.js';
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
        { mergedAt: '2025-01-01T00:00:00Z', repo: { nameWithOwner: 'acme/one', owner: 'acme', stars: 10, isPrivate: false, languages: [{ name: 'Go', color: '#0ff', size: 1000 }] } },
        { mergedAt: '2025-02-01T00:00:00Z', repo: { nameWithOwner: 'acme/two', owner: 'acme', stars: 20, isPrivate: false, languages: [{ name: 'Go', color: '#0ff', size: 1000 }] } },
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

  it('counts languages that carry real weight, mirroring the share gate', () => {
    // Replicate the rule: primary always counts; others need >= 8% of bytes.
    const distinct = new Set<string>();
    for (const repo of stats.externalRepos) {
      const total = repo.languages.reduce((s2, l) => s2 + Math.max(0, l.size), 0);
      repo.languages.forEach((l, idx) => {
        if (NON_PROGRAMMING_LANGUAGES.has(l.name.toLowerCase())) return;
        if (idx > 0 && total > 0 && l.size / total < MIN_LANGUAGE_SHARE) return;
        distinct.add(l.name);
      });
    }
    expect(stats.languageCount).toBe(distinct.size);
    const counts = stats.languages.map((l) => l.repos);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    for (const lang of stats.languages) expect(lang.color).toMatch(/^#/);
  });

  it('drops incidental language slivers but never a primary language', () => {
    const synth = aggregate({
      ...raw,
      mergedPrs: [
        { mergedAt: '2026-01-01T00:00:00Z', repo: { nameWithOwner: 'a/x', owner: 'a', stars: 5, isPrivate: false, languages: [
          { name: 'Python', color: '#3572a5', size: 95000 },
          { name: 'JavaScript', color: '#f1e05a', size: 3000 }, // 3% sliver
          { name: 'Rust', color: '#dea584', size: 9000 },       // 8.4% counts
        ] } },
        { mergedAt: '2026-01-02T00:00:00Z', repo: { nameWithOwner: 'a/x', owner: 'a', stars: 5, isPrivate: false, languages: [
          { name: 'Python', color: '#3572a5', size: 95000 },
          { name: 'JavaScript', color: '#f1e05a', size: 3000 },
          { name: 'Rust', color: '#dea584', size: 9000 },
        ] } },
      ],
    });
    const names = synth.languages.map((l) => l.name);
    expect(names).toContain('Python');
    expect(names).toContain('Rust');
    expect(names).not.toContain('JavaScript');
  });

  it('drops markup, data and prose languages from the ships-in claim', () => {
    // The fixture is real data and carries all three classes.
    const all = new Set(
      stats.externalRepos.flatMap((r) => r.languages.map((l) => l.name)),
    );
    expect(all.has('CSS') || all.has('HTML') || all.has('Jupyter Notebook')).toBe(true);
    const shown = stats.languages.map((l) => l.name);
    for (const name of ['CSS', 'HTML', 'Jupyter Notebook', 'Markdown', 'JSON']) {
      expect(shown).not.toContain(name);
    }
    // Linguist classes shells and build files as programming; they stay.
    for (const lang of stats.languages) {
      expect(NON_PROGRAMMING_LANGUAGES.has(lang.name.toLowerCase())).toBe(false);
    }
  });

  it('ignore-languages stacks on top of the programming filter', () => {
    const top = stats.languages[0].name;
    const both = aggregate(raw, { ignoreLanguages: [top] });
    expect(both.languages.map((l) => l.name)).not.toContain(top);
    expect(both.languages.map((l) => l.name)).not.toContain('CSS');
  });

  it('ignoreLanguages hides languages from the tiles, case-insensitively', () => {
    const top = stats.languages[0].name;
    const ignored = aggregate(raw, { ignoreLanguages: [top.toLowerCase()] });
    expect(ignored.languages.find((l) => l.name === top)).toBeUndefined();
    expect(ignored.languageCount).toBe(stats.languageCount - 1);
  });

  it('buckets current-year merged PRs into fixed popularity decades', () => {
    expect(stats.popularitySpectrum.map((b) => b.label)).toEqual([
      '<10', '10+', '100+', '1k+', '10k+',
    ]);
    // The spectrum is scoped to the current UTC calendar year, so it sums to
    // the current-year external merge count, not the all-time headline.
    const thisYear = new Date().getUTCFullYear();
    const expected = publicPrs.filter(
      (p) =>
        isExternal(p.repo.owner) &&
        new Date(p.mergedAt).getUTCFullYear() === thisYear,
    ).length;
    const sum = stats.popularitySpectrum.reduce((s2, b) => s2 + b.count, 0);
    expect(sum).toBe(expected);
    // boundary check via synthetic repos, merged in the current year
    const jan = `${thisYear}-01-01T00:00:00Z`;
    const feb = `${thisYear}-02-01T00:00:00Z`;
    const synth = aggregate({
      ...raw,
      mergedPrs: [
        { mergedAt: jan, repo: { nameWithOwner: 'a/nine', owner: 'a', stars: 9, isPrivate: false, languages: [] } },
        { mergedAt: feb, repo: { nameWithOwner: 'a/nine', owner: 'a', stars: 9, isPrivate: false, languages: [] } },
        { mergedAt: jan, repo: { nameWithOwner: 'a/ten', owner: 'a', stars: 10, isPrivate: false, languages: [] } },
        { mergedAt: feb, repo: { nameWithOwner: 'a/ten', owner: 'a', stars: 10, isPrivate: false, languages: [] } },
        { mergedAt: jan, repo: { nameWithOwner: 'a/big', owner: 'a', stars: 10000, isPrivate: false, languages: [] } },
        { mergedAt: feb, repo: { nameWithOwner: 'a/big', owner: 'a', stars: 10000, isPrivate: false, languages: [] } },
      ],
    });
    expect(synth.popularitySpectrum.map((b) => b.count)).toEqual([2, 2, 0, 0, 2]);
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
