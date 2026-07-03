/**
 * Procedural street furniture builder.
 *
 * Generates a cached `THREE.Group` per era containing the road surface,
 * sidewalks, curbs, era-specific lamp posts, and crosswalk stripes. The group
 * is keyed by `cacheKey(era.id, 'streets')` and reused across era transitions.
 */

import * as THREE from 'three';
import type { EraId, EraSpec } from '../eras/types.js';
import {
  assetCache,
  boxMesh,
  cacheKey,
  createRng,
  cylMesh,
  eraSeed,
  stdMaterial,
} from './util.js';
import { getAsphaltTexture } from './textures.js';

// ---------------------------------------------------------------------------
// Layout constants (in metres)
// ---------------------------------------------------------------------------

const ROAD_WIDTH = 8; // two lanes
const ROAD_LENGTH = 60;
const SIDEWALK_WIDTH = 3.5;
const SIDEWALK_HEIGHT = 0.15;
const CURB_HEIGHT = 0.12;
const LAMP_SPACING = 15;
const CROSSWALK_COUNT = 2;
const STRIPE_WIDTH = 0.5;
const STRIPE_GAP = 0.5;

// ---------------------------------------------------------------------------
// Era-specific lamp configuration
// ---------------------------------------------------------------------------

interface LampConfig {
  poleHeight: number;
  poleRadius: number;
  poleColor: string;
  poleMetalness: number;
  fixtureColor: string;
  lightColor: string;
  armLength: number;
}

function lampConfig(era: EraSpec): LampConfig {
  switch (era.id as EraId) {
    case '1945':
      return {
        poleHeight: 4.2,
        poleRadius: 0.08,
        poleColor: '#1a1a1c',
        poleMetalness: 0.85,
        fixtureColor: '#2a2a2e',
        lightColor: '#ffd27a',
        armLength: 0,
      };
    case '1965':
      return {
        poleHeight: 5.5,
        poleRadius: 0.07,
        poleColor: '#3a3a3e',
        poleMetalness: 0.7,
        fixtureColor: '#4a4a4e',
        lightColor: '#ffcc66',
        armLength: 0.8,
      };
    case '1985':
      return {
        poleHeight: 6.5,
        poleRadius: 0.1,
        poleColor: '#2c2c30',
        poleMetalness: 0.5,
        fixtureColor: '#3c3c40',
        lightColor: '#ff9933',
        armLength: 0.5,
      };
    case '2005':
      return {
        poleHeight: 6.0,
        poleRadius: 0.06,
        poleColor: '#5a5a5e',
        poleMetalness: 0.8,
        fixtureColor: '#6a6a6e',
        lightColor: '#ffeecc',
        armLength: 1.2,
      };
    case '2025':
      return {
        poleHeight: 5.8,
        poleRadius: 0.07,
        poleColor: '#2e3138',
        poleMetalness: 0.6,
        fixtureColor: '#3a3d44',
        lightColor: '#e6f0ff',
        armLength: 0.9,
      };
  }
}

// ---------------------------------------------------------------------------
// Lamp post builder
// ---------------------------------------------------------------------------

/**
 * Build an era-specific lamp post sub-group.
 *
 * Each era has a distinct pole height, material, and fixture shape:
 * - 1945: tall ornate cast-iron gas lamp with a globe light.
 * - 1965: cobra-head streetlight on a tapered pole.
 * - 1985: boxy high-pressure sodium fixture on a square pole.
 * - 2005: sleek curved-arm LED-ready pole.
 * - 2025: smart pole with solar panel and sensor pods.
 *
 * @param era  Era spec.
 * @param rng  Seeded RNG for minor variation.
 */
