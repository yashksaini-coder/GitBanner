// Lucide-style icons on a 24x24 viewbox, stroke-width 2, round caps/joins.
export const iconPaths: Record<string, string> = {
  'git-pull-request':
    'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 9v6 M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M13 6h2a3 3 0 0 1 3 3v6',
  'message-square':
    'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M8 9h8 M8 13h5',
  package:
    'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12',
  star:
    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  'circle-dot':
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'check-circle': 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3',
  'code-brackets': 'M16 18l6-6-6-6 M8 6l-6 6 6 6',
  'trending-up': 'M3 17l6-6 4 4 8-8 M14 7h7v7',
  trophy:
    'M6 9H4a2 2 0 1 1 0-4h2 M18 9h2a2 2 0 1 0 0-4h-2 M6 5h12v6a6 6 0 1 1-12 0V5z M9 21h6 M12 15v6',
  calendar:
    'M3 8h18 M3 8v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8 M3 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2 M8 3v4 M16 3v4',
  // Fallback for an unknown key.
  sparkle: 'M12 3v18 M3 12h18 M5.6 5.6l12.8 12.8 M18.4 5.6L5.6 18.4',
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
