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

  it('counts public/private/fork/owned correctly', () => {
    expect(stats.privateCount).toBe(0);
    expect(stats.forkCount).toBe(1);
    expect(stats.ownedCount).toBe(9);
    expect(stats.publicCount).toBe(9);
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
