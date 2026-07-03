/**
 * City block layout generator for the City Time Period Timelapse.
 *
 * Composes the phase 1 procedural asset builders into a single, cohesive 3D
 * city block. The block is a two-sided street grid: a central two-lane road
 * running north–south, flanked by raised sidewalks, with building plots
 * lining both sides. Each plot receives era-correct buildings (with
 * storefronts and advertisements attached), street furniture, and lamp posts.
 *
 * The block is designed for **in-place era transitions**: rather than tearing
 * the entire scene down on every slider change, `switchEra()` reuses the
 * existing lot/sidewalk/lane geometry and only swaps the era-dependent
 * meshes (buildings, ads, lamp posts, street surface). This keeps frame
 * hitches minimal and GPU memory bounded because the asset builders cache
 * every era's meshes — revisiting an era is instant.
 *
 * Layout contract for downstream systems:
 * - {@link BlockLayout} exposes the block footprint, sidewalk paths, and
 *   traffic lanes so `trafficSystem.ts` and the pedestrian system can query
 *   spawn points and routes without hard-coding coordinates.
 */

import * as THREE from 'three';
import type { EraSpec } from './eras/types.js';
import { getEraAssets, populateBuildings } from './assetBuilder/eras.js';
import type { BuildingLot } from './assetBuilder/buildings.js';
import { STREET_LAYOUT } from './assetBuilder/streets.js';
import {
  createRng,
  eraSeed,
  disposeObject3D,
  stdMaterial,
  boxMesh,
} from './assetBuilder/util.js';
import { getBillboardTexture } from './assetBuilder/textures.js';

// ---------------------------------------------------------------------------
// Layout constants (in metres)
// ---------------------------------------------------------------------------

/**
 * Total length of the block along the road axis (Z).
 * Mirrors {@link STREET_LAYOUT.roadLength} so buildings line up with the road.
 */
const BLOCK_LENGTH = STREET_LAYOUT.roadLength; // 60

/** Width of the central two-lane road (X). */
const ROAD_WIDTH = STREET_LAYOUT.roadWidth; // 8

/** Width of each raised sidewalk band (X). */
const SIDEWALK_WIDTH = STREET_LAYOUT.sidewalkWidth; // 3.5

/** Setback of building plots from the outer sidewalk edge (X). */
const PLOT_SETBACK = 0.5;

/** Spacing gap between adjacent building plots along the road (Z). */
const PLOT_GAP = 2.0;

/** Width of a single building plot along the road (Z). */
const PLOT_DEPTH = 10;

/** Lateral depth of a building plot, away from the road (X). */
const PLOT_WIDTH = 12;

/** Half the road width — the inner edge of each sidewalk. */
const ROAD_HALF = ROAD_WIDTH / 2;

/** Outer edge of the sidewalk band (X, positive side). */
const SIDEWALK_OUTER = ROAD_HALF + SIDEWALK_WIDTH;

/** Inner edge of the building plots (X, positive side). */
const PLOT_INNER = SIDEWALK_OUTER + PLOT_SETBACK;

/** Number of building plots per side of the road. */
const PLOTS_PER_SIDE = Math.floor((BLOCK_LENGTH + PLOT_GAP) / (PLOT_DEPTH + PLOT_GAP));

// ---------------------------------------------------------------------------
// Layout types
// ---------------------------------------------------------------------------

/**
 * Describes a traffic lane for the vehicle system.
 * Lanes run parallel to the Z axis.
 */
export interface TrafficLane {
  /** Unique identifier within the block. */
  id: string;
  /** Direction of travel: +1 = northbound (+Z), -1 = southbound (-Z). */
  direction: 1 | -1;
  /** X offset of the lane centre from the road centre. */
  centerX: number;
  /** Z coordinate where vehicles spawn (back of the lane). */
  spawnZ: number;
  /** Z coordinate where vehicles despawn (far end of the lane). */
  endZ: number;
  /** Drivable surface Y (top of road). */
  surfaceY: number;
}

/**
 * Describes a sidewalk path for the pedestrian system.
 * Each path runs along one side of the road.
 */
