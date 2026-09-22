/**
 * Roadway surfaces: asphalt/era markings, curbs, sidewalks, manholes, and
 * drain grates for the block corner.
 *
 * This module owns the canonical alignment slot constants that buildings,
 * storefronts, traffic, and pedestrians pin to (re-exported from
 * `src/city/street/index.ts`):
 *
 * - road surface at y=0, each street 12 units wide;
 * - curb height 0.15, sidewalk 3 units wide with its top at y=0.15;
 * - driving lanes centered 3 and 9 units across each road (right-hand
 *   traffic), plus a 2-unit curb parking lane per curb;
 * - the sidewalk walking lane centered 1.5 units in from the curb;
 * - storefront bay slots every 6 units, 5-unit clear width, base y=0.15.
 *
 * Rendering policy for era swaps (shared with `furniture.ts`):
 *
 * - a persistent base slab keeps the road at exactly y=0 and the sidewalk
 *   deck top at exactly y=0.15 in every era, so nothing ever floats or
 *   sinks when props swap;
 * - each era adds a thin surfacing layer above the base (1-17 mm) so
 *   coexisting era layers are geometrically separated;
 * - every era material gets a distinct `polygonOffset` so crossfading
 *   layers can never z-fight;
 * - prop slot groups anchor at the pinned base heights; per-era subgroups
 *   lift by the era's surfacing thickness and carry a small frozen
 *   per-era scale, so a prop is always planted on the current paving.
 *
 * All textures come from the shared procedural gfx material library; nothing
 * is downloaded.
 */

import * as THREE from 'three';
import {
  ProceduralGfxLibrary,
  createPRNG,
  createProceduralTexture,
  type PRNG,
} from '../../gfx/materials';
import { mergeBufferGeometries } from '../../gfx/geometry';
import { createInstancedMesh, batchSetTransforms } from '../../gfx/instancing';
import {
  STREET_ERAS,
  STREET_LAYOUT,
  roadSurfaceVariant,
  type StreetEra,
} from './variants';

// Palette accessors are published through the shared library root export.
const { getEraPalette, getMaterialSwatch } = ProceduralGfxLibrary;

// ---------------------------------------------------------------------------
// Canonical alignment slot constants (pinned; mirrored by sibling contracts)
// ---------------------------------------------------------------------------

/** Road surface height. The persistent base slab's top sits at exactly this y. */
export const ROAD_SURFACE_Y = 0;

/** Width of each street, curb face to curb face. */
export const STREET_WIDTH = 12;

/** Curb height above the roadway. */
export const CURB_HEIGHT = 0.15;

/** Sidewalk width from curb face to building face. */
export const SIDEWALK_WIDTH = 3;

/** Sidewalk walking surface height (road + curb height). */
export const SIDEWALK_TOP_Y = 0.15;

/** Driving lane centers measured across each road under right-hand traffic. */
export const DRIVE_LANE_CENTERS = [3, 9] as const;

/** Width of the curb parking lane on each side of each street. */
export const CURB_PARKING_LANE_WIDTH = 2;

/** Sidewalk walking lane center, measured in from the curb face. */
export const SIDEWALK_WALK_LANE_CENTER = 1.5;

/** Ground-floor storefront bay rhythm along each block face. */
export const STOREFRONT_BAY_SPACING = 6;

/** Clear width of each storefront bay slot. */
export const STOREFRONT_BAY_CLEAR_WIDTH = 5;

/** Base height of storefront bay slots (same as the sidewalk top). */
export const STOREFRONT_BAY_BASE_Y = 0.15;

/** One frozen view of every pinned alignment constant. */
export const STREET_ALIGNMENT = Object.freeze({
  roadSurfaceY: ROAD_SURFACE_Y,
  streetWidth: STREET_WIDTH,
  curbHeight: CURB_HEIGHT,
  sidewalkWidth: SIDEWALK_WIDTH,
  sidewalkTopY: SIDEWALK_TOP_Y,
  driveLaneCenters: DRIVE_LANE_CENTERS,
  curbParkingLaneWidth: CURB_PARKING_LANE_WIDTH,
  sidewalkWalkLaneCenter: SIDEWALK_WALK_LANE_CENTER,
  storefrontBaySpacing: STOREFRONT_BAY_SPACING,
  storefrontBayClearWidth: STOREFRONT_BAY_CLEAR_WIDTH,
  storefrontBayBaseY: STOREFRONT_BAY_BASE_Y,
});

