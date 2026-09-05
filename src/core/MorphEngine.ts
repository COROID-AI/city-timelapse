/**
 * src/core/MorphEngine.ts — era morph engine and shared morph timeline.
 *
 * The single camera-agnostic scheduler every animation in the app plugs into:
 *  - vertex-level morphing between per-era anchor groups (three.js morph targets
 *    on GPU; identical slot topology across eras => lossless interop),
 *  - lerped numeric and color uniforms (lighting/weather/etc. bind here),
 *  - material texture swap at the transition midpoint,
 *  - animated construction scaffolds during transitions,
 *  - continuous "time fraction" scrubbing for the timeline slider.
 *
 * The engine never references a camera or renderer; `update(dt)` is driven by
 * the render loop so scheduling is entirely time-based.
 */

import * as THREE from 'three';

import {
  ERA_ANCHOR_SLOTS,
  ERA_IDS,
  ERA_SCENE_STATES,
  type EraAnchor,
  type EraAnchorSet,
  type EraId,
  type EraSceneState,
} from '../eras';

export type EasingFn = (t: number) => number;

export const MORPH_DEFAULT_DURATION_MS = 2000;
export const MORPH_REDUCED_DURATION_MS = 500;

export function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Symmetric cubic ease used for every morph transition. */
export const easeInOutCubic: EasingFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export interface MorphTimelineState {
  /** Eased progress 0..1 within the active transition. */
  progress: number;
  fromEra: EraId;
  toEra: EraId;
  active: boolean;
}

export type MorphDriver = (progress: number, fromEra: EraId, toEra: EraId) => void;

/** Reads a per-era value out of an era scene state (for uniform drivers). */
export type EraValueReader<T> = (state: EraSceneState) => T;

/** A material that owns a single texture slot. */
export type TexturedMaterial = THREE.Material & { map: THREE.Texture | null };

export interface MorphEngineOptions {
  /** Duration of a single era-to-era transition in ms. Default 2000. */
  durationMs?: number;
  /** Duration honoured when the user prefers reduced motion. Default 500. */
  reducedDurationMs?: number;
  ease?: EasingFn;
  /** Auto-build a construction scaffold per anchor slot. Default true. */
  buildScaffolds?: boolean;
}

// ---------------------------------------------------------------------------
// Construction scaffold (shown/faded during transitions)
// ---------------------------------------------------------------------------

/** Simple procedural scaffold cage that rises around an anchor box mid-morph. */
export class ScaffoldAnimation {
  readonly group = new THREE.Group();
  private readonly materials: THREE.MeshStandardMaterial[] = [];

  constructor(anchor: EraAnchor) {
    const height = anchor.height * 1.35;
    const halfW = anchor.width / 2 + 0.12;
    const halfD = anchor.depth / 2 + 0.12;
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0xffbe5c,
      transparent: true,
      opacity: 0,
      roughness: 0.65,
      metalness: 0.15,
    });
    this.materials.push(poleMat);
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, height, 0.08), poleMat);
      pole.position.set(sx * halfW, height / 2, sz * halfD);
      this.group.add(pole);
    }
    const tieMat = new THREE.MeshStandardMaterial({
      color: 0xffbe5c,
      transparent: true,
      opacity: 0,
      roughness: 0.7,
      metalness: 0.1,
    });
    this.materials.push(tieMat);
    for (let tier = 1; tier <= 3; tier += 1) {
      const tie = new THREE.Mesh(
        new THREE.BoxGeometry(anchor.width + 0.24, 0.05, anchor.depth + 0.24),
        tieMat,
      );
      tie.position.set(0, (height / 4) * tier, 0);
      this.group.add(tie);
    }
    this.group.visible = false;
    this.group.name = 'scaffold';
  }

  /** progress 0..1 — scaffold rises, fades in, then fades out. */
  update(progress: number): void {
    if (progress <= 0 || progress >= 1) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.group.position.y = Math.sin(progress * Math.PI) * 0.6;
    const opacity = Math.sin(progress * Math.PI) * 0.85;
    for (const material of this.materials) {
      material.opacity = opacity;
    }
  }

  dispose(): void {
    for (const material of this.materials) {
      material.dispose();
    }
    this.group.clear();
  }
}

// ---------------------------------------------------------------------------
// Anchor morph slot — per-era vertex morph target on a shared topology
// ---------------------------------------------------------------------------

