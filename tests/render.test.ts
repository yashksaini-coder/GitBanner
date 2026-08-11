import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregate } from '../src/compute.js';
import { toSvg } from '../src/render/svg.js';
import { dark } from '../src/render/theme.js';
import { renderLanguagesTile } from '../src/render/tiles/languages-tile.js';
import { closedSegments, radarLayout } from '../src/render/tiles/radar.js';
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

describe('language chart', () => {
  const TILE_H = 410;

  function render(languages: { name: string; color: string; repos: number }[], overflow = 0): string {
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

  const lang = (name: string, repos: number, color = '#3178c6') => ({ name, color, repos });

  it('renders a radar with one gradient segment per language at 3+ axes', () => {
    const tile = render([lang('Python', 18), lang('Rust', 9, '#dea584'), lang('Go', 4, '#00add8')]);
    expect(tile).toContain('gbr-glow');
    expect([...tile.matchAll(/id="gbr-seg-\d+"/g)]).toHaveLength(3);
    for (const name of ['Python', 'Rust', 'Go']) expect(tile).toContain(name);
    // pills fallback must not render alongside the radar
    expect(tile).not.toContain('rx="8"');
  });

  it('caps the radar at 8 axes however many languages exist', () => {
    const many = Array.from({ length: 14 }, (_, i) => lang(`L${i}`, 14 - i));
    const tile = render(many, 0);
    expect([...tile.matchAll(/id="gbr-seg-\d+"/g)]).toHaveLength(8);
    expect(tile).not.toContain('L9');
  });

  it('falls back to pills below 3 axes and to a message at zero', () => {
    const two = render([lang('Python', 3), lang('Go', 1)], 4);
    expect(two).not.toContain('gbr-glow');
    expect(two).toContain('+4');
    const none = render([], 0);
    expect(none).toContain('no language data');
  });

  it('escapes hostile colour strings before interpolating them', () => {
    const tile = render([
      lang('A', 3, '"/><script>x</script>'),
      lang('B', 2),
      lang('C', 1),
    ]);
    expect(tile).not.toContain('<script>');
  });
});

describe('radar geometry', () => {
  it('puts the first axis straight up and spaces axes evenly', () => {
    const pts = radarLayout([5, 5, 5, 5], 100, 100, 10, 60);
    expect(pts[0]).toEqual({ x: 100, y: 40 }); // top
    expect(pts[1]).toEqual({ x: 160, y: 100 }); // right
    expect(pts[2]).toEqual({ x: 100, y: 160 }); // bottom
    expect(pts[3]).toEqual({ x: 40, y: 100 }); // left
  });

  it('scales radius with value and floors tiny values off the hub', () => {
    const pts = radarLayout([10, 5, 0], 0, 0, 10, 60);
    const r = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);
    expect(r(pts[0])).toBeCloseTo(60, 1);
    expect(r(pts[1])).toBeCloseTo(35, 1);
    // zero value sits at the 18% floor, not at the hub
    expect(r(pts[2])).toBeGreaterThan(10 + 0.17 * 50);
  });

  it('emits one seamless segment per point, closing the loop', () => {
    const pts = radarLayout([3, 1, 4, 1, 5], 50, 50, 8, 40);
    const segs = closedSegments(pts);
    expect(segs).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      const next = pts[(i + 1) % 5];
      expect(segs[i].startsWith(`M ${pts[i].x} ${pts[i].y} `)).toBe(true);
      expect(segs[i].endsWith(`${next.x} ${next.y}`)).toBe(true);
    }
  });
});