// ---------------------------------------------------------------------------
// Era surfacing lifts (anti z-fighting separation between era layers)
// ---------------------------------------------------------------------------

/** First era road layer sits this far above the persistent base slab. */
export const ROAD_LAYER_LIFT = 0.001;
/** Extra road height added per era step (max 0.017 in 2025). */
export const ROAD_LAYER_STEP = 0.004;
/** First era sidewalk paving layer sits this far above the deck top. */
export const SIDEWALK_LAYER_LIFT = 0.001;
/** Extra sidewalk paving height added per era step (max 0.013 in 2025). */
export const SIDEWALK_LAYER_STEP = 0.003;

/** Era index 0..4 for a stop. */
export function eraIndex(era: StreetEra): number {
  return STREET_ERAS.indexOf(era);
}

/** Top surface of the roadway in an era (persistent base at y=0 plus era layer). */
export function roadSurfaceY(era: StreetEra): number {
  return ROAD_SURFACE_Y + ROAD_LAYER_LIFT + eraIndex(era) * ROAD_LAYER_STEP;
}

/** Top surface of the sidewalk paving in an era (deck top at y=0.15 plus layer). */
export function sidewalkSurfaceY(era: StreetEra): number {
  return SIDEWALK_TOP_Y + SIDEWALK_LAYER_LIFT + eraIndex(era) * SIDEWALK_LAYER_STEP;
}

/**
 * Frozen per-era scale for prop era subgroups. Different eras never share a
 * scale, so coexisting prop variants are depth-separated; slot origins sit on
 * the base surface, so scaling never lifts or sinks a prop.
 */
export function eraPropScale(era: StreetEra): number {
  return 0.985 + eraIndex(era) * 0.0075;
}

/**
 * Apply this module's per-era depth policy: distinct polygon offsets keep
 * coplanar era layers (and overlapping prop variants) from z-fighting while
 * they crossfade.
 */
export function applyEraDepthPolicy(material: THREE.Material, era: StreetEra): void {
  const rank = eraIndex(era) + 1;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -rank;
  material.polygonOffsetUnits = -rank;
}

// ---------------------------------------------------------------------------
// Shared era layer handle
// ---------------------------------------------------------------------------

/**
 * One era's slice of a street system: every group that shows only in this
 * era plus the materials whose opacity crossfades with the era weight.
 */
export class StreetEraLayer {
  readonly groups: THREE.Group[] = [];
  readonly materials: THREE.Material[] = [];
  readonly #baseOpacity = new Map<THREE.Material, number>();
  readonly #seen = new Set<THREE.Material>();

  constructor(readonly era: StreetEra) {}

  /** Register an era-only group toggled by the era weight. */
  addGroup(group: THREE.Group): void {
    this.groups.push(group);
  }

