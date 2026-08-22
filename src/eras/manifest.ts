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

export interface EraModule {
  buildEra1965: () => THREE.Group;
  update: (dt: number, group: THREE.Group) => void;
}

/**
 * Partial manifest keyed by EraId. Only eras whose modules have been
 * implemented are registered here; consumers look up a loader and throw
 * a descriptive error for unregistered ids.
 */
export const ERA_MANIFEST: Partial<Record<EraId, () => Promise<EraModule>>> = {
  '1945': () => import('./1945'),
  '1965': () => import('./1965'),
};

export function getEraModuleLoader(id: EraId): () => Promise<EraModule> {
  const loader = ERA_MANIFEST[id];
  if (!loader) {
    throw new Error(`Era manifest: no module registered for EraId '${id}'`);
  }
  return loader;
}