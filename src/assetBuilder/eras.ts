/**
 * Era asset set selector.
 * Selects the appropriate cached asset set for a given EraSpec.
 */
import type { EraSpec } from '../eraRegistry';
import type { MeshStandardMaterial, MeshBasicMaterial } from 'three';
import {
  buildFacadeMaterial,
  buildAsphaltMaterial,
  buildSidewalkMaterial,
  buildSignageMaterial,
  buildSkyMaterial,
} from './textures';

export interface EraAssetSet {
  eraId: string;
  facadeMaterial: (floors: number) => MeshStandardMaterial;
  asphaltMaterial: MeshStandardMaterial;
  sidewalkMaterial: MeshStandardMaterial;
  signageMaterial: (index: number) => MeshStandardMaterial;
  skyMaterial: MeshBasicMaterial;
}

export function getEraAssetSet(spec: EraSpec): EraAssetSet {
  return {
    eraId: spec.eraId,
    facadeMaterial: (floors: number) => buildFacadeMaterial(spec.buildings, spec.eraId, floors),
    asphaltMaterial: buildAsphaltMaterial(spec.streets, spec.eraId),
    sidewalkMaterial: buildSidewalkMaterial(spec.streets, spec.eraId),
    signageMaterial: (index: number) => buildSignageMaterial(spec.signage, spec.eraId, index),
    skyMaterial: buildSkyMaterial(spec.sky, spec.eraId),
  };
}