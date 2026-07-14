import * as THREE from 'three';

// Recursively set opacity on a mesh (handles material arrays).
export function setOpacity(object, value) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      if (!m) continue;
      m.transparent = true;
      m.opacity = value;
      m.depthWrite = value > 0.95;
    }
  });
}

export function makeOpaqueStandard(map, { color = 0xffffff, roughness = 0.9, metalness = 0.0 } = {}) {
  return new THREE.MeshStandardMaterial({ map, color, roughness, metalness });
}

export function disposeObject(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) m && m.dispose && m.dispose();
      if (child.geometry) child.geometry.dispose();
    }
  });
}
