import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { graphql } from '@octokit/graphql';
import { aggregate } from './compute.js';
import { fetchAll } from './fetcher.js';
import type { RawData, StatsPayload } from './types.js';

loadDotEnv();

interface CliArgs {
  user?: string;
  token?: string;
  fixture?: string;
  includePrivate: boolean;
  exclude: string[];
  ignoreLanguages: string[];
  top: number;
  json: boolean;
  quiet: boolean;
}

interface RepoCommitBreakdown {
  nameWithOwner: string;
  isPrivate: boolean;
  isFork: boolean;
  commits: number;
}

const COMMIT_BY_REPO_QUERY = /* GraphQL */ `
  query CommitsByRepo($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        commitContributionsByRepository(maxRepositories: 100) {
          repository {
            nameWithOwner
            isPrivate
            isFork
          }
          contributions {
            totalCount
          }
        }
      }
    }
  }
`;

async function fetchCommitsByRepo(
  token: string,
  login: string,
  createdAt: string,
): Promise<RepoCommitBreakdown[]> {
  const client = graphql.defaults({ headers: { authorization: `token ${token}` } });
  const startYear = new Date(createdAt).getUTCFullYear();
  const endYear = new Date().getUTCFullYear();
  const tally = new Map<string, RepoCommitBreakdown>();
  for (let year = startYear; year <= endYear; year++) {
    const from = year === startYear ? createdAt : `${year}-01-01T00:00:00Z`;
    const to = year === endYear ? new Date().toISOString() : `${year}-12-31T23:59:59Z`;
    const data = await client<{
      user: {
        contributionsCollection: {
          commitContributionsByRepository: Array<{
            repository: { nameWithOwner: string; isPrivate: boolean; isFork: boolean };
            contributions: { totalCount: number };
          }>;
        };
      };
    }>(COMMIT_BY_REPO_QUERY, { login, from, to });
    for (const entry of data.user.contributionsCollection.commitContributionsByRepository) {
      const key = entry.repository.nameWithOwner;
      const existing = tally.get(key);
      if (existing) {
        existing.commits += entry.contributions.totalCount;
      } else {
        tally.set(key, {
          nameWithOwner: key,
          isPrivate: entry.repository.isPrivate,
          isFork: entry.repository.isFork,
          commits: entry.contributions.totalCount,
        });
      }
    }
  }
  return [...tally.values()].sort((a, b) => b.commits - a.commits);
}

function rule(): string {
  return '─'.repeat(72);
}

