/**
 * Procedural street generator.
 *
 * Builds era-appropriate street furniture from an {@link EraSpec}:
 * - Asphalt road plane (textured from the cached registry)
 * - Sidewalk slabs (textured)
 * - Curbs
 * - Lane markings
 * - Lamp posts (era-specific style: cast-iron globe → cobra-head mercury →
 *   cobra-head sodium → shoebox halide → LED cobra)
 * - Traffic light poles (era-specific)
 *
 * All assets are cached by (eraId, category) and reused on subsequent calls.
 */
import * as THREE from 'three';
import type { EraSpec, StreetSpec } from '../eraRegistry';
import { buildAsphaltMaterial, buildSidewalkMaterial, cloneForRepeat, getLaneMarkingTexture } from './textures';

// ---------------------------------------------------------------------------
// Material helper
// ---------------------------------------------------------------------------

function makeBoxMaterial(color: string, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

// ---------------------------------------------------------------------------
// Lamp post factory (era-specific)
// ---------------------------------------------------------------------------

function buildLampPost(spec: StreetSpec): THREE.Group {
  const group = new THREE.Group();
  const poleColor = spec.lampPostColor;
  const poleMat = makeBoxMaterial(poleColor, 0.6, 0.3);
  const glowMat = new THREE.MeshStandardMaterial({
    color: spec.lampGlowColor,
    emissive: spec.lampGlowColor,
    emissiveIntensity: spec.lampGlowIntensity,
    roughness: 0.3,
  });

  const poleHeight = 5.0;

  switch (spec.lampPostStyle) {
    case 'cast-iron-globe': {
      // Ornate cast-iron pole with a globe light
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, poleHeight, 8),
        poleMat,
      );
      pole.position.y = poleHeight / 2;
      group.add(pole);
      // Decorative base
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 0.4, 8),
        poleMat,
      );
      base.position.y = 0.2;
      group.add(base);
      // Globe (sphere)
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), glowMat);
      globe.position.y = poleHeight + 0.1;
      group.add(globe);
      // Finial
      const finial = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.15, 8),
        poleMat,
      );
      finial.position.y = poleHeight + 0.38;
      group.add(finial);
      break;
    }
    case 'cobra-head-mercury':
    case 'cobra-head-sodium': {
      // Steel pole with a cobra-head arm
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.10, poleHeight, 8),
        poleMat,
      );
      pole.position.y = poleHeight / 2;
      group.add(pole);
      // Arm
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.06, 0.06),
        poleMat,
      );
      arm.position.set(0.5, poleHeight, 0);
      group.add(arm);
      // Cobra-head fixture
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.15, 0.25),
        poleMat,
      );
      head.position.set(1.0, poleHeight - 0.05, 0);
      group.add(head);
      // Lamp glow (underside)
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.04, 0.18),
        glowMat,
      );
      lamp.position.set(1.0, poleHeight - 0.14, 0);
      group.add(lamp);
      break;
    }
    case 'shoebox-halide': {
      // Tapered pole with a shoebox fixture
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.09, poleHeight, 8),
        poleMat,
      );
      pole.position.y = poleHeight / 2;
      group.add(pole);
      // Curved arm (two segments)
      const arm1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.05, 0.05),
        poleMat,
      );
      arm1.position.set(0.3, poleHeight, 0);
      arm1.rotation.z = -0.1;
      group.add(arm1);
      // Shoebox fixture
      const shoebox = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.12, 0.3),
        poleMat,
      );
      shoebox.position.set(0.7, poleHeight - 0.08, 0);
      group.add(shoebox);
      // Lamp glow
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.03, 0.22),
        glowMat,
      );
      lamp.position.set(0.7, poleHeight - 0.16, 0);
      group.add(lamp);
      break;
    }
    case 'led-cobra': {
      // Sleek pole with an LED cobra-head
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.08, poleHeight, 8),
        poleMat,
      );
      pole.position.y = poleHeight / 2;
      group.add(pole);
      // Slim arm
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.04, 0.04),
        poleMat,
      );
      arm.position.set(0.4, poleHeight, 0);
      group.add(arm);
      // Slim LED fixture
      const ledFixture = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.06, 0.2),
        poleMat,
      );
      ledFixture.position.set(0.8, poleHeight - 0.03, 0);
      group.add(ledFixture);
      // LED strip glow
      const ledStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.02, 0.15),
        glowMat,
      );
      ledStrip.position.set(0.8, poleHeight - 0.07, 0);
      group.add(ledStrip);
      break;
    }
  }

  return group;
}

// ---------------------------------------------------------------------------
// Traffic light factory (era-specific)
// ---------------------------------------------------------------------------

function buildTrafficLight(spec: StreetSpec): THREE.Group {
  const group = new THREE.Group();
  const poleMat = makeBoxMaterial(spec.lampPostColor, 0.6, 0.3);
  const poleHeight = 6.0;

  // Vertical pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, poleHeight, 8),
    poleMat,
  );
  pole.position.y = poleHeight / 2;
  group.add(pole);

  // Horizontal mast arm
  const armLen = 3.0;
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(armLen, 0.06, 0.06),
    poleMat,
  );
  arm.position.set(armLen / 2, poleHeight - 0.2, 0);
  group.add(arm);

  // Light housing
  const housingMat = makeBoxMaterial('#1a1a1a', 0.7, 0.3);
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.7, 0.18),
    housingMat,
  );
  housing.position.set(armLen, poleHeight - 0.55, 0);
  group.add(housing);

  // Three lights (red, yellow, green)
  const colors = ['#ff2020', '#ffe020', '#20ff20'];
  for (let i = 0; i < 3; i++) {
    const lightMat = new THREE.MeshStandardMaterial({
      color: colors[i],
      emissive: colors[i],
      emissiveIntensity: i === 0 ? 0.6 : 0.15,
      roughness: 0.3,
    });
    const light = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), lightMat);
    light.position.set(armLen, poleHeight - 0.3 - i * 0.2, 0.1);
    group.add(light);
  }

  return group;
}

