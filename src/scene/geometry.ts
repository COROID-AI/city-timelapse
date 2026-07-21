/**
 * Shared geometry + instanced-mesh scaffolding.
 *
 * Performance safeguard: repeated elements (windows, vehicles, pedestrians,
 * props) use InstancedMesh so we draw thousands of elements in few draw calls.
 * Geometries are created once and cached.
 */

import * as THREE from "three";

const geoCache = new Map<string, THREE.BufferGeometry>();

function get(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = build();
    geoCache.set(key, g);
  }
  return g;
}

export const Geos = {
  box: (w: number, h: number, d: number) =>
    get(`box-${w}-${h}-${d}`, () => new THREE.BoxGeometry(w, h, d)),
  unitBox: () => get("unitbox", () => new THREE.BoxGeometry(1, 1, 1)),
  windowPane: () => get("win", () => new THREE.PlaneGeometry(1, 1)),
  cyl: (rt: number, rb: number, h: number, seg = 8) =>
    get(`cyl-${rt}-${rb}-${h}-${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  sphere: (r: number, seg = 8) =>
    get(`sph-${r}-${seg}`, () => new THREE.SphereGeometry(r, seg, seg)),
  cone: (r: number, h: number, seg = 8) =>
    get(`cone-${r}-${h}-${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  quad: () => get("quad", () => new THREE.PlaneGeometry(1, 1)),
};

/** Scratch objects reused per-frame to avoid GC churn in instanced updates. */
export const scratch = {
  dummy: new THREE.Object3D(),
  color: new THREE.Color(),
  color2: new THREE.Color(),
  vec3: new THREE.Vector3(),
  mat4: new THREE.Matrix4(),
};
