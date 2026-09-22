/**
 * `PedestriansModule` — the era-aware instanced crowd for the city block.
 *
 * Integration (owned by t-city-assembly):
 * ```ts
 * import { PedestriansModule } from './city/pedestrians';
 * const crowd = new PedestriansModule({
 *   parent: shell.cityRoot,
 *   registry: eraSystem.registry,      // registers stage 'crowd'
 *   count: 48,
 * });
 * shell.onUpdate((dt) => crowd.update(dt));
 * ```
 *
 * Responsibilities:
 * - Builds a procedural low-poly figure grid from the shared gfx library:
 *   three era-static instanced meshes (head/hands) plus one instanced mesh
 *   per (era-morphing slot, archetype slot). Draw-call count is independent
 *   of crowd size, and every instance carries its own skin, hair, height,
 *   and outfit color.
 * - Implements `EraTransformable` (stage `crowd`). Era weights are staged
 *   through the contract's stage-local progress: the crowd holds its current
 *   look while earlier stages run, then morphs its vertex buffers and
 *   instance colors continuously to the arriving era — restyling the same
 *   person mid-stride with no mesh swap and no pop. Interrupted transitions
 *   stay continuous because new transitions hold the current blended look.
 * - Emits documented audio hook events (`footstep`, `chatter`). Sound playback
 *   is NOT owned here; the audio task consumes `onAudioEvent` /
 *   `getAudioEvents`.
 * - Exposes pickable descriptors for every pedestrian, flagging one
 *   representative character per archetype slot.
 *
 * All geometry is procedural (no downloaded models or animations); all
 * textures come from `ProceduralGfxLibrary`.
 */

import * as THREE from 'three';
import {
  stageOffset as eraStageOffset,
  type EraTransformRegistry,
  type EraTransformable,
} from '../../era/contracts';
import type { EraBlend, EraYear } from '../../era/timeline';
import { ProceduralGfxLibrary } from '../../gfx/materials';
import {
  advanceWalkers,
  createCrowdPath,
  createWalkers,
  resolveLaneConstants,
  type CrowdLaneConstants,
  type CrowdPath,
  type Walker,
  type WalkerBehavior,
} from './animation';
import {
  ARCHETYPE_SLOTS,
  ERA_ORDER,
  PROP_BODY_MATERIAL_ROLE,
  PROP_HAND_MATERIAL_ROLE,
  archetypeAt,
  createCrowdTraits,
  eraCellsForSlot,
  resolveOutfitColor,
  type CrowdTraits,
} from './variants';
import {
  BASE_SLOT_CELLS,
  BASE_SLOTS,
  FIGURE_PROPORTIONS,
  GRID_SLOTS,
  buildFigureGeometry,
  buildFigureMorphSet,
  createFigureMaterialSet,
  createMorphGeometry,
  disposeFigureMaterials,
  slotMaterialRole,
  type FigureMaterialRole,
  type FigureMaterialSet,
  type FigureMorphSet,
  type GridSlot,
} from './figures';

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface PedestriansModuleOptions {
  /** Crowd size; clamped to at least `ARCHETYPE_SLOTS` (default 48). */
  count?: number;
  /** Deterministic seed for traits, gait, and behavior rolls (default 19450902). */
  seed?: number;
  /** Scene graph node the crowd group is attached to. */
  parent?: THREE.Object3D;
  /** Era registry to auto-register into (stage `crowd`). */
  registry?: EraTransformRegistry;
  /** Era the crowd starts dressed in (default 1945). */
  initialEra?: EraYear;
  /** Street half-width; the curb line sits at |z| = curbZ (default 12). */
  curbZ?: number;
  /** X of the two intersections where crossings sit (default 36). */
  intersectionX?: number;
  /** Shared procedural graphics library (defaults to the real one). */
  library?: typeof ProceduralGfxLibrary;
}

/** Documented audio hook vocabulary; playback is owned by the audio task. */
export type PedestrianAudioHookType = 'footstep' | 'chatter';

export const PEDESTRIAN_AUDIO_HOOK_TYPES: readonly PedestrianAudioHookType[] = Object.freeze([
  'footstep',
  'chatter',
]);

