import * as THREE from 'three';
import type { EraId } from '../eras.js';
import { buildPedestrianRig, animateWalkCycle, resetPose, type PedestrianParts } from './rig.js';
import { applyOutfit, attachClusterProp, type AppliedOutfit } from './outfits.js';
import { buildSidewalkPaths, getAllSidewalkPoints, randomSidewalkIndex, type SidewalkPath, type Waypoint } from './paths.js';
import { getPedestrianSpec, type PedestrianEraSpec } from './specs.js';

// ── Pedestrian state machine ──────────────────────────────────────────

/** Behavior states for a single pedestrian */
export enum PedState {
  Walking = 'walking',
  WaitingAtCrossing = 'waiting',
  StandingGroup = 'standing_group',
}

/** Full runtime state for one pedestrian instance */
export interface PedestrianState {
  parts: PedestrianParts;
  outfit: AppliedOutfit;
  prop?: THREE.Object3D;
  state: PedState;
  /** Current waypoint index along the sidewalk path */
  waypointIndex: number;
  /** Target waypoint */
  targetWaypoint: Waypoint | null;
  /** Speed (m/s) for this individual */
  speed: number;
  /** Time offset so individuals don't walk in sync */
  timeOffset: number;
  /** Remaining wait time at crossing / cluster */
  remainingWait: number;
  /** Direction multiplier (-1 or +1 along path) */
  direction: number;
  /** Which sidewalk strip this pedestrian belongs to */
  stripIndex: number;
  /** Whether this is an e-scooter rider (2025 only) */
  isScooterRider: boolean;
}

// ── E-scooter mesh ────────────────────────────────────────────────────

function buildEScooter(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'e_scooter';

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
  const deckColor = 0x1a73e8;

  // Deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.6), new THREE.MeshStandardMaterial({ color: deckColor, roughness: 0.5 }));
  deck.position.y = 0.35;
  group.add(deck);

  // Stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6), frameMat);
  stem.position.set(0, 0.7, -0.2);
  stem.rotation.x = 0.1;
  group.add(stem);

  // Handlebar
  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.25, 6), frameMat);
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(0, 1.05, -0.23);
  group.add(handlebar);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8);
  const frontWheel = new THREE.Mesh(wheelGeo, wheelMat);
  frontWheel.rotation.x = Math.PI / 2;
  frontWheel.position.set(0, 0.12, -0.28);
  group.add(frontWheel);

  const rearWheel = new THREE.Mesh(wheelGeo, wheelMat);
  rearWheel.rotation.x = Math.PI / 2;
  rearWheel.position.set(0, 0.12, 0.28);
  group.add(rearWheel);

  return group;
}

// ── PedestrianController ──────────────────────────────────────────────

export class PedestrianController {
  private readonly _scene: THREE.Scene;
  private _pedestrians: PedestrianState[] = [];
  private _path: SidewalkPath | null = null;
  private _currentEra: EraId | null = null;
  private _sidewalkPoints: THREE.Vector3[] = [];

  constructor(scene: THREE.Scene) {
    this._scene = scene;
    this._path = buildSidewalkPaths();
    this._sidewalkPoints = getAllSidewalkPoints(this._path);
  }

  /** Get all rendered child objects (for diagnostics / cleanup) */
  get allMeshes(): THREE.Object3D[] {
    return this._pedestrians.flatMap((p) => [p.parts.root, ...p.outfit.meshes].filter(Boolean));
  }

  // ── Era management ──────────────────────────────────────────────────

  /**
   * Swap the crowd for a new era. Removes all old meshes without leaking,
   * then spawns a fresh set of pedestrians appropriate for the new era.
   */
  updateEra(eraId: EraId): void {
    if (this._currentEra === eraId) return;

    // Clean up old meshes
    this._cleanup();

    this._currentEra = eraId;
    this._spawnEraCrowd(eraId);
  }

  // ── Spawning ────────────────────────────────────────────────────────

  private _spawnEraCrowd(eraId: EraId): void {
    const spec = getPedestrianSpec(eraId);
    const totalSpawn = spec.count;

    // Spawn walking pedestrians
    const walkerCount = Math.floor(totalSpawn * 0.7);
    for (let i = 0; i < walkerCount; i++) {
      this._spawnWalker(eraId, spec, i);
    }

    // Spawn standing groups (clusters of 2-4)
    const clusterCount = Math.floor(totalSpawn * 0.25);
    for (let i = 0; i < clusterCount; i++) {
      this._spawnCluster(eraId, spec, i);
    }

    // Spawn e-scooter riders for 2025
    if (spec.hasScooterRiders) {
      const scooterCount = 4;
      for (let i = 0; i < scooterCount; i++) {
        this._spawnScooterRider(eraId, spec, i);
      }
    }
  }

