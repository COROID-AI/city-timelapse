/**
 * City block layout generator.
 *
 * Composes era-specific buildings, storefronts, advertisements, streets,
 * sidewalks, crosswalks, lamp posts, and traffic lights into a single
 * navigable city block.
 *
 * The block is laid out deterministically so that downstream traffic and
 * pedestrian systems can reference the fixed footprint and lane geometry.
 * Era transitions use {@link CityBlock.switchEra} which swaps the visual
 * content of each plot *in place* — reusing cached asset-builder meshes rather
 * than rebuilding the whole scene graph — keeping era transitions smooth.
 *
 * Layout (top-down, X = east, Z = south):
 *
 * ```
 *             N
 *     ┌────────┬────────┐
 *     │ plot 0 │ plot 1 │   ← north row (2 plots)
 *     ├────────┼────────┤
 *     │ plot 2 │ plot 3 │   ← south row (2 plots)
 *     └────────┴────────┘
 *         W        E
 *             S
 * ```
 *
 * A cross of two roads (one east-west, one north-south) runs through the
 * middle of the block, creating a four-way intersection at the centre.
 * Buildings sit in the four corner quadrants; sidewalks ring the roads and
 * crosswalks stripe the intersection.
 */
import * as THREE from 'three';
import type { EraSpec, EraId } from './eraRegistry';
import { getEraSpec, ALL_ERA_SPECS } from './eraRegistry';
import {
  getEraAssetSet,
  type EraAssetSet,
  type BuildingLot,
  type StreetDimensions,
} from './assetBuilder/eras';
import { getSignageTexture } from './assetBuilder/textures';

// ---------------------------------------------------------------------------
// Layout constants — deterministic, referenced by traffic / pedestrian systems
// ---------------------------------------------------------------------------

/** Total size of the city block square footprint (edge length, world units). */
export const BLOCK_SIZE = 120;

/** Width of each roadway (both N-S and E-W roads share this width). */
export const ROAD_WIDTH = 14;

/** Width of the sidewalk on each side of every road. */
export const SIDEWALK_WIDTH = 4;

/** Half of the block edge — convenient alias. */
const HALF = BLOCK_SIZE / 2;

/** Half the road width. */
const HALF_ROAD = ROAD_WIDTH / 2;

/** Size of one quadrant (the buildable area inside one corner), edge length. */
const QUADRANT_SIZE = HALF - HALF_ROAD - SIDEWALK_WIDTH;

// ---------------------------------------------------------------------------
// Public geometry descriptors for traffic & pedestrian systems
// ---------------------------------------------------------------------------

/** A single cardinal direction lane descriptor used by traffic & pedestrians. */
export interface LaneDescriptor {
  /** Midline of the lane, in world XZ coordinates. */
  readonly start: THREE.Vector2Tuple;
  readonly end: THREE.Vector2Tuple;
  /** Width of the drivable / walkable surface. */
  readonly width: number;
  /** Axis this lane runs along. */
  readonly axis: 'x' | 'z';
  /** Direction of travel (+1 or -1 along the axis). */
  readonly direction: 1 | -1;
}

/** Cartesian rect in XZ space: [minX, minZ, maxX, maxZ]. */
export type Rect = readonly [number, number, number, number];

/**
 * Immutable description of the block's footprint and lane layout.
 *
 * Traffic and pedestrian systems consume this to know where roads, sidewalks,
 * crosswalks, and building plots are — without depending on any THREE objects.
 */
export interface BlockLayout {
  /** The square footprint [minX, minZ, maxX, maxZ]. */
  readonly footprint: Rect;
  /** Road width (both roads). */
  readonly roadWidth: number;
  /** Sidewalk width. */
  readonly sidewalkWidth: number;
  /** Centre of the intersection. */
  readonly center: THREE.Vector2Tuple;
  /** The four building-plot rectangles (one per quadrant), as XZ rects. */
  readonly plots: readonly Rect[];
  /** Drivable road lanes (two per road = one each direction). */
  readonly trafficLanes: readonly LaneDescriptor[];
  /** Sidewalk centre-lines for pedestrian routing (one per sidewalk strip). */
  readonly sidewalkLanes: readonly LaneDescriptor[];
  /** Crosswalk rectangles at the four intersection approaches. */
  readonly crosswalks: readonly Rect[];
}

/**
 * Compute the deterministic, era-independent block layout.
 *
 * Pure function: no side effects, safe to call before any meshes exist.
 */
