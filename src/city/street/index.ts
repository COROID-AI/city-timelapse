/**
 * `street-props-api` — the street-level environment module for the block
 * corner.
 *
 * Exports:
 * - the canonical alignment slot constants (road y=0, 12-unit streets,
 *   0.15 curbs, 3-unit sidewalks with top at y=0.15, driving lane centers
 *   3 and 9, 2-unit parking lanes, walking lane 1.5 in from the curb, and
 *   6-unit storefront bay slots with 5-unit clear width at base y=0.15)
 *   that buildings, storefronts, vehicles, and pedestrians pin to;
 * - the era variant tables for every street prop kind and the roadway
 *   surfacing variants;
 * - `createStreetPropsModule()`, which builds the whole streetscape,
 *   implements `EraTransformable`, registers staged sub-targets into the
 *   era-transform registry, exposes pickable hero descriptors (phone booth,
 *   EV charger, pay station, kiosk, wifi pylon, bus stop), and emits the
 *   documented sound-hook events consumed later by the audio task.
 *
 * Era choreography: three staged transformables — roadway (`facade`),
 * furniture (`fleet`), and lighting/line infrastructure (`lights`). Each
 * channel eases from the weight state it held at the start of the
 * transition toward the timeline's live adjacent-era blend inside its own
 * stage window, so surfaces settle before furniture, and lamps and wires
 * swap last. All era layers crossfade by opacity with distinct frozen
 * per-era scales and polygon offsets — props never float, never sink, and
 * never z-fight with the roadway.
 *
 * Sounds are not owned here: subscribe with `onHook` and react to the
 * documented `street:*` events instead of playing audio directly.
 */

import * as THREE from 'three';
import { clamp01, eraWeights, type EraBlend, type EraYear } from '../../era/timeline';
import type {
  EraMorphStage,
  EraTransformable,
  EraTransformRegistry,
} from '../../era/contracts';
import { buildRoadway, StreetEraLayer } from './roadway';
import { buildStreetFurniture, type StreetPickableDescriptor } from './furniture';
import { STREET_ERAS } from './variants';

// ---------------------------------------------------------------------------
// Public re-exports: alignment constants, era variants, layout, pickables
// ---------------------------------------------------------------------------

export {
  ROAD_SURFACE_Y,
  STREET_WIDTH,
  CURB_HEIGHT,
  SIDEWALK_WIDTH,
  SIDEWALK_TOP_Y,
  DRIVE_LANE_CENTERS,
  CURB_PARKING_LANE_WIDTH,
  SIDEWALK_WALK_LANE_CENTER,
  STOREFRONT_BAY_SPACING,
  STOREFRONT_BAY_CLEAR_WIDTH,
  STOREFRONT_BAY_BASE_Y,
  STREET_ALIGNMENT,
  ROAD_LAYER_LIFT,
  ROAD_LAYER_STEP,
  SIDEWALK_LAYER_LIFT,
  SIDEWALK_LAYER_STEP,
  roadSurfaceY,
  sidewalkSurfaceY,
  eraIndex,
  eraPropScale,
} from './roadway';

export {
  STREET_ERAS,
  STREET_PROP_KINDS,
  LIGHTING_PROP_KINDS,
  FURNITURE_PROP_KINDS,
  PROP_SURFACE,
  STREET_PROP_VARIANTS,
  ROAD_SURFACE_VARIANTS,
  STREET_LAYOUT,
  propVariant,
  roadSurfaceVariant,
  isPropPresent,
  erasPresent,
  slotsFor,
} from './variants';

export type {
  StreetEra,
  StreetPropKind,
  StreetPropSurface,
  StreetPropVariant,
  RoadSurfaceVariant,
  StreetRect,
  StreetSlot,
} from './variants';

export { HERO_PICKABLE_KINDS, INSTANCED_STREET_KINDS } from './furniture';
export type { StreetPickableDescriptor } from './furniture';

// ---------------------------------------------------------------------------
// Documented sound-hook events (owned by this module, consumed by audio)
// ---------------------------------------------------------------------------

/**
 * Every hook event this module may emit. The audio task subscribes through
 * `StreetPropsModule.onHook` and owns all actual playback; the street module
 * never plays sound itself.
 */
export const STREET_HOOK_EVENTS = [
  'street:lamp:ignite',
  'street:lamp:hum',
  'street:wire:creak',
  'street:booth:ring',
  'street:meter:tick',
  'street:trash:settle',
  'street:construction:clank',
  'street:charger:connect',
  'street:kiosk:chime',
] as const;

/** One documented hook event name. */
export type StreetHookEventName = (typeof STREET_HOOK_EVENTS)[number];

/** Which choreography channel an event belongs to. */
export type StreetHookChannel = 'furniture' | 'lighting';