export interface SidewalkPath {
  /** Which side of the road ('east' = +X, 'west' = -X). */
  side: 'east' | 'west';
  /** X offset of the walkable centre. */
  centerX: number;
  /** Width of the walkable band. */
  width: number;
  /** Z coordinate where pedestrians spawn (south end). */
  spawnZ: number;
  /** Z coordinate where pedestrians despawn (north end). */
  endZ: number;
  /** Walkable surface Y. */
  surfaceY: number;
}

/**
 * Immutable description of the block's spatial layout.
 *
 * Downstream systems (traffic, pedestrians, camera) read this to locate lanes,
 * sidewalks, and the block bounds without depending on the mesh tree.
 */
export interface BlockLayout {
  /** Total block footprint: `[widthX, lengthZ]` in metres. */
  readonly footprint: readonly [number, number];
  /** Centre of the block in world space. */
  readonly center: readonly [number, number];
  /** All traffic lanes on the block. */
  readonly lanes: readonly TrafficLane[];
  /** All sidewalk paths on the block. */
  readonly sidewalks: readonly SidewalkPath[];
  /** Building lots indexed by plot index. */
  readonly lots: readonly BuildingLot[];
  /** Road surface Y (top of asphalt). */
  readonly roadSurfaceY: number;
  /** Sidewalk surface Y (top of sidewalk slab). */
  readonly sidewalkSurfaceY: number;
}

// ---------------------------------------------------------------------------
// Layer container — holds the era-specific meshes so they can be swapped
// ---------------------------------------------------------------------------

/**
 * Groups of era-dependent meshes held as children of the block root.
 * Keeping them in named layers makes `switchEra` a cheap container swap.
 */
interface EraLayers {
  /** Street furniture (road, sidewalks, lamp posts) — cached per era. */
  streets: THREE.Group;
  /** Building groups (with storefronts) — one per lot. */
  buildings: THREE.Group;
  /** Advertisement meshes placed on building façades. */
  ads: THREE.Group;
}

// ---------------------------------------------------------------------------
// CityBlock class
// ---------------------------------------------------------------------------

/**
 * The city block.
 *
 * Owns a persistent root `THREE.Group` whose structure (ground plane, plot
 * markers, lane geometry) is built once. Era-dependent content lives in
 * {@link EraLayers} children that are replaced (not rebuilt from scratch) on
 * every `switchEra` call.
 */
export class CityBlock {
  /** Root group added to the scene. */
  readonly root: THREE.Group;

  /** The currently active era spec. */
  private activeEra: EraSpec | null = null;

  /** Era-dependent mesh layers, swapped on `switchEra`. */
  private layers: EraLayers | null = null;

  /** Cached layout (computed once, reused across eras). */
  private readonly layout: BlockLayout;

