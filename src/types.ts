export interface Profile {
  login: string;
  name: string | null;
  createdAt: string;
}

export interface RepoLanguage {
  name: string;
  size: number;
  color: string | null;
}

export interface Repo {
  name: string;
  isPrivate: boolean;
  isFork: boolean;
  createdAt: string;
  pushedAt: string;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: string | null;
  languages: RepoLanguage[];
  userCommits: number;
}

export interface YearlyContribution {
  year: number;
  commits: number;
}

export interface RawData {
  profile: Profile;
  repos: Repo[];
  contributionsByYear: YearlyContribution[];
}

export interface TopRepo {
  name: string;
  value: number;
}

export interface LanguageSummary {
  name: string;
  bytes: number;
  percent: number;
  color: string;
}

export type PersonaKey =
  | 'open-source-star'
  | 'polyglot'
  | 'veteran'
  | 'specialist'
  | 'builder'
  | 'explorer'
  | 'rising-dev';

export interface Persona {
  key: PersonaKey;
  label: string;
  tagline: string;
  iconKey: string;
  accentColor: string;
}

export interface ProjectRef {
  name: string;
  date: string;
}

export interface StatsPayload {
  username: string;
  generatedAt: string;

  totalCommits: number;
  totalStars: number;

  topReposByCommits: TopRepo[];
  topReposByStars: TopRepo[];
  topReposByLifespan: TopRepo[];

  languages: LanguageSummary[];
  languageCount: number;

  avgLifespanDays: number;
  avgCommitsPerRepo: number;

  publicCount: number;
  privateCount: number;
  forkCount: number;
  ownedCount: number;

  oldestProject: ProjectRef;
  latestProject: ProjectRef;
  mostActiveProject: ProjectRef & { commits: number };

  yearsCoding: number;
  goToLanguage: { name: string; reposUsing: number; color: string };

  persona: Persona;
}

export interface ThemeAccents {
  commits: string;
  stars: string;
  languages: string;
  lifespan: string;
  visibility: string;
  persona: string;
  fire: string;
  clock: string;
  code: string;
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
