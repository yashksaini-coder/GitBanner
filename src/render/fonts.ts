import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FONTS } from './font-data.js';

export const FONT_STACK_DISPLAY = '"VT323", ui-monospace, Menlo, Consolas, monospace';

export const FONT_STACK_TEXT = '"Silkscreen", ui-sans-serif, system-ui, sans-serif';

export const FONT_STACK_MONO = '"VT323", ui-monospace, Menlo, Consolas, monospace';

export function fontStyleBlock(): string {
  const faces = FONTS.map(
    (f) => `
    @font-face {
      font-family: "${f.family}";
      font-weight: ${f.weight};
      font-style: normal;
      src: url(data:font/woff2;base64,${f.woff2}) format('woff2');
    }`,
  ).join('');
  // Digit honesty decides the split: Pixelify's 2/5/0 blur together below
  // ~24px, so every class that can carry a number runs in VT323 (whose
  // terminal digits stay unambiguous at any size on this canvas) and
  // Pixelify 700 is reserved for the pure-word card titles.
  return `${faces}
    .gb-display { font-family: ${FONT_STACK_MONO}; font-weight: 400; }
    .gb-text { font-family: ${FONT_STACK_MONO}; font-weight: 400; }
    .gb-text-bold { font-family: ${FONT_STACK_TEXT}; font-weight: 700; }
    .gb-mono { font-family: ${FONT_STACK_MONO}; font-weight: 400; }
  `.trim();
}

/**
 * Resvg `font` options that make PNG rendering deterministic: system fonts
 * are ignored and the embedded subset faces are used instead.
 *
 * The installed @resvg/resvg-js (2.6.x) has no `fontBuffers` option, so the
 * ttf subsets are written to the OS temp dir once per process and passed as
 * `fontFiles` paths.
 */
export function resvgFontOptions(): {
  loadSystemFonts: false;
  fontFiles: string[];
  defaultFontFamily: string;
} {
  return {
    loadSystemFonts: false,
    fontFiles: materializeFonts(),
    defaultFontFamily: 'VT323',
  };
}

let fontFiles: string[] | undefined;

function materializeFonts(): string[] {
  if (!fontFiles) {
    fontFiles = FONTS.map((f) => {
      const path = join(tmpdir(), `gitbanner-${f.family.replace(/\s+/g, '')}-${f.weight}.ttf`);
      writeFileSync(path, Buffer.from(f.ttf, 'base64'));
      return path;
    });
  }
  return fontFiles;
}
