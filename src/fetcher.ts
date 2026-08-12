import { graphql } from "@octokit/graphql";
import type {
  DataNeed,
  DateWindow,
  IssueYear,
  MergedPr,
  OwnRepo,
  PrTotals,
  RawData,
  ReviewYear,
} from "./types.js";

interface FetchOptions {
  username: string;
  token: string;
  /** Only the queries backing these needs are issued. */
  needs: Set<DataNeed>;
  /** Scope the card to a date range instead of all time. */
  window?: DateWindow | null;
  /** Let the commit pulse sample private repos (counts only, never names). */
  includePrivate?: boolean;
}

type GqlClient = typeof graphql;

/** GitHub caps a single PR page at 100; 20 pages is 2000 merged PRs. */
const PR_PAGE_SIZE = 100;
const PR_MAX_PAGES = 20;

export async function fetchAll(opts: FetchOptions): Promise<RawData> {
  const client = graphql.defaults({
    headers: { authorization: `token ${opts.token}` },
  });
  const { needs, username } = opts;

  const window = opts.window ?? null;
  // All-time PR/issue totals are meaningless on a windowed card, so they are
  // only requested when there is no window; the windowed equivalents come from
  // contributionsCollection instead.
  const head = await fetchProfileHead(client, username, needs, window);

  // A windowed card reads its PRs-opened total — which the merge rate
  // divides by — off the contributions query too.
  const wantContributions =
    needs.has("reviews") || (window !== null && needs.has("prs"));

  // The commit pulse samples the user's own repos, so it shares one repo
  // pagination with the own-stars tile instead of adding a second.
  const wantOwnRepos = needs.has("ownRepos") || needs.has("commitPulse");

  const [mergedPrs, reviewYears, issueYears, ownRepos] = await Promise.all([
    needs.has("prs") ? fetchMergedPrs(client, username) : Promise.resolve([]),
    wantContributions
      ? fetchReviewYears(client, username, head.profile.createdAt, window)
      : Promise.resolve([]),
    needs.has("issues")
      ? fetchIssueYears(client, username, head.profile.createdAt, window)
      : Promise.resolve([]),
    wantOwnRepos ? fetchOwnRepos(client, username) : Promise.resolve([]),
  ]);

  const pulse = needs.has("commitPulse")
    ? await fetchWeeklyCommits(
        opts.token,
        username,
        ownRepos,
        opts.includePrivate ?? false,
      )
    : { weeks: [], repoCount: 0 };

  return {
    profile: head.profile,
    prTotals: head.prTotals,
    issueYears,
    mergedPrs,
    reviewYears,
    ownRepos,
    weeklyCommits: pulse.weeks,
    pulseRepoCount: pulse.repoCount,
    window,
  };
}

// --- profile head -------------------------------------------------------
// Scalar counts ride along on the profile request, but they are still gated by
// need so the query text stays honest about what the banner is asking for.

interface ProfileHead {
  profile: RawData["profile"];
  prTotals: PrTotals;
}

async function fetchProfileHead(
  client: GqlClient,
  login: string,
  needs: Set<DataNeed>,
  window: DateWindow | null,
): Promise<ProfileHead> {
  const prFields =
    needs.has("prs") && !window
      ? `prsOpened: pullRequests(states: [OPEN, CLOSED, MERGED]) { totalCount }
       prsMerged: pullRequests(states: [MERGED]) { totalCount }
       prsOpen:   pullRequests(states: [OPEN]) { totalCount }`
      : "";

  const query = `
    query ProfileHead($login: String!) {
      user(login: $login) {
        login
        name
        createdAt
        followers { totalCount }
        following { totalCount }
        ${prFields}
      }
    }
  `;

  const { user } = (await client<{ user: Record<string, any> | null }>(query, {
    login,
  })) as { user: Record<string, any> | null };

  if (!user) {
    throw new Error(`User ${login} not found or not visible to this token.`);
  }

  return {
    profile: {
      login: user.login,
      name: user.name,
      createdAt: user.createdAt,
      followers: user.followers.totalCount,
      following: user.following.totalCount,
    },
    prTotals: {
      opened: user.prsOpened?.totalCount ?? 0,
      merged: user.prsMerged?.totalCount ?? 0,
      open: user.prsOpen?.totalCount ?? 0,
    },
  };
}