  /** Register a material (once) whose base opacity is preserved. */
  addMaterial(material: THREE.Material): void {
    if (this.#seen.has(material)) return;
    this.#seen.add(material);
    this.materials.push(material);
    this.#baseOpacity.set(material, Math.max(0, Math.min(1, material.opacity)));
  }

  /** Apply this era's weight: visibility plus an opacity crossfade. */
  applyWeight(weight: number): void {
    const w = Math.max(0, Math.min(1, weight));
    const visible = w > 0.002;
    for (const group of this.groups) group.visible = visible;
    for (const material of this.materials) {
      material.opacity = (this.#baseOpacity.get(material) ?? 1) * w;
      material.visible = visible;
    }
  }
}

/** Convenience: shared shadow flags for every street mesh. */
export function finalizeMesh(mesh: THREE.Mesh, receiveShadow = true): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/** Scale a plane geometry's UVs so textures tile at a constant real-world size. */
function uvTile(geometry: THREE.BufferGeometry, sizeX: number, sizeZ: number, tile = 4): void {
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv) return;
  const su = sizeX / tile;
  const sv = sizeZ / tile;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
}

/** Axis-aligned quad on the XZ plane, optionally rotated about its center. */
function quadXZ(x0: number, x1: number, z0: number, z1: number, rotY = 0): THREE.BufferGeometry {
  const w = Math.abs(x1 - x0);
  const d = Math.abs(z1 - z0);
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  uvTile(geo, w, d);
  if (rotY !== 0) geo.rotateY(rotY);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  return geo;
}

// ---------------------------------------------------------------------------
// Roadway build
// ---------------------------------------------------------------------------

/** Result of `buildRoadway`. */
export interface RoadwayBuild {
  /** Persistent + era-layer root, named `street:roadway`. */
  readonly root: THREE.Group;
  /** Five era layers (1945..2025) for crossfading. */
  readonly layers: readonly StreetEraLayer[];
}

interface StreetSpec {
  /** Across-street coordinate measured from this axis (ref curb at 0). */
  readonly acrossAxis: 'z' | 'x';
  /** Along-street ranges of the two approaches (intersection excluded). */
  readonly approaches: ReadonlyArray<readonly [number, number]>;
}

const MAIN_STREET: StreetSpec = { acrossAxis: 'z', approaches: [[-48, -12], [0, 48]] };
const CROSS_STREET: StreetSpec = { acrossAxis: 'x', approaches: [[-48, -12], [0, 48]] };

/** Convert (street, along-range, across) into a world quad rect. */
function lineRect(
  spec: StreetSpec,
  along0: number,
  along1: number,
  acrossCenter: number,
  width: number,
): { x0: number; x1: number; z0: number; z1: number } {
  const near = acrossCenter - width / 2;
  const far = acrossCenter + width / 2;
  if (spec.acrossAxis === 'z') {
    return { x0: along0, x1: along1, z0: -far, z1: -near };
  }
  return { x0: -far, x1: -near, z0: along0, z1: along1 };
}

/** Build the persistent road/sidewalk/curb base that never era-fades. */
function buildPersistentBase(root: THREE.Group): void {
  // Road base slab: five non-overlapping quads at exactly y=0.
  const roadGeos = STREET_LAYOUT.roadPieces.map((piece) =>
    quadXZ(piece.x0, piece.x1, piece.z0, piece.z1),
  );
  const roadMat = new THREE.MeshStandardMaterial({
    color: '#2f2f31',
    map: createProceduralTexture('asphalt', {
      primaryColor: '#2f2f31',
      secondaryColor: '#202022',
      seed: 42,
      weathering: 0.5,
      crackDensity: 0.3,
      repeatX: 1,
      repeatY: 1,
    }),
    roughness: 0.96,
    metalness: 0,
  });
  const road = new THREE.Mesh(mergeBufferGeometries(roadGeos), roadMat);
  road.name = 'roadway:base';
  road.position.y = ROAD_SURFACE_Y;
  road.receiveShadow = true;
  root.add(road);
  for (const geo of roadGeos) geo.dispose();

  // Sidewalk decks: boxes with tops at exactly SIDEWALK_TOP_Y (riser = curb).
  const deckMat = new THREE.MeshStandardMaterial({
    color: '#8d8b85',
    map: createProceduralTexture('concrete', {
      primaryColor: '#8d8b85',
      seed: 7,
      weathering: 0.35,
      seams: true,
      repeatX: 1,
      repeatY: 1,
    }),
    roughness: 0.94,
    metalness: 0,
  });
  for (const strip of STREET_LAYOUT.sidewalkStrips) {
    const w = strip.x1 - strip.x0;
    const d = strip.z1 - strip.z0;
    const geo = new THREE.BoxGeometry(w, SIDEWALK_TOP_Y, d);
    uvTile(geo, w, d);
    const deck = new THREE.Mesh(geo, deckMat);
    deck.name = `sidewalk:deck:${strip.name}`;
    deck.position.set((strip.x0 + strip.x1) / 2, SIDEWALK_TOP_Y / 2, (strip.z0 + strip.z1) / 2);
    deck.receiveShadow = true;
    root.add(deck);
  }

  // Granite curb caps, standing proud of every era's paving (top y=0.167).
  const capMat = new THREE.MeshStandardMaterial({
    color: '#75736d',
    map: createProceduralTexture('stone', {
      primaryColor: '#75736d',
      secondaryColor: '#5c5a55',
      seed: 11,
      weathering: 0.4,
      repeatX: 1,
      repeatY: 1,
    }),
    roughness: 0.88,
    metalness: 0.02,
  });
  for (const [i, seg] of STREET_LAYOUT.curbSegments.entries()) {
    const w = seg.x1 - seg.x0;
    const d = seg.z1 - seg.z0;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, d), capMat);
    cap.name = `sidewalk:curb:${i}`;
    cap.position.set((seg.x0 + seg.x1) / 2, 0.156, (seg.z0 + seg.z1) / 2);
    cap.castShadow = true;
    cap.receiveShadow = true;
    root.add(cap);
  }
}

