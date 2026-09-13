import type { EraId, EraPalette } from './types';

/**
 * Curated per-era palette tokens.
 *
 * Every token is a hypothesis about an era's dominant visual character:
 * warm wartime 1945, pastel mid-century 1965, smoggy neon 1985, clean glass
 * 2005 and green-glass EV-era 2025. All color values are unique (pairwise
 * distinct, both within and across eras) and use lowercase `#rrggbb`.
 * Qualitative period character is confirmed visually in the final phase;
 * the palette tests lock the format and distinctness guarantees.
 */
export const ERA_PALETTES: Record<EraId, EraPalette> = {
  // Warm wartime 1945: dusty muted sky, worn asphalt, brick and sandstone
  // facades, tungsten marquee glow.
  1945: {
    sky: '#c9b9a4',
    fog: '#d8cdbd',
    sun: { color: '#f6e3b8', intensity: 0.75 },
    asphalt: '#4c4540',
    sidewalk: '#b0a493',
    facadeMaterials: ['#8c5a3b', '#7d6a55', '#a88660'],
    accent: '#b03a2e',
    signageGlow: '#f2a03c',
  },
  // Pastel mid-century 1965: mint-and-cream optimism, teal accents, pink neon.
  1965: {
    sky: '#a8d8e8',
    fog: '#e8ece9',
    sun: { color: '#fff3c4', intensity: 1.0 },
    asphalt: '#4e4e52',
    sidewalk: '#d9d3c9',
    facadeMaterials: ['#f2c9d0', '#b8e0d2', '#f5e6c8'],
    accent: '#1fa3a3',
    signageGlow: '#ff6f91',
  },
  // Smoggy neon 1985: amber haze, concrete gray, magenta/cyan neon.
  1985: {
    sky: '#d9a06b',
    fog: '#c9a075',
    sun: { color: '#ffd27d', intensity: 1.15 },
    asphalt: '#3f3f44',
    sidewalk: '#a8a29a',
    facadeMaterials: ['#9aa0a6', '#7f7f87', '#c2b9a8'],
    accent: '#ff2bd6',
    signageGlow: '#00e5ff',
  },
  // Clean glass 2005: crisp commercial blue, cool steel and white panels.
  2005: {
    sky: '#5fb6e8',
    fog: '#eef3f6',
    sun: { color: '#fffbe6', intensity: 1.3 },
    asphalt: '#3a3d42',
    sidewalk: '#c9cdd4',
    facadeMaterials: ['#b9c4cc', '#e6eef2', '#8fa3ad'],
    accent: '#1f6feb',
    signageGlow: '#bfe3ff',
  },
  // Green-glass EV era 2025: verdant glass, eco-green and white-LED glow.
  2025: {
    sky: '#9fd8c8',
    fog: '#e5f1ec',
    sun: { color: '#fff1c9', intensity: 1.4 },
    asphalt: '#33363a',
    sidewalk: '#b5c4bd',
    facadeMaterials: ['#7fbf9c', '#4f9f7f', '#d8e8df'],
    accent: '#2ee6a8',
    signageGlow: '#9dffd0',
  },
};