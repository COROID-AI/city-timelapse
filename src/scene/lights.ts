import * as THREE from 'three';

/** Build a sun + hemisphere + subtle ambient light rig */
export function setupLights(scene: THREE.Scene): {
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  ambientLight: THREE.AmbientLight;
} {
  // Hemisphere sky/ground gradient
  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.6);
  scene.add(hemiLight);

  // Subtle ambient fill
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambientLight);

  // Sun directional light (casts shadows)
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.4);
  sunLight.position.set(60, 80, 40);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.camera.left = -60;
  sunLight.shadow.camera.right = 60;
  sunLight.shadow.camera.top = 60;
  sunLight.shadow.camera.bottom = -60;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);

  return { sunLight, hemiLight, ambientLight };
}
