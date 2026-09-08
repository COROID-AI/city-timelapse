/**
 * Neon signs, billboards, streetlamps, and building silhouettes for the night
 * street corridor.
 *
 * Every sign has a deterministic flicker phase derived from its index, so the
 * animation is reproducible and testable. Flicker math is exposed as a pure
 * function (`flickerValue`) that the tests assert directly. Per-frame updates
 * mutate existing material uniforms in place — no allocations.
 */

import * as THREE from 'three';
import type { TrackCurve } from './track';
import { mulberry32 } from './track';

/** Minimum number of neon signs/billboards required by the brief. */
export const MIN_SIGNS = 12;

/** Colors cycled across signs to guarantee variety. */
const NEON_COLORS: readonly number[] = [
  0x00e5ff, // cyan
  0xff2d78, // hot pink
  0x7c4dff, // violet
  0x00ff9d, // mint green
  0xffb300, // amber
  0x3d7bff, // electric blue
  0xff5e3a, // coral
  0xbf00ff, // magenta
];

/** A single neon sign / billboard with its deterministic flicker. */
export interface NeonSign {
  /** The mesh placed in the scene. */
  readonly mesh: THREE.Mesh;
  /** Base emissive color of the sign. */
  readonly color: THREE.Color;
  /** Flicker base frequency (radians / second), from the phase. */
  readonly frequency: number;
  /** Deterministic phase offset (radians), derived from the sign index. */
  readonly phase: number;
  /** Sign index within the corridor (source of the deterministic phase). */
  readonly index: number;
  /** Set the current flicker intensity; called by the world update. */
  setIntensity(intensity: number): void;
}

/** The full neon + streetlight + building corridor. */
export interface NeonCorridor {
  /** All neon signs / billboards (>= 12). */
  readonly signs: readonly NeonSign[];
  /** Streetlamp meshes. */
  readonly streetlamps: readonly THREE.Mesh[];
  /** Building silhouette meshes. */
  readonly buildings: readonly THREE.Mesh[];
  /** Container holding every corridor mesh (added to the scene). */
  readonly group: THREE.Group;
  /** Advance flicker by `dt` seconds — allocation-free. */
  update(dt: number, elapsed: number): void;
  /** Release GPU resources owned by the corridor. */
  dispose(): void;
}

/**
 * Deterministic flicker intensity for a sign.
 *
 * A smooth sine wave (the "hum" of the neon tube) is multiplied by a slower
 * on/off square-ish wave so signs "breathe" and occasionally cut out, while
 * remaining fully deterministic given `phase` and `elapsed`.
 *
 * @param phase   Deterministic phase offset in radians.
 * @param elapsed Elapsed time in seconds.
 * @returns Intensity in [0, 1].
 */
export function flickerValue(phase: number, elapsed: number): number {
  const hum = 0.65 + 0.35 * Math.sin(elapsed * 9.0 + phase);
  const gate = 0.5 + 0.5 * Math.sin(elapsed * 0.9 + phase * 2.3);
  const gate2 = 0.5 + 0.5 * Math.sin(elapsed * 2.7 + phase * 1.7);
  const on = Math.min(gate, gate2) > 0.32 ? 1 : 0;
  return Math.max(0.06, hum * on);
}

/**
 * Build the neon sign corridor along the given circuit.
 * @param track The closed-loop circuit to line the corridor against.
 * @param seed  Optional seed override for sign placement (tests use this).
 */
