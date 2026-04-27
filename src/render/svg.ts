import type { StatsPayload, Theme, ThemeName } from '../types.js';
import { fontStyleBlock } from './fonts.js';
import { getTheme } from './theme.js';
import { renderHighlightTile } from './tiles/highlight-tile.js';
import { renderLanguagesTile } from './tiles/languages-tile.js';
import { renderPersonaTile } from './tiles/persona-tile.js';
import { renderProjectTile } from './tiles/project-tile.js';
import { renderStatTile } from './tiles/stat-tile.js';
import { escapeXml } from './util.js';

const CANVAS_W = 1600;
const CANVAS_H = 900;
const MARGIN = 28;
const GAP = 16;

const ROW1_Y = 28;
const ROW1_H = 460;
const ROW2_Y = ROW1_Y + ROW1_H + GAP; // 504
const ROW2_H = 180;
const ROW3_Y = ROW2_Y + ROW2_H + GAP; // 700
const ROW3_H = 172;

function gridX(col: number, cols: number): { x: number; w: number } {
  const inner = CANVAS_W - 2 * MARGIN;
  const totalGap = GAP * (cols - 1);
  const tileW = Math.floor((inner - totalGap) / cols);
  const x = MARGIN + col * (tileW + GAP);
  return { x, w: tileW };
}

