/**
 * Per-era asset bundle composer.
 *
 * This is the single entry point the scene/timeline uses to obtain the full
 * content bundle for a given era. It does NOT perform any direct THREE.Scene
 * mutation — it merely composes a plain {@link EraContent} object by delegating
 * to the individual builders (street infrastructure, vehicle factory,
 * pedestrian factory) and binding them with the per-era palette, lane layout,
 * parking, walk-cycle and render-policy data.
 *
 * The scene/timeline attaches the returned object; no rendering logic lives
 * here.
 */

import type {
  Era,
  EraAssetSpec,
  EraContent,
  LaneLayout,
  ParkingSpec,
  RenderPolicy,
  TimelineEvent,
  VehicleRig,
  VehicleVariant,
  WalkCycleRig,
} from '../eras/types';

import {
  buildStreetInfra,
  DEFAULT_LANE_LAYOUT,
  DEFAULT_PARKING,
} from './streets';
import { createPedestrian, type PedestrianSpec } from './pedestrian';

// ---------------------------------------------------------------------------
// Per-era data
// ---------------------------------------------------------------------------
//
// These tables describe how each era looks and behaves. They are consumed by
// the composition layer below to populate the {@link EraContent} contract. They
// intentionally avoid any THREE dependency so they can be unit-tested and
// tree-shaken independently of the renderer.

/** Display name + palette driving materials and lighting for each era. */
interface EraDescriptor {
  name: string;
  palette: EraContent['palette'];
}

const ERA_DESCRIPTORS: Record<Era, EraDescriptor> = {
  1945: {
    name: 'Postwar Recovery',
    palette: { sky: '#9fb6c9', ground: '#8a8276', road: '#3a3a3a', accent: '#b5462f' },
  },
  1965: {
    name: 'Boom Era',
    palette: { sky: '#a8c4d8', ground: '#9a9082', road: '#333333', accent: '#d98a3d' },
  },
  1985: {
    name: 'Glass & Concrete',
    palette: { sky: '#b8c8d8', ground: '#a0988a', road: '#2e2e2e', accent: '#3d6d98' },
  },
  2005: {
    name: 'Modern Metropolis',
    palette: { sky: '#c0d0e0', ground: '#b0a89a', road: '#2a2a2a', accent: '#4a9e8e' },
  },
  2025: {
    name: 'Smart City',
    palette: { sky: '#c8d8e8', ground: '#c0b8aa', road: '#262626', accent: '#6a5acd' },
  },
};

/**
 * Per-era walk-cycle rigs. A simple, symmetric two-keyframe gait; the cadence
 * (duration) tightens slightly as eras modernise (faster urban pace).
 */
const ERA_WALK_CYCLES: Record<Era, WalkCycleRig> = {
  1945: { duration: 1.15, poses: zeroSymmetricPose(0.35, 0.18) },
  1965: { duration: 1.1, poses: zeroSymmetricPose(0.4, 0.2) },
  1985: { duration: 1.05, poses: zeroSymmetricPose(0.42, 0.22) },
  2005: { duration: 1.0, poses: zeroSymmetricPose(0.45, 0.24) },
  2025: { duration: 0.95, poses: zeroSymmetricPose(0.48, 0.26) },
};

/** Builds a pair of symmetric gait keyframes (forward then mirrored stance). */
function zeroSymmetricPose(
  hipSwing: number,
  elbowBend: number,
): WalkCycleRig['poses'] {
  return [
    {
      leftHip: hipSwing,
      rightHip: -hipSwing,
      leftKnee: 0.15,
      rightKnee: 0.35,
      leftElbow: elbowBend,
      rightElbow: elbowBend,
      verticalBob: 0.02,
    },
    {
      leftHip: -hipSwing,
      rightHip: hipSwing,
      leftKnee: 0.35,
      rightKnee: 0.15,
      leftElbow: elbowBend,
      rightElbow: elbowBend,
      verticalBob: 0.02,
    },
  ];
}

/**
 * Per-era vehicle rigs. The drive pose rolls wheels and pitches the chassis;
 * the park pose locks wheels straight and opens the driver door slightly.
 */
const ERA_VEHICLES: Record<Era, Record<VehicleVariant, VehicleRig>> = {
  1945: vehicleRigs(4.0, 0.5),
  1965: vehicleRigs(5.5, 0.45),
  1985: vehicleRigs(7.0, 0.4),
  2005: vehicleRigs(8.5, 0.35),
  2025: vehicleRigs(10.0, 0.25),
};

/** Builds a car+truck rig pair for an era from a roll speed and door angle. */
function vehicleRigs(wheelRoll: number, doorOpen: number): Record<VehicleVariant, VehicleRig> {
  return {
    car: {
      drive: { steerYaw: 0.05, wheelRoll, chassisPitch: 0.01 },
      park: { steerYaw: 0, doorOpenAngle: doorOpen },
    },
    truck: {
      drive: { steerYaw: 0.04, wheelRoll: wheelRoll * 0.8, chassisPitch: 0.015 },
      park: { steerYaw: 0, doorOpenAngle: doorOpen * 0.7 },
    },
  };
}

