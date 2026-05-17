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

// widthRatio ≈ avg-glyph-width / font-size: 0.55 for Inter Display, ~0.6 for mono.
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