/**
 * One anchor slot (doorway/window/shelf) whose mesh runs GPU vertex morphs
 * between every era's anchor dimensions. The base geometry is a segmented box
 * built from a *neutral* anchor; each era contributes a morph target scaled by
 * (eraWidth/nBase, eraHeight/nBase, eraDepth/nBase). Because every era uses the
 * same template topology, morphing between any adjacent eras is index-lossless.
 */
export class AnchorMorphSlot {
  readonly slot: keyof EraAnchorSet;
  readonly mesh: THREE.Mesh;
  private readonly eraTargetIndex = new Map<EraId, number>();
  private readonly eraAnchors: Record<EraId, EraAnchorSet>;

  constructor(
    slot: keyof EraAnchorSet,
    neutralAnchor: EraAnchor,
    material: THREE.Material,
    eraAnchors: Record<EraId, EraAnchorSet> = ERA_ANCHOR_SLOTS,
  ) {
    this.slot = slot;
    this.eraAnchors = eraAnchors;
    const geometry = new THREE.BoxGeometry(
      neutralAnchor.width,
      neutralAnchor.height,
      neutralAnchor.depth,
      4,
      4,
      2,
    ).toNonIndexed();
    const positions = geometry.attributes.position as THREE.BufferAttribute;
    const count = positions.count;

    const targets: THREE.BufferAttribute[] = [];
    ERA_IDS.forEach((id, index) => {
      const anchor = eraAnchors[id][slot];
      const sx = anchor.width / neutralAnchor.width;
      const sy = anchor.height / neutralAnchor.height;
      const sz = anchor.depth / neutralAnchor.depth;
      const array = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        array[i * 3] = positions.getX(i) * sx;
        array[i * 3 + 1] = positions.getY(i) * sy;
        array[i * 3 + 2] = positions.getZ(i) * sz;
      }
      targets.push(new THREE.BufferAttribute(array, 3));
      this.eraTargetIndex.set(id, index);
    });
    geometry.morphAttributes.position = targets;

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = `anchor-${slot}`;
    this.mesh.morphTargetInfluences = new Array<number>(ERA_IDS.length).fill(0);
  }

  /** Drive the GPU morph from `fromEra` toward `toEra` by progress 0..1. */
  setPose(progress: number, fromEra: EraId, toEra: EraId): void {
    const influences = this.mesh.morphTargetInfluences;
    if (!influences) {
      return;
    }
    for (let i = 0; i < influences.length; i += 1) {
      influences[i] = 0;
    }
    const fromIndex = this.eraTargetIndex.get(fromEra);
    const toIndex = this.eraTargetIndex.get(toEra);
    if (fromIndex !== undefined) {
      influences[fromIndex] = 1 - clamp01(progress);
    }
    if (toIndex !== undefined) {
      influences[toIndex] = clamp01(progress);
    }
    // Lerp the slot origin too, so the morph lands exactly on the declared
    // per-era anchor position as well as its dimensions.
    const from = this.eraAnchors[fromEra][this.slot];
    const to = this.eraAnchors[toEra][this.slot];
    this.mesh.position.x = lerp(from.x, to.x, clamp01(progress));
    this.mesh.position.y = lerp(from.y, to.y, clamp01(progress));
    this.mesh.position.z = lerp(from.z, to.z, clamp01(progress));
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}

// ---------------------------------------------------------------------------
// Morph engine
// ---------------------------------------------------------------------------

interface NumericUniformBinding {
  uniforms: Record<string, THREE.IUniform>;
  key: string;
  from: EraValueReader<number> | null;
  to: EraValueReader<number> | null;
  fromValue: number;
  toValue: number;
}

interface ColorUniformBinding {
  uniforms: Record<string, THREE.IUniform>;
  key: string;
  from: EraValueReader<THREE.Color> | null;
  to: EraValueReader<THREE.Color> | null;
  fromValue: THREE.Color;
  toValue: THREE.Color;
}

interface ColorLike {
  r: number;
  g: number;
  b: number;
}

export class MorphEngine {
  readonly group = new THREE.Group();
  private readonly durationMs: number;
  private readonly ease: EasingFn;
  private readonly buildScaffolds: boolean;
  private currentEra: EraId = ERA_IDS[0];
  private transition: { fromEra: EraId; toEra: EraId; elapsedMs: number } | null = null;
  private readonly anchors = new Map<keyof EraAnchorSet, AnchorMorphSlot>();
  private readonly scaffolds: ScaffoldAnimation[] = [];
  private readonly numericBindings: NumericUniformBinding[] = [];
  private readonly colorBindings: ColorUniformBinding[] = [];
  private readonly textureSwaps: {
    material: TexturedMaterial;
    from: EraValueReader<THREE.Texture | null> | null;
    to: EraValueReader<THREE.Texture | null> | null;
    fromTex: THREE.Texture | null;
    toTex: THREE.Texture | null;
  }[] = [];
  private readonly drivers: MorphDriver[] = [];
  private readonly timelineListeners: ((state: MorphTimelineState) => void)[] = [];