/** Payload delivered to hook listeners. */
export interface StreetHookEvent {
  /** Documented event name. */
  readonly name: StreetHookEventName;
  /** Era that became dominant and triggered the event. */
  readonly era: EraYear;
  /** Channel whose weight crossing triggered the event. */
  readonly channel: StreetHookChannel;
}

/** Listener signature for `StreetPropsModule.onHook`. */
export type StreetHookListener = (event: StreetHookEvent) => void;

/**
 * Hook events fired when an era becomes dominant (weight crossing 0.5) on a
 * channel. Crossing back below 0.35 re-arms the era, so scrubbing the
 * timeline back and forth re-emits — relighting a gas lamp or replugging a
 * charger as its era returns.
 */
export const STREET_ERA_HOOKS: Readonly<
  Record<EraYear, Readonly<Record<StreetHookChannel, readonly StreetHookEventName[]>>>
> = Object.freeze({
  1945: {
    lighting: ['street:lamp:ignite', 'street:wire:creak'],
    furniture: ['street:construction:clank'],
  },
  1965: {
    lighting: ['street:lamp:ignite'],
    furniture: ['street:booth:ring', 'street:meter:tick', 'street:construction:clank'],
  },
  1985: {
    lighting: ['street:lamp:hum', 'street:wire:creak'],
    furniture: [
      'street:booth:ring',
      'street:meter:tick',
      'street:trash:settle',
      'street:construction:clank',
    ],
  },
  2005: {
    lighting: ['street:lamp:hum'],
    furniture: ['street:booth:ring', 'street:construction:clank'],
  },
  2025: {
    lighting: ['street:lamp:hum'],
    furniture: ['street:charger:connect', 'street:kiosk:chime'],
  },
});

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

/** Options for `createStreetPropsModule`. */
export interface StreetPropsModuleOptions {
  /**
   * Era-transform registry to register the staged street targets into
   * immediately (the integration owner's `createEraMorphSystem().registry`).
   * `registerInto` remains available for deferred wiring.
   */
  readonly registry?: EraTransformRegistry;
  /** PRNG seed offset for deterministic procedural jitter. */
  readonly seed?: number;
}

/** The complete streetscape module: scene root, contract, pickables, hooks. */
export interface StreetPropsModule extends EraTransformable {
  /** Scene root group (`street:props`) holding roadway + furniture + lighting. */
  readonly root: THREE.Group;
  /** This module's own stage when driven as a single transformable. */
  readonly stage: EraMorphStage;
  /** Staged sub-targets (roadway → facade, furniture → fleet, lighting → lights). */
  readonly transformables: readonly EraTransformable[];
  /** Pickable hero props (phone booth, EV charger, pay station, kiosk, wifi pylon, bus stop). */
  readonly pickables: readonly StreetPickableDescriptor[];
  /** Subscribe to documented sound-hook events; returns an unsubscribe function. */
  onHook(listener: StreetHookListener): () => void;
  /** Live furniture-channel era weights (sum to 1; at rest one era is 1). */
  weights(): Readonly<Record<EraYear, number>>;
  /** Register the staged sub-targets; returns one unregister function. */
  registerInto(registry: EraTransformRegistry): () => void;
  /** Dispose every geometry, material, and texture the module created. */
  dispose(): void;
}

interface StreetChannel {
  readonly name: 'roadway' | 'furniture' | 'lighting';
  readonly stage: EraMorphStage;
  readonly layers: readonly StreetEraLayer[];
  /**
   * Weight state the channel last fully applied. While its stage window is
   * shut (stage progress 0) the channel holds this state, which is the
   * transition's origin; at progress 1 it tracks the live target.
   */
  held: Record<EraYear, number>;
}

function zeroWeights(): Record<EraYear, number> {
  const out = {} as Record<EraYear, number>;
  for (const era of STREET_ERAS) out[era] = 0;
  return out;
}

function blendTarget(blend: EraBlend): Record<EraYear, number> {
  const map = eraWeights(blend);
  const out = zeroWeights();
  for (const era of STREET_ERAS) out[era] = map.get(era) ?? 0;
  return out;
}

function lerpWeights(
  from: Record<EraYear, number>,
  to: Record<EraYear, number>,
  t: number,
): Record<EraYear, number> {
  const out = zeroWeights();
  for (const era of STREET_ERAS) out[era] = from[era] + (to[era] - from[era]) * t;
  return out;
}

/**
 * Build the street-level environment of the block corner.
 *
 * Pure construction: safe to call in tests (jsdom, no GPU) and in the
 * browser. Wire `transformables` (or pass `options.registry`) into the
 * era morph system, attach `root` to the city root, register `pickables`
 * with navigation, and subscribe `onHook` for the audio task.
 */