  /**
   * Create the city block.
   *
   * The structural geometry (ground, lanes, plot footprints) is built
   * immediately. Era-specific meshes are added on the first `switchEra`.
   */
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'city-block';
    this.layout = computeLayout();
    buildStructure(this.root, this.layout);
  }

  /**
   * The block's spatial layout — for traffic, pedestrians, and camera.
   * Safe to read before any era is set (the layout is era-independent).
   */
  getLayout(): BlockLayout {
    return this.layout;
  }

  /**
   * The currently active era spec, or `null` before the first `switchEra`.
   */
  getEra(): EraSpec | null {
    return this.activeEra;
  }

  /**
   * Switch the block's visuals to a new era **in place**.
   *
   * The lot / sidewalk / lane geometry is reused. Only the era-dependent
   * layers (buildings, ads, lamp posts, street surface) are swapped. Because
   * the phase 1 asset builders cache every era's meshes, revisiting a
   * previously displayed era is effectively free.
   *
   * @param era  The era spec to activate.
   */
  switchEra(era: EraSpec): void {
    // If this is the same era, nothing to do.
    if (this.activeEra?.id === era.id && this.layers !== null) {
      return;
    }

    // Remove and dispose the previous era's *non-cached* layers.
    // (Streets are cached by getStreets, so we only remove them from the
    //  scene graph — disposal is handled by the asset cache lifecycle.)
    if (this.layers) {
      removeLayer(this.root, this.layers.streets);
      removeLayer(this.root, this.layers.buildings);
      removeLayer(this.root, this.layers.ads);
      // Buildings and ads are clones generated per-block; dispose them.
      disposeObject3D(this.layers.buildings);
      disposeObject3D(this.layers.ads);
    }

    // Generate (or fetch cached) era assets.
    const assets = getEraAssets(era);
    const lots = this.layout.lots;
    populateBuildings(era, lots);

    // --- Streets layer ---
    // Clone the cached street group so we don't mutate the shared template.
    const streetsLayer = assets.streets.clone();
    streetsLayer.name = `layer:streets:${era.id}`;
    this.root.add(streetsLayer);

    // --- Buildings layer ---
    const buildingsLayer = new THREE.Group();
    buildingsLayer.name = `layer:buildings:${era.id}`;
    for (let i = 0; i < assets.buildings.length; i++) {
      const building = assets.buildings[i]!;
      // The builder already positions the clone at the lot centre.
      buildingsLayer.add(building);
    }
    this.root.add(buildingsLayer);

    // --- Ads layer ---
    const adsLayer = buildAdsLayer(era, lots);
    adsLayer.name = `layer:ads:${era.id}`;
    this.root.add(adsLayer);

    this.layers = {
      streets: streetsLayer,
      buildings: buildingsLayer,
      ads: adsLayer,
    };
    this.activeEra = era;
  }

  /**
   * Dispose all era-dependent layers and reset to the empty structural block.
   * The structural geometry remains intact for a subsequent `switchEra`.
   */
  disposeEraLayers(): void {
    if (!this.layers) return;
    removeLayer(this.root, this.layers.streets);
    removeLayer(this.root, this.layers.buildings);
    removeLayer(this.root, this.layers.ads);
    disposeObject3D(this.layers.buildings);
    disposeObject3D(this.layers.ads);
    this.layers = null;
    this.activeEra = null;
  }

  /**
   * Fully dispose the block including structural geometry.
   */
  dispose(): void {
    this.disposeEraLayers();
    disposeObject3D(this.root);
    // Clear the root's children references.
    while (this.root.children.length > 0) {
      this.root.remove(this.root.children[0]!);
    }
  }
}

// ---------------------------------------------------------------------------
// Layout computation
// ---------------------------------------------------------------------------

/**
 * Compute the immutable block layout: lanes, sidewalks, and building lots.
 *
 * The layout is era-independent and deterministic so traffic and pedestrian
 * systems can reference stable coordinates regardless of the active era.
 */
function computeLayout(): BlockLayout {
  const roadSurfaceY = 0.1; // top of the 0.1-thick road box
  const sidewalkSurfaceY = 0.25; // road top + sidewalk slab height

  // --- Traffic lanes (two-lane road, one per direction) ---
  const laneOffset = ROAD_WIDTH / 4; // centre of each lane
  const lanes: TrafficLane[] = [
    {
      id: 'northbound',
      direction: 1,
      centerX: laneOffset,
      spawnZ: -BLOCK_LENGTH / 2 + 3,
      endZ: BLOCK_LENGTH / 2 - 3,
      surfaceY: roadSurfaceY,
    },
    {
      id: 'southbound',
      direction: -1,
      centerX: -laneOffset,
      spawnZ: BLOCK_LENGTH / 2 - 3,
      endZ: -BLOCK_LENGTH / 2 + 3,
      surfaceY: roadSurfaceY,
    },
  ];

  // --- Sidewalk paths ---
  const sidewalks: SidewalkPath[] = [
    {
      side: 'east',
      centerX: SIDEWALK_OUTER,
      width: SIDEWALK_WIDTH,
      spawnZ: -BLOCK_LENGTH / 2 + 2,
      endZ: BLOCK_LENGTH / 2 - 2,
      surfaceY: sidewalkSurfaceY,
    },
    {
      side: 'west',
      centerX: -SIDEWALK_OUTER,
      width: SIDEWALK_WIDTH,
      spawnZ: BLOCK_LENGTH / 2 - 2,
      endZ: -BLOCK_LENGTH / 2 + 2,
      surfaceY: sidewalkSurfaceY,
    },
  ];

  // --- Building lots ---
  const lots: BuildingLot[] = [];
  const startZ = -BLOCK_LENGTH / 2 + PLOT_DEPTH / 2 + 1;
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < PLOTS_PER_SIDE; i++) {
      const z = startZ + i * (PLOT_DEPTH + PLOT_GAP);
      const x = side * (PLOT_INNER + PLOT_WIDTH / 2);
      lots.push({
        index: lots.length,
        width: PLOT_WIDTH,
        depth: PLOT_DEPTH,
        x,
        z,
      });
    }
  }

  return {
    footprint: [
      PLOT_INNER * 2 + PLOT_WIDTH, // total width including both plot rows
      BLOCK_LENGTH,
    ],
    center: [0, 0],
    lanes,
    sidewalks,
    lots,
    roadSurfaceY,
    sidewalkSurfaceY,
  };
}

