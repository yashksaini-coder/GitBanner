import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregate } from '../src/compute.js';
import { toSvg } from '../src/render/svg.js';
import { DEFAULT_TILES, neededData, parseTiles, TILE_KEYS, TILES } from '../src/tiles.js';
import type { RawData, StatsPayload } from '../src/types.js';

const raw = JSON.parse(
  readFileSync(new URL('./fixtures/raw.json', import.meta.url), 'utf8'),
) as RawData;

const stats = aggregate(raw);
const n = (v: number) => v.toLocaleString('en-US');

describe('toSvg', () => {
  const svg = toSvg(stats, 'dark');

  it('produces a well-formed 1600x728 root <svg>', () => {
    expect(svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(svg).toMatch(/<svg [^>]*width="1600"/);
    expect(svg).toMatch(/<svg [^>]*height="728"/);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it('renders all three cards by default', () => {
    expect(svg).toContain('Pull requests');
    expect(svg).toContain('Code review');
    expect(svg).toContain('Footprint');
  });

  it('shows the headline numbers', () => {
    expect(svg).toContain(n(stats.prsMergedExternal));
    expect(svg).toContain(`${stats.mergeRatePct}%`);
    expect(svg).toContain(n(stats.reviewsExternal));
    expect(svg).toContain(n(stats.languageCount));
    expect(svg).toContain(n(stats.ownStars));
    // U+2605 is absent from the embedded font subsets; any ★ in the output
    // would silently render as nothing under loadSystemFonts:false.
    expect(svg).not.toContain('★');
  });

  it('leads the code-review card with issue resolution when all-time', () => {
    expect(svg).toContain('Issues resolved');
    const pct = Math.round((stats.issuesClosed! / stats.issuesOpened) * 100);
    expect(svg).toContain(`${pct}%`);
  });

  it('names the biggest external project and the top own repo', () => {
    expect(svg).toContain(stats.biggestProject!.name.slice(0, 13));
    expect(svg).toContain(stats.ownTopRepo!.name.slice(0, 13));
  });

  it('has no footer line and no timestamp', () => {
    expect(svg).not.toContain('gitbanner ·');
    expect(svg).not.toMatch(/updated \d{4}-\d{2}-\d{2}/);
    expect(svg).not.toContain(`github.com/${stats.username}`);
  });

  it('renders every card in the registry without throwing', () => {
    for (const key of TILE_KEYS) {
      expect(toSvg(stats, 'dark', [key])).toContain('</svg>');
    }
  });

  it('honours card order and gives equal widths', () => {
    const svgA = toSvg(stats, 'dark', ['pull-requests', 'code-review']);
    const svgB = toSvg(stats, 'dark', ['code-review', 'pull-requests']);
    expect(svgA.indexOf('Pull requests')).toBeLessThan(svgA.indexOf('Code review'));
    expect(svgB.indexOf('Code review')).toBeLessThan(svgB.indexOf('Pull requests'));
    const widths = [...svgA.matchAll(/<rect width="(\d+)" height="664"/g)].map((m) => Number(m[1]));
    expect(widths).toEqual([756, 756]);
  });

  it('carries no trace of the removed persona feature', () => {
    for (const word of ['persona', 'Open Source Star', 'Rising Dev', 'Polyglot', 'Veteran']) {
      expect(svg).not.toContain(word);
    }
  });
});

describe('tile selection', () => {
  it('defaults to the three cards when no input is given', () => {
    expect(parseTiles(undefined)).toEqual(DEFAULT_TILES);
    expect(parseTiles('')).toEqual(DEFAULT_TILES);
    expect(parseTiles('   ')).toEqual(DEFAULT_TILES);
    expect(DEFAULT_TILES).toEqual(['pull-requests', 'code-review', 'footprint']);
  });

  it('rejects an unknown card instead of silently dropping it', () => {
    expect(() => parseTiles('pull-requests,typo-here')).toThrow(/Unknown tile/);
  });

  it('trims, orders, and de-duplicates', () => {
    expect(parseTiles(' code-review , pull-requests ,code-review')).toEqual([
      'code-review',
      'pull-requests',
    ]);
  });

  it('only asks for the data the selected cards need', () => {
    expect([...neededData(['pull-requests'])]).toEqual(['prs']);
    expect([...neededData(['code-review'])]).toEqual(['reviews', 'issues']);
    expect([...neededData(['footprint'])]).toEqual(['prs', 'ownRepos']);
    expect(neededData(DEFAULT_TILES)).toEqual(new Set(['prs', 'reviews', 'issues', 'ownRepos']));
  });

  it('every registered card declares at least one need', () => {
    for (const key of TILE_KEYS) {
      expect(TILES[key].needs.length).toBeGreaterThan(0);
    }
  });
});

describe('date windows', () => {
  const week: RawData = {
    ...raw,
    window: { since: '2026-08-01T00:00:00Z', until: '2026-08-09T23:59:59Z', label: '1-9 Aug 2026' },
    reviewYears: [
      { year: 2026, reviews: 4, commits: 30, totalContributions: 60, issuesOpened: 3, prsOpened: 6, byRepo: [] },
    ],
  };

  it('puts the period label on the pull-requests card', () => {
    const scoped = aggregate(week);
    expect(scoped.periodLabel).toBe('1-9 Aug 2026');
    const out = toSvg(scoped, 'dark');
    expect(out).toContain('1-9 Aug 2026');
    expect(out).not.toContain('All time');
  });

  it('shows issues opened instead of resolution when windowed', () => {
    const scoped = aggregate(week);
    expect(scoped.issuesClosed).toBeNull();
    const out = toSvg(scoped, 'dark');
    expect(out).toContain('Issues opened');
    expect(out).not.toContain('Issues resolved');
    expect(out).not.toContain('Still open');
  });

  it('renders an empty range with empty-state messages, without throwing', () => {
    const empty = aggregate({ ...week, mergedPrs: [], reviewYears: [] });
    const out = toSvg(empty, 'dark');
    expect(out).toContain('</svg>');
    expect(out).toContain('no external merges in this range');
    expect(out).toContain('no reviews in this range');
    expect(out).toContain('no language data');
    expect(empty.biggestProject).toBeNull();
  });

  it('rejects a range longer than a year and a reversed range', async () => {
    const { buildWindow } = await import('../src/window.js');
    expect(() => buildWindow('2020-01-01', '2026-01-01')).toThrow(/one year or less/);
    expect(() => buildWindow('2026-08-09', '2026-08-01')).toThrow(/after/);
    expect(() => buildWindow('not-a-date')).toThrow(/not a valid date/);
    expect(buildWindow(undefined, undefined)).toBeNull();
  });

  it('labels ranges by shape', async () => {
    const { buildWindow } = await import('../src/window.js');
    expect(buildWindow('2026-08-03', '2026-08-09')!.label).toBe('3–9 Aug 2026');
    expect(buildWindow('2026-07-28', '2026-08-03')!.label).toBe('28 Jul – 3 Aug 2026');
    expect(buildWindow('2026-08-09', '2026-08-09')!.label).toBe('9 Aug 2026');
  });
});

describe('language grid', () => {
  const withLanguages = (count: number, total: number): StatsPayload => ({
    ...stats,
    languages: Array.from({ length: count }, (_, i) => ({
      name: `Lang${i}`,
      repos: count - i,
      color: '#3987e5',
    })),
    languageCount: total,
  });

  it('shows every language when 12 or fewer', () => {
    const out = toSvg(withLanguages(12, 12), 'dark', ['footprint']);
    for (let i = 0; i < 12; i++) expect(out).toContain(`Lang${i}`);
    expect(out).not.toMatch(/>\+\d+</);
  });

  it('rolls overflow into a +N cell when more than 12 languages exist', () => {
    const out = toSvg(withLanguages(12, 20), 'dark', ['footprint']);
    // 11 language cells + one overflow cell covering the other 9.
    expect(out).toContain('Lang10');
    expect(out).not.toContain('Lang11');
    expect(out).toContain('>+9<');
  });

  it('escapes a hostile language color before interpolation', () => {
    const evil: StatsPayload = {
      ...stats,
      languages: [{ name: 'Evil', repos: 1, color: '#f00"><script>' }],
      languageCount: 1,
    };
    const out = toSvg(evil, 'dark', ['footprint']);
    expect(out).not.toContain('<script>');
    expect(out).toContain('&quot;&gt;&lt;script&gt;');
  });
});