/** Shrink a sidewalk strip away from any edge that carries a curb cap. */
function pavingRect(
  strip: { x0: number; x1: number; z0: number; z1: number },
  inset = 0.35,
): { x0: number; x1: number; z0: number; z1: number } {
  let { x0, x1, z0, z1 } = strip;
  const thin = (a: number, b: number): boolean => Math.abs(b - a) < 0.5;
  for (const c of STREET_LAYOUT.curbSegments) {
    const spanX = Math.min(x1, c.x1) - Math.max(x0, c.x0);
    const spanZ = Math.min(z1, c.z1) - Math.max(z0, c.z0);
    if (thin(c.x0, c.x1)) {
      // Vertical curb strip: may sit on this strip's left or right edge.
      if (spanZ > 0.5) {
        if (c.x0 >= x0 - 0.05 && c.x0 <= x0 + 0.45) x0 += inset;
        if (c.x1 <= x1 + 0.05 && c.x1 >= x1 - 0.45) x1 -= inset;
      }
    }
    if (thin(c.z0, c.z1)) {
      if (spanX > 0.5) {
        if (c.z0 >= z0 - 0.05 && c.z0 <= z0 + 0.45) z0 += inset;
        if (c.z1 <= z1 + 0.05 && c.z1 >= z1 - 0.45) z1 -= inset;
      }
    }
  }
  return { x0, x1, z0, z1 };
}

/** Hand-painted jitter helper. */
function jitterRect(
  rng: PRNG,
  rect: { x0: number; x1: number; z0: number; z1: number },
  jitter: number,
): { x0: number; x1: number; z0: number; z1: number; rot: number } {
  if (jitter <= 0) return { ...rect, rot: 0 };
  const cx = (rect.x0 + rect.x1) / 2;
  const cz = (rect.z0 + rect.z1) / 2;
  const w = Math.abs(rect.x1 - rect.x0);
  const d = Math.abs(rect.z1 - rect.z0);
  const scaleW = 1 + rng.range(-jitter, jitter);
  const scaleD = 1 + rng.range(-jitter, jitter);
  const hw = (w * scaleW) / 2;
  const hd = (d * scaleD) / 2;
  return {
    x0: cx - hw,
    x1: cx + hw,
    z0: cz - hd,
    z1: cz + hd,
    rot: rng.range(-jitter, jitter) * 1.4,
  };
}