// ---------------------------------------------------------------------------
// Structural geometry (era-independent, built once)
// ---------------------------------------------------------------------------

/**
 * Build the era-independent structural geometry: the ground plane and plot
 * footprint pads. These persist across era switches.
 */
function buildStructure(root: THREE.Group, layout: BlockLayout): void {
  const structure = new THREE.Group();
  structure.name = 'block-structure';

  // --- Ground / terrain plane ---
  // A large dark plane extending well beyond the block for context.
  const groundW = layout.footprint[0] + 40;
  const groundL = layout.footprint[1] + 40;
  const groundMat = stdMaterial('#1a1f1a', { roughness: 0.95, metalness: 0.0 });
  const ground = boxMesh(groundW, 0.05, groundL, groundMat);
  ground.position.set(0, -0.025, 0);
  ground.receiveShadow = true;
  ground.castShadow = false;
  structure.add(ground);

  // --- Plot footprint pads (concrete bases under buildings) ---
  const padMat = stdMaterial('#3a3530', { roughness: 0.9, metalness: 0.02 });
  for (const lot of layout.lots) {
    const pad = boxMesh(lot.width + 0.4, 0.1, lot.depth + 0.4, padMat);
    pad.position.set(lot.x, 0.05, lot.z);
    pad.receiveShadow = true;
    pad.castShadow = false;
    structure.add(pad);
  }

  root.add(structure);
}

// ---------------------------------------------------------------------------
// Advertisement layer
// ---------------------------------------------------------------------------

/**
 * Build the advertisement layer for an era: billboards / painted signs on
 * building façades, placed according to the era's coverage probability.
 *
 * Uses {@link getBillboardTexture} so ad artwork matches the era's palette
 * and medium vocabulary. Each ad is a thin textured plane mounted on the
 * street-facing façade of a building.
 */
function buildAdsLayer(era: EraSpec, lots: readonly BuildingLot[]): THREE.Group {
  const group = new THREE.Group();
  group.name = `ads:${era.id}`;
  const rng = createRng(eraSeed(era, 'ads'));
  const ad = era.advertisements;

  for (let i = 0; i < lots.length; i++) {
    // Probability gate — not every façade carries an ad.
    if (rng() > ad.coverage) continue;

    const lot = lots[i]!;
    const tex = getBillboardTexture(era, i);
    const adMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.6,
      metalness: ad.mediums.includes('lcd-screen') || ad.mediums.includes('holographic') ? 0.4 : 0.1,
      emissive: ad.animated ? '#222222' : '#000000',
      emissiveIntensity: ad.animated ? 0.3 : 0.0,
    });

    // Billboard dimensions relative to plot.
    const bbW = Math.min(lot.width * 0.7, 8);
    const bbH = Math.min(bbW * 0.4, 3.5);

    // Place on the street-facing façade. The building sits at lot.x; the
    // façade facing the road is the side closest to x=0.
    const facadeX = lot.x > 0 ? lot.x - lot.width / 2 : lot.x + lot.width / 2;
    const adMesh = new THREE.Mesh(new THREE.PlaneGeometry(bbW, bbH), adMat);
    // Orient to face the road.
    adMesh.position.set(facadeX + (lot.x > 0 ? -0.1 : 0.1), bbH / 2 + 6, lot.z);
    adMesh.rotation.y = lot.x > 0 ? -Math.PI / 2 : Math.PI / 2;
    adMesh.castShadow = false;
    adMesh.receiveShadow = false;
    group.add(adMesh);
  }

  return group;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Remove a layer group from the root if present.
 * Does NOT dispose GPU resources — the caller handles disposal.
 */
function removeLayer(root: THREE.Group, layer: THREE.Group): void {
  if (layer.parent === root) {
    root.remove(layer);
  }
}