export function computeBlockLayout(): BlockLayout {
  const footprint: Rect = [-HALF, -HALF, HALF, HALF];
  const center: THREE.Vector2Tuple = [0, 0];

  // Four quadrant buildable plots (excluding road + sidewalk corridor).
  // Plot indexing: 0 = NW, 1 = NE, 2 = SW, 3 = SE.
  const corridor = HALF_ROAD + SIDEWALK_WIDTH;
  const plots: Rect[] = [
    [-HALF, -HALF, -corridor, -corridor], // NW
    [corridor, -HALF, HALF, -corridor], // NE
    [-HALF, corridor, -corridor, HALF], // SW
    [corridor, corridor, HALF, HALF], // SE
  ];

  // Traffic lanes — two per road, one each direction.
  // E-W road (runs along X at z=0): eastbound south half, westbound north half.
  const trafficLanes: LaneDescriptor[] = [
    // Eastbound (+x), south side of E-W road
    {
      start: [-HALF, HALF_ROAD / 2],
      end: [HALF, HALF_ROAD / 2],
      width: ROAD_WIDTH / 2,
      axis: 'x',
      direction: 1,
    },
    // Westbound (-x), north side of E-W road
    {
      start: [HALF, -HALF_ROAD / 2],
      end: [-HALF, -HALF_ROAD / 2],
      width: ROAD_WIDTH / 2,
      axis: 'x',
      direction: -1,
    },
    // Southbound (+z), east side of N-S road
    {
      start: [HALF_ROAD / 2, -HALF],
      end: [HALF_ROAD / 2, HALF],
      width: ROAD_WIDTH / 2,
      axis: 'z',
      direction: 1,
    },
    // Northbound (-z), west side of N-S road
    {
      start: [-HALF_ROAD / 2, HALF],
      end: [-HALF_ROAD / 2, -HALF],
      width: ROAD_WIDTH / 2,
      axis: 'z',
      direction: -1,
    },
  ];

  // Sidewalk centre-lines (eight strips: 4 along roads + 4 perimeter corners).
  // We expose the 4 main sidewalk strips hugging each road side.
  const sw = SIDEWALK_WIDTH / 2;
  const edge = HALF_ROAD + sw;
  const sidewalkLanes: LaneDescriptor[] = [
    // E-W road north sidewalk (runs along x at z = -edge)
    {
      start: [-HALF, -edge],
      end: [HALF, -edge],
      width: SIDEWALK_WIDTH,
      axis: 'x',
      direction: 1,
    },
    // E-W road south sidewalk (z = +edge)
    {
      start: [HALF, edge],
      end: [-HALF, edge],
      width: SIDEWALK_WIDTH,
      axis: 'x',
      direction: -1,
    },
    // N-S road west sidewalk (x = -edge)
    {
      start: [-edge, HALF],
      end: [-edge, -HALF],
      width: SIDEWALK_WIDTH,
      axis: 'z',
      direction: -1,
    },
    // N-S road east sidewalk (x = +edge)
    {
      start: [edge, -HALF],
      end: [edge, HALF],
      width: SIDEWALK_WIDTH,
      axis: 'z',
      direction: 1,
    },
  ];

  // Crosswalks — four striped bands at the intersection approaches.
  const cwLen = HALF_ROAD; // spans the road width
  const cwWidth = 3; // stripe length along the crossing direction
  const crosswalks: Rect[] = [
    // North approach (crosses E-W road, at z = -HALF_ROAD - cwWidth/2 ... )
    [-cwLen / 2, -HALF_ROAD - cwWidth, cwLen / 2, -HALF_ROAD],
    // South approach
    [-cwLen / 2, HALF_ROAD, cwLen / 2, HALF_ROAD + cwWidth],
    // West approach (crosses N-S road)
    [-HALF_ROAD - cwWidth, -cwLen / 2, -HALF_ROAD, cwLen / 2],
    // East approach
    [HALF_ROAD, -cwLen / 2, HALF_ROAD + cwWidth, cwLen / 2],
  ];

  return {
    footprint,
    roadWidth: ROAD_WIDTH,
    sidewalkWidth: SIDEWALK_WIDTH,
    center,
    plots,
    trafficLanes,
    sidewalkLanes,
    crosswalks,
  };
}

// ---------------------------------------------------------------------------
// Internal plot model
// ---------------------------------------------------------------------------

