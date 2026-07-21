import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Shared module-scope geometries & materials.
//
// Performance requirement: no per-frame allocation. Every geometry that is
// reused (boxes, cylinders, planes, cones, spheres) is created ONCE here at
// module scope and shared by reference across all components. Materials that
// need per-frame updates are created once and mutated in place (never replaced).
// ---------------------------------------------------------------------------

// --- Primitive geometries (shared, never disposed during app lifetime) ---
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  boxSmall: new THREE.BoxGeometry(0.5, 0.5, 0.5),
  boxThin: new THREE.BoxGeometry(1, 0.1, 1),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cylinderThin: new THREE.CylinderGeometry(0.08, 0.08, 1, 8),
  plane: new THREE.PlaneGeometry(1, 1),
  planeDouble: new THREE.PlaneGeometry(1, 1),
  sphere: new THREE.SphereGeometry(0.5, 16, 12),
  sphereLow: new THREE.SphereGeometry(0.5, 8, 6),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  capsule: new THREE.CapsuleGeometry(0.3, 0.6, 4, 8),
} as const;

// The "window quad" geometry used by the instanced window-glow system.
export const windowQuadGeo = new THREE.PlaneGeometry(0.5, 0.7);

// --- Reusable temp objects (avoid per-frame `new Vector3()`) ---
export const TMP = {
  v3: new THREE.Vector3(),
  v3b: new THREE.Vector3(),
  color: new THREE.Color(),
  colorB: new THREE.Color(),
  matrix: new THREE.Matrix4(),
  euler: new THREE.Euler(),
  quat: new THREE.Quaternion(),
};

/** Convert an RGB tuple [0..1] to a THREE.Color, reusing the passed instance. */
export function rgbToColor(rgb: [number, number, number], target: THREE.Color): THREE.Color {
  target.setRGB(rgb[0], rgb[1], rgb[2]);
  return target;
}
