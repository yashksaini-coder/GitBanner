# Changelog

All notable changes to GitBanner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed — PR candles

- Pull requests renders the year's top repos as candle-style ranked bars:
  centre-anchored on a midline (symmetric, so the floating look never
  misstates a value — length is the number, like the stream's thickness),
  rounded caps, value labels on the top three, rank ticks 01..n beneath.
  Repo names live one card down in the Top projects leaderboard, and the
  caption says so. The dash-segment rows retire.

### Changed — issues stream, PR dash leaderboard

- Issues renders as a symmetric stream: band thickness = issues opened per
  year, hairline measure lines with pill value labels alternating above and
  below, monotone edges so the band cannot bulge past its stations.
- Pull requests becomes a dash-segment leaderboard of the current year's
  top 5 repos — rounded dashes filled in proportion to merges, dim track
  segments for the remainder, exact value per row; the third stat becomes
  projects-this-year (the top repo is now the first row). The popularity
  spectrum data stays in the payload for windowed/other uses.

### Changed — activity columns, hex haze

- The Activity card renders the trailing 12 months as gradient columns
  (value on every cap, month letter under every base, rounded tops,
  square baselines); the Pull requests card keeps its popularity-spectrum
  area wave.
- The projects hex gains the reference's periphery: data cells shrink
  slightly per ring (ring order is rank order, so the falloff double-encodes
  the truth) and a single ring of tiny near-background ghost hexes provides
  the haze — unmistakably texture, never heat-coloured, dropped entirely
  when the zone is too small to fit it.

### Changed — language burst, year-scoped top repo

- The ships-in chart becomes a radial burst, reference style: one glowing
  ray per language in its own colour, length = projects using it, the total
  in a centre hub, thin uniform filler ticks for density (structure, never
  data). The polygon radar retires.
- The Pull requests card's top-repo stat now names the CURRENT year's
  leader, matching the chart's year scope (all-time fallback when the year
  is empty). Nothing else on that card changed.

### Changed — weighted language counting, full-body radar

- **A language now needs real weight to count for a repo**: at least 8% of
  its linguist bytes, or being the primary language. Presence-counting had
  inflated incidental slivers — a lone committed JS helper or an unminified
  dist/ bundle made a repo "use JavaScript". On the author's data JavaScript
  fell 35 → 14 repos and TypeScript (17) became the honest #1; Dockerfile,
  Makefile and Batchfile — near-always tiny files — left the chart entirely.
  Language byte sizes now ride along on the existing query.
- The ships-in stat trio is gone; the radar takes the whole card body
  (radius ~120px, up from 98). Connecting lines are quiet ink instead of
  neon green with no glow; vertex dots grow to r5.5 and carry all the
  colour identity.

### Changed — reference-style mini row

- Top projects and Stars earned show true top-3 leaderboards: ranked rows
  with names AND values (the card total moves into the title), sparkline
  intact. Merge rate keeps the big-value anatomy — it is a single number.

- The three bottom minis adopt the compact reference anatomy: bold title,
  big value with an honest green delta where one exists, muted sub-line,
  and a rounded-bar sparkline on the right (bottom-anchored — the candle
  look without centre-anchored bars misstating values). Icons removed.
- **Top projects** replaces Biggest project: this calendar year's external
  ranking (falls back to all time when the year is empty, labelled), top-3
  named in the card, top-8 as the sparkline, the #1's merge count as the
  delta.
- **Merge rate** sparks the last 12 months of external merges.
- **Stars earned** names the top-2 own repos and sparks the top 8 by stars.

### Changed — year-scoped spectrum, review ridgeline

- The Pull requests popularity spectrum now charts the CURRENT year's merges
  (windowed cards keep their window); the caption names the year, and the
  all-time headline stays in the stat trio.
- Code review becomes a ridgeline, reference style: one ridge per reviewed
  repo (top 6 external), x = years, height = reviews that year on a shared
  scale, depth hues violet→blue→green back to front, each ridge labelled
  with its repo name. Built entirely from the per-year data already fetched;
  the one-turn-old 3D scatter and its reviewPoints payload retire.

### Changed — Pull requests becomes a popularity-spectrum area chart

- The hero bars give way to an area-under-the-curve chart of merged PRs
  across fixed star-magnitude decades (<10, 10+, 100+, 1k+, 10k+) — where
  your work lands on the popularity spectrum. Fixed buckets keep charts
  comparable across users and over time; the spectrum is built from ALL
  external merges (drive-by PRs into huge repos belong in the top decade),
  so the area sums exactly to the merged-for-others headline. The #1 repo
  moves into the stat trio; the shared bars renderer is retired.

### Changed — Code review becomes a 3D scatter

- The reviews card's bars are now an isometric 3D scatter, reference style:
  each glowing dot is one repo × one year of reviews, with three honest axes
  from data already fetched — x = repo stars (log), depth = year, height =
  reviews given (sqrt-spread; the 0/max axis labels stay exact). Full cube
  wireframe so every point reads inside the chart; far-to-near draw order;
  the busiest repo-year is direct-labelled. Zero new API cost.

