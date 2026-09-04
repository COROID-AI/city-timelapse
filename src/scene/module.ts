// Shared module contract for every scene module.
import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';

export interface SceneModule {
  group: THREE.Group;
  readonly name: string;
  /** Discrete per-era setup (texture rebuilds, mesh swaps). */
  setEra(era: EraId): void;
  /** Continuous per-frame morph driven by state.eraFloat. */
  update(dt: number, state: AppState): void;
  dispose(): void;
}