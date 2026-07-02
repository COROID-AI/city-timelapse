/**
 * Procedural street-furniture builder.
 *
 * Builds the road surface, sidewalks, curbs, crosswalk stripes, trolley
 * tracks, lamp posts, and street trees — all tuned to the era's
 * `StreetAssetData`. The complete street kit for one era is cached and
 * returned as a single Group keyed by eraId.
 */

import * as THREE from 'three';

import type { EraSpec } from '../eras.js';
import { getAssetSet } from './eras.js';
import type { AssetSet, LampStyle } from './eras.js';
import { getAsphaltTexture, getSidewalkTexture } from './textures.js';

// ─────────────────────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────────────────────

/** A built street kit: the group plus key dimensions. */
export interface BuiltStreet {
  readonly group: THREE.Group;
  readonly roadWidth: number;
  readonly blockLength: number;
  readonly sidewalkWidth: number;
}

const streetCache = new Map<string, BuiltStreet>();

/**
 * Build (or fetch a cached) complete street kit for the given era.
 *
 * The kit is laid out along the X axis: road in the center, sidewalks on
 * either side, lamp posts and trees placed at regular intervals.
 *
 * @param spec         The era specification.
 * @param roadWidth    Total width of the road surface (Z axis).
 * @param blockLength  Length of the block along the road (X axis).
 * @param sidewalkWidth Width of each sidewalk (Z axis).
 */
export function buildStreet(
  spec: EraSpec,
  roadWidth: number = 16,
  blockLength: number = 80,
  sidewalkWidth: number = 4,
): BuiltStreet {
  const cacheKey = `${spec.id}:street:${roadWidth.toFixed(1)}:${blockLength.toFixed(1)}:${sidewalkWidth.toFixed(1)}`;
  const existing = streetCache.get(cacheKey);
  if (existing) return existing;

  const set = getAssetSet(spec);
  const group = new THREE.Group();
  group.name = `street:${spec.id}`;

  // ── Road surface ──────────────────────────────────────────────────────
  const asphaltTex = getAsphaltTexture(set);
  const roadGeo = new THREE.PlaneGeometry(blockLength, roadWidth);
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.95,
    metalness: 0.0,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.receiveShadow = true;
  group.add(road);

  // ── Center lane markings ──────────────────────────────────────────────
  if (set.street.hasCrosswalkStripes) {
    addLaneMarkings(group, blockLength, roadWidth);
  }

  // ── Trolley tracks ─────────────────────────────────────────────────────
  if (set.street.hasTrolleyTracks) {
    addTrolleyTracks(group, blockLength, roadWidth);
  }

  // ── Crosswalks at both ends ────────────────────────────────────────────
  if (set.street.hasCrosswalkStripes) {
    addCrosswalk(group, blockLength / 2, roadWidth);
    addCrosswalk(group, -blockLength / 2, roadWidth);
  }

  // ── Sidewalks & curbs ──────────────────────────────────────────────────
  const sidewalkTex = getSidewalkTexture(set);
  const sidewalkGeo = new THREE.PlaneGeometry(blockLength, sidewalkWidth);
  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: sidewalkTex,
    roughness: 0.9,
    metalness: 0.0,
  });

  for (const side of [1, -1] as const) {
    const sidewalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(0, 0.05, side * (roadWidth / 2 + sidewalkWidth / 2));
    sidewalk.receiveShadow = true;
    group.add(sidewalk);

    // Curb
    const curbGeo = new THREE.BoxGeometry(blockLength, 0.2, 0.3);
    const curbMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(set.street.curbColor),
      roughness: 0.9,
    });
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.position.set(0, 0.1, side * (roadWidth / 2 + 0.05));
    curb.castShadow = true;
    curb.receiveShadow = true;
    group.add(curb);
  }

  // ── Lamp posts ──────────────────────────────────────────────────────────
  const lampSpacing = 20;
  const lampOffsetZ = roadWidth / 2 + sidewalkWidth * 0.6;
  for (let x = -blockLength / 2 + lampSpacing / 2; x < blockLength / 2; x += lampSpacing) {
    for (const side of [1, -1] as const) {
      const lamp = buildLampPost(set);
      lamp.position.set(x, 0, side * lampOffsetZ);
      group.add(lamp);
    }
  }

  // ── Street trees ────────────────────────────────────────────────────────
  const treeSpacing = 14;
  const treeOffsetZ = roadWidth / 2 + sidewalkWidth * 0.85;
  for (let x = -blockLength / 2 + treeSpacing / 2; x < blockLength / 2; x += treeSpacing) {
    // Alternate sides
    const side = ((Math.round((x + blockLength / 2) / treeSpacing)) % 2 === 0) ? 1 : -1;
    const tree = buildTree(set);
    tree.position.set(x, 0, side * treeOffsetZ);
    group.add(tree);
  }

  const built: BuiltStreet = { group, roadWidth, blockLength, sidewalkWidth };
  streetCache.set(cacheKey, built);
  return built;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lane markings & crosswalks
