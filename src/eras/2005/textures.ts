
export type EraTexture =
  | 'glass'
  | 'stone'
  | 'aluminum'
  | 'stucco'
  | 'brick'
  | 'hoarding';

export interface EraTextureSpec {
  readonly name: EraTexture;

  readonly label: string;
  readonly roughness: number;
  readonly metalness: number;
}

export const ERA_2005_TEXTURES: readonly EraTextureSpec[] = [
  { name: 'glass', label: 'Glass-and-stone facade pane', roughness: 0.1, metalness:  0.2 },
  { name: 'stone', label: 'Stone cladding', roughness:  0.6, metalness:  0.0 },
  { name: 'aluminum', label: 'Aluminum-and-glass storefront system', roughness:  0.35, metalness:  0.7 },
  { name: 'stucco', label: 'Stucco over brick walk-up', roughness:  0.85, metalness:  0.0 },
  { name: 'brick', label: 'Brick walk-up base', roughness:  0.8, metalness:  0.0 },
  { name: 'hoarding', label: 'Construction hoarding', roughness:  0.7, metalness:  0.1 },
];
