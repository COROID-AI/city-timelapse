/**
 * CyclistSystem — era-correct two-wheelers travelling the cycle lanes.
 *
 * Spawns a capped population of cyclists/two-wheelers that travel the *shared*
 * {@link RoadNetwork} cycling lanes (never redefining lane geometry). The
 * conveyance model is era-correct — classic roadsters (1945/1965), 10-speeds
 * (1985), mountain/hybrid (2005), e-bikes + e-scooters (2025), hover-boards +
 * sleek e-bikes (2055) — built from parametric geometry baked into a single
 * vertex-colored {@link BufferGeometry} per variant and driven by one
 * {@link InstancedMesh} per variant behind a shared material.
 *
 * The system registers an era domain with the {@link TransitionManager}: on an
 * era change it cross-fades the visible conveyance set (fade old out / new in
 * over the transition) without rebuilding the scene graph. Cyclists stop at the
 * signalized intersection where their cycle lane crosses the driving conflict
 * zone — they proceed only when their axis is green.
 */

import {
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import {
  DEFAULT_ERA_CONFIG,
  eraIndex,
  lerp,
  type ApplyEraFn,
  type EraKey,
} from '../eras/eraConfig.js';
import type { RoadNetwork } from '../world/roadNetwork.js';
import type { TrafficLightController } from '../world/trafficLight.js';
import {
  buildCyclistPaths,
  sampleAgent,
  stepAgent,
  type AgentPath,
  type AgentState,
  type SignalAxis,
} from './agentPaths.js';
import { buildEraConveyances, type ConveyanceVariant } from './bikes.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Hard cap on the number of cyclists, regardless of era or lane count. */
export const MAX_CYCLISTS = 12;

/** Base travel speed (world units / second) for a human-powered bike. */
const BASE_SPEED = 3.2;

/**
 * Speed multiplier per era — e-bikes / hover-boards move noticeably faster than
 * a 1945 roadster, giving each era a distinct street rhythm.
 */
const ERA_SPEED: Record<EraKey, number> = {
  '1945': 0.85,
  '1965': 0.95,
  '1985': 1.1,
  '2005': 1.0,
  '2025': 1.35,
  '2055': 1.6,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One cyclist agent: which path it follows and its moving state. */
interface Cyclist {
  path: AgentPath;
  state: AgentState;
}

/** One instanced variant within a conveyance set. */
interface VariantMesh {
  /** Instanced renderable for this variant. */
  mesh: InstancedMesh;
  /** Cyclist indices (into {@link CyclistSystem.#cyclists}) rendered here. */
  cyclistIndices: number[];
}

/**
 * A complete per-era conveyance set: one InstancedMesh per variant, sharing a
 * single material, plus the cyclist→variant assignment. Two of these (active +
 * incoming) drive the cross-fade.
 */
interface ConveyanceSet {
  era: EraKey;
  /** Per-variant instanced meshes (parallel to buildEraConveyances order). */
  variants: VariantMesh[];
  /** Shared material for every variant in this set (drives cross-fade opacity). */
  material: MeshStandardMaterial;
}

/** Public surface of the cyclist system. */
export interface CyclistSystem {
  /** Group to add to the scene. */
  group: Group;
  /** TransitionManager era domain: cross-fades the conveyance set per era. */
  applyEra: ApplyEraFn;
  /** Advance cyclists one frame; call from the render loop with delta in ms. */
  update: (deltaMs: number) => void;
  /** Release GPU resources. */
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Create the cyclist system over a shared road network and its signal
 * controller. Cyclists are seeded across the cycling lanes immediately and
 * snapped to `initialEra`.
 */
export function createCyclistSystem(
  network: RoadNetwork,
  controller: TrafficLightController,
  initialEra: EraKey = '1945',
): CyclistSystem {
  const group = new Group();
  group.name = 'cyclists';

  // --- Paths (consumed from the shared network, never redefined) -----------
  const paths = buildCyclistPaths(network);

  // --- Cyclist population (capped) -----------------------------------------
  const cyclists: Cyclist[] = [];
  if (paths.length > 0) {
    const count = Math.min(MAX_CYCLISTS, Math.max(4, paths.length));
    for (let i = 0; i < count; i++) {
      const path = paths[i % paths.length];
      const total = path.total;
      cyclists.push({
        path,
        state: {
          // Stagger start positions and directions across the population.
          d: (total * (i + 0.5)) / count,
          dir: i % 2 === 0 ? 1 : -1,
          speed: BASE_SPEED * ERA_SPEED[initialEra],
          waiting: false,
        },
      });
    }
  }

  // Reusable transform dummy for writing instance matrices.
  const dummy = new Object3D();

  // --- Era conveyance sets (active = settled, incoming = cross-fade target) -
  let active: ConveyanceSet | null = null;
  let incoming: ConveyanceSet | null = null;
  /** The era whose geometry is currently fully settled/visible. */
  let settledEra: EraKey = initialEra;

  /**
   * Allocate cyclists to variants by weight and build the instanced meshes for
   * an era. Each variant gets a slice of the population; capacities sum to the
   * cyclist count so no cyclist is left without a mesh.
   */
  function buildSet(era: EraKey): ConveyanceSet {
    const variantsSpec = buildEraConveyances(era);
    const material = createCyclistMaterial(era);
    const variants: VariantMesh[] = [];

    // Distribute cyclist indices across variants by weight.
    const n = cyclists.length;
    let assigned = 0;
    for (let vi = 0; vi < variantsSpec.length; vi++) {
      const isLast = vi === variantsSpec.length - 1;
      const size = isLast ? n - assigned : Math.round(n * variantsSpec[vi].weight);
      const indices: number[] = [];
      for (let k = 0; k < size && assigned < n; k++) {
        indices.push(assigned++);
      }
      variants.push(buildVariantMesh(variantsSpec[vi], material, indices, era));
    }
    return { era, variants, material };
  }

  function buildVariantMesh(
    spec: ConveyanceVariant,
    material: MeshStandardMaterial,
    indices: number[],
    era: EraKey,
  ): VariantMesh {
    const capacity = Math.max(1, indices.length);
    // Ground the geometry so its lowest point sits on the road surface.
    const geo = spec.geometry.clone();
    geo.computeBoundingBox();
    const minY = geo.boundingBox?.min.y ?? 0;
    // Hover-boards float slightly above the ground; everything else contacts.
    const lift = era === '2055' && indices.length > 0 ? 0.0 : -minY;
    geo.translate(0, lift, 0);

    const mesh = new InstancedMesh(geo, material, capacity);
    mesh.count = capacity;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return { mesh, cyclistIndices: indices };
  }

  /** Shared vertex-colored material for an era; tinted by the era palette. */
  function createCyclistMaterial(era: EraKey): MeshStandardMaterial {
    const road = DEFAULT_ERA_CONFIG[era].road;
    return new MeshStandardMaterial({
      vertexColors: true,
      roughness: lerp(0.6, road.surfaceRoughness, 0.3),
      metalness: eraIndex(era) >= eraIndex('2025') ? 0.4 : 0.1,
      transparent: true,
      opacity: 1,
    });
  }

  /** Is the signal green for `axis`? Cyclists proceed on their axis's green. */
  function isGreen(axis: SignalAxis): boolean {
    const phase = axis === 'ew' ? controller.getPhase() : controller.getComplementaryPhase();
    return phase === 'green';
  }

  /**
   * Write the instance matrices for one conveyance set from the current cyclist
   * states. `opacity` is applied to the set's shared material by the caller.
   */
  function writeMatrices(set: ConveyanceSet): void {
    for (const variant of set.variants) {
      const { mesh, cyclistIndices } = variant;
      for (let i = 0; i < cyclistIndices.length; i++) {
        const c = cyclists[cyclistIndices[i]];
        if (!c) continue;
        placeCyclist(c, dummy);
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Orient + position the dummy from a cyclist's sampled path state. */
  function placeCyclist(c: Cyclist, out: Object3D): void {
    const { pos, dir } = sampleAgent(c.path, c.state.d);
    const headingX = dir.x * c.state.dir;
    const headingZ = dir.z * c.state.dir;
    // Local +X is "forward"; rotate about Y so +X points along the heading.
    const angle = Math.atan2(-headingZ, headingX);
    out.rotation.set(0, angle, 0);
    out.position.set(pos.x, 0, pos.z);
    out.updateMatrix();
  }

  /** Dispose every mesh/material in a set and remove it from the group. */
  function disposeSet(set: ConveyanceSet | null): void {
    if (!set) return;
    for (const v of set.variants) {
      group.remove(v.mesh);
      v.mesh.geometry.dispose();
      v.mesh.dispose();
    }
    set.material.dispose();
  }

  // --- Initial settled set -------------------------------------------------
  active = buildSet(initialEra);
  writeMatrices(active);

  // --- Era domain: cross-fade active → incoming ----------------------------
  const applyEra: ApplyEraFn = (toKey, t, _fromKey) => {
    if (toKey === settledEra) {
      // Settling onto the currently-visible era: ensure a clean single set.
      if (incoming) {
        disposeSet(incoming);
        incoming = null;
      }
      if (active) {
        active.material.opacity = 1;
      }
      return;
    }

    // Transitioning toward a new era: lazily build the incoming set once.
    if (!incoming || incoming.era !== toKey) {
      // If the destination changed mid-flight, drop the stale incoming set.
      if (incoming && incoming.era !== toKey) {
        disposeSet(incoming);
      }
      incoming = buildSet(toKey);
      writeMatrices(incoming);
    }

    // Cross-fade opacities. Older eras sit slightly more matte.
    if (active) {
      active.material.opacity = 1 - t;
    }
    incoming.material.opacity = t;

    // On settle (t reaches 1), promote incoming → active.
    if (t >= 1) {
      disposeSet(active);
      active = incoming;
      incoming = null;
      settledEra = toKey;
      // Re-base cyclist speeds to the new era.
      const speedScale = ERA_SPEED[toKey];
      for (const c of cyclists) {
        c.state.speed = BASE_SPEED * speedScale;
      }
    }
  };

  // --- Per-frame update ----------------------------------------------------
  function update(deltaMs: number): void {
    const dt = Math.min(deltaMs, 64) / 1000; // clamp huge frame gaps; seconds
    for (const c of cyclists) {
      stepAgent(c.state, c.path, dt, isGreen);
    }
    if (active) {
      writeMatrices(active);
    }
    if (incoming) {
      writeMatrices(incoming);
    }
  }

  function dispose(): void {
    disposeSet(active);
    disposeSet(incoming);
    active = null;
    incoming = null;
  }

  return { group, applyEra, update, dispose };
}
