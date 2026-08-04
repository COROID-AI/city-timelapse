import type { Box3, Group } from 'three';

/** Plain axis-aligned bounding box (numbers only, no THREE dependency). */
export interface CollisionBox {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface CityOptions {
  /** Seed for deterministic generation. Defaults to a fixed constant. */
  seed?: number;
  /** Number of blocks along each axis (city is blocksPerSide x blocksPerSide). Default 5. */
  blocksPerSide?: number;
  /** Side length of the block interior between roads (building area + 2 sidewalks). Default 36. */
  blockSize?: number;
  /** Width of the sidewalk ring around each block's building area. Default 4. */
  sidewalkWidth?: number;
  /** Road width between sidewalk edges. Default 14. */
  streetWidth?: number;
  /** Minimum and maximum building height. Default [6, 46]. */
  buildingHeight?: readonly [number, number];
  /** Minimum and maximum building footprint side length. Default [9, 30]. */
  buildingFootprint?: readonly [number, number];
}

/**
 * Street-grid layout constants exposed for detail placement (street props,
 * road markings and traffic). Roads run along every block boundary, so the
 * walkable sidewalks sit between each road edge and its adjacent building
 * area.
 */
export interface CityGridLayout {
  /** Number of blocks along each axis. */
  blocksPerSide: number;
  /** Distance between adjacent block boundaries (blockSize + streetWidth). */
  blockStride: number;
  /** Distance from the city center to the outermost block boundary. */
  halfCity: number;
  /** Road width between sidewalk edges. */
  streetWidth: number;
  /** Width of the sidewalk ring around each block's building area. */
  sidewalkWidth: number;
  /** World-space center line of every road strip (sorted, one per axis). */
  roadLines: readonly number[];
  /** Length of each road/sidewalk strip, including the outer ring sidewalks. */
  stripLength: number;
}

/**
 * A single street rectangle in world coordinates (top-down XZ). Mirrors the
 * road/sidewalk boxes placed by the generator, so the minimap shares the
 * exact same coordinate system as the rendered city.
 */
export interface StreetSegment {
  kind: 'road' | 'sidewalk';
  /** Center X of the segment (world units). */
  x: number;
  /** Center Z of the segment (world units). */
  z: number;
  /** Full width along X (world units). */
  width: number;
  /** Full depth along Z (world units). */
  depth: number;
}

/**
 * Top-down street grid used by the in-experience minimap. Every road and
 * sidewalk rectangle placed by city-generation is listed, so the minimap
 * shares the exact same coordinate system as the rendered city.
 */
export interface CityGrid {
  /** Every road/sidewalk rectangle placed by city-generation. */
  segments: StreetSegment[];
  /**
   * Half side of the block grid square the streets run through. The minimap
   * uses this as its viewport so buildings and the walkable area stay in
   * frame while streets beyond the block grid are clipped at the edges.
   */
  halfExtent: number;
}

export interface CityResult {
  /** The THREE.Group containing ground, streets, sidewalks and buildings. */
  group: Group;
  /** World-space building bounding boxes (THREE.Box3), one per instanced building. */
  collisionBoxes: Box3[];
  /** Plain-number building bounding boxes for collision-aware walk controls. */
  collisionData: CollisionBox[];
  /** The seed used for generation (normalized to uint32). */
  seed: number;
  /**
   * Street grid shared by the detail layer (props, markings and traffic) and
   * the in-experience minimap: layout constants plus road/sidewalk segments.
   */
  grid: CityGrid & CityGridLayout;
}