// --- merged pull requests ----------------------------------------------
// This is where the whole external story comes from: which repos accepted the
// user's work, how big those repos are, and when it started. Deliberately NOT
// using repositoriesContributedTo — it has a recency window (reported 38 repos
// where merged PRs span 94) and silently ignores its own orderBy argument.

const MERGED_PR_QUERY = /* GraphQL */ `
  query MergedPrs($login: String!, $cursor: String, $pageSize: Int!) {
    user(login: $login) {
      pullRequests(
        states: [MERGED]
        first: $pageSize
        after: $cursor
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          mergedAt
          repository {
            nameWithOwner
            stargazerCount
            isPrivate
            owner {
              login
            }
            languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
              edges {
                size
                node {
                  name
                  color
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface MergedPrNode {
  mergedAt: string;
  repository: {
    nameWithOwner: string;
    stargazerCount: number;
    isPrivate: boolean;
    owner: { login: string };
    languages: {
      edges: Array<{
        size: number;
        node: { name: string; color: string | null };
      }>;
    };
  };
}

async function fetchMergedPrs(
  client: GqlClient,
  login: string,
): Promise<MergedPr[]> {
  const out: MergedPr[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < PR_MAX_PAGES; page++) {
    const data = (await client<{
      user: {
        pullRequests: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: MergedPrNode[];
        };
      };
    }>(MERGED_PR_QUERY, { login, cursor, pageSize: PR_PAGE_SIZE })) as {
      user: {
        pullRequests: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: MergedPrNode[];
        };
      };
    };

    for (const node of data.user.pullRequests.nodes) {
      out.push({
        mergedAt: node.mergedAt,
        repo: {
          nameWithOwner: node.repository.nameWithOwner,
          owner: node.repository.owner.login,
          stars: node.repository.stargazerCount,
          isPrivate: node.repository.isPrivate,
          languages: node.repository.languages.edges.map((e) => ({
            name: e.node.name,
            color: e.node.color,
            size: e.size,
          })),
        },
      });
    }

    const pageInfo = data.user.pullRequests.pageInfo;
    if (!pageInfo.hasNextPage || !pageInfo.endCursor) break;
    if (page === PR_MAX_PAGES - 1) {
      // Newest-first pagination: everything older than the cap is missing, so
      // older windowed cards and all-time repo lists are incomplete.
      console.warn(
        `GitBanner: merged-PR history truncated at ${PR_MAX_PAGES * PR_PAGE_SIZE} newest PRs; older contributions are not counted.`,
      );
    }
    cursor = pageInfo.endCursor;
  }

  return out;
}

// --- reviews ------------------------------------------------------------
// contributionsCollection caps its window at one year, so the years can't be
// merged — but they can be aliased into one request instead of one round trip
// each. Dates are re-serialised from Date objects, so nothing external is ever
// spliced into the query text.

interface YearWindow {
  year: number;
  from: string;
  to: string;
}

function yearWindows(createdAt: string, now: Date): YearWindow[] {
  const start = new Date(createdAt);
  const startYear = start.getUTCFullYear();
  const endYear = now.getUTCFullYear();

  const out: YearWindow[] = [];
  for (let year = startYear; year <= endYear; year++) {
    const from = year === startYear ? start : new Date(Date.UTC(year, 0, 1));
    const to =
      year === endYear ? now : new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    out.push({ year, from: from.toISOString(), to: to.toISOString() });
  }
  return out;
}

function reviewQuery(windows: YearWindow[]): string {
  const fields = windows
    .map(
      (w) => `
      y${w.year}: contributionsCollection(from: "${w.from}", to: "${w.to}") {
        contributionCalendar { totalContributions }
        totalCommitContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        pullRequestReviewContributionsByRepository(maxRepositories: 100) {
          repository { nameWithOwner stargazerCount owner { login } }
          contributions { totalCount }
        }
      }`,
    )
    .join("");
  return `query Reviews($login: String!) { user(login: $login) { ${fields} } }`;
}

interface ReviewYearNode {
  contributionCalendar: { totalContributions: number };
  totalCommitContributions: number;
  totalPullRequestContributions: number;
  totalPullRequestReviewContributions: number;
  pullRequestReviewContributionsByRepository: Array<{
    repository: {
      nameWithOwner: string;
      stargazerCount: number;
      owner: { login: string };
    };
    contributions: { totalCount: number };
  }>;
}

async function fetchReviewYears(
  client: GqlClient,
  login: string,
  createdAt: string,
  window: DateWindow | null,
): Promise<ReviewYear[]> {
  // A window shorter than a year is one aliased field; all-time is one per year.
  const windows: YearWindow[] = window
    ? [
        {
          year: new Date(window.since).getUTCFullYear(),
          from: new Date(window.since).toISOString(),
          to: new Date(window.until).toISOString(),
        },
      ]
    : yearWindows(createdAt, new Date());
  const data = (await client<{ user: Record<string, ReviewYearNode> }>(
    reviewQuery(windows),
    { login },
  )) as { user: Record<string, ReviewYearNode> };

  const out: ReviewYear[] = [];
  for (const w of windows) {
    const node = data.user[`y${w.year}`];
    if (!node) continue;
    out.push({
      year: w.year,
      reviews: node.totalPullRequestReviewContributions,
      commits: node.totalCommitContributions,
      totalContributions: node.contributionCalendar.totalContributions,
      prsOpened: node.totalPullRequestContributions,
      byRepo: node.pullRequestReviewContributionsByRepository.map((e) => ({
        nameWithOwner: e.repository.nameWithOwner,
        owner: e.repository.owner.login,
        stars: e.repository.stargazerCount,
        count: e.contributions.totalCount,
      })),
    });
  }
  return out;
}

// --- issues -------------------------------------------------------------
// Issues the user filed in public repos they don't own, and how many of those
// were resolved. contributionsCollection can't answer this (it has no closed
// state and no ownership split), but issue search can: `-user:<login>` is
// exactly the banner's external rule (owner != login), `is:public` keeps the
// open-source claim honest, and `reason:completed` counts only issues closed
// as resolved — closed-as-not-planned never counts. One aliased request for
// every year.

function issueSearch(login: string, extra: string, from: string, to: string): string {
  // JSON.stringify produces a valid, fully-escaped GraphQL string literal.
  return JSON.stringify(
    `author:${login} is:issue is:public -user:${login} ${extra}created:${from}..${to}`.replace('  ', ' '),
  );
}

function issueQuery(login: string, windows: YearWindow[]): string {
  const fields = windows
    .map((w) => {
      const from = w.from.slice(0, 10);
      const to = w.to.slice(0, 10);
      return `
      o${w.year}: search(query: ${issueSearch(login, '', from, to)}, type: ISSUE) { issueCount }
      c${w.year}: search(query: ${issueSearch(login, 'is:closed reason:completed ', from, to)}, type: ISSUE) { issueCount }`;
    })
    .join('');
  return `query Issues { ${fields} }`;
}

async function fetchIssueYears(
  client: GqlClient,
  login: string,
  createdAt: string,
  window: DateWindow | null,
): Promise<IssueYear[]> {
  const windows: YearWindow[] = window
    ? [
        {
          year: new Date(window.since).getUTCFullYear(),
          from: new Date(window.since).toISOString(),
          to: new Date(window.until).toISOString(),
        },
      ]
    : yearWindows(createdAt, new Date());

  const data = (await client<Record<string, { issueCount: number }>>(
    issueQuery(login, windows),
  )) as Record<string, { issueCount: number }>;

  return windows
    .map((w) => ({
      year: w.year,
      opened: data[`o${w.year}`]?.issueCount ?? 0,
      closed: data[`c${w.year}`]?.issueCount ?? 0,
    }))
    .filter((y) => y.opened > 0 || y.closed > 0 || window !== null);
}

// --- commit pulse ---------------------------------------------------------
// REST participation stats: the last 52 weeks of commit counts per repo,
// split into `all` and `owner`. Summing the `owner` series across the user's
// own most recently pushed repos gives "my commits per week" — the weekly
// consistency story. The stats are computed lazily server-side, so a cold
// repo answers 202 until the numbers are ready; those repos are retried,
// then skipped, and pulseRepoCount reports what the sum actually covers.

/** Most recently pushed own repos the pulse samples — recent pushes hold
 * essentially all recent commits, and 12 REST calls stay cheap. */
const PULSE_REPO_SAMPLE = 12;
const PULSE_WEEKS = 52;

export async function fetchWeeklyCommits(
  token: string,
  login: string,
  repos: OwnRepo[],
  includePrivate: boolean,
): Promise<{ weeks: number[]; repoCount: number }> {
  const sample = repos
    .filter((r) => !r.isFork && (includePrivate || !r.isPrivate))
    .sort((a, b) => Date.parse(b.pushedAt) - Date.parse(a.pushedAt))
    .slice(0, PULSE_REPO_SAMPLE);

  const weeks = new Array<number>(PULSE_WEEKS).fill(0);
  let repoCount = 0;
  await Promise.all(
    sample.map(async (repo) => {
      const owner = await fetchParticipation(token, login, repo.name);
      if (!owner) return;
      addWeeks(weeks, owner);
      repoCount++;
    }),
  );
  return { weeks, repoCount };
}

/** Sum a repo's owner series into the running total, index-aligned. */
export function addWeeks(total: number[], owner: number[]): void {
  for (let i = 0; i < total.length; i++) total[i] += owner[i] ?? 0;
}

async function fetchParticipation(
  token: string,
  login: string,
  repo: string,
): Promise<number[] | null> {
  const url = `https://api.github.com/repos/${login}/${repo}/stats/participation`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2026-03-10",
        "user-agent": "gitbanner",
      },
    });
    if (res.status === 200) {
      const body = (await res.json()) as { owner?: number[] };
      return body.owner ?? null;
    }
    if (res.status !== 202) {
      console.warn(
        `GitBanner: participation stats for ${login}/${repo} failed (${res.status}); repo skipped from the commit pulse.`,
      );
      return null;
    }
    // 202: GitHub is still computing the stats; give it a moment.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  console.warn(
    `GitBanner: participation stats for ${login}/${repo} still computing; repo skipped from the commit pulse.`,
  );
  return null;
}

