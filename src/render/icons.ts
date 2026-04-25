// Inline SVG paths drawn on a 24x24 viewbox, designed to look like Lucide icons.
// Each icon is rendered with stroke-width 2, stroke-linecap round, stroke-linejoin round.

export const iconPaths: Record<string, string> = {
  // Row 1
  'git-branch':
    'M6 3v12 M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9a9 9 0 0 1-9 9',
  star:
    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  'code-brackets': 'M16 18l6-6-6-6 M8 6l-6 6 6 6',
  calendar:
    'M3 8h18 M3 8v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8 M3 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2 M8 3v4 M16 3v4',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z',
  // Row 2
  'trending-up': 'M3 17l6-6 4 4 8-8 M14 7h7v7',
  zap: 'M13 2L3 14h7l-1 8 10-12h-7l1-8z',
  trophy:
    'M6 9H4a2 2 0 1 1 0-4h2 M18 9h2a2 2 0 1 0 0-4h-2 M6 5h12v6a6 6 0 1 1-12 0V5z M9 21h6 M12 15v6',
  // Row 3
  flame:
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  // Persona
  'star-burst':
    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  brackets: 'M16 18l6-6-6-6 M8 6l-6 6 6 6',
  target:
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  hourglass:
    'M5 22h14 M5 2h14 M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22 M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2',
  hammer:
    'M15 12l-8.5 8.5a2.121 2.121 0 0 1-3-3L12 9 M17.64 15L22 10.64 M20.91 11.7L19.27 8.86a4 4 0 0 0-.86-1.05l-3.36-3.05a4 4 0 0 0-1.05-.86L11.06 2.27',
  compass:
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z',
  sparkle:
    'M12 3v18 M3 12h18 M5.6 5.6l12.8 12.8 M18.4 5.6L5.6 18.4',
};

interface RenderIconOptions {
  path: string;
  size?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
}

export function renderIcon(opts: RenderIconOptions): string {
  const size = opts.size ?? 24;
  const stroke = opts.stroke ?? 'currentColor';
  const fill = opts.fill ?? 'none';
  const strokeWidth = opts.strokeWidth ?? 2;
  const segments = opts.path
    .split(/\s*M\s*/)
    .filter(Boolean)
    .map((seg) => `<path d="M${seg.trim()}" />`)
    .join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${segments}</svg>`;
}

export function iconByKey(key: string): string {
  return iconPaths[key] ?? iconPaths['sparkle'];
}
