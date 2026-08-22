import * as THREE from 'three';

/**
 * Era manifest contract.
 *
 * Maps each EraId to the lazy-loaded procedural era module that produces its
 * THREE.Group visual profile. The manifest is the single registration point
 * the scene manager consults when switching eras; adding an era here is the
 * "manifest registration entry" required by the era-content plan.
 */
import type { EraId } from '../eras';

/**
 * Per-era module contracts. Each registered era exports its own builder
 * name plus an `update(dt, group)` tick; the manifest unions them so
 * adding an era never renames another era's public exports.
 */
export interface Era1965Module {
  buildEra1965: () => THREE.Group;
  update: (dt: number, group: THREE.Group) => void;
}

export interface Era2005Module {
  buildEra2005: () => THREE.Group;
  update: (dt: number, group?: THREE.Group) => void;
}

export interface Era2025Module {
  buildEra2025: () => THREE.Group;
  update: (dt: number, group?: THREE.Group) => void;
}

/** Any era module accepted by ERA_MANIFEST. */
export type EraModule = Era1965Module | Era2005Module | Era2025Module;

/** Resolve the THREE.Group builder no matter which era-specific name it uses. */
export function getEraBuilder(eraModule: EraModule): () => THREE.Group {
  if ('buildEra1965' in eraModule) return eraModule.buildEra1965;
  if ('buildEra2025' in eraModule) return eraModule.buildEra2025;
  return eraModule.buildEra2005;
}

/** Convenience: load a registered era module and build its visual profile. */
export async function loadEraGroup(id: EraId): Promise<THREE.Group> {
  return getEraBuilder(await getEraModuleLoader(id)())();
}

/**
 * Partial manifest keyed by EraId. Only eras whose modules have been
 * implemented are registered here; consumers look up a loader and throw
 * a descriptive error for unregistered ids.
 */
export const ERA_MANIFEST: Partial<Record<EraId, () => Promise<EraModule>>> = {
  '1945': () => import('./1945'),
  '1965': () => import('./1965'),
  '2005': () => import('./2005'),
  '2025': () => import('./2025'),
};

export function getEraModuleLoader(id: EraId): () => Promise<EraModule> {
  const loader = ERA_MANIFEST[id];
  if (!loader) {
    throw new Error(`Era manifest: no module registered for EraId '${id}'`);
  }
  return loader;
}