/** Build one era's marking geometry (lane lines, dashes, crosswalks). */
function buildMarkings(era: StreetEra, rng: PRNG): {
  lineGeos: THREE.BufferGeometry[];
  crossGeos: THREE.BufferGeometry[];
} {
  const variant = roadSurfaceVariant(era);
  const jitter = variant.markingJitter;
  const lineGeos: THREE.BufferGeometry[] = [];
  const crossGeos: THREE.BufferGeometry[] = [];

  const addLine = (
    spec: StreetSpec,
    across: number,
    width: number,
    dashed: boolean,
    handPainted: boolean,
  ): void => {
    for (const [along0, along1] of spec.approaches) {
      if (!dashed) {
        const rect = lineRect(spec, along0, along1, across, width);
        const j = jitterRect(rng, rect, handPainted ? jitter : 0);
        lineGeos.push(quadXZ(j.x0, j.x1, j.z0, j.z1, j.rot));
        continue;
      }
      // Machine lines: uniform 3-unit period; hand-painted: jittered dashes
      // with the odd skipped stripe, as when crews re-marked by hand.
      let t = along0;
      while (t < along1) {
        const period = handPainted ? rng.range(2.6, 3.3) : 3;
        const dash = handPainted ? rng.range(1.3, 1.9) : 1.7;
        if (!handPainted || !rng.chance(0.07)) {
          const rect = lineRect(spec, t, Math.min(t + dash, along1), across, width);
          const j = jitterRect(rng, rect, handPainted ? jitter : 0);
          lineGeos.push(quadXZ(j.x0, j.x1, j.z0, j.z1, j.rot));
        }
        t += period;
      }
    }
  };

  const handPainted = variant.markingStyle === 'hand-painted';

  for (const spec of [MAIN_STREET, CROSS_STREET]) {
    // Curb parking lane boundary lines at across = 2 and across = 10.
    addLine(spec, 2, 0.13, false, handPainted);
    addLine(spec, 10, 0.13, false, handPainted);
    if (!handPainted) {
      // Driving lane boundaries at across = 4 and 8 (lane centers 3 and 9).
      addLine(spec, 4, 0.1, false, false);
      addLine(spec, 8, 0.1, false, false);
      // Center divider: double solid yellow from 1965 on.
      addLine(spec, 5.86, 0.12, false, false);
      addLine(spec, 6.14, 0.12, false, false);
    } else {
      // 1945: a single hand-painted dashed yellow center line.
      addLine(spec, 6, 0.14, true, true);
    }
  }

  // Zebra crossings on each approach.
  for (const field of STREET_LAYOUT.crosswalks) {
    const isMainApproach = field.z1 - field.z0 === 12; // spans the main street band
    if (isMainApproach) {
      // Stripes run across the main street (long in z), repeating along x.
      let x = field.x0;
      while (x < field.x1) {
        const w = handPainted ? rng.range(0.42, 0.6) : 0.55;
        const rect = { x0: x, x1: Math.min(x + w, field.x1), z0: field.z0, z1: field.z1 };
        const j = jitterRect(rng, rect, handPainted ? jitter : 0);
        crossGeos.push(quadXZ(j.x0, j.x1, j.z0, j.z1, j.rot));
        x += w + (handPainted ? rng.range(0.42, 0.6) : 0.55);
      }
    } else {
      // Stripes run across the cross street (long in x), repeating along z.
      let z = field.z0;
      while (z < field.z1) {
        const w = handPainted ? rng.range(0.42, 0.6) : 0.55;
        const rect = { x0: field.x0, x1: field.x1, z0: z, z1: Math.min(z + w, field.z1) };
        const j = jitterRect(rng, rect, handPainted ? jitter : 0);
        crossGeos.push(quadXZ(j.x0, j.x1, j.z0, j.z1, j.rot));
        z += w + (handPainted ? rng.range(0.42, 0.6) : 0.55);
      }
    }
  }

  return { lineGeos, crossGeos };
}

