# GitBanner

[![GitHub release](https://img.shields.io/github/v/release/yashksaini-coder/GitBanner?logo=github&label=release)](https://github.com/yashksaini-coder/GitBanner/releases)
[![Marketplace](https://img.shields.io/badge/Marketplace-GitBanner%20Profile%20Card-purple?logo=github)](https://github.com/marketplace/actions/gitbanner-profile-card)

A GitHub Action that renders an open-source contribution banner (SVG + PNG) for your profile README. It measures what you shipped **in other people's repositories** — merged PRs, reviews given, projects you contributed to and their combined reach — rather than counting stars on your own work.

Inspired by the [githubtimeline.com](https://githubtimeline.com) layout.

![Preview](./out/gitbanner.png)

## Quick start

1. Create a repo named `<your-username>/<your-username>` (the GitHub profile repo).
2. Create a Personal Access Token (classic or fine-grained) with these scopes:
   - `read:user` (always required)
   - `repo` (only if you want to set `include-private: true`)

   Save it as a repository secret named `GITBANNER_PAT`.
   Tokens: <https://github.com/settings/tokens>

3. Add this workflow at `.github/workflows/gitbanner.yml`:

```yaml
name: Refresh GitBanner
on:
  schedule:
    # Daily at an off-peak odd minute — GitHub delays crons scheduled at
    # popular times. The card only commits when your numbers actually changed,
    # so quiet days cost nothing.
    - cron: '47 2 * * *'
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: yashksaini-coder/GitBanner@v1
        with:
          github-token: ${{ secrets.GITBANNER_PAT }}
```

4. Embed the banner in your profile README:

```markdown
![GitBanner](./gitbanner.svg)
```

### Pin to a commit SHA for stricter supply-chain safety

`@v1` floats to the latest patch in the v1 series. For full immutability, pin to a commit SHA:

```yaml
- uses: yashksaini-coder/GitBanner@<full-sha>
```

You can find the SHA for a release on the [releases page](https://github.com/yashksaini-coder/GitBanner/releases).

## Inputs

| Input | Default | Description |
|---|---|---|
| `github-token` | _(required)_ | PAT with `read:user` (and `repo` if `include-private` is true). |
| `username` | repo owner | GitHub login to render. |
| `theme` | `dark` | Theme name. Currently only `dark` ships in v1. |
| `format` | `both` | `svg`, `png`, or `both`. |
| `output-path` | `gitbanner` | Output path without extension. |
| `include-private` | `false` | Include private repo stats. Requires `repo` scope. |
| `exclude` | _(empty)_ | Comma-separated repos to exclude from per-repo aggregations, matched on `name` or `owner/name`. The profile README repo is always excluded automatically. |
| `tiles` | _(all)_ | Comma-separated tiles to render, in order. **Only the queries the selected tiles need are issued** — see [Tiles](#tiles). |
| `min-merged-prs` | `2` | Merged PRs a repo needs before it counts as one you contributed to. See [Why the drive-by filter exists](#why-the-drive-by-filter-exists). |
| `ignore-languages` | _(empty)_ | Comma-separated language names to hide from the language tiles, case-insensitive. Markup, data and prose languages (HTML, CSS, JSON, notebooks…) are already excluded automatically; use this for programming languages you'd rather not show (e.g. `Batchfile`). |
| `since` / `until` | _(empty)_ | Scope the card to a date range (`YYYY-MM-DD`, UTC, inclusive). Max one year. Omit both for an all-time card. See [Scoping to a date range](#scoping-to-a-date-range). |
| `commit` | `true` | When true, commit and push the regenerated card if it changed. |
| `commit-message` | `chore: refresh GitBanner stats` | Commit message used by the action. |

## Outputs

| Output | Description |
|---|---|
| `card-path` | Filesystem path of the primary generated card. |

## Runner platforms

The bundled action ships native `@resvg/resvg-js` binaries for **Linux x64 (gnu + musl)**.

- For PNG output, use `runs-on: ubuntu-latest`.
- SVG-only output (`format: svg`) works on any runner platform.
- macOS / Windows runners with `format: png` or `format: both` will fail.

## Troubleshooting

### `Resource not accessible by integration`

You're using `${{ secrets.GITHUB_TOKEN }}` instead of a PAT. The built-in
`GITHUB_TOKEN` does not have access to the GraphQL endpoints this action
uses for cross-repo stats. Create a PAT with `read:user` and save it as
`GITBANNER_PAT` (or similar) repo secret.

### `Projects shipped to` looks lower than expected

That's the drive-by filter doing its job — repos where you have exactly one
merged PR don't count. Run `npm run inspect -- --user <login>` to see the full
list, or set `min-merged-prs: 1` to count every repo you've landed a PR in.

### `Merged for others` looks low

Only PRs that were actually **merged** count; closed-unmerged ones don't. PRs
merged into repos you own are excluded by design — they're your own work, not a
contribution to someone else's project. `npm run inspect` prints both figures
side by side under *own work (for contrast)*.

### The action fails with `Unrecognized named-value: 'github'`

You're consuming a version `<v1.0.0` (development snapshot). Pin to `@v1`.

### `dist/ is out of sync`

If you're forking and building, run `npm run build` and commit the result.
The action runs `dist/index.js` directly — there's no install step at runtime.

## Security

- This action requires a Personal Access Token. Treat it like any other
  long-lived credential: rotate periodically, and store only as a
  repository secret.
- **Token scopes** (classic PAT) or **permissions** (fine-grained PAT):
  - Always: `read:user` (classic) or *Account: Profile — Read-only* (fine-grained)
  - Only if `include-private: true`: add `repo` scope or grant repository
    access in the fine-grained PAT
- **Fine-grained PAT repository access:** the `own-stars` tile queries
  `user.repositories(ownerAffiliations: [OWNER])`. A token scoped to just the
  profile repo returns an empty list and that tile reads `0★`. Grant access to
  all owned repositories, or drop `own-stars` from `tiles` — the external
  contribution tiles don't need repository access at all.
- The action commits and pushes to your profile repo by default. Set
  `commit: false` if you'd rather do the commit yourself.

## Local development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and the PR process.

## CLI commands

Two CLIs ship in the source tree for local use. Both load a `GH_PAT` from
`.env` (see `.env.example`) when a `--token` isn't passed explicitly.

### `npm run dev` — render a banner locally

Generates an SVG/PNG card and writes it to disk. Same code path the action
uses on GitHub Actions, just driven from your terminal.

```bash
# Render against a live profile
npm run dev -- --user <login> --include-private

# Render from a fixture (no API call — useful when iterating on layout)
npm run dev -- --fixture tests/fixtures/raw.json --output out/preview

# SVG only (faster, works on any platform)
npm run dev -- --user <login> --format svg
```

Flags: `-u/--user`, `-t/--token`, `-o/--output` (path without extension),
`--theme`, `--format` (`svg`/`png`/`both`), `-f/--fixture`,
`--include-private`, `--exclude <comma-list>`, `--tiles <comma-list>`,
`--min-merged-prs <n>`. Full list via `--help`.

### `npm run inspect` — print all stats, no image render

Diagnostic command that shows what the banner *would* show, which queries the
selected tiles trigger, the full external-project breakdown, your own work for
contrast, and consistency checks. Use this whenever a banner number looks
wrong, or before adding/changing a metric.

```bash
# Full report
npm run inspect -- --user <login> --include-private

# See which queries a tile subset actually triggers
npm run inspect -- --user <login> --tiles merged-prs,reviews

# Show the top 50 external projects (default is 20)
npm run inspect -- --user <login> --top 50

# Offline against a fixture
npm run inspect -- --fixture tests/fixtures/raw.json

# Machine-readable JSON, pipeable to jq
npm run --silent inspect -- --user <login> --json \
  | jq '.stats | {prsMergedExternal, externalRepoCount, combinedReach, mergeRatePct}'
```

Flags: `-u/--user`, `-t/--token`, `-f/--fixture`, `--include-private`,
`-x/--exclude <list>`, `--tiles <list>`, `--min-merged-prs <n>`,
`-n/--top <N>`, `--json`. Full list via `--help`.

### Other scripts

| Script | Purpose |
|---|---|
| `npm test` | Vitest suite (currently 34 tests) |
| `npm run typecheck` | TypeScript without emit |
| `npm run build` | Bundle `src/` → `dist/index.js` via `ncc`, then inject the ESM shim |

## What it shows

Ten tiles by default, in two rows.

**Row 1** leads with one hero tile — `merged-prs`, at double width, with a bar
chart of where that work landed — followed by supporting stat tiles. Exactly one
hero renders per card; selecting two is an error.

| Tile | Shows |
|---|---|
| `merged-prs` | Area chart of the current year's merged PRs across the popularity spectrum (fixed star decades: <10 → 10k+) · merged-for-others, merge-rate and top-repo stats |
| `reviews` | Code reviews you gave on other people's repos |
| `projects` | Distinct external projects you've landed work in |
| `ships-in` | A straight-edged radar of your top 8 **programming** languages by project count — linguist's markup/data/prose classes (HTML, CSS, JSON, notebooks) don't count toward the claim. Labels and vertex dots wear each language's own colour. Falls back to pills below 3 languages |
| `issues` | Issue resolution rate — % of issues you filed that got resolved, with opened/resolved/still-open rows |

**Row 2 — supporting context:** `biggest-project`, `merge-rate`, `own-stars`
(stars earned on your own repos, with your highest-starred project). The
`activity` card charts external merges over the trailing 12 months — proof
you're shipping now, not just historically.

## Scoping to a date range

`since` / `until` produce a weekly or monthly card instead of an all-time one.
The period appears on the pull-requests and activity cards.

```yaml
# A "what I shipped last month" card
- uses: yashksaini-coder/GitBanner@v1
  with:
    github-token: ${{ secrets.GITBANNER_PAT }}
    since: 2026-07-01
    until: 2026-07-31
    output-path: out/gitbanner-july
```

Hardcoded dates go stale. For a card that always shows your recent work,
compute a rolling window in the workflow instead:

```yaml
- name: Compute the rolling 30-day window
  id: window
  run: |
    echo "since=$(date -u -d '29 days ago' +%F)" >> "$GITHUB_OUTPUT"
    echo "until=$(date -u +%F)" >> "$GITHUB_OUTPUT"
- uses: yashksaini-coder/GitBanner@v1
  with:
    github-token: ${{ secrets.GITBANNER_PAT }}
    since: ${{ steps.window.outputs.since }}
    until: ${{ steps.window.outputs.until }}
    output-path: out/gitbanner-30d
```

Both bounds are inclusive whole UTC days. GitHub caps contribution windows at
one year, so a longer range is rejected rather than silently truncated.

Two things change on a windowed card:

- **Issues show opened only.** GitHub exposes issues *opened* in a window but
  not issues *closed* in one, so the closed count is omitted rather than
  guessed.
- **Merge rate is approximate.** It compares PRs merged in the window against
  PRs opened in the window — a PR opened on the last day and merged the week
  after counts against you. Over an all-time card the two line up.

## Tiles

`tiles` picks which tiles render, in order — and **decides which GraphQL
queries run**. Each tile declares what data it needs; the fetcher unions those
needs and skips everything nothing asked for.

```yaml
# Pure external-contribution banner. Skips repository pagination entirely,
# because no selected tile needs your own repos.
- uses: yashksaini-coder/GitBanner@v1
  with:
    github-token: ${{ secrets.GITBANNER_PAT }}
    tiles: merged-prs,activity,reviews
```

| Tile | Needs |
|---|---|
| `merged-prs`, `activity`, `projects`, `ships-in`, `biggest-project`, `merge-rate` | merged PR pages |
| `reviews` | one aliased contributions request |
| `issues` | two scalar counts on the profile request |
| `own-stars` | repository pagination |

An unknown tile name is a hard error rather than a silent drop, so a typo in a
workflow can't quietly delete a tile.

## Fonts

Inter and JetBrains Mono subsets are embedded in every SVG as `@font-face`
data URIs, and the PNG renderer loads the same subsets with system fonts
disabled — the card renders identically on every machine and in every browser.
Regenerate the subsets with `npm run build:fonts`. (U+2605 ★ is not in either
face; rendered text spells out "stars" instead.)

## Why the drive-by filter exists

A single PR into a huge repository is not a credential, but it dominates any
naive "combined reach" sum. On the author's own account, three repos with
exactly one merged PR each — including
`firstcontributions/first-contributions`, the tutorial repo — accounted for
**86% of a 162,316-star reach figure**.

`min-merged-prs` (default `2`) is the guard. A repository only counts toward
`projects`, `biggest-project` and `ships-in` once you've landed work there
more than once:

| `min-merged-prs` | Projects | Combined reach | Biggest project |
|---|---|---|---|
| `1` | 93 | 162,316★ | `daytona` — 1 PR |
| `2` _(default)_ | 46 | 15,309★ | `opensre` — 10,232★, 17 PRs |

`merged-prs` is deliberately **not** filtered: every merged PR is real work, so
the headline count includes all of them. The filter only guards claims about
*projects you're part of*.

If no repo clears the threshold — a newcomer whose contributions are all first
PRs — the filter falls back to counting every repo, so the banner never shows
"0 projects" beside a non-zero merged count.

## Notes on the numbers

- **Merged PR pagination stops at 2,000 PRs.** Past that, external counts are a
  floor. `npm run inspect` warns when it happens.
- **`repositoriesContributedTo` is not used.** It has an undocumented recency
  window (it reported 38 external repos where merged PRs span 94) and silently
  ignores its own `orderBy` argument.
- **Reviews carry no privacy flag**, so `include-private` cannot affect them;
  private-repo reviews are simply absent from the API response.

## License

[MIT](./LICENSE)