/** One building plot and its era-swappable mesh container. */
interface Plot {
  /** Plot rectangle in XZ space. */
  readonly rect: Rect;
  /** Centre of the plot in world XZ. */
  readonly center: THREE.Vector2Tuple;
  /** Stable seed for deterministic building generation. */
  readonly seed: number;
  /** Building lot dimensions (width x depth) fit to the plot. */
  readonly lot: BuildingLot;
  /** Y rotation (radians) so the building faces the nearest road. */
  readonly rotationY: number;
  /** Container group that holds the current era's building mesh. */
  readonly group: THREE.Group;
  /** The currently-installed building mesh (null until first era set). */
  building: THREE.Group | null;
}

/**
 * A roadside advertisement billboard anchored near a plot edge facing a road.
 * Swapped per era just like buildings.
 */
interface Billboard {
  /** Anchor group fixed in world space. */
  readonly group: THREE.Group;
  /** The currently-installed ad mesh. */
  ad: THREE.Group | null;
  /** Stable seed for deterministic ad selection. */
  readonly seed: number;
}

// ---------------------------------------------------------------------------
// CityBlock
// ---------------------------------------------------------------------------

/** Options for constructing a {@link CityBlock}. */
export interface CityBlockOptions {
  /** Initial era spec. Defaults to the first era (1945). */
  initialSpec?: EraSpec;
}

/**
 * A composable, era-switchable city block.
 *
 * Construct once, add {@link CityBlock.group} to a scene, then call
 * {@link CityBlock.switchEra} to swap all building / storefront / ad visuals
 * in place. Roads, sidewalks, crosswalks, lamp posts and traffic lights also
 * refresh to the new era's style, but plot *positions* and the layout
 * geometry never change.
 */
export class CityBlock {
  /** Root THREE group — add this to your scene. */
  readonly group: THREE.Group;

  /** The deterministic, era-independent layout descriptor. */
  readonly layout: BlockLayout;

  /** The currently active era spec. */
  currentSpec: EraSpec;

  /** Era asset set currently in use. */
  private assets: EraAssetSet;

  /** Container for the static street geometry (swapped per era). */
  private readonly streetGroup: THREE.Group;

  /** Container for crosswalk stripes (swapped per era). */
  private readonly crosswalkGroup: THREE.Group;

  /** Container for lamp posts + traffic lights (swapped per era). */
  private readonly furnitureGroup: THREE.Group;

  /** Container for building plots (positions fixed, meshes swapped). */
  private readonly buildingGroup: THREE.Group;

  /** Container for roadside billboards (positions fixed, meshes swapped). */
  private readonly billboardGroup: THREE.Group;

  /** The four building plots. */
  private readonly plots: Plot[] = [];

  /** Roadside billboards (one per plot, facing the nearest road). */
  private readonly billboards: Billboard[] = [];

  /**
 * @param opts construction options.
 */
  constructor(opts: CityBlockOptions = {}) {
    this.group = new THREE.Group();
    this.group.name = 'cityBlock';
    this.layout = computeBlockLayout();
    this.currentSpec = opts.initialSpec ?? getEraSpec('1945');
    this.assets = getEraAssetSet(this.currentSpec);

    this.streetGroup = new THREE.Group();
    this.streetGroup.name = 'streets';
    this.crosswalkGroup = new THREE.Group();
    this.crosswalkGroup.name = 'crosswalks';
    this.furnitureGroup = new THREE.Group();
    this.furnitureGroup.name = 'furniture';
    this.buildingGroup = new THREE.Group();
    this.buildingGroup.name = 'buildings';
    this.billboardGroup = new THREE.Group();
    this.billboardGroup.name = 'billboards';

    this.group.add(
      this.streetGroup,
      this.crosswalkGroup,
      this.furnitureGroup,
      this.buildingGroup,
      this.billboardGroup,
    );

    // Build the fixed plot scaffolding (positions only; meshes come later).
    this.initPlots();
    this.initBillboards();

    // Populate the initial era's visuals.
    this.buildStaticLayer();
    this.refreshBuildings();
    this.refreshBillboards();
  }

  // -----------------------------------------------------------------------
  // Era switching
  // -----------------------------------------------------------------------

