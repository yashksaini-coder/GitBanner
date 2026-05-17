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
