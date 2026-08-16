import * as THREE from 'three';

// ── Sidewalk waypoint graph ───────────────────────────────────────────
// Pedestrians follow this graph. It traces the four sidewalk strips
// defined in ground.ts, with crossing waypoints at intersections.
//
// Ground layout constants (from ground.ts):
//   STREET_WIDTH = 10, BLOCK_SIZE = 60, SIDEWALK_WIDTH = 2
//   TOTAL_EXTENT = 80
//
// Sidewalk strips:
//   Top:    x=[-40..40], z=-39
//   Bottom: x=[-40..40], z=39
//   Left:   x=-39,       z=[-30..30]
//   Right:  x=39,        z=[-30..30]
//
// Intersections (crosswalk centers):
//   TL: (-40-5, -30) = (-45, -30)
//   TR: (40+5, -30) = (45, -30)
//   BL: (-45, 30)
//   BR: (45, 30)

const STREET_WIDTH = 10;
const BLOCK_SIZE = 60;
const HALF_BLOCK = BLOCK_SIZE / 2;
const SW_OFFSET = HALF_BLOCK + STREET_WIDTH / 2; // 40
const CROSS_X = -SW_OFFSET - STREET_WIDTH / 2; // -45 (left intersection x)
const CROSS_X_R = SW_OFFSET + STREET_WIDTH / 2; // 45 (right intersection x)

export interface Waypoint {
  position: THREE.Vector3;
  /** Type of waypoint */
  type: 'sidewalk' | 'intersection' | 'cluster';
  /** For cluster waypoints, group size (2-4) */
  clusterSize?: number;
}

export interface SidewalkPath {
  /** Ordered waypoints along one side of the block */
  waypoints: Waypoint[];
  /** Crossing waypoints at each corner */
  crossings: Waypoint[];
  /** Cluster spots where pedestrians stand and talk */
  clusters: Waypoint[];
}

/**
 * Build a complete sidewalk waypoint graph that follows the block's
 * sidewalk layout. Returns paths for pedestrians to walk on.
 */
export function buildSidewalkPaths(): SidewalkPath {
  const waypoints: Waypoint[] = [];
  const crossings: Waypoint[] = [];
  const clusters: Waypoint[] = [];

  // ── Top sidewalk (west → east) ────────────────────────────────────
  const topZ = -SW_OFFSET;
  for (let x = -SW_OFFSET; x <= SW_OFFSET; x += 4) {
    waypoints.push({ position: new THREE.Vector3(x, 0.02, topZ), type: 'sidewalk' });
  }
  // Crossings at top corners
  crossings.push({ position: new THREE.Vector3(CROSS_X, 0.02, topZ), type: 'intersection' });
  crossings.push({ position: new THREE.Vector3(CROSS_X_R, 0.02, topZ), type: 'intersection' });

  // ── Bottom sidewalk (east → west) ─────────────────────────────────
  const botZ = SW_OFFSET;
  for (let x = SW_OFFSET; x >= -SW_OFFSET; x -= 4) {
    waypoints.push({ position: new THREE.Vector3(x, 0.02, botZ), type: 'sidewalk' });
  }
  crossings.push({ position: new THREE.Vector3(CROSS_X, 0.02, botZ), type: 'intersection' });
  crossings.push({ position: new THREE.Vector3(CROSS_X_R, 0.02, botZ), type: 'intersection' });

  // ── Left sidewalk (north → south) ─────────────────────────────────
  const leftX = -SW_OFFSET;
  for (let z = topZ; z <= botZ; z += 4) {
    waypoints.push({ position: new THREE.Vector3(leftX, 0.02, z), type: 'sidewalk' });
  }

  // ── Right sidewalk (south → north) ────────────────────────────────
  const rightX = SW_OFFSET;
  for (let z = botZ; z >= topZ; z -= 4) {
    waypoints.push({ position: new THREE.Vector3(rightX, 0.02, z), type: 'sidewalk' });
  }

  // ── Cluster positions (on sidewalks, away from crossings) ─────────
  // Place cluster spots roughly every 12 meters along each sidewalk strip
  const clusterOffsets = [
    // Top sidewalk clusters
    { x: -SW_OFFSET + 12, z: topZ },
    { x: -SW_OFFSET + 24, z: topZ },
    { x: SW_OFFSET - 12, z: topZ },
    // Bottom sidewalk clusters
    { x: SW_OFFSET - 12, z: botZ },
    { x: SW_OFFSET - 24, z: botZ },
    { x: -SW_OFFSET + 12, z: botZ },
    // Left sidewalk clusters
    { x: leftX, z: topZ + 12 },
    { x: leftX, z: topZ + 24 },
    // Right sidewalk clusters
    { x: rightX, z: botZ - 12 },
    { x: rightX, z: botZ - 24 },
  ];

  for (const offset of clusterOffsets) {
    clusters.push({
      position: new THREE.Vector3(offset.x, 0.02, offset.z),
      type: 'cluster',
      clusterSize: 2 + Math.floor(Math.random() * 3), // 2–4
    });
  }

  return { waypoints, crossings, clusters };
}

/**
 * Get all walkable sidewalk positions as a flat array.
 * Excludes crossing positions (those are handled separately).
 */
export function getAllSidewalkPoints(path: SidewalkPath): THREE.Vector3[] {
  return path.waypoints.map((w) => w.position.clone());
}

/**
 * Get a random sidewalk waypoint index for spawning.
 */
export function randomSidewalkIndex(path: SidewalkPath): number {
  return Math.floor(Math.random() * path.waypoints.length);
}
