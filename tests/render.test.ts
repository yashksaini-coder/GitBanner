import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregate } from '../src/compute.js';
import { toSvg } from '../src/render/svg.js';
import { dark } from '../src/render/theme.js';
import { renderLanguagesChart } from '../src/render/tiles/languages-tile.js';
import { polygonPath, radarLabelLayout, radarLayout } from '../src/render/tiles/radar.js';
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
    expect(svg).toContain('Pull requests');
    expect(svg).toContain('Projects shipped to');
    expect(svg).not.toContain('Combined reach');
  });

  it('shows the issues resolution rate below a yearly issues wave', () => {
    const pct = Math.round((stats.issuesClosed! / stats.issuesOpened) * 100);
    expect(svg).toContain(`${pct}%`);
    expect(svg).toContain('url(#gbi-wave)');
    expect(svg).toContain('finishing what you file');
    expect(svg).not.toContain('Contributing since');
  });

  it('card headers carry a title, not an icon box or beside-icon value', () => {
    // The 48px icon boxes are gone from chart cards; minis keep small icons.
    expect(svg).not.toContain('width="48" height="48"');
    expect(svg).toContain('Code review');
    expect(svg).toContain('Activity');
  });

  it('replaces the momentum mini with the Activity wave card', () => {
    expect(svg).toContain('Activity');
    expect(svg).toContain('url(#gba-wave)');
    expect(svg).toContain('external merges');
    // the old mini is gone
    expect(svg).not.toContain('Last 12 months');
    expect(TILES['momentum']).toBeUndefined();
  });

  it('draws the heat hex cluster with its scale legend', () => {
    expect(svg).toContain('<polygon points=');
    expect(svg).toContain('one hex per project');
    expect(svg).toContain('gbx-hex-legend');
    // heat ramp endpoints: cold slate low, gold core high
    expect(svg.toLowerCase()).toContain('#f2c14e');
  });

  it('rows carry merged-PR counts, not stars, on the projects card', () => {
    expect(svg).toMatch(/\d+ merged</);
    // stars survive only in the mini row (stars earned / biggest project)
    const projectsCard = svg.slice(svg.indexOf('Projects shipped to'), svg.indexOf('Issues'));
    expect(projectsCard).not.toContain('stars');
  });

  it('renders the pure-black theme', () => {
    expect(svg).toContain(`fill="#000000"`);
    expect(svg).toContain('#0a0a0a');
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
    const svgA = toSvg(stats, 'dark', ['merged-prs', 'reviews']);
    const svgB = toSvg(stats, 'dark', ['reviews', 'merged-prs']);
    expect(svgA).not.toContain('Projects shipped to');
    expect(svgA.indexOf('Pull requests')).toBeLessThan(svgA.indexOf('Code review'));
    expect(svgB.indexOf('Code review')).toBeLessThan(svgB.indexOf('Pull requests'));
  });

  it('registers six equal cards and three minis, momentum gone', () => {
    expect(TILE_KEYS).toHaveLength(9);
    expect(TILE_KEYS.filter((k) => TILES[k].kind === 'card')).toHaveLength(6);
    expect(TILE_KEYS.filter((k) => TILES[k].kind === 'mini')).toHaveLength(3);
    expect(() => parseTiles('merged-prs,activity,issues')).not.toThrow();
    expect(() => parseTiles('momentum')).toThrow(/Unknown tile/);
  });

  it('gives every card the same 498px column width', () => {
    const widths = [...svg.matchAll(/<rect width="(\d+)" height="370"/g)].map((m) =>
      Number(m[1]),
    );
    expect(widths).toHaveLength(6);
    for (const w of widths) expect(w).toBe(498);
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
    expect(neededData(['issues'])).toEqual(new Set(['issues', 'reviews']));
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
  function render(languages: { name: string; color: string; repos: number }[], overflow = 0): string {
    return renderLanguagesChart({
      x: 0,
      y: 0,
      w: 442,
      h: 160,
      languages,
      overflow,
      theme: dark,
    });
  }

  const lang = (name: string, repos: number, color = '#3178c6') => ({ name, color, repos });

  it('renders a straight-edged radar with one colour dot per language at 3+ axes', () => {
    const tile = render([lang('Python', 18), lang('Rust', 9, '#dea584'), lang('Go', 4, '#00add8')]);
    expect(tile).toContain('gbr-glow');
    expect([...tile.matchAll(/class="gbr-dot"/g)]).toHaveLength(3);
    expect(tile).toContain('#dea584');
    // single accent stroke, not a per-segment gradient
    expect(tile).not.toContain('<linearGradient');
    for (const name of ['Python', 'Rust', 'Go']) expect(tile).toContain(name);
    // pills fallback must not render alongside the radar
    expect(tile).not.toContain('rx="8"');
  });

  it('caps the radar at 8 axes however many languages exist', () => {
    const many = Array.from({ length: 14 }, (_, i) => lang(`L${i}`, 14 - i));
    const tile = render(many, 0);
    expect([...tile.matchAll(/class="gbr-dot"/g)]).toHaveLength(8);
    expect(tile).not.toContain('L9');
  });

  it('falls back to pills below 3 axes and to a message at zero', () => {
    const two = render([lang('Python', 3), lang('Go', 1)], 4);
    expect(two).not.toContain('gbr-glow');
    expect(two).toContain('+4');
    const none = render([], 0);
    expect(none).toContain('no language data');
  });

  it('colour-codes each label to its vertex dot, flipping dark colours to ink', () => {
    const tile = render([
      lang('Python', 18, '#3572a5'),
      lang('PowerShell', 9, '#012456'), // too dark to read on the tile
      lang('Go', 4, '#00add8'),
    ]);
    expect(tile).toMatch(/fill="#3572a5">Python</);
    expect(tile).toMatch(/fill="#00add8">Go</);
    // dark brand colour renders in ink, but its vertex dot keeps the colour
    expect(tile).toMatch(/fill="#ffffff">PowerShell</);
    expect(tile).toMatch(/class="gbr-dot"[^/]*fill="#012456"/);
  });

  it('keeps full language names visible instead of hard-truncating', () => {
    const tile = render([
      lang('JavaScript', 20, '#f1e05a'),
      lang('TypeScript', 15, '#3178c6'),
      lang('Dockerfile', 8, '#384d54'),
      lang('PowerShell', 4, '#012456'),
    ]);
    for (const name of ['JavaScript', 'TypeScript', 'Dockerfile', 'PowerShell']) {
      expect(tile).toContain(`>${name}<`);
    }
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

  it('draws a closed straight-edged polygon through every point', () => {
    const pts = radarLayout([3, 1, 4, 1, 5], 50, 50, 8, 40);
    const d = polygonPath(pts);
    expect(d.startsWith(`M ${pts[0].x} ${pts[0].y}`)).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    // straight lines only — a curve command would mean overshoot is possible
    expect(d).not.toMatch(/[CQSTA]/);
    expect([...d.matchAll(/L /g)]).toHaveLength(pts.length - 1);
  });

  it('keeps every label clear of the ring: tip-anchored outward or in the vertical band', () => {
    // Real card geometry: w=498 → cx 249, rMax min(74, 139) = 74.
    const cx = 249, cy = 256, rMax = 74;
    for (let axes = 3; axes <= 8; axes++) {
      for (const pos of radarLabelLayout(axes, cx, cy, rMax)) {
        if (Math.abs(pos.cos) <= 0.35) {
          // Above/below hemisphere band: centred, pushed away from the ring.
          expect(pos.anchor).toBe('middle');
          expect(Math.abs(pos.y - cy)).toBeGreaterThanOrEqual((rMax + 9) * Math.abs(pos.sin));
        } else {
          // Side spoke: anchored at the tip, text grows away from the ring —
          // sample a worst-case 90px x-extent and prove it never re-enters.
          expect(pos.anchor).toBe(pos.cos > 0 ? 'start' : 'end');
          const dir = pos.cos > 0 ? 1 : -1;
          for (let t = 0; t <= 90; t += 10) {
            expect(Math.hypot(pos.x + dir * t - cx, pos.y - cy)).toBeGreaterThan(rMax);
          }
        }
      }
    }
  });

  it('never crosses the outer ring, whatever the value pattern', () => {
    const cx = 120, cy = 130, rMin = 10, rMax = 60;
    const patterns = [
      [36, 35, 25, 21, 18, 15, 14, 7], // live-like
      [1, 100, 1, 100, 1, 100],        // alternating extremes (worst spline case)
      [100, 100, 100],                 // everything at the ring
      [0, 0, 0, 1],                    // floor territory
    ];
    for (const values of patterns) {
      const pts = radarLayout(values, cx, cy, rMin, rMax);
      for (const pt of pts) {
        expect(Math.hypot(pt.x - cx, pt.y - cy)).toBeLessThanOrEqual(rMax + 0.01);
      }
      // A straight chord between two in-ring points stays in the ring; assert
      // it anyway at midpoints so a future smoothing regression fails loudly.
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        expect(Math.hypot(mid.x - cx, mid.y - cy)).toBeLessThanOrEqual(rMax + 0.01);
      }
    }
  });
});
