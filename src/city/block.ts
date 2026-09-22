/**
 * City block assembly — composes every declared module into one coherent
 * block corner and owns the integrated experience.
 *
 * Layout contract (all coordinates world-space):
 *
 * - The shared slot constants treat the two street centerlines as x = 0 and
 *   z = 0: roads span ±6, sidewalks span 6..9, the building frontage line is
 *   at ±9 (`FRONTAGE_LINE`), driving lanes sit at ±3, and the crowd walk
 *   lanes sit at ±7.5 (curb 6 + walk-lane inset 1.5). Buildings, vehicles,
 *   pedestrians, and storefront bays are all authored against that frame.
 * - The street module authors its road quads in [-12, 0] on both axes — the
 *   identical geometry translated by −half-street. Rather than editing the
 *   owning module, the assembly translates `street.root` by
 *   `STREET_ORIGIN_OFFSET` (+6, +6), which lands its sidewalks exactly
 *   against the building frontage lines, its lamps on the 6-unit bay grid,
 *   and its walk lanes under the crowd lanes. One translation, zero module
 *   edits, no gaps between street and buildings.
 * - Storefront rows are derived from the real building bay descriptors:
 *   bays are grouped by facing + frontage line, split into contiguous
 *   6-pitch runs, and one `StorefrontsModule` is mounted per run using a
 *   rigid group transform (`position` + `rotationY`) resolved from the row's
 *   facing. Every authored bay therefore receives signage, displays, and
 *   shopfront interiors that track the facade.
 *
 * Era wiring: every module registers into the shared `EraTransformRegistry`
 * (facade → signage → fleet → crowd → lights); the `sound` stage is owned by
 * the audio director through its shared-core subscription, bridged by
 * `connectAudio`. `driver.sync()` runs at construction so the whole block
 * starts consistent with the timeline's first stop.
 *
 * Click-to-focus: `pickables` merges descriptors from buildings, every
 * storefront row, the vehicle fleet, street hero props, and the crowd, with
 * stable namespaced ids, and `calloutProvider` resolves them to era-aware
 * copy from the content modules at click time.
 *
 * Draw-prep polish: after the initial frame sync the rigid skeleton (block
 * root, street root, buildings container, storefront row groups) has its
 * local matrices frozen, so per-frame matrix work is spent only on the
 * animated instanced batches (fleet, crowd, weather) — instancing, batching,
 * and authored detail stay untouched.
 */

import * as THREE from 'three';
import {
  type CalloutContentProvider,
  type NavigationBounds,
  type PickableDescriptor,
} from '../controls/navigation';
import type { EraMorphSystem } from '../era/contracts';
import { ProceduralGfxLibrary } from '../gfx/materials';
import {
  BLOCK_ALIGNMENT,
  createBuildingsModule,
  type BuildingPickDescriptor,
  type BuildingsModule,
  type StorefrontBay,
} from './buildings/index';
import { createEraCalloutProvider } from './callouts-content';
import { createAtmosphere, type CreateAtmosphereOptions, type AtmosphereModule } from '../env/atmosphere';
import { createPedestriansModule, type PedestriansModule } from './pedestrians/index';
import { createStreetPropsModule, STREET_LAYOUT, type StreetPropsModule } from './street/index';
import {
  createStorefrontsModule,
  STOREFRONT_AUDIO_HOOKS,
  type StorefrontAudioHook,
  type StorefrontsModule,
} from './storefronts/index';
import { createVehiclesModule, type VehiclesModule } from './vehicles/index';
import type { AudioHookEventName } from '../audio/hooks';
import type { AudioDirector } from '../audio/director';

/* -------------------------------------------------------------------------- */
/* Layout constants derived from the shared slot constants                     */
/* -------------------------------------------------------------------------- */

/**
 * Translation applied to the street module's root so its authored road quads
 * ([-12, 0] on both axes) land on the shared centerline frame (±6 roads,
 * 6..9 sidewalks, ±9 frontage). Exactly `streetWidth / 2` on x and z.
 */
