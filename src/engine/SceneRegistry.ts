/**
 * SceneRegistry pattern.
 *
 * Every scene module (environment, buildings, props, vehicles, pedestrians,
 * UI overlays) exposes the same lifecycle as a `SceneModule` and registers
 * itself here keyed by era so the composition root can build and update the
 * scene without knowing module internals.
 */
import type { EraId, EraSpec } from './eras';
import type { Group } from 'three';

/** Shared read-only state handed to every module each frame. */
export interface SceneContext {
  /** The current absolute time in milliseconds (same clock as rAF). */
  readonly timeMs: number;
  /** Delta time in seconds since the previous frame. */
  readonly deltaSec: number;
  /** The currently active era. */
  readonly era: EraId;
  /** Static spec of the active era (id, year, label, description). */
  readonly eraSpec: EraSpec;
}

/**
 * Contract every scene sub-module implements. Modules must not create their
 * own renderer, camera, or animation loop.
 */
export interface SceneModule {
  /** Three.js group this module adds to the primary scene. */
  readonly group: Group;
  /** Advance per-frame animation using the shared context. */
  update(context: SceneContext): void;
  /** Called when the active era changes. */
  setEra(era: EraId, t: number): void;
  /** Release GPU/CPU resources. */
  dispose(): void;
}

/**
 * Registry mapping era ids to scene modules. Downstream tasks call
 * `registerEraModule()` during initialization; the composition root calls
 * `erectEraModules()` once to populate the scene.
 */
const eraModules = new Map<EraId, SceneModule>();

/** Registers a scene module for an era. Throws on duplicate ids. */
export function registerEraModule(module: SceneModule, era: EraId): void {
  if (eraModules.has(era)) {
    throw new Error(`A scene module is already registered for era ${era}.`);
  }
  eraModules.set(era, module);
}

/** Returns the registered module for the era, or undefined. */
export function getEraModule(era: EraId): SceneModule | undefined {
  return eraModules.get(era);
}

/** Returns all registered modules. */
export function listEraModules(): readonly SceneModule[] {
  return Array.from(eraModules.values());
}

/** Clears all registrations (used by tests and hot module disposal). */
export function clearEraModules(): void {
  eraModules.clear();
}