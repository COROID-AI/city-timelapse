/**
 * `VehiclesModule` — the public automobiles API consumed by the city
 * assembly integration owner.
 *
 * Composes:
 * - the era traffic fleet system (`traffic.ts`), registered into the shared
 *   `EraTransformable` registry at choreography stage `fleet`;
 * - the procedural fleet view (`models.ts`) driven from shared gfx-materials
 *   geometry and instanced wheel/trim/lamp pools;
 * - pickable descriptors (streetcar, robotaxi, and other marquee vehicles)
 *   shaped for the navigation callout registry;
 * - documented engine/horn audio hook events for the audio task.
 *
 * The module owns no timeline and no renderer: the integration owner passes
 * its registry (or a full era morph system), attaches `group` to the scene,
 * calls `update(deltaSeconds)` each frame, and forwards `applyEraBlend` via
 * the registry dispatch it already drives.
 *
 * Lane geometry follows the pinned contract: road at y = 0, streets 12 units
 * wide, driving lanes centered across at 3 and 9 (right-hand traffic), and a
 * 2-unit curb parking lane against each curb.
 */

import type * as THREE from 'three';
import type { EraTransformRegistry, EraTransformable } from '../../era/contracts';
import type { EraBlend } from '../../era/timeline';
import { FleetView, type VehicleVisualState } from './models';
import { TrafficFleetSystem, type VehicleAudioHookEvent, type VehicleAudioListener } from './traffic';
import { VEHICLE_KINDS, pickableKindIds, type FleetEra, type VehicleKindId } from './variants';

// Re-export the module surface for the integration owner.
export type {
  VehicleAudioHookEvent,
  VehicleAudioListener,
} from './traffic';
export {
  TrafficFleetSystem,
  buildStreetLoop,
  buildStreetcarPath,
  desiredApproachSpeed,
  desiredFollowingSpeed,
  isRightHandLane,
  laneCenterAcross,
  laneCenterWorld,
  acrossToOffset,
  travelDirection,
  rightVector,
  ROAD_SURFACE_Y,
  STREET_WIDTH,
  LANE_CENTERS,
  CURB_PARKING_WIDTH,
  PARKING_LANE_CENTERS,
  RAIL_CENTER_ACROSS,
  INTERSECTION_HALF,
  MOVING_CARS_PER_LOOP,
  PARKED_PER_SIDE,
  DEFAULT_STREET_HALF_LENGTH,
  TrafficPath,
} from './traffic';
export type { StreetAxis, PathSample, VehicleSlotState } from './traffic';
export {
  ERA_FLEETS,
  VEHICLE_KINDS,
  fleetForEra,
  fleetKindForSlot,
  paintForKind,
  pickableKindIds,
  trimColor,
} from './variants';
export type {
  EraFleet,
  FleetEra,
  FleetSlotRole,
  VehicleCategory,
  VehicleKindDef,
  VehicleKindId,
  VehicleTrimStyle,
} from './variants';
export { FleetView, disposeVehicleAssets, getKindAssets } from './models';
export type { VehicleKindAssets, VehicleVisualState } from './models';

/**
 * Pickable vehicle descriptor for the navigation/callout layer.
 *
 * Structurally compatible with the navigation registry's `PickableDescriptor`
 * (`id` + `object` + optional `focusDistance`/`focusHeight`) and carries the
 * `CalloutContent` fields (`title`, `eyebrow`, `description`, `facts`) so the
 * integration owner can forward it to a callout provider without reshaping.
 */
export interface VehiclePickableDescriptor {
  /** Stable id, e.g. `vehicle:streetcar`. */
  id: string;
  /** Raycast target: the slot's group object (visible only in its era). */
  object: THREE.Object3D;
  /** Callout heading — the vehicle label. */
  title: string;
  /** Callout overline: the era year as a string. */
  eyebrow: string;
  /** Callout description copy. */
  description: string;
  /** Short fact chips for the callout. */
  facts: readonly string[];
  /** Suggested framing distance for focus flights. */
  focusDistance: number;
  /** Suggested eye height for the focus viewpoint. */
  focusHeight: number;
}

/** Options for building the vehicles module. */
export interface VehiclesModuleOptions {
  /** Era registry every traffic system registers into (required). */
  registry: EraTransformRegistry;
  /** Optional scene attachment group; `module.group` is added when given. */
  parent?: { add(object: THREE.Object3D): void; remove(object: THREE.Object3D): void };
  /** Blend applied at construction; defaults to the 1945 rest state. */
  initialBlend?: EraBlend;
  /** Half-length of each street (default 48). */
  streetHalfLength?: number;
}

/** The produced automobiles module consumed by the integration owner. */
export interface VehiclesModule {
  /** Scene root holding every vehicle; attach to your city group. */
  readonly group: THREE.Group;
  /** The registered EraTransformable traffic system (stage `fleet`). */
  readonly eraSystem: TrafficFleetSystem;
  /** Registry the system was registered into. */
  readonly registry: EraTransformRegistry;
  /** Pickable descriptors (streetcar, robotaxi, marquee vehicles). */
  readonly pickables: readonly VehiclePickableDescriptor[];
  /** Resolve a raycast hit (or ancestor) to a pickable descriptor. */
  describePick(object: THREE.Object3D): VehiclePickableDescriptor | null;
  /** Subscribe to documented engine/horn audio hooks; returns unsubscribe. */
  subscribeAudio(listener: VehicleAudioListener): () => void;
  /** Emit a horn for a slot (default: first active moving car). */
  honk(slotId?: string): boolean;
  /** Advance traffic one frame and sync the rendered fleet. */
  update(deltaSeconds: number): void;
  /** Unregister, detach, and release GPU resources. */
  dispose(): void;
  /** Live visual states (read-only) for debugging and tests. */
  states(): readonly VehicleVisualState[];
}

