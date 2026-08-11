import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregate } from '../src/compute.js';
import { toSvg } from '../src/render/svg.js';
import { dark } from '../src/render/theme.js';
import { renderLanguagesChart } from '../src/render/tiles/languages-tile.js';
import { radarLabelLayout, radarLayout } from '../src/render/tiles/radar.js';
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

  it('pull requests card is a popularity-spectrum area, top repo in the stats', () => {
    expect(svg).toContain('url(#gbh-wave)');
    expect(svg).not.toContain('gbh-cols');
    expect(svg).toContain('popularity spectrum');
    for (const label of ['&lt;10', '10+', '100+', '1k+', '10k+']) {
      expect(svg).toContain(label);
    }
    // the top-repo stat is the YEAR's leader (all-time fallback when empty)
    const yearTop = stats.topExternalThisYear[0] ?? {
      name: stats.externalRepos[0].name,
      value: stats.externalRepos[0].mergedPrs,
    };
    expect(svg).toContain(yearTop.name);
    expect(svg).toContain(`top repo · ${yearTop.value.toLocaleString('en-US')} merged`);
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

  it('activity is gradient columns of the trailing 12 months', () => {
    expect(svg).toContain('Activity');
    expect(svg).toContain('external merges per month');
    expect(svg).toContain('url(#gba-cols)');
    // U+00D7 stays banned: outside the font subsets it renders as a hole
    expect(svg).not.toContain('×');
    expect(TILES['momentum']).toBeUndefined();
  });

  it('draws the heat hex cluster with rank falloff and a ghost ring', () => {
    expect(svg).toContain('<polygon points=');
    expect(svg).toContain('one hex per open source project');
    // the legend strip and dot-rows were removed by design
    expect(svg).not.toContain('-legend');
    // heat ramp endpoints: cold slate low, gold core high
    expect(svg.toLowerCase()).toContain('#f2c14e');
    // ghost texture ring: present, uniform near-background fill, never heat
    const ghosts = [...svg.matchAll(/class="gbx-ghost"/g)];
    expect(ghosts.length).toBeGreaterThan(0);
    expect(svg).toMatch(/class="gbx-ghost"[^/]*fill="#15151a"/);
  });

  it('projects card carries collective open-source metrics, not stars', () => {
    expect(svg).toContain('maintainers &amp; orgs');
    expect(svg).toContain('most in one repo');
    const projectsCard = svg.slice(svg.indexOf('Projects shipped to'), svg.indexOf('Issues'));
    expect(projectsCard).not.toContain('stars');
  });

  it('every card ends in a stat row, not dot rows', () => {
    expect(svg).not.toContain('Opened'); // folded into the issues stat trio
    expect(svg).toContain(`of ${stats.issuesOpened.toLocaleString('en-US')} opened`);
  });

  it('renders the pure-black theme', () => {
    expect(svg).toContain(`fill="#000000"`);
    expect(svg).toContain('#0a0a0a');
  });

  it('minis show top-3 leaderboards with sparklines', () => {
    expect(svg).toContain('Stars earned ·');
    expect(svg).toContain('Top projects ·');
    // top-3 rows: every listed repo appears with its value
    const list = stats.topExternalThisYear.length > 0 ? stats.topExternalThisYear : stats.externalRepos.map((r) => ({ name: r.name, value: r.mergedPrs }));
    for (const row of list.slice(0, 3)) {
      expect(svg).toContain(`${row.value.toLocaleString('en-US')} merged`);
    }
    for (const repo of stats.ownTopRepos.slice(0, 3)) {
      expect(svg).toContain(`${repo.stars.toLocaleString('en-US')} stars`);
      expect(svg).toContain(repo.name);
    }
    expect(svg).toContain('spark: merges per month');
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
      count: languages.length + overflow,
      theme: dark,
    });
  }

  const lang = (name: string, repos: number, color = '#3178c6') => ({ name, color, repos });

  it('renders a burst with one coloured ray per language and the total in the hub', () => {
    const tile = render([lang('Python', 18), lang('Rust', 9, '#dea584'), lang('Go', 4, '#00add8')]);
    expect([...tile.matchAll(/class="gbr-ray"/g)]).toHaveLength(3);
    expect(tile).toContain('#dea584');
    expect(tile).toContain('gbr-ray-glow');
    // hub shows the count (3 languages + 0 overflow)
    expect(tile).toMatch(/font-size="14"[^>]*>3</);
    // filler ticks: two per gap, uniform structure
    expect([...tile.matchAll(/stroke-width="1"\/>/g)].length).toBeGreaterThanOrEqual(6);
    for (const name of ['Python', 'Rust', 'Go']) expect(tile).toContain(name);
    // pills fallback must not render alongside the burst
    expect(tile).not.toContain('rx="8"');
  });

  it('caps the burst at 8 rays however many languages exist', () => {
    const many = Array.from({ length: 14 }, (_, i) => lang(`L${i}`, 14 - i));
    const tile = render(many, 0);
    expect([...tile.matchAll(/class="gbr-ray"/g)]).toHaveLength(8);
    expect(tile).not.toContain('L9');
  });

  it('falls back to pills below 3 axes and to a message at zero', () => {
    const two = render([lang('Python', 3), lang('Go', 1)], 4);
    expect(two).not.toContain('gbr-ray');
    expect(two).toContain('+4');
    const none = render([], 0);
    expect(none).toContain('no language data');
  });

  it('separates the count from the name with dx, immune to whitespace collapsing', () => {
    const tile = render([lang('Rust', 4, '#dea584'), lang('Python', 18), lang('Go', 2, '#00add8')]);
    // A literal "Rust4" (no gap) must never appear; the count rides a dx tspan.
    expect(tile).toMatch(/>Rust<tspan[^>]*dx="5"/);
    expect(tile).not.toMatch(/>Rust4</);
  });

  it('colour-codes each label to its ray, flipping dark colours to ink', () => {
    const tile = render([
      lang('Python', 18, '#3572a5'),
      lang('PowerShell', 9, '#012456'), // too dark to read on the tile
      lang('Go', 4, '#00add8'),
    ]);
    expect(tile).toMatch(/fill="#3572a5">Python</);
    expect(tile).toMatch(/fill="#00add8">Go</);
    // dark brand colour renders in ink, but its ray keeps the colour
    expect(tile).toMatch(/fill="#ffffff">PowerShell</);
    expect(tile).toMatch(/class="gbr-ray"[^/]*stroke="#012456"/);
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
    }
  });
});
