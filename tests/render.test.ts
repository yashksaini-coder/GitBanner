import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregate } from '../src/compute.js';
import { toSvg } from '../src/render/svg.js';
import { escapeXml } from '../src/render/tiles/stat-tile.js';
import type { RawData } from '../src/types.js';

const raw = JSON.parse(
  readFileSync(new URL('./fixtures/raw.json', import.meta.url), 'utf8'),
) as RawData;

describe('toSvg', () => {
  const stats = aggregate(raw);
  const svg = toSvg(stats, 'dark');

  it('produces a valid root <svg> with width/height', () => {
    expect(svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(svg).toMatch(/<svg [^>]*width="1600"[^>]*height="900"/);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it('renders all five row 1 metric values', () => {
    expect(svg).toContain(stats.totalContributions.toLocaleString('en-US'));
    expect(svg).toContain('Total Contributions');
    expect(svg).toContain(stats.totalStars.toLocaleString('en-US'));
    expect(svg).toContain(`${stats.languageCount}`);
    expect(svg).toContain(`${stats.avgLifespanDays.toLocaleString('en-US')} days`);
    expect(svg).toContain(`${stats.publicCount} | ${stats.privateCount}`);
  });

  it('renders project names from row 2', () => {
    expect(svg).toContain(stats.oldestProject.name);
    expect(svg).toContain(stats.latestProject.name);
    expect(svg).toContain(stats.mostActiveProject.name);
  });

  it('renders the persona', () => {
    expect(svg).toContain(stats.persona.label);
    expect(svg).toContain(escapeXml(stats.persona.tagline));
  });

  it('renders the row 3 highlights', () => {
    expect(svg).toContain(`${stats.yearsCoding} years`);
    expect(svg).toContain('avg commits per repo');
    expect(svg).toContain(stats.goToLanguage.name);
    expect(svg).toContain('forks received');
  });

  it('embeds the username, followers, following, and best year in the footer', () => {
    expect(svg).toContain(`aria-label="GitHub stats for ${stats.username}`);
    expect(svg).toContain(`github.com/${stats.username}`);
    expect(svg).toContain(`${stats.followers.toLocaleString('en-US')} followers`);
    expect(svg).toContain(`${stats.following.toLocaleString('en-US')} following`);
    expect(svg).toContain(`best year: ${stats.bestYear.year}`);
  });

  it('appends a UTC timestamp to the footer', () => {
    expect(svg).toMatch(/updated \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/);
  });
});
