# Changelog

All notable changes to GitBanner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-08-11

This is a breaking redesign. The banner previously counted stars, languages
and project highlights across your own repositories; it now measures what you
shipped into **other people's** projects — merged PRs, reviews given, projects
landed in — on a pure-black three-column canvas with embedded fonts. The
design iteration is chronicled in [#3](https://github.com/yashksaini-coder/GitBanner/pull/3).

### Changed — what the banner measures (breaking)

- **New tile registry.** Six chart cards — `merged-prs`, `activity`,
  `ships-in`, `reviews`, `projects`, `issues` — and three minis —
  `biggest-project`, `merge-rate`, `own-stars`. Old tile keys (`reach`,
  `languages`, `since`, `momentum`, the persona tile) are gone; an unknown
  key in `tiles` is a hard error rather than a silent drop.
- **Needs-driven fetching.** Each tile declares the GraphQL data it needs and
  the fetcher unions exactly those queries — dropping `own-stars`, for
  example, skips repository pagination entirely.
- **`min-merged-prs`** (default `2`) keeps one-off drive-by PRs from
  inflating repo-level claims. PR-count claims stay unfiltered — every merged
  PR is real work. The projects card labels the threshold actually applied.
- **Languages are the external projects' languages, weighted.** A language
  counts for a repo only when it is the primary language or carries at least
  8% of linguist bytes, and linguist's markup/data/prose classes (HTML, CSS,
  JSON, YAML, Markdown, …) never count. `ignore-languages` stacks on top.

### Changed — the cards

- **Pull requests**: area wave of merged PRs across fixed star-magnitude
  decades (<10 … 10k+), scoped to the current year, monotone-cubic curve
  that cannot overshoot the data; all-time headline, merge rate and the
  year's top repo in the stat trio.
- **Activity**: the trailing 12 months as gradient columns, value on every
  cap, month letter under every base.
- **Ships in**: a radial burst — one glowing ray per language in its own
  colour, length = projects using it, the language total in the centre hub.
- **Code review**: a ridgeline, one ridge per reviewed repo (top 6 external)
  across years on a shared scale, depth hues violet→blue→green.
- **Projects shipped to**: a spiral-packed hex cluster, one hex per external
  project, log-scaled heat = merged PRs, with a ghost-hex periphery; stats
  count projects, distinct maintainers & orgs, and most merged in one repo.
- **Issues**: issues filed in other people's public repos that got
  *resolved* (closed as completed — closed-as-not-planned never counts),
  measured by aliased issue searches and rendered as capped gradient columns
  per year in GitHub's own closed-issue purple, with resolved,
  resolution-rate and filed counts below. Card copy speaks in the first
  person — the banner shares facts about its owner.
- **Minis**: Top projects (this year's top-3 leaderboard), Merge rate with a
  monthly spark, Stars earned (top-3 own repos) — rounded-bar sparklines,
  no icons.

### Added

- **`since` / `until` inputs** scope a card to a date range (inclusive whole
  UTC days, capped at one year by GitHub). Windowed cards report an
  approximate merge rate, labelled and clamped.
- **`ignore-languages` input** hides languages from the ships-in card.
- **Embedded fonts.** Inter and JetBrains Mono subsets ship inside every SVG
  as data-URI @font-face rules and drive PNG rendering with system fonts
  disabled — output is byte-identical on every machine.
- The refresh workflow runs daily at an off-peak minute; byte-stable output
  means quiet days produce no commit.

### Removed

- **The persona feature**, entirely, and the own-repo metrics that no longer
  fit the banner's purpose (per-repo star lists, avg active span,
  public/private split, oldest/latest/most-active project, fork counts).
  Own stars survive as the `own-stars` mini.
- The `reach` (combined stargazers) tile — even drive-by-filtered it read as
  borrowed glory.
- The footer credit line.
- `repositoriesContributedTo` is not queried anywhere: it has an undocumented
  recency window and silently ignores its own `orderBy` argument.

### Fixed

- A windowed card whose tiles only need PR data now fetches the
  contributions query its PRs-opened total comes from — the merge rate no
  longer renders 0% on scoped cards.
- `until` without `since` fails up front with the real reason instead of a
  misleading one-year-cap error.
- A non-numeric `min-merged-prs` falls back to the default instead of
  silently disabling the drive-by filter through NaN.
- A single-period issues chart (windowed card, or an account created this
  year) renders one bar instead of claiming there is no history.
- The merge rate is clamped at 100% (windowed numerator and denominator can
  legitimately cross), and merged-PR pagination warns when the 2,000-newest
  cap truncates history.
- The push race retry logs the original error first, so a permissions
  failure is no longer masked by the retry.
- `action.yml`'s tiles documentation matches the registry, enforced by a
  round-trip test.

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
