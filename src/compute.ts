import type {
  ExternalRepo,
  LanguageSummary,
  MergedPr,
  RawData,
  ReviewYear,
  StatsPayload,
  TopRepo,
} from './types.js';

const TOP_LANGUAGES = 10;
const FALLBACK_LANGUAGE_COLOR = '#94a3b8';

/**
 * How many merged PRs make you a contributor to a project rather than a
 * drive-by. Two is enough to exclude one-off tutorial PRs (a single PR into a
 * 55k-star "first contributions" repo would otherwise dominate combined reach)
 * without discarding genuine small contributions.
 */
export const DEFAULT_MIN_MERGED_PRS = 2;

export interface AggregateOptions {
  /** Repos excluded from every per-repo list, matched on name or owner/name. */
  excludeRepos?: string[];
  /** Count work in private repos. Private repo names are never displayed. */
  includePrivate?: boolean;
  /** Merged PRs a repo needs before it counts as one you contributed to. */
  minMergedPrs?: number;
  /** Language names dropped from the language tiles, matched case-insensitively. */
  ignoreLanguages?: string[];
}

export function aggregate(raw: RawData, options: AggregateOptions = {}): StatsPayload {
  const excluded = new Set((options.excludeRepos ?? []).map((r) => r.toLowerCase()));
  const includePrivate = options.includePrivate ?? false;
  const minMergedPrs = Math.max(1, options.minMergedPrs ?? DEFAULT_MIN_MERGED_PRS);
  const ignoredLanguages = new Set(
    (options.ignoreLanguages ?? []).map((l) => l.toLowerCase()),
  );
  const login = raw.profile.login.toLowerCase();

  const isExcluded = (nameWithOwner: string): boolean => {
    const lower = nameWithOwner.toLowerCase();
    return excluded.has(lower) || excluded.has(lower.split('/')[1] ?? lower);
  };

  // A PR counts as external when the repo belongs to someone else. That, not
  // the fork flag, is what "landed work in someone else's project" means.
  // A windowed card keeps only PRs merged inside the range. The PR query has no
  // date filter, so this is the filter — mergedAt is fetched for exactly this.
  const since = raw.window ? Date.parse(raw.window.since) : null;
  const until = raw.window ? Date.parse(raw.window.until) : null;
  const inWindow = (pr: { mergedAt: string }): boolean => {
    if (since === null || until === null) return true;
    const at = Date.parse(pr.mergedAt);
    return Number.isFinite(at) && at >= since && at <= until;
  };

  const usablePrs = raw.mergedPrs.filter(
    (pr) =>
      inWindow(pr) &&
      !isExcluded(pr.repo.nameWithOwner) &&
      (includePrivate || !pr.repo.isPrivate),
  );
  const externalPrs = usablePrs.filter((pr) => pr.repo.owner.toLowerCase() !== login);

  // Every external merged PR is real work, so prsMergedExternal counts them all.
  // Repo-level claims (reach, project count, biggest, languages) are the ones a
  // drive-by PR inflates, so those use the qualifying subset only.
  const allExternalRepos = groupExternalRepos(externalPrs);
  const qualifying = allExternalRepos.filter((r) => r.mergedPrs >= minMergedPrs);
  // A newcomer whose every contribution is a first PR would otherwise show
  // "0 projects" beside a non-zero merged count. Show what they have instead.
  const externalRepos = qualifying.length > 0 ? qualifying : allExternalRepos;

  const biggestProject = pickBiggest(externalRepos);

  // Trailing 12 months from now. On a windowed card externalPrs is already
  // range-filtered, so this can only narrow further, never contradict it.
  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const recentPrs = externalPrs.filter((pr) => Date.parse(pr.mergedAt) >= cutoff);
  const recentRepos = new Set(recentPrs.map((pr) => pr.repo.nameWithOwner));

  const { languages, languageCount } = summariseLanguages(externalRepos, ignoredLanguages);

  const reviews = summariseReviews(raw.reviewYears, login, isExcluded, includePrivate);

  // Highest-starred own repo: same visibility rule as the star sum, so a
  // private repo name can never appear on the card unless explicitly asked.
  const ownRepos = raw.ownRepos.filter(
    (r) => !r.isFork && (includePrivate || !r.isPrivate),
  );
  const ownStars = ownRepos.reduce((sum, r) => sum + r.stars, 0);
  const ownTop = ownRepos.reduce(
    (best, r) => (best === null || r.stars > best.stars ? r : best),
    null as (typeof ownRepos)[number] | null,
  );

  // On a windowed card the all-time PR/issue totals were never fetched; the
  // window equivalents come from contributionsCollection instead.
  const period = raw.window ? sumPeriods(raw.reviewYears) : null;
  const prsOpened = period ? period.prsOpened : raw.prTotals.opened;
  const prsMerged = period ? usablePrs.length : raw.prTotals.merged;
  const issuesOpened = period ? period.issuesOpened : raw.issueTotals.opened;
  const issuesClosed = period ? null : raw.issueTotals.closed;

  return {
    username: raw.profile.login,
    generatedAt: new Date().toISOString(),

    prsOpened,
    prsMerged,
    prsOpen: period ? 0 : raw.prTotals.open,
    prsMergedExternal: externalPrs.length,
    mergeRatePct: percent(prsMerged, prsOpened),

    externalRepos,
    externalRepoCount: externalRepos.length,
    biggestProject,
    recentExternalPrs: recentPrs.length,
    recentExternalRepoCount: recentRepos.size,

    reviewsTotal: reviews.total,
    reviewsExternal: reviews.external,
    topReviewedRepos: reviews.top,

    issuesOpened,
    issuesClosed,

    languages,
    languageCount,

    ownStars,
    ownRepoCount: ownRepos.length,
    ownTopRepo: ownTop ? { name: ownTop.name, stars: ownTop.stars } : null,

    followers: raw.profile.followers,
    following: raw.profile.following,
    periodLabel: raw.window?.label ?? null,
  };
}