### Changed — bigger charts, collective stat trios

- Dot rows and the hex scale legend are gone; every card ends in an aligned
  three-column stat row instead, and the chart zone grows ~40% (radar radius
  +50%, hex cluster nearly doubles).
- Projects card focuses on the collective open-source story: projects,
  **distinct maintainers & orgs shipped for**, and most merged into one repo.
- New third stats: last-12-months on Pull requests, avg-per-month on
  Activity, projects-using-top-language on Ships in, external share on Code
  review; the Issues opened/resolved rows folded into its trio.

### Changed — reference card anatomy

- Chart cards adopt the hyper-chart anatomy end to end: bold title (icons
  removed — the chart is the identity), the chart given the freed space, the
  headline numbers BELOW the chart as a two-column stat pair, metric rows at
  the bottom.
- **Projects hex goes heat**: cold slate → ember → gold core, log-scaled,
  with the scale legend that licenses a multi-hue sequential ramp. Its rows
  now show merged-PR counts instead of stars.
- **Issues card gets a yearly wave** of issues you opened (the resolution
  rate and still-open count sit below it); the arc meter is retired.
- **Activity wave** gains faint gridlines and a ridge-style green→blue→violet
  stroke gradient, plus a best-month stat.

### Changed — hyper-chart cards on pure black

