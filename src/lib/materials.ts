import * as THREE from 'three';

const materialCache = new Map<string, THREE.Material>();

export function getCachedMaterial(key: string): THREE.Material | null {
  return materialCache.get(key) ?? null;
}

export function setCachedMaterial(key: string, mat: THREE.Material): void {
  materialCache.set(key, mat);
}

export function clearMaterialCache(): void {
  materialCache.clear();
}

// Pre-built shared geometries
export const boxGeo = new THREE.BoxGeometry(1, 1, 1);
export const planeGeo = new THREE.PlaneGeometry(1, 1);
export const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
export const sphereGeo = new THREE.SphereGeometry(0.5, 16, 12);
export const torusGeo = new THREE.TorusGeometry(0.5, 0.15, 8, 16);
export const coneGeo = new THREE.ConeGeometry(0.5, 1, 8);

boxGeo.dispose = () => {};
planeGeo.dispose = () => {};
cylinderGeo.dispose = () => {};
sphereGeo.dispose = () => {};
torusGeo.dispose = () => {};
coneGeo.dispose = () => {};

export function createWindowMaterial(color: string): THREE.MeshStandardMaterial {
  const [r, g, b] = hexToRgb(color);
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(r, g, b),
    emissive: new THREE.Color(r, g, b),
    emissiveIntensity: 0.3,
    roughness: 0.2,
    metalness: 0.8,
  });
}

export function createBuildingMaterial(baseColor: string): THREE.MeshStandardMaterial {
  const [r, g, b] = hexToRgb(baseColor);
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(r, g, b),
    roughness: 0.7,
    metalness: 0.1,
  });
}

export function createNeonMaterial(color: string): THREE.MeshStandardMaterial {
  const [r, g, b] = hexToRgb(color);
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x000000),
    emissive: new THREE.Color(r, g, b),
    emissiveIntensity: 2.0,
    roughness: 0.5,
    metalness: 0.0,
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}