export interface PedestrianAudioEvent {
  readonly type: PedestrianAudioHookType;
  /** Monotonic sequence number; start listening from `getAudioEvents(seq)`. */
  readonly seq: number;
  /** Crowd clock in seconds when the cue fired. */
  readonly time: number;
  readonly pedestrianId: string;
  /** Era the crowd is currently dressed in when the cue fired. */
  readonly era: EraYear;
  /** 0..1 loudness hint. */
  readonly intensity: number;
  /** Which foot struck (footstep events only). */
  readonly foot?: 'left' | 'right';
  /** Surface under the pedestrian: sidewalk planks vs crosswalk striping. */
  readonly surface: 'sidewalk' | 'crosswalk';
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
}

/** Pickable descriptor for one representative crowd character. */
export interface PedestrianPickable {
  readonly id: string;
  readonly label: string;
  readonly era: EraYear;
  readonly archetypeKey: string;
  readonly archetypeLabel: string;
  readonly tags: readonly string[];
  readonly behavior: WalkerBehavior;
  /** True for the first pedestrian of each archetype slot. */
  readonly representative: boolean;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly heightM: number;
  readonly ageGroup: 'child' | 'adult' | 'senior';
}

/** Live, read-only view of one pedestrian (used by tests and debugging). */
export interface PedestrianPublicState {
  readonly index: number;
  readonly id: string;
  readonly archetypeIndex: number;
  readonly archetypeKey: string;
  readonly era: EraYear;
  readonly behavior: WalkerBehavior;
  readonly segmentKind: 'lane' | 'crossing';
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly yaw: number;
  /** Smoothed current speed, m/s. */
  readonly speed: number;
  readonly cruiseSpeed: number;
  readonly heightM: number;
  readonly ageGroup: 'child' | 'adult' | 'senior';
  readonly skinTone: string;
  readonly hairTone: string;
  readonly walkPhase: number;
  readonly traveledDistance: number;
  /** Meters per full gait cycle (two steps). */
  readonly strideLength: number;
  readonly u: number;
}

export interface CrowdStats {
  readonly pedestrians: number;
  /** Instanced draw calls currently issued by the crowd group. */
  readonly drawCalls: number;
  readonly instancedMeshes: number;
  /** Total instance slots across all meshes. */
  readonly instanceSlots: number;
  /** True while era weights are mid-morph. */
  readonly morphing: boolean;
  readonly activeEras: number;
}

export interface CrowdMorphInfo {
  readonly stage: 'crowd';
  readonly stageOffset: number;
  readonly progress: number;
  readonly resting: boolean;
  readonly restingEra: EraYear | null;
}

type EraWeights = Map<EraYear, number>;

const ALL_ERAS: readonly EraYear[] = [1945, 1965, 1985, 2005, 2025];

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Era weights implied by a timeline blend (adjacent stops, summing to 1). */
function blendWeights(blend: EraBlend): EraWeights {
  const weights: EraWeights = new Map();
  const f = clamp01(blend.fraction);
  if (f <= 0) {
    weights.set(blend.from, 1);
  } else if (f >= 1) {
    weights.set(blend.to, 1);
  } else {
    weights.set(blend.from, 1 - f);
    weights.set(blend.to, f);
  }
  return weights;
}

