/**
 * Era-transition choreography: animated visual hand-off between eras.
 *
 * The renderer shell / future scene director drives {@link TransitionController}
 * from its render loop. A transition crossfades two era root groups:
 *
 * - the OUTGOING group fades out (opacity 1 → 0) and shrinks toward half size,
 *   then is detached from the scene graph when the hand-off finishes;
 * - the INCOMING group fades in (opacity 0 → 1) and grows from half size into
 *   place, ending fully opaque at unit scale.
 *
 * Both sides ride the same smoothstep-style cubic ease-in-out curve over
 * {@link DEFAULT_TRANSITION_DURATION} (1.2 s), so the swap reads as one live
 * cinematic morph instead of a hard cut ("the scene transforms in front of
 * your eyes").
 *
 * Rapid slider changes are handled gracefully: starting a new transition
 * mid-flight never snaps anything. The group that was fading IN is folded into
 * the fade-out pile AT ITS CURRENT VISUAL STATE (captured opacity/scale), so it
 * keeps receding smoothly instead of popping; the previously outgoing group
 * simply continues its own fade. Every stale layer is detached exactly once
 * when the newest hand-off completes, so no orphaned groups remain.
 */

import type * as THREE from 'three';

/** Duration of one full era hand-off, in seconds. */
export const DEFAULT_TRANSITION_DURATION = 1.2;

/**
 * Progress of the lifecycle exposed by {@link TransitionController.getState}.
 *
 * - `idle`: no hand-off has been started (or the controller was disposed).
 * - `running`: a hand-off is animating; feed `update(dt)` every frame.
 * - `complete`: the newest hand-off finished; the controller accepts a new
 *   `start()` call immediately (which returns to `running`).
 */
export type TransitionState = 'idle' | 'running' | 'complete';

export interface TransitionControllerOptions {
  /** Hand-off length in seconds. Defaults to {@link DEFAULT_TRANSITION_DURATION}. */
  readonly duration?: number;
}

/**
 * Minimal structural subset of `THREE.Object3D` the controller touches. Real
 * `THREE.Group` instances satisfy it outright; tests inject lightweight stubs.
 */
export interface EraGroupLike {
  /** Detaches `child` from this group's children (scene-graph removal). */
  remove(child: EraGroupLike): void;
  /** Parent in the scene graph, or `null` when the group is detached. */
  readonly parent: EraGroupLike | null;
  /** Object3D visibility flag. */
  visible: boolean;
  /** Uniform scale, animated during the hand-off (`THREE.Vector3`). */
  scale: THREE.Vector3;
  /** Direct children, walked by {@link EraGroupLike.traverse}. */
  readonly children: readonly EraGroupLike[];
  /** Depth-first walk over this group and every descendant. */
  traverse(callback: (child: EraGroupLike) => void): void;
}

/** Fractional material surface the fade actually mutates. */
interface FadeableMaterial {
  opacity: number;
  transparent: boolean;
}

interface MaterialHolder {
  material?: unknown;
}

/** Collects every material slot an object exposes (single or array form). */
function materialsOf(object: EraGroupLike): FadeableMaterial[] {
  const material = (object as MaterialHolder).material;
  if (!material) return [];
  const slots = Array.isArray(material) ? material : [material];
  return slots.filter(
    (slot): slot is FadeableMaterial =>
      typeof slot === 'object' && slot !== null && 'opacity' in slot,
  );
}

/** Scale the incoming group grows from / outgoing group shrinks toward. */
const EDGE_SCALE = 0.5;

/** One group receding out of the scene, frozen at its captured look. */
interface FadingLayer {
  readonly group: EraGroupLike;
  readonly fromOpacity: number;
  readonly fromScale: number;
}

export class TransitionController {
  #duration: number;
  #state: TransitionState = 'idle';
  #disposed = false;

  /** Elapsed seconds inside the active hand-off. */
  #elapsed = 0;

  /** Group growing into place, or `null` outside a running hand-off. */
  #incoming: EraGroupLike | null = null;

  /**
   * Groups receding out of the scene. May hold several entries at once when
   * the slider is spammed: each keeps its own captured start look so nothing
   * pops, and every entry is detached when the hand-off finishes.
   */
  #fadingOut: FadingLayer[] = [];

  #onComplete: (() => void) | null = null;

  /** Original `transparent` flag per touched material, restored on settle. */
  #originalTransparent = new Map<FadeableMaterial, boolean>();

