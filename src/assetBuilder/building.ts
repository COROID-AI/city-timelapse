import * as THREE from 'three';
import { BuildingType, Era } from '../eras/types';
import { getEra } from '../eras/data';
import { makeFacadeTexture } from './textures';

export interface BuiltBuilding {
  group: THREE.Group;
  dispose: () => void;
}

/** Build a single building for the given era & type. Height chosen deterministically from seed. */
export function makeBuilding(era: Era, type: BuildingType, seed: number, width: number, depth: number): BuiltBuilding {
  const def = getEra(era);
  const style = def.buildings[type];
  const [hMin, hMax] = style.heightRange;
  // deterministic pseudo-height in [hMin, hMax]
  const t = ((seed * 9301 + 49297) % 233280) / 233280;
  const height = hMin + t * (hMax - hMin);

  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];

  const facadeTex = makeFacadeTexture(era, type, style);
  // repeat facade tiles to match aspect
  facadeTex.repeat.set(Math.max(1, Math.round(width / 3)), Math.max(1, Math.round(height / 3)));
  disposables.push(facadeTex);

  const bodyMat = new THREE.MeshStandardMaterial({
    map: facadeTex,
    roughness: style.facade === 'glass' || style.facade === 'parametric' ? 0.25 : 0.85,
    metalness: style.facade === 'glass' || style.facade === 'parametric' ? 0.6 : 0.05,
  });
  disposables.push(bodyMat);

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // roof cap
  const roofMat = new THREE.MeshStandardMaterial({ color: style.roof, roughness: 0.9 });
  disposables.push(roofMat);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.4, depth + 0.4), roofMat);
  roof.position.y = height + 0.2;
  roof.castShadow = true;
  group.add(roof);

  // ground-floor base trim
  const trimMat = new THREE.MeshStandardMaterial({ color: style.trim, roughness: 0.8 });
  disposables.push(trimMat);
  const base = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.8, depth + 0.2), trimMat);
  base.position.y = 0.4;
  group.add(base);

  return {
    group,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      body.geometry.dispose();
      roof.geometry.dispose();
      base.geometry.dispose();
    },
  };
}
