/**
 * src/content/ambient/AmbientModels.ts — procedural ambient life builders.
 *
 * Creates the era-aware background life visible on the block:
 *  - birds/pigeons as compact procedurally-built rigs (body, head, tail/
 *    wings) that hop and flap through `updateBird`-style animation in the
 *    module,
 *  - steam puffs, chimney smoke, dust and leaves as soft-sprite particle
 *    fields (CanvasTexture generated at runtime; the scene never downloads),
 *  - subtle crowd chatter is an audio-layer concern handled by the SFX
 *    engine (src/audio); the visual module only needs the little grouped
 *    "chatter dots" so the acceptance screenshot can show crowd presence.
 *
 * All colours/counts come from the declarative AmbientEraSpec in src/eras.ts.
 * Nothing here hardcodes an era.
 */

import * as THREE from 'three';

import type { AmbientEraSpec, AmbientKind } from '../../eras';

/** A single animated bird rig. */
export interface BirdRig {
  root: THREE.Group;
  /** Loop phase 0..1 used by the module's update(). */
  phase: number;
  /** Flap speed per second. */
  speed: number;
  /** Flap amplitude. */
  amp: number;
  /** Wing meshes (two), rotated around X to flap. */
  wings: THREE.Object3D[];
}

/** One procedural particle field. */
export interface ParticleFieldRig {
  points: THREE.Points;
  /** Per-point lifecycle phase 0..1 (uploaded once). */
  seeds: Float32Array;
  /** Rise speed per second. */
  rise: number;
  /** Drift amount per second. */
  drift: number;
  /** Whether particles shrink/fade as they rise. */
  dissipate: boolean;
}

/** Build a bird rig with procedural geometry (body, head, tail, wings). */
export function buildBirdRig(spec: AmbientEraSpec): BirdRig {
  const root = new THREE.Group();
  root.name = `bird-${spec.id}`;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.color),
    roughness: 0.85,
    metalness: 0.05,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.accentColor),
    roughness: 0.85,
    metalness: 0.05,
  });

  // Compact stylised pigeon silhouette (facing +Z).
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), bodyMat);
  body.scale.set(1, 0.8, 1.35);
  body.position.y = 0.04;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bodyMat);
  head.position.set(0, 0.13, 0.1);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 6), accentMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.13, 0.16);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.14), accentMat);
  tail.position.set(0, 0.1, -0.12);
  tail.rotation.x = -0.35;

  // Wings flap around X on each side.
  const wingGeo = new THREE.BoxGeometry(0.06, 0.015, 0.24);
  const wingL = new THREE.Mesh(wingGeo, accentMat);
  wingL.position.set(-0.09, 0.09, 0);
  wingL.rotation.z = -0.2;
  const wingR = new THREE.Mesh(wingGeo, accentMat);
  wingR.position.set(0.09, 0.09, 0);
  wingR.rotation.z = 0.2;

  root.add(body, head, beak, tail, wingL, wingR);
  root.userData.disposeList = [bodyMat, accentMat, wingGeo];

  return {
    root,
    phase: spec.id.length * 0.13 % 1,
    speed: 2.2 + (spec.id.length % 3) * 0.4,
    amp: 0.5 + (spec.id.length % 4) * 0.12,
    wings: [wingL, wingR],
  };
}

/** Soft round sprite texture used for steam/smoke/dust particles. */
export function makeParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('AmbientModels: 2d canvas context unavailable');
  }
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Build a drifting particle field for steam/smoke/dust/leaves. */
export function buildParticleField(
  kind: AmbientKind,
  spec: AmbientEraSpec,
  texture: THREE.CanvasTexture,
): ParticleFieldRig {
  const count = Math.max(0, spec.count);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  // Scatter the field across the block above/around the street.
  for (let i = 0; i < count; i += 1) {
    const x = (Math.random() - 0.5) * 22;
    const z = -12 + Math.random() * 30;
    const altitude = spec.altitude ?? 0;
    const spread = kind === 'steam' ? 1.2 : kind === 'chimney_smoke' ? 4.0 : kind === 'dust' ? 0.5 : 2.5;
    const y = altitude + Math.random() * spread;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    seeds[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const opacity = 0.5 * spec.intensity;
  const color = new THREE.Color(spec.color);
  const accent = new THREE.Color(spec.accentColor);
  const material = new THREE.PointsMaterial({
    map: texture,
    color,
    size: kind === 'steam' ? 0.9 : kind === 'chimney_smoke' ? 1.1 : kind === 'dust' ? 0.5 : 0.55,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = `particles-${kind}-${spec.id}`;
  points.userData.baseColor = color.clone();
  points.userData.accentColor = accent.clone();
  points.userData.disposeList = [geometry, material];
  points.frustumCulled = false;

  // Configure per-kind physics.
  let rise = 0;
  let drift = 0;
  let dissipate = true;
  if (kind === 'steam') {
    rise = 0.5;
    drift = 0.4;
  } else if (kind === 'chimney_smoke') {
    rise = 0.7;
    drift = 0.5;
  } else if (kind === 'dust') {
    rise = 0.05;
    drift = 0.9;
  } else if (kind === 'leaves') {
    rise = 0.12;
    drift = 1.1;
    dissipate = false;
  }

  return { points, seeds, rise, drift, dissipate };
}

/** Build a tiny "chatter dots" group for subtle crowd presence. */
export function buildChatterDots(spec: AmbientEraSpec): THREE.Group {
  const group = new THREE.Group();
  group.name = `chatter-${spec.id}`;
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.color),
    transparent: true,
    opacity: 0.35 * spec.intensity,
    roughness: 0.9,
  });
  const count = Math.min(14, spec.count);
  for (let i = 0; i < count; i += 1) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat);
    dot.position.set((Math.random() - 0.5) * 8, 1.5, -8 + Math.random() * 16);
    group.add(dot);
  }
  group.userData.disposeList = [mat];
  return group;
}