export const STREET_ORIGIN_OFFSET: Readonly<{ x: number; z: number }> = Object.freeze({
  x: BLOCK_ALIGNMENT.streetWidth / 2,
  z: BLOCK_ALIGNMENT.streetWidth / 2,
});

/**
 * Half-length of the traffic loops. The translated main road ends at ±42 on
 * x and z; a loop's 180° U-turn bulge extends `radius` (3) past the loop end,
 * so 38 + 3 = 41 stays on the asphalt with a unit of margin.
 */
export const TRAFFIC_STREET_HALF_LENGTH = 38;

/** Crowd curb distance: the shared street half-width (walk lanes at ±7.5). */
export const CROWD_CURB_Z = BLOCK_ALIGNMENT.streetWidth / 2;

/** X of the crowd's two crosswalk segments (mid-block, inside the road ends). */
export const CROWD_CROSSING_X = 36;

/* -------------------------------------------------------------------------- */
/* Storefront row resolution                                                    */
/* -------------------------------------------------------------------------- */

/** Outward facing of a frontage. */
type BlockFacing = 'north' | 'south' | 'east' | 'west';

/** One resolved storefront row: the rigid transform for one module instance. */
export interface StorefrontRow {
  /** Stable id, e.g. `south-line-9-run-0` (used to namespace pickable ids). */
  readonly id: string;
  /** Outward facing shared by every bay on the row. */
  readonly facing: BlockFacing;
  /** Group rotation: 0 faces +Z, π faces −Z, ±π/2 faces ±X (slot convention). */
  readonly rotationY: number;
  /** Group position: the row's first bay (lowest projected coordinate), y = 0. */
  readonly position: THREE.Vector3;
  /** Number of 6-pitch bays — the module's `bays` option. */
  readonly slotCount: number;
  /** Building bay descriptors in module slot order (`position[i] = t + 6i·v`). */
  readonly bays: readonly StorefrontBay[];
  /** World slot centers as the mounted module resolves them (test invariant). */
  readonly slotPositions: readonly THREE.Vector3[];
}

function facingOf(vector: THREE.Vector3): BlockFacing {
  if (vector.z < -0.5) return 'south';
  if (vector.z > 0.5) return 'north';
  if (vector.x < -0.5) return 'west';
  return 'east';
}

const PITCH_EPSILON = 1e-6;

/**
 * Group building bays into contiguous 6-pitch rows and resolve each row's
 * module transform. Throws when a run is not exactly 6-pitch contiguous —
 * a silent misalignment would put shopfronts on piers or inside walls.
 */
