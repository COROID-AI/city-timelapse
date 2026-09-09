/**
 * Crowd Simulation and Path Navigation along BlockLayout Sidewalks and Crosswalks.
 *
 * Simulates low-poly pedestrian agents:
 * - Walking along connected or segmented BlockLayout WalkingPaths.
 * - Spacing management (repulsion/separation between nearby pedestrians to prevent bunching).
 * - Pausing at storefront window-shopping points located along building plots' frontage planes.
 * - Dynamic population respawn/reclothing and smooth density adjustment based on era channel.
 *
 * Pure simulation logic and state management, decoupled from Three.js scene graphs.
 */

import type { BlockLayout, GridPoint2D, WalkingPath } from '../../layout/types';
import type { TimelineChannel } from '../../../era/types';
import type { EraId } from '../../../era/years';
import {
  getPedestrianEraSpec,
  interpolateCrowdDensity,
  interpolateWalkSpeed,
} from './pedestrianEraData';

/* ------------------------------------------------------------------ */
/* Geometry & Path Sampling Utilities                                 */
/* ------------------------------------------------------------------ */

export interface PathSegment {
  readonly pathId: string;
  readonly start: GridPoint2D;
  readonly end: GridPoint2D;
  readonly length: number;
  readonly dirX: number;
  readonly dirZ: number;
}

export interface WindowShoppingPoint {
  readonly id: string;
  readonly position: GridPoint2D;
  readonly facingAngle: number;
  readonly plotId: string;
}

/**
 * Extracts linear segments from a BlockLayout's walking paths.
 */
export function extractPathSegments(walkingPaths: readonly WalkingPath[]): PathSegment[] {
  const segments: PathSegment[] = [];

  for (const path of walkingPaths) {
    for (let i = 0; i < path.points.length - 1; i += 1) {
      const p1 = path.points[i];
      const p2 = path.points[i + 1];
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const length = Math.hypot(dx, dz);
      if (length > 0.001) {
        segments.push({
          pathId: `${path.id}-seg-${i}`,
          start: p1,
          end: p2,
          length,
          dirX: dx / length,
          dirZ: dz / length,
        });
      }
    }
  }

  return segments;
}

/**
 * Extracts deterministic window-shopping points from building plot frontage planes.
 */
export function extractWindowShoppingPoints(layout: BlockLayout): WindowShoppingPoint[] {
  const points: WindowShoppingPoint[] = [];

  for (const plot of layout.plots) {
    const fp = plot.frontagePlane;
    // Walkers browse in front of storefront (slightly offset in front of frontage plane)
    // facing normal is outward (toward street), so we position viewer right at frontage
    const p = fp.position;
    const facing = fp.facing;

    // Place 1 or 2 shopping spots per plot
    const perpX = -facing.z;
    const perpZ = facing.x;
    const halfW = Math.min(fp.width * 0.3, 2.0);

    // Left window
    points.push({
      id: `${plot.id}-shop-1`,
      position: {
        x: p.x - perpX * halfW * 0.5 + facing.x * 0.3,
        z: p.z - perpZ * halfW * 0.5 + facing.z * 0.3,
      },
      facingAngle: Math.atan2(-facing.x, -facing.z), // Face toward the building
      plotId: plot.id,
    });

    // Right window
    points.push({
      id: `${plot.id}-shop-2`,
      position: {
        x: p.x + perpX * halfW * 0.5 + facing.x * 0.3,
        z: p.z + perpZ * halfW * 0.5 + facing.z * 0.3,
      },
      facingAngle: Math.atan2(-facing.x, -facing.z),
      plotId: plot.id,
    });
  }

  return points;
}

/* ------------------------------------------------------------------ */
/* Pedestrian Agent State                                             */
/* ------------------------------------------------------------------ */

export type PedestrianState = 'walking' | 'window_shopping' | 'idle';

export interface PedestrianAgent {
  readonly id: number;
  readonly seed: number;
  segmentIndex: number;
  segmentProgress: number; // in world meters along segment
  directionForward: boolean;
  position: GridPoint2D;
  heading: number; // yaw rotation in radians
  walkSpeed: number; // base speed in m/s
  totalDistanceWalked: number;
  lateralOffset: number; // offset across sidewalk path width

  state: PedestrianState;
  pauseTimer: number; // remaining pause time in seconds
  shoppingSpot: WindowShoppingPoint | null;

  era: EraId;
  outfitIndex: number;
  active: boolean; // active in crowd or pooled
}

/* ------------------------------------------------------------------ */
/* Crowd Simulation Class                                             */
/* ------------------------------------------------------------------ */

