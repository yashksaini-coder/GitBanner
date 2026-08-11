# Changelog

All notable changes to GitBanner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed — three-card report layout

- The banner is now three portrait report cards — Pull requests, Code review,
  Footprint — each with a title, a chart (gradient bars or a language cell
  grid), a stat pair with a delta line, and a small table. Canvas 1600x728.
  The `tiles` input now takes card keys: `pull-requests`, `code-review`,
  `footprint`.
- **Fonts are embedded.** Inter and JetBrains Mono subsets ship inside every
  SVG as data-URI @font-face rules, and PNG rendering uses the same subsets
  with system fonts disabled — output is identical on every machine.
  `npm run build:fonts` regenerates the subsets.
- **The footer credit line is gone**, and with it the `bestYear` stat it
  displayed. Followers/following moved into the footprint card's table.
- Language cell text falls back to ink when a language's brand colour is too
  dark to read on the card surface (e.g. PowerShell).
- Star counts are written as "N stars" — U+2605 is absent from both embedded
  faces and would render as nothing.

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