export function buildLampPost(era: EraSpec, rng: () => number): THREE.Group {
  const cfg = lampConfig(era);
  const group = new THREE.Group();
  const heightVar = 1 + (rng() - 0.5) * 0.05;
  const poleH = cfg.poleHeight * heightVar;

  // --- Pole ---
  const poleMat = stdMaterial(cfg.poleColor, {
    roughness: 0.4,
    metalness: cfg.poleMetalness,
  });

  if (era.id === '1985') {
    // Square pole (box) for 1985
    const pole = boxMesh(cfg.poleRadius * 1.6, poleH, cfg.poleRadius * 1.6, poleMat);
    pole.position.y = poleH / 2;
    group.add(pole);
  } else {
    // Tapered cylindrical pole (tapered = different top/bottom radius for 1965+)
    const taper = era.id === '1965' ? cfg.poleRadius * 0.6 : cfg.poleRadius;
    const pole = cylMesh(taper, cfg.poleRadius, poleH, 8, poleMat);
    pole.position.y = poleH / 2;
    group.add(pole);
  }

  // --- Base plate ---
  const baseMat = stdMaterial(cfg.poleColor, { roughness: 0.5, metalness: 0.6 });
  const base = cylMesh(cfg.poleRadius * 1.8, cfg.poleRadius * 2.0, 0.15, 12, baseMat);
  base.position.y = 0.075;
  group.add(base);

  // --- Fixture & light source ---
  const fixtureMat = stdMaterial(cfg.fixtureColor, {
    roughness: 0.5,
    metalness: 0.7,
  });
  const emissiveIntensity = era.buildings.neonAccents ? 1.2 : 0.8;
  const lightMat = stdMaterial(cfg.lightColor, {
    roughness: 0.3,
    metalness: 0.0,
    emissive: cfg.lightColor,
    emissiveIntensity,
  });

  const armY = poleH;
  switch (era.id as EraId) {
    case '1945': {
      // Ornate collar + globe light
      const collar = cylMesh(0.12, 0.1, 0.15, 8, fixtureMat);
      collar.position.y = armY + 0.075;
      group.add(collar);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), lightMat);
      globe.castShadow = true;
      globe.receiveShadow = true;
      globe.position.y = armY + 0.33;
      group.add(globe);
      // Finial
      const finial = cylMesh(0.02, 0.04, 0.08, 6, fixtureMat);
      finial.position.y = armY + 0.55;
      group.add(finial);
      break;
    }
    case '1965': {
      // Cobra-head on a horizontal arm
      const arm = boxMesh(cfg.armLength, 0.05, 0.05, fixtureMat);
      arm.position.set(cfg.armLength / 2, armY, 0);
      group.add(arm);
      const head = boxMesh(0.5, 0.18, 0.25, fixtureMat);
      head.position.set(cfg.armLength, armY - 0.05, 0);
      group.add(head);
      const lens = boxMesh(0.45, 0.04, 0.2, lightMat);
      lens.position.set(cfg.armLength, armY - 0.16, 0);
      group.add(lens);
      break;
    }
    case '1985': {
      // Boxy HPS fixture
      const head = boxMesh(0.4, 0.22, 0.3, fixtureMat);
      head.position.set(cfg.armLength / 2, armY + 0.05, 0);
      group.add(head);
      const arm = boxMesh(cfg.armLength, 0.06, 0.06, fixtureMat);
      arm.position.set(cfg.armLength / 2, armY, 0);
      group.add(arm);
      const lens = boxMesh(0.35, 0.04, 0.25, lightMat);
      lens.position.set(cfg.armLength / 2, armY - 0.08, 0);
      group.add(lens);
      break;
    }
    case '2005': {
      // Sleek curved arm — approximated with a tilted box
      const arm = boxMesh(cfg.armLength, 0.04, 0.06, fixtureMat);
      arm.position.set(cfg.armLength / 2, armY - 0.02, 0);
      arm.rotation.z = -0.15;
      group.add(arm);
      const head = boxMesh(0.6, 0.08, 0.18, fixtureMat);
      head.position.set(cfg.armLength, armY - 0.12, 0);
      group.add(head);
      const lens = boxMesh(0.55, 0.03, 0.14, lightMat);
      lens.position.set(cfg.armLength, armY - 0.17, 0);
      group.add(lens);
      break;
    }
    case '2025': {
      // Smart pole: compact LED head + solar panel + sensor pod
      const head = boxMesh(0.35, 0.06, 0.16, fixtureMat);
      head.position.set(cfg.armLength / 2, armY + 0.02, 0);
      group.add(head);
      const arm = boxMesh(cfg.armLength, 0.03, 0.04, fixtureMat);
      arm.position.set(cfg.armLength / 2, armY, 0);
      group.add(arm);
      const lens = boxMesh(0.3, 0.02, 0.12, lightMat);
      lens.position.set(cfg.armLength / 2, armY - 0.04, 0);
      group.add(lens);
      // Solar panel on top of pole
      const panelMat = stdMaterial('#1a2a4a', {
        roughness: 0.2,
        metalness: 0.3,
        emissive: '#0a1530',
        emissiveIntensity: 0.2,
      });
      const panel = boxMesh(0.4, 0.03, 0.3, panelMat);
      panel.position.set(0, armY + 0.18, 0);
      group.add(panel);
      // Sensor pod
      const podMat = stdMaterial('#2a2a2e', { roughness: 0.3, metalness: 0.7 });
      const pod = cylMesh(0.05, 0.05, 0.12, 8, podMat);
      pod.position.set(0, armY + 0.1, 0.12);
      group.add(pod);
      break;
    }
  }

  return group;
}

// ---------------------------------------------------------------------------
// Main street builder
// ---------------------------------------------------------------------------

