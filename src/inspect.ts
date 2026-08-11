import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { aggregate } from './compute.js';
import { fetchAll } from './fetcher.js';
import { neededData, parseTiles, TILE_KEYS, TILES } from './tiles.js';
import { buildWindow } from './window.js';
import type { RawData, StatsPayload } from './types.js';

loadDotEnv();

interface CliArgs {
  user?: string;
  token?: string;
  fixture?: string;
  includePrivate: boolean;
  exclude: string[];
  tiles?: string;
  minMergedPrs?: number;
  ignoreLanguages: string[];
  since?: string;
  until?: string;
  top: number;
  json: boolean;
}

function n(value: number): string {
  return value.toLocaleString('en-US');
}

function pad(value: string, width: number): string {
  return value.padStart(width);
}

function padEnd(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width);
}

function section(title: string): void {
  console.log('');
  console.log(title.toUpperCase());
  console.log('─'.repeat(72));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const tiles = parseTiles(args.tiles);
  const needs = neededData(tiles);
  const window = buildWindow(args.since, args.until);

  let raw: RawData;
  if (args.fixture) {
    raw = JSON.parse(await readFile(args.fixture, 'utf8')) as RawData;
  } else {
    if (!args.user) throw new Error('--user is required (or use --fixture <path>)');
    const token = args.token ?? process.env.GH_PAT ?? process.env.GITHUB_TOKEN;
    if (!token) throw new Error('Provide --token or set GH_PAT/GITHUB_TOKEN in .env');
    raw = await fetchAll({ username: args.user, token, needs, window });
  }

  const stats = aggregate(raw, {
    excludeRepos: args.exclude,
    includePrivate: args.includePrivate,
    minMergedPrs: args.minMergedPrs,
    ignoreLanguages: args.ignoreLanguages,
  });

  if (args.json) {
    console.log(JSON.stringify({ tiles, needs: [...needs], stats }, null, 2));
    return;
  }

  printReport(raw, stats, tiles, needs, args);
}