export interface CrowdSimOptions {
  readonly minSpacing?: number;
  readonly pauseProbability?: number;
  readonly minPauseDuration?: number;
  readonly maxPauseDuration?: number;
}

export class CrowdSim {
  private readonly layout: BlockLayout;
  private readonly segments: PathSegment[];
  private readonly shoppingPoints: WindowShoppingPoint[];
  private readonly agents: PedestrianAgent[] = [];
  private readonly minSpacing: number;
  private readonly pauseProbability: number;
  private readonly minPauseDuration: number;
  private readonly maxPauseDuration: number;

  private nextAgentId = 1;

  constructor(layout: BlockLayout, options: CrowdSimOptions = {}) {
    this.layout = layout;
    this.segments = extractPathSegments(layout.walkingPaths);
    this.shoppingPoints = extractWindowShoppingPoints(layout);
    this.minSpacing = options.minSpacing ?? 1.1; // meters
    this.pauseProbability = options.pauseProbability ?? 0.08; // chance per sec when near shop
    this.minPauseDuration = options.minPauseDuration ?? 3.0; // sec
    this.maxPauseDuration = options.maxPauseDuration ?? 7.0; // sec
  }

  public getLayout(): BlockLayout {
    return this.layout;
  }

  public getSegments(): readonly PathSegment[] {
    return this.segments;
  }

  public getShoppingPoints(): readonly WindowShoppingPoint[] {
    return this.shoppingPoints;
  }

  public getAgents(): readonly PedestrianAgent[] {
    return this.agents;
  }

  public getActiveAgents(): PedestrianAgent[] {
    return this.agents.filter((a) => a.active);
  }

  /**
   * Initializes or adjusts agent pool to match target era and density.
   */
  public syncToEra(channel: TimelineChannel): void {
    const targetDensity = interpolateCrowdDensity(channel);
    const targetSpeed = interpolateWalkSpeed(channel);

    // Reclothe / update era for existing active agents
    const effectiveEra = channel.t >= 0.5 ? channel.toEra : channel.fromEra;

    // Activate or spawn agents until active count matches targetDensity
    const activeAgents = this.getActiveAgents();

    if (activeAgents.length < targetDensity) {
      const needed = targetDensity - activeAgents.length;
      for (let i = 0; i < needed; i += 1) {
        this.spawnOrActivateAgent(effectiveEra, targetSpeed);
      }
    } else if (activeAgents.length > targetDensity) {
      // Deactivate surplus agents gracefully
      const excess = activeAgents.length - targetDensity;
      for (let i = 0; i < excess; i += 1) {
        activeAgents[activeAgents.length - 1 - i].active = false;
      }
    }

    // Update era and speed on active agents
    for (const agent of this.getActiveAgents()) {
      if (agent.era !== effectiveEra) {
        agent.era = effectiveEra;
        const eraSpec = getPedestrianEraSpec(effectiveEra);
        agent.outfitIndex = agent.seed % eraSpec.outfits.length;
      }
      agent.walkSpeed = targetSpeed * (0.85 + (agent.seed % 30) / 100);
    }
  }

  /**
   * Spawns a new pedestrian or recycles an inactive one from the pool.
   */
  private spawnOrActivateAgent(era: EraId, baseSpeed: number): PedestrianAgent {
    // Check if we can reuse an inactive agent
    const pooled = this.agents.find((a) => !a.active);
    const spec = getPedestrianEraSpec(era);

    if (pooled) {
      pooled.active = true;
      pooled.era = era;
      pooled.outfitIndex = pooled.seed % spec.outfits.length;
      pooled.walkSpeed = baseSpeed * (0.85 + (pooled.seed % 30) / 100);
      return pooled;
    }

    // Create a new agent
    const id = this.nextAgentId++;
    const seed = id * 17 + 3;
    const segmentIndex = seed % this.segments.length;
    const segment = this.segments[segmentIndex];
    const segmentProgress = ((seed * 3.7) % 0.9 + 0.05) * segment.length;
    const directionForward = (seed % 2) === 0;
    const lateralOffset = (((seed % 10) - 5) / 5) * 0.25; // slight left/right sidewalk spread

    const pos = this.computePositionOnSegment(segment, segmentProgress, lateralOffset);
    const heading = this.computeHeading(segment, directionForward);

    const agent: PedestrianAgent = {
      id,
      seed,
      segmentIndex,
      segmentProgress,
      directionForward,
      position: pos,
      heading,
      walkSpeed: baseSpeed * (0.85 + (seed % 30) / 100),
      totalDistanceWalked: 0,
      lateralOffset,
      state: 'walking',
      pauseTimer: 0,
      shoppingSpot: null,
      era,
      outfitIndex: seed % spec.outfits.length,
      active: true,
    };

    this.agents.push(agent);
    return agent;
  }