// ─────────────────────────────────────────────────────────────────────────────

function addLaneMarkings(group: THREE.Group, length: number, roadWidth: number): void {
  const dashGeo = new THREE.PlaneGeometry(2, 0.15);
  const dashMat = new THREE.MeshStandardMaterial({ color: '#e8e0c0', roughness: 0.6 });
  for (let x = -length / 2 + 1; x < length / 2; x += 4) {
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.02, 0);
    group.add(dash);
  }
}

function addTrolleyTracks(group: THREE.Group, length: number, roadWidth: number): void {
  const trackMat = new THREE.MeshStandardMaterial({ color: '#5a5550', roughness: 0.7, metalness: 0.5 });
  for (const offset of [-0.8, 0.8]) {
    const trackGeo = new THREE.PlaneGeometry(length, 0.08);
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.rotation.x = -Math.PI / 2;
    track.position.set(0, 0.02, offset);
    group.add(track);
  }
}

function addCrosswalk(group: THREE.Group, x: number, roadWidth: number): void {
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#e8e0c0', roughness: 0.6 });
  const stripeCount = 6;
  const stripeWidth = 0.5;
  const totalWidth = roadWidth - 2;
  const gap = (totalWidth - stripeCount * stripeWidth) / (stripeCount - 1);
  for (let i = 0; i < stripeCount; i++) {
    const z = -totalWidth / 2 + i * (stripeWidth + gap) + stripeWidth / 2;
    const stripeGeo = new THREE.PlaneGeometry(3, stripeWidth);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(x, 0.025, z);
    group.add(stripe);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lamp posts
// ─────────────────────────────────────────────────────────────────────────────

function buildLampPost(set: AssetSet): THREE.Group {
  const group = new THREE.Group();
  const style: LampStyle = set.street.lampStyle;
  const poleHeight = style === 'gas' ? 3.2 : style === 'led' ? 5.5 : 4.5;

  // Pole
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, poleHeight, 8);
  const poleMat = new THREE.MeshStandardMaterial({
    color: style === 'smart' ? '#4a5a6a' : '#2a2a2a',
    roughness: 0.6,
    metalness: 0.7,
  });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = poleHeight / 2;
  pole.castShadow = true;
  group.add(pole);

  // Base
  const baseGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.3, 8);
  const base = new THREE.Mesh(baseGeo, poleMat);
  base.position.y = 0.15;
  group.add(base);

  // Lamp head — style-dependent
  const lampColor = new THREE.Color(set.street.lampColor);
  const lampMat = new THREE.MeshStandardMaterial({
    color: lampColor,
    emissive: lampColor,
    emissiveIntensity: 1.2,
    roughness: 0.4,
  });

  switch (style) {
    case 'gas': {
      // Ornate gas-lamp head with a globe
      const globeGeo = new THREE.SphereGeometry(0.22, 12, 8);
      const globe = new THREE.Mesh(globeGeo, lampMat);
      globe.position.y = poleHeight + 0.15;
      group.add(globe);
      // Decorative arm
      const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.y = poleHeight;
      group.add(arm);
      // Actual point light for atmosphere
      const light = new THREE.PointLight(lampColor, set.street.lampIntensity, 12, 2);
      light.position.y = poleHeight + 0.15;
      group.add(light);
      break;
    }
    case 'cobra': {
      // Cobra-head streetlight curving over the road
      const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.rotation.z = Math.PI / 2.5;
      arm.position.set(0.3, poleHeight, 0);
      group.add(arm);
      const headGeo = new THREE.BoxGeometry(0.4, 0.2, 0.25);
      const head = new THREE.Mesh(headGeo, poleMat);
      head.position.set(0.8, poleHeight - 0.05, 0);
      group.add(head);
      const bulbGeo = new THREE.SphereGeometry(0.1, 8, 6);
      const bulb = new THREE.Mesh(bulbGeo, lampMat);
      bulb.position.set(0.8, poleHeight - 0.18, 0);
      group.add(bulb);
      const light = new THREE.PointLight(lampColor, set.street.lampIntensity, 15, 2);
      light.position.set(0.8, poleHeight - 0.18, 0);
      group.add(light);
      break;
    }
    case 'high-pressure-sodium': {
      // Larger cobra head with a warm amber glow
      const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.rotation.z = Math.PI / 2.5;
      arm.position.set(0.4, poleHeight, 0);
      group.add(arm);
      const headGeo = new THREE.BoxGeometry(0.55, 0.25, 0.3);
      const head = new THREE.Mesh(headGeo, poleMat);
      head.position.set(1.0, poleHeight - 0.05, 0);
      group.add(head);
      const bulbGeo = new THREE.SphereGeometry(0.13, 8, 6);
      const bulb = new THREE.Mesh(bulbGeo, lampMat);
      bulb.position.set(1.0, poleHeight - 0.2, 0);
      group.add(bulb);
      const light = new THREE.PointLight(lampColor, set.street.lampIntensity, 18, 2);
      light.position.set(1.0, poleHeight - 0.2, 0);
      group.add(light);
      break;
    }
    case 'led': {
      // Sleek LED fixture
      const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.rotation.z = Math.PI / 2.5;
      arm.position.set(0.3, poleHeight, 0);
      group.add(arm);
      const headGeo = new THREE.BoxGeometry(0.5, 0.08, 0.2);
      const head = new THREE.Mesh(headGeo, poleMat);
      head.position.set(0.8, poleHeight - 0.04, 0);
      group.add(head);
      // LED strip
      const stripGeo = new THREE.BoxGeometry(0.45, 0.02, 0.15);
      const strip = new THREE.Mesh(stripGeo, lampMat);
      strip.position.set(0.8, poleHeight - 0.1, 0);
      group.add(strip);
      const light = new THREE.PointLight(lampColor, set.street.lampIntensity, 20, 2);
      light.position.set(0.8, poleHeight - 0.1, 0);
      group.add(light);
      break;
    }
    case 'smart': {
      // Smart pole with integrated panel + sensor node
      const panelGeo = new THREE.BoxGeometry(0.15, 0.8, 0.04);
      const panelMat = new THREE.MeshStandardMaterial({
        color: '#1a2a3a',
        roughness: 0.3,
        metalness: 0.6,
        emissive: new THREE.Color('#3acaff'),
        emissiveIntensity: 0.3,
      });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(0.08, poleHeight * 0.6, 0);
      group.add(panel);
      const headGeo = new THREE.BoxGeometry(0.35, 0.06, 0.18);
      const head = new THREE.Mesh(headGeo, poleMat);
      head.position.set(0.5, poleHeight, 0);
      group.add(head);
      const bulbGeo = new THREE.SphereGeometry(0.08, 8, 6);
      const bulb = new THREE.Mesh(bulbGeo, lampMat);
      bulb.position.set(0.5, poleHeight - 0.06, 0);
      group.add(bulb);
      const light = new THREE.PointLight(lampColor, set.street.lampIntensity, 22, 2);
      light.position.set(0.5, poleHeight - 0.06, 0);
      group.add(light);
      break;
    }
    default:
      break;
  }

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Street trees
// ─────────────────────────────────────────────────────────────────────────────

function buildTree(set: AssetSet): THREE.Group {
  const group = new THREE.Group();

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 2.2, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5a3a2a', roughness: 0.9 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  group.add(trunk);

  // Foliage — layered spheres
  const foliageMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(set.street.foliageColor),
    roughness: 0.95,
  });
  for (const [fx, fy, fz, r] of [
    [0, 2.4, 0, 0.9],
    [0.5, 2.6, 0.3, 0.6],
    [-0.4, 2.8, -0.2, 0.55],
    [0.1, 3.0, 0.2, 0.5],
  ] as const) {
    const ballGeo = new THREE.SphereGeometry(r, 8, 6);
    const ball = new THREE.Mesh(ballGeo, foliageMat);
    ball.position.set(fx, fy, fz);
    ball.castShadow = true;
    group.add(ball);
  }

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Disposal
// ─────────────────────────────────────────────────────────────────────────────

/** Dispose all cached street groups and their geometry/materials. */
export function disposeAllStreets(): void {
  for (const built of streetCache.values()) {
    built.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
  }
  streetCache.clear();
}
