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

/** Round to 2dp so SVG coordinates stay short and byte-stable. */
export const r2 = (v: number): number => Math.round(v * 100) / 100;

// widthRatio ≈ avg-glyph-width / font-size: 0.55 for Inter Display, ~0.6 for mono.
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