  private computePositionOnSegment(
    seg: PathSegment,
    dist: number,
    lateral: number,
  ): GridPoint2D {
    // Normal perpendicular to segment
    const perpX = -seg.dirZ;
    const perpZ = seg.dirX;
    return {
      x: seg.start.x + seg.dirX * dist + perpX * lateral,
      z: seg.start.z + seg.dirZ * dist + perpZ * lateral,
    };
  }

  private computeHeading(seg: PathSegment, forward: boolean): number {
    const dx = forward ? seg.dirX : -seg.dirX;
    const dz = forward ? seg.dirZ : -seg.dirZ;
    // In Three.js coordinates, angle around Y axis
    return Math.atan2(dx, dz);
  }

  /**
   * Advances crowd simulation by deltaSeconds.
   */
  public update(deltaSeconds: number, channel?: TimelineChannel): void {
    if (channel) {
      this.syncToEra(channel);
    }

    const dt = Math.max(0, Math.min(0.2, deltaSeconds));
    const activeList = this.getActiveAgents();

    // 1. Update states and movement
    for (const agent of activeList) {
      if (agent.state === 'window_shopping') {
        agent.pauseTimer -= dt;
        if (agent.pauseTimer <= 0) {
          // Resume walking
          agent.state = 'walking';
          agent.shoppingSpot = null;
        }
        continue;
      }

      if (agent.state === 'walking') {
        const seg = this.segments[agent.segmentIndex];
        if (!seg) continue;

        // Check window-shopping pause opportunity
        const paused = this.checkWindowShoppingTrigger(agent, dt);
        if (paused) {
          continue;
        }

        // Apply crowd spacing speed modifier
        const speedFactor = this.calculateSpacingFactor(agent, activeList);
        const effectiveSpeed = agent.walkSpeed * speedFactor;
        const step = effectiveSpeed * dt;

        if (agent.directionForward) {
          agent.segmentProgress += step;
          if (agent.segmentProgress >= seg.length) {
            // Turn around or jump to next connected segment
            agent.directionForward = false;
            agent.segmentProgress = seg.length;
          }
        } else {
          agent.segmentProgress -= step;
          if (agent.segmentProgress <= 0) {
            // Turn around
            agent.directionForward = true;
            agent.segmentProgress = 0;
          }
        }

        agent.totalDistanceWalked += step;
        agent.position = this.computePositionOnSegment(
          seg,
          agent.segmentProgress,
          agent.lateralOffset,
        );
        agent.heading = this.computeHeading(seg, agent.directionForward);
      }
    }
  }

  /**
   * Simple spacing algorithm: slows down or yields if too close to an agent in front.
   */
  private calculateSpacingFactor(agent: PedestrianAgent, others: readonly PedestrianAgent[]): number {
    let factor = 1.0;

    for (const other of others) {
      if (other.id === agent.id) continue;

      const dx = other.position.x - agent.position.x;
      const dz = other.position.z - agent.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < this.minSpacing && dist > 0.001) {
        // Dot product with heading direction to see if the other agent is in front
        const forwardX = Math.sin(agent.heading);
        const forwardZ = Math.cos(agent.heading);
        const dot = (dx / dist) * forwardX + (dz / dist) * forwardZ;

        if (dot > 0.3) {
          // Someone is ahead in our path: decelerate smoothly
          const proximity = dist / this.minSpacing;
          factor = Math.min(factor, Math.max(0.15, proximity * 0.85));
        }
      }
    }

    return factor;
  }

  /**
   * Checks if an agent is near a storefront shopping spot and rolls chance to pause and browse.
   */
  private checkWindowShoppingTrigger(agent: PedestrianAgent, dt: number): boolean {
    if (this.shoppingPoints.length === 0) return false;

    for (const spot of this.shoppingPoints) {
      const dx = spot.position.x - agent.position.x;
      const dz = spot.position.z - agent.position.z;
      const dist = Math.hypot(dx, dz);

      // Within 2.0m of storefront spot
      if (dist < 2.0) {
        const roll = Math.random();
        if (roll < this.pauseProbability * dt) {
          agent.state = 'window_shopping';
          agent.pauseTimer =
            this.minPauseDuration +
            Math.random() * (this.maxPauseDuration - this.minPauseDuration);
          agent.shoppingSpot = spot;
          agent.heading = spot.facingAngle;
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Disposes the simulation and clears agent list.
   */
  public dispose(): void {
    this.agents.length = 0;
  }
}