// --- own repos ----------------------------------------------------------
// Only what the own-stars tile needs. No languages, no dates, no commit
// history — those all went with the tiles that used them.

const OWN_REPOS_QUERY = /* GraphQL */ `
  query OwnRepos($login: String!, $cursor: String) {
    user(login: $login) {
      repositories(first: 100, after: $cursor, ownerAffiliations: [OWNER]) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          name
          isFork
          isPrivate
          stargazerCount
          pushedAt
        }
      }
    }
  }
`;

async function fetchOwnRepos(
  client: GqlClient,
  login: string,
): Promise<OwnRepo[]> {
  const out: OwnRepo[] = [];
  let cursor: string | null = null;

  while (true) {
    const data = (await client<{
      user: {
        repositories: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{
            name: string;
            isFork: boolean;
            isPrivate: boolean;
            stargazerCount: number;
            pushedAt: string;
          }>;
        };
      };
    }>(OWN_REPOS_QUERY, { login, cursor })) as {
      user: {
        repositories: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{
            name: string;
            isFork: boolean;
            isPrivate: boolean;
            stargazerCount: number;
            pushedAt: string;
          }>;
        };
      };
    };

    for (const node of data.user.repositories.nodes) {
      out.push({
        name: node.name,
        isFork: node.isFork,
        isPrivate: node.isPrivate,
        stars: node.stargazerCount,
        pushedAt: node.pushedAt,
      });
    }

    const pageInfo = data.user.repositories.pageInfo;
    if (!pageInfo.hasNextPage || !pageInfo.endCursor) break;
    cursor = pageInfo.endCursor;
  }

  return out;
}
