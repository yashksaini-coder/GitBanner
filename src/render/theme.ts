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
  // Three hues, in this order, on surface #11161f. Validated all-pairs by
  // dataviz/scripts/validate_palette.js: lightness band, chroma floor, CVD
  // separation (worst ΔE 9.4 deutan), normal-vision floor (20.9), contrast.
  // The ORDER is the CVD-safety mechanism — re-ordering or adding a fourth hue
  // fails the gates, so extra tiles take `neutral` rather than a new colour.
  accents: {
    prs: '#3987e5', // slot 1 — the hero
    reviews: '#d95926', // slot 2
    projects: '#199e70', // slot 3
    reach: '#199e70', // same footprint story as projects
    issues: '#8b949e',
    languages: '#199e70',
    neutral: '#8b949e',
  },
};

const themes: Record<ThemeName, Theme> = { dark };

export function getTheme(name: ThemeName): Theme {
  const theme = themes[name];
  if (!theme) throw new Error(`Unknown theme: ${name}`);
  return theme;
}
