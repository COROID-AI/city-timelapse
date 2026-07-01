import * as THREE from 'three';
import { EraStorefront } from '../eras/types';
import { makeSignTexture } from './textures';

export interface BuiltStorefront {
  group: THREE.Group;
  dispose: () => void;
}

/** A storefront sign plane mounted on a facade. */
export function makeStorefront(storefront: EraStorefront, width: number): BuiltStorefront {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];

  const signTex = makeSignTexture(storefront);
  disposables.push(signTex);

  const signMat = new THREE.MeshBasicMaterial({
    map: signTex,
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  disposables.push(signMat);

  const signH = width * 0.28;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, signH), signMat);
  sign.position.set(0, 0, 0);
  group.add(sign);

  // backboard
  const bbMat = new THREE.MeshStandardMaterial({ color: storefront.bg, roughness: 0.7 });
  disposables.push(bbMat);
  const backboard = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, signH + 0.2, 0.1), bbMat);
  backboard.position.z = -0.08;
  group.add(backboard);

  return {
    group,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      sign.geometry.dispose();
      backboard.geometry.dispose();
    },
  };
}