/** Repair patches and tar seams for an era. */
function buildPatches(era: StreetEra, rng: PRNG): THREE.BufferGeometry[] {
  const variant = roadSurfaceVariant(era);
  const geos: THREE.BufferGeometry[] = [];

  for (let i = 0; i < variant.patchCount; i++) {
    const spec = rng.chance(0.6) ? MAIN_STREET : CROSS_STREET;
    const [a0, a1] = rng.pick(spec.approaches);
    const along0 = rng.range(a0 + 2, a1 - 4);
    const w = rng.range(1.4, 3.4);
    const across = rng.range(2.6, 9.4);
    const d = rng.range(0.9, 2.4);
    const rect = lineRect(spec, along0, along0 + w, across, d);
    geos.push(quadXZ(rect.x0, rect.x1, rect.z0, rect.z1, rng.range(-0.06, 0.06)));
  }

  for (let i = 0; i < variant.tarSeams; i++) {
    const spec = rng.chance(0.5) ? MAIN_STREET : CROSS_STREET;
    const [a0, a1] = rng.pick(spec.approaches);
    const along0 = rng.range(a0 + 1, a1 - 3);
    const across = rng.range(1.4, 10.6);
    if (rng.chance(0.6)) {
      // Seam running along the street.
      const len = rng.range(2, 6);
      const rect = lineRect(spec, along0, along0 + len, across, 0.07);
      geos.push(quadXZ(rect.x0, rect.x1, rect.z0, rect.z1, rng.range(-0.03, 0.03)));
    } else {
      // Seam running across the street.
      const len = rng.range(1, 3);
      const rect = lineRect(spec, along0, along0 + 0.07, across, len);
      geos.push(quadXZ(rect.x0, rect.x1, rect.z0, rect.z1, rng.range(-0.03, 0.03)));
    }
  }

  return geos;
}

/** Gutter strips along both curb lines of both streets. */
function buildGutterGeos(era: StreetEra): THREE.BufferGeometry[] {
  const gw = roadSurfaceVariant(era).gutterWidth;
  const geos: THREE.BufferGeometry[] = [];
  // Main street gutters (both approaches, both kerbs).
  for (const [x0, x1] of MAIN_STREET.approaches) {
    geos.push(quadXZ(x0, x1, -gw, 0));
    geos.push(quadXZ(x0, x1, -12, -12 + gw));
  }
  // Cross street gutters.
  for (const [z0, z1] of CROSS_STREET.approaches) {
    geos.push(quadXZ(0, -gw, z0, z1));
    geos.push(quadXZ(-12, -12 + gw, z0, z1));
  }
  return geos;
}

