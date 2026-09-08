/**
 * Era-authentic signage & advertisement copy for the storefronts subsystem.
 *
 * Each era provides a deterministic catalogue of sign text, materials, and ad
 * copy. During a transition between two eras, the content interpolates by
 * selecting the `from` catalogue below the midpoint and the `to` catalogue at
 * or above it — mirroring the era-domain interpolation engine's discrete
 * endpoint rule so the whole scene transforms coherently.
 */

/** A deterministic content catalogue for one era. */
export interface EraStorefrontContent {
  /** Sign text variants. */
  signText: string[];
  /** Signage material descriptors. */
  signMaterials: string[];
  /** Signage genre ids. */
  signStyles: string[];
  /** Advertisement copy variants. */
  adCopy: string[];
}

/** All five era content catalogues, keyed by year. */
export const ERA_STOREFRONT_CONTENT: Record<number, EraStorefrontContent> = {
  1945: {
    signText: ['GROCER', 'PHARMACY', 'TAILOR', 'BAKERY', 'HARDWARE'],
    signMaterials: ['enamel-on-wood', 'painted-tin', 'gold-leaf-glass'],
    signStyles: ['painted', 'hand-lettered', 'gilded'],
    adCopy: ['Coca-Cola', 'Victory Bonds', 'War Ration Book', 'Chesterfield'],
  },
  1965: {
    signText: ['DINER', 'RECORDS', 'DEPT. STORE', 'CAFÉ', 'SHOES'],
    signMaterials: ['porcelain-enamel', 'neon-tube', 'plastic-formed'],
    signStyles: ['neon', 'channel-letter', 'pylon'],
    adCopy: ['Coca-Cola', 'Ford Mustang', 'Trans World Air', 'Pepsi'],
  },
  1985: {
    signText: ['VIDEO ARCADE', 'McDONALD\'S', 'BLOCKBUSTER', 'TOY STORE', 'RADIO SHACK'],
    signMaterials: ['fluorescent-print', 'neon-channel', 'backlit-plastic'],
    signStyles: ['neon', 'arcade-marquee', 'billboard'],
    adCopy: ['Pac-Man', 'Miami Vice', 'Atari', 'Pepsi Cola'],
  },
  2005: {
    signText: ['STARBUCKS', 'BEST BUY', 'GAP', 'VERIZON', 'BARNES & NOBLE'],
    signMaterials: ['backlit-chain-sign', 'perforated-vinyl', 'led-lightbox'],
    signStyles: ['backlit', 'chain-logo', 'lightbox'],
    adCopy: ['iPod', 'Verizon Wireless', 'The Matrix', 'Cingular'],
  },
  2025: {
    signText: ['AMAZON', 'TESLA SHOWROOM', 'APPLE', 'NETFLIX', 'NVIDIA'],
    signMaterials: ['led-screen', 'full-glass', 'digital-panel', 'oled'],
    signStyles: ['led', 'digital', 'kinetic'],
    adCopy: ['ChatGPT', 'Tesla Model 3', 'Netflix', 'Apple Vision Pro'],
  },
};

/** All eras that have curated content, in ascending order. */
export const ERA_CONTENT_YEARS: readonly number[] = Object.keys(
  ERA_STOREFRONT_CONTENT,
)
  .map(Number)
  .sort((a, b) => a - b);