function printReport(
  raw: RawData,
  stats: StatsPayload,
  tiles: string[],
  needs: Set<string>,
  args: CliArgs,
): void {
  console.log('');
  console.log(`GitBanner inspect · ${raw.profile.login}`);
  console.log(
    `${tiles.length} tiles · fetches: ${[...needs].join(', ') || 'profile only'}${args.fixture ? `  (fixture ${args.fixture})` : ''}`,
  );

  section('what the banner will show');
  for (const key of tiles) {
    console.log(`  ${padEnd(key, 20)} ${TILES[key].kind.padEnd(6)} needs: ${TILES[key].needs.join(', ') || '—'}`);
  }

  section('external contribution profile');
  console.log(`  ${padEnd("PRs merged into others' repos", 34)} ${pad(n(stats.prsMergedExternal), 9)}`);
  console.log(`  ${padEnd('Distinct external projects', 34)} ${pad(n(stats.externalRepoCount), 9)}`);
  console.log(`  ${padEnd("Reviews on others' repos", 34)} ${pad(n(stats.reviewsExternal), 9)}`);
  console.log(`  ${padEnd('Merge rate', 34)} ${pad(`${stats.mergeRatePct}%`, 9)}`);
  console.log(`  ${padEnd('Merged in last 12 months', 34)} ${pad(n(stats.recentExternalPrs), 9)}`);
  console.log(`  ${padEnd('Issue resolution (external, resolved)', 34)} ${pad(`${Math.round((stats.issuesClosed / Math.max(1, stats.issuesOpened)) * 100)}%`, 9)}`);

  section('own work (for contrast)');
  console.log(`  ${padEnd('PRs merged total', 34)} ${pad(n(stats.prsMerged), 9)}`);
  console.log(`  ${padEnd('  of which into own repos', 34)} ${pad(n(stats.prsMerged - stats.prsMergedExternal), 9)}`);
  console.log(`  ${padEnd('Reviews total', 34)} ${pad(n(stats.reviewsTotal), 9)}`);
  console.log(`  ${padEnd('  of which on own repos', 34)} ${pad(n(stats.reviewsTotal - stats.reviewsExternal), 9)}`);
  console.log(`  ${padEnd('Stars on own repos', 34)} ${pad(n(stats.ownStars), 9)}`);
  if (stats.ownTopRepo) {
    console.log(`  ${padEnd('  highest-starred', 34)} ${pad(`${stats.ownTopRepo.name} (${n(stats.ownTopRepo.stars)})`, 9)}`);
  }

  const limit = Math.min(args.top, stats.externalRepos.length);
  if (limit > 0) {
    section(`top ${limit} external projects by merged PRs (of ${stats.externalRepoCount})`);
    console.log(`  ${pad('PRs', 5)} ${pad('Stars', 8)}  Repo`);
    console.log('  ' + '─'.repeat(64));
    for (const repo of stats.externalRepos.slice(0, limit)) {
      console.log(`  ${pad(n(repo.mergedPrs), 5)} ${pad(n(repo.stars), 8)}  ${repo.nameWithOwner}`);
    }
  }

  if (stats.languages.length > 0) {
    section('languages you ship in (external projects, generated files excluded)');
    for (const lang of stats.languages) {
      console.log(`  ${pad(n(lang.repos), 5)}  ${lang.name}`);
    }
  }

  section('checks');
  const checks: Array<{ status: 'ok' | 'warn'; text: string }> = [];

  // The PR pager stops at PR_MAX_PAGES; a full last page is the tell.
  if (raw.mergedPrs.length > 0 && raw.mergedPrs.length < stats.prsMerged) {
    checks.push({
      status: 'warn',
      text: `Paged ${n(raw.mergedPrs.length)} of ${n(stats.prsMerged)} merged PRs — external counts are a floor, not a total`,
    });
  }
  if (stats.prsMergedExternal === 0 && stats.prsMerged > 0) {
    checks.push({
      status: 'warn',
      text: 'Every merged PR is in your own repos — the external tiles will all read 0',
    });
  }
  if (args.includePrivate && !raw.mergedPrs.some((p) => p.repo.isPrivate)) {
    checks.push({
      status: 'warn',
      text: "--include-private set, but no private-repo PRs came back. Token likely lacks 'repo' scope.",
    });
  }
  if (checks.length === 0) checks.push({ status: 'ok', text: 'No issues detected.' });
  for (const c of checks) {
    console.log(`  ${c.status === 'ok' ? '[OK]  ' : '[WARN]'}  ${c.text}`);
  }
  console.log('');
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    includePrivate: false,
    exclude: [],
    ignoreLanguages: [],
    top: 20,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case '--user':
      case '-u':
        args.user = next();
        break;
      case '--token':
      case '-t':
        args.token = next();
        break;
      case '--fixture':
      case '-f':
        args.fixture = next();
        break;
      case '--include-private':
        args.includePrivate = true;
        break;
      case '--exclude':
      case '-x':
        args.exclude = next()
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case '--tiles':
        args.tiles = next();
        break;
      case '--since':
        args.since = next();
        break;
      case '--until':
        args.until = next();
        break;
      case '--ignore-languages':
        args.ignoreLanguages = next()
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case '--min-merged-prs':
        args.minMergedPrs = Number(next());
        break;
      case '--top':
      case '-n':
        args.top = Number(next());
        if (!Number.isFinite(args.top) || args.top < 1) {
          throw new Error('--top must be a positive number');
        }
        break;
      case '--json':
        args.json = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${a}\n(try --help)`);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`gitbanner inspect — print all stats without rendering an image

Usage
  npm run inspect -- --user <login> [options]
  npm run inspect -- --fixture <path> [options]

Required (one of)
  -u, --user <login>      GitHub login to inspect
  -f, --fixture <path>    Load RawData from a JSON fixture (offline)

Options
  -t, --token <pat>       GitHub PAT (default: \$GH_PAT or \$GITHUB_TOKEN)
      --include-private   Count work in private repos
  -x, --exclude <list>    Comma-separated repo names to exclude
      --tiles <list>      Tiles to render; also decides which queries run
                          Available: ${TILE_KEYS.join(', ')}
  -n, --top <N>           External projects to list (default 20)
      --json              Emit machine-readable JSON instead of the report
  -h, --help              Show this help

Examples
  npm run inspect -- -u yashksaini-coder
  npm run inspect -- -u yashksaini-coder --tiles merged-prs,reviews
  npm run --silent inspect -- -u yashksaini-coder --json | jq '.stats.prsMergedExternal'
`);
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

main().catch((err: unknown) => {
  console.error('inspect:', err instanceof Error ? err.message : err);
  process.exit(1);
});
