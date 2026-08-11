import type { Theme } from '../../types.js';
import { escapeXml, r2 } from '../util.js';
import { monotonePath } from './wave.js';


export interface StreamStation {
  label: string;
  value: number;
}

export interface StreamProps {
  w: number;
  h: number;
  stations: StreamStation[];
  accent: string;
  gradId: string;
  theme: Theme;
  emptyText?: string;
}

/**
 * Symmetric stream, reference style: a glowing band mirrored around a centre
 * line whose thickness at each station is the value, crossed by hairline
 * measure lines carrying pill-shaped value labels that alternate above and
 * below the band. Monotone edges — the band cannot bulge past its stations.
 */
export function renderStream(p: StreamProps): string {
  const { w, h, stations, accent, gradId, theme } = p;
  const LABEL_BAND = 16;

  if (stations.length === 0 || stations.every((s) => s.value === 0)) {
    return `<text x="${r2(w / 2)}" y="${r2(h / 2)}" text-anchor="middle" class="gb-text" font-size="13" fill="${theme.textMuted}">${escapeXml(p.emptyText ?? 'no data yet')}</text>`;
  }

  const cy = (h - LABEL_BAND) / 2;
  const maxHalf = cy - 30; // room for the pills above and below

  // A windowed card (or an account created this year) has exactly one period.
  // One value has no flow to draw, but it is data, not an empty state: render
  // a single centred lens at full thickness with its measure line and pill.
  if (stations.length === 1) {
    const s = stations[0];
    const x = w / 2;
    const rx = Math.min(130, w * 0.24);
    const gradient = `<linearGradient id="${escapeXml(gradId)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.12"/><stop offset="0.5" stop-color="${accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${accent}" stop-opacity="0.12"/></linearGradient>`;
    const glowFilter = `<filter id="${escapeXml(gradId)}-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>`;
    const lens = `<ellipse cx="${r2(x)}" cy="${r2(cy)}" rx="${r2(rx)}" ry="${r2(maxHalf)}" fill="url(#${escapeXml(gradId)})"/>`;
    const measure = `<line x1="${r2(x)}" y1="${r2(cy - maxHalf - 16)}" x2="${r2(x)}" y2="${r2(cy + maxHalf + 16)}" stroke="${theme.divider}" stroke-width="1"/>`;
    const text = String(s.value);
    const pw = Math.max(34, text.length * 6.5 + 16);
    const py = cy - maxHalf - 28;
    const pill =
      `<rect x="${r2(x - pw / 2)}" y="${r2(py)}" width="${r2(pw)}" height="20" rx="10" fill="#0d0d10" stroke="${theme.tileBorder}" stroke-width="1"/>` +
      `<text x="${r2(x)}" y="${r2(py + 14)}" text-anchor="middle" class="gb-mono" font-size="10" fill="${theme.textPrimary}">${escapeXml(text)}</text>`;
    const label = `<text x="${r2(x)}" y="${h - 3}" text-anchor="middle" class="gb-mono" font-size="9" fill="${theme.textMuted}">${escapeXml(s.label)}</text>`;
    return (
      `<defs>${gradient}${glowFilter}</defs>` +
      `<ellipse cx="${r2(x)}" cy="${r2(cy)}" rx="${r2(rx)}" ry="${r2(maxHalf)}" fill="url(#${escapeXml(gradId)})" filter="url(#${escapeXml(gradId)}-glow)"/>` +
      lens +
      measure +
      pill +
      label
    );
  }

  const max = Math.max(...stations.map((s) => s.value));
  const X0 = 10;
  const step = (w - 2 * X0) / (stations.length - 1);

  const xs = stations.map((_, i) => X0 + i * step);
  const halves = stations.map((s) => Math.max(3, (s.value / max) * maxHalf));
  const top = xs.map((x, i) => ({ x, y: cy - halves[i] }));
  const bottom = xs.map((x, i) => ({ x, y: cy + halves[i] }));

  const topD = monotonePath(top);
  const backD = monotonePath([...bottom].reverse());
  const band = `${topD} L ${r2(bottom[bottom.length - 1].x)} ${r2(bottom[bottom.length - 1].y)} ${backD.replace(/^M [\d.-]+ [\d.-]+/, '').trim()} Z`;

  const gradient = `<linearGradient id="${escapeXml(gradId)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.12"/><stop offset="0.5" stop-color="${accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${accent}" stop-opacity="0.12"/></linearGradient>`;
  const glowFilter = `<filter id="${escapeXml(gradId)}-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>`;

  const stationsSvg = stations
    .map((s, i) => {
      const x = xs[i];
      const measure = `<line x1="${r2(x)}" y1="${r2(cy - maxHalf - 16)}" x2="${r2(x)}" y2="${r2(cy + maxHalf + 16)}" stroke="${theme.divider}" stroke-width="1"/>`;
      // Pills alternate above/below, reference style; clamp inside the zone.
      const above = i % 2 === 0;
      const text = String(s.value);
      const pw = Math.max(34, text.length * 6.5 + 16);
      const px = Math.min(Math.max(x - pw / 2, 2), w - pw - 2);
      const py = above ? cy - halves[i] - 28 : cy + halves[i] + 8;
      const pill =
        `<rect x="${r2(px)}" y="${r2(py)}" width="${r2(pw)}" height="20" rx="10" fill="#0d0d10" stroke="${theme.tileBorder}" stroke-width="1"/>` +
        `<text x="${r2(px + pw / 2)}" y="${r2(py + 14)}" text-anchor="middle" class="gb-mono" font-size="10" fill="${theme.textPrimary}">${escapeXml(text)}</text>`;
      const yearLabel = `<text x="${r2(x)}" y="${h - 3}" text-anchor="middle" class="gb-mono" font-size="9" fill="${theme.textMuted}">${escapeXml(s.label)}</text>`;
      return measure + pill + yearLabel;
    })
    .join('');

  return (
    `<defs>${gradient}${glowFilter}</defs>` +
    `<path d="${band}" fill="url(#${escapeXml(gradId)})" filter="url(#${escapeXml(gradId)}-glow)"/>` +
    `<path d="${band}" fill="url(#${escapeXml(gradId)})"/>` +
    stationsSvg
  );
}
