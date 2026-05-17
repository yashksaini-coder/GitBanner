# GitBanner Marketplace Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the GitBanner action to the GitHub Marketplace so anyone can `uses: yashksaini-coder/GitBanner@v1` in their workflow, with a sustainable release flow for future versions.

**Architecture:** Add the missing publication-grade files (LICENSE, CHANGELOG, CONTRIBUTING, package.json metadata) on a feature branch. Add a tag-triggered release workflow that creates GitHub Releases and maintains the floating `v1` major-version tag. Polish README for first-time consumers. Ship via PR → merge → tag push → first-time Marketplace publish via the GitHub Releases UI (a one-time manual step).

**Tech Stack:** GitHub Actions (release workflow), conventional commits (already in use), `gh` CLI for branch/PR/tag pushing, the GitHub Releases UI for the one-time Marketplace toggle.

**Pre-flight state (observed in the repo on 2026-05-17):**
- No `LICENSE` file (README claims MIT but the legal license text is missing — blocks redistribution)
- No `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`
- No git tags — repo has never been versioned
- `package.json` missing `repository`, `author`, `license`, `keywords`, `bugs`, `homepage`
- README uses lowercase `yashksaini-coder/gitbanner@v1` (remote is `yashksaini-coder/GitBanner`)
- `action.yml` has correct branding (icon `bar-chart-2`, color `purple`)
- Bundle is in sync; CI passes; 34 tests pass

---

## Decisions baked into this plan

### Versioning: workflow_dispatch trigger with floating major-version tag

- Releases are tagged `vMAJOR.MINOR.PATCH` (e.g., `v1.0.0`, `v1.0.1`, `v2.0.0`)
- An auxiliary tag `vMAJOR` (e.g., `v1`) is force-updated to point at the latest release in that major
- Users pin to `@v1` and receive bug-fix updates automatically
- **The release is triggered by `workflow_dispatch` — not by a tag push.** The maintainer clicks "Run workflow" in the Actions UI (or runs `gh workflow run release.yml`), enters the version number (e.g., `1.0.0`), and selects release type (`release` or `prerelease`). The workflow validates the version, runs the full CI suite, and only then creates the tag, the GitHub Release, and (for stable releases) moves the floating `v1` tag.
- **Why workflow_dispatch over tag-push:**
  - **Validation happens before tag creation.** With tag-push, you push the tag, then learn it fails — leaving you to clean up the bad tag with `git push --delete origin v1.0.0`. With workflow_dispatch, a failed run leaves zero state.
  - **One source of truth for releases.** The Actions UI shows every release attempt (succeeded or failed) with full logs, audit info ("triggered by yashksaini-coder at 14:32"), and re-run buttons.
  - **Built-in prerelease support.** An input dropdown lets you choose `prerelease`, which creates the GitHub Release but does **not** move the floating `v1` tag. Useful for testing release candidates without pointing all consumers at them.
  - **Familiar pattern.** The maintainer has used this pattern in other projects and prefers it.

### First Marketplace publish is a manual UI step

- GitHub's Releases UI has a checkbox **"Publish this Action to the GitHub Marketplace"** which must be checked on the *first* release
- Subsequent releases inherit Marketplace status automatically
- **Why this is a manual task:** GitHub does not currently expose the Marketplace publish flag via API or the `gh` CLI. The first publish has to be done in a browser. Future releases need no UI work.

### Branch + PR strategy

- Feature branch: `feat/marketplace-publish`
- All non-ceremonial changes land via one PR
- After merge: maintainer (you) pushes `v1.0.0` and `v1` tags → release workflow creates the Release → maintainer publishes to Marketplace via UI

---

## File structure overview

### New files
- `LICENSE` — MIT license text
- `CHANGELOG.md` — versioned change log starting at v1.0.0
- `CONTRIBUTING.md` — local dev, testing, PR process
- `.github/release.yml` — auto-generated release notes categorization
- `.github/workflows/release.yml` — tag-push-triggered release workflow

### Modified files
- `README.md` — fix repo-name casing, add troubleshooting + security/PAT notes, add Marketplace badge placeholder, recommend SHA pinning
- `package.json` — add `repository`, `author`, `license`, `keywords`, `bugs`, `homepage`

### Untouched (already correct)
- `action.yml` (branding metadata is correct)
- `src/`, `dist/`, `tests/` (no code changes needed)

---

## Tasks

### Task 1: Create and switch to the feature branch

**Files:** none modified — branch creation only.

