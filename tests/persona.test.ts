import { describe, expect, it } from 'vitest';
import { scorePersona } from '../src/persona.js';
import type { StatsPayload } from '../src/types.js';

function makeStats(overrides: Partial<StatsPayload>): StatsPayload {
  const base: StatsPayload = {
    username: 'tester',
    generatedAt: new Date().toISOString(),
    totalCommits: 0,
    totalStars: 0,
    topReposByCommits: [],
    topReposByStars: [],
    topReposByLifespan: [],
    languages: [],
    languageCount: 0,
    avgLifespanDays: 0,
    avgCommitsPerRepo: 0,
    publicCount: 0,
    privateCount: 0,
    forkCount: 0,
    ownedCount: 0,
    oldestProject: { name: '—', date: new Date().toISOString() },
    latestProject: { name: '—', date: new Date().toISOString() },
    mostActiveProject: { name: '—', date: new Date().toISOString(), commits: 0 },
    yearsCoding: 1,
    goToLanguage: { name: '—', reposUsing: 0, color: '#000' },
    persona: { key: 'rising-dev', label: '', tagline: '', iconKey: '', accentColor: '' },
  };
  return { ...base, ...overrides };
}

describe('scorePersona', () => {
  it('returns Rising Dev when no rule fires', () => {
    expect(scorePersona(makeStats({})).key).toBe('rising-dev');
  });

  it('returns Open Source Star for high-star accounts', () => {
    expect(scorePersona(makeStats({ totalStars: 1000 })).key).toBe('open-source-star');
  });

  it('returns Open Source Star when forks are heavy', () => {
    expect(scorePersona(makeStats({ forkCount: 25 })).key).toBe('open-source-star');
  });

  it('returns Polyglot when many languages', () => {
    expect(scorePersona(makeStats({ languageCount: 10 })).key).toBe('polyglot');
  });

  it('returns Specialist when one language dominates', () => {
    const persona = scorePersona(
      makeStats({
        languages: [{ name: 'TS', bytes: 100, percent: 70, color: '#000' }],
      }),
    );
    expect(persona.key).toBe('specialist');
  });

  it('returns Veteran for long-tenured accounts with no other strong signal', () => {
    expect(scorePersona(makeStats({ yearsCoding: 8 })).key).toBe('veteran');
  });

  it('returns Builder for high commit volume', () => {
    expect(scorePersona(makeStats({ totalCommits: 5000 })).key).toBe('builder');
  });

  it('returns Explorer for many repos with low commit density', () => {
    expect(
      scorePersona(makeStats({ ownedCount: 40, avgCommitsPerRepo: 10 })).key,
    ).toBe('explorer');
  });

  it('prefers Open Source Star over Builder when both fire', () => {
    expect(
      scorePersona(makeStats({ totalStars: 2000, totalCommits: 5000 })).key,
    ).toBe('open-source-star');
  });
});
