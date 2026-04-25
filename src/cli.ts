import { Resvg } from '@resvg/resvg-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { aggregate } from './compute.js';
import { fetchAll } from './fetcher.js';
import { toSvg } from './render/svg.js';
import type { RawData, ThemeName } from './types.js';

interface CliArgs {
  user?: string;
  token?: string;
  output: string;
  theme: ThemeName;
  format: 'svg' | 'png' | 'both';
  fixture?: string;
  includePrivate: boolean;
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
      includePrivate: args.includePrivate,
    });
  }

  console.log(`Aggregating: ${raw.repos.length} repos`);
  const payload = aggregate(raw);
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
`);
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