- **Three-column card grid** (1600x964): six chart cards in two rows plus a
  mini row, equal widths, pure-black canvas (#000000) with near-black cards.
- **New Activity card**: external merges per month for the trailing 12
  calendar months as a monotone-cubic gradient area wave (Fritsch-Carlson
  tangents — the curve cannot overshoot the data). Absorbs the momentum mini;
  the `momentum` tile key is gone, `activity` replaces it.
- **Projects card gains a hex cluster**: one hexagon per external project,
  spiral-packed strongest-first, single-hue intensity ramp (log-scaled — the
  PR distribution is heavily skewed).
- **Issues card gains an arc meter** for the resolution rate; the track is a
  dark step of the same hue, not gray.
- **Radar labels sit fully outside the ring** now that the ships-in card is
  wide, with a containment test.
- Rejected from the reference set as dishonest for our data: 3D bubbles, 3D
  scatter, rainbow-interpolated heatmaps.

### Added

- **Embedded fonts.** Inter and JetBrains Mono subsets ship inside every SVG
  as data-URI @font-face rules, and PNG rendering uses the same subsets with
  system fonts disabled — output is identical on every machine.
  `npm run build:fonts` regenerates them. Star counts are written as
  "N stars" because U+2605 is absent from both faces.

### Changed

- **The ships-in tile is now a radar chart**: a sharp straight-edged polygon
  over polar gridlines, one spoke per language (top 8 by project count),
  radius = projects using it, drawn in the accent colour with a soft glow.
  Each vertex carries a dot in the language's own colour as identity notation.
  Straight chords between in-ring points cannot leave the outer ring, and a
  test asserts containment for adversarial value patterns. Below 3 languages
  the tile falls back to the pill layout; at zero it says so.

- **Ships-in counts programming languages only.** Linguist's markup, data and
  prose classes — HTML, CSS, SCSS, JSON, YAML, Markdown, Jupyter Notebook and
  friends — no longer count toward the language claim or appear on the radar.
  GitHub's API doesn't expose linguist's type field, so the classification
  ships in compute as an exclusion set. Shell, PowerShell, Dockerfile and
  Makefile stay: linguist classes them as programming. `ignore-languages`
  stacks on top for personal taste.
- Radar labels are colour-coded to their vertex dots (dark brand colours flip
  to ink for readability) and are middle-anchored above or below each vertex,
  so full language names render without truncation in the narrow tile.

### Removed

- The footer credit line at the bottom of the banner.

### Changed — banner now measures open-source contribution, not personal repos

This is a breaking redesign. The banner previously counted stars, languages and
project highlights across your own repositories. It now measures what you
shipped in **other people's** repositories.

- **New tile set.** Row 1: `merged-prs` (PRs merged into repos you don't own),
  `reviews` (reviews given on others' repos), `projects` (distinct external
  projects), `reach` (their combined stars), `issues`. Row 2:
  `biggest-project`, `merge-rate`, `ships-in`, `own-stars`, `since`. A
  `languages` pill tile ships but is off by default.
- **`tiles` input** picks which tiles render and in what order — and decides
  which GraphQL queries run. Each tile declares its data needs; the fetcher
  unions them and skips the rest. Selecting only external tiles skips
  repository pagination entirely. An unknown tile name is a hard error.
- **`min-merged-prs` input** (default `2`) stops one-off drive-by PRs from
  inflating reach and project counts. On the author's account three repos with
  a single merged PR each — including the `first-contributions` tutorial repo —
  were producing 86% of a 162,316-star "combined reach" figure.
- **Languages** are now the primary languages of the external projects you
  contribute to, not a byte-count over your own repos.
- Banner height is derived from the selected tiles instead of being fixed.

### Removed

- **The persona feature**, entirely: `src/persona.ts`, the persona tile, its
  types, tests, and the fields that existed only to score it (`yearsCoding`,
  `avgCommitsPerRepo`, `incomingForks`, `ownedCount`).
- Own-repo metrics that no longer fit the banner's purpose: total stars per
  repo lists, avg active span, public/private split, oldest/latest/most-active
  project, fork counts. Own stars survive as a single `own-stars` tile.
- `repositoriesContributedTo` is not used anywhere: it has an undocumented
  recency window (reporting 38 external repos where merged PRs span 94) and
  silently ignores its own `orderBy` argument.

### Added

- **`since` / `until` inputs** scope a card to a date range instead of all time,
  for weekly or monthly cards. Both bounds are inclusive whole UTC days, capped
  at one year. On a scoped card issues report opened-only (GitHub does not
  expose issues closed within a window) and merge rate compares merged-in-window
  against opened-in-window.

### Changed — card redesign

- **One hero tile.** `merged-prs` renders at double width with a bar chart of
  where the work landed, and the other tiles step down to supporting weight.
  Previously five equal-weight numbers competed for attention.
- **Palette cut from five hues to three**, taken in the documented order from a
  validated categorical ramp. The previous accents failed two colour checks on
  the dark surface: four of five sat outside the lightness band, and orange
  against yellow scored ΔE 14.6, below the normal-vision floor. The new set
  passes all-pairs.
- **Row values now use ink tokens** with a small coloured dot carrying identity,
  instead of colouring the text itself — a light hue is poor as text.
- **`projects` and `reach` no longer show the same list.** One ranks by stars,
  the other by your merged PRs.
- Hero and tile values use the body sans rather than a display face.

### Changed — tile refinements

- **`issues` now leads with the resolution rate** (% of issues you filed that
  got resolved) instead of the raw filed count — finishing what you file is the
  proof, opening tickets is not. Windowed cards still show opened-only.
- **`since` ("contributing since") replaced by `momentum`**: external merges in
  the trailing 12 months and how many projects they landed in. A start date is
  trivia; current shipping rate is evidence.

- **`reach` (combined stars) removed.** Even with the drive-by filter it read
  as borrowed glory; `projects` already lists the top repos with their stars.
- **`ships-in` is now a stat tile showing every language** across the external
  projects you ship to, as pills with a `+N` overflow. It reads linguist's full
  per-repo language lists, which exclude vendored and generated files —
  lockfiles, `dist/`, minified bundles never count. Replaces both the old
  primary-language-only mini and the separate `languages` tile.
- **`own-stars` shows the star total and your highest-starred repo** (never a
  private name unless `include-private`).

### Fixed

- Stat-tile labels, captions and hero prose all shrink to fit instead of
  clipping at the tile edge.

## [Unreleased — earlier in this cycle]

### Removed

- Row 3 of the banner (years coding, avg commits per repo, forks received,
  go-to language). Two of the four duplicated numbers already shown in row 1.
  Canvas is now 1600x672 instead of 1600x900.

### Changed

- **Total contributions** now comes from GitHub's `contributionCalendar` instead
  of summing the per-type counts, so each year matches what your profile shows.
- Per-repo commit counts come from `commitContributionsByRepository` rather than
  a per-repo `defaultBranchRef.target.history` walk. One source of truth instead
  of two that disagreed, and no commit-history walk per repo.
- All per-year contribution queries are batched into a single aliased request
  instead of one round trip per year.
- `exclude` now applies to the top-repos-by-commits list too. Previously that one
  list ignored it, so an excluded repo (including your profile README) could
  still appear there.
- "Avg Lifespan" renamed to "Avg Active Span" — it measures created-to-last-push.
- Visibility tile icon is an eye instead of a moon; dropped the decorative moon
  from the contributions tile.

### Fixed

- Language pills could overflow past the tile border with long language names;
  overflow now rolls into the trailing `+N` pill.
- Language colors are XML-escaped before being interpolated into the SVG.
- A push race between the scheduled run and a manual dispatch now rebases and
  retries once instead of failing the run.

## [1.0.0] - 2026-05-17

### Added

- Initial release of the GitBanner GitHub Action.
- Generates SVG and PNG banners summarizing GitHub profile stats:
  total commits, stars, language distribution, project highlights, persona,
  years coding, average commits per repo, top forks-received, go-to language.
- Inputs: `github-token`, `username`, `theme`, `format`, `output-path`,
  `include-private`, `exclude`, `commit`, `commit-message`.
- Output: `card-path`.
- Theme: `dark` (additional themes in future releases).
- Format: `svg`, `png`, or `both`. PNG rendering on Linux x64 runners only.
- Auto-commit of regenerated cards back to the repo when run as a workflow.
- UTC timestamp footer (`updated YYYY-MM-DD HH:MM UTC`) on every render.

[Unreleased]: https://github.com/yashksaini-coder/GitBanner/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yashksaini-coder/GitBanner/releases/tag/v1.0.0
