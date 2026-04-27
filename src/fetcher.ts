import { graphql } from '@octokit/graphql';
import type { RawData, Repo, RepoLanguage, YearlyContribution } from './types.js';

interface FetchOptions {
  username: string;
  token: string;
  includePrivate: boolean;
}

interface RepoNode {
  name: string;
  isPrivate: boolean;
  isFork: boolean;
  createdAt: string;
  pushedAt: string | null;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: { name: string } | null;
  languages: {
    edges: Array<{ size: number; node: { name: string; color: string | null } }>;
  };
  defaultBranchRef: {
    target: {
      history: { totalCount: number };
    } | null;
  } | null;
}

interface ProfileResponse {
  user: {
    login: string;
    name: string | null;
    createdAt: string;
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: RepoNode[];
    };
  };
}

interface ContribResponse {
  user: {
    contributionsCollection: {
      totalCommitContributions: number;
    };
  };
}

const REPO_QUERY = /* GraphQL */ `
  query Repos(
    $login: String!
    $cursor: String
    $privacy: RepositoryPrivacy
    $authorId: ID!
  ) {
    user(login: $login) {
      login
      name
      createdAt
      repositories(
        first: 50
        after: $cursor
        ownerAffiliations: [OWNER]
        privacy: $privacy
        orderBy: { field: CREATED_AT, direction: ASC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          name
          isPrivate
          isFork
          createdAt
          pushedAt
          stargazerCount
          forkCount
          primaryLanguage {
            name
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
          defaultBranchRef {
            target {
              ... on Commit {
                history(author: { id: $authorId }) {
                  totalCount
                }
              }
            }
          }
        }
      }
    }
  }
`;

const USER_ID_QUERY = /* GraphQL */ `
  query UserId($login: String!) {
    user(login: $login) {
      id
    }
  }
`;

const CONTRIB_QUERY = /* GraphQL */ `
  query Contribs($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
      }
    }
  }
`;

type GqlClient = typeof graphql;

export async function fetchAll(opts: FetchOptions): Promise<RawData> {
  const client = graphql.defaults({
    headers: { authorization: `token ${opts.token}` },
  });

  const authorId = await fetchUserNodeId(client, opts.username);

  const repos: Repo[] = [];
  const privacy = opts.includePrivate ? null : 'PUBLIC';
  let cursor: string | null = null;
  let profile: { login: string; name: string | null; createdAt: string } | null = null;

  while (true) {
    const data = (await client<ProfileResponse>(REPO_QUERY, {
      login: opts.username,
      cursor,
      privacy,
      authorId,
    })) as ProfileResponse;

    if (!profile) {
      profile = {
        login: data.user.login,
        name: data.user.name,
        createdAt: data.user.createdAt,
      };
    }

    for (const node of data.user.repositories.nodes) {
      repos.push(toRepo(node));
    }

    if (!data.user.repositories.pageInfo.hasNextPage) break;
    cursor = data.user.repositories.pageInfo.endCursor;
  }

  if (!profile) {
    throw new Error(
      `User ${opts.username} not found or has no repositories visible to this token.`,
    );
  }

  const contributionsByYear = await fetchContributionsByYear(
    client,
    opts.username,
    profile.createdAt,
  );

  return { profile, repos, contributionsByYear };
}

async function fetchUserNodeId(client: GqlClient, login: string): Promise<string> {
  const data = (await client<{ user: { id: string } }>(USER_ID_QUERY, {
    login,
  })) as { user: { id: string } };
  return data.user.id;
}

function toRepo(node: RepoNode): Repo {
  const languages: RepoLanguage[] = node.languages.edges.map((e) => ({
    name: e.node.name,
    size: e.size,
    color: e.node.color,
  }));

  return {
    name: node.name,
    isPrivate: node.isPrivate,
    isFork: node.isFork,
    createdAt: node.createdAt,
    pushedAt: node.pushedAt ?? node.createdAt,
    stargazerCount: node.stargazerCount,
    forkCount: node.forkCount,
    primaryLanguage: node.primaryLanguage?.name ?? null,
    languages,
    userCommits: node.defaultBranchRef?.target?.history?.totalCount ?? 0,
  };
}

async function fetchContributionsByYear(
  client: GqlClient,
  login: string,
  createdAt: string,
): Promise<YearlyContribution[]> {
  const startYear = new Date(createdAt).getUTCFullYear();
  const endYear = new Date().getUTCFullYear();

  const out: YearlyContribution[] = [];
  for (let year = startYear; year <= endYear; year++) {
    const from = year === startYear ? createdAt : `${year}-01-01T00:00:00Z`;
    const to = year === endYear ? new Date().toISOString() : `${year}-12-31T23:59:59Z`;

    const data = (await client<ContribResponse>(CONTRIB_QUERY, {
      login,
      from,
      to,
    })) as ContribResponse;

    out.push({
      year,
      commits: data.user.contributionsCollection.totalCommitContributions,
    });
  }

  return out;
}
