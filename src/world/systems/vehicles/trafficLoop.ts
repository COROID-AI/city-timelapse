/**
 * Traffic loop and road lane motion simulation for the city block.
 *
 * Deterministically routes driving vehicles along BlockLayout lanes and positions
 * parked vehicles inside BlockLayout parking slots. Vehicles maintain smooth continuous
 * motion across era transitions.
 */

import type { TimelineChannel, VehicleModelSpec } from '../../../era/types';
import type { EraId } from '../../../era/years';
import type { BlockLayout, GridPoint2D, GridRect, Lane, ParkingSlot, Street } from '../../layout/types';
import { easeInOut, lerpNumber } from '../../../era/transition';
import { vehicleEraData } from './vehicleEraData';

/** Deterministic PRNG helper */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string): number {
  const match = /-(\d+)$/.exec(seed);
  if (match) return Number(match[1]);
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Resolved driving travel endpoints for a lane.
 */
export interface LaneTravelInfo {
  lane: Lane;
  street: Street;
  length: number;
  startPoint: GridPoint2D;
  endPoint: GridPoint2D;
  yaw: number; // heading angle in radians for Three.js (front = +X)
}

/**
 * Resolves the start, end, length, and heading yaw for a given lane.
 */
export function getLaneTravelInfo(lane: Lane, street: Street): LaneTravelInfo {
  const isXAxis = street.axis === 'x';
  const dir = lane.direction;

  let startPoint: GridPoint2D;
  let endPoint: GridPoint2D;

  if (isXAxis) {
    const laneCenterZ = (lane.centerLine[0].z + lane.centerLine[1].z) / 2;
    if (dir.x >= 0) {
      startPoint = { x: lane.bounds.minX, z: laneCenterZ };
      endPoint = { x: lane.bounds.maxX, z: laneCenterZ };
    } else {
      startPoint = { x: lane.bounds.maxX, z: laneCenterZ };
      endPoint = { x: lane.bounds.minX, z: laneCenterZ };
    }
  } else {
    const laneCenterX = (lane.centerLine[0].x + lane.centerLine[1].x) / 2;
    if (dir.z >= 0) {
      startPoint = { x: laneCenterX, z: lane.bounds.minZ };
      endPoint = { x: laneCenterX, z: lane.bounds.maxZ };
    } else {
      startPoint = { x: laneCenterX, z: lane.bounds.maxZ };
      endPoint = { x: laneCenterX, z: lane.bounds.minZ };
    }
  }

  const length = Math.hypot(endPoint.x - startPoint.x, endPoint.z - startPoint.z);
  // Three.js vehicle mesh has front facing +X
  const yaw = Math.atan2(-dir.z, dir.x);

  return {
    lane,
    street,
    length: length > 0 ? length : 1,
    startPoint,
    endPoint,
    yaw,
  };
}

/**
 * Samples a point along a lane's travel trajectory given normalized progress t in [0, 1].
 */
export function sampleLanePoint(laneInfo: LaneTravelInfo, t: number): GridPoint2D {
  const normT = ((t % 1) + 1) % 1; // safe [0, 1)
  return {
    x: laneInfo.startPoint.x + (laneInfo.endPoint.x - laneInfo.startPoint.x) * normT,
    z: laneInfo.startPoint.z + (laneInfo.endPoint.z - laneInfo.startPoint.z) * normT,
  };
}

/**
 * Checks if a point is within a 2D bounding rectangle with epsilon tolerance.
 */
export function isPointInRect(point: GridPoint2D, rect: GridRect, eps = 1e-4): boolean {
  return (
    point.x >= rect.minX - eps &&
    point.x <= rect.maxX + eps &&
    point.z >= rect.minZ - eps &&
    point.z <= rect.maxZ + eps
  );
}

/**
 * A simulated active driving traffic agent.
 */
export interface DrivingAgent {
  id: string;
  laneInfo: LaneTravelInfo;
  distance: number; // accumulated distance traveled along lane
  speedFactor: number; // deterministic speed variation (e.g. 0.9 .. 1.1)
  eraColors: Record<EraId, string>;
  eraModels: Record<EraId, VehicleModelSpec>;
}

/**
 * A simulated parked vehicle in a BlockLayout parking slot.
 */
export interface ParkedAgent {
  slot: ParkingSlot;
  position: GridPoint2D;
  yaw: number;
  eraColors: Record<EraId, string>;
  eraModels: Record<EraId, VehicleModelSpec>;
}

/**
 * Full traffic simulation state across lanes and parking slots.
 */
export class TrafficSimulation {
  readonly layout: BlockLayout;
  readonly laneInfos: LaneTravelInfo[] = [];
  readonly drivingAgents: DrivingAgent[] = [];
  readonly parkedAgents: ParkedAgent[] = [];

  constructor(layout: BlockLayout, maxDrivingCount = 16) {
    this.layout = layout;
    const rng = createRng(hashSeed(layout.seed));

    // 1. Gather all travel lanes
    for (const street of layout.streets) {
      for (const lane of street.lanes) {
        this.laneInfos.push(getLaneTravelInfo(lane, street));
      }
    }

    // 2. Initialize driving agents
    const allEras: EraId[] = ['1945', '1965', '1985', '2005', '2025'];

    for (let i = 0; i < maxDrivingCount; i += 1) {
      const laneIndex = i % this.laneInfos.length;
      const laneInfo = this.laneInfos[laneIndex];

      // Distribute initial distances along lane so cars are well-spaced
      const laneCars = Math.ceil(maxDrivingCount / this.laneInfos.length);
      const carIndexInLane = Math.floor(i / this.laneInfos.length);
      const baseDistance = (carIndexInLane / laneCars) * laneInfo.length;
      const distanceJitter = (rng() * 0.4 - 0.2) * (laneInfo.length / laneCars);
      const distance = Math.max(0, baseDistance + distanceJitter);

      const speedFactor = 0.9 + rng() * 0.2; // 0.9 to 1.1

      const eraColors: Partial<Record<EraId, string>> = {};
      const eraModels: Partial<Record<EraId, VehicleModelSpec>> = {};

      for (const era of allEras) {
        const spec = vehicleEraData[era];
        const colorIdx = Math.floor(rng() * spec.bodyColors.length);
        eraColors[era] = spec.bodyColors[colorIdx];

        // Pick model based on relativeFrequency
        const roll = rng();
        let accum = 0;
        let selectedModel = spec.models[0];
        for (const model of spec.models) {
          accum += model.relativeFrequency;
          if (roll <= accum) {
            selectedModel = model;
            break;
          }
        }
        eraModels[era] = selectedModel;
      }

      this.drivingAgents.push({
        id: `agent-driving-${i + 1}`,
        laneInfo,
        distance,
        speedFactor,
        eraColors: eraColors as Record<EraId, string>,
        eraModels: eraModels as Record<EraId, VehicleModelSpec>,
      });
    }

    // 3. Initialize parked agents
    for (const street of layout.streets) {
      for (let pIdx = 0; pIdx < street.parkingSlots.length; pIdx += 1) {
        const slot = street.parkingSlots[pIdx];
        const position: GridPoint2D = {
          x: (slot.bounds.minX + slot.bounds.maxX) / 2,
          z: (slot.bounds.minZ + slot.bounds.maxZ) / 2,
        };

        const isXAxis = street.axis === 'x';
        // Parked parallel along the street direction
        const yaw = isXAxis ? 0 : -Math.PI / 2;

        const eraColors: Partial<Record<EraId, string>> = {};
        const eraModels: Partial<Record<EraId, VehicleModelSpec>> = {};

        for (const era of allEras) {
          const spec = vehicleEraData[era];
          const colorIdx = Math.floor(rng() * spec.bodyColors.length);
          eraColors[era] = spec.bodyColors[colorIdx];

          const roll = rng();
          let accum = 0;
          let selectedModel = spec.models[0];
          for (const model of spec.models) {
            accum += model.relativeFrequency;
            if (roll <= accum) {
              selectedModel = model;
              break;
            }
          }
          eraModels[era] = selectedModel;
        }

        this.parkedAgents.push({
          slot,
          position,
          yaw,
          eraColors: eraColors as Record<EraId, string>,
          eraModels: eraModels as Record<EraId, VehicleModelSpec>,
        });
      }
    }
  }

  /**
   * Advances all driving agents forward along their respective lanes.
   */
  step(channel: TimelineChannel, deltaSeconds: number): void {
    if (deltaSeconds <= 0) return;

    const fromSpec = vehicleEraData[channel.fromEra];
    const toSpec = vehicleEraData[channel.toEra];
    const easedT = easeInOut(channel.t);
    const speed = lerpNumber(fromSpec.averageSpeed, toSpec.averageSpeed, easedT);

    for (const agent of this.drivingAgents) {
      const stepDist = speed * agent.speedFactor * deltaSeconds;
      agent.distance += stepDist;
    }
  }

  /**
   * Computes the current 2D world position of a driving agent.
   */
  getAgentPosition(agent: DrivingAgent): GridPoint2D {
    const progress = (agent.distance % agent.laneInfo.length) / agent.laneInfo.length;
    return sampleLanePoint(agent.laneInfo, progress);
  }
}