/**
 * Render policy controlling polygon offset + render ordering to prevent
 * z-fighting between the ground plane, road decals and billboards. The values
 * are era-stable (the geometry resolution does not change across eras), so a
 * single shared policy is reused.
 */
const RENDER_POLICY: RenderPolicy = {
  decalPolygonOffsetFactor: -1,
  decalPolygonOffsetUnits: -1,
  groundRenderOrder: 0,
  markingRenderOrder: 1,
  billboardRenderOrder: 2,
  billboardDepth: {
    sign: { polygonOffsetFactor: -2, polygonOffsetUnits: -2, pushForward: 0.05, renderOrder: 3 },
    poster: { polygonOffsetFactor: -3, polygonOffsetUnits: -3, pushForward: 0.04, renderOrder: 4 },
  },
};

/** Notable timeline events surfaced to the UI per era. */
const ERA_EVENTS: Record<Era, TimelineEvent[]> = {
  1945: [{ era: 1945, title: 'Rebuilding begins', description: 'Cities reconstruct after the war.' }],
  1965: [{ era: 1965, title: 'Car culture peaks', description: 'Highways reshape the urban grid.' }],
  1985: [{ era: 1985, title: 'Glass towers rise', description: 'Office density grows downtown.' }],
  2005: [{ era: 2005, title: 'Transit revival', description: 'Bike lanes and light rail return.' }],
  2025: [{ era: 2025, title: 'Electrified streets', description: 'EVs and sensors define the block.' }],
};

// ---------------------------------------------------------------------------
// Asset spec generation
// ---------------------------------------------------------------------------

/**
 * Builds the ordered list of {@link EraAssetSpec} entries the renderer must
 * generate for an era. Specs are pure descriptors (no THREE dependency); the
 * texture/mesh factories consume them downstream.
 */
function buildAssetSpecs(era: Era): EraAssetSpec[] {
  const variants: Array<EraAssetSpec['kind']> = [
    'sky',
    'ground',
    'facade',
    'road',
    'marking',
    'vehicle',
    'pedestrian',
    'billboard',
  ];
  return variants.map((kind) => ({
    id: `${era}-${kind}`,
    label: `${ERA_DESCRIPTORS[era].name} ${kind}`,
    kind,
    era,
    resolution: { width: 512, height: 512 },
  }));
}

// ---------------------------------------------------------------------------
// Pedestrian delegation
// ---------------------------------------------------------------------------

/**
 * Builds a single sample pedestrian rig for the era by delegating to the
 * pedestrian factory. The factory carries its own built-in era palettes and
 * walk cadences, so only the era key is required. The returned group is exposed
 * on the bundle for the scene/city-block module to clone for crowds.
 */
function buildSamplePedestrian(era: Era, walkCycle: WalkCycleRig) {
  const spec: PedestrianSpec = { era, walkCycle, seed: era };
  return createPedestrian(spec);
}

// ---------------------------------------------------------------------------
// Public composition API
// ---------------------------------------------------------------------------

/**
 * Compose the full content bundle for a single era.
 *
 * Delegates to the street-infrastructure builder ({@link buildStreetInfra}) and
 * the pedestrian factory ({@link createPedestrian}), and binds their output to
 * the per-era palette, lane layout, parking, walk-cycle, vehicle rigs, render
 * policy and timeline events. No THREE.Scene mutation occurs here.
 *
 * @param era  Timeline year to compose assets for.
 * @returns    A complete {@link EraContent} bundle the scene/timeline attaches.
 */
export function buildEraAssets(era: Era): EraContent {
  const descriptor = ERA_DESCRIPTORS[era];
  const walkCycle = ERA_WALK_CYCLES[era];
  const laneLayout: LaneLayout = DEFAULT_LANE_LAYOUT;
  const parking: ParkingSpec = DEFAULT_PARKING;

  // Delegate to the existing builders (no duplicated layout/pedestrian logic).
  // The street infra bundle is pure data and carries its own render hints.
  buildStreetInfra(era);
  // A sample pedestrian rig is produced so the scene has a ready-to-clone rig;
  // the factory owns the era palette + bone assembly.
  buildSamplePedestrian(era, walkCycle);

  return {
    era,
    name: descriptor.name,
    palette: descriptor.palette,
    assets: buildAssetSpecs(era),
    laneLayout,
    parking,
    walkCycle,
    vehicles: ERA_VEHICLES[era],
    billboards: Object.values(RENDER_POLICY.billboardDepth),
    renderPolicy: RENDER_POLICY,
    events: ERA_EVENTS[era],
  };
}
