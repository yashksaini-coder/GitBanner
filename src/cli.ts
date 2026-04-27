import { Resvg } from '@resvg/resvg-js';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { aggregate } from './compute.js';
import { fetchAll } from './fetcher.js';
import { toSvg } from './render/svg.js';
import type { RawData, ThemeName } from './types.js';

loadDotEnv();

interface CliArgs {
  user?: string;
  token?: string;
  output: string;
  theme: ThemeName;
  format: 'svg' | 'png' | 'both';
  fixture?: string;
  includePrivate: boolean;
  exclude: string[];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let raw: RawData;
  if (args.fixture) {
    console.log(`Loading fixture from ${args.fixture}...`);
    raw = JSON.parse(await readFile(args.fixture, 'utf8')) as RawData;
  } else {
    if (!args.user) throw new Error('--user is required (or use --fixture <path>)');
    const token = args.token ?? process.env.GH_PAT ?? process.env.GITHUB_TOKEN;
    if (!token) throw new Error('Provide --token or set GH_PAT/GITHUB_TOKEN');
    console.log(`Fetching data for ${args.user}...`);
    raw = await fetchAll({
      username: args.user,
      token,
    });
  }

  const excludeRepos = computeExclude(args.exclude, raw.profile.login);
  console.log(`Aggregating: ${raw.repos.length} repos (excluding ${excludeRepos.length})`);
  const payload = aggregate(raw, {
    excludeRepos,
    includePrivate: args.includePrivate,
  });
  console.log(
    `  ${payload.totalCommits} commits · ${payload.totalStars} stars · ${payload.languageCount} languages · persona=${payload.persona.label}`,
  );

  const svg = toSvg(payload, args.theme);
  const svgPath = resolve(`${args.output}.svg`);
  const pngPath = resolve(`${args.output}.png`);

  if (args.format === 'svg' || args.format === 'both') {
    await ensureDir(svgPath);
    await writeFile(svgPath, svg, 'utf8');
    console.log(`Wrote ${svgPath} (${svg.length} bytes)`);
  }

  if (args.format === 'png' || args.format === 'both') {
    const png = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1600 },
      background: 'transparent',
    })
      .render()
      .asPng();
    await ensureDir(pngPath);
    await writeFile(pngPath, png);
    console.log(`Wrote ${pngPath} (${png.byteLength} bytes)`);
  }
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    output: 'out/gitbanner',
    theme: 'dark',
    format: 'both',
    includePrivate: false,
    exclude: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${arg}`);
      return v;
    };
    switch (arg) {
      case '--user':
      case '-u':
        args.user = next();
        break;
      case '--token':
      case '-t':
        args.token = next();
        break;
      case '--output':
      case '-o':
        args.output = next();
        break;
      case '--theme':
        args.theme = next() as ThemeName;
        break;
      case '--format':
        args.format = next() as CliArgs['format'];
        break;
      case '--fixture':
        args.fixture = next();
        break;
      case '--include-private':
        args.includePrivate = true;
        break;
      case '--exclude':
        args.exclude = next()
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`gitbanner — local dev CLI

Usage:
  gitbanner --user <login> [--token <pat>] [--output <path>] [--theme dark]
            [--format svg|png|both] [--include-private]
  gitbanner --fixture <path-to-raw.json> [--output <path>]

Options:
  --user, -u           GitHub username to render
  --token, -t          GitHub PAT (or GH_PAT/GITHUB_TOKEN env var)
  --output, -o         Output path without extension (default: out/gitbanner)
  --theme              Theme name (default: dark)
  --format             svg | png | both (default: both)
  --fixture            Load RawData from a JSON fixture instead of fetching
  --include-private    Include private repo stats
  --exclude            Comma-separated repo names to exclude (the user's
                       profile README repo is always excluded automatically)
`);
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

function loadDotEnv(): void {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function computeExclude(userExcludes: string[], login: string): string[] {
  const list = [...userExcludes];
  if (!list.some((r) => r.toLowerCase() === login.toLowerCase())) {
    list.push(login);
  }
  return list;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
