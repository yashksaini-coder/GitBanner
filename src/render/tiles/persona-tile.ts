import type { Persona, Theme } from '../../types.js';
import { iconByKey, renderIcon } from '../icons.js';
import { escapeXml, fitText } from '../util.js';

export interface PersonaTileProps {
  x: number;
  y: number;
  w: number;
  h: number;
  persona: Persona;
  theme: Theme;
}

export function renderPersonaTile(p: PersonaTileProps): string {
  const { x, y, w, h, persona, theme } = p;

  const headerIcon = renderIcon({
    path: iconByKey('trophy'),
    size: 22,
    stroke: theme.textSecondary,
    strokeWidth: 2,
  });

  const personaIllustration = renderIcon({
    path: iconByKey(persona.iconKey),
    size: 64,
    stroke: persona.accentColor,
    fill: persona.accentColor + '33',
    strokeWidth: 2.4,
  });

  const labelMaxWidth = w - 116 - 28; // tile width minus illustration column minus right padding
  const fittedLabel = fitText(persona.label, labelMaxWidth, [36, 32, 28, 24, 22], 0.6);
  const fittedTagline = fitText(persona.tagline, labelMaxWidth, [20, 18, 16], 0.55);

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="22" fill="${theme.tile}" stroke="${theme.tileBorder}" stroke-width="1.5"/>

      <g transform="translate(28, 26)">${headerIcon}</g>
      <text x="60" y="44" class="gb-text" font-size="20" fill="${theme.textSecondary}">Your coding persona</text>

      <g transform="translate(28, ${h / 2 - 20})">${personaIllustration}</g>

      <text x="116" y="${h / 2 + 18}" class="gb-display" font-size="${fittedLabel.size}" fill="${theme.textPrimary}">${escapeXml(fittedLabel.text)}</text>
      <text x="116" y="${h - 28}" class="gb-text" font-size="${fittedTagline.size}" fill="${theme.textSecondary}">${escapeXml(fittedTagline.text)}</text>
    </g>
  `;
}
