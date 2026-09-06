import type * as THREE from 'three';

/**
 * Shared era contracts for the City Time Period Timelapse.
 *
 * This module is the single source of truth for the types that every parallel
 * module (era scenes, UI, main-integration) authors against. It is a frozen
 * interface: changing these shapes requires updating every consumer.
 */

/** The five time periods rendered by the timeline slider. */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

/** All eras in chronological order; index maps to the slider position. */
export const ERA_IDS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'];

/** Assets loaded by the era loader, keyed by a stable string identifier. */
export type AssetKey = string;

/** Loads named assets (textures, models, audio) for an era. */
export interface AssetLoader {
  /** Load an asset by key, returning a promise that resolves to the raw URL. */
  load(key: AssetKey): Promise<string>;
  /** Release any cached asset resources for a key. */
  release(key: AssetKey): void;
}

/**
 * Context handed to every era module when its scene is built. Provides the
 * Three.js scene graph root, the asset loader, the canvas mount, and the era
 * being instantiated.
 */
export interface EraContext {
  /** The Three.js scene root (e.g. a `THREE.Scene` or `THREE.Group`) to attach era content to. */
  scene: THREE.Object3D;
  /** Loader for era-specific assets (textures, models, audio). */
  loader: AssetLoader;
  /** The DOM element mounting the scene (canvas wrapper). */
  root: HTMLElement;
  /** The era being instantiated. */
  year: EraId;
}

/** A named, interactive point within an era scene (for navigation / hotspots). */
export interface InteractivePoint {
  /** Stable id for the point. */
  id: string;
  /** World-space position of the point. */
  position: THREE.Vector3;
  /** Optional label shown on hover / focus. */
  label?: string;
}

/**
 * The full contract an era module must satisfy to be composable into the
 * registry and driven by the main loop. An era owns building its scene graph,
 * updating it each frame, and disposing of it on switch-away.
 */
export interface EraContent {
  /** Build the era's scene graph into `context.scene`. Called once at era start. */
  build(context: EraContext): void | Promise<void>;
  /** Per-frame update. `delta` is the time in seconds since the last frame. */
  update(delta: number): void;
  /** Release all resources owned by this era. Called on era switch-away. */
  dispose(): void;
  /** Interactive points exposed by this era for navigation / hotspots. */
  interactivePoints: InteractivePoint[];
  /** When true the era opts into a fast-path (no expensive rebuilds on switch). */
  isFastPath: boolean;
}

/** Ambient (non-interactive) layer of an era: weather, particles, lighting mood. */
export interface EraAmbience {
  /** Build the ambience layer into the scene. Called once at era start. */
  build(context: EraContext): void | Promise<void>;
  /** Per-frame update of the ambience layer. */
  update(delta: number): void;
  /** Release ambience resources. Called on era switch-away. */
  dispose(): void;
}

/**
 * Global simulation state shared between the main loop, the UI, and era
 * modules. Holds the current era, the accumulated clock, and transient UI
 * signals.
 */
export interface SimState {
  /** The era currently active in the scene. */
  currentEra: EraId;
  /** Index of the current era within ERA_IDS (also the slider position). */
  currentEraIndex: number;
  /** Milliseconds since the simulation started. */
  elapsedMs: number;
  /** Frame counter since the simulation started. */
  frame: number;
  /** True while an era transition is in progress. */
  isTransitioning: boolean;
  /** The era being transitioned to, if any. */
  pendingEra: EraId | null;
  /** True when the scene is paused (e.g. while a transition settles). */
  paused: boolean;
}

/**
 * Frozen layout constants describing the city block and camera anchors.
 * See `src/layout.ts` for the concrete values.
 */
export interface EraLayout {
  /** Overall block footprint in world units. */
  block: { width: number; depth: number };
  /** Roadway geometry. */
  street: { width: number; laneCount: number };
  /** Pedestrian sidewalk geometry. */
  sidewalk: { width: number; height: number };
  /** Curb geometry. */
  curb: { height: number; depth: number };
  /** Camera anchor positions for cinematic framing. */
  cameraAnchors: { id: string; position: THREE.Vector3; lookAt: THREE.Vector3 }[];
}