function section(title: string): void {
  console.log('');
  console.log(title.toUpperCase());
  console.log(rule());
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

function pct(part: number, whole: number): string {
  if (whole === 0) return '0.0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let raw: RawData;
  let owner: string;
  if (args.fixture) {
    raw = JSON.parse(await readFile(args.fixture, 'utf8')) as RawData;
    owner = raw.profile.login;
  } else {
    if (!args.user) throw new Error('--user is required (or use --fixture <path>)');
    const token = args.token ?? process.env.GH_PAT ?? process.env.GITHUB_TOKEN;
    if (!token) throw new Error('Provide --token or set GH_PAT/GITHUB_TOKEN in .env');
    raw = await fetchAll({ username: args.user, token });
    owner = args.user;
  }

  const stats = aggregate(raw, {
    excludeRepos: args.exclude,
    includePrivate: args.includePrivate,
    ignoreLanguages: args.ignoreLanguages,
  });

  let byRepo: RepoCommitBreakdown[] | null = null;
  if (!args.fixture) {
    const token = args.token ?? process.env.GH_PAT ?? process.env.GITHUB_TOKEN;
    byRepo = await fetchCommitsByRepo(token!, owner, raw.profile.createdAt);
  }

  if (args.json) {
    printJson(raw, stats, byRepo);
    return;
  }

  printReport(raw, stats, byRepo, args);
}

function printJson(
  raw: RawData,
  stats: StatsPayload,
  byRepo: RepoCommitBreakdown[] | null,
): void {
  console.log(
    JSON.stringify(
      {
        profile: raw.profile,
        repos: { count: raw.repos.length },
        contributionsByYear: raw.contributionsByYear,
        commitsByRepository: byRepo,
        stats,
      },
      null,
      2,
    ),
  );
}

function printReport(
  raw: RawData,
  stats: StatsPayload,
  byRepo: RepoCommitBreakdown[] | null,
  args: CliArgs,
): void {
  const fetchedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  console.log('');
  console.log(`GitBanner inspect · ${raw.profile.login}`);
  console.log(`Fetched at ${fetchedAt} UTC${args.fixture ? `  (from fixture ${args.fixture})` : ''}`);

  // 1. Banner preview
  section('what the banner will show');
  console.log(`  ${padEnd('Total Contributions', 24)} ${pad(n(stats.totalContributions), 10)}`);
  console.log(`  ${padEnd('Years coding', 24)} ${pad(n(stats.yearsCoding), 10)}`);
  console.log(`  ${padEnd('Total stars', 24)} ${pad(n(stats.totalStars), 10)}`);
  console.log(`  ${padEnd('Languages used', 24)} ${pad(n(stats.languageCount), 10)}`);
  console.log(`  ${padEnd('Public / Private repos', 24)} ${pad(`${stats.publicCount} | ${stats.privateCount}`, 10)}`);
  console.log(`  ${padEnd('Best year', 24)} ${pad(`${stats.bestYear.year} (${n(stats.bestYear.commits)})`, 10)}`);
  console.log(`  ${padEnd('Persona', 24)} ${pad(stats.persona.label, 10)}`);
  console.log(`  ${padEnd('Go-to language', 24)} ${pad(stats.goToLanguage.name, 10)}`);

  if (args.quiet) {
    console.log('');
    return;
  }

  // 2. Total Contributions breakdown
  section('contribution breakdown');
  const breakdown = [
    { label: 'Commits', value: stats.totalCommits },
    { label: 'Pull requests', value: stats.totalPRs },
    { label: 'Issues', value: stats.totalIssues },
    { label: 'Reviews', value: stats.totalReviews },
    { label: 'Restricted (hidden private)', value: stats.totalRestricted },
  ];
  for (const row of breakdown) {
    console.log(`  ${padEnd(row.label, 32)} ${pad(n(row.value), 8)}  ${pad(pct(row.value, stats.totalContributions), 7)}`);
  }
  console.log(`  ${'─'.repeat(50)}`);
  console.log(`  ${padEnd('Total', 32)} ${pad(n(stats.totalContributions), 8)}`);

  // 3. Activity by year
  section('activity per year');
  console.log(`  ${pad('Year', 6)} ${pad('Commits', 9)} ${pad('Issues', 8)} ${pad('PRs', 7)} ${pad('Reviews', 9)} ${pad('Restricted', 12)}`);
  console.log('  ' + '─'.repeat(58));
  for (const y of raw.contributionsByYear) {
    console.log(
      `  ${pad(String(y.year), 6)} ${pad(n(y.commits), 9)} ${pad(n(y.issues), 8)} ${pad(n(y.prs), 7)} ${pad(n(y.reviews), 9)} ${pad(n(y.restricted), 12)}`,
    );
  }

  // 4. Repos your commits live in (only when fetched live)
  if (byRepo) {
    const limit = Math.min(args.top, byRepo.length);
    section(`top ${limit} repos by commits (of ${byRepo.length} total)`);
    console.log(`  ${padEnd('Visibility', 10)} ${pad('Commits', 8)}  Repo`);
    console.log('  ' + '─'.repeat(64));
    for (const r of byRepo.slice(0, limit)) {
      const vis = r.isPrivate ? 'private' : r.isFork ? 'fork' : 'public';
      console.log(`  ${padEnd(vis, 10)} ${pad(n(r.commits), 8)}  ${r.nameWithOwner}`);
    }
    if (byRepo.length > limit) {
      const remaining = byRepo.slice(limit).reduce((s, r) => s + r.commits, 0);
      console.log(`  ${padEnd('...', 10)} ${pad(n(remaining), 8)}  ${byRepo.length - limit} more repos (omitted)`);
    }
  }

  // 5. Portfolio
  section('repo portfolio');
  console.log(`  ${pad(n(raw.repos.length), 5)}  total repos fetched`);
  console.log(`  ${pad(n(stats.ownedCount), 5)}  owned non-fork  (${stats.publicCount} public, ${stats.privateCount} private)`);
  console.log(`  ${pad(n(stats.forkedRepoCount), 5)}  forks of others`);
  console.log(`  ${pad(n(stats.incomingForks), 5)}  forks received on your repos`);
  console.log(`  ${pad(n(stats.languageCount), 5)}  languages across owned repos`);
  console.log(`  ${pad(n(stats.avgLifespanDays), 5)}  avg lifespan (days)`);
  console.log(`  ${pad(n(stats.avgCommitsPerRepo), 5)}  avg commits / repo`);

  // 6. Checks — only flag genuine issues
  section('checks');
  const ownedSum = raw.repos
    .filter((r) => !r.isFork)
    .reduce((s, r) => s + r.userCommits, 0);
  const checks: Array<{ status: 'ok' | 'warn'; text: string }> = [];

  if (byRepo) {
    const repoTotal = byRepo.reduce((s, r) => s + r.commits, 0);
    if (repoTotal === stats.totalCommits) {
      checks.push({ status: 'ok', text: `Per-year and per-repo commit counts agree (${n(stats.totalCommits)})` });
    } else {
      checks.push({
        status: 'warn',
        text: `Per-year (${n(stats.totalCommits)}) and per-repo (${n(repoTotal)}) commit counts differ by ${n(Math.abs(stats.totalCommits - repoTotal))}`,
      });
    }
  }

  if (stats.totalRestricted > 0) {
    checks.push({
      status: 'warn',
      text: `${n(stats.totalRestricted)} private commits are counted but their repos can't be shown (token lacks visibility into those repos)`,
    });
  }

  if (stats.totalCommits > ownedSum && byRepo) {
    const diff = stats.totalCommits - ownedSum;
    checks.push({
      status: 'ok',
      text: `${n(diff)} commits live in repos you don't own — see the per-repo list above`,
    });
  } else if (stats.totalCommits < ownedSum) {
    const diff = ownedSum - stats.totalCommits;
    checks.push({
      status: 'warn',
      text: `Contribution graph (${n(stats.totalCommits)}) is ${n(diff)} below sum of owned userCommits (${n(ownedSum)}) — likely unverified emails or non-default-branch commits`,
    });
  }

  if (args.includePrivate && stats.privateCount === 0) {
    checks.push({
      status: 'warn',
      text: `--include-private set, but 0 private repos fetched. Token likely lacks 'repo' scope.`,
    });
  }

  if (checks.length === 0) {
    checks.push({ status: 'ok', text: 'No issues detected.' });
  }
  for (const c of checks) {
    const marker = c.status === 'ok' ? '[OK]  ' : '[WARN]';
    console.log(`  ${marker}  ${c.text}`);
  }

  console.log('');
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    includePrivate: false,
    exclude: [],
    ignoreLanguages: [],
    top: 30,
    json: false,
    quiet: false,
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
      case '--ignore-languages':
        args.ignoreLanguages = next()
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
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
      case '--quiet':
      case '-q':
        args.quiet = true;
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
      --include-private   Treat private repos as visible for aggregations
  -x, --exclude <list>    Comma-separated repo names to exclude
      --ignore-languages <list>
                          Comma-separated language names to drop from
                          the Languages Used count and Go-to language
                          pick (case-insensitive)
  -n, --top <N>           How many repos to show in the per-repo breakdown (default 30)
      --json              Emit machine-readable JSON instead of the report
  -q, --quiet             Only show the headline summary
  -h, --help              Show this help

Examples
  npm run inspect -- -u yashksaini-coder --include-private
  npm run inspect -- -f tests/fixtures/raw.json
  npm run inspect -- -u yashksaini-coder -n 10 -q
  npm run --silent inspect -- -u yashksaini-coder --json | jq '.stats.totalContributions'
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
