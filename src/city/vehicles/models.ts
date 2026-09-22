/**
 * Procedural automobile models and the instanced fleet view.
 *
 * All geometry is generated at runtime from the shared gfx-materials library
 * (beveled boxes + merged part assemblies) — no downloaded models. Each kind
 * becomes a merged body geometry plus a merged glass geometry; the view then
 * renders every slot as a body/glass pair while wheels, bumpers/trim, and
 * head/tail/brake lamps are drawn from shared `InstancedMesh` pools so the
 * active fleet stays within a small draw-call budget.
 *
 * Layout: local +Z is forward, local +X is right, y = 0 is the road surface.
 */

import * as THREE from 'three';
import { ProceduralGfxLibrary } from '../../gfx/materials';
import { ROAD_SURFACE_Y } from './traffic';
import {
  VEHICLE_KINDS,
  trimColor,
  type FleetEra,
  type VehicleKindDef,
  type VehicleKindId,
} from './variants';

/* -------------------------------------------------------------------------- */
/* Kind geometry assets (cached per kind)                                     */
/* -------------------------------------------------------------------------- */

/** Merged, renderer-agnostic geometry for one vehicle kind. */
export interface VehicleKindAssets {
  readonly body: THREE.BufferGeometry;
  readonly glass: THREE.BufferGeometry | null;
}

const kindAssetCache = new Map<VehicleKindId, VehicleKindAssets>();

type PartList = THREE.BufferGeometry[];

/** Beveled box part via the shared gfx-materials geometry builder. */
function box(
  parts: PartList,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  bevel = 0.04,
): void {
  const geometry = ProceduralGfxLibrary.createBeveledBoxGeometry({
    width,
    height,
    depth,
    bevelSize: bevel,
    bevelSegments: bevel >= 0.12 ? 3 : 2,
  });
  geometry.translate(x, y, z);
  parts.push(geometry);
}

/** Cylinder part (posts, pantographs, sensor pods), optionally on an axis. */
function cyl(
  parts: PartList,
  radius: number,
  length: number,
  x: number,
  y: number,
  z: number,
  axis: 'x' | 'y' | 'z' = 'y',
): void {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 12, 1);
  if (axis === 'x') geometry.rotateZ(Math.PI / 2);
  if (axis === 'z') geometry.rotateX(Math.PI / 2);
  geometry.translate(x, y, z);
  parts.push(geometry);
}

function merge(parts: PartList): THREE.BufferGeometry | null {
  const nonEmpty = parts.filter((p) => p.getAttribute('position').count > 0);
  if (nonEmpty.length === 0) return null;
  return ProceduralGfxLibrary.mergeBufferGeometries(nonEmpty);
}

/**
 * Build the body/glass parts for a kind. Bodies are layered boxes matched to
 * each era's silhouette: bulbous pre-war pontoon forms with running boards,
 * long chrome-era tailfin sedans, folded-paper 1980s boxes, rounded 2000s
 * SUV/compacts, and smooth grille-less EVs with sensor pods.
 */
