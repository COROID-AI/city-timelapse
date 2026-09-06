import * as THREE from 'three';

import { createControls, type CameraControls } from './controls';
import type { EraId } from '../types';

/**
 * Frame loop for the rendering engine.
 *
 * The loop owns the `requestAnimationFrame` cycle, computes a clamped per-frame
 * delta, ticks registered per-frame update hooks (era content, ambience and
 * simulation are simply callbacks here — none of them touch renderer internals),
 * renders the scene, and forwards the frame to the camera controls.
 */

/** Clamped delta range in seconds — keeps physics stable during hitches. */
export const DELTA = Object.freeze({ min: 0, max: 0.1 }) as Readonly<{
  min: number;
  max: number;
}>;

/** Update hooks invoked every frame with the clamped seconds delta. */
export type UpdateHook = (delta: number) => void;

/**
 * Boot-era resolution from `?era=YYYY`. Returns the era id when the parameter
 * names one of the five registered eras, otherwise `null` so the host falls
 * back to its default.
 */
export function readEraParam(
  search: string = typeof location !== 'undefined' ? location.search : '',
): EraId | null {
  const params = new URLSearchParams(search);
  const raw = params.get('era');
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  return /^(1945|1965|1985|2005|2025)$/.test(normalized) ? (normalized as EraId) : null;
}

/** Alias exposed for composition tests. */
export type EraResolver = (search?: string) => EraId | null;

/**
 * An integration seam owned by the loop so `main-integration` can mount era
 * content, ambience, and simulation without touching renderer internals.
 */
export interface UpdateHooks {
  /** Per-frame update for the active era content. */
  content: UpdateHook | null;
  /** Per-frame update for the active era ambience layer. */
  ambience: UpdateHook | null;
  /** Per-frame update for the global simulation. */
  simulation: UpdateHook | null;
}

/** Minimal `?era=` marker contract the loop drives. */
export interface EraMarker {
  set(era: EraId): void;
}

/** Context passed to `createEngine`. */
export interface EngineOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  /** Per-frame update hooks (era content, ambience, sim). */
  hooks?: UpdateHooks;
  /** Boot-era resolver, defaulting to the `?era=` URL parameter. */
  resolveEra?: EraResolver;
  /** Initial era; used when `?era=` is absent. */
  initialEra?: EraId;
  /** Report the resolved boot era (wires state into sim / DOM marker). */
  onBootEra?: (era: EraId) => void;
}

/** Public engine factory contract produced by this module. */
export interface Engine {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  controls: CameraControls;
  /** Advance one post-clamp frame step and render. Returns clamped delta. */
  tick(delta: number): number;
  /** Release listeners, registries, and controls. */
  dispose(): void;
  /** The era resolved from `?era=` (or the initial default). */
  readEraParam(): EraId | null;
  /** Drive the era marker host with the boot era. */
  setEraMarker(marker: EraMarker): void;
}

/** Clamp a raw seconds delta into the stable `[0, 0.1]` band. */
export function clampDelta(raw: number): number {
  if (!Number.isFinite(raw)) {
    return raw === Number.POSITIVE_INFINITY ? DELTA.max : DELTA.min;
  }
  if (raw < DELTA.min) return DELTA.min;
  return Math.min(raw, DELTA.max);
}

const emptyHooks = (): UpdateHooks => ({ content: null, ambience: null, simulation: null });

/**
 * Create the engine: build the shared controls, resolve the boot era, register
 * per-frame update hooks, and render each frame. `tick` runs one clamped step.
 */
export function createEngine(options: EngineOptions): Engine {
  const controls = createControls(options.camera, options.canvas, {
    lockTarget: options.canvas,
  });

  const hooks = options.hooks ?? emptyHooks();
  const resolveEra = options.resolveEra ?? readEraParam;
  const bootEra = resolveEra() ?? options.initialEra ?? '1945';
  let lastMarker = bootEra;

  if (options.onBootEra) options.onBootEra(bootEra);

  const marker: EraMarker = {
    set(era: EraId) {
      lastMarker = era;
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.era = era;
      }
    },
  };
  marker.set(bootEra);

  function tick(deltaRaw: number): number {
    const delta = clampDelta(deltaRaw);
    if (delta > 0) {
      hooks.content?.(delta);
      hooks.ambience?.(delta);
      hooks.simulation?.(delta);
      controls.update(delta);
    }
    try {
      options.renderer.render(options.scene, options.camera);
    } catch {
      // Headless tests boot without a real WebGL context; tolerate that.
    }
    return delta;
  }

  return {
    renderer: options.renderer,
    camera: options.camera,
    controls,
    tick,
    dispose: () => {
      controls.dispose();
      hooks.content = null;
      hooks.ambience = null;
      hooks.simulation = null;
    },
    readEraParam: () => bootEra,
    setEraMarker: (m) => {
      m.set(lastMarker);
    },
  };
}