export function resolveStorefrontRows(bays: readonly StorefrontBay[]): StorefrontRow[] {
  interface Bucket {
    facing: BlockFacing;
    facingVector: THREE.Vector3;
    line: number;
    items: StorefrontBay[];
  }
  const buckets = new Map<string, Bucket>();

  for (const bay of bays) {
    const facing = facingOf(bay.facing);
    const runsAlongX = facing === 'north' || facing === 'south';
    const line = runsAlongX ? bay.position.z : bay.position.x;
    const key = `${facing}:${line}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.items.push(bay);
    } else {
      buckets.set(key, { facing, facingVector: bay.facing.clone(), line, items: [bay] });
    }
  }

  const rows: StorefrontRow[] = [];
  for (const [key, bucket] of buckets) {
    const rotationY = Math.atan2(bucket.facingVector.x, bucket.facingVector.z);
    const dirX = Math.cos(rotationY);
    const dirZ = -Math.sin(rotationY);
    const projected = (bay: StorefrontBay): number =>
      bay.position.x * dirX + bay.position.z * dirZ;
    const sorted = [...bucket.items].sort((a, b) => projected(a) - projected(b));

    // Split the line into contiguous 6-pitch runs (gaps → separate modules).
    const runs: StorefrontBay[][] = [];
    for (const bay of sorted) {
      const current = runs[runs.length - 1];
      if (!current) {
        runs.push([bay]);
        continue;
      }
      const gap = projected(bay) - projected(current[current.length - 1]);
      if (Math.abs(gap - BLOCK_ALIGNMENT.baySlotPitch) <= PITCH_EPSILON) {
        current.push(bay);
      } else {
        runs.push([bay]);
      }
    }

    runs.forEach((run, runIndex) => {
      const first = run[0];
      const position = new THREE.Vector3(first.position.x, 0, first.position.z);
      const slotPositions = run.map((bay, index) => {
        const expected = new THREE.Vector3(
          position.x + dirX * BLOCK_ALIGNMENT.baySlotPitch * index,
          0,
          position.z + dirZ * BLOCK_ALIGNMENT.baySlotPitch * index,
        );
        if (expected.distanceTo(new THREE.Vector3(bay.position.x, 0, bay.position.z)) > PITCH_EPSILON) {
          throw new Error(
            `Storefront row "${key}" run ${runIndex} is not 6-pitch contiguous at slot ${index} ` +
              `(bay ${bay.bayId} at (${bay.position.x}, ${bay.position.z}) vs expected ` +
              `(${expected.x}, ${expected.z})).`,
          );
        }
        return expected;
      });
      rows.push({
        id: `${key}-run-${runIndex}`,
        facing: bucket.facing,
        rotationY,
        position,
        slotCount: run.length,
        bays: run,
        slotPositions,
      });
    });
  }

  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

/* -------------------------------------------------------------------------- */
/* Audio bridge                                                                 */
/* -------------------------------------------------------------------------- */

/** Storefront hook → documented one-shot (shop sign/ballast/neon/LED character). */
const STOREFRONT_AUDIO_MAP: Readonly<Record<StorefrontAudioHook, AudioHookEventName>> = {
  [STOREFRONT_AUDIO_HOOKS.SIGN_SWAP]: 'door',
  [STOREFRONT_AUDIO_HOOKS.FLUORESCENT_HUM]: 'neon-hum',
  [STOREFRONT_AUDIO_HOOKS.NEON_HUM]: 'neon-hum',
  [STOREFRONT_AUDIO_HOOKS.NEON_FLICKER]: 'neon-hum',
  [STOREFRONT_AUDIO_HOOKS.BACKLIT_BUZZ]: 'neon-hum',
  [STOREFRONT_AUDIO_HOOKS.LED_SCROLL]: 'arcade-bleep',
  [STOREFRONT_AUDIO_HOOKS.LED_TICK]: 'arcade-bleep',
};

/** Street hook → documented one-shot (lamp buzz, booth ring, clanks, chimes). */
const STREET_AUDIO_MAP: Readonly<Record<string, AudioHookEventName>> = {
  'street:lamp:ignite': 'neon-hum',
  'street:lamp:hum': 'neon-hum',
  'street:wire:creak': 'door',
  'street:booth:ring': 'ringtone',
  'street:meter:tick': 'arcade-bleep',
  'street:trash:settle': 'door',
  'street:construction:clank': 'door',
  'street:charger:connect': 'arcade-bleep',
  'street:kiosk:chime': 'ringtone',
};

/* -------------------------------------------------------------------------- */
/* Module                                                                       */
/* -------------------------------------------------------------------------- */

/** Structural subset of `SceneNavigation` used to register pickables. */
export interface PickableRegistry {
  registerPickables(descriptors: readonly PickableDescriptor[]): () => void;
}

/** Construction options for {@link createCityBlock}. */
export interface CityBlockOptions {
  /** Scene the atmosphere attaches to and the block is composed within. */
  scene: THREE.Scene;
  /** Attachment group; defaults to the scene's `cityRoot`, else a new group. */
  cityRoot?: THREE.Group;
  /** Shared wired era system (core + registry + morph driver). */
  eraSystem: EraMorphSystem;
  /** Renderer for the atmosphere grade; omit/null in headless tests. */
  renderer?: THREE.WebGLRenderer | null;
  /** Container for the CSS vignette layer (defaults to the canvas parent). */
  container?: HTMLElement | null;
  /** Atmosphere quality tier (`medium` keeps bloom off the composition loop). */
  quality?: CreateAtmosphereOptions['quality'];
  /** Deterministic seed for procedural jitter. */
  seed?: number;
}

/** A storefront row plus the module mounted on it. */
export interface ComposedStorefrontRow extends StorefrontRow {
  readonly module: StorefrontsModule;
}

/** Imperative handle for the composed block. */
export interface CityBlock {
  readonly root: THREE.Group;
  readonly street: StreetPropsModule;
  readonly buildings: BuildingsModule;
  readonly storefrontRows: readonly ComposedStorefrontRow[];
  readonly vehicles: VehiclesModule;
  readonly crowd: PedestriansModule;
  readonly atmosphere: AtmosphereModule;
  /** Every clickable descriptor (buildings, storefronts, fleet, props, crowd). */
  readonly pickables: readonly PickableDescriptor[];
  /** Era-aware callout provider for the navigation module. */
  readonly calloutContentProvider: CalloutContentProvider;
  /** Register all pickables; returns one unregister function. */
  registerPickables(registry: PickableRegistry): () => void;
  /** Camera bounds covering the whole composed block. */
  navigationBounds(): NavigationBounds;
  /** Advance module animations (crowd, traffic, signage ambience, weather). */
  update(deltaSeconds: number, elapsedSeconds: number, camera?: THREE.Camera | null): void;
  /** Bridge module sound hooks to the audio director's documented bus. */
  connectAudio(director: AudioDirector): () => void;
  /** Unregister from the era system, dispose every module, detach. */
  dispose(): void;
}

/** Build the composed block. Every declared module mounts here — no domains added. */
export function createCityBlock(options: CityBlockOptions): CityBlock {
  const { scene, eraSystem } = options;
  const { core, registry } = eraSystem;

  // --- Attachment root ----------------------------------------------------
  const cityRoot =
    options.cityRoot ??
    (scene.getObjectByName('cityRoot') as THREE.Group | undefined) ??
    (() => {
      const group = new THREE.Group();
      group.name = 'cityRoot';
      scene.add(group);
      return group;
    })();

  const root = new THREE.Group();
  root.name = 'city-block';
  cityRoot.add(root);

  // Cross-module depth fix: the shell's ground plane and the street's
  // persistent road slab are both authored at exactly y = 0. Bias only the
  // ground away from the camera so the two coplanar surfaces can never
  // z-fight; nothing else about the authored heights changes.
  const ground = scene.getObjectByName('ground');
  if (ground instanceof THREE.Mesh && ground.material instanceof THREE.Material) {
    ground.material.polygonOffset = true;
    ground.material.polygonOffsetFactor = 1;
    ground.material.polygonOffsetUnits = 1;
  }

  // --- Street props (translated onto the shared centerline frame) ---------
  const street = createStreetPropsModule({ registry, seed: options.seed });
  street.root.position.set(STREET_ORIGIN_OFFSET.x, 0, STREET_ORIGIN_OFFSET.z);
  root.add(street.root);

  // --- Buildings (shared frontage line, bay slots for storefronts) --------
  const buildings = createBuildingsModule({
    library: ProceduralGfxLibrary,
    seed: options.seed ?? 1945,
  });
  root.add(buildings.root);
  const unregisterBuildings = buildings.registerInto(registry);

  // --- Storefront rows derived from the real building bays ----------------
  const rows: ComposedStorefrontRow[] = [];
  const unregisterRows: Array<() => void> = [];
  for (const row of resolveStorefrontRows(buildings.storefrontBays)) {
    const module = createStorefrontsModule({
      bays: row.slotCount,
      initialYear: core.selectedYear,
    });
    // The module authors everything (bays, posters, billboards, kiosk,
    // newsstand) inside its own group with "front" along +Z, so one rigid
    // group transform places the entire row: rotation carries the facing,
    // position pins the first bay. Slot options stay at their (0, 0, 0)
    // defaults so the group rotation is the only facing source.
    module.group.position.copy(row.position);
    module.group.rotation.y = row.rotationY;
    root.add(module.group);
    unregisterRows.push(module.register(registry));
    rows.push({ ...row, module });
  }

  // --- Traffic fleet (stays on the shared centerline frame) ---------------
  const vehicles = createVehiclesModule({
    registry,
    parent: root,
    initialBlend: core.frame().blend,
    streetHalfLength: TRAFFIC_STREET_HALF_LENGTH,
  });

  // --- Crowd (curb at the shared half-width ⇒ walk lanes at ±7.5) ---------
  const crowd = createPedestriansModule({
    parent: root,
    registry,
    curbZ: CROWD_CURB_Z,
    intersectionX: CROWD_CROSSING_X,
    initialEra: core.selectedYear,
    seed: options.seed,
  });

  // --- Atmosphere (lights stage; borrows the shell's sun/hemisphere) ------
  const atmosphere: AtmosphereModule = createAtmosphereForBlock(options, eraSystem);

  // Everything is registered: paint the shared initial frame across the
  // whole block so no module waits for the first transition to sync.
  eraSystem.driver.sync();

  // --- Static skeleton freeze (draw-prep polish) --------------------------
  // Every transform frozen here is rigid: the block root, the street root
  // translated onto the centerline frame, the buildings container, and each
  // storefront row group are placed once and never move again (era morphs and
  // ambience animate their *children*). Freezing their local matrices removes
  // per-frame recomposition for the whole static city skeleton, keeping the
  // frame budget on the animated instanced batches and the draw calls they
  // issue. `updateMatrix()` primes `matrixWorldNeedsUpdate` so the first
  // render computes the world matrices exactly once.
  const freezeStaticGroup = (object: THREE.Object3D): void => {
    object.updateMatrix();
    object.matrixAutoUpdate = false;
  };
  freezeStaticGroup(root);
  freezeStaticGroup(street.root);
  freezeStaticGroup(buildings.root);
  for (const row of rows) freezeStaticGroup(row.module.group);

  // --- Pickables ----------------------------------------------------------
  const pickables: PickableDescriptor[] = [];
  const pushBuilding = (pick: BuildingPickDescriptor): void => {
    pickables.push({
      id: pick.id,
      object: pick.object,
      focusDistance: pick.focusDistance,
      focusHeight: pick.focusHeight,
    });
  };
  for (const pick of buildings.pickables) pushBuilding(pick);
  for (const row of rows) {
    for (const pick of row.module.pickables) {
      pickables.push({
        id: `${pick.id}@${row.id}`,
        object: pick.object,
        focusDistance: pick.focusDistance,
        focusHeight: pick.focusHeight,
      });
    }
  }
  for (const pick of vehicles.pickables) {
    pickables.push({
      id: pick.id,
      object: pick.object,
      focusDistance: pick.focusDistance,
      focusHeight: pick.focusHeight,
    });
  }
  for (const pick of street.pickables) {
    pickables.push({
      id: pick.id,
      object: pick.object,
      focusDistance: pick.focusDistance,
      focusHeight: pick.focusHeight,
    });
  }
  pickables.push({
    id: 'crowd:pedestrians',
    object: crowd.group,
    focusDistance: 26,
    focusHeight: 2,
  });

  const seenIds = new Set<string>();
  for (const pick of pickables) {
    if (seenIds.has(pick.id)) {
      throw new Error(`Duplicate pickable id "${pick.id}" — ids must be namespaced per source.`);
    }
    seenIds.add(pick.id);
  }

  const calloutContentProvider = createEraCalloutProvider({
    currentYear: () => core.selectedYear,
    buildings,
    storefrontRows: rows,
    vehicles,
    street,
    crowd,
  });

  // --- Camera bounds covering the whole composed block --------------------
  const bounds: NavigationBounds = computeBlockBounds(buildings);

  let disposed = false;

  const block: CityBlock = {
    root,
    street,
    buildings,
    storefrontRows: rows,
    vehicles,
    crowd,
    atmosphere,
    pickables,
    calloutContentProvider,

    registerPickables(registryTarget: PickableRegistry): () => void {
      return registryTarget.registerPickables(pickables);
    },

    navigationBounds(): NavigationBounds {
      return bounds;
    },

    update(deltaSeconds: number, elapsedSeconds: number, camera?: THREE.Camera | null): void {
      if (disposed) return;
      const dt = Math.max(0, deltaSeconds);
      for (const row of rows) row.module.update(dt, elapsedSeconds);
      crowd.update(dt);
      vehicles.update(dt);
      atmosphere.update(dt, camera ?? null);
    },

    connectAudio(director: AudioDirector): () => void {
      const hooks = director.hooks;
      const unsubs: Array<() => void> = [];
      for (const row of rows) {
        unsubs.push(
          row.module.onAudioEvent((event) => {
            const name = STOREFRONT_AUDIO_MAP[event.type];
            if (name) hooks.emit(name, { gain: event.intensity });
          }),
        );
      }
      unsubs.push(
        street.onHook((event) => {
          const name = STREET_AUDIO_MAP[event.name];
          if (name) hooks.emit(name);
        }),
      );
      // Horns are one-shots with world positions. Engine loop character is
      // deliberately not bridged: the director already owns a persistent
      // traffic bed, and per-step pedestrian cues are covered by the
      // footsteps/chatter beds — bridging them would flood the voice pool.
      unsubs.push(
        vehicles.subscribeAudio((event) => {
          if (event.type === 'horn') {
            hooks.emit('street-horn', {
              x: event.position[0],
              y: event.position[1],
              z: event.position[2],
              // Traffic horns fire often; trimmed at the bridge so they
              // punctuate the era mix instead of riding on top of it.
              gain: 0.8,
            });
          }
        }),
      );
      return () => {
        for (const off of unsubs) off();
      };
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      unregisterBuildings();
      for (const off of unregisterRows) off();
      unregisterRows.length = 0;
      for (const row of rows) row.module.dispose();
      vehicles.dispose();
      crowd.dispose();
      street.dispose();
      atmosphere.dispose();
      root.removeFromParent();
      root.clear();
      pickables.length = 0;
      rows.length = 0;
    },
  };

  return block;
}

/** Atmosphere factory kept separate so the block body stays readable. */
function createAtmosphereForBlock(
  options: CityBlockOptions,
  eraSystem: EraMorphSystem,
): AtmosphereModule {
  return createAtmosphere({
    scene: options.scene,
    registry: eraSystem.registry,
    renderer: options.renderer ?? null,
    container: options.container ?? null,
    quality: options.quality,
    initialBlend: eraSystem.core.frame().blend,
    seed: options.seed,
  });
}

/* -------------------------------------------------------------------------- */
/* Bounds                                                                       */
/* -------------------------------------------------------------------------- */

/** Union of every module's authored extent, padded for comfortable orbiting. */
export function computeBlockBounds(buildings: BuildingsModule): NavigationBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const include = (x0: number, x1: number, z0: number, z1: number): void => {
    minX = Math.min(minX, x0);
    maxX = Math.max(maxX, x1);
    minZ = Math.min(minZ, z0);
    maxZ = Math.max(maxZ, z1);
  };

  for (const building of buildings.buildings) {
    const { x0, x1, z0, z1 } = building.lot;
    include(x0, x1, z0, z1);
  }
  for (const piece of STREET_LAYOUT.roadPieces) {
    include(
      piece.x0 + STREET_ORIGIN_OFFSET.x,
      piece.x1 + STREET_ORIGIN_OFFSET.x,
      piece.z0 + STREET_ORIGIN_OFFSET.z,
      piece.z1 + STREET_ORIGIN_OFFSET.z,
    );
  }
  const trafficReach = TRAFFIC_STREET_HALF_LENGTH + 4;
  include(-trafficReach, trafficReach, -trafficReach, trafficReach);
  include(-CROWD_CROSSING_X, CROWD_CROSSING_X, -CROWD_CROSSING_X, CROWD_CROSSING_X);

  const pad = 4;
  return {
    minX: Math.floor(minX - pad),
    maxX: Math.ceil(maxX + pad),
    minZ: Math.floor(minZ - pad),
    maxZ: Math.ceil(maxZ + pad),
    minY: 1.6,
    maxY: 140,
  };
}