function buildKindParts(def: VehicleKindDef): { body: PartList; glass: PartList } {
  const body: PartList = [];
  const glass: PartList = [];
  const L = def.length;
  const W = def.width;
  const halfW = W / 2;

  switch (def.id) {
    /* ------------------------------------------------------------ 1945 */
    case 'presedan': {
      const belt = 1.1;
      box(body, W, 0.8, L, 0, 0.7, 0, 0.2); // rounded lower deck
      box(body, W - 0.35, 0.3, 1.9, 0, 1.12, 1.35, 0.16); // crowned hood
      box(body, W - 0.35, 0.3, 1.3, 0, 1.1, -1.65, 0.16); // rounded trunk
      box(glass, W - 0.28, 0.44, 2.2, 0, belt + 0.2, -0.2, 0.06); // window band
      box(body, W - 0.4, 0.36, 2.3, 0, belt + 0.6, -0.2, 0.2); // barrel roof
      // Pontoon fenders over each wheel.
      for (const sx of [1, -1]) {
        for (const sz of [1, -1]) {
          box(body, 0.42, 0.6, 1.3, sx * (halfW - 0.14), 0.6, sz * 1.5, 0.16);
        }
        // Running boards between the fenders.
        box(body, 0.3, 0.08, 1.8, sx * (halfW - 0.03), 0.4, 0, 0.03);
      }
      // Headlamp pods and hood ornament.
      for (const sx of [1, -1]) {
        box(body, 0.2, 0.22, 0.3, sx * 0.6, 0.98, L / 2 - 0.28, 0.07);
      }
      box(body, 0.05, 0.14, 0.18, 0, 1.34, 2.0, 0.03);
      break;
    }
    case 'streetcar': {
      box(body, W, 2.3, L, 0, 1.55, 0, 0.3); // rounded streamline body
      box(body, W - 0.2, 0.55, L - 0.4, 0, 0.5, 0, 0.1); // skirt / truck cover
      box(glass, W + 0.04, 0.8, L - 1.6, 0, 2.1, 0, 0.05); // window band
      box(body, W - 0.3, 0.3, L - 0.6, 0, 2.7, 0, 0.14); // clerestory roof
      // Pantograph mast + contact bar.
      cyl(body, 0.05, 1.0, 0, 3.15, 1.5, 'y');
      box(body, 1.3, 0.06, 0.06, 0, 3.6, 1.5, 0.02);
      // Nose destination boards.
      box(glass, 1.2, 0.3, 0.08, 0, 2.35, L / 2 - 0.06, 0.02);
      box(glass, 1.2, 0.3, 0.08, 0, 2.35, -(L / 2 - 0.06), 0.02);
      break;
    }
    case 'deliverytruck': {
      box(body, W, 1.5, L - 1.9, 0, 1.4, -0.9, 0.1); // tall cargo box
      box(body, W - 0.5, 0.9, 1.7, 0, 1.05, 1.55, 0.16); // rounded cab
      box(body, W - 0.7, 0.5, 1.5, 0, 0.85, 2.4, 0.18); // exposed hood
      box(glass, W - 0.55, 0.42, 0.1, 0, 1.35, 2.35, 0.03); // split windshield
      for (const sx of [1, -1]) {
        box(body, 0.4, 0.55, 1.2, sx * (halfW - 0.14), 0.6, 1.8, 0.16);
        box(body, 0.4, 0.55, 1.2, sx * (halfW - 0.14), 0.6, -1.5, 0.16);
      }
      break;
    }

    /* ------------------------------------------------------------ 1965 */
    case 'chromesedan':
    case 'wagon': {
      const wagon = def.id === 'wagon';
      const belt = 1.0;
      box(body, W, 0.68, L, 0, 0.62, 0, 0.1); // long flat slab
      box(body, W - 0.2, 0.26, 2.1, 0, 1.0, 1.55, 0.07); // hood plane
      box(body, W - 0.2, 0.26, wagon ? 1.2 : 1.5, 0, 1.0, wagon ? -1.95 : -1.85, 0.07);
      // Tailfins.
      for (const sx of [1, -1]) {
        box(body, 0.28, 0.24, 1.4, sx * (halfW - 0.1), 1.14, -2.0, 0.06);
      }
      const cabinDepth = wagon ? 3.7 : 2.55;
      const cabinZ = wagon ? -0.55 : -0.2;
      box(glass, W - 0.26, 0.4, cabinDepth, 0, belt + 0.25, cabinZ, 0.04);
      box(body, W - 0.3, 0.26, cabinDepth + 0.1, 0, belt + 0.58, cabinZ, 0.1); // flat roof
      if (!wagon) {
        box(body, W - 0.5, 0.3, 0.9, 0, 1.1, -2.35, 0.1); // trunk deck
      }
      break;
    }
    case 'citybus': {
      box(body, W, 1.95, L, 0, 1.4, 0, 0.1); // full-depth body
      box(body, W - 0.1, 0.55, L, 0, 0.5, 0, 0.06); // skirt
      box(body, W - 0.15, 0.3, L - 0.3, 0, 2.5, 0, 0.12); // roof cap
      box(glass, W + 0.04, 0.75, L - 2.4, 0, 1.95, 0.3, 0.04); // side window band
      box(glass, W - 0.3, 0.8, 0.12, 0, 1.85, L / 2 - 0.08, 0.02); // windshield
      box(glass, W - 0.3, 0.7, 0.12, 0, 1.85, -(L / 2 - 0.08), 0.02); // rear glass
      box(glass, 1.5, 0.3, 0.1, 0, 2.35, L / 2 - 0.06, 0.02); // destination sign
      // Standee poles above the window band.
      for (const sx of [1, -1]) {
        box(body, 0.06, 0.2, L - 1.2, sx * (halfW + 0.01), 2.4, 0, 0.02);
      }
      break;
    }
    case 'musclecar': {
      box(body, W, 0.64, L, 0, 0.6, 0, 0.07); // low slab
      box(body, W - 0.25, 0.24, 1.9, 0, 1.0, 1.6, 0.06);
      box(body, 0.85, 0.16, 1.1, 0, 1.15, 1.5, 0.05); // hood scoop
      box(glass, W - 0.3, 0.4, 2.1, 0, 1.18, -0.15, 0.05); // fastback glass
      box(body, W - 0.34, 0.2, 1.7, 0, 1.44, -0.5, 0.09); // fastback roof
      box(body, W - 0.3, 0.22, 1.4, 0, 1.0, -1.95, 0.06); // raised rear deck
      break;
    }

    /* ------------------------------------------------------------ 1985 */
    case 'boxcoupe':
    case 'importcompact': {
      const short = def.id === 'importcompact';
      box(body, W, 0.66, L, 0, 0.6, 0, 0.03); // folded-paper slab
      box(body, W - 0.12, 0.2, short ? 1.3 : 1.5, 0, 1.0, 1.4, 0.03);
      box(body, W - 0.12, 0.2, short ? 1.0 : 1.2, 0, 1.0, -1.6, 0.03);
      box(glass, W - 0.14, 0.46, short ? 1.9 : 2.1, 0, 1.3, -0.1, 0.03); // upright glass
      box(body, W - 0.2, 0.18, (short ? 1.9 : 2.1) + 0.1, 0, 1.62, -0.1, 0.04); // flat roof
      break;
    }
    case 'hatchback': {
      box(body, W, 0.66, L, 0, 0.6, 0, 0.03);
      box(body, W - 0.12, 0.2, 1.3, 0, 1.0, 1.35, 0.03);
      box(glass, W - 0.14, 0.5, 2.1, 0, 1.32, -0.4, 0.03); // long two-box cabin
      box(glass, W - 0.3, 0.5, 0.1, 0, 1.3, -(L / 2 - 0.25), 0.03); // upright hatch
      box(body, W - 0.2, 0.18, 2.0, 0, 1.64, -0.4, 0.04);
      break;
    }
    case 'panelvan': {
      box(body, W, 1.6, L, 0, 1.2, -0.2, 0.05); // slab cargo volume
      box(body, W - 0.1, 0.4, L - 0.3, 0, 2.1, -0.2, 0.06); // roof
      box(body, W - 0.2, 0.5, 1.6, 0, 1.0, 1.9, 0.06); // hood step
      box(glass, W - 0.24, 0.5, 0.1, 0, 1.55, L / 2 - 1.1, 0.02); // windshield
      box(glass, W + 0.04, 0.45, 1.5, 0, 1.6, 1.1, 0.02); // cab side glass
      box(glass, 1.6, 0.5, 0.08, 0, 1.6, -(L / 2 - 0.1), 0.02); // rear door glass
      break;
    }

    /* ------------------------------------------------------------ 2005 */
    case 'suv': {
      box(body, W, 0.85, L, 0, 0.8, 0, 0.09); // tall lower body
      box(body, W - 0.2, 0.35, 1.6, 0, 1.25, 1.6, 0.08); // hood
      box(glass, W - 0.16, 0.6, 3.0, 0, 1.55, -0.2, 0.06); // boxy greenhouse
      box(body, W - 0.26, 0.22, 3.1, 0, 1.9, -0.2, 0.09); // roof
      for (const sx of [1, -1]) {
        box(body, 0.07, 0.07, 2.4, sx * (halfW - 0.35), 2.04, -0.2, 0.02); // roof rails
      }
      break;
    }
    case 'compact':
    case 'taxi': {
      const taxi = def.id === 'taxi';
      box(body, W, 0.7, L, 0, 0.62, 0, 0.12); // aero rounded slab
      box(body, W - 0.2, 0.24, 1.5, 0, 1.05, 1.5, 0.1);
      box(glass, W - 0.2, 0.46, taxi ? 2.3 : 2.2, 0, 1.32, -0.15, 0.08);
      box(body, W - 0.28, 0.22, taxi ? 2.4 : 2.3, 0, 1.6, -0.15, 0.12);
      if (taxi) {
        box(body, 0.72, 0.18, 0.3, 0, 1.8, 0.3, 0.04); // roof sign
        box(body, W + 0.02, 0.3, 1.6, 0, 0.9, -0.1, 0.03); // door chevron band
      }
      break;
    }
    case 'bicycle': {
      // Step-through frame, fenders and rack; the big thin wheels carry the
      // silhouette from the shared wheel pools.
      box(body, 0.06, 0.06, 1.0, 0, 0.6, -0.05, 0.01);
      box(body, 0.06, 0.5, 0.08, 0, 0.62, 0.35, 0.01);
      box(body, 0.06, 0.4, 0.08, 0, 0.6, -0.35, 0.01);
      box(body, 0.5, 0.05, 0.05, 0, 1.0, 0.5, 0.01); // handlebar
      box(body, 0.2, 0.07, 0.3, 0, 0.86, -0.3, 0.02); // saddle
      box(body, 0.22, 0.03, 0.4, 0, 0.42, -0.5, 0.01); // rear rack
      cyl(body, 0.05, 0.9, 0, 0.4, 0.05, 'z'); // fender arc stand-in
      break;
    }

    /* ------------------------------------------------------------ 2025 */
    case 'evsedan':
    case 'robotaxi': {
      const robotaxi = def.id === 'robotaxi';
      box(body, W, 0.72, L, 0, 0.68, 0, 0.17); // smooth aero lower body
      box(body, W - 0.1, 0.3, 1.7, 0, 1.1, 1.6, 0.15); // grille-less nose
      box(glass, W - 0.22, 0.46, 2.6, 0, 1.34, -0.1, 0.12); // flush canopy glass
      box(body, W - 0.3, 0.24, 2.4, 0, 1.64, -0.15, 0.15); // domed roof
      box(body, W - 0.4, 0.2, 1.1, 0, 1.08, -1.9, 0.12); // fast tail deck
      if (robotaxi) {
        // Roof lidar pod + sensor domes.
        box(body, 0.55, 0.16, 0.5, 0, 1.84, 0.55, 0.05);
        cyl(body, 0.15, 0.3, 0, 2.0, 0.55, 'y');
        for (const sx of [1, -1]) {
          cyl(body, 0.07, 0.14, sx * (halfW - 0.2), 1.3, 1.9, 'y');
        }
      }
      break;
    }
    case 'scooter': {
      box(body, 0.3, 0.09, 0.95, 0, 0.3, -0.1, 0.03); // deck
      box(body, 0.07, 0.85, 0.07, 0, 0.72, 0.42, 0.02); // stem (slight rake reads as a scooter)
      box(body, 0.46, 0.06, 0.06, 0, 1.16, 0.46, 0.02); // bar
      box(body, 0.16, 0.22, 0.06, 0, 1.02, 0.5, 0.02); // display
      box(body, 0.24, 0.16, 0.5, 0, 0.42, -0.15, 0.04); // battery under deck
      break;
    }
    case 'ebike': {
      box(body, 0.07, 0.07, 1.0, 0, 0.6, -0.05, 0.01);
      box(body, 0.07, 0.5, 0.09, 0, 0.62, 0.35, 0.01);
      box(body, 0.1, 0.24, 0.5, 0, 0.55, 0.0, 0.03); // integrated battery
      box(body, 0.5, 0.05, 0.05, 0, 1.02, 0.52, 0.01); // bar
      box(body, 0.2, 0.07, 0.3, 0, 0.88, -0.3, 0.02); // saddle
      cyl(body, 0.09, 0.16, 0, 0.6, -0.62, 'x'); // hub motor block
      break;
    }
  }

  return { body, glass };
}

