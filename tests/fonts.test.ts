import { describe, expect, it } from 'vitest';
import { fontStyleBlock } from '../src/render/fonts.js';

describe('fontStyleBlock', () => {
  it('embeds the subset fonts as @font-face data URIs', () => {
    const css = fontStyleBlock();
    expect(css).toContain('@font-face');
    expect(css).toContain('data:font/woff2;base64,');
  });
});
