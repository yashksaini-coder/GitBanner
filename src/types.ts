export interface Profile {
  login: string;
  name: string | null;
  createdAt: string;
  followers: number;
  following: number;
}

/**
 * What a tile needs fetched. The fetcher unions the needs of the selected
 * tiles and skips every query nothing asked for — dropping the own-repo tiles
 * skips repo pagination entirely, for example.
 */
export type DataNeed = 'prs' | 'reviews' | 'issues' | 'ownRepos';

export interface RepoLang {
  name: string;
  color: string | null;
  /** Linguist byte count — used to drop incidental slivers from the tally. */
  size: number;
}

export interface PrRepoRef {
  nameWithOwner: string;
  owner: string;
  stars: number;
  isPrivate: boolean;
  /**
   * Every language linguist detects in the repo, largest first. Linguist
   * already excludes vendored and generated files (lockfiles, dist/, minified
   * bundles), so this is "languages a human wrote", not "files in the repo".
   */
  languages: RepoLang[];
}

export interface MergedPr {
  mergedAt: string;
  repo: PrRepoRef;
}

export interface PrTotals {
  opened: number;
  merged: number;
  open: number;
}

export interface IssueTotals {
  opened: number;
  closed: number;
}

export interface ReviewRepoRef {
  nameWithOwner: string;
  owner: string;
  stars: number;
  count: number;
}

/** One contributions window — a calendar year, or an explicit --since/--until. */
export interface ReviewYear {
  year: number;
  reviews: number;
  commits: number;
  totalContributions: number;
  issuesOpened: number;
  prsOpened: number;
  byRepo: ReviewRepoRef[];
}

export interface DateWindow {
  since: string;
  until: string;
  label: string;
}

export interface OwnRepo {
  name: string;
  isFork: boolean;
  isPrivate: boolean;
  stars: number;
}

/** Empty collections mean "no tile asked for it", not "the user has none". */
export interface RawData {
  profile: Profile;
  mergedPrs: MergedPr[];
  prTotals: PrTotals;
  issueTotals: IssueTotals;
  reviewYears: ReviewYear[];
  ownRepos: OwnRepo[];
  /** Non-null when the card is scoped to a date range rather than all time. */
  window: DateWindow | null;
}

/** An external repo the user has landed work in. */
export interface ExternalRepo {
  nameWithOwner: string;
  /** Repo name without the owner, for display in narrow tiles. */
  name: string;
  stars: number;
  mergedPrs: number;
  languages: RepoLang[];
}

/** Reviews per external repo per year, aligned for the ridgeline tile. */
export interface ReviewRidges {
  /** Every year present in the raw data, ascending. */
  years: number[];
  /** Top external reviewed repos, most reviews first; counts align with years. */
  series: { name: string; counts: number[] }[];
}

export interface TopRepo {
  name: string;
  value: number;
}

export interface LanguageSummary {
  name: string;
  repos: number;
  color: string;
}

export interface StatsPayload {
  username: string;
  generatedAt: string;

  // Pull requests
  prsOpened: number;
  prsMerged: number;
  prsOpen: number;
  /** Merged into repos the user does not own — the headline credibility number. */
  prsMergedExternal: number;
  mergeRatePct: number;

  // External footprint, derived from merged PRs
  externalRepos: ExternalRepo[];
  externalRepoCount: number;
  biggestProject: ExternalRepo | null;
  /** External merges in the trailing 12 months — the momentum story. */
  recentExternalPrs: number;
  recentExternalRepoCount: number;
  /**
   * External merges bucketed by calendar month (UTC), trailing 12 months
   * ending with the current month, oldest first. label = month's first letter.
   */
  monthlyExternalMerges: { label: string; month: number; count: number }[];
  /** Issues you opened per calendar year, oldest first; empty when not fetched. */
  issuesByYear: { year: number; opened: number }[];
  /**
   * Merged external PRs bucketed by the target repo's star magnitude —
   * fixed log decades, so the x-axis is stable across users. Scoped to the
   * current UTC calendar year (or to the window on a windowed card), so it
   * sums to the current-year external merge count, not the all-time headline.
   */
  popularitySpectrum: { label: string; count: number }[];
  /** This calendar year's external repos ranked by merged PRs (top 8). */
  topExternalThisYear: TopRepo[];

  // Reviews
  reviewsTotal: number;
  reviewsExternal: number;
  topReviewedRepos: TopRepo[];
  /** Reviews per year for the top 6 external repos, for the ridgeline. */
  reviewRidges: ReviewRidges;

  // Issues. issuesClosed is null for a windowed card: GitHub exposes issues
  // *opened* in a window, but not issues closed in one.
  issuesOpened: number;
  issuesClosed: number | null;

  // Languages of the external repos the user ships in
  languages: LanguageSummary[];
  languageCount: number;

  // Own work
  ownStars: number;
  ownRepoCount: number;
  /** The user's highest-starred own repo (never a private name unless asked). */
  ownTopRepo: { name: string; stars: number } | null;
  /** Top own repos by stars (same visibility rules), for the mini sparkline. */
  ownTopRepos: { name: string; stars: number }[];

  followers: number;
  following: number;
  bestYear: { year: number; commits: number };
  /** e.g. "1-9 Aug 2026". Null for an all-time card. */
  periodLabel: string | null;
}

export interface ThemeAccents {
  prs: string;
  reviews: string;
  projects: string;
  reach: string;
  issues: string;
  languages: string;
  neutral: string;
}

export interface Theme {
  bg: string;
  tile: string;
  tileBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  divider: string;
  pillBg: string;
  pillText: string;
  accents: ThemeAccents;
}

export type ThemeName = 'dark';

export type OutputFormat = 'svg' | 'png' | 'both';
