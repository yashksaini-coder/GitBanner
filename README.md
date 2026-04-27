# GitBanner

A GitHub Action that renders a personalized stats banner (SVG + PNG) for your profile README — total commits, stars, language distribution, project highlights, and your coding persona.

Inspired by the [githubtimeline.com](https://githubtimeline.com) layout.

## Quick start

1. Create a repo named `<your-username>/<your-username>` (the GitHub profile repo).
2. Create a Personal Access Token with `read:user` (and `repo` if you want private repo stats included). Save it as a repository secret named `GITBANNER_PAT`.
3. Add this workflow at `.github/workflows/gitbanner.yml`:

```yaml
name: Refresh GitBanner
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: yashksaini-coder/gitbanner@v1
        with:
          github-token: ${{ secrets.GITBANNER_PAT }}
```

4. Embed the banner in your README:

```markdown
![GitBanner](./gitbanner.svg)
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `github-token` | _(required)_ | PAT with `read:user` (and `repo` if `include-private` is true). |
| `username` | repo owner | GitHub login to render. |
| `theme` | `dark` | Theme name. Currently only `dark` ships in v1. |
| `format` | `both` | `svg`, `png`, or `both`. |
| `output-path` | `gitbanner` | Output path without extension. |
| `include-private` | `false` | Include private repo stats. Requires `repo` scope. |
| `commit` | `true` | When true, commit and push the regenerated card if it changed. |
| `commit-message` | `chore: refresh GitBanner stats` | Commit message used by the action. |

## Outputs

| Output | Description |
|---|---|
| `card-path` | Filesystem path of the primary generated card. |

## Local development

```bash
npm install

# Render against a fixture (no API call):
npm run dev -- --fixture tests/fixtures/raw.json --output out/gitbanner

# Render against a live user (requires a PAT in $GH_PAT):
npm run dev -- --user yashksaini-coder

# Run tests:
npm test

# Build the bundled action:
npm run build
```

## What it shows

- **Row 1** — total commits, total stars, languages used (with pills), avg repo lifespan, public/private split.
- **Row 2** — your oldest project, most active project, latest project, and computed coding persona (e.g. *Open Source Star*, *Polyglot*, *Veteran*, *Builder*, …).
- **Row 3** — years of coding history, average commits per repo, your go-to language.

## Runner platforms

The bundled action ships native `@resvg/resvg-js` binaries for Linux x64 (gnu + musl).
For PNG output, use `runs-on: ubuntu-latest`. SVG-only output (`format: svg`) works on any runner.

## License

MIT