  private _spawnWalker(eraId: EraId, spec: PedestrianEraSpec, index: number): void {
    const path = this._path!;
    const wpIndex = randomSidewalkIndex(path);
    const wp = path.waypoints[wpIndex];

    const parts = buildPedestrianRig();
    const outfit = applyOutfit(parts, eraId, index, spec);

    const state: PedestrianState = {
      parts,
      outfit,
      state: PedState.Walking,
      waypointIndex: wpIndex,
      targetWaypoint: wp,
      speed: spec.speedRange.min + Math.random() * (spec.speedRange.max - spec.speedRange.min),
      timeOffset: Math.random() * 10,
      remainingWait: 0,
      direction: Math.random() > 0.5 ? 1 : -1,
      stripIndex: Math.floor(index / (path.waypoints.length / 4)),
      isScooterRider: false,
    };

    parts.root.position.copy(wp.position);
    // Face direction of travel
    parts.root.rotation.y = state.direction > 0 ? 0 : Math.PI;

    this._scene.add(parts.root);
    this._pedestrians.push(state);
  }

  private _spawnCluster(eraId: EraId, spec: PedestrianEraSpec, index: number): void {
    const clusters = this._path!.clusters;
    if (clusters.length === 0) return;

    const cluster = clusters[index % clusters.length];
    const count = cluster.clusterSize ?? 3;

    for (let i = 0; i < count; i++) {
      const parts = buildPedestrianRig();
      const outfitIdx = index * count + i;
      const outfit = applyOutfit(parts, eraId, outfitIdx, spec);

      // Slight position offset within cluster
      const spread = 0.6;
      const offsetX = (Math.random() - 0.5) * spread;
      const offsetZ = (Math.random() - 0.5) * spread;

      const state: PedestrianState = {
        parts,
        outfit,
        state: PedState.StandingGroup,
        waypointIndex: -1,
        targetWaypoint: null,
        speed: 0,
        timeOffset: Math.random() * 5,
        remainingWait: 3 + Math.random() * 7, // stand for 3–10 seconds
        direction: 1,
        stripIndex: 0,
        isScooterRider: false,
      };

      parts.root.position.set(
        cluster.position.x + offsetX,
        0.02,
        cluster.position.z + offsetZ,
      );
      // Face inward toward cluster center
      parts.root.rotation.y = Math.atan2(-offsetX, -offsetZ);

      // Attach era-appropriate prop
      const propType = spec.clusterProps[i % spec.clusterProps.length];
      const palette = ERA_PALETTE_SHORT[eraId];
      const propColor = pickColor(palette);
      state.prop = attachClusterProp(parts, propType, propColor);

      this._scene.add(parts.root);
      this._pedestrians.push(state);
    }
  }

  private _spawnScooterRider(eraId: EraId, spec: PedestrianEraSpec, index: number): void {
    const path = this._path!;
    const wpIndex = randomSidewalkIndex(path);
    const wp = path.waypoints[wpIndex];

    const parts = buildPedestrianRig();
    const outfit = applyOutfit(parts, eraId, index + 100, spec);

    // Add scooter mesh
    const scooter = buildEScooter();
    scooter.position.set(0, -0.02, 0);
    parts.root.add(scooter);

    const state: PedestrianState = {
      parts,
      outfit,
      prop: scooter,
      state: PedState.Walking,
      waypointIndex: wpIndex,
      targetWaypoint: wp,
      speed: spec.speedRange.max + 0.3, // scooters are faster
      timeOffset: Math.random() * 10,
      remainingWait: 0,
      direction: Math.random() > 0.5 ? 1 : -1,
      stripIndex: Math.floor(index / 2),
      isScooterRider: true,
    };

    parts.root.position.copy(wp.position);
    parts.root.rotation.y = state.direction > 0 ? 0 : Math.PI;

    this._scene.add(parts.root);
    this._pedestrians.push(state);
  }

  // ── Animation tick ──────────────────────────────────────────────────

  /** Called every frame with elapsed delta time */
  update(delta: number): void {
    for (const ped of this._pedestrians) {
      switch (ped.state) {
        case PedState.Walking:
          this._updateWalking(ped, delta);
          break;
        case PedState.WaitingAtCrossing:
          this._updateWaiting(ped, delta);
          break;
        case PedState.StandingGroup:
          this._updateStanding(ped, delta);
          break;
      }
    }
  }

