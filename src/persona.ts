import type { Persona, PersonaKey, StatsPayload } from './types.js';

interface PersonaRule {
  key: PersonaKey;
  label: string;
  tagline: string;
  iconKey: string;
  accentColor: string;
  test: (s: StatsPayload) => boolean;
  score: (s: StatsPayload) => number;
}

const RULES: PersonaRule[] = [
  {
    key: 'open-source-star',
    label: 'Open Source Star',
    tagline: 'Your work is loved!',
    iconKey: 'star-burst',
    accentColor: '#facc15',
    test: (s) => s.totalStars >= 500 || s.forkCount >= 20,
    score: (s) => s.totalStars * 2 + s.forkCount * 5,
  },
  {
    key: 'polyglot',
    label: 'Polyglot',
    tagline: 'You speak many tongues.',
    iconKey: 'brackets',
    accentColor: '#3b82f6',
    test: (s) => s.languageCount >= 8,
    score: (s) => s.languageCount * 50,
  },
  {
    key: 'specialist',
    label: 'Specialist',
    tagline: 'Master of your craft.',
    iconKey: 'target',
    accentColor: '#ef4444',
    test: (s) => (s.languages[0]?.percent ?? 0) >= 60,
    score: (s) => Math.round(s.languages[0]?.percent ?? 0) * 5,
  },
  {
    key: 'veteran',
    label: 'Veteran',
    tagline: 'Years in the trenches.',
    iconKey: 'hourglass',
    accentColor: '#a855f7',
    test: (s) => s.yearsCoding >= 5,
    score: (s) => s.yearsCoding * 40,
  },
  {
    key: 'builder',
    label: 'Builder',
    tagline: "You don't stop shipping.",
    iconKey: 'hammer',
    accentColor: '#22c55e',
    test: (s) => s.totalCommits >= 2000,
    score: (s) => Math.round(s.totalCommits / 5),
  },
  {
    key: 'explorer',
    label: 'Explorer',
    tagline: 'Always trying something new.',
    iconKey: 'compass',
    accentColor: '#06b6d4',
    test: (s) => s.ownedCount >= 30 && s.avgCommitsPerRepo < 20,
    score: (s) => s.ownedCount * 10,
  },
];

const FALLBACK: Persona = {
  key: 'rising-dev',
  label: 'Rising Dev',
  tagline: 'Just getting started!',
  iconKey: 'sparkle',
  accentColor: '#60a5fa',
};

export function scorePersona(stats: StatsPayload): Persona {
  const matched = RULES.filter((r) => r.test(stats));
  if (matched.length === 0) return FALLBACK;

  let best = matched[0];
  let bestScore = best.score(stats);
  for (let i = 1; i < matched.length; i++) {
    const score = matched[i].score(stats);
    if (score > bestScore) {
      best = matched[i];
      bestScore = score;
    }
  }
  return {
    key: best.key,
    label: best.label,
    tagline: best.tagline,
    iconKey: best.iconKey,
    accentColor: best.accentColor,
  };
}