export function toSvg(payload: StatsPayload, themeName: ThemeName = 'dark'): string {
  const theme = getTheme(themeName);

  const row1 = [
    statCommitsTile(payload, theme, 0, 5),
    statStarsTile(payload, theme, 1, 5),
    languagesTileEl(payload, theme, 2, 5),
    statLifespanTile(payload, theme, 3, 5),
    statVisibilityTile(payload, theme, 4, 5),
  ].join('');

  const row2 = [
    oldestProjectTile(payload, theme, 0, 4),
    mostActiveProjectTile(payload, theme, 1, 4),
    latestProjectTile(payload, theme, 2, 4),
    personaTileEl(payload, theme, 3, 4),
  ].join('');

  const row3 = [
    yearsTile(payload, theme, 0, 4),
    avgCommitsTile(payload, theme, 1, 4),
    forksReceivedTile(payload, theme, 2, 4),
    goToLanguageTile(payload, theme, 3, 4),
  ].join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" role="img" aria-label="GitHub stats for ${escapeXml(payload.username)}">
  <defs>
    <style>${fontStyleBlock()}</style>
  </defs>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" rx="36" fill="${theme.bg}"/>
  ${row1}
  ${row2}
  ${row3}
  <text x="${CANVAS_W / 2}" y="${CANVAS_H - 10}" text-anchor="middle" class="gb-text" font-size="14" fill="${theme.textMuted}">gitbanner · github.com/${escapeXml(payload.username)} · ${formatNumber(payload.followers)} followers · ${formatNumber(payload.following)} following · best year: ${payload.bestYear.year} (${formatNumber(payload.bestYear.commits)} commits)</text>
</svg>`;
}

// ---- Row 1 tile builders ----

function statCommitsTile(p: StatsPayload, theme: Theme, col: number, cols: number) {
  const { x, w } = gridX(col, cols);
  return renderStatTile({
    x,
    y: ROW1_Y,
    w,
    h: ROW1_H,
    iconKey: 'git-branch',
    iconBgColor: theme.accents.commits,
    iconStroke: theme.accents.commits,
    cornerIconKey: 'moon',
    cornerIconColor: theme.textMuted,
    value: formatNumber(p.totalCommits),
    label: 'Total Commits',
    rows: p.topReposByCommits.map((r) => ({
      label: trunc(r.name, 18),
      value: formatNumber(r.value),
      color: theme.accents.commits,
    })),
    rowValueColor: theme.accents.commits,
    theme,
  });
}

function statStarsTile(p: StatsPayload, theme: Theme, col: number, cols: number) {
  const { x, w } = gridX(col, cols);
  return renderStatTile({
    x,
    y: ROW1_Y,
    w,
    h: ROW1_H,
    iconKey: 'star',
    iconBgColor: theme.accents.stars,
    iconStroke: theme.accents.stars,
    value: formatNumber(p.totalStars),
    label: 'Total Stars',
    rows: p.topReposByStars.map((r) => ({
      label: trunc(r.name, 18),
      value: `★ ${formatNumber(r.value)}`,
      color: theme.accents.stars,
    })),
    rowValueColor: theme.accents.stars,
    theme,
  });
}

function languagesTileEl(p: StatsPayload, theme: Theme, col: number, cols: number) {
  const { x, w } = gridX(col, cols);
  const visible = p.languages.slice(0, 8);
  const overflow = Math.max(0, p.languageCount - visible.length);
  return renderLanguagesTile({
    x,
    y: ROW1_Y,
    w,
    h: ROW1_H,
    iconKey: 'code-brackets',
    iconBgColor: theme.accents.languages,
    iconStroke: theme.accents.languages,
    count: p.languageCount,
    label: 'Languages Used',
    languages: visible.map((l) => ({ name: l.name, color: l.color })),
    overflow,
    theme,
  });
}

function statLifespanTile(p: StatsPayload, theme: Theme, col: number, cols: number) {
  const { x, w } = gridX(col, cols);
  return renderStatTile({
    x,
    y: ROW1_Y,
    w,
    h: ROW1_H,
    iconKey: 'calendar',
    iconBgColor: theme.accents.lifespan,
    iconStroke: theme.accents.lifespan,
    value: `${formatNumber(p.avgLifespanDays)} days`,
    label: 'Avg Lifespan',
    rows: p.topReposByLifespan.map((r) => ({
      label: trunc(r.name, 18),
      value: `${formatNumber(r.value)}d`,
      color: theme.accents.lifespan,
    })),
    rowValueColor: theme.accents.lifespan,
    theme,
  });
}

function statVisibilityTile(p: StatsPayload, theme: Theme, col: number, cols: number) {
  const { x, w } = gridX(col, cols);
  return renderStatTile({
    x,
    y: ROW1_Y,
    w,
    h: ROW1_H,
    iconKey: 'moon',
    iconBgColor: theme.accents.visibility,
    iconStroke: theme.accents.visibility,
    value: `${p.publicCount} | ${p.privateCount}`,
    label: 'Public | Private',
    rows: [
      {
        label: 'Owned',
        value: formatNumber(p.ownedCount),
        color: theme.accents.visibility,
      },
      {
        label: 'Forks of others',
        value: formatNumber(p.forkedRepoCount),
        color: theme.textSecondary,
      },
      {
        label: 'Forks received',
        value: formatNumber(p.incomingForks),
        color: theme.accents.stars,
      },
    ],
    rowValueColor: theme.textSecondary,
    theme,
  });
}

// ---- Row 2 tile builders ----

function oldestProjectTile(p: StatsPayload, theme: Theme, col: number, cols: number) {
  const { x, w } = gridX(col, cols);
  return renderProjectTile({
    x,
    y: ROW2_Y,
    w,
    h: ROW2_H,
    iconKey: 'calendar',
    iconColor: theme.textSecondary,
    label: 'Your oldest project',
    projectName: p.oldestProject.name,
    subLine: `Started ${formatShortDate(p.oldestProject.date)}`,
    theme,
  });
}

function mostActiveProjectTile(p: StatsPayload, theme: Theme, col: number, cols: number) {
  const { x, w } = gridX(col, cols);
  return renderProjectTile({
    x,
    y: ROW2_Y,
    w,
    h: ROW2_H,
    iconKey: 'trending-up',
    iconColor: theme.textSecondary,
    label: 'Most active project',
    projectName: p.mostActiveProject.name,
    subLine: `${formatNumber(p.mostActiveProject.commits)} commits`,
    theme,
  });
}

function latestProjectTile(p: StatsPayload, theme: Theme, col: number, cols: number) {
  const { x, w } = gridX(col, cols);
  return renderProjectTile({
    x,
    y: ROW2_Y,
    w,
    h: ROW2_H,
    iconKey: 'zap',
    iconColor: theme.textSecondary,
    label: 'Latest project',
    projectName: p.latestProject.name,
    subLine: `Started ${formatShortDate(p.latestProject.date)}`,
    theme,
  });
}

function personaTileEl(p: StatsPayload, theme: Theme, col: number, cols: number) {
  const { x, w } = gridX(col, cols);
  return renderPersonaTile({
    x,
    y: ROW2_Y,
    w,
    h: ROW2_H,
    persona: p.persona,
    theme,
  });
}

// ---- Row 3 tile builders ----

function yearsTile(p: StatsPayload, theme: Theme, col: number, cols: number) {
  const { x, w } = gridX(col, cols);
  return renderHighlightTile({
    x,
    y: ROW3_Y,
    w,
    h: ROW3_H,
    iconKey: 'flame',
    iconBgColor: theme.accents.fire,
    iconStroke: theme.accents.fire,
    value: `${p.yearsCoding} years`,
    subLine: 'of coding history',
    theme,
  });
}

function avgCommitsTile(p: StatsPayload, theme: Theme, col: number, cols: number) {
  const { x, w } = gridX(col, cols);
  return renderHighlightTile({
    x,
    y: ROW3_Y,
    w,
    h: ROW3_H,
    iconKey: 'clock',
    iconBgColor: theme.accents.clock,
    iconStroke: theme.accents.clock,
    value: formatNumber(p.avgCommitsPerRepo),
    subLine: 'avg commits per repo',
    theme,
  });
}

function forksReceivedTile(p: StatsPayload, theme: Theme, col: number, cols: number) {
  const { x, w } = gridX(col, cols);
  return renderHighlightTile({
    x,
    y: ROW3_Y,
    w,
    h: ROW3_H,
    iconKey: 'fork',
    iconBgColor: theme.accents.stars,
    iconStroke: theme.accents.stars,
    value: formatNumber(p.incomingForks),
    subLine: 'forks received',
    theme,
  });
}

function goToLanguageTile(p: StatsPayload, theme: Theme, col: number, cols: number) {
  const { x, w } = gridX(col, cols);
  return renderHighlightTile({
    x,
    y: ROW3_Y,
    w,
    h: ROW3_H,
    iconKey: 'code-brackets',
    iconBgColor: theme.accents.code,
    iconStroke: theme.accents.code,
    value: p.goToLanguage.name,
    subLine: `your go-to language (${formatNumber(p.goToLanguage.reposUsing)} repos)`,
    theme,
  });
}

// ---- Helpers ----

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const yr = d.getUTCFullYear();
  return `${m}/${day}/${yr}`;
}

function trunc(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
