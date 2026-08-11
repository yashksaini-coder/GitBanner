import { graphql } from '@octokit/graphql';
import type {
  DataNeed,
  DateWindow,
  IssueTotals,
  MergedPr,
  OwnRepo,
  PrTotals,
  RawData,
  ReviewYear,
} from './types.js';

interface FetchOptions {
  username: string;
  token: string;
  /** Only the queries backing these needs are issued. */
  needs: Set<DataNeed>;
  /** Scope the card to a date range instead of all time. */
  window?: DateWindow | null;
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

  // A windowed card reads its issue counts off the contributions query too.
  const wantContributions =
    needs.has('reviews') || (window !== null && needs.has('issues'));

  const [mergedPrs, reviewYears, ownRepos] = await Promise.all([
    needs.has('prs') ? fetchMergedPrs(client, username) : Promise.resolve([]),
    wantContributions
      ? fetchReviewYears(client, username, head.profile.createdAt, window)
      : Promise.resolve([]),
    needs.has('ownRepos') ? fetchOwnRepos(client, username) : Promise.resolve([]),
  ]);

  return {
    profile: head.profile,
    prTotals: head.prTotals,
    issueTotals: head.issueTotals,
    mergedPrs,
    reviewYears,
    ownRepos,
    window,
  };
}

// --- profile head -------------------------------------------------------
// Scalar counts ride along on the profile request, but they are still gated by
// need so the query text stays honest about what the banner is asking for.

interface ProfileHead {
  profile: RawData['profile'];
  prTotals: PrTotals;
  issueTotals: IssueTotals;
}

async function fetchProfileHead(
  client: GqlClient,
  login: string,
  needs: Set<DataNeed>,
  window: DateWindow | null,
): Promise<ProfileHead> {
  const prFields = needs.has('prs') && !window
    ? `prsOpened: pullRequests(states: [OPEN, CLOSED, MERGED]) { totalCount }
       prsMerged: pullRequests(states: [MERGED]) { totalCount }
       prsOpen:   pullRequests(states: [OPEN]) { totalCount }`
    : '';
  const issueFields = needs.has('issues') && !window
    ? `issuesOpened: issues { totalCount }
       issuesClosed: issues(states: [CLOSED]) { totalCount }`
    : '';

  const query = `
    query ProfileHead($login: String!) {
      user(login: $login) {
        login
        name
        createdAt
        followers { totalCount }
        following { totalCount }
        ${prFields}
        ${issueFields}
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
    issueTotals: {
      opened: user.issuesOpened?.totalCount ?? 0,
      closed: user.issuesClosed?.totalCount ?? 0,
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
    languages: { edges: Array<{ size: number; node: { name: string; color: string | null } }> };
  };
}

async function fetchMergedPrs(client: GqlClient, login: string): Promise<MergedPr[]> {
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
    const to = year === endYear ? now : new Date(Date.UTC(year, 11, 31, 23, 59, 59));
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
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        pullRequestReviewContributionsByRepository(maxRepositories: 100) {
          repository { nameWithOwner stargazerCount owner { login } }
          contributions { totalCount }
        }
      }`,
    )
    .join('');
  return `query Reviews($login: String!) { user(login: $login) { ${fields} } }`;
}

interface ReviewYearNode {
  contributionCalendar: { totalContributions: number };
  totalCommitContributions: number;
  totalIssueContributions: number;
  totalPullRequestContributions: number;
  totalPullRequestReviewContributions: number;
  pullRequestReviewContributionsByRepository: Array<{
    repository: { nameWithOwner: string; stargazerCount: number; owner: { login: string } };
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
      issuesOpened: node.totalIssueContributions,
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
        }
      }
    }
  }
`;

async function fetchOwnRepos(client: GqlClient, login: string): Promise<OwnRepo[]> {
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
      });
    }

    const pageInfo = data.user.repositories.pageInfo;
    if (!pageInfo.hasNextPage || !pageInfo.endCursor) break;
    cursor = pageInfo.endCursor;
  }

  return out;
}