  /**
   * Swap the entire block's visuals to a new era *in place*.
   *
   * Plot positions, the layout geometry, and the root group are unchanged.
   * Only the meshes inside each plot / billboard / furniture container are
   * replaced with cached, era-correct assets. This keeps transitions smooth
   * (no full scene rebuild) and lets traffic / pedestrian systems keep their
   * references to {@link CityBlock.layout}.
   *
   * @param spec the era spec to switch to.
   */
  switchEra(spec: EraSpec): void {
    if (spec.eraId === this.currentSpec.eraId) return;
    this.currentSpec = spec;
    this.assets = getEraAssetSet(spec);

    // Swap static street + furniture layers.
    this.buildStaticLayer();
    // Swap per-plot building / storefront meshes.
    this.refreshBuildings();
    // Swap roadside billboards.
    this.refreshBillboards();
  }

  /**
   * Convenience: switch by era id string.
   * @param eraId one of '1945'..'2025'.
   */
  switchEraById(eraId: EraId): void {
    this.switchEra(getEraSpec(eraId));
  }

  // -----------------------------------------------------------------------
  // Initialisation helpers
  // -----------------------------------------------------------------------

  /**
   * Create the four fixed building-plot scaffolds (position + seed), each
   * rotated so its storefront faces the nearest road.
   */
  private initPlots(): void {
    const plotCentres: THREE.Vector2Tuple[] = [
      [-HALF + QUADRANT_SIZE / 2, -HALF + QUADRANT_SIZE / 2], // NW
      [HALF - QUADRANT_SIZE / 2, -HALF + QUADRANT_SIZE / 2], // NE
      [-HALF + QUADRANT_SIZE / 2, HALF - QUADRANT_SIZE / 2], // SW
      [HALF - QUADRANT_SIZE / 2, HALF - QUADRANT_SIZE / 2], // SE
    ];

    // Each plot faces the road corridor nearest to it. Determine rotation so
    // the building's +Z face (storefront) points toward the road.
    const rotations = [Math.PI / 2, -Math.PI / 2, Math.PI / 2, -Math.PI / 2];
    // NW faces east (toward N-S road)  → rotate +90°
    // NE faces west (toward N-S road)  → rotate -90°
    // SW faces east (toward N-S road)  → rotate +90°
    // SE faces west (toward N-S road)  → rotate -90°

    for (let i = 0; i < 4; i++) {
      const rect = this.layout.plots[i]!;
      const center = plotCentres[i]!;
      const width = QUADRANT_SIZE * 0.72; // leave margin for sidewalks/ads
      const depth = QUADRANT_SIZE * 0.72;
      const plotGroup = new THREE.Group();
      plotGroup.position.set(center[0], 0, center[1]);
      plotGroup.rotation.y = rotations[i]!;
      this.buildingGroup.add(plotGroup);

      this.plots.push({
        rect,
        center,
        seed: 1000 + i * 137,
        lot: { width, depth, seed: 1000 + i * 137 },
        rotationY: rotations[i]!,
        group: plotGroup,
        building: null,
      });
    }
  }

  /**
   * Create roadside billboard anchors — one per plot, placed on the plot edge
   * nearest the road, facing outward toward traffic.
   */
  private initBillboards(): void {
    // Billboard positions: just inside the sidewalk, facing the road.
    const positions: Array<{ pos: THREE.Vector2Tuple; rot: number; seed: number }> = [
      // NW plot — billboard on its east edge facing the N-S road (east)
      { pos: [-HALF_ROAD - SIDEWALK_WIDTH * 0.5, -HALF + QUADRANT_SIZE * 0.5], rot: -Math.PI / 2, seed: 5001 },
      // NE plot — west edge facing N-S road (west)
      { pos: [HALF_ROAD + SIDEWALK_WIDTH * 0.5, -HALF + QUADRANT_SIZE * 0.5], rot: Math.PI / 2, seed: 5002 },
      // SW plot — east edge facing N-S road (east)
      { pos: [-HALF_ROAD - SIDEWALK_WIDTH * 0.5, HALF - QUADRANT_SIZE * 0.5], rot: -Math.PI / 2, seed: 5003 },
      // SE plot — west edge facing N-S road (west)
      { pos: [HALF_ROAD + SIDEWALK_WIDTH * 0.5, HALF - QUADRANT_SIZE * 0.5], rot: Math.PI / 2, seed: 5004 },
    ];

    for (const p of positions) {
      const anchor = new THREE.Group();
      anchor.position.set(p.pos[0], 0, p.pos[1]);
      anchor.rotation.y = p.rot;
      this.billboardGroup.add(anchor);
      this.billboards.push({ group: anchor, ad: null, seed: p.seed });
    }
  }

