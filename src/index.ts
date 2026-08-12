import * as core from '@actions/core';
import * as github from '@actions/github';
import { Resvg } from '@resvg/resvg-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { aggregate, DEFAULT_MIN_MERGED_PRS } from './compute.js';
import { fetchAll } from './fetcher.js';
import { commitIfChanged } from './git.js';
import { resvgFontOptions } from './render/fonts.js';
import { toSvg } from './render/svg.js';
import { neededData, parseTiles } from './tiles.js';
import { buildWindow } from './window.js';
import type { OutputFormat, ThemeName } from './types.js';

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const username =
      core.getInput('username') || github.context.repo.owner;
    const theme = (core.getInput('theme') || 'dark') as ThemeName;
    const format = (core.getInput('format') || 'both') as OutputFormat;
    const outputPath = core.getInput('output-path') || 'gitbanner';
    const includePrivate = parseBool(core.getInput('include-private'), false);
    const commitMessage =
      core.getInput('commit-message') || 'chore: refresh GitBanner stats';
    const shouldCommit = parseBool(core.getInput('commit'), true);
    const excludeRepos = parseExclude(core.getInput('exclude'), username);
    const tiles = parseTiles(core.getInput('tiles'));
    const minMergedPrs = parseCount(core.getInput('min-merged-prs'), DEFAULT_MIN_MERGED_PRS);
    const ignoreLanguages = parseCsv(core.getInput('ignore-languages'));
    const needs = neededData(tiles);
    const window = buildWindow(core.getInput('since'), core.getInput('until'));

    core.info(
      `Fetching GitHub data for ${username}${window ? ` (${window.label})` : ''} — ${tiles.length} tiles need: ${[...needs].join(', ') || 'profile only'}`,
    );
    const raw = await fetchAll({ username, token, needs, window, includePrivate });

    const payload = aggregate(raw, { excludeRepos, includePrivate, minMergedPrs, ignoreLanguages });
    core.info(
      `${payload.prsMergedExternal} PRs merged into others' repos across ${payload.externalRepoCount} projects · ${payload.reviewsExternal} external reviews · ${payload.mergeRatePct}% merge rate`,
    );

    const svg = toSvg(payload, theme, tiles);

    const written: string[] = [];
    const svgPath = resolve(`${outputPath}.svg`);
    const pngPath = resolve(`${outputPath}.png`);

    if (format === 'svg' || format === 'both') {
      await ensureDir(svgPath);
      await writeFile(svgPath, svg, 'utf8');
      written.push(svgPath);
      core.info(`Wrote ${svgPath}`);
    }

    if (format === 'png' || format === 'both') {
      const png = new Resvg(svg, {
        fitTo: { mode: 'width', value: 1600 },
        background: 'transparent',
        font: resvgFontOptions(),
      })
        .render()
        .asPng();
      await ensureDir(pngPath);
      await writeFile(pngPath, png);
      written.push(pngPath);
      core.info(`Wrote ${pngPath} (${png.byteLength} bytes)`);
    }

    const primary = format === 'png' ? pngPath : svgPath;
    core.setOutput('card-path', primary);

    if (shouldCommit) {
      const result = await commitIfChanged(written, commitMessage);
      if (result.committed) {
        core.info(`Committed ${result.sha}`);
      } else {
        core.info('No changes to commit.');
      }
    }
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

function parseBool(input: string, fallback: boolean): boolean {
  if (!input) return fallback;
  const v = input.toLowerCase().trim();
  if (v === 'true' || v === 'yes' || v === '1') return true;
  if (v === 'false' || v === 'no' || v === '0') return false;
  return fallback;
}

function parseCsv(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseCount(input: string, fallback: number): number {
  if (!input.trim()) return fallback;
  const value = Number(input);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;
}

function parseExclude(input: string, username: string): string[] {
  const fromInput = input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // Always exclude the profile README repo (repo named after the user).
  if (!fromInput.some((r) => r.toLowerCase() === username.toLowerCase())) {
    fromInput.push(username);
  }
  return fromInput;
}

run();
