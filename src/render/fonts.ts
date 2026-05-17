export const FONT_STACK_DISPLAY =
  '"Inter Display", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const FONT_STACK_TEXT =
  '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const FONT_STACK_MONO =
  '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export function fontStyleBlock(): string {
  return `
    .gb-display { font-family: ${FONT_STACK_DISPLAY}; font-weight: 800; letter-spacing: -0.02em; }
    .gb-text { font-family: ${FONT_STACK_TEXT}; font-weight: 500; }
    .gb-text-bold { font-family: ${FONT_STACK_TEXT}; font-weight: 700; }
    .gb-mono { font-family: ${FONT_STACK_MONO}; font-weight: 600; }
  `.trim();
}
