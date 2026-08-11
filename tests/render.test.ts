import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregate } from '../src/compute.js';
import { toSvg } from '../src/render/svg.js';
import { dark } from '../src/render/theme.js';
import { renderLanguagesTile } from '../src/render/tiles/languages-tile.js';
import { DEFAULT_TILES, neededData, parseTiles, TILE_KEYS, TILES } from '../src/tiles.js';
import type { RawData } from '../src/types.js';

const raw = JSON.parse(
  readFileSync(new URL('./fixtures/raw.json', import.meta.url), 'utf8'),
) as RawData;

const stats = aggregate(raw);

describe('toSvg', () => {
  const svg = toSvg(stats, 'dark');

  it('produces a well-formed root <svg>', () => {
    expect(svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(svg).toMatch(/<svg [^>]*width="1600"/);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it('renders the external contribution headline numbers', () => {
    expect(svg).toContain(stats.prsMergedExternal.toLocaleString('en-US'));
    expect(svg).toContain("Merged into other people&apos;s repos");
    expect(svg).toContain('Projects shipped to');
    expect(svg).not.toContain('Combined reach');
  });

  it('leads the issues tile with the resolution rate', () => {
    expect(svg).toContain('Issues resolved');
    const pct = Math.round((stats.issuesClosed! / stats.issuesOpened) * 100);
    expect(svg).toContain(`${pct}%`);
    expect(svg).not.toContain('Contributing since');
  });

  it('shows trailing-12-month momentum', () => {
    expect(svg).toContain('Last 12 months');
    expect(svg).toContain('external merges');
  });

  it('shows stars earned with the highest-starred own repo', () => {
    expect(svg).toContain('Stars earned');
    expect(svg).toContain(stats.ownTopRepo!.name);
  });

  it('ships-in lists all languages with a +N overflow, never just the primary', () => {
    expect(svg).toContain('Ships in');
    expect(svg).toContain(String(stats.languageCount));
    // At least one language beyond each repo's primary must appear as a pill.
    const primaries = new Set(stats.externalRepos.map((r) => r.languages[0]?.name));
    const secondary = stats.languages.find((l) => !primaries.has(l.name));
    if (secondary) expect(svg).toContain(secondary.name);
  });

  it('names the biggest external project and the merge rate', () => {
    expect(svg).toContain(stats.biggestProject!.name);
    expect(svg).toContain(`${stats.mergeRatePct}%`);
  });

  it('carries no trace of the removed persona feature', () => {
    for (const word of ['persona', 'Open Source Star', 'Rising Dev', 'Polyglot', 'Veteran']) {
      expect(svg).not.toContain(word);
    }
  });

  it('height follows the selected tiles instead of being fixed', () => {
    const both = toSvg(stats, 'dark', ['merged-prs', 'merge-rate']);
    const statOnly = toSvg(stats, 'dark', ['merged-prs']);
    const miniOnly = toSvg(stats, 'dark', ['merge-rate']);

    const heightOf = (s: string) => Number(/height="(\d+)"/.exec(s)![1]);
    expect(heightOf(statOnly)).toBeLessThan(heightOf(both));
    expect(heightOf(miniOnly)).toBeLessThan(heightOf(statOnly));
  });

  it('renders every tile in the registry without throwing', () => {
    for (const key of TILE_KEYS) {
      const out = toSvg(stats, 'dark', [key]);
      expect(out).toContain('</svg>');
    }
  });

  it('honours tile order', () => {
    const hero = "Merged into other people&apos;s repos";
    const svgA = toSvg(stats, 'dark', ['merged-prs', 'reviews']);
    const svgB = toSvg(stats, 'dark', ['reviews', 'merged-prs']);
    expect(svgA).not.toContain('Projects shipped to');
    expect(svgA.indexOf(hero)).toBeLessThan(svgA.indexOf('Reviews for others'));
    expect(svgB.indexOf('Reviews for others')).toBeLessThan(svgB.indexOf(hero));
  });

  it('allows only one hero tile', () => {
    expect(() => parseTiles('merged-prs')).not.toThrow();
    const heroes = TILE_KEYS.filter((k) => TILES[k].kind === 'hero');
    expect(heroes).toEqual(['merged-prs']);
  });

  it('gives the hero roughly double the width of a stat tile', () => {
    const svgOut = toSvg(stats, 'dark', ['merged-prs', 'reviews', 'projects']);
    const widths = [...svgOut.matchAll(/<rect width="(\d+)" height="360"/g)].map((m) =>
      Number(m[1]),
    );
    expect(widths).toHaveLength(3);
    expect(widths[0]).toBeGreaterThan(widths[1] * 1.8);
    expect(widths[1]).toBe(widths[2]);
  });

  it('renders no footer line and no unrenderable star glyph', () => {
    expect(svg).not.toContain('gitbanner ·');
    expect(svg).not.toMatch(/updated \d{4}-\d{2}-\d{2}/);
    // U+2605 is absent from the embedded font subsets and would vanish.
    expect(svg).not.toContain('★');
  });
});

describe('tile selection', () => {
  it('defaults to the full set when no input is given', () => {
    expect(parseTiles(undefined)).toEqual(DEFAULT_TILES);
    expect(parseTiles('')).toEqual(DEFAULT_TILES);
    expect(parseTiles('   ')).toEqual(DEFAULT_TILES);
  });

  it('rejects an unknown tile instead of silently dropping it', () => {
    expect(() => parseTiles('merged-prs,typo-here')).toThrow(/Unknown tile/);
  });

  it('trims, orders, and de-duplicates', () => {
    expect(parseTiles(' reviews , merged-prs ,reviews')).toEqual(['reviews', 'merged-prs']);
  });

  it('only asks for the data the selected tiles need', () => {
    // The whole point of pass 2: no own-repo tile means no repo pagination.
    expect([...neededData(['merged-prs'])]).toEqual(['prs']);
    expect([...neededData(['reviews'])]).toEqual(['reviews']);
    expect(neededData(['merged-prs', 'projects', 'ships-in']).has('ownRepos')).toBe(false);
    expect('reach' in TILES).toBe(false);
    expect(neededData(['own-stars']).has('ownRepos')).toBe(true);
    expect(neededData(DEFAULT_TILES)).toEqual(new Set(['prs', 'reviews', 'issues', 'ownRepos']));
  });

  it('every registered tile declares at least one need', () => {
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

  it('keeps only PRs merged inside the range', () => {
    const scoped = aggregate(week);
    const inRange = raw.mergedPrs.filter(
      (p) => p.mergedAt >= '2026-08-01' && p.mergedAt <= '2026-08-10' && !p.repo.isPrivate,
    );
    expect(scoped.prsMerged).toBeLessThanOrEqual(inRange.length);
    expect(scoped.prsMergedExternal).toBeLessThanOrEqual(aggregate(raw).prsMergedExternal);
  });

  it('takes windowed PR and issue totals from contributions, not all-time counts', () => {
    const scoped = aggregate(week);
    expect(scoped.prsOpened).toBe(6);
    expect(scoped.issuesOpened).toBe(3);
    // GitHub exposes issues opened in a window but not issues closed in one.
    expect(scoped.issuesClosed).toBeNull();
  });

  it('labels the period and shows it on the card', () => {
    const scoped = aggregate(week);
    expect(scoped.periodLabel).toBe('1-9 Aug 2026');
    expect(toSvg(scoped, 'dark')).toContain('1-9 Aug 2026');
  });

  it('renders an empty range without breaking any tile', () => {
    const empty = aggregate({ ...week, mergedPrs: [] });
    const out = toSvg(empty, 'dark');
    expect(out).toContain('</svg>');
    expect(out).toContain('no external merges yet');
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

describe('language pills', () => {
  const TILE_H = 410;
  const PILLS_Y = 176;
  const AVAILABLE = TILE_H - PILLS_Y - 18;

  function pillOffsets(tile: string): number[] {
    const container = `translate(32, ${PILLS_Y})`;
    const inner = tile.slice(tile.indexOf(container) + container.length);
    return [...inner.matchAll(/translate\((\d+), (\d+)\)/g)].map((m) => Number(m[2]));
  }

  function render(languages: { name: string; color: string }[], overflow: number): string {
    return renderLanguagesTile({
      x: 0,
      y: 0,
      w: 296,
      h: TILE_H,
      iconKey: 'code-brackets',
      accent: '#3987e5',
      count: languages.length + overflow,
      label: 'Ships in',
      caption: 'all languages',
      languages,
      overflow,
      theme: dark,
    });
  }

  it('lays out a normal set without dropping anything', () => {
    const langs = ['Python', 'Rust', 'Go', 'CSS'].map((name) => ({ name, color: '#fff' }));
    const tile = render(langs, 3);
    for (const lang of langs) expect(tile).toContain(lang.name);
    expect(tile).toContain('+3');
  });

  it('never lets a pill escape the tile, however long the names are', () => {
    const langs = Array.from({ length: 8 }, (_, i) => ({
      name: `VeryLongLanguageName${i}`,
      color: '#fff',
    }));
    const tile = render(langs, 15);
    const offsets = pillOffsets(tile);
    expect(offsets.length).toBeGreaterThan(0);
    expect(Math.max(...offsets) + 30).toBeLessThanOrEqual(AVAILABLE);
  });

  it('rolls dropped languages into the +N pill rather than silently losing them', () => {
    const langs = Array.from({ length: 8 }, (_, i) => ({
      name: `VeryLongLanguageName${i}`,
      color: '#fff',
    }));
    const tile = render(langs, 15);
    const shown = langs.filter((l) => tile.includes(l.name)).length;
    expect(tile).toContain(`+${15 + (langs.length - shown)}`);
  });
});
