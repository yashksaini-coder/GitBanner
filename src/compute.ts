import { scorePersona } from './persona.js';
import type {
  LanguageSummary,
  ProjectRef,
  RawData,
  Repo,
  StatsPayload,
  TopRepo,
} from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_LANGUAGES = 8;
const FALLBACK_LANGUAGE_COLOR = '#94a3b8';

export interface AggregateOptions {
  excludeRepos?: string[];
  includePrivate?: boolean;
}

export function aggregate(raw: RawData, options: AggregateOptions = {}): StatsPayload {
  const excluded = new Set((options.excludeRepos ?? []).map((r) => r.toLowerCase()));
  const includePrivate = options.includePrivate ?? false;

  // Drop excluded repos before any aggregation.
  const reposVisible = raw.repos.filter((r) => !excluded.has(r.name.toLowerCase()));

  // Counts always reflect what the token saw (after exclusions).
  const ownedRepos = reposVisible.filter((r) => !r.isFork);
  const publicCount = ownedRepos.filter((r) => !r.isPrivate).length;
  const privateCount = ownedRepos.filter((r) => r.isPrivate).length;
  const forkedRepoCount = reposVisible.filter((r) => r.isFork).length;
  const ownedCount = ownedRepos.length;
  const incomingForks = ownedRepos.reduce((sum, r) => sum + r.forkCount, 0);

  // Per-repo aggregations exclude private repos when includePrivate is false,
  // so the displayed top-N lists never leak private names.
  const aggRepos = includePrivate ? ownedRepos : ownedRepos.filter((r) => !r.isPrivate);

  // Total commits counts every owned repo we can see — including repos in
  // `excludeRepos` (e.g. the profile README) — so the headline reflects the
  // user's full activity. Excluded repos are still removed from per-repo
  // aggregations (top lists, languages, project highlights, avg).
  const allOwnedRepos = raw.repos.filter((r) => !r.isFork);
  const commitsScope = includePrivate
    ? allOwnedRepos
    : allOwnedRepos.filter((r) => !r.isPrivate);
  const totalCommitsFromRepos = commitsScope.reduce((sum, r) => sum + r.userCommits, 0);

  const aggRepoSumCommits = aggRepos.reduce((sum, r) => sum + r.userCommits, 0);
  const contribSum = raw.contributionsByYear.reduce((sum, y) => sum + y.commits, 0);
  // Display the larger of the two sources — repo history undercounts when
  // contributions live in repos we can't query, while contributions overcount
  // for users who heavily review/comment.
  const totalCommits = Math.max(totalCommitsFromRepos, contribSum);

  const totalStars = aggRepos.reduce((sum, r) => sum + r.stargazerCount, 0);

  const topReposByCommits = topByMetric(aggRepos, (r) => r.userCommits, 3);
  const topReposByStars = topByMetric(aggRepos, (r) => r.stargazerCount, 3);
  const topReposByLifespan = topByMetric(aggRepos, lifespanDays, 3);

  const { languages, languageCount } = aggregateLanguages(aggRepos);

  const reposWithCommits = aggRepos.filter((r) => r.userCommits > 0);
  const avgLifespanDays =
    reposWithCommits.length === 0
      ? 0
      : Math.round(
          reposWithCommits.reduce((sum, r) => sum + lifespanDays(r), 0) /
            reposWithCommits.length,
        );

  // Use repo-sum (not the contribution-graph max) as the numerator so the
  // average is derived from the same denominator's universe. Excluded repos
  // are not in either side of this ratio.
  const avgCommitsPerRepo =
    aggRepos.length === 0 ? 0 : Math.round(aggRepoSumCommits / aggRepos.length);

  const oldestProject = projectRef(
    aggRepos.slice().sort(byDateAsc((r) => r.createdAt))[0],
    (r) => r.createdAt,
  );
  const latestProject = projectRef(
    aggRepos.slice().sort(byDateDesc((r) => r.createdAt))[0],
    (r) => r.createdAt,
  );
  const mostActiveRepo = aggRepos.slice().sort(byNumDesc((r) => r.userCommits))[0];
  const mostActiveProject = mostActiveRepo
    ? {
        name: mostActiveRepo.name,
        date: mostActiveRepo.createdAt,
        commits: mostActiveRepo.userCommits,
      }
    : { name: '—', date: new Date().toISOString(), commits: 0 };

  const yearsCoding = Math.max(
    1,
    Math.floor((Date.now() - new Date(raw.profile.createdAt).getTime()) / (DAY_MS * 365.25)),
  );

  const bestYear = pickBestYear(raw.contributionsByYear);
  const goToLanguage = pickGoToLanguage(aggRepos, languages);

  const payload: StatsPayload = {
    username: raw.profile.login,
    generatedAt: new Date().toISOString(),
    totalCommits,
    totalStars,
    topReposByCommits,
    topReposByStars,
    topReposByLifespan,
    languages,
    languageCount,
    avgLifespanDays,
    avgCommitsPerRepo,
    publicCount,
    privateCount,
    forkedRepoCount,
    ownedCount,
    incomingForks,
    oldestProject,
    latestProject,
    mostActiveProject,
    yearsCoding,
    bestYear,
    goToLanguage,
    followers: raw.profile.followers,
    following: raw.profile.following,
    persona: { key: 'rising-dev', label: '', tagline: '', iconKey: '', accentColor: '' },
  };

  payload.persona = scorePersona(payload);
  return payload;
}

