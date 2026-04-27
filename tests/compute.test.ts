import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregate } from '../src/compute.js';
import type { RawData } from '../src/types.js';



const raw = JSON.parse(
  readFileSync(new URL('./fixtures/raw.json', import.meta.url), 'utf8'),
) as RawData;

describe('aggregate', () => {
  const stats = aggregate(raw);

  it('uses the larger of repo-history vs contributions for totalCommits', () => {
    const fromRepos = raw.repos.reduce((s, r) => s + r.userCommits, 0);
    const fromContribs = raw.contributionsByYear.reduce((s, y) => s + y.commits, 0);
    expect(stats.totalCommits).toBe(Math.max(fromRepos, fromContribs));
  });

  it('sums stars across owned (non-fork) repos', () => {
    const expected = raw.repos
      .filter((r) => !r.isFork)
      .reduce((s, r) => s + r.stargazerCount, 0);
    expect(stats.totalStars).toBe(expected);
  });

  it('produces top 3 repos by commits, sorted desc', () => {
    expect(stats.topReposByCommits).toHaveLength(3);
    expect(stats.topReposByCommits[0].name).toBe('yashksaini-coder');
    expect(stats.topReposByCommits[0].value).toBe(1000);
    expect(stats.topReposByCommits[1].name).toBe('Leetcode');
  });

  it('produces top 3 repos by stars', () => {
    expect(stats.topReposByStars[0].name).toBe('Leetcode-Journal');
    expect(stats.topReposByStars[0].value).toBe(26);
  });

  it('aggregates languages and computes percentages', () => {
    expect(stats.languages.length).toBeGreaterThan(0);
    const top = stats.languages[0];
    expect(top.percent).toBeGreaterThan(0);
    expect(top.color).toMatch(/^#/);
    const sum = stats.languages.reduce((s, l) => s + l.percent, 0);
    expect(sum).toBeLessThanOrEqual(100.01);
  });

  it('counts languages distinctly across owned repos', () => {
    const distinct = new Set<string>();
    for (const r of raw.repos.filter((r) => !r.isFork)) {
      for (const l of r.languages) distinct.add(l.name);
    }
    expect(stats.languageCount).toBe(distinct.size);
  });

  it('computes avg lifespan only over repos with commits', () => {
    expect(stats.avgLifespanDays).toBeGreaterThan(0);
  });

  it('counts public/private/forked/owned correctly', () => {
    expect(stats.privateCount).toBe(0);
    expect(stats.forkedRepoCount).toBe(1);
    expect(stats.ownedCount).toBe(9);
    expect(stats.publicCount).toBe(9);
  });

  it('sums incoming forks (others forking owned repos)', () => {
    const expected = raw.repos
      .filter((r) => !r.isFork)
      .reduce((s, r) => s + r.forkCount, 0);
    expect(stats.incomingForks).toBe(expected);
  });

  it('exposes followers and following from profile', () => {
    expect(stats.followers).toBe(raw.profile.followers);
    expect(stats.following).toBe(raw.profile.following);
  });

  it('picks the year with the most contributions as bestYear', () => {
    const expected = raw.contributionsByYear
      .slice()
      .sort((a, b) => b.commits - a.commits)[0];
    expect(stats.bestYear.year).toBe(expected.year);
    expect(stats.bestYear.commits).toBe(expected.commits);
  });

  it('avgCommitsPerRepo divides repo-sum (not contribution-graph max) by repo count', () => {
    // Compute the same way aggregate does, restricted to non-private owned repos.
    const aggRepos = raw.repos.filter((r) => !r.isFork && !r.isPrivate);
    const repoSum = aggRepos.reduce((s, r) => s + r.userCommits, 0);
    expect(stats.avgCommitsPerRepo).toBe(Math.round(repoSum / aggRepos.length));
  });

  it('respects excludeRepos: profile README repo is filtered from per-repo lists', () => {
    const stats2 = aggregate(raw, { excludeRepos: ['yashksaini-coder'] });
    expect(stats2.topReposByCommits.find((r) => r.name === 'yashksaini-coder')).toBeUndefined();
    expect(stats2.mostActiveProject.name).not.toBe('yashksaini-coder');
  });

  it('excluded repos still contribute to totalCommits but nothing else', () => {
    const base = aggregate(raw);
    const excluded = aggregate(raw, { excludeRepos: ['yashksaini-coder'] });

    // totalCommits is computed from a wider scope that ignores the exclude
    // list, so the headline number is preserved.
    expect(excluded.totalCommits).toBe(base.totalCommits);

    // Stars drop by the excluded repo's stargazer count.
    const readme = raw.repos.find((r) => r.name === 'yashksaini-coder');
    expect(excluded.totalStars).toBe(base.totalStars - readme!.stargazerCount);

    // The excluded repo no longer appears in top-by-commits or as most active.
    expect(excluded.topReposByCommits.find((r) => r.name === 'yashksaini-coder')).toBeUndefined();
    expect(excluded.mostActiveProject.name).not.toBe('yashksaini-coder');

    // avgCommitsPerRepo recomputed without the excluded repo's commits AND
    // without it in the denominator.
    const aggReposWithout = raw.repos.filter(
      (r) => !r.isFork && !r.isPrivate && r.name !== 'yashksaini-coder',
    );
    const sumWithout = aggReposWithout.reduce((s, r) => s + r.userCommits, 0);
    expect(excluded.avgCommitsPerRepo).toBe(Math.round(sumWithout / aggReposWithout.length));
  });

  it('picks oldest, latest, and most-active projects correctly', () => {
    expect(stats.oldestProject.name).toBe('C_coding');
    expect(stats.latestProject.name).toBe('Turbine_Q1_26');
    expect(stats.mostActiveProject.name).toBe('yashksaini-coder');
    expect(stats.mostActiveProject.commits).toBe(1000);
  });

  it('computes yearsCoding from profile.createdAt', () => {
    expect(stats.yearsCoding).toBeGreaterThanOrEqual(3);
  });

  it('picks the most-used language as goToLanguage', () => {
    expect(stats.goToLanguage.name).toBe(stats.languages[0].name);
    expect(stats.goToLanguage.reposUsing).toBeGreaterThan(0);
  });

  it('attaches a persona', () => {
    expect(stats.persona.label).toBeTruthy();
    expect(stats.persona.iconKey).toBeTruthy();
  });
});