  constructor(options: TransitionControllerOptions = {}) {
    const duration = options.duration ?? DEFAULT_TRANSITION_DURATION;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new RangeError(
        `TransitionController: duration must be a positive finite number, got ${String(duration)}.`,
      );
    }
    this.#duration = duration;
  }

  /** Lifecycle position: `idle` → `running` → `complete` (repeatable). */
  getState(): TransitionState {
    return this.#state;
  }

  /** Raw timeline position of the active hand-off, 0..1 (0 when idle). */
  getProgress(): number {
    if (this.#state !== 'running') return this.#state === 'complete' ? 1 : 0;
    return Math.min(1, this.#elapsed / this.#duration);
  }

  /**
   * Begins the hand-off from `outgoing` to `incoming`.
   *
   * Safe against rapid slider changes: while another hand-off is mid-flight it
   * is cancelled first — the group that was fading in keeps receding from its
   * current look (blend, no glitch), older layers continue undisturbed, and
   * the superseded `onComplete` never fires. Only the newest hand-off's
   * completion callback runs, exactly once.
   *
   * @param outgoing group leaving the scene (detached on completion); may be
   *   `null` for a pure fade-in.
   * @param incoming group growing into place; must not be disposed.
   * @param onComplete invoked once when THIS hand-off settles.
   */
  start(
    outgoing: EraGroupLike | null,
    incoming: EraGroupLike,
    onComplete?: () => void,
  ): void {
    if (this.#disposed) {
      throw new Error('TransitionController: cannot start after dispose().');
    }
    if (this.#state === 'running') {
      this.#cancelActive();
    }

    this.#incoming = incoming;
    this.#onComplete = onComplete ?? null;
    this.#fadingOut = this.#fadingOut.filter((layer) => layer.group !== incoming);

    if (outgoing && outgoing !== incoming) {
      const duplicate = this.#fadingOut.some((layer) => layer.group === outgoing);
      if (!duplicate) {
        this.#fadingOut.push({ group: outgoing, fromOpacity: 1, fromScale: 1 });
      }
      outgoing.visible = true;
    }

    // Incoming starts hidden and small, ready to grow into place.
    incoming.visible = true;
    this.#applyFade(incoming, 0);
    incoming.scale.set(EDGE_SCALE, EDGE_SCALE, EDGE_SCALE);

    this.#elapsed = 0;
    this.#state = 'running';
  }

  /**
   * Advances the active hand-off by `dt` seconds. Called from the director's
   * render loop; inert while idle, complete, disposed, or given non-positive /
   * non-finite deltas.
   */
  update(dt: number): void {
    if (this.#disposed || this.#state !== 'running') return;
    if (!Number.isFinite(dt) || dt <= 0) return;

    this.#elapsed += dt;
    const raw = Math.min(1, this.#elapsed / this.#duration);
    const eased = easeInOutCubic(raw);

    if (this.#incoming) {
      this.#applyFade(this.#incoming, eased);
      const scale = EDGE_SCALE + (1 - EDGE_SCALE) * eased;
      this.#incoming.scale.set(scale, scale, scale);
    }

    for (const layer of this.#fadingOut) {
      this.#applyFade(layer.group, layer.fromOpacity * (1 - eased));
      const scale = layer.fromScale * (1 - (1 - EDGE_SCALE) * eased);
      layer.group.scale.set(scale, scale, scale);
    }

    if (raw >= 1) {
      this.#settle(true);
    }
  }

  /**
   * Cleans up the controller. An in-flight hand-off settles immediately
   * WITHOUT firing `onComplete`: stale groups are detached, the incoming group
   * is restored to full visibility, and all mutated materials recover their
   * original transparency flags. Idempotent; `start()` throws afterwards.
   */
  dispose(): void {
    if (this.#disposed) return;
    if (this.#state === 'running') {
      this.#settle(false);
    }
    this.#disposed = true;
    this.#state = 'idle';
    this.#onComplete = null;
  }

  // -----------------------------------------------------------------------
  // internals
  // -----------------------------------------------------------------------

  /** Cancels a running hand-off, blending its incoming group into the fade-out pile. */
  #cancelActive(): void {
    const eased = easeInOutCubic(this.getProgress());
    const incoming = this.#incoming;
    if (incoming) {
      const duplicate = this.#fadingOut.some((layer) => layer.group === incoming);
      if (!duplicate) {
        // Freeze the current look; the next curve continues it downward.
        this.#fadingOut.push({
          group: incoming,
          fromOpacity: Math.max(eased, Number.EPSILON),
          fromScale: EDGE_SCALE + (1 - EDGE_SCALE) * eased,
        });
      }
    }
    this.#incoming = null;
    this.#onComplete = null; // superseded hand-off never reports completion
  }

  /** Ends the active hand-off: detach stale groups, restore the survivor. */
  #settle(fireCallback: boolean): void {
    for (const layer of this.#fadingOut) {
      layer.group.visible = false;
      detach(layer.group);
    }
    this.#fadingOut = [];

    if (this.#incoming) {
      this.#incoming.visible = true;
      this.#applyFade(this.#incoming, 1);
      this.#incoming.scale.set(1, 1, 1);
      this.#incoming = null;
    }

    this.#restoreMaterials();
    this.#elapsed = 0;
    this.#state = 'complete';

    if (fireCallback) {
      const callback = this.#onComplete;
      this.#onComplete = null;
      callback?.();
    } else {
      this.#onComplete = null;
    }
  }

  /** Writes `opacity` onto every material under `root`, remembering originals. */
  #applyFade(root: EraGroupLike, opacity: number): void {
    root.traverse((node) => {
      for (const material of materialsOf(node)) {
        if (!this.#originalTransparent.has(material)) {
          this.#originalTransparent.set(material, material.transparent);
        }
        material.opacity = opacity;
        material.transparent = opacity < 1 ? true : this.#originalTransparent.get(material)!;
      }
    });
  }

  /** Restores every touched material's original transparency flag. */
  #restoreMaterials(): void {
    for (const [material, transparent] of this.#originalTransparent) {
      material.transparent = transparent;
    }
    this.#originalTransparent.clear();
  }
}

// ---------------------------------------------------------------------------

/** Detaches a group from its parent, if it still has one. */
function detach(group: EraGroupLike): void {
  group.parent?.remove(group);
}

/** Cubic ease-in-out: slow start, brisk middle, gentle landing. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export default TransitionController;
