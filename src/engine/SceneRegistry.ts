/**
 * SceneRegistry pattern.
 *
 * Every scene module (environment, buildings, props, vehicles, pedestrians,
 * UI overlays) exposes the same lifecycle as a `SceneModule` and registers
 * itself here keyed by era so the composition root can build and update the
 * scene without knowing module internals.
 *
 * The registry also defines `EraScopedSubsystem` — the shared contract for
 * era-morphing subsystems. Each subsystem registers with `register()` and
 * supplies its own era datasets through `build(era)`; the TransformationEngine
 * only drives the blend by calling `applyEraBlend(fromEra, toEra, t)` every
 * frame during a transition.
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
 * A scene subsystem that owns its per-era dataset and can morph between two
 * era datasets in front of the viewer.
 *
 * Subsystems build their own era data via `build(era)` (the engine never owns
 * era data) and register themselves once with `register()`. A subsystem can
 * own multiple groups; the engine applies the blend to every registered
 * subsystem — and therefore all of its groups — in one pass each frame.
 */
export interface EraScopedSubsystem {
  /** Stable, unique subsystem id (e.g. 'buildings', 'vehicles'). */
  readonly groupId: string;
  /**
   * Erects the given era's state, returning an opaque handle (Geometry,
   * Material, light settings, raw data) the subsystem later blends.
   */
  build(era: EraId): unknown;
  /**
   * Blends every group this subsystem owns from its old-era state to its
   * new-era state. Called every rendered frame during a transition with `t`
   * eased 0→1 via smoothstep.
   */
  applyEraBlend(fromEra: EraId, toEra: EraId, t: number): void;
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

/**
 * Applies a single selected era to every registered module in one pass.
 *
 * This is the composition-root entry point for era switching: it calls
 * `setEra(era, t)` on each registered module so all era-scoped subsystems
 * (buildings, environment, props, vehicles, pedestrians, UI) observe the
 * same `selectedYear` and the same transition progress `t` in the same frame.
 */
export function applyEraToModules(era: EraId, t: number): void {
  for (const module of eraModules.values()) {
    module.setEra(era, t);
  }
}

/** Clears all registrations (used by tests and hot module disposal). */
export function clearEraModules(): void {
  eraModules.clear();
}

/**
 * Central registry of era-scoped subsystems. Every subsystem task (buildings,
 * vehicles, pedestrians, storefronts/props, environment, audio, UI) calls
 * `register()` during initialization so the TransformationEngine can morph
 * every registered subsystem in one pass.
 */
const subsystems = new Map<string, EraScopedSubsystem>();

/** Registers a subsystem. Throws on duplicate group ids. */
export function register(subsystem: EraScopedSubsystem): void {
  if (subsystems.has(subsystem.groupId)) {
    throw new Error(`A subsystem is already registered with groupId '${subsystem.groupId}'.`);
  }
  subsystems.set(subsystem.groupId, subsystem);
}

/** Returns the registered subsystem with the given group id, or undefined. */
export function getSubsystem(groupId: string): EraScopedSubsystem | undefined {
  return subsystems.get(groupId);
}

/** Returns a copy of every registered subsystem. */
export function listSubsystems(): readonly EraScopedSubsystem[] {
  return Array.from(subsystems.values());
}

/** Clears all subsystem registrations (used by tests and hot module disposal). */
export function clearSubsystems(): void {
  subsystems.clear();
}