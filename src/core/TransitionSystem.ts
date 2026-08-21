import * as THREE from 'three';
import type { EraId } from '../eras/types';
import { ERA_IDS, isEraId } from '../eras/types';
import type { EraTransitionState, TimelineController } from './TimelineController';
import type { AudioBus } from './AudioBus';
import { disposeEraSceneContent } from './EraRegistry';
import type { EraRegistry, EraSceneContent } from './EraRegistry';

/**
 * Shared transition engine.
 *
 * Consumes TimelineController's normalized eased t-value and turns it into a
 * per-era weight map (outgoing era -> 1-t, incoming era -> t). Every visual
 * property is recomputed each tick from immutable base snapshots captured at
 * bind time, so applications are absolute rather than incremental: dragging
 * the slider mid-transition simply produces a new (from, to, t) triple and the
 * very next tick writes consistent values everywhere — no accumulation, no
 * corrupted state, bidirectional by construction.
 *
 * A short exponential "chase" (default 120 ms) bridges the instant a
 * retarget swaps the active (from, to) pair, keeping the crossfade continuous
 * instead of popping. Displayed weights converge exactly to the controller's
 * t-value whenever the timeline is settled, so endpoints stay deterministic.
 * Sibling systems needing pixel-perfect coupling should read
 * {@link TransitionSystem.weights} — the published authoritative weights —
 * instead of re-deriving them.
 */

/** Weight map derived from one controller snapshot. */
export function computePairWeights(state: EraTransitionState): Map<EraId, number> {
  const weights = new Map<EraId, number>();
  const t = state.t < 0 ? 0 : state.t > 1 ? 1 : state.t;
  for (const id of ERA_IDS) {
    weights.set(id, 0);
  }
  weights.set(state.from, state.from === state.to ? 1 : 1 - t);
  weights.set(state.to, state.from === state.to ? 1 : t);
  return weights;
}

export interface TransitionSystemOptions {
  /** Single source of truth for the normalized t-value. */
  readonly timeline: TimelineController;
  /** Registry supplying lazy-built era content. */
  readonly registry: EraRegistry;
  /** Optional per-era channel bus faded in lockstep with the visuals. */
  readonly audioBus?: AudioBus;
  /** Scene node era groups attach to. Omit to manage detached groups. */
  readonly container?: THREE.Object3D;
  /** Vertical travel (meters) while an era fades in/out. Default 6. */
  readonly riseDistance?: number;
  /** Scale floor for fully-faded eras (avoids degenerate matrices). Default 0.001. */
  readonly minScaleFactor?: number;
  /**
   * Time constant of the continuity chase across mid-transition retargets.
   * `0` disables smoothing (exact raw-t passthrough). Default 0.12.
   */
  readonly retargetSmoothingSeconds?: number;
  /**
   * Millisecond clock used to measure time between controller emissions.
   * Defaults to `performance.now`; inject a fake clock for deterministic
   * tests. Must be monotonic.
   */
  readonly clockMs?: () => number;
}

interface EraMaterialBinding {
  readonly material: THREE.Material;
  readonly baseOpacity: number;
  readonly baseTransparent: boolean;
  readonly baseDepthWrite: boolean;
  readonly baseEmissiveIntensity: number | null;
}

interface EraBinding {
  readonly content: EraSceneContent;
  readonly basePosition: THREE.Vector3;
  readonly baseScale: THREE.Vector3;
  readonly materials: EraMaterialBinding[];
  blendFailed: boolean;
}

const VISIBLE_WEIGHT_EPSILON = 1e-3;
const OPAQUE_WEIGHT_THRESHOLD = 0.999;
const WEIGHT_SNAP_EPSILON = 1e-4;
const MAX_FRAME_SECONDS = 0.25;

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