  private _updateWalking(ped: PedestrianState, delta: number): void {
    const path = this._path!;

    // Walk-cycle animation (time-based, deterministic)
    const elapsed = ped.timeOffset + performance.now() / 1000;
    animateWalkCycle(ped.parts, elapsed, ped.speed);

    // Move toward next waypoint
    const moveSpeed = ped.speed * delta;

    if (!ped.targetWaypoint) {
      // Pick a new target
      ped.targetWaypoint = path.waypoints[(ped.waypointIndex + ped.direction + path.waypoints.length) % path.waypoints.length];
      ped.waypointIndex = (ped.waypointIndex + ped.direction + path.waypoints.length) % path.waypoints.length;
      // Face target direction
      ped.parts.root.rotation.y = ped.direction > 0 ? 0 : Math.PI;
    }

    const target = ped.targetWaypoint.position;
    const current = ped.parts.root.position;
    const dx = target.x - current.x;
    const dz = target.z - current.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < moveSpeed + 0.05) {
      // Arrived at waypoint
      ped.parts.root.position.copy(target);

      // Check if we're near an intersection (crossing)
      if (isNearIntersection(current, path)) {
        // Wait briefly at crossing (simulating traffic light)
        ped.state = PedState.WaitingAtCrossing;
        ped.remainingWait = 1.5 + Math.random() * 2;
        resetPose(ped.parts);
        return;
      }

      // Pick next waypoint — continue same direction or occasionally reverse
      if (Math.random() < 0.05) {
        ped.direction *= -1;
      }
      ped.targetWaypoint = path.waypoints[(ped.waypointIndex + ped.direction + path.waypoints.length) % path.waypoints.length];
      ped.waypointIndex = (ped.waypointIndex + ped.direction + path.waypoints.length) % path.waypoints.length;
      ped.parts.root.rotation.y = ped.direction > 0 ? 0 : Math.PI;
    } else {
      // Move toward target
      const nx = dx / dist;
      const nz = dz / dist;
      ped.parts.root.position.x += nx * Math.min(moveSpeed, dist);
      ped.parts.root.position.z += nz * Math.min(moveSpeed, dist);
    }
  }

  private _updateWaiting(ped: PedestrianState, delta: number): void {
    ped.remainingWait -= delta;
    if (ped.remainingWait <= 0) {
      // Resume walking
      ped.state = PedState.Walking;
      ped.targetWaypoint = null;
      ped.waypointIndex = (ped.waypointIndex + ped.direction + this._path!.waypoints.length) % this._path!.waypoints.length;
    }
  }

  private _updateStanding(ped: PedestrianState, delta: number): void {
    ped.remainingWait -= delta;
    if (ped.remainingWait <= 0) {
      // Leave cluster and start walking
      ped.state = PedState.Walking;
      ped.speed = getPedestrianSpec(this._currentEra!).speedRange.min + Math.random() * (getPedestrianSpec(this._currentEra!).speedRange.max - getPedestrianSpec(this._currentEra!).speedRange.min);

      // Find nearest sidewalk waypoint
      const pos = ped.parts.root.position;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < this._sidewalkPoints.length; i++) {
        const d = pos.distanceToSquared(this._sidewalkPoints[i]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      ped.waypointIndex = bestIdx;
      ped.targetWaypoint = this._path!.waypoints[bestIdx];
      ped.direction = Math.random() > 0.5 ? 1 : -1;
      ped.parts.root.rotation.y = ped.direction > 0 ? 0 : Math.PI;
    }

    // Subtle idle sway when standing
    const t = performance.now() / 1000 + ped.timeOffset;
    ped.parts.torso.rotation.z = Math.sin(t * 0.8) * 0.03;
    ped.parts.leftArm.rotation.x = Math.sin(t * 0.6) * 0.05;
    ped.parts.rightArm.rotation.x = Math.sin(t * 0.6 + Math.PI) * 0.05;
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  private _cleanup(): void {
    for (const ped of this._pedestrians) {
      // Dispose geometry and materials
      for (const mesh of ped.outfit.meshes) {
        mesh.traverse((child) => {
          if ((child as THREE.Mesh).geometry) {
            (child as THREE.Mesh).geometry.dispose();
          }
          if ((child as THREE.Mesh).material) {
            const mat = (child as THREE.Mesh).material as THREE.Material;
            if (Array.isArray(mat)) {
              mat.forEach((m) => m.dispose());
            } else {
              mat.dispose();
            }
          }
        });
      }
      // Dispose rig meshes
      ped.parts.root.traverse((child) => {
        if ((child as THREE.Mesh).geometry) {
          (child as THREE.Mesh).geometry.dispose();
        }
        if ((child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material as THREE.Material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else {
            mat.dispose();
          }
        }
      });
      // Remove from scene
      this._scene.remove(ped.parts.root);
    }
    this._pedestrians = [];
  }

  /** Fully dispose the controller and all its meshes */
  dispose(): void {
    this._cleanup();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Short palette lookup for prop colors */
const ERA_PALETTE_SHORT: Record<EraId, string[]> = {
  '1945': ['#c4a35a', '#8b0000', '#f5f0e1', '#4a5568', '#5c4033'],
  '1965': ['#ff1493', '#00ced1', '#daa520', '#ff6b35', '#1a5276'],
  '1985': ['#ff00ff', '#00ffff', '#ffff00', '#ff0066', '#00ff00'],
  '2005': ['#ff69b4', '#00bfff', '#ffd700', '#dc143c', '#4169e1'],
  '2025': ['#f2cc8f', '#e63946', '#457b9d', '#2d6a4f', '#e07a5f'],
};

function pickColor(colors: string[]): THREE.Color {
  return new THREE.Color(colors[Math.floor(Math.random() * colors.length)]);
}

/** Check if a position is near any intersection crossing point */
function isNearIntersection(pos: THREE.Vector3, path: SidewalkPath): boolean {
  const threshold = 2.0;
  for (const crossing of path.crossings) {
    if (pos.distanceTo(crossing.position) < threshold) {
      return true;
    }
  }
  return false;
}