// ---------------------------------------------------------------------------
// Lamp post cache
// ---------------------------------------------------------------------------

const lampPostCache = new Map<string, THREE.Group>();

export function buildLampPostAsset(spec: EraSpec): THREE.Group {
  const key = `${spec.eraId}:lampPost`;
  let cached = lampPostCache.get(key);
  if (!cached) {
    cached = buildLampPost(spec.streets);
    lampPostCache.set(key, cached);
  }
  return cached.clone();
}

// ---------------------------------------------------------------------------
// Traffic light cache
// ---------------------------------------------------------------------------

const trafficLightCache = new Map<string, THREE.Group>();

export function buildTrafficLightAsset(spec: EraSpec): THREE.Group {
  const key = `${spec.eraId}:trafficLight`;
  let cached = trafficLightCache.get(key);
  if (!cached) {
    cached = buildTrafficLight(spec.streets);
    trafficLightCache.set(key, cached);
  }
  return cached.clone();
}

// ---------------------------------------------------------------------------
// Street segment builder (asphalt + sidewalk + curb + lane markings)
// ---------------------------------------------------------------------------

export interface StreetDimensions {
  length: number;
  roadWidth: number;
  sidewalkWidth: number;
}

/**
 * Build a complete street segment: asphalt road, two sidewalks, two curbs,
 * and centre lane markings. All textured from the cached era texture registry.
 */
export function buildStreetSegment(
  spec: EraSpec,
  dims: StreetDimensions,
): THREE.Group {
  const group = new THREE.Group();
  const street = spec.streets;
  const { length, roadWidth, sidewalkWidth } = dims;

  // Asphalt road plane
  const asphaltMat = buildAsphaltMaterial(spec, length / 4, roadWidth / 4);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(length, roadWidth),
    asphaltMat,
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0;
  group.add(road);

  // Lane markings (centre line)
  if (street.laneMarkings) {
    const laneTex = cloneForRepeat(getLaneMarkingTexture(spec), length / 8, 1);
    const laneMat = new THREE.MeshBasicMaterial({
      map: laneTex,
      transparent: true,
      depthWrite: false,
    });
    const lane = new THREE.Mesh(
      new THREE.PlaneGeometry(length, 0.3),
      laneMat,
    );
    lane.rotation.x = -Math.PI / 2;
    lane.position.y = 0.02;
    group.add(lane);
  }

  // Bike lane (2005, 2025)
  if (street.hasBikeLane) {
    const bikeMat = new THREE.MeshStandardMaterial({
      color: '#2a8a3a',
      roughness: 0.9,
    });
    for (const sx of [-1, 1]) {
      const bikeLane = new THREE.Mesh(
        new THREE.PlaneGeometry(length, 0.8),
        bikeMat,
      );
      bikeLane.rotation.x = -Math.PI / 2;
      bikeLane.position.set(0, 0.01, sx * (roadWidth * 0.32));
      group.add(bikeLane);
    }
  }

  // Curbs (two sides)
  const curbMat = makeBoxMaterial(street.curbColor, 0.85);
  for (const sx of [-1, 1]) {
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(length, street.curbHeight, 0.2),
      curbMat,
    );
    curb.position.set(0, street.curbHeight / 2, sx * (roadWidth / 2 + 0.1));
    group.add(curb);
  }

  // Sidewalks (two sides)
  const sidewalkMat = buildSidewalkMaterial(spec, length / 4, sidewalkWidth / 4);
  for (const sx of [-1, 1]) {
    const sidewalk = new THREE.Mesh(
      new THREE.PlaneGeometry(length, sidewalkWidth),
      sidewalkMat,
    );
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(
      0,
      street.curbHeight,
      sx * (roadWidth / 2 + 0.2 + sidewalkWidth / 2),
    );
    group.add(sidewalk);
  }

  group.userData = { eraId: spec.eraId, dims };
  return group;
}

// ---------------------------------------------------------------------------
// Lamp post placement helper
// ---------------------------------------------------------------------------

/**
 * Place lamp posts along a street segment at regular intervals on both sides.
 */
export function placeLampPosts(
  spec: EraSpec,
  group: THREE.Group,
  dims: StreetDimensions,
  spacing = 20,
): void {
  const { length, roadWidth, sidewalkWidth } = dims;
  const lampPost = buildLampPostAsset(spec);
  const count = Math.max(2, Math.floor(length / spacing));
  const step = length / count;

  for (let i = 0; i <= count; i++) {
    const z = -length / 2 + step * i;
    for (const sx of [-1, 1]) {
      const lp = lampPost.clone();
      lp.position.set(
        sx * (roadWidth / 2 + sidewalkWidth * 0.4),
        0,
        z,
      );
      // Rotate so the arm points toward the road
      lp.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      group.add(lp);
    }
  }
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

export function clearStreetCache(): void {
  lampPostCache.clear();
  trafficLightCache.clear();
}