/** Get (and cache) merged geometry assets for a vehicle kind. */
export function getKindAssets(kindId: VehicleKindId): VehicleKindAssets {
  const cached = kindAssetCache.get(kindId);
  if (cached) return cached;
  const def = VEHICLE_KINDS[kindId];
  const parts = buildKindParts(def);
  const body = merge(parts.body);
  if (!body) throw new Error(`Vehicle kind ${kindId} produced no body geometry`);
  const glass = merge(parts.glass);
  const assets: VehicleKindAssets = { body, glass };
  kindAssetCache.set(kindId, assets);
  return assets;
}

/** Dispose every cached kind geometry (full module teardown / test cleanup). */
export function disposeVehicleAssets(): void {
  for (const assets of kindAssetCache.values()) {
    assets.body.dispose();
    assets.glass?.dispose();
  }
  kindAssetCache.clear();
}

/* -------------------------------------------------------------------------- */
/* Materials                                                                  */
/* -------------------------------------------------------------------------- */

const eraGlassCache = new Map<FleetEra, THREE.MeshStandardMaterial>();
const eraTireCache = new Map<FleetEra, THREE.MeshStandardMaterial>();

/** Era glass material from the shared procedural gfx library (cached). */
export function eraGlassMaterial(era: FleetEra): THREE.MeshStandardMaterial {
  let material = eraGlassCache.get(era);
  if (!material) {
    material = ProceduralGfxLibrary.createEraMaterial('glass', era, { roughness: 0.12 });
    eraGlassCache.set(era, material);
  }
  return material;
}

