import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';
import { BLOCK_HALF } from './constants.js';

/** Basic lighting rig: soft ambient fill + a directional "sun" that casts shadows. */
export function createLighting(): { ambient: AmbientLight; sun: DirectionalLight } {
  const ambient = new AmbientLight(0xb0c4de, 0.6);

  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(BLOCK_HALF * 1.6, BLOCK_HALF * 2.8, BLOCK_HALF * 1.2);
  sun.castShadow = true;

  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.near = 1;
  cam.far = 220;
  cam.left = -70;
  cam.right = 70;
  cam.top = 70;
  cam.bottom = -70;
  cam.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;

  return { ambient, sun };
}

/** Placeholder ground plane the future block will sit on. */
export function createGround(): Mesh {
  const geometry = new PlaneGeometry(400, 400);
  const material = new MeshStandardMaterial({
    color: new Color(0x2a2f3a),
    roughness: 0.95,
    metalness: 0.0,
  });
  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}