function sumPeriods(years: ReviewYear[]): { prsOpened: number; issuesOpened: number } {
  return years.reduce(
    (acc, y) => ({
      prsOpened: acc.prsOpened + y.prsOpened,
      issuesOpened: acc.issuesOpened + y.issuesOpened,
    }),
    { prsOpened: 0, issuesOpened: 0 },
  );
}

/** One entry per external repo, ranked by how much of the user's work it took. */
function groupExternalRepos(prs: MergedPr[]): ExternalRepo[] {
  const byRepo = new Map<string, ExternalRepo>();

  for (const pr of prs) {
    const existing = byRepo.get(pr.repo.nameWithOwner);
    if (existing) {
      existing.mergedPrs++;
      // Star counts are identical across a repo's PRs; keep the largest seen
      // so a stale early page can't drag the number down.
      existing.stars = Math.max(existing.stars, pr.repo.stars);
      continue;
    }
    byRepo.set(pr.repo.nameWithOwner, {
      nameWithOwner: pr.repo.nameWithOwner,
      name: pr.repo.nameWithOwner.split('/')[1] ?? pr.repo.nameWithOwner,
      stars: pr.repo.stars,
      mergedPrs: 1,
      languages: pr.repo.languages,
    });
  }

  return [...byRepo.values()].sort(
    (a, b) => b.mergedPrs - a.mergedPrs || b.stars - a.stars,
  );
}

function pickBiggest(repos: ExternalRepo[]): ExternalRepo | null {
  if (repos.length === 0) return null;
  return repos.reduce((best, r) => (r.stars > best.stars ? r : best));
}

/**
 * Every language the user ships in, measured by how many external projects use
 * each one. Uses the full linguist language list per repo (not just the primary
 * language), which already excludes vendored and generated files — lockfiles,
 * dist/, minified bundles never count. Rides along free on the merged-PR pages.
 */
function summariseLanguages(
  repos: ExternalRepo[],
  ignored: Set<string>,
): {
  languages: LanguageSummary[];
  languageCount: number;
} {
  const totals = new Map<string, { repos: number; color: string | null }>();

  for (const repo of repos) {
    for (const lang of repo.languages) {
      if (ignored.has(lang.name.toLowerCase())) continue;
      const entry = totals.get(lang.name) ?? { repos: 0, color: lang.color };
      entry.repos++;
      if (!entry.color && lang.color) entry.color = lang.color;
      totals.set(lang.name, entry);
    }
  }

  const sorted = [...totals.entries()]
    .sort((a, b) => b[1].repos - a[1].repos || a[0].localeCompare(b[0]))
    .map<LanguageSummary>(([name, entry]) => ({
      name,
      repos: entry.repos,
      color: entry.color ?? FALLBACK_LANGUAGE_COLOR,
    }));

  return { languages: sorted.slice(0, TOP_LANGUAGES), languageCount: sorted.length };
}

function summariseReviews(
  years: ReviewYear[],
  login: string,
  isExcluded: (nameWithOwner: string) => boolean,
  includePrivate: boolean,
): { total: number; external: number; top: TopRepo[] } {
  let total = 0;
  let external = 0;
  const byRepo = new Map<string, number>();

  for (const year of years) {
    total += year.reviews;
    for (const entry of year.byRepo) {
      if (isExcluded(entry.nameWithOwner)) continue;
      if (entry.owner.toLowerCase() === login) continue;
      external += entry.count;
      byRepo.set(entry.nameWithOwner, (byRepo.get(entry.nameWithOwner) ?? 0) + entry.count);
    }
  }

  const top = [...byRepo.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([nameWithOwner, value]) => ({
      name: nameWithOwner.split('/')[1] ?? nameWithOwner,
      value,
    }));

  // includePrivate has no effect here: the reviews API does not expose repo
  // privacy, so private-repo reviews are already absent from byRepo.
  void includePrivate;

  return { total, external, top };
}

function percent(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 100);
}

/** Top N external repos by merged PRs, for a stat tile's row list. */
export function topExternalByPrs(p: StatsPayload, n: number): TopRepo[] {
  return p.externalRepos.slice(0, n).map((r) => ({ name: r.name, value: r.mergedPrs }));
}

/** Top N external repos by stars, for the reach and projects tiles. */
export function topExternalByStars(p: StatsPayload, n: number): TopRepo[] {
  return p.externalRepos
    .slice()
    .sort((a, b) => b.stars - a.stars)
    .slice(0, n)
    .map((r) => ({ name: r.name, value: r.stars }));
}