export function createNeonSigns(track: TrackCurve, seed: number = 1): NeonCorridor {
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  const signs: NeonSign[] = [];
  const streetlamps: THREE.Mesh[] = [];
  const buildings: THREE.Mesh[] = [];

  const count = Math.max(MIN_SIGNS, 16);
  const signMats: THREE.MeshBasicMaterial[] = [];

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const point = track.getPoint(t);
    const tangent = track.getTangent(t);
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const side = rand() < 0.5 ? -1 : 1;

    const color = NEON_COLORS[i % NEON_COLORS.length] as number;
    const phase = (i * 2.399963) % (Math.PI * 2); // golden-angle phase spread
    const mat = new THREE.MeshBasicMaterial({ color });
    signMats.push(mat);

    // Billboard sign facing the road.
    const w = 6 + rand() * 6;
    const h = 3 + rand() * 4;
    const geo = new THREE.BoxGeometry(w, h, 0.4);
    const mesh = new THREE.Mesh(geo, mat);
    const height = 5 + rand() * 5;
    mesh.position
      .copy(point)
      .addScaledVector(right, side * 14)
      .add(new THREE.Vector3(0, height, 0));
    mesh.rotation.y = Math.atan2(tangent.x, tangent.z) + (side > 0 ? Math.PI : 0);
    group.add(mesh);

    const sign: NeonSign = {
      mesh,
      color: mat.color,
      frequency: 9.0,
      phase,
      index: i,
      setIntensity(intensity) {
        // No allocation: reuse a temp color ref stored on the material.
        mat.color.setHex(color).multiplyScalar(intensity);
      },
    };
    signs.push(sign);
  }

  // Streetlamps: a pole plus a warm point light (a few only, to keep the
  // light budget modest).
  const lampPoleGeo = new THREE.CylinderGeometry(0.18, 0.28, 7, 6);
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6 });
  const lampHeadGeo = new THREE.SphereGeometry(0.5, 8, 8);
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffdd99 });

  for (let i = 0; i < 12; i++) {
    const t = (i + 0.5) / 12;
    const point = track.getPoint(t);
    const tangent = track.getTangent(t);
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const side = i % 2 === 0 ? -1 : 1;

    const pole = new THREE.Mesh(lampPoleGeo, lampPoleMat);
    pole.position.copy(point).addScaledVector(right, side * 11).add(new THREE.Vector3(0, 3.5, 0));
    const head = new THREE.Mesh(lampHeadGeo, lampHeadMat);
    head.position.copy(pole.position).add(new THREE.Vector3(0, 3.5, 0));
    group.add(pole, head);
    streetlamps.push(pole, head);

    if (i % 3 === 0) {
      const light = new THREE.PointLight(0xffc98a, 0.9, 30, 2);
      light.position.copy(head.position);
      group.add(light);
    }
  }

  // Building silhouettes: dark boxes flanking the corridor.
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0x0b0e1a, roughness: 0.9 });
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x2a3a55 });
  for (let i = 0; i < 26; i++) {
    const t = (i + 0.25) / 26;
    const point = track.getPoint(t);
    const tangent = track.getTangent(t);
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const side = i % 2 === 0 ? -1 : 1;

    const bw = 14 + rand() * 12;
    const bh = 18 + rand() * 26;
    const bd = 14 + rand() * 10;
    const geo = new THREE.BoxGeometry(bw, bh, bd);
    const building = new THREE.Mesh(geo, buildingMat);
    building.position
      .copy(point)
      .addScaledVector(right, side * (14 + bw / 2 + 6))
      .add(new THREE.Vector3(0, bh / 2, 0));
    building.rotation.y = Math.atan2(tangent.x, tangent.z);
    group.add(building);
    buildings.push(building);

    // A couple of lit windows give the silhouettes depth.
    if (rand() < 0.5) {
      const winGeo = new THREE.PlaneGeometry(2.5, 1.6);
      const win = new THREE.Mesh(winGeo, windowMat);
      win.position.copy(building.position).add(new THREE.Vector3(side * (bw / 2 + 0.1), rand() * bh * 0.6, 0));
      win.rotation.y = Math.atan2(tangent.x, tangent.z) + (side > 0 ? Math.PI : 0);
      group.add(win);
    }
  }

  return {
    signs,
    streetlamps,
    buildings,
    group,
    update(dt, elapsed) {
      void dt;
      for (let i = 0; i < signs.length; i++) {
        const s = signs[i] as NeonSign;
        s.setIntensity(flickerValue(s.phase, elapsed));
      }
    },
    dispose() {
      for (const mat of signMats) mat.dispose();
      lampPoleMat.dispose();
      lampHeadMat.dispose();
      buildingMat.dispose();
      windowMat.dispose();
    },
  };
}