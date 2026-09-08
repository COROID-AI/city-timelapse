/**
 * Per-era buildings & architecture systems: typed contracts.
 *
 * These types describe one era-derived building instance (its material,
 * massing, signage and detail elements) plus the merged, instanced geometry
 * buffers that a renderer consumes for performance. Nothing in this module
 * redefines era data or lot geometry — those are consumed read-only from the
 * shared era registry and city block layout.
 */

import type { Point2 } from '../layout/types.js';

/** An axis-aligned box in scene space (origin at ground, +y up). */
export interface Box {
  /** Minimum corner x (west). */
  x: number;
  /** Minimum corner y (ground level). */
  y: number;
  /** Minimum corner z (south). */
  z: number;
  /** Extent along x. */
  width: number;
  /** Extent along y (height). */
  height: number;
  /** Extent along z. */
  depth: number;
  /** Material / accent colour (hex). */
  color: string;
}

/** Material + massing identity for one building facade. */
export interface BuildingMaterial {
  /** Canonical era style id, e.g. `'art-deco'`, `'bioclimatic'`. */
  styleId: string;
  /** Historic masonry weight (0..1) — drives brick/stone vs glass/steel. */
  masonry: number;
  /** Fraction of facade area that is glazing (0..1). */
  glassRatio: number;
  /** Era facade palette (hex strings), read from the era registry. */
  palette: string[];
  /** Roof profile id: `'parapet'`, `'flat'`, `'equipment-screen'`, `'green-roof'`. */
  roofStyle: string;
}

/** Storefront / advertisement signage identity for one building. */
export interface BuildingSignage {
  /** Dominant advertising medium id, e.g. `'hand-painted-sign'`. */
  medium: string;
  /** Signage illumination intensity (0..1). */
  intensity: number;
  /** Neon (warm) vs LED (cool) share of the glow (0..1). */
  neonToLed: number;
  /** Colour poster saturation (0 muted .. 1 vivid). */
  posterSaturation: number;
  /** Awning / canopy style id, or `'none'`. */
  awning: string;
  /** Storefront neon / luminous ornament intensity (0..1). */
  neonLevel: number;
}

/** Instanced detail elements decorating a single building. */
export interface BuildingDetails {
  /** Number of window mullions / transoms on the facade. */
  mullionCount: number;
  /** Whether a cornice / parapet cap crowns the facade. */
  cornice: boolean;
  /** Whether an exterior fire escape is present. */
  fireEscape: boolean;
  /** Whether a storefront awning / canopy is present. */
  awning: boolean;
  /** Number of rooftop machinery units (AC, water towers, vents). */
  rooftopMachineryCount: number;
  /** Whether a living green wall covers part of the facade. */
  greenWall: boolean;
  /** Number of rooftop solar panels. */
  solarPanelCount: number;
  /** Whether LED accent strips light the facade. */
  ledAccent: boolean;
}

/**
 * Fully-resolved, era-derived parameters for one building instance.
 * Numeric fields are continuous so they can be smoothly interpolated during
 * era transitions; discrete fields follow the shared era registry.
 */
export interface BuildingParams {
  /** Stable instance id, derived from the owning lot. */
  id: string;
  /** Owning lot id from the city block layout. */
  lotId: string;
  /** Facade-center ground position (from the lot). */
  position: Point2;
  /** Building footprint width along the facade (m). */
  footprintWidth: number;
  /** Building footprint depth into the lot (m). */
  footprintDepth: number;
  /** Building height (m). */
  heightM: number;
  /** Facade material / massing identity. */
  material: BuildingMaterial;
  /** Primary facade colour (hex). */
  facadeColor: string;
  /** Storefront / advertisement signage identity. */
  signage: BuildingSignage;
  /** Instanced detail elements. */
  details: BuildingDetails;
}

/**
 * Merged, instanced geometry buffers for the whole building set.
 * Every box across all instances is merged into shared arrays so a renderer
 * can upload them as a few static buffers (instancing for performance) rather
 * than issuing a draw call per box.
 */
export interface MergedGeometry {
  /** One solid box per building instance. */
  buildingBoxes: Box[];
  /** Window mullions / transoms across all facades. */
  mullions: Box[];
  /** Cornice / parapet caps across all facades. */
  cornices: Box[];
  /** Fire escape ladder + platform boxes. */
  fireEscapes: Box[];
  /** Storefront awning / canopy boxes. */
  awnings: Box[];
  /** Rooftop machinery boxes (AC, water towers, vents). */
  rooftopMachinery: Box[];
  /** Green wall panels. */
  greenWalls: Box[];
  /** Rooftop solar panel boxes. */
  solarPanels: Box[];
  /** LED accent strip boxes. */
  ledAccents: Box[];
  /** Number of building instances (one per lot) merged into the buffers. */
  instanceCount: number;
  /** Total box vertex count across all merged buffers. */
  vertexCount: number;
}