/**
 * Era manifest — the single registration point for the City Era Timelapse.
 *
 * Maps every {@link EraId} to the `THREE.Group` build factory exported by its
 * sibling era module. This file contains no era content of its own: it is pure
 * wiring, consumed by the scene director (Phase 4) to instantiate any era
 * directly from its id via {@link getEraGroup}.
 *
 * Coverage is compiler-enforced: `Record<EraId, EraGroupBuilder>` fails to
 * typecheck if an era is added to `../eras` without a registration here, or
 * if a registration is dropped.
 */

import type * as THREE from 'three';

import type { EraId } from '../eras';

import { buildEra1945 } from './1945';
import { buildEra1965 } from './1965';
import { buildEra1985 } from './1985';
import { buildEra2005 } from './2005';
import { buildEra2025 } from './2025';

/** Builds one era's complete visual profile as a fresh THREE.Group. */
export type EraGroupBuilder = () => THREE.Group;

/**
 * Complete EraId → build-factory registry (chronological key order).
 * Every entry is the sibling era module's own exported builder — never a copy
 * or re-implementation of era content.
 */
export const ERA_MANIFEST: Record<EraId, EraGroupBuilder> = {
  '1945': buildEra1945,
  '1965': buildEra1965,
  '1985': buildEra1985,
  '2005': buildEra2005,
  '2025': buildEra2025,
};

/** Resolve the registered THREE.Group build factory for an era id. */
export function getEraGroup(id: EraId): EraGroupBuilder {
  return ERA_MANIFEST[id];
}
