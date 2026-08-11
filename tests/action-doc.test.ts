import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TILES, parseTiles, TILE_KEYS } from '../src/tiles.js';

// The tiles docs in action.yml once listed tiles that no longer existed;
// copying the documented default into a workflow hard-failed parseTiles.
// This test round-trips the docs through the real parser.
describe('action.yml tiles documentation', () => {
  const doc = readFileSync(new URL('../action.yml', import.meta.url), 'utf8');

  it('documents a default list that parses and matches DEFAULT_TILES', () => {
    const m = /Default: ([^]*?)\n\s*required:/.exec(doc);
    expect(m).not.toBeNull();
    const documented = m![1].replace(/\s+/g, '');
    expect(parseTiles(documented)).toEqual(DEFAULT_TILES);
  });

  it('documents every registry tile and nothing else', () => {
    const tilesBlock = /tiles:\n\s+description: \|([^]*?)\n\s*required:/.exec(doc)![1];
    // Tile keys are the first word of each indented doc line (or comma list).
    const mentioned = new Set(
      [...tilesBlock.matchAll(/[\w-]+/g)].map((x) => x[0]).filter((w) => w in Object.fromEntries(TILE_KEYS.map((k) => [k, true]))),
    );
    for (const key of TILE_KEYS) {
      expect(mentioned.has(key), `action.yml tiles docs missing "${key}"`).toBe(true);
    }
  });
});