/** Era tire rubber from the shared procedural gfx library (cached). */
function eraTireMaterial(era: FleetEra): THREE.MeshStandardMaterial {
  let material = eraTireCache.get(era);
  if (!material) {
    material = ProceduralGfxLibrary.createEraMaterial('asphaltStone', era, {
      roughness: 0.95,
      metalness: 0.0,
      seed: era + 7,
    });
    eraTireCache.set(era, material);
  }
  return material;
}

/** Shared white-base trim material; per-instance color gives chrome/plastic. */
function createTrimMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.85,
    roughness: 0.22,
  });
}

/** Shared hubcap/whitewall material; per-instance color differentiates eras. */
function createHubMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.6,
    roughness: 0.35,
  });
}

function createLampMaterial(color: number, emissive: number, intensity: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.3,
    metalness: 0.1,
  });
}

/* -------------------------------------------------------------------------- */
/* Fleet view                                                                 */
/* -------------------------------------------------------------------------- */

/** One slot's resolved visual state, produced by the traffic system. */
export interface VehicleVisualState {
  slotId: string;
  kindId: VehicleKindId | null;
  variantScale: number;
  paint: string;
  x: number;
  z: number;
  yaw: number;
  wheelSpin: number;
  headlights: boolean;
  taillights: boolean;
  braking: boolean;
  active: boolean;
}

