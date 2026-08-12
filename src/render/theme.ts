import type { Theme, ThemeName } from '../types.js';

export const dark: Theme = {
  bg: '#000000',
  tile: '#0a0a0a',
  tileBorder: '#1b1b1b',
  textPrimary: '#ffffff',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  divider: '#161616',
  pillBg: '#101010',
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
    // GitHub's own closed-as-completed purple (Primer done.fg, dark) — the
    // card charts resolved issues, so it borrows the platform's colour for
    // that exact state. Deliberate exception to the three-hue set above.
    issues: '#a371f7',
    languages: '#199e70',
    // Requested balance picks (2026-08-12): the pulse goes green — the same
    // bright green the activity ramp caps with, tying the two cadence cards —
    // and the Top projects mini goes red (Primer danger.fg dark, readable on
    // near-black) so the mini row reads red / blue / green.
    pulse: '#2fd08a',
    topProjects: '#f85149',
    neutral: '#8b949e',
  },
};

const themes: Record<ThemeName, Theme> = { dark };

export function getTheme(name: ThemeName): Theme {
  const theme = themes[name];
  if (!theme) throw new Error(`Unknown theme: ${name}`);
  return theme;
}