  // -----------------------------------------------------------------------
  // Static layer (streets, crosswalks, lamp posts, traffic lights)
  // -----------------------------------------------------------------------

  /**
   * Rebuild the static street + furniture layer for the current era.
   *
   * The layer is era-dependent (asphalt colour, lamp style, etc.) but its
   * geometry is fixed by {@link BlockLayout}, so swapping is cheap.
   */
  private buildStaticLayer(): void {
    this.clearGroup(this.streetGroup);
    this.clearGroup(this.crosswalkGroup);
    this.clearGroup(this.furnitureGroup);

    const dims: StreetDimensions = {
      length: BLOCK_SIZE,
      roadWidth: ROAD_WIDTH,
      sidewalkWidth: SIDEWALK_WIDTH,
    };

    // E-W road segment (runs along X), centred at origin, road spans Z.
    const ewRoad = this.assets.buildStreetSegment(dims);
    ewRoad.rotation.y = Math.PI / 2; // street segment is built along Z; rotate to X
    ewRoad.position.set(0, 0, 0);
    this.streetGroup.add(ewRoad);

    // N-S road segment (runs along Z)
    const nsRoad = this.assets.buildStreetSegment(dims);
    nsRoad.position.set(0, 0, 0);
    this.streetGroup.add(nsRoad);

    // Lamp posts along both roads (asset set helper places them along the
    // segment's local Z axis; we use the N-S road group for that, then the E-W
    // road group rotated).
    this.assets.placeLampPosts(nsRoad, dims, 24);
    this.assets.placeLampPosts(ewRoad, dims, 24);

    // Crosswalk stripes at the four intersection approaches.
    this.buildCrosswalks();

    // Traffic lights at the four corners of the intersection.
    this.buildTrafficLights();
  }

  /**
   * Paint zebra-stripe crosswalks at the four intersection approaches.
   */
  private buildCrosswalks(): void {
    const spec = this.currentSpec;
    const stripeMat = new THREE.MeshBasicMaterial({
      color: spec.streets.laneMarkingColor,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    const stripeW = 0.45; // stripe width
    const gap = 0.35; // gap between stripes
    const stride = stripeW + gap;

    for (const cw of this.layout.crosswalks) {
      const [minX, minZ, maxX, maxZ] = cw;
      const spanX = maxX - minX;
      const spanZ = maxZ - minZ;
      // Determine orientation: if span along X is the road width, stripes run
      // along Z (perpendicular to travel).
      const alongX = spanX > spanZ;
      const length = alongX ? spanX : spanZ;
      const count = Math.max(3, Math.floor(length / stride));
      const start = -(count * stride) / 2 + stripeW / 2;
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;

      for (let i = 0; i < count; i++) {
        const offset = start + i * stride;
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(stripeW, 2.4), stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        if (alongX) {
          stripe.position.set(cx + offset, 0.03, cz);
        } else {
          stripe.rotation.z = Math.PI / 2;
          stripe.position.set(cx, 0.03, cz + offset);
        }
        this.crosswalkGroup.add(stripe);
      }
    }
  }

  /**
   * Place traffic-light poles at the four corners of the intersection.
   */
  private buildTrafficLights(): void {
    const offset = HALF_ROAD + SIDEWALK_WIDTH * 0.3;
    const corners: Array<THREE.Vector2Tuple> = [
      [-offset, -offset],
      [offset, -offset],
      [-offset, offset],
      [offset, offset],
    ];
    for (let i = 0; i < corners.length; i++) {
      const tl = this.assets.buildTrafficLight();
      tl.position.set(corners[i]![0], 0, corners[i]![1]);
      // Face toward the intersection centre.
      tl.rotation.y = Math.atan2(-corners[i]![0], -corners[i]![1]);
      this.furnitureGroup.add(tl);
    }
  }

  // -----------------------------------------------------------------------
  // Building + storefront refresh (in-place mesh swap)
  // -----------------------------------------------------------------------

  /**
   * Replace each plot's building mesh with an era-correct one, keeping the
   * plot's fixed position/rotation. Storefronts and awnings are part of the
   * building mesh (built by {@link EraAssetSet.buildBuilding}), so they swap
   * automatically.
   */
  private refreshBuildings(): void {
    for (const plot of this.plots) {
      // Remove the old building mesh (if any).
      if (plot.building) {
        plot.group.remove(plot.building);
        this.disposeMesh(plot.building);
      }
      // Build the new era-correct building for this lot.
      const building = this.assets.buildBuilding(plot.lot);
      building.name = `building-${plot.seed}`;
      plot.group.add(building);
      plot.building = building;
    }
  }

  // -----------------------------------------------------------------------
  // Billboard refresh (in-place mesh swap)
  // -----------------------------------------------------------------------

  /**
   * Replace each roadside billboard with an era-correct advertisement panel.
   * The billboard anchor (position/rotation) is fixed; only the panel mesh
   * swaps.
   */
  private refreshBillboards(): void {
    for (const bb of this.billboards) {
      if (bb.ad) {
        bb.group.remove(bb.ad);
        this.disposeMesh(bb.ad);
      }
      bb.ad = this.buildBillboard(bb.seed);
      bb.group.add(bb.ad);
    }
  }

  /**
   * Build a single era-appropriate roadside billboard panel.
   *
   * Uses the cached signage texture registry so each era gets distinct
   * ad copy and art direction (hand-painted → neon → fluorescent → backlit
   * vinyl → LED digital).
   */
  private buildBillboard(seed: number): THREE.Group {
    const group = new THREE.Group();
    group.name = `billboard-${seed}`;
    const spec = this.currentSpec;

    // Pole
    const poleH = 6;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, poleH, 8),
      new THREE.MeshStandardMaterial({ color: spec.streets.lampPostColor, roughness: 0.6, metalness: 0.4 }),
    );
    pole.position.y = poleH / 2;
    group.add(pole);

    // Panel — uses the era's signage texture (cached, deterministic).
    const panelW = 5;
    const panelH = 3;
    const adIndex = seed % spec.signage.adContent.length;
    // Pull a signage texture directly from the texture registry via the asset
    // set's textures (signage textures aren't on EraTextureSet, so we import
    // the getter lazily to avoid a hard dep cycle at module load).
    const tex = getSignageTexture(spec, adIndex);
    const panelMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: '#ffffff',
      emissiveMap: tex,
      emissiveIntensity: spec.signage.neonLikelihood > 0.4 || spec.signage.backlitLikelihood > 0.4 ? 0.85 : 0.3,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(panelW, panelH), panelMat);
    panel.position.set(panelW / 2 + 0.2, poleH - panelH / 2 - 0.4, 0);
    panel.name = 'adPanel';
    group.add(panel);

