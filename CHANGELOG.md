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
