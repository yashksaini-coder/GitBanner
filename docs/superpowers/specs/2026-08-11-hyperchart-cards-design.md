# GitBanner v3 — hyper-chart cards on pure black (approved design)

Repo /home/yks/projects/GitBanner, branch redesign/external-contributions.
User-approved: 3×2 grid of wide cards, gradient area wave for Activity, hex
cluster for Projects, arc meter for Issues, pure black theme. Rejected as
dishonest: 3D bubbles, 3D scatter, rainbow interpolation.

## Theme (pure black, minimal)

theme.ts `dark`:
- bg '#000000', tile '#0a0a0a', tileBorder '#1b1b1b' (stroke-width 1, not 1.5)
- divider '#161616', pillBg '#101010'
- text tokens unchanged (#ffffff / #9ca3af / #6b7280)
- accents unchanged: prs '#3987e5', reviews '#d95926', languages/projects-good
  '#199e70', neutral '#8b949e'. Sequential hex ramp lives in hex.ts.

## Grid (svg.ts)

- CANVAS_W 1600, MARGIN 32, GAP 20.
- Every card is equal width: cardW = floor((1600 - 2*32 - 2*20) / 3) = 498.
  No hero span — the hero concept is gone; all top cards are kind 'card',
  minis kind 'mini'. Rows: chunk cards-of-kind-'card' into rows of 3, then
  minis into rows of 3. Row heights: card rows 360, mini row 140.
- Canvas height computed: 32 + rows*(h+20) ... last row no trailing gap + 32.
  With 2 card rows + 1 mini row: 32+360+20+360+20+140+32 = 964.
- aria-label unchanged in spirit. NO footer.

## Registry (tiles.ts) — keys and order

DEFAULT_TILES = ['merged-prs','activity','ships-in','reviews','projects',
'issues','biggest-project','merge-rate','own-stars']
- 'momentum' key DELETED (Activity absorbs it).
- kinds: first six 'card', last three 'mini'. Exports/signatures unchanged
  (TILES, TILE_KEYS, DEFAULT_TILES, parseTiles, neededData). parseTiles: same
  behavior, no hero rule. needs: merged-prs→prs; activity→prs;
  ships-in→prs; reviews→reviews; projects→prs; issues→issues;
  biggest-project→prs; merge-rate→prs; own-stars→ownRepos.

All six card tiles keep the EXISTING header anatomy (icon box 48 @28,28,
value beside at x92 optically centred, label y112, caption y136, divider
y156) — chart content replaces what sits below the divider. Mini tiles
unchanged except theme. Chart zone: y168..h-16 unless stated.

## Shared data addition (compute.ts + types.ts)

StatsPayload gains:
  monthlyExternalMerges: { label: string; count: number }[]
Exactly 12 entries, trailing 12 calendar months ending with the current
month (UTC), oldest first. label = month's first letter, uppercase
('J','F','M',...). Computed from the same externalPrs list every other
external stat uses (so windowed cards inherit the window naturally).

## New chart primitives (each file self-contained, pure helpers exported)

### render/tiles/wave.ts — Activity area wave
export interface WavePoint { label: string; count: number }
export function monotonePath(pts: {x:number;y:number}[]): string
  — open cubic path through points using Fritsch–Carlson monotone tangents:
  NO overshoot (a smoothing spline that overshoots misstates counts).
export function renderWave(p: { w: number; h: number; points: WavePoint[];
  accent: string; gradId: string; theme: Theme }): string
  — draws in local (0,0)-(w,h): area fill under the curve via vertical
  linearGradient accent 0.30→0 to the baseline; stroke 2.5 accent over a
  blurred glow copy (stdDeviation 4, width 8, opacity 0.45, filter region
  padded -40%/180%); baseline hairline theme.divider; month tick letters
  9px gb-mono textMuted every OTHER month; a 3.5px dot + count label on the
  peak month and on the last month (skip peak label if peak==last).
  All-zero series: flat baseline + centred 13px textMuted
  'no external merges in the last 12 months'. y-scale: max count → top
  padding 12; min bar of the curve rides the baseline.

### render/tiles/hex.ts — Projects hex cluster
export function hexSpiral(n: number): { q: number; r: number }[]
  — axial hex coordinates in ring order: centre, then rings outward,
  deterministic. n up to 200.
export function renderHexCluster(p: { w: number; h: number; values: number[];
  theme: Theme }): string
  — one hex per value, strongest value at the CENTRE, descending outward
  (caller passes values sorted desc). Pointy-top hexes; pick the largest
  hex radius (integer px, ≥5) whose spiral bounding box fits w×h, centred.
  Fill: single-hue blue intensity ramp on black — interpolate
  '#132c49' → '#5598e7' by t = ln(1+v)/ln(1+max) (log scale; the PR
  distribution is heavily skewed). Hairline stroke '#000000' opacity 0.6
  width 1 as the surface gap between cells. No per-hex labels.

### render/tiles/meter.ts — Issues arc meter
export function arcPath(cx:number, cy:number, r:number,
  a0:number, a1:number): string  — SVG arc segment path (angles in radians,
  a0<a1, sweep clockwise, large-arc handled).
export function renderMeter(p: { cx: number; cy: number; r: number;
  pct: number; centerTop: string; centerBottom: string; accent: string;
  theme: Theme }): string
  — 180° semicircle (from 180° to 360° i.e. left to right over the top).
  Track: full arc, stroke 10, round caps, colour = dark step of the SAME
  hue ('#0e3524' for green) per the meter rule (track is a step of the
  ramp, not gray). Fill: pct of the sweep, stroke 10, accent, round caps,
  plus glow copy (blur 4, width 14, opacity 0.4). pct clamped 0..100.
  centerTop (e.g. '440') 24px gb-display textPrimary at cy-2;
  centerBottom (e.g. 'of 516 resolved') 11px gb-text textMuted at cy+16.

### render/tiles/bars.ts — shared horizontal gradient bars
Extract the hero-tile bar rendering into:
export function renderBars(p: { entries: { label: string; value: number }[];
  w: number; pitch: number; gradId: string; gradFrom: string; gradTo: string;
  theme: Theme }): string
  — local (0,0) origin, same visual spec as today's hero bars (name 13px
  secondary above, bar h16 rounded-data-end min 6px, value 13px mono at
  tip+8, track reserves 64px for the value). Emits its own <defs> gradient
  with the given id. hero-tile.ts consumes it (blue #184f95→#3987e5);
  reviews card consumes it (orange #8a3416→#d95926, pitch 42, top 4).

## Card definitions

1. merged-prs — unchanged content (hero-tile layout at new width; bars via
   shared renderBars, 5 entries, pitch 30 as today).
2. activity (NEW, accent prs blue): icon 'trending-up', value
   n(recentExternalPrs), label 'Activity', caption
   periodLabel ?? 'external merges · last 12 months'. Chart: renderWave in
   zone (28, 168)-(w-28, 344).
3. ships-in: radar as today BUT labels revert to tip-side placement now that
   the card is wide: anchor start/end beside the tip when |cos|>0.35
   (dy +4), middle above/below otherwise (dy -6/+13). rMax = min(vertical
   bound, (w-64)/2 - 78) → labels never enter the ring nor leave the card;
   keep the fitText clamp + luminance ink-flip + colour-coded names exactly
   as now. Add a test: every label x-extent estimate stays outside the ring
   horizontally OR the label is in the above/below hemisphere band.
4. reviews (accent orange): header as today; chart renderBars top 4 reviewed
   repos in zone from y176, pitch 42.
5. projects (accent prs blue): header value externalRepoCount, caption
   'hex intensity = merged PRs'. renderHexCluster zone (28,168)-(w-28, 296)
   with values = externalRepos.map(r=>r.mergedPrs) (already sorted desc).
   Below: two rows (existing dot-row style, y 320 and 352):
   top-2 external repos by stars, value '{stars} stars'.
6. issues (accent '#199e70'): header value '{pct}%', label 'Issues resolved',
   caption '{resolved} of {filed} you filed'. renderMeter cx w/2 cy 268
   r 78, centerTop n(resolved), centerBottom 'of n(opened) resolved'.
   Rows at y 320/352: Opened / Still open (Resolved lives in the meter).
   Windowed (issuesClosed null): no meter — value n(issuesOpened), label
   'Issues opened', caption periodLabel, single row as today.
7-9. minis biggest-project / merge-rate / own-stars unchanged.

## Test contract

- compute: monthlyExternalMerges has 12 entries, sums to the count of
  external merges in the trailing 12 months (align with recentExternalPrs
  definition where window-compatible), oldest-first labels correct for a
  fixed injected 'now'? (compute uses Date.now(): test with relative
  assertions — sum ≤ prsMergedExternal, entries 12, counts ≥ 0; plus a
  synthetic RawData with known mergedAt dates asserting bucket placement.)
- wave: monotonePath emits M + C segments through all points, no overshoot:
  for monotile increasing data, path y-coords stay within [min,max].
- hex: hexSpiral(1)=[{0,0}]; hexSpiral(8) first ring correct length (1+6+1);
  ring order deterministic; renderHexCluster emits n polygons and the
  strongest value maps to the brightest fill.
- meter: arcPath endpoints at expected coords (tolerance); pct 0 and 100
  render; pct clamped.
- render: default banner contains 'Activity', a wave path, hex polygons,
  meter arcs; NO 'Last 12 months' mini (momentum gone); 9 keys in registry;
  radar labels present; black theme: svg contains fill="#000000" canvas and
  '#0a0a0a' tiles. Old footer/star guards keep passing.
- All existing tests keep passing except those asserting the removed
  momentum tile / old layout specifics — update those.

## Ownership map (three agents)

- Agent WAVE-DATA: src/types.ts, src/compute.ts, src/render/tiles/wave.ts,
  tests/activity.test.ts (new). Do not touch anything else.
- Agent HEX-METER: src/render/tiles/hex.ts, src/render/tiles/meter.ts,
  src/render/tiles/bars.ts, tests/charts.test.ts (new). Do not touch
  anything else (NOT hero-tile.ts — integration rewires it).
- Agent INTEGRATE (runs after both): src/render/theme.ts, src/render/svg.ts,
  src/tiles.ts, src/render/tiles/hero-tile.ts (switch to shared bars),
  src/render/tiles/radar.ts + languages-tile.ts (label scheme + wide rMax),
  src/render/tiles/mini-tile.ts (only if a theme constant forces it),
  tests/render.test.ts. Runs typecheck + full suite green before returning.

Hard rules: no git commits; follow existing escapeXml/fitText discipline;
rounding r2() for coords; unique gradient/filter ids per tile key.