/**
 * Build (or return cached) street furniture for an era.
 *
 * The returned group contains the road plane, two sidewalks with curbs,
 * era-specific lamp posts at regular intervals, and crosswalk stripes at each
 * end of the block.
 *
 * @param era  Era spec.
 * @returns A cached `THREE.Group` named with the cache key.
 */
export function getStreets(era: EraSpec): THREE.Group {
  const key = cacheKey(era.id, 'streets');
  const cached = assetCache.get(key);
  if (cached) return cached;

  const rng = createRng(eraSeed(era, 'streets'));
  const group = new THREE.Group();
  group.name = key;

  // --- Road plane ---
  const asphaltTex = getAsphaltTexture(era);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: asphaltTex,
    roughness: 0.9,
    metalness: 0.0,
  });
  const road = boxMesh(ROAD_WIDTH, 0.1, ROAD_LENGTH, roadMat);
  road.position.y = 0.05;
  group.add(road);

  // --- Centre lane marking (dashed yellow) ---
  const lineMat = stdMaterial('#d4a017', {
    roughness: 0.6,
    metalness: 0.1,
    emissive: '#d4a017',
    emissiveIntensity: 0.1,
  });
  const dashCount = Math.floor(ROAD_LENGTH / 2);
  for (let i = 0; i < dashCount; i++) {
    const dash = boxMesh(0.15, 0.02, 1.0, lineMat);
    dash.position.set(0, 0.11, -ROAD_LENGTH / 2 + 1 + i * 2);
    group.add(dash);
  }

  // --- Sidewalks & curbs (both sides) ---
  const sidewalkMat = stdMaterial('#9a9a96', { roughness: 0.85, metalness: 0.05 });
  const curbMat = stdMaterial('#6a6a66', { roughness: 0.8, metalness: 0.05 });

  for (const side of [-1, 1]) {
    const sidewalkX = side * (ROAD_WIDTH / 2 + SIDEWALK_WIDTH / 2);
    const sidewalk = boxMesh(SIDEWALK_WIDTH, SIDEWALK_HEIGHT, ROAD_LENGTH, sidewalkMat);
    sidewalk.position.set(sidewalkX, SIDEWALK_HEIGHT / 2, 0);
    group.add(sidewalk);

    // Curb between road and sidewalk
    const curbX = side * (ROAD_WIDTH / 2 + CURB_HEIGHT / 2 + 0.02);
    const curb = boxMesh(CURB_HEIGHT, CURB_HEIGHT, ROAD_LENGTH, curbMat);
    curb.position.set(curbX, CURB_HEIGHT / 2 + 0.05, 0);
    group.add(curb);
  }

  // --- Lamp posts along both sidewalks ---
  const lampCount = Math.floor(ROAD_LENGTH / LAMP_SPACING);
  for (const side of [-1, 1]) {
    const lampX = side * (ROAD_WIDTH / 2 + SIDEWALK_WIDTH - 0.5);
    for (let i = 0; i <= lampCount; i++) {
      const lamp = buildLampPost(era, rng);
      const z = -ROAD_LENGTH / 2 + (i * ROAD_LENGTH) / lampCount;
      lamp.position.set(lampX, CURB_HEIGHT + 0.05, z);
      group.add(lamp);
    }
  }

  // --- Crosswalk stripes at both ends ---
  const stripeMat = stdMaterial('#e0e0dc', { roughness: 0.7, metalness: 0.05 });
  const stripeCount = Math.floor(ROAD_WIDTH / (STRIPE_WIDTH + STRIPE_GAP));
  for (let c = 0; c < CROSSWALK_COUNT; c++) {
    const crossZ = c === 0 ? -ROAD_LENGTH / 2 + 2 : ROAD_LENGTH / 2 - 2;
    for (let s = 0; s < stripeCount; s++) {
      const x = -ROAD_WIDTH / 2 + s * (STRIPE_WIDTH + STRIPE_GAP) + STRIPE_WIDTH / 2;
      const stripe = boxMesh(STRIPE_WIDTH, 0.02, 2.5, stripeMat);
      stripe.position.set(x, 0.11, crossZ);
      group.add(stripe);
    }
  }

  return assetCache.set(key, group);
}

// ---------------------------------------------------------------------------
// Optional typed interface for consumers needing structural details
// ---------------------------------------------------------------------------

/** Structural constants exported for layout systems. */
export interface StreetLayout {
  readonly roadWidth: number;
  readonly sidewalkWidth: number;
  readonly roadLength: number;
}

/** The street layout dimensions used by this builder. */
export const STREET_LAYOUT: StreetLayout = {
  roadWidth: ROAD_WIDTH,
  sidewalkWidth: SIDEWALK_WIDTH,
  roadLength: ROAD_LENGTH,
};
