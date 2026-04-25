import type { Theme, ThemeName } from '../types.js';

export const dark: Theme = {
  bg: '#0b0d12',
  tile: '#11161f',
  tileBorder: '#1c2230',
  textPrimary: '#ffffff',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  divider: '#1f2937',
  pillBg: '#172033',
  pillText: '#93c5fd',
  accents: {
    commits: '#22c55e',
    stars: '#facc15',
    languages: '#3b82f6',
    lifespan: '#a855f7',
    visibility: '#60a5fa',
    persona: '#fbbf24',
    fire: '#fb923c',
    clock: '#06b6d4',
    code: '#ef4444',
  },
};

const themes: Record<ThemeName, Theme> = { dark };

export function getTheme(name: ThemeName): Theme {
  const theme = themes[name];
  if (!theme) throw new Error(`Unknown theme: ${name}`);
  return theme;
}