function nowSeconds(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** Capture every distinct material under a group with its authored state. */
function collectMaterials(group: THREE.Object3D): EraMaterialBinding[] {
  const seen = new Set<THREE.Material>();
  const collected: EraMaterialBinding[] = [];
  group.traverse((object) => {
    const material = (object as THREE.Mesh).material;
    if (!material) {
      return;
    }
    for (const entry of Array.isArray(material) ? material : [material]) {
      if (seen.has(entry)) {
        continue;
      }
      seen.add(entry);
      const emissiveSource = entry as Partial<THREE.MeshStandardMaterial>;
      collected.push({
        material: entry,
        baseOpacity: entry.opacity,
        baseTransparent: entry.transparent,
        baseDepthWrite: entry.depthWrite,
        baseEmissiveIntensity:
          typeof emissiveSource.emissiveIntensity === 'number'
            ? emissiveSource.emissiveIntensity
            : null,
      });
    }
  });
  return collected;
}

export class TransitionSystem {
  readonly #timeline: TimelineController;
  readonly #registry: EraRegistry;
  readonly #audioBus: AudioBus | undefined;
  readonly #container: THREE.Object3D | undefined;
  readonly #riseDistance: number;
  readonly #minScaleFactor: number;
  readonly #smoothingTau: number;
  readonly #clockMs: () => number;

  readonly #bindings = new Map<EraId, EraBinding>();
  readonly #targets = new Map<EraId, number>();
  readonly #weights = new Map<EraId, number>();

  #lastTickSeconds: number | null = null;
  #disposed = false;
  readonly #unsubscribeTimeline: () => void;
  readonly #unsubscribeInvalidations: () => void;

  constructor(options: TransitionSystemOptions) {
    this.#timeline = options.timeline;
    this.#registry = options.registry;
    this.#audioBus = options.audioBus;
    this.#container = options.container;
    this.#riseDistance = Math.max(options.riseDistance ?? 6, 0);
    this.#minScaleFactor = Math.min(Math.max(options.minScaleFactor ?? 0.001, 1e-6), 1);
    const tau = options.retargetSmoothingSeconds ?? 0.12;
    this.#smoothingTau = Number.isFinite(tau) ? Math.max(tau, 0) : 0;
    this.#clockMs = options.clockMs ?? nowSeconds;

    for (const id of ERA_IDS) {
      this.#targets.set(id, 0);
      this.#weights.set(id, 0);
    }

    this.#unsubscribeTimeline = this.#timeline.subscribe(this.#handleTimeline);
    this.#unsubscribeInvalidations = this.#registry.onInvalidate(this.#handleInvalidate);
  }

  /** Select an era through the shared clock (duration lives on the controller). */
  setEra(id: EraId): void {
    if (!isEraId(id)) {
      throw new TypeError(
        `TransitionSystem: unknown era "${String(id)}" (expected one of ${ERA_IDS.join(', ')})`,
      );
    }
    this.#timeline.setEra(id);
  }

  /**
   * Published per-era presence weights (0..1) — the single shared readout all
   * subsystems should consume so buildings, vehicles, pedestrians,
   * storefronts, ads and audio stay in lockstep.
   */
  get weights(): ReadonlyMap<EraId, number> {
    return this.#weights;
  }

  get transitionState(): EraTransitionState {
    return this.#timeline.transitionState;
  }

  /** Eras whose content is currently built and bound. */
  boundIds(): EraId[] {
    return [...this.#bindings.keys()];
  }

  isBound(id: EraId): boolean {
    return this.#bindings.has(id);
  }

  /** Detach from clock/registry and release every bound era's resources. */
  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#unsubscribeTimeline();
    this.#unsubscribeInvalidations();
    for (const id of [...this.#bindings.keys()]) {
      this.#unbind(id);
    }
  }

  #handleTimeline = (state: EraTransitionState): void => {
    if (this.#disposed) {
      return;
    }
    const now = this.#clockMs();
    const previous = this.#lastTickSeconds;
    this.#lastTickSeconds = now;
    const dt =
      previous === null ? 0 : Math.min(Math.max(now - previous, 0) / 1000, MAX_FRAME_SECONDS);

    const targets = computePairWeights(state);
    for (const [id, target] of targets) {
      this.#targets.set(id, target);
    }

    // Continuity chase: displayed weights follow the controller-derived
    // targets; settled states (and the very first tick) snap exactly so the
    // published weights always converge on the shared normalized t-value.
    const isFirstEmission = previous === null;
    for (const [id, target] of targets) {
      const current = this.#weights.get(id) ?? 0;
      let next: number;
      if (state.settled || this.#smoothingTau === 0 || isFirstEmission) {
        // Settled, smoothing disabled, or initial binding: exact passthrough.
        next = target;
      } else if (dt > 0) {
        const alpha = 1 - Math.exp(-dt / this.#smoothingTau);
        next = current + (target - current) * alpha;
        if (Math.abs(target - next) < WEIGHT_SNAP_EPSILON) {
          next = target;
        }
      } else {
        // Zero elapsed time (e.g. a synchronous mid-transition setEra
        // retarget): hold the current blend so retargeting never teleports
        // weights; the next tick continues the chase from here.
        next = current;
      }
      this.#weights.set(id, next);
    }

    // Lazy-build content for every era the transition needs.
    for (const id of ERA_IDS) {
      if ((this.#targets.get(id) ?? 0) > 0 && !this.#bindings.has(id)) {
        this.#bind(id);
      }
    }

    for (const [id, binding] of this.#bindings) {
      this.#apply(binding, this.#weights.get(id) ?? 0);
    }

    this.#audioBus?.applyEraWeights(this.#weights);
  };

  #handleInvalidate = (eraId: EraId): void => {
    if (this.#disposed || !this.#bindings.has(eraId)) {
      return;
    }
    // Runtime content swap: the registry already disposed the old instance;
    // rebuild from the freshly registered builder if the era is in play.
    this.#unbind(eraId);
    const weight = Math.max(this.#targets.get(eraId) ?? 0, this.#weights.get(eraId) ?? 0);
    if (weight > 0) {
      this.#bind(eraId);
    }
  };

  #bind(eraId: EraId): void {
    const content = this.#registry.build(eraId);
    const binding: EraBinding = {
      content,
      basePosition: content.group.position.clone(),
      baseScale: content.group.scale.clone(),
      materials: collectMaterials(content.group),
      blendFailed: false,
    };
    this.#container?.add(content.group);
    if (this.#audioBus) {
      this.#audioBus.registerEra(eraId, content.audio ?? {});
    }
    this.#bindings.set(eraId, binding);
    this.#apply(binding, this.#weights.get(eraId) ?? 0);
  }

  #unbind(eraId: EraId): void {
    const binding = this.#bindings.get(eraId);
    if (!binding) {
      return;
    }
    this.#bindings.delete(eraId);
    this.#container?.remove(binding.content.group);
    this.#audioBus?.unregisterEra(eraId);
    disposeEraSceneContent(binding.content);
  }

  /** Write absolute interpolated presentation state for one era. */
  #apply(binding: EraBinding, rawWeight: number): void {
    const weight = clamp01(rawWeight);
    const content = binding.content;
    const group = content.group;

    group.visible = weight > VISIBLE_WEIGHT_EPSILON;
    group.position.copy(binding.basePosition);
    group.position.y -= this.#riseDistance * (1 - weight);
    group.scale.copy(binding.baseScale).multiplyScalar(Math.max(weight, this.#minScaleFactor));

    const opaque = weight >= OPAQUE_WEIGHT_THRESHOLD;
    for (const entry of binding.materials) {
      entry.material.opacity = entry.baseOpacity * weight;
      entry.material.transparent = entry.baseTransparent || !opaque;
      entry.material.depthWrite = entry.baseDepthWrite && opaque;
      if (entry.baseEmissiveIntensity !== null) {
        (entry.material as THREE.MeshStandardMaterial).emissiveIntensity =
          entry.baseEmissiveIntensity * weight;
      }
    }

    if (typeof content.blend === 'function') {
      try {
        content.blend(weight);
      } catch (error) {
        if (!binding.blendFailed) {
          binding.blendFailed = true;
          console.error(`TransitionSystem: blend hook failed for era "${content.id}"`, error);
        }
      }
    }
  }
}