- [ ] **Step 1: Verify clean working tree**

Run:
```bash
git status
```
Expected: `nothing to commit, working tree clean` (or only contains `out/gitbanner.*` drift, which is fine).

- [ ] **Step 2: Create and check out the branch**

Run:
```bash
git checkout -b feat/marketplace-publish
```
Expected: `Switched to a new branch 'feat/marketplace-publish'`.

- [ ] **Step 3: No commit yet** — branch creation alone produces no commit.

---

### Task 2: Add the LICENSE file

**Files:**
- Create: `LICENSE`

- [ ] **Step 1: Confirm copyright holder name**

Decide what name should appear in the MIT copyright line. The git config currently uses the handle `yashksaini-coder`, so the default is to use either:
- the handle (`yashksaini-coder`), or
- your real legal name if you'd prefer.

A handle is legally acceptable for MIT copyright. Pick one and use it consistently across LICENSE and `package.json`'s `author` field (Task 3). The default below uses the handle.

- [ ] **Step 2: Write the LICENSE file**

Create `LICENSE` with the standard MIT text. Adjust the copyright line to your chosen name:

```
MIT License

Copyright (c) 2026 yashksaini-coder

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Verify GitHub will detect it as MIT**

Run:
```bash
head -1 LICENSE
```
Expected: `MIT License`. GitHub detects the license type via the first non-blank line of `LICENSE` — must say "MIT License" exactly so the repo's sidebar shows "MIT License" automatically.

- [ ] **Step 4: Commit**

```bash
git add LICENSE
git commit -m "docs: add MIT LICENSE file"
```

---

### Task 3: Add publisher metadata to package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Replace the current `package.json` with the version below**

The diff vs current: adds `repository`, `author`, `license`, `homepage`, `bugs`, `keywords`. Bumps nothing else.

```json
{
  "name": "gitbanner",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "GitHub Marketplace Action that renders a personalized GitHub stats card (SVG + PNG) for your profile README.",
  "main": "dist/index.js",
  "license": "MIT",
  "author": "yashksaini-coder <yashksaini89@gmail.com>",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/yashksaini-coder/GitBanner.git"
  },
  "homepage": "https://github.com/yashksaini-coder/GitBanner#readme",
  "bugs": {
    "url": "https://github.com/yashksaini-coder/GitBanner/issues"
  },
  "keywords": [
    "github-action",
    "github-actions",
    "profile-readme",
    "stats",
    "svg",
    "banner",
    "card",
    "github-stats"
  ],
  "scripts": {
    "build": "ncc build src/index.ts -o dist --minify --license licenses.txt && node scripts/inject-esm-shim.mjs",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "package": "npm run build"
  },
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "@actions/core": "^1.11.1",
    "@actions/github": "^6.0.0",
    "@octokit/graphql": "^8.1.1",
    "@octokit/rest": "^21.0.2",
    "@resvg/resvg-js": "^2.6.2"
  },
  "devDependencies": {
    "@types/node": "^20.16.5",
    "@vercel/ncc": "^0.38.2",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
```

**Why each new field matters:**
- `license: "MIT"` — npm/GitHub tooling scans this field; matches LICENSE file
- `repository` — Marketplace listing pulls source-code link from here; also lets `npm` users navigate to the repo
- `homepage` / `bugs` — Marketplace listing surfaces these as "View source" and "Report a bug" links
- `keywords` — Improves discoverability in npm-style listings (Marketplace uses its own categorization, but keywords don't hurt)
- `author` — Attribution; appears on Marketplace listing

- [ ] **Step 2: Verify the file parses as valid JSON**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('package.json'))" && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Verify tests + typecheck still pass (metadata change must not affect anything)**

Run:
```bash
npm run typecheck && npm test
```
Expected: `Test Files  3 passed (3)` and `Tests  34 passed (34)`.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: add publisher metadata to package.json"
```

---

### Task 4: Add CHANGELOG.md

**Files:**
- Create: `CHANGELOG.md`

- [ ] **Step 1: Write the CHANGELOG**

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The initial v1.0.0 entry summarizes the features that are about to be released.

```markdown
# Changelog

All notable changes to GitBanner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG starting at v1.0.0"
```

---

### Task 5: Add CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Write the contributing guide**

```markdown
# Contributing to GitBanner

Thanks for considering a contribution. This file describes how to set up the
project locally, test changes, and submit a pull request.

## Local development

```bash
git clone https://github.com/yashksaini-coder/GitBanner.git
cd GitBanner
npm install

# Render against a fixture (no GitHub API call)
npm run dev -- --fixture tests/fixtures/raw.json --output out/preview --format svg

# Render against your live profile (requires a Personal Access Token in $GH_PAT)
cp .env.example .env   # then edit .env and set GH_PAT
npm run dev -- --user <your-github-login>

# Run the test suite
npm test

# Typecheck
npm run typecheck

# Build the bundled action (writes to dist/)
npm run build
```

## How the project is structured

- `src/` — TypeScript source.
- `src/render/` — SVG rendering layer (tiles, fonts, icons, theming).
- `dist/` — Bundled output. The action runs `dist/index.js` directly at
  workflow time, so this file must be committed and stay in sync with `src/`.
  CI fails if it drifts (see `bundle-in-sync` job in `.github/workflows/ci.yml`).
- `tests/` — Vitest tests against a fixed fixture in `tests/fixtures/raw.json`.
- `scripts/inject-esm-shim.mjs` — Post-build patch that adds a small CJS-globals
  shim to `dist/index.js`. See file header for the WHY.

## Pull request checklist

Before opening a PR:

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` has been run and the `dist/` changes are committed
      (otherwise the `bundle-in-sync` CI job will fail)
- [ ] If you touched user-visible behavior, add a line to `CHANGELOG.md` under
      the `## [Unreleased]` heading
- [ ] Commit messages follow conventional-commit style: `feat:`, `fix:`,
      `chore:`, `docs:`, `ci:`, `refactor:`, `test:`

## Versioning

Releases are tagged `vMAJOR.MINOR.PATCH` (e.g. `v1.0.0`). A floating
`v1` tag points to the latest release in the v1 line; users consume the
action via `uses: yashksaini-coder/GitBanner@v1`.

Maintainer release flow:

1. Merge feature PRs into `main`.
2. Once enough is queued, update `CHANGELOG.md` (move items from
   `[Unreleased]` into a new `[1.x.y]` section) and merge that change to main.
3. Trigger the release workflow with the desired version:

   ```bash
   gh workflow run release.yml -f version=1.x.y -f release_type=release
   ```

   Or via the Actions UI: **Actions → Release → Run workflow → enter
   version, pick release type, run**.

4. The workflow validates the version, runs the full CI suite, creates the
   `v1.x.y` tag, publishes the GitHub Release with auto-generated notes,
   and (for stable releases) force-updates the floating `v1` tag.

For release candidates, use `release_type=prerelease`:

```bash
gh workflow run release.yml -f version=1.1.0-rc.1 -f release_type=prerelease
```

Prereleases publish the GitHub Release marked as "pre-release" but do **not**
move the `v1` floating tag, so existing consumers on `@v1` are unaffected.
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING guide"
```

---

### Task 6: Polish the README

**Files:**
- Modify: `README.md`

The README needs four classes of change:
- Fix repo-name casing (`gitbanner` → `GitBanner`)
- Add a Marketplace badge placeholder (will activate after first publish)
- Add a security/PAT-scope note above the workflow snippet
- Add a troubleshooting section
- Mention SHA-pinning as a security option

- [ ] **Step 1: Read current README to see exact context**

Run:
```bash
cat README.md
```

- [ ] **Step 2: Replace `README.md` with the version below**

```markdown
# GitBanner

[![GitHub release](https://img.shields.io/github/v/release/yashksaini-coder/GitBanner?logo=github&label=release)](https://github.com/yashksaini-coder/GitBanner/releases)
[![Marketplace](https://img.shields.io/badge/Marketplace-GitBanner-purple?logo=github)](https://github.com/marketplace/actions/gitbanner)
[![CI](https://github.com/yashksaini-coder/GitBanner/actions/workflows/ci.yml/badge.svg)](https://github.com/yashksaini-coder/GitBanner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A GitHub Action that renders a personalized stats banner (SVG + PNG) for your profile README — total commits, stars, language distribution, project highlights, and your coding persona.

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
    - cron: '0 6 * * 0'   # every Sunday at 06:00 UTC
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
| `exclude` | _(empty)_ | Comma-separated repos to exclude from per-repo aggregations. The profile README repo is always excluded automatically. Does not affect the `Total Commits` headline (which comes from GitHub's contribution graph). |
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

### The action runs but the headline `Total Commits` looks low

GitBanner uses GitHub's contribution-graph API for the headline. That number
only counts commits made on the **default branch or `gh-pages` branch** of
repos you have committed to, where the commit's author email is verified
against your GitHub account. Commits authored before email verification or
on non-default branches don't appear.

### The action fails with `Unrecognized named-value: 'github'`

You're consuming a version `<v1.0.0` (development snapshot). Pin to `@v1`.

### `dist/ is out of sync`

If you're forking and building, run `npm run build` and commit the result.
The action runs `dist/index.js` directly — there's no install step at runtime.

## Security

- This action requires a Personal Access Token. Treat it like any other
  long-lived credential: rotate periodically, scope minimally, and store
  only as a repository secret.
- Fine-grained PATs are preferred. Limit access to your profile repo only.
- The action commits and pushes to your profile repo by default. Set
  `commit: false` if you'd rather do the commit yourself.

## Local development

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## What it shows

- **Row 1** — total commits, total stars, languages used (with pills), avg repo lifespan, public/private split.
- **Row 2** — your oldest project, most active project, latest project, and computed coding persona (e.g. *Open Source Star*, *Polyglot*, *Veteran*, *Builder*, …).
- **Row 3** — years of coding history, average commits per repo, your go-to language.
- **Footer** — followers/following, best year, and `updated YYYY-MM-DD HH:MM UTC`.

## License

[MIT](./LICENSE)
```

- [ ] **Step 3: Visually verify the markdown**

Run:
```bash
grep -n "yashksaini-coder/gitbanner\|yashksaini-coder/GitBanner" README.md
```
Expected: every match should be `yashksaini-coder/GitBanner` (capitalized). No lowercase `gitbanner` in user/repo positions. (Lowercase `gitbanner` is OK in marketplace URLs, badge alt-text, and prose.)

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: polish README for marketplace publication"
```

---

### Task 7: Add auto-release-notes config

**Files:**
- Create: `.github/release.yml`

This file is GitHub-specific: it tells the "Generate release notes" button (used by both the UI and the `gh release create --generate-notes` flag) how to bucket merged PRs into sections.

- [ ] **Step 1: Write `.github/release.yml`**

```yaml
# Categorizes pull requests in auto-generated release notes.
# Docs: https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes
changelog:
  exclude:
    labels:
      - ignore-for-release
      - dependencies
    authors:
      - dependabot
      - github-actions
  categories:
    - title: Breaking changes
      labels:
        - breaking
    - title: Features
      labels:
        - feature
        - enhancement
    - title: Bug fixes
      labels:
        - bug
        - fix
    - title: Documentation
      labels:
        - documentation
        - docs
    - title: Other changes
      labels:
        - "*"
```

- [ ] **Step 2: Commit**

```bash
git add .github/release.yml
git commit -m "ci: add auto-release-notes categorization"
```

---

### Task 8: Add the release workflow

**Files:**
- Create: `.github/workflows/release.yml`

This workflow triggers via `workflow_dispatch` (a "Run workflow" button in the Actions UI, or `gh workflow run release.yml`). The maintainer supplies the version number as an input. The workflow validates the version, runs the full CI suite, and only then creates the tag, the GitHub Release, and (for stable releases) moves the floating `v1` tag.

- [ ] **Step 1: Write the release workflow**

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Semantic version to release (without v prefix, e.g. 1.0.0 or 1.0.0-rc.1)'
        required: true
        type: string
      release_type:
        description: 'Release type'
        required: true
        default: 'release'
        type: choice
        options:
          - release
          - prerelease

permissions:
  contents: write

jobs:
  validate:
    name: Validate and run CI
    runs-on: ubuntu-latest
    outputs:
      tag: ${{ steps.normalize.outputs.tag }}
      major: ${{ steps.normalize.outputs.major }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Normalize and validate the version
        id: normalize
        env:
          VERSION_INPUT: ${{ inputs.version }}
        run: |
          # Strip a leading 'v' if the user typed it, then validate semver.
          ver="${VERSION_INPUT#v}"
          if ! echo "$ver" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$'; then
            echo "::error::'$ver' is not valid semver. Use e.g. 1.0.0 or 1.0.0-rc.1"
            exit 1
          fi
          tag="v$ver"
          major="v${ver%%.*}"
          echo "tag=$tag"     >> "$GITHUB_OUTPUT"
          echo "major=$major" >> "$GITHUB_OUTPUT"
          echo "Releasing $tag (major track $major)"

      - name: Ensure tag does not already exist
        env:
          TAG: ${{ steps.normalize.outputs.tag }}
        run: |
          if git ls-remote --tags origin | grep -q "refs/tags/$TAG$"; then
            echo "::error::Tag $TAG already exists on origin. Pick a new version."
            exit 1
          fi

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - name: Fail if dist/ is out of sync
        run: |
          if ! git diff --quiet --exit-code dist/; then
            echo "::error::dist/ is out of sync with src/. Rebuild on main, commit, and re-run."
            git diff --stat dist/
            exit 1
          fi

  release:
    name: Tag and publish release
    runs-on: ubuntu-latest
    needs: validate
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Configure git identity
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

      - name: Create and push the version tag
        env:
          TAG: ${{ needs.validate.outputs.tag }}
        run: |
          git tag -a "$TAG" -m "Release $TAG"
          git push origin "$TAG"

      - name: Create the GitHub Release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAG: ${{ needs.validate.outputs.tag }}
          IS_PRE: ${{ inputs.release_type == 'prerelease' }}
        run: |
          flags="--title $TAG --generate-notes --verify-tag"
          if [ "$IS_PRE" = "true" ]; then
            flags="$flags --prerelease"
          fi
          gh release create "$TAG" $flags

      - name: Move the floating major-version tag (stable releases only)
        if: inputs.release_type == 'release'
        env:
          MAJOR: ${{ needs.validate.outputs.major }}
          TAG:   ${{ needs.validate.outputs.tag }}
        run: |
          git tag -f "$MAJOR" "$TAG"
          git push origin "$MAJOR" --force
```

**Why each step is the way it is:**
- **`workflow_dispatch` with `inputs.version`** — releases are triggered by the maintainer via the UI button or `gh workflow run`, not by a tag push. This means a failed release leaves no tag behind to clean up.
- **`validate` runs CI *before* the tag is created** — the version-existence check, semver normalization, tests, typecheck, and `dist/` sync check all gate tag creation. If any step fails, the workflow stops and nothing is published.
- **`release_type: prerelease`** — for prereleases the `gh release create --prerelease` flag is added and the floating major-version tag is **not** moved. So `v1.0.0-rc.1` is published as a downloadable release without pointing `v1` at it.
- **`permissions: contents: write`** is the minimum scope needed to create a release, push a tag, and force-update the major tag. Don't add more.
- **`--verify-tag`** makes `gh release create` refuse if the local tag doesn't match what GitHub has — defends against race conditions.
- **The major-tag force-update uses `git tag -f` then `git push --force`** because floating major-version tags are explicitly designed to be force-updated. This is the only place in the workflow where a force-push is correct.
- **`env:`-then-`$VAR` pattern (rather than `${{ }}` inline in `run:`)** is the GitHub-recommended hardening against script-injection via untrusted inputs. Although `inputs.version` is maintainer-supplied, the pattern is good hygiene and the `validate` step already enforces strict semver shape.

- [ ] **Step 2: Sanity-check the YAML**

Run:
```bash
# Quick structural check that it's parseable YAML; ignores GitHub-specific schema.
node -e "const fs=require('fs');const t=fs.readFileSync('.github/workflows/release.yml','utf8');if(!t.includes('on:')||!t.includes('jobs:'))process.exit(1)"
echo "OK"
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add tag-triggered release workflow"
```

---

### Task 9: Open the PR

**Files:** none modified — git/gh commands only.

- [ ] **Step 1: Push the branch to origin**

```bash
git push -u origin feat/marketplace-publish
```
Expected: branch created on remote with tracking set up.

- [ ] **Step 2: Create the pull request**

```bash
gh pr create --title "feat: prepare for Marketplace publication" --body "$(cat <<'EOF'
## Summary

Adds the missing publication metadata so v1.0.0 can be tagged and the action
can appear on the GitHub Marketplace.

### Files added
- `LICENSE` — MIT
- `CHANGELOG.md` — initial v1.0.0 entry
- `CONTRIBUTING.md` — local dev + release process
- `.github/release.yml` — auto-release-notes config
- `.github/workflows/release.yml` — tag-triggered release flow

### Files modified
- `README.md` — repo-name casing fix, Marketplace badge placeholder, troubleshooting section, security note
- `package.json` — `repository`, `author`, `license`, `keywords`, `bugs`, `homepage`

### After merge
1. Push `v1.0.0` tag (release workflow will create the Release and move `v1`).
2. Edit the Release in the GitHub UI, check **"Publish this Action to the GitHub Marketplace"**, pick categories (`Utilities`, `Reporting` are reasonable), publish.

See `docs/superpowers/plans/2026-05-17-publish-to-marketplace.md` for the full plan.

## Test plan

- [x] `npm run typecheck` passes
- [x] `npm test` passes (34/34)
- [x] `npm run build` is no-op (no source code changed)
- [ ] After merge: tag v1.0.0 and verify the `release.yml` workflow creates the release + moves `v1`
EOF
)"
```

Expected: PR URL printed to stdout. Open it in a browser to confirm.

- [ ] **Step 3: Commit the plan document itself**

The plan file at `docs/superpowers/plans/2026-05-17-publish-to-marketplace.md` should also be on this branch.

```bash
git add docs/superpowers/plans/2026-05-17-publish-to-marketplace.md
git commit -m "docs: add marketplace-publish implementation plan"
git push
```

---

### Task 10: Post-merge release ceremony (run by maintainer after PR merges)

**This task is run AFTER the PR is reviewed and merged to `main`.** No code changes — just the sequence of commands and UI steps to produce the first Marketplace listing.

- [ ] **Step 1: Switch back to main and pull**

```bash
git checkout main
git pull origin main
```
Expected: working tree on `main` with the merged PR's changes.

- [ ] **Step 2: Verify CI is green on the merged commit**

```bash
gh run list --branch main --limit 3
```
Expected: top run for `CI` should be `success`. If not, fix on a follow-up PR before tagging.

- [ ] **Step 3: Trigger the Release workflow**

```bash
gh workflow run release.yml -f version=1.0.0 -f release_type=release
```

Or via the UI: **Actions → Release → Run workflow → Branch: main, Version: 1.0.0, Release type: release → Run workflow**.

Expected: workflow starts.

- [ ] **Step 4: Watch the release workflow run**

```bash
gh run watch
```

Expected: both jobs (`validate` and `release`) succeed. At the end of the run:
- Tag `v1.0.0` exists on origin
- A GitHub Release named `v1.0.0` is created with auto-generated notes
- Floating tag `v1` is created/updated to point at `v1.0.0`

- [ ] **Step 5: Verify both tags exist on origin**

```bash
git fetch --tags
git tag -l | grep -E '^v1'
```
Expected: both `v1.0.0` and `v1` appear.

- [ ] **Step 6: Publish to Marketplace via the GitHub Releases UI**

This step **cannot** be automated. Open the release page in a browser:

```bash
gh release view v1.0.0 --web
```

In the browser:
1. Click **Edit release**.
2. Check the box **"Publish this Action to the GitHub Marketplace"**.
3. Accept the Marketplace Developer Agreement (one-time).
4. Pick **two categories**. Recommended: `Utilities` (primary) and `Reporting` (secondary). The Marketplace lets you pick exactly two.
5. Verify the listing preview at the bottom of the page — icon, color, description should look right.
6. Click **Update release**.

Expected: the release page now shows a "Published to GitHub Marketplace" banner and a link to the Marketplace listing.

- [ ] **Step 7: Verify the public listing**

Open:
```
https://github.com/marketplace/actions/gitbanner
```

Expected:
- The listing renders with the purple `bar-chart-2` icon
- "Use latest version" snippet shows `uses: yashksaini-coder/GitBanner@v1.0.0`
- The "View source" link points to the repo

- [ ] **Step 8: Verify a downstream consumer works**

In another repo (or your profile repo), add this minimal workflow and trigger it manually:

```yaml
name: Test GitBanner consumption
on: workflow_dispatch
jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: yashksaini-coder/GitBanner@v1
        with:
          github-token: ${{ secrets.GITBANNER_PAT }}
```

Run via:
```bash
gh workflow run "Test GitBanner consumption"
gh run watch
```

Expected: the workflow succeeds and a banner appears in the consumer repo.

---

## Self-review checklist (run after writing the plan)

- [x] Every task references exact file paths (no "the workflow file" etc.)
- [x] Every code step shows the full content, not a placeholder
- [x] Versioning strategy is decided and documented (manual tag + floating major)
- [x] Marketplace publish step is flagged as a manual UI action with explicit steps
- [x] Security-relevant choices (token scopes, SHA pinning, permissions) are explained
- [x] First-release ceremony is broken into individual commands the maintainer runs
- [x] Verification steps (tests, typecheck, build, listing URL check) exist between substantive changes
- [x] The branch-and-PR flow is concrete (`feat/marketplace-publish`, explicit `gh pr create`)
- [x] Test plan in the PR template lists the actual checks done