function lifespanDays(r: Repo): number {
  return Math.max(
    0,
    Math.round((new Date(r.pushedAt).getTime() - new Date(r.createdAt).getTime()) / DAY_MS),
  );
}

function topByMetric(repos: Repo[], metric: (r: Repo) => number, n: number): TopRepo[] {
  return repos
    .map((r) => ({ name: r.name, value: metric(r) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

function aggregateLanguages(repos: Repo[]): {
  languages: LanguageSummary[];
  languageCount: number;
} {
  const totals = new Map<string, { bytes: number; color: string | null }>();

  for (const repo of repos) {
    for (const lang of repo.languages) {
      const entry = totals.get(lang.name) ?? { bytes: 0, color: lang.color };
      entry.bytes += lang.size;
      if (!entry.color && lang.color) entry.color = lang.color;
      totals.set(lang.name, entry);
    }
  }

  const totalBytes = Array.from(totals.values()).reduce((s, e) => s + e.bytes, 0);
  const sorted = Array.from(totals.entries())
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .map<LanguageSummary>(([name, entry]) => ({
      name,
      bytes: entry.bytes,
      percent: totalBytes === 0 ? 0 : (entry.bytes / totalBytes) * 100,
      color: entry.color ?? FALLBACK_LANGUAGE_COLOR,
    }));

  return {
    languages: sorted.slice(0, TOP_LANGUAGES),
    languageCount: sorted.length,
  };
}

function pickBestYear(yearly: { year: number; commits: number }[]): {
  year: number;
  commits: number;
} {
  if (yearly.length === 0) return { year: new Date().getUTCFullYear(), commits: 0 };
  return yearly.slice().sort((a, b) => b.commits - a.commits)[0];
}

function pickGoToLanguage(
  repos: Repo[],
  langs: LanguageSummary[],
): StatsPayload['goToLanguage'] {
  const top = langs[0];
  if (!top) {
    return { name: '—', reposUsing: 0, color: FALLBACK_LANGUAGE_COLOR };
  }
  const reposUsing = repos.filter((r) =>
    r.languages.some((l) => l.name === top.name),
  ).length;
  return { name: top.name, reposUsing, color: top.color };
}

function projectRef(repo: Repo | undefined, date: (r: Repo) => string): ProjectRef {
  if (!repo) return { name: '—', date: new Date().toISOString() };
  return { name: repo.name, date: date(repo) };
}

function byDateAsc<T>(getDate: (t: T) => string) {
  return (a: T, b: T) => new Date(getDate(a)).getTime() - new Date(getDate(b)).getTime();
}
function byDateDesc<T>(getDate: (t: T) => string) {
  return (a: T, b: T) => new Date(getDate(b)).getTime() - new Date(getDate(a)).getTime();
}
function byNumDesc<T>(getNum: (t: T) => number) {
  return (a: T, b: T) => getNum(b) - getNum(a);
}
