/**
 * Textures for the 2025 smart-city EV era.
 *
 * Crisp high-contrast modern materials: glass, saturated green foliage,
 * permeable pavers, and cool-white LED glow.
 */

/** A named 2025 material texture. */
export interface Texture {
  /** Id of the texture. */
  id: string;
  /** Display name. */
  name: string;
  /** Base colour (hex). */
  color: string;
  /** Texture category. */
  category: 'glass' | 'foliage' | 'paving' | 'light' | 'metal';
}

/** The 2025 texture set. */
export const textures: readonly Texture[] = Object.freeze([
  { id: 'glass-facade', name: 'Glass facade', color: '#7fd4f2', category: 'glass' },
  { id: 'green-roof', name: 'Green-roof terrace', color: '#2f9e44', category: 'foliage' },
  { id: 'solar-panel', name: 'Solar panel', color: '#1f3557', category: 'metal' },
  { id: 'permeable-paver', name: 'Permeable paver', color: '#9aa5ad', category: 'paving' },
  { id: 'cool-led', name: 'Cool-white LED', color: '#e8f4ff', category: 'light' },
  { id: 'saturated-foliage', name: 'Saturated foliage', color: '#2f9e44', category: 'foliage' },
  { id: 'led-accent', name: 'LED facade accent', color: '#39d2ff', category: 'light' },
]);