function dominantEra(weights: EraWeights): EraYear {
  let best: EraYear = 1945;
  let bestW = -1;
  for (const era of ALL_ERAS) {
    const w = weights.get(era) ?? 0;
    if (w > bestW + 1e-9) {
      bestW = w;
      best = era;
    }
  }
  return best;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

function pedestrianId(index: number): string {
  return `ped-${String(index).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Geometry caches (deterministic across modules; materials stay per-module)
// ---------------------------------------------------------------------------

const libCacheKey = (library: typeof ProceduralGfxLibrary): string =>
  library === ProceduralGfxLibrary ? 'gfx' : 'alt';

const BASE_GEOMETRY_CACHE = new Map<string, THREE.BufferGeometry>();
const MORPH_SET_CACHE = new Map<string, FigureMorphSet | null>();

function getBaseGeometry(
  slot: 'head' | 'handL' | 'handR',
  library: typeof ProceduralGfxLibrary,
): THREE.BufferGeometry {
  const key = `${libCacheKey(library)}|${slot}`;
  let geom = BASE_GEOMETRY_CACHE.get(key);
  if (!geom) {
    geom = buildFigureGeometry(slot, BASE_SLOT_CELLS[slot], library);
    BASE_GEOMETRY_CACHE.set(key, geom);
  }
  return geom;
}

function getMorphSet(
  slot: GridSlot,
  archetypeIndex: number,
  library: typeof ProceduralGfxLibrary,
): FigureMorphSet | null {
  const key = `${libCacheKey(library)}|${slot}|${archetypeIndex}`;
  if (MORPH_SET_CACHE.has(key)) return MORPH_SET_CACHE.get(key) ?? null;
  const set = buildFigureMorphSet(slot, eraCellsForSlot(slot, archetypeIndex), library);
  MORPH_SET_CACHE.set(key, set);
  return set;
}

interface GridMeshEntry {
  readonly slot: GridSlot;
  readonly archetypeIndex: number;
  readonly mesh: THREE.InstancedMesh;
  /** Pedestrian index -> packed instance slot (or -1). */
  readonly packIndex: Int32Array;
  readonly morph: FigureMorphSet;
  /** Packed instance colors per era, ordered by ERA_ORDER, linear RGB. */
  readonly colorByEra: Float32Array[];
}

// Scratch objects for matrix composition (module-scoped, allocation-free).
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _Y_AXIS = new THREE.Vector3(0, 1, 0);
const _root = new THREE.Matrix4();
const _hip = new THREE.Matrix4();
const _neck = new THREE.Matrix4();
const _armL = new THREE.Matrix4();
const _armR = new THREE.Matrix4();
const _legL = new THREE.Matrix4();
const _legR = new THREE.Matrix4();
const _tmpA = new THREE.Matrix4();
const _tmpB = new THREE.Matrix4();
const _color = new THREE.Color();

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export class PedestriansModule implements EraTransformable {
  /** Morph choreography stage required by the era contract. */
  readonly stage = 'crowd' as const;

  /** Crowd root group; attach to `cityRoot` via the `parent` option. */
  readonly group: THREE.Group;

  /** Canonical lane geometry the walkers stay inside. */
  readonly laneConstants: CrowdLaneConstants;
  readonly path: CrowdPath;

  #library: typeof ProceduralGfxLibrary;
  #materials: FigureMaterialSet;
  #traits: CrowdTraits[];
  #walkers: Walker[];
  #rng: { next(): number; range(min: number, max: number): number; rangeInt(min: number, max: number): number };
  #pathInternal: CrowdPath;
  #gridMeshes: GridMeshEntry[] = [];
  #gridMap = new Map<string, GridMeshEntry>();
  #baseMeshes = new Map<'head' | 'handL' | 'handR', THREE.InstancedMesh>();
  #allMeshes: THREE.InstancedMesh[] = [];

  #weights: EraWeights;
  /** Staged target from the era contract; `#weights` chases it at a bounded rate. */
  #targetWeights: EraWeights;
  #hold: EraWeights;
  #lastProgress = 1;
  #stageOffset: number;
  #progress: number;
  #resting: boolean;
  #restingEra: EraYear | null;
  /** Max weight change per second while smoothing toward the target. */
  static readonly #SMOOTH_RATE = 4;

  #clock = 0;
  #eventSeq = 0;
  #events: PedestrianAudioEvent[] = [];
  #listeners = new Set<(event: PedestrianAudioEvent) => void>();
  #unregister: (() => void) | null = null;
  #disposed = false;

  #onCue = (walker: Walker, kind: 'footstep' | 'chatter', foot: 'left' | 'right' | null): void => {
    this.#emitAudio(walker, kind, foot);
  };

  constructor(options: PedestriansModuleOptions = {}) {
    this.#library = options.library ?? ProceduralGfxLibrary;
    const count = Math.max(ARCHETYPE_SLOTS, Math.trunc(options.count ?? 48));
    const seed = options.seed ?? 19450902;
    const initialEra: EraYear = options.initialEra ?? 1945;

    this.laneConstants = resolveLaneConstants({
      curbZ: options.curbZ,
      intersectionX: options.intersectionX,
    });
    this.#pathInternal = createCrowdPath(this.laneConstants);
    this.path = this.#pathInternal;

    this.#traits = createCrowdTraits(count, seed);
    this.#walkers = createWalkers(this.#traits, this.#pathInternal, this.#library.createPRNG(seed + 1337));
    this.#rng = this.#library.createPRNG(seed + 4242);

    // Sample initial positions so pickables are valid before the first tick.
    for (const w of this.#walkers) {
      const p = this.#pathInternal.pointAt(w.u, w.traits.lateralOffset);
      w.x = p.x;
      w.y = p.y;
      w.z = p.z;
      w.yaw = p.travelYaw;
      const s = this.#pathInternal.segmentAt(w.u);
      w.segmentIndex = s.index;
      w.segmentKind = s.segment.kind;
    }

    this.#weights = new Map<EraYear, number>([[initialEra, 1]]);
    this.#targetWeights = new Map(this.#weights);
    this.#hold = new Map(this.#weights);
    this.#stageOffset = eraStageOffset('crowd');
    this.#progress = 1;
    this.#resting = true;
    this.#restingEra = initialEra;

    this.group = new THREE.Group();
    this.group.name = 'pedestrians';

    this.#materials = createFigureMaterialSet(this.#library);
    this.#buildMeshes(initialEra);
    this.#writeMatrices();

    if (options.parent) options.parent.add(this.group);
    if (options.registry) this.register(options.registry);
  }

  // -- construction ---------------------------------------------------------

  #buildMeshes(initialEra: EraYear): void {
    const lib = this.#library;
    const n = this.#traits.length;

    // Era-static base meshes: one instance per pedestrian.
    for (const slot of BASE_SLOTS) {
      const mesh = lib.createCrowdInstancedMesh(
        getBaseGeometry(slot, lib),
        this.#materials[slotMaterialRole(slot)],
        n,
      );
      mesh.frustumCulled = false;
      for (let i = 0; i < n; i++) {
        _color.set(this.#traits[i].skinTone);
        mesh.setColorAt(i, _color);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.#baseMeshes.set(slot, mesh);
      this.#allMeshes.push(mesh);
      this.group.add(mesh);
    }

    // Group pedestrians by their stable archetype slot.
    const members: number[][] = Array.from({ length: ARCHETYPE_SLOTS }, () => []);
    for (let i = 0; i < n; i++) members[this.#traits[i].archetypeIndex].push(i);

    // Era-morphing grid: (slot, archetype) -> one instanced mesh.
    for (const slot of GRID_SLOTS) {
      for (let idx = 0; idx < ARCHETYPE_SLOTS; idx++) {
        const group = members[idx];
        if (group.length === 0) continue;
        const morph = getMorphSet(slot, idx, lib);
        if (!morph) continue;

        const role = this.#propMaterialRole(slot, idx, initialEra);
        const mesh = lib.createCrowdInstancedMesh(
          createMorphGeometry(morph, initialEra),
          this.#materials[role],
          group.length,
        );
        mesh.frustumCulled = false;

        const packIndex = new Int32Array(n).fill(-1);
        const colorByEra: Float32Array[] = [];
        for (const era of ALL_ERAS) {
          const buf = new Float32Array(group.length * 3);
          for (let rank = 0; rank < group.length; rank++) {
            const member = group[rank];
            _color.set(resolveOutfitColor(this.#traits[member], era, slot));
            buf[rank * 3] = _color.r;
            buf[rank * 3 + 1] = _color.g;
            buf[rank * 3 + 2] = _color.b;
          }
          colorByEra[ERA_ORDER[era]] = buf;
        }
        for (let rank = 0; rank < group.length; rank++) packIndex[group[rank]] = rank;

        const initialColors = colorByEra[ERA_ORDER[initialEra]];
        if (mesh.instanceColor) {
          (mesh.instanceColor.array as Float32Array).set(initialColors);
          mesh.instanceColor.needsUpdate = true;
        }

        const entry: GridMeshEntry = {
          slot,
          archetypeIndex: idx,
          mesh,
          packIndex,
          morph,
          colorByEra,
        };
        this.#gridMeshes.push(entry);
        this.#gridMap.set(`${slot}|${idx}`, entry);
        this.#allMeshes.push(mesh);
        this.group.add(mesh);
      }
    }
  }

  #propMaterialRole(slot: GridSlot, archetypeIndex: number, era: EraYear): FigureMaterialRole {
    if (slot === 'propA') {
      return PROP_HAND_MATERIAL_ROLE[archetypeAt(era, archetypeIndex).parts.propA];
    }
    if (slot === 'propB') {
      return PROP_BODY_MATERIAL_ROLE[archetypeAt(era, archetypeIndex).parts.propB];
    }
    return slotMaterialRole(slot);
  }

  // -- era transform contract ------------------------------------------------

  /**
   * Register this crowd into an era-transform registry (stage `crowd`).
   * Returns an unregister function; also invoked automatically by `dispose`.
   */
  register(registry: EraTransformRegistry): () => void {
    if (this.#unregister) this.#unregister();
    this.#unregister = registry.register(this);
    return () => {
      if (this.#unregister) {
        this.#unregister();
        this.#unregister = null;
      }
    };
  }

  /**
   * Apply one transition frame from the morph driver.
   *
   * While the crowd's stage window has not opened (`progress` 0) the crowd
   * holds its current look, which is what orders facades before the crowd.
   * Once open, target weights lerp from the held look to the timeline's
   * position weights. Interrupted transitions stay continuous because a
   * reset to progress 0 re-holds the *current* target look.
   *
   * The staged target can move very fast (the crowd window is only 1/6 of
   * the transition and both the core and the stage apply cubic easing), so
   * `update` realizes the target with a bounded per-frame rate: geometry and
   * colors always move smoothly, never popping, regardless of transition
   * duration or frame rate.
   */
  applyEraBlend(blend: EraBlend, stageOffset: number, progress: number): void {
    if (this.#disposed) return;
    this.#stageOffset = stageOffset;
    const p = clamp01(progress);
    this.#progress = p;

    const target = blendWeights(blend);
    if (p < this.#lastProgress) this.#hold = new Map(this.#targetWeights);
    this.#lastProgress = p;

    const effective: EraWeights = new Map();
    const keys = new Set<EraYear>([...this.#hold.keys(), ...target.keys()]);
    for (const era of keys) {
      const h = this.#hold.get(era) ?? 0;
      const t = target.get(era) ?? 0;
      const v = h + (t - h) * p;
      if (v > 1e-5) effective.set(era, v);
    }
    let sum = 0;
    for (const v of effective.values()) sum += v;
    if (sum > 0 && Math.abs(sum - 1) > 1e-9) {
      for (const [era, v] of effective) effective.set(era, v / sum);
    }
    this.#targetWeights = effective;
  }

  /**
   * Move applied weights toward the staged target at a bounded rate, then
   * push them into the GPU buffers when they changed. Called every update so
   * smoothing is frame-rate aware.
   */
  #smoothWeights(dt: number): void {
    const target = this.#targetWeights;
    const applied = this.#weights;
    let maxDelta = 0;
    const keys = new Set<EraYear>([...applied.keys(), ...target.keys()]);
    let sum = 0;
    for (const era of keys) {
      const t = target.get(era) ?? 0;
      const a = applied.get(era) ?? 0;
      const delta = t - a;
      const step = PedestriansModule.#SMOOTH_RATE * dt;
      const next = Math.abs(delta) <= step ? t : a + Math.sign(delta) * step;
      maxDelta = Math.max(maxDelta, Math.abs(next - (a === undefined ? 0 : a)));
      if (next > 1e-5) applied.set(era, next);
      else applied.delete(era);
      sum += next > 1e-5 ? next : 0;
    }
    if (maxDelta < 1e-9) return; // already converged
    if (sum > 0 && Math.abs(sum - 1) > 1e-9) {
      for (const [era, v] of applied) applied.set(era, v / sum);
    }
    this.#applyBlendToGpu();
  }

  /** Blend current era weights into every grid mesh's vertices and colors. */
  #applyBlendToGpu(): void {
    const active: { era: EraYear; w: number; ei: number }[] = [];
    for (const [era, w] of this.#weights) active.push({ era, w, ei: ERA_ORDER[era] });
    const single = active.length === 1 && active[0].w > 0.9999;
    const restingEra = single ? active[0].era : null;

    if (single && this.#resting && this.#restingEra === restingEra) return;

    for (const g of this.#gridMeshes) {
      const posAttr = g.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      if (restingEra !== null) {
        positions.set(g.morph.positionsByEra[restingEra]);
      } else {
        positions.fill(0);
        for (const a of active) {
          const src = g.morph.positionsByEra[a.era];
          const w = a.w;
          for (let i = 0; i < positions.length; i++) positions[i] += w * src[i];
        }
      }
      posAttr.needsUpdate = true;
      g.mesh.geometry.computeVertexNormals();

      const colorAttr = g.mesh.instanceColor;
      if (colorAttr) {
        const colors = colorAttr.array as Float32Array;
        if (restingEra !== null) {
          colors.set(g.colorByEra[ERA_ORDER[restingEra]]);
        } else {
          colors.fill(0);
          for (const a of active) {
            const src = g.colorByEra[a.ei];
            const w = a.w;
            for (let i = 0; i < colors.length; i++) colors[i] += w * src[i];
          }
        }
        colorAttr.needsUpdate = true;
      }

      // Props may swap material class between eras (paper -> tech); do that
      // only at rest so shading never shifts mid-morph.
      if (restingEra !== null) {
        const role = this.#propMaterialRole(g.slot, g.archetypeIndex, restingEra);
        g.mesh.material = this.#materials[role];
      }
    }

    this.#resting = single;
    this.#restingEra = restingEra;
  }

  // -- simulation -----------------------------------------------------------

  /** Advance behaviors, gait, separation, era-weight smoothing, and matrices. */
  update(deltaSeconds: number): void {
    if (this.#disposed) return;
    const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
    advanceWalkers(this.#walkers, this.#pathInternal, dt, this.#clock, this.#rng, this.#onCue);
    this.#smoothWeights(dt);
    this.#writeMatrices();
    this.#clock += dt;
  }

  #writeInstance(slot: GridSlot, archetypeIndex: number, pedIndex: number, matrix: THREE.Matrix4): void {
    const entry = this.#gridMap.get(`${slot}|${archetypeIndex}`);
    if (!entry) return;
    const packed = entry.packIndex[pedIndex];
    if (packed >= 0) entry.mesh.setMatrixAt(packed, matrix);
  }

  #writeMatrices(): void {
    const P = FIGURE_PROPORTIONS;

    for (const w of this.#walkers) {
      const t = w.traits;
      const pose = w.pose;

      _pos.set(w.x, w.y, w.z);
      _quat.setFromAxisAngle(_Y_AXIS, w.yaw);
      _scale.setScalar(t.heightM / P.nominalHeight);
      _root.compose(_pos, _quat, _scale);

      // Hip frame: root -> translate pelvis -> lean.
      _hip.copy(_root)
        .multiply(_tmpA.makeTranslation(0, P.hipY + pose.bob, pose.sway))
        .multiply(_tmpA.makeRotationZ(pose.lean));
      this.#writeInstance('torso', t.archetypeIndex, t.index, _hip);
      this.#writeInstance('propB', t.archetypeIndex, t.index, _hip);

      // Neck/head frame: hair, hat, and face ride the head; head is base.
      _neck.copy(_hip)
        .multiply(_tmpA.makeTranslation(0, P.neckY, 0))
        .multiply(_tmpA.makeRotationY(pose.headYaw))
        .multiply(_tmpA.makeRotationZ(pose.headPitch));
      const head = this.#baseMeshes.get('head');
      if (head) head.setMatrixAt(t.index, _neck);
      this.#writeInstance('hair', t.archetypeIndex, t.index, _neck);
      this.#writeInstance('hat', t.archetypeIndex, t.index, _neck);
      this.#writeInstance('face', t.archetypeIndex, t.index, _neck);

      // Left arm + hand.
      _armL.copy(_hip)
        .multiply(_tmpA.makeTranslation(0, P.shoulderY, P.shoulderW))
        .multiply(_tmpA.makeRotationZ(pose.armL));
      this.#writeInstance('armL', t.archetypeIndex, t.index, _armL);
      _tmpB.copy(_armL).multiply(_tmpA.makeTranslation(0, -P.armLen, 0));
      const handL = this.#baseMeshes.get('handL');
      if (handL) handL.setMatrixAt(t.index, _tmpB);

      // Right arm + hand + held prop (shares the wrist frame).
      _armR.copy(_hip)
        .multiply(_tmpA.makeTranslation(0, P.shoulderY, -P.shoulderW))
        .multiply(_tmpA.makeRotationZ(pose.armR));
      this.#writeInstance('armR', t.archetypeIndex, t.index, _armR);
      _tmpB.copy(_armR).multiply(_tmpA.makeTranslation(0, -P.armLen, 0));
      const handR = this.#baseMeshes.get('handR');
      if (handR) handR.setMatrixAt(t.index, _tmpB);
      this.#writeInstance('propA', t.archetypeIndex, t.index, _tmpB);

      // Left leg + foot.
      _legL.copy(_hip)
        .multiply(_tmpA.makeTranslation(0, 0, P.hipW))
        .multiply(_tmpA.makeRotationZ(pose.legL));
      this.#writeInstance('legL', t.archetypeIndex, t.index, _legL);
      _tmpB.copy(_legL)
        .multiply(_tmpA.makeTranslation(0, -P.legLen, 0))
        .multiply(_tmpA.makeRotationZ(-0.55 * pose.legL));
      this.#writeInstance('footL', t.archetypeIndex, t.index, _tmpB);

      // Right leg + foot.
      _legR.copy(_hip)
        .multiply(_tmpA.makeTranslation(0, 0, -P.hipW))
        .multiply(_tmpA.makeRotationZ(pose.legR));
      this.#writeInstance('legR', t.archetypeIndex, t.index, _legR);
      _tmpB.copy(_legR)
        .multiply(_tmpA.makeTranslation(0, -P.legLen, 0))
        .multiply(_tmpA.makeRotationZ(-0.55 * pose.legR));
      this.#writeInstance('footR', t.archetypeIndex, t.index, _tmpB);
    }

    for (const mesh of this.#allMeshes) mesh.instanceMatrix.needsUpdate = true;
  }

  // -- audio hooks ----------------------------------------------------------

  /**
   * Subscribe to documented crowd audio hooks. Playback is owned by the
   * audio task; this module only emits `footstep` and `chatter` events.
   */
  onAudioEvent(listener: (event: PedestrianAudioEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Events with `seq >= sinceSeq` (the buffer keeps the newest 8192). */
  getAudioEvents(sinceSeq = 0): readonly PedestrianAudioEvent[] {
    return this.#events.filter((e) => e.seq >= sinceSeq);
  }

  #emitAudio(walker: Walker, kind: PedestrianAudioHookType, foot: 'left' | 'right' | null): void {
    const era = dominantEra(this.#weights);
    const event: PedestrianAudioEvent = {
      type: kind,
      seq: this.#eventSeq++,
      time: this.#clock,
      pedestrianId: pedestrianId(walker.traits.index),
      era,
      intensity:
        kind === 'footstep'
          ? Math.max(0.2, Math.min(1, 0.3 + (walker.currentSpeed / 1.5) * 0.6))
          : 0.55 + ((walker.traits.index % 5) * 0.05),
      ...(foot ? { foot } : {}),
      surface: walker.segmentKind === 'crossing' ? 'crosswalk' : 'sidewalk',
      position: { x: walker.x, y: walker.y, z: walker.z },
    };
    this.#events.push(event);
    if (this.#events.length > 8192) this.#events.shift();
    for (const listener of this.#listeners) listener(event);
  }

  // -- queries --------------------------------------------------------------

  /** Current era weights for all five eras (sums to 1). */
  getEraWeights(): Record<EraYear, number> {
    const out: Record<EraYear, number> = { 1945: 0, 1965: 0, 1985: 0, 2005: 0, 2025: 0 };
    for (const [era, w] of this.#weights) out[era] = w;
    return out;
  }

  /** Morph-driver bookkeeping (stage, progress, rest state). */
  getMorphInfo(): CrowdMorphInfo {
    return {
      stage: 'crowd',
      stageOffset: this.#stageOffset,
      progress: this.#progress,
      resting: this.#resting,
      restingEra: this.#restingEra,
    };
  }

  /** Pickable descriptors for every pedestrian; one representative per archetype. */
  getPickables(): PedestrianPickable[] {
    const era = dominantEra(this.#weights);
    const seen = new Set<number>();
    return this.#walkers.map((w) => {
      const archetypeIndex = w.traits.archetypeIndex;
      const arch = archetypeAt(era, archetypeIndex);
      const representative = !seen.has(archetypeIndex);
      seen.add(archetypeIndex);
      return {
        id: pedestrianId(w.traits.index),
        label: `${arch.label} \u00b7 ${era}`,
        era,
        archetypeKey: arch.key,
        archetypeLabel: arch.label,
        tags: arch.tags,
        behavior: w.behavior,
        representative,
        position: { x: w.x, y: w.y, z: w.z },
        heightM: w.traits.heightM,
        ageGroup: w.traits.ageGroup,
      };
    });
  }

  /** Live pedestrian states for debugging and tests. */
  getPedestrians(): PedestrianPublicState[] {
    const era = dominantEra(this.#weights);
    return this.#walkers.map((w) => {
      const arch = archetypeAt(era, w.traits.archetypeIndex);
      return {
        index: w.traits.index,
        id: pedestrianId(w.traits.index),
        archetypeIndex: w.traits.archetypeIndex,
        archetypeKey: arch.key,
        era,
        behavior: w.behavior,
        segmentKind: w.segmentKind,
        position: { x: w.x, y: w.y, z: w.z },
        yaw: w.yaw,
        speed: w.currentSpeed,
        cruiseSpeed: w.traits.cruiseSpeed,
        heightM: w.traits.heightM,
        ageGroup: w.traits.ageGroup,
        skinTone: w.traits.skinTone,
        hairTone: w.traits.hairTone,
        walkPhase: w.phase,
        traveledDistance: w.traveled,
        strideLength: w.traits.strideLength,
        u: w.u,
      };
    });
  }

  /**
   * Blended instance color (sRGB hex) for one pedestrian's slot under the
   * current era weights; at rest this equals the era's resolved outfit color.
   */
  getSlotColor(pedIndex: number, slot: GridSlot | 'head' | 'handL' | 'handR'): string {
    const t = this.#traits[pedIndex];
    let r = 0;
    let g = 0;
    let b = 0;
    for (const [era, w] of this.#weights) {
      const [er, eg, eb] = hexToRgb(resolveOutfitColor(t, era, slot));
      r += w * er;
      g += w * eg;
      b += w * eb;
    }
    return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
  }

  /** Packed instance slot of one pedestrian in a mesh (-1 when slot unused). */
  getPackedInstanceIndex(slot: GridSlot | 'head' | 'handL' | 'handR', pedIndex: number): number {
    if (slot === 'head' || slot === 'handL' || slot === 'handR') {
      return this.#baseMeshes.has(slot) ? pedIndex : -1;
    }
    const entry = this.#gridMap.get(`${slot}|${this.#traits[pedIndex].archetypeIndex}`);
    return entry ? entry.packIndex[pedIndex] : -1;
  }

  /** Diagnostic accessor to the instanced mesh backing one pedestrian's slot. */
  getSlotMesh(slot: GridSlot | 'head' | 'handL' | 'handR', pedIndex: number): THREE.InstancedMesh | null {
    if (slot === 'head' || slot === 'handL' || slot === 'handR') {
      return this.#baseMeshes.get(slot) ?? null;
    }
    const entry = this.#gridMap.get(`${slot}|${this.#traits[pedIndex].archetypeIndex}`);
    return entry ? entry.mesh : null;
  }

  /** Instancing/performance stats: draw calls never scale with crowd size. */
  getStats(): CrowdStats {
    let instanceSlots = 0;
    for (const mesh of this.#allMeshes) instanceSlots += mesh.count;
    return {
      pedestrians: this.#traits.length,
      drawCalls: this.#allMeshes.length,
      instancedMeshes: this.#allMeshes.length,
      instanceSlots,
      morphing: !this.#resting,
      activeEras: this.#weights.size,
    };
  }

  // -- teardown -------------------------------------------------------------

  /**
   * Unregister from the era registry, detach the group, and release
   * per-module GPU/material resources. Shared geometry caches are retained
   * (deterministic and reusable); `update`/`applyEraBlend` become no-ops.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#unregister) {
      this.#unregister();
      this.#unregister = null;
    }
    this.group.removeFromParent();
    // Morph geometries are per-module; base geometries are a shared cache.
    for (const g of this.#gridMeshes) g.mesh.geometry.dispose();
    for (const mesh of this.#allMeshes) mesh.dispose();
    this.#allMeshes = [];
    this.#gridMeshes = [];
    this.#gridMap.clear();
    this.#baseMeshes.clear();
    disposeFigureMaterials(this.#materials);
    this.#listeners.clear();
    this.#events = [];
  }
}

/** Convenience factory around `new PedestriansModule(...)`. */
export function createPedestriansModule(options: PedestriansModuleOptions = {}): PedestriansModule {
  return new PedestriansModule(options);
}

// ---------------------------------------------------------------------------
// Public barrel: era outfit catalog, figure builders, and lane animation
// ---------------------------------------------------------------------------

export * from './animation';
export * from './figures';
export * from './variants';
