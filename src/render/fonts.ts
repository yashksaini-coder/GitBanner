export const FONT_STACK_DISPLAY =
  '"Inter Display", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const FONT_STACK_TEXT =
  '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const FONT_STACK_MONO =
  '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export function fontStyleBlock(): string {
  // The hero and tile values use the same sans as body text — a display or
  // serif face on a headline figure reads as off-brand decoration.
  return `
    .gb-display { font-family: ${FONT_STACK_TEXT}; font-weight: 700; letter-spacing: -0.02em; }
    .gb-text { font-family: ${FONT_STACK_TEXT}; font-weight: 500; }
    .gb-text-bold { font-family: ${FONT_STACK_TEXT}; font-weight: 700; }
    .gb-mono { font-family: ${FONT_STACK_MONO}; font-weight: 600; }
  `.trim();
}