export function createStreetPropsModule(
  options: StreetPropsModuleOptions = {},
): StreetPropsModule {
  const seed = options.seed ?? 2025;

  const roadway = buildRoadway();
  const furniture = buildStreetFurniture({ channel: 'furniture', seed });
  const lighting = buildStreetFurniture({ channel: 'lighting', seed });

  const root = new THREE.Group();
  root.name = 'street:props';
  root.add(roadway.root);
  root.add(furniture.root);
  root.add(lighting.root);

  const channels: StreetChannel[] = [
    { name: 'roadway', stage: 'facade', layers: roadway.layers, held: zeroWeights() },
    { name: 'furniture', stage: 'fleet', layers: furniture.layers, held: zeroWeights() },
    { name: 'lighting', stage: 'lights', layers: lighting.layers, held: zeroWeights() },
  ];
  const roadwayChannel = channels[0];
  const furnitureChannel = channels[1];
  const lightingChannel = channels[2];

  const listeners = new Set<StreetHookListener>();
  const armed = new Set<string>(); // `${channel}:${era}` pairs below 0.5 are disarmed

  const applyChannel = (channel: StreetChannel, weights: Record<EraYear, number>): void => {
    for (const layer of channel.layers) layer.applyWeight(weights[layer.era]);
    channel.held = weights;
    if (channel.name === 'roadway') return;
    const hookChannel = channel.name as StreetHookChannel;
    for (const era of STREET_ERAS) {
      const key = `${hookChannel}:${era}`;
      const w = weights[era];
      if (w >= 0.5 && !armed.has(key)) {
        armed.add(key);
        for (const name of STREET_ERA_HOOKS[era][hookChannel]) {
          const event: StreetHookEvent = { name, era, channel: hookChannel };
          for (const listener of listeners) listener(event);
        }
      } else if (w < 0.35 && armed.has(key)) {
        armed.delete(key);
      }
    }
  };

  /**
   * Staged weights for one channel: hold the transition-origin state until
   * the stage window opens, ease from origin to the live blend target
   * across the window, then track the target exactly.
   */
  const applyChannelFrame = (
    channel: StreetChannel,
    blend: EraBlend,
    stageProgress: number,
  ): void => {
    const p = clamp01(stageProgress);
    if (p <= 0) {
      applyChannel(channel, channel.held);
      return;
    }
    const target = blendTarget(blend);
    applyChannel(channel, p >= 1 ? target : lerpWeights(channel.held, target, p));
  };

  const makeTransformable = (channel: StreetChannel): EraTransformable => ({
    stage: channel.stage,
    applyEraBlend(blend, _stageOffset, progress) {
      applyChannelFrame(channel, blend, progress);
    },
  });

  const transformables: readonly EraTransformable[] = [
    makeTransformable(roadwayChannel),
    makeTransformable(furnitureChannel),
    makeTransformable(lightingChannel),
  ];

  const pickables: readonly StreetPickableDescriptor[] = [
    ...furniture.pickables,
    ...lighting.pickables,
  ];

  const registerInto = (registry: EraTransformRegistry): (() => void) => {
    const unregisters = transformables.map((target) => registry.register(target));
    return () => {
      for (const unregister of unregisters) unregister();
    };
  };

  let unregisterFromOptions: (() => void) | undefined;
  if (options.registry) {
    unregisterFromOptions = registerInto(options.registry);
  }

  // Initial sync: the timeline starts at 1945, so arm that era silently
  // (listeners typically subscribe after construction).
  const initial = zeroWeights();
  initial[1945] = 1;
  for (const channel of channels) {
    channel.held = initial;
    for (const layer of channel.layers) layer.applyWeight(initial[layer.era]);
    if (channel.name !== 'roadway') {
      const hookChannel = channel.name as StreetHookChannel;
      for (const era of STREET_ERAS) {
        if (initial[era] >= 0.5) armed.add(`${hookChannel}:${era}`);
      }
    }
  }

  let disposed = false;

  const module: StreetPropsModule = {
    root,
    stage: 'facade',
    transformables,
    pickables,

    applyEraBlend(blend, _stageOffset, progress): void {
      const p = clamp01(progress);
      for (const channel of channels) applyChannelFrame(channel, blend, p);
    },

    onHook(listener: StreetHookListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    weights(): Readonly<Record<EraYear, number>> {
      return furnitureChannel.held;
    },

    registerInto,

    dispose(): void {
      if (disposed) return;
      disposed = true;
      unregisterFromOptions?.();
      unregisterFromOptions = undefined;
      listeners.clear();
      armed.clear();

      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (!material) return;
        const list = Array.isArray(material) ? material : [material];
        for (const mat of list) {
          materials.add(mat);
          if (mat instanceof THREE.MeshStandardMaterial && mat.map) textures.add(mat.map);
          if (mat instanceof THREE.MeshStandardMaterial && mat.emissiveMap) {
            textures.add(mat.emissiveMap);
          }
        }
      });
      for (const geometry of geometries) geometry.dispose();
      for (const texture of textures) texture.dispose();
      for (const material of materials) material.dispose();
      root.clear();
    },
  };

  return module;
}