    // Backing frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(panelW + 0.3, panelH + 0.3, 0.1),
      new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.8 }),
    );
    frame.position.set(panelW / 2 + 0.2, poleH - panelH / 2 - 0.4, -0.06);
    group.add(frame);

    group.userData = { eraId: spec.eraId, seed };
    return group;
  }

  // -----------------------------------------------------------------------
  // Cleanup helpers
  // -----------------------------------------------------------------------

  /** Remove all children from a group. */
  private clearGroup(g: THREE.Group): void {
    for (let i = g.children.length - 1; i >= 0; i--) {
      g.remove(g.children[i]!);
    }
  }

  /**
   * Dispose geometries / materials in a mesh hierarchy to free GPU memory.
   * Cached prototype textures/materials are shared and must NOT be disposed
   * here, so we only dispose geometries and *non-shared* materials we created
   * locally (billboard panels, crosswalk stripes). Building meshes clone
   * shared textures, so disposing their materials is safe.
   */
  private disposeMesh(root: THREE.Object3D): void {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m && 'dispose' in m && typeof m.dispose === 'function') {
          // Avoid disposing shared cached textures — skip only this material.
          const mat = m as THREE.MeshStandardMaterial;
          if (mat.map && mat.map.userData?.sharedCache) continue;
          (m as THREE.Material).dispose();
        }
      }
    });
  }

  /** Free all GPU resources held by this block. */
  dispose(): void {
    this.disposeMesh(this.group);
    this.clearGroup(this.group);
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

/**
 * Build a {@link CityBlock} for a given era id.
 * @param eraId the era to initialise the block with.
 */
export function createCityBlock(eraId: EraId = '1945'): CityBlock {
  return new CityBlock({ initialSpec: getEraSpec(eraId) });
}

/** Pre-warm a block for every era and return them (useful for scene bootstrap). */
export function createAllEraCityBlocks(): Record<string, CityBlock> {
  const blocks: Record<string, CityBlock> = {};
  for (const spec of ALL_ERA_SPECS) {
    blocks[spec.eraId] = new CityBlock({ initialSpec: spec });
  }
  return blocks;
}
