export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&apos;';
    }
  });
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

// Pick the largest font size in `sizes` whose rendered width fits `maxWidth`.
// Width estimate uses a per-character ratio appropriate for display weights.
// `widthRatio` is roughly `avg-glyph-width / font-size` — 0.55 works well for
// the Inter Display weights we use; raise to ~0.6 for monospace.
export function fitFontSize(
  text: string,
  maxWidth: number,
  sizes: number[],
  widthRatio = 0.55,
): number {
  for (const size of sizes) {
    if (text.length * size * widthRatio <= maxWidth) return size;
  }
  return sizes[sizes.length - 1];
}

// Pick the largest font size that fits — and if even the smallest size
// overflows, truncate the text with an ellipsis so the label stays inside
// `maxWidth`.
export function fitText(
  text: string,
  maxWidth: number,
  sizes: number[],
  widthRatio = 0.55,
): { text: string; size: number } {
  for (const size of sizes) {
    if (text.length * size * widthRatio <= maxWidth) return { text, size };
  }
  const smallest = sizes[sizes.length - 1];
  const maxChars = Math.max(1, Math.floor(maxWidth / (smallest * widthRatio)) - 1);
  if (text.length <= maxChars) return { text, size: smallest };
  return { text: text.slice(0, maxChars) + '…', size: smallest };
}