interface SlotView {
  readonly group: THREE.Group;
  readonly body: THREE.Mesh;
  readonly glass: THREE.Mesh;
  readonly paintMaterial: THREE.MeshStandardMaterial;
  kindId: VehicleKindId | null;
}

const TRIM_PER_SLOT = 5; // bumper front, bumper rear, grille, side L, side R

/** Scratch matrices for instanced pool composition. */
const BASE_MATRIX = new THREE.Matrix4();
const LOCAL_MATRIX = new THREE.Matrix4();

/** Compose T(x,0,z) * Ry(yaw) * T(local*scale) * Rx(spin) * S(partScale*scale). */
function composePart(
  x: number,
  z: number,
  yaw: number,
  scale: number,
  local: readonly [number, number, number],
  spin: number,
  partScale: readonly [number, number, number],
): THREE.Matrix4 {
  BASE_MATRIX.makeRotationY(yaw);
  BASE_MATRIX.setPosition(x, ROAD_SURFACE_Y, z);
  LOCAL_MATRIX.makeTranslation(local[0] * scale, local[1] * scale, local[2] * scale);
  BASE_MATRIX.multiply(LOCAL_MATRIX);
  if (spin !== 0) {
    LOCAL_MATRIX.makeRotationX(spin);
    BASE_MATRIX.multiply(LOCAL_MATRIX);
  }
  LOCAL_MATRIX.makeScale(partScale[0] * scale, partScale[1] * scale, partScale[2] * scale);
  BASE_MATRIX.multiply(LOCAL_MATRIX);
  return BASE_MATRIX;
}

/**
 * Renders every traffic slot: a body + glass pair per slot (materials and
 * geometry swapped by era variant) plus shared instanced pools for wheels,
 * hubcaps, bumpers/trim, and head/tail/brake lamps. Pools are sized from the
 * slot count so draw calls stay flat as eras swap.
 */
export class FleetView {
  readonly group: THREE.Group;

  readonly #slotIds: readonly string[];
  readonly #slots = new Map<string, SlotView>();

  readonly #wheelPool: THREE.InstancedMesh;
  readonly #hubPool: THREE.InstancedMesh;
  readonly #trimPool: THREE.InstancedMesh;
  readonly #headPool: THREE.InstancedMesh;
  readonly #tailPool: THREE.InstancedMesh;
  readonly #brakePool: THREE.InstancedMesh;

  readonly #trimMaterial: THREE.MeshStandardMaterial;
  readonly #hubMaterial: THREE.MeshStandardMaterial;
  readonly #headMaterial: THREE.MeshStandardMaterial;
  readonly #tailMaterial: THREE.MeshStandardMaterial;
  readonly #brakeMaterial: THREE.MeshStandardMaterial;
  readonly #tireMaterials = new Map<FleetEra, THREE.MeshStandardMaterial>();
  readonly #paintMaterials: THREE.MeshStandardMaterial[] = [];
  readonly #poolGeometries: THREE.BufferGeometry[] = [];