/**
 * Fixed slot -> descriptor assignment so each marquee kind gets its own
 * pickable object. Moving slots show a different kind every era, which is
 * exactly when the descriptor should (and does) become visible.
 */
const PICKABLE_SLOT_BY_KIND: Partial<Record<VehicleKindId, string>> = {
  presedan: 'ns-move-0',
  robotaxi: 'ns-move-1',
  taxi: 'ns-move-2',
  panelvan: 'ns-move-3',
  chromesedan: 'ns-move-4',
  musclecar: 'ew-move-0',
  citybus: 'ew-move-1',
  suv: 'ew-move-2',
  evsedan: 'ew-move-3',
  streetcar: 'rail-tram',
};

/** Build the composed vehicles module. */
export function createVehiclesModule(options: VehiclesModuleOptions): VehiclesModule {
  const system = new TrafficFleetSystem({
    streetHalfLength: options.streetHalfLength,
    initialBlend: options.initialBlend,
  });

  const slotIds = system.slots.map((slot) => slot.slotId);
  const view = new FleetView(slotIds);

  // Register the traffic system with the shared era registry (stage fleet).
  const unregister = options.registry.register(system);

  if (options.parent) options.parent.add(view.group);

  // Pickable descriptors: one per marquee kind, bound to a dedicated slot.
  const descriptors: VehiclePickableDescriptor[] = [];
  const descriptorByKind = new Map<VehicleKindId, VehiclePickableDescriptor>();
  for (const kindId of pickableKindIds()) {
    const def = VEHICLE_KINDS[kindId];
    const preferred = PICKABLE_SLOT_BY_KIND[kindId];
    const slot =
      (preferred ? system.slots.find((s) => s.slotId === preferred) : undefined) ??
      system.slots.find((s) => s.role !== 'parked');
    if (!slot) continue;
    const object = view.slotGroup(slot.slotId);
    if (!object) continue;
    const descriptor: VehiclePickableDescriptor = {
      id: `vehicle:${kindId}`,
      object,
      title: def.label,
      eyebrow: String(def.era),
      description: def.description,
      facts: [
        def.category === 'twoWheel' ? 'Two wheels' : def.category,
        `${def.length.toFixed(1)} m long`,
        `trim: ${def.trim}`,
      ],
      focusDistance: def.length * 2.6 + 6,
      focusHeight: Math.max(def.height * 1.6, 2),
    };
    descriptors.push(descriptor);
    descriptorByKind.set(kindId, descriptor);
  }

  const states: VehicleVisualState[] = system.slots.map((slot) => ({
    slotId: slot.slotId,
    kindId: slot.kindId,
    variantScale: slot.variantScale,
    paint: slot.paint,
    x: slot.x,
    z: slot.z,
    yaw: slot.yaw,
    wheelSpin: slot.wheelSpin,
    headlights: slot.headlights,
    taillights: slot.taillights,
    braking: slot.braking,
    active: slot.active,
  }));

  const refreshStates = (): void => {
    for (let i = 0; i < system.slots.length; i++) {
      const slot = system.slots[i];
      const target = states[i];
      target.kindId = slot.kindId;
      target.variantScale = slot.variantScale;
      target.paint = slot.paint;
      target.x = slot.x;
      target.z = slot.z;
      target.yaw = slot.yaw;
      target.wheelSpin = slot.wheelSpin;
      target.headlights = slot.headlights;
      target.taillights = slot.taillights;
      target.braking = slot.braking;
      target.active = slot.active;
    }
  };

  const audioListeners = new Set<VehicleAudioListener>();
  const unsubscribeAudio = system.subscribeAudio((event: VehicleAudioHookEvent) => {
    for (const listener of audioListeners) listener(event);
  });

  let disposed = false;

  const describePick = (object: THREE.Object3D): VehiclePickableDescriptor | null => {
    let current: THREE.Object3D | null = object;
    while (current) {
      const kindRaw = current.userData?.vehicleKind;
      if (typeof kindRaw === 'string' && kindRaw !== '') {
        const descriptor = descriptorByKind.get(kindRaw as VehicleKindId);
        if (descriptor) return descriptor;
        return null;
      }
      current = current.parent;
    }
    return null;
  };

  const update = (deltaSeconds: number): void => {
    if (disposed) return;
    system.update(deltaSeconds);
    refreshStates();
    view.sync(states);
  };

  // Initial paint so the module is visible before the first frame.
  refreshStates();
  view.sync(states);

  return {
    group: view.group,
    eraSystem: system,
    registry: options.registry,
    pickables: descriptors,
    describePick,
    subscribeAudio(listener: VehicleAudioListener): () => void {
      audioListeners.add(listener);
      return () => {
        audioListeners.delete(listener);
      };
    },
    honk(slotId?: string): boolean {
      return system.honk(slotId);
    },
    update,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      unregister();
      unsubscribeAudio();
      audioListeners.clear();
      options.parent?.remove(view.group);
      view.dispose();
    },
    states(): readonly VehicleVisualState[] {
      return states;
    },
  };
}

/** Convenience: era currently dominant for a blend (mirrors the system). */
export function dominantEraFor(blend: EraBlend): FleetEra {
  return blend.fraction >= 0.5 ? blend.to : blend.from;
}

/** Default export keeps parity with the gfx library module style. */
export default createVehiclesModule;

// `EraTransformable` is part of the produced surface for integration typing.
export type { EraTransformable };