  constructor(options: MorphEngineOptions = {}) {
    this.group.name = 'MorphEngine';
    this.durationMs = options.durationMs ?? MORPH_DEFAULT_DURATION_MS;
    this.ease = options.ease ?? easeInOutCubic;
    this.buildScaffolds = options.buildScaffolds ?? true;

    if (options.reducedDurationMs !== undefined && typeof window !== 'undefined') {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
      if (reduced) {
        this.durationMs = options.reducedDurationMs;
      }
    }
  }

  // --- Anchor slots ---------------------------------------------------------

  /** Register a prebuilt anchor morph slot and attach it to the engine group. */
  addAnchorSlot(slot: AnchorMorphSlot): AnchorMorphSlot {
    this.anchors.set(slot.slot, slot);
    this.group.add(slot.mesh);
    if (this.buildScaffolds) {
      const scaffold = new ScaffoldAnimation(ERA_ANCHOR_SLOTS[this.currentEra][slot.slot]);
      this.group.add(scaffold.group);
      this.scaffolds.push(scaffold);
    }
    return slot;
  }

  /**
   * Build an anchor morph slot for `slot` using the era anchors from eras.ts.
   */
  createAnchorSlot(
    slot: keyof EraAnchorSet,
    material: THREE.Material,
    neutralAnchor: EraAnchor = { x: 0, y: 0, z: 0, width: 1, height: 2, depth: 0.5 },
  ): AnchorMorphSlot {
    return this.addAnchorSlot(new AnchorMorphSlot(slot, neutralAnchor, material));
  }

  // --- Timeline & uniforms ---------------------------------------------------

  /** Bind a numeric uniform that lerps between per-era readers on each morph. */
  bindNumericUniform(
    uniforms: Record<string, THREE.IUniform>,
    key: string,
    from: EraValueReader<number> | null,
    to: EraValueReader<number> | null,
  ): void {
    this.numericBindings.push({
      uniforms,
      key,
      from,
      to,
      fromValue: (uniforms[key]?.value as number) ?? 0,
      toValue: (uniforms[key]?.value as number) ?? 0,
    });
  }

  /** Bind a color uniform that lerps between per-era readers on each morph. */
  bindColorUniform(
    uniforms: Record<string, THREE.IUniform>,
    key: string,
    from: EraValueReader<THREE.Color> | null,
    to: EraValueReader<THREE.Color> | null,
  ): void {
    const current = uniforms[key]?.value;
    const currentColor =
      current instanceof THREE.Color ? current.clone() : new THREE.Color(0xffffff);
    this.colorBindings.push({
      uniforms,
      key,
      from,
      to,
      fromValue: currentColor.clone(),
      toValue: currentColor.clone(),
    });
  }

  /** Swap a material's map at the transition midpoint using per-era readers. */
  bindTextureSwap(
    material: TexturedMaterial,
    from: EraValueReader<THREE.Texture | null> | null,
    to: EraValueReader<THREE.Texture | null> | null,
  ): void {
    this.textureSwaps.push({ material, from, to, fromTex: material.map, toTex: material.map });
  }

  /** Register a general driver invoked every frame of a transition. */
  registerDriver(driver: MorphDriver): void {
    this.drivers.push(driver);
  }

  /** Observe timeline transitions (used e.g. to show/hide era groups). */
  onTimeline(listener: (state: MorphTimelineState) => void): () => void {
    this.timelineListeners.push(listener);
    return () => {
      const index = this.timelineListeners.indexOf(listener);
      if (index >= 0) {
        this.timelineListeners.splice(index, 1);
      }
    };
  }

  // --- Era scheduling --------------------------------------------------------

  /** Start a transition from the current era to `id`. */
  setEra(id: EraId): void {
    if (id === this.currentEra) {
      return;
    }
    const fromEra = this.currentEra;
    this.currentEra = id;
    this.captureBindings(fromEra, id);
    this.transition = { fromEra, toEra: id, elapsedMs: 0 };
    this.applyPose(0, fromEra, id, true);
  }