  constructor(slotIds: readonly string[]) {
    this.#slotIds = [...slotIds];
    this.group = new THREE.Group();
    this.group.name = 'vehicles';

    const n = this.#slotIds.length;

    // Wheel + hub pools: unit cylinders with the axle along X so instances
    // only need a spin rotation around X.
    const tireGeometry = new THREE.CylinderGeometry(1, 1, 1, 16, 1);
    tireGeometry.rotateZ(Math.PI / 2);
    const hubGeometry = new THREE.CylinderGeometry(1, 1, 1, 14, 1);
    hubGeometry.rotateZ(Math.PI / 2);
    this.#poolGeometries.push(tireGeometry, hubGeometry);

    // Trim: unit beveled bar; per-instance scale makes bumpers/grilles/spears.
    const trimGeometry = ProceduralGfxLibrary.createBeveledBoxGeometry({
      width: 1,
      height: 1,
      depth: 1,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    // Lamps: pair of small boxes at x = +/-0.5; instance X scale sets spacing.
    const lampA = ProceduralGfxLibrary.createBeveledBoxGeometry({
      width: 0.34,
      height: 1,
      depth: 1,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    lampA.translate(-0.5, 0, 0);
    const lampB = lampA.clone();
    lampB.translate(1, 0, 0);
    const lampPair = ProceduralGfxLibrary.mergeBufferGeometries([lampA, lampB]);
    lampA.dispose();
    lampB.dispose();
    this.#poolGeometries.push(trimGeometry, lampPair);

    this.#trimMaterial = createTrimMaterial();
    this.#hubMaterial = createHubMaterial();
    this.#headMaterial = createLampMaterial(0xfff4d6, 0xffe9b8, 2.4);
    this.#tailMaterial = createLampMaterial(0xd2352a, 0xb01d12, 0.9);
    this.#brakeMaterial = createLampMaterial(0xff3b2e, 0xff1f10, 3.0);

    this.#wheelPool = ProceduralGfxLibrary.createInstancedMesh({
      geometry: tireGeometry,
      material: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0 }),
      count: n * 4,
      name: 'vehicleWheels',
      dynamic: true,
      colors: false,
    });
    this.#hubPool = ProceduralGfxLibrary.createInstancedMesh({
      geometry: hubGeometry,
      material: this.#hubMaterial,
      count: n * 4,
      name: 'vehicleHubs',
      dynamic: true,
      colors: true,
    });
    this.#trimPool = ProceduralGfxLibrary.createInstancedMesh({
      geometry: trimGeometry,
      material: this.#trimMaterial,
      count: n * TRIM_PER_SLOT,
      name: 'vehicleTrim',
      dynamic: true,
      colors: true,
    });
    this.#headPool = ProceduralGfxLibrary.createInstancedMesh({
      geometry: lampPair,
      material: this.#headMaterial,
      count: n,
      name: 'vehicleHeadlamps',
      dynamic: true,
      colors: false,
    });
    this.#tailPool = ProceduralGfxLibrary.createInstancedMesh({
      geometry: lampPair,
      material: this.#tailMaterial,
      count: n,
      name: 'vehicleTaillamps',
      dynamic: true,
      colors: false,
    });
    this.#brakePool = ProceduralGfxLibrary.createInstancedMesh({
      geometry: lampPair,
      material: this.#brakeMaterial,
      count: n,
      name: 'vehicleBrakelamps',
      dynamic: true,
      colors: false,
    });

    // Hide every instance until the first sync places real vehicles.
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.#wheelPool.count; i++) this.#wheelPool.setMatrixAt(i, hidden);
    for (let i = 0; i < this.#hubPool.count; i++) this.#hubPool.setMatrixAt(i, hidden);
    for (let i = 0; i < this.#trimPool.count; i++) this.#trimPool.setMatrixAt(i, hidden);
    for (let i = 0; i < this.#headPool.count; i++) this.#headPool.setMatrixAt(i, hidden);
    for (let i = 0; i < this.#tailPool.count; i++) this.#tailPool.setMatrixAt(i, hidden);
    for (let i = 0; i < this.#brakePool.count; i++) this.#brakePool.setMatrixAt(i, hidden);

    this.group.add(this.#wheelPool, this.#hubPool, this.#trimPool, this.#headPool, this.#tailPool, this.#brakePool);

    for (const slotId of this.#slotIds) {
      const paintMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.34,
        metalness: 0.3,
      });
      this.#paintMaterials.push(paintMaterial);
      const body = new THREE.Mesh(new THREE.BufferGeometry(), paintMaterial);
      body.name = `${slotId}-body`;
      body.castShadow = true;
      body.receiveShadow = true;
      const glass = new THREE.Mesh(new THREE.BufferGeometry(), eraGlassMaterial(1945));
      glass.name = `${slotId}-glass`;
      glass.castShadow = false;
      glass.receiveShadow = false;
      const group = new THREE.Group();
      group.name = slotId;
      group.add(body, glass);
      group.userData.vehicleKind = '';
      body.userData.slotId = slotId;
      glass.userData.slotId = slotId;
      this.group.add(group);
      this.#slots.set(slotId, { group, body, glass, paintMaterial, kindId: null });
    }
  }

  /** Group object for a slot (pickable raycast target). */
  slotGroup(slotId: string): THREE.Object3D | undefined {
    return this.#slots.get(slotId)?.group;
  }

  /** Number of child meshes in the view (draw-call budget checks). */
  meshCount(): number {
    let count = 0;
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) count += 1;
    });
    return count;
  }

  /** Push resolved slot states into the scene graph and instanced pools. */
  sync(states: readonly VehicleVisualState[]): void {
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

    let wheelIndex = 0;
    let trimIndex = 0;
    let headIndex = 0;
    let tailIndex = 0;
    let brakeIndex = 0;

    // Pools are ordered by slot order; states must arrive in slot order.
    for (const state of states) {
      const slotView = this.#slots.get(state.slotId);
      if (!slotView) continue;
      const def = state.kindId ? VEHICLE_KINDS[state.kindId] : null;
      const visible = state.active && def !== null && state.variantScale > 1e-4;
      const s = visible ? state.variantScale : 0;

      // Body + glass for this slot.
      slotView.group.visible = visible;
      slotView.group.position.set(state.x, ROAD_SURFACE_Y, state.z);
      slotView.group.rotation.y = state.yaw;
      slotView.group.scale.setScalar(Math.max(s, 1e-4));
      slotView.group.userData.vehicleKind = state.kindId ?? '';
      if (def && slotView.kindId !== state.kindId) {
        const assets = getKindAssets(def.id);
        slotView.body.geometry = assets.body;
        if (assets.glass) {
          slotView.glass.geometry = assets.glass;
          slotView.glass.visible = true;
          slotView.glass.material = eraGlassMaterial(def.era);
        } else {
          slotView.glass.visible = false;
        }
        // One visible era at a time: retarget the shared tire pool material.
        this.#wheelPool.material = this.#tire(def.era);
        slotView.kindId = state.kindId;
      }
      slotView.paintMaterial.color.set(state.paint);
      slotView.body.userData.vehicleKind = state.kindId ?? '';
      slotView.glass.userData.vehicleKind = state.kindId ?? '';

      if (!def) {
        // Hidden era: zero every pool slot this car owns.
        slotView.kindId = null;
        for (let w = 0; w < 4; w++) {
          this.#wheelPool.setMatrixAt(wheelIndex++, hidden);
          this.#hubPool.setMatrixAt(wheelIndex - 1, hidden);
        }
        for (let t = 0; t < TRIM_PER_SLOT; t++) this.#trimPool.setMatrixAt(trimIndex++, hidden);
        this.#headPool.setMatrixAt(headIndex++, hidden);
        this.#tailPool.setMatrixAt(tailIndex++, hidden);
        this.#brakePool.setMatrixAt(brakeIndex++, hidden);
        continue;
      }

      // Wheels (4 per vehicle) + hubcaps on the outer faces.
      const halfTrack = def.track / 2;
      const hubRadius = def.whitewall ? def.wheelRadius * 0.74 : def.wheelRadius * 0.55;
      const hubColor = def.whitewall ? '#efe9d6' : '#a9aeb3';
      for (const sx of [1, -1]) {
        for (const axle of [def.axleFront, def.axleRear]) {
          const wheelLocal: readonly [number, number, number] = [
            sx * halfTrack,
            def.wheelRadius,
            axle,
          ];
          this.#wheelPool.setMatrixAt(
            wheelIndex,
            composePart(state.x, state.z, state.yaw, s, wheelLocal, state.wheelSpin, [
              def.wheelWidth,
              def.wheelRadius,
              def.wheelRadius,
            ]),
          );
          const hubLocal: readonly [number, number, number] = [
            sx * (halfTrack + def.wheelWidth * 0.55),
            def.wheelRadius,
            axle,
          ];
          this.#hubPool.setMatrixAt(
            wheelIndex,
            composePart(state.x, state.z, state.yaw, s, hubLocal, state.wheelSpin, [
              0.05,
              hubRadius,
              hubRadius,
            ]),
          );
          ProceduralGfxLibrary.setInstanceColor(this.#hubPool, wheelIndex, hubColor);
          wheelIndex += 1;
        }
      }

      // Trim pool: front bumper, rear bumper, grille, side spears.
      const trimColorHex = trimColor(def.trim);
      const noseZ = def.length / 2 + 0.04;
      if (def.bumper) {
        this.#trimPool.setMatrixAt(
          trimIndex,
          composePart(state.x, state.z, state.yaw, s, [0, def.bumper.y, noseZ], 0, [
            def.width * 0.96,
            def.bumper.height,
            0.22,
          ]),
        );
        ProceduralGfxLibrary.setInstanceColor(this.#trimPool, trimIndex, trimColorHex);
        this.#trimPool.setMatrixAt(
          trimIndex + 1,
          composePart(state.x, state.z, state.yaw, s, [0, def.bumper.y, -noseZ], 0, [
            def.width * 0.96,
            def.bumper.height,
            0.22,
          ]),
        );
        ProceduralGfxLibrary.setInstanceColor(this.#trimPool, trimIndex + 1, trimColorHex);
      } else {
        this.#trimPool.setMatrixAt(trimIndex, hidden);
        this.#trimPool.setMatrixAt(trimIndex + 1, hidden);
      }
      if (def.grille) {
        this.#trimPool.setMatrixAt(
          trimIndex + 2,
          composePart(state.x, state.z, state.yaw, s, [0, def.grille.y, def.length / 2 - 0.02], 0, [
            def.grille.spread,
            def.grille.height,
            0.1,
          ]),
        );
        ProceduralGfxLibrary.setInstanceColor(this.#trimPool, trimIndex + 2, trimColorHex);
      } else {
        this.#trimPool.setMatrixAt(trimIndex + 2, hidden);
      }
      for (const side of [0, 1] as const) {
        const localIndex = trimIndex + 3 + side;
        if (def.sideTrim) {
          const sx = side === 0 ? 1 : -1;
          this.#trimPool.setMatrixAt(
            localIndex,
            composePart(
              state.x,
              state.z,
              state.yaw,
              s,
              [sx * (def.width / 2 + 0.015), def.sideTrim.y, def.sideTrim.z],
              0,
              [0.05, 0.1, def.sideTrim.length],
            ),
          );
          ProceduralGfxLibrary.setInstanceColor(this.#trimPool, localIndex, trimColorHex);
        } else {
          this.#trimPool.setMatrixAt(localIndex, hidden);
        }
      }
      trimIndex += TRIM_PER_SLOT;

      // Lamps: head pair, tail pair, brake pair (inner spacing).
      const frontZ = def.length / 2 - 0.08;
      if (state.headlights) {
        this.#headPool.setMatrixAt(
          headIndex,
          composePart(state.x, state.z, state.yaw, s, [0, def.headLamp.y, frontZ], 0, [
            def.headLamp.spread,
            0.17,
            0.14,
          ]),
        );
      } else {
        this.#headPool.setMatrixAt(headIndex, hidden);
      }
      headIndex += 1;

      const rearZ = -(def.length / 2 - 0.08);
      if (state.taillights) {
        this.#tailPool.setMatrixAt(
          tailIndex,
          composePart(state.x, state.z, state.yaw, s, [0, def.tailLamp.y, rearZ], 0, [
            def.tailLamp.spread,
            0.15,
            0.12,
          ]),
        );
      } else {
        this.#tailPool.setMatrixAt(tailIndex, hidden);
      }
      tailIndex += 1;

      if (state.braking && state.headlights) {
        this.#brakePool.setMatrixAt(
          brakeIndex,
          composePart(
            state.x,
            state.z,
            state.yaw,
            s,
            [0, def.brakeLamp.y, -(def.length / 2 - 0.045)],
            0,
            [def.brakeLamp.spread, 0.13, 0.1],
          ),
        );
      } else {
        this.#brakePool.setMatrixAt(brakeIndex, hidden);
      }
      brakeIndex += 1;
    }

    // Zero any unused pool capacity (defensive: slot counts always match).
    for (let i = wheelIndex; i < this.#wheelPool.count; i++) this.#wheelPool.setMatrixAt(i, hidden);
    for (let i = trimIndex; i < this.#trimPool.count; i++) this.#trimPool.setMatrixAt(i, hidden);
    for (let i = headIndex; i < this.#headPool.count; i++) this.#headPool.setMatrixAt(i, hidden);
    for (let i = tailIndex; i < this.#tailPool.count; i++) this.#tailPool.setMatrixAt(i, hidden);
    for (let i = brakeIndex; i < this.#brakePool.count; i++) this.#brakePool.setMatrixAt(i, hidden);

    this.#wheelPool.instanceMatrix.needsUpdate = true;
    this.#hubPool.instanceMatrix.needsUpdate = true;
    if (this.#hubPool.instanceColor) this.#hubPool.instanceColor.needsUpdate = true;
    this.#trimPool.instanceMatrix.needsUpdate = true;
    if (this.#trimPool.instanceColor) this.#trimPool.instanceColor.needsUpdate = true;
    this.#headPool.instanceMatrix.needsUpdate = true;
    this.#tailPool.instanceMatrix.needsUpdate = true;
    this.#brakePool.instanceMatrix.needsUpdate = true;
  }

  #tire(era: FleetEra): THREE.MeshStandardMaterial {
    let material = this.#tireMaterials.get(era);
    if (!material) {
      material = eraTireMaterial(era);
      this.#tireMaterials.set(era, material);
    }
    return material;
  }

  /** Release materials, slot groups, and pools (shared kind assets persist). */
  dispose(): void {
    for (const slotView of this.#slots.values()) {
      slotView.paintMaterial.dispose();
      this.group.remove(slotView.group);
      slotView.group.clear();
    }
    this.#slots.clear();
    for (const geometry of this.#poolGeometries) geometry.dispose();
    this.#poolGeometries.length = 0;
    this.#trimMaterial.dispose();
    this.#hubMaterial.dispose();
    this.#headMaterial.dispose();
    this.#tailMaterial.dispose();
    this.#brakeMaterial.dispose();
    for (const material of this.#paintMaterials) material.dispose();
    this.#paintMaterials.length = 0;
    for (const pool of [this.#wheelPool, this.#hubPool, this.#trimPool, this.#headPool, this.#tailPool, this.#brakePool]) {
      pool.geometry.dispose();
      (pool.material as THREE.Material).dispose();
      this.group.remove(pool);
    }
    this.group.clear();
  }
}