/** Build the full roadway: persistent base plus five era layers. */
export function buildRoadway(): RoadwayBuild {
  const root = new THREE.Group();
  root.name = 'street:roadway';
  buildPersistentBase(root);

  const layers: StreetEraLayer[] = [];

  for (const era of STREET_ERAS) {
    const variant = roadSurfaceVariant(era);
    const swatch = getMaterialSwatch(era, 'asphaltStone');
    const palette = getEraPalette(era);
    const rng = createPRNG(era * 131 + 17);
    const layer = new StreetEraLayer(era);

    const eraGroup = new THREE.Group();
    eraGroup.name = `roadway:era:${era}`;
    layer.addGroup(eraGroup);
    root.add(eraGroup);

    const mkMat = (
      material: THREE.Material,
    ): THREE.Material => {
      material.transparent = true;
      applyEraDepthPolicy(material, era);
      layer.addMaterial(material);
      return material;
    };

    // 1. Era road surfacing (worn asphalt / patched asphalt / modern paving).
    const roadMat = mkMat(
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: createProceduralTexture('asphalt', {
          primaryColor: swatch.color,
          secondaryColor: '#232326',
          seed: era + 400,
          weathering: variant.wear,
          crackDensity: variant.asphaltCrackDensity,
          repeatX: 1,
          repeatY: 1,
        }),
        roughness: swatch.roughness,
        metalness: 0,
        opacity: 1,
      }),
    );
    const roadGeos = STREET_LAYOUT.roadPieces.map((piece) =>
      quadXZ(piece.x0, piece.x1, piece.z0, piece.z1),
    );
    const roadMesh = new THREE.Mesh(mergeBufferGeometries(roadGeos), roadMat);
    roadMesh.name = `roadway:surface:${era}`;
    roadMesh.position.y = roadSurfaceY(era);
    roadMesh.receiveShadow = true;
    eraGroup.add(roadMesh);
    for (const g of roadGeos) g.dispose();

    // 2. Gutter strips: granite cobblestone edges in 1945, concrete later.
    const gutterSwatch = getMaterialSwatch(era, 'asphaltStone');
    const gutterMat = mkMat(
      new THREE.MeshStandardMaterial({
        color: '#f4f2ee',
        map: createProceduralTexture(variant.cobblestoneGutter ? 'cobblestone' : 'concrete', {
          primaryColor: variant.cobblestoneGutter ? '#57534a' : '#9a988f',
          secondaryColor: variant.cobblestoneGutter ? '#39362f' : '#7d7b73',
          seed: era + 24,
          weathering: variant.wear * 0.8 + 0.1,
          repeatX: 1,
          repeatY: 1,
        }),
        roughness: 0.92,
        metalness: gutterSwatch.metalness * 0.05,
        opacity: 1,
      }),
    );
    const gutterMesh = new THREE.Mesh(mergeBufferGeometries(buildGutterGeos(era)), gutterMat);
    gutterMesh.name = `roadway:gutter:${era}`;
    gutterMesh.position.y = roadSurfaceY(era) + 0.0006;
    gutterMesh.receiveShadow = true;
    eraGroup.add(gutterMesh);

    // 3. Patches and tar seams (era repair history).
    const patchGeos = buildPatches(era, rng);
    if (patchGeos.length > 0) {
      const patchMat = mkMat(
        new THREE.MeshStandardMaterial({
          color: era === 2025 ? '#2c2d30' : '#1d1e20',
          roughness: 0.97,
          metalness: 0,
          opacity: 0.95,
        }),
      );
      const patchMesh = new THREE.Mesh(mergeBufferGeometries(patchGeos), patchMat);
      patchMesh.name = `roadway:patches:${era}`;
      patchMesh.position.y = roadSurfaceY(era) + 0.0011;
      patchMesh.receiveShadow = true;
      eraGroup.add(patchMesh);
    }

    // 4. Markings: hand-painted in 1945, thermoplastic later, epoxy now.
    const { lineGeos, crossGeos } = buildMarkings(era, rng);
    const markingMat = mkMat(
      new THREE.MeshStandardMaterial({
        color: variant.markingColor,
        roughness: 0.72,
        metalness: 0.02,
        opacity: variant.markingOpacity,
      }),
    );
    const lineMesh = new THREE.Mesh(mergeBufferGeometries(lineGeos), markingMat);
    lineMesh.name = `roadway:markings:${era}`;
    lineMesh.position.y = roadSurfaceY(era) + 0.0015;
    lineMesh.receiveShadow = true;
    eraGroup.add(lineMesh);
    for (const g of lineGeos) g.dispose();

    const crossMat = mkMat(
      new THREE.MeshStandardMaterial({
        color: mixTowardWhite(variant.markingColor, 0.35),
        roughness: 0.7,
        metalness: 0.02,
        opacity: variant.markingOpacity * 0.95,
      }),
    );
    const crossMesh = new THREE.Mesh(mergeBufferGeometries(crossGeos), crossMat);
    crossMesh.name = `roadway:crosswalks:${era}`;
    crossMesh.position.y = roadSurfaceY(era) + 0.0015;
    crossMesh.receiveShadow = true;
    eraGroup.add(crossMesh);
    for (const g of crossGeos) g.dispose();

    // 5. Sidewalk paving layer (bluestone flags -> concrete -> modern pavers).
    const masonry = getMaterialSwatch(era, 'masonryConcrete');
    const pavingMat = mkMat(
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: createProceduralTexture(variant.sidewalkTexture, {
          primaryColor: variant.sidewalkUsesMasonryColor ? masonry.color : '#b9b7b0',
          seed: era + 71,
          weathering: palette.defaultWeathering * 0.5,
          repeatX: 1,
          repeatY: 1,
        }),
        roughness: Math.min(1, masonry.roughness + 0.03),
        metalness: 0,
        opacity: 1,
      }),
    );
    const pavingGeos = STREET_LAYOUT.sidewalkStrips.map((strip) => {
      const r = pavingRect(strip);
      return quadXZ(r.x0, r.x1, r.z0, r.z1);
    });
    const pavingMesh = new THREE.Mesh(mergeBufferGeometries(pavingGeos), pavingMat);
    pavingMesh.name = `roadway:paving:${era}`;
    pavingMesh.position.y = sidewalkSurfaceY(era);
    pavingMesh.receiveShadow = true;
    eraGroup.add(pavingMesh);
    for (const g of pavingGeos) g.dispose();

    // 6. 2025 tactile warning panels at the kerb ramps.
    if (variant.tactileCurb) {
      const tactileMat = mkMat(
        new THREE.MeshStandardMaterial({
          color: '#d7a13e',
          roughness: 0.8,
          metalness: 0,
          opacity: 1,
        }),
      );
      const tactileGeos = STREET_LAYOUT.tactilePanels.map((p) => quadXZ(p.x0, p.x1, p.z0, p.z1));
      const tactileMesh = new THREE.Mesh(mergeBufferGeometries(tactileGeos), tactileMat);
      tactileMesh.name = `roadway:tactile:${era}`;
      tactileMesh.position.y = sidewalkSurfaceY(era) + 0.0015;
      tactileMesh.receiveShadow = true;
      eraGroup.add(tactileMesh);
      for (const g of tactileGeos) g.dispose();
    }

    // 7. Instanced manhole covers and drain grates (repeated road furniture).
    const metalSwatch = getMaterialSwatch(era, 'metal');
    const ironMat = mkMat(
      new THREE.MeshStandardMaterial({
        color: metalSwatch.color,
        map: createProceduralTexture('metal', {
          primaryColor: metalSwatch.color,
          seed: era + 9,
          weathering: metalSwatch.grime,
          repeatX: 2,
          repeatY: 2,
        }),
        roughness: metalSwatch.roughness + 0.15 > 1 ? 1 : metalSwatch.roughness + 0.15,
        metalness: Math.min(1, metalSwatch.metalness + 0.1),
        opacity: 1,
      }),
    );

    const manholeGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.03, 24);
    const manholeMesh = createInstancedMesh({
      geometry: manholeGeo,
      material: ironMat,
      count: STREET_LAYOUT.manholeSlots.length,
      name: `roadway:manholes:${era}`,
    });
    batchSetTransforms(
      manholeMesh,
      STREET_LAYOUT.manholeSlots.map((s, index) => ({
        index,
        transform: {
          position: [s.x, roadSurfaceY(era) + 0.004, s.z],
          rotation: [0, rng.range(0, Math.PI), 0],
          scale: eraPropScale(era),
        },
      })),
    );
    eraGroup.add(manholeMesh);

    const drainGeos: THREE.BufferGeometry[] = [];
    const drainBed = new THREE.BoxGeometry(0.52, 0.035, 0.32);
    drainGeos.push(drainBed.translate(0, -0.004, 0));
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.BoxGeometry(0.05, 0.014, 0.28);
      drainGeos.push(bar.translate(-0.19 + i * 0.125, 0.02, 0));
    }
    const drainGeo = mergeBufferGeometries(drainGeos);
    const drainMesh = createInstancedMesh({
      geometry: drainGeo,
      material: ironMat,
      count: STREET_LAYOUT.drainSlots.length,
      name: `roadway:drains:${era}`,
    });
    batchSetTransforms(
      drainMesh,
      STREET_LAYOUT.drainSlots.map((s, index) => ({
        index,
        transform: {
          position: [s.x, roadSurfaceY(era) + 0.005, s.z],
          rotation: [0, s.rot ?? 0, 0],
          scale: eraPropScale(era),
        },
      })),
    );
    eraGroup.add(drainMesh);

    layer.applyWeight(era === 1945 ? 1 : 0);
    layers.push(layer);
  }

  return { root, layers };
}

/** Mix a hex color toward white by t (0..1) for crosswalk paint. */
function mixTowardWhite(hex: string, t: number): string {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color('#ffffff'), t);
  return `#${c.getHexString()}`;
}