  /**
   * Continuous timeline scrubbing: t in 0..1 maps across the whole era list,
   * morphing through adjacent era pairs. Idempotent and frame-rate independent.
   */
  setTimeFraction(t: number): void {
    const clamped = clamp01(t);
    const span = 1 / Math.max(1, ERA_IDS.length - 1);
    const fromIndex = Math.min(ERA_IDS.length - 2, Math.floor(clamped / span));
    const frac = clamp01((clamped - fromIndex * span) / span);
    const fromEra = ERA_IDS[fromIndex];
    const toEra = ERA_IDS[Math.min(fromIndex + 1, ERA_IDS.length - 1)];
    this.transition = null;
    this.currentEra = toEra;
    this.captureBindings(fromEra, toEra);
    this.applyPose(frac, fromEra, toEra, false);
  }

  /** Advance the shared morph timeline by delta seconds. Call from the loop. */
  update(dtSeconds: number): void {
    if (!this.transition) {
      return;
    }
    this.transition.elapsedMs += Math.max(0, dtSeconds) * 1000;
    const raw = clamp01(this.transition.elapsedMs / this.durationMs);
    const progress = this.ease(raw);
    this.applyPose(progress, this.transition.fromEra, this.transition.toEra, raw < 1);
    if (raw >= 1) {
      this.applyPose(1, this.transition.fromEra, this.transition.toEra, false);
      this.transition = null;
    }
  }

  /** Snapshot of the current timeline state. */
  get timelineState(): MorphTimelineState {
    if (!this.transition) {
      return { progress: 1, fromEra: this.currentEra, toEra: this.currentEra, active: false };
    }
    const raw = clamp01(this.transition.elapsedMs / this.durationMs);
    return {
      progress: this.ease(raw),
      fromEra: this.transition.fromEra,
      toEra: this.transition.toEra,
      active: raw < 1,
    };
  }

  // --- Internals ---------------------------------------------------------------

  private captureBindings(fromEra: EraId, toEra: EraId): void {
    const fromState = ERA_SCENE_STATES[fromEra];
    const toState = ERA_SCENE_STATES[toEra];
    for (const binding of this.numericBindings) {
      if (binding.from) {
        binding.fromValue = binding.from(fromState);
      }
      if (binding.to) {
        binding.toValue = binding.to(toState);
      }
    }
    for (const binding of this.colorBindings) {
      if (binding.from) {
        binding.fromValue = binding.from(fromState).clone();
      }
      if (binding.to) {
        binding.toValue = binding.to(toState).clone();
      }
    }
    for (const swap of this.textureSwaps) {
      if (swap.from) {
        swap.fromTex = swap.from(fromState);
      }
      if (swap.to) {
        swap.toTex = swap.to(toState);
      }
    }
  }

  private applyPose(progress: number, fromEra: EraId, toEra: EraId, active: boolean): void {
    const eased = this.ease(progress);
    for (const anchor of this.anchors.values()) {
      anchor.setPose(eased, fromEra, toEra);
    }
    for (const binding of this.numericBindings) {
      binding.uniforms[binding.key].value = lerp(binding.fromValue, binding.toValue, eased);
    }
    for (const binding of this.colorBindings) {
      const value = binding.uniforms[binding.key].value as ColorLike;
      const from = binding.fromValue;
      const to = binding.toValue;
      value.r = lerp(from.r, to.r, eased);
      value.g = lerp(from.g, to.g, eased);
      value.b = lerp(from.b, to.b, eased);
    }
    for (const swap of this.textureSwaps) {
      const next = eased < 0.5 ? swap.fromTex : swap.toTex;
      if (swap.material.map !== next) {
        swap.material.map = next;
        swap.material.needsUpdate = true;
      }
    }
    for (const scaffold of this.scaffolds) {
      scaffold.update(eased);
    }
    for (const driver of this.drivers) {
      driver(eased, fromEra, toEra);
    }
    for (const listener of this.timelineListeners) {
      listener({ progress: eased, fromEra, toEra, active });
    }
  }

  dispose(): void {
    for (const anchor of this.anchors.values()) {
      anchor.dispose();
    }
    for (const scaffold of this.scaffolds) {
      scaffold.dispose();
    }
    this.anchors.clear();
    this.scaffolds.length = 0;
    this.numericBindings.length = 0;
    this.colorBindings.length = 0;
    this.textureSwaps.length = 0;
    this.drivers.length = 0;
    this.timelineListeners.length = 0;
    this.group.clear();
  }
}