/**
 * Data model for the storefronts & advertisements scene subsystem.
 *
 * This module is entirely derived from two read-only shared sources:
 *  - the era registry (`src/scenes/eras/`) for era-authentic design values,
 *  - the city block layout (`src/scenes/layout/`) for storefront spans.
 *
 * The scene never mutates those sources; it only reads them to compute a
 * deterministic per-frame `StorefrontsState`.
 */

/** A single piece of storefront signage attached to a layout storefront span. */
export interface Signage {
  id: string;
  /** Id of the layout storefront span this sign belongs to. */
  storefrontId: string;
  /** The sign text (era-authentic, interpolated across transitions). */
  text: string;
  /** Signage genre id, e.g. `'painted'`, `'neon-channel'`, `'led-screen'`. */
  style: string;
  /** Physical material of the sign, e.g. `'enamel-on-wood'`, `'digital-panel'`. */
  material: string;
  /** Illumination level (0..1), interpolated between eras. */
  lighting: number;
  /** Representative sign colour (hex). */
  color: string;
}

/** An advertisement placed along a storefront span (or its billboard). */
export interface Advertisement {
  id: string;
  /** Id of the layout storefront span this ad is anchored to. */
  storefrontId: string;
  /** Dominant advertising medium for the era, e.g. `'neon-sign'`. */
  medium: string;
  /** The ad copy (era-authentic, interpolated across transitions). */
  content: string;
  /** Illumination intensity (0..1), interpolated between eras. */
  intensity: number;
  /** Representative panel colour (hex). */
  color: string;
  /** True when the panel is screen-based / animated for the era. */
  animated: boolean;
}

/** Per-storefront facade dressing (canopy / window display / lighting). */
export interface StorefrontDressing {
  /** Id of the layout storefront span. */
  storefrontId: string;
  /** Id of the owning lot. */
  lotId: string;
  /** Awning / canopy style id, or `'none'`. */
  awning: string;
  /** Door closure design id. */
  doorClosure: string;
  /** Plate-glass proportion of the facade (0..1). */
  glassFront: number;
  /** Window-dressing / merchandise display richness (0..1). */
  windowDressing: number;
  /** Number of mannequins placed in the window (0..4). */
  mannequins: number;
  /** True when the facade carries a canopy/awning. */
  canopy: boolean;
  /** Signage lighting level (0..1). */
  lighting: number;
}

/** The complete computed state of the storefronts subsystem for one frame. */
export interface StorefrontsState {
  /** The (possibly interpolated) timeline year. */
  year: number;
  /** Storefront genre id from the era dataset. */
  eraStyleId: string;
  /** One dressing per layout storefront span. */
  storefronts: StorefrontDressing[];
  /** One sign per layout storefront span. */
  signage: Signage[];
  /** As many advertisements as the era prescribes. */
  advertisements: Advertisement[];
}

/** Lifecycle of a mounted storefronts scene instance. */
export interface StorefrontsScene {
  /** The latest computed state (available immediately after construction). */
  readonly state: StorefrontsState;
  /** Mount the scene. Must be called before `update`. */
  attach(): void;
  /**
   * Advance the scene to the given era year (and optional transition
   * progress `t` in [0,1] toward the next era). Returns the new state.
   */
  update(year: number, t?: number): StorefrontsState;
  /** Tear the scene down. No further calls are valid afterwards. */
  dispose(): void;
}

/** The exported component factory exposing the `Storefronts` lifecycle. */
export interface StorefrontsComponent {
  instantiate(): StorefrontsScene;
}