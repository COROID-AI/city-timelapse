import * as THREE from 'three';
import type { AIState, CarHandle, CarState, TrackData } from './contracts';

/** Configuration profile for a single AI rival. */
export interface RivalProfile {
  readonly id: string;
  readonly name: string;
  readonly color: number;
  readonly colorHex: string;
  readonly topSpeed: number;
  readonly acceleration: number;
  readonly brakeDeceleration: number;
  readonly laneOffset: number;
  readonly aggression: number;
  readonly lookAheadDistance: number;
  readonly steerGain: number;
}

/** Configuration for dynamic rubber-banding pacing. */
export interface RubberBandingConfig {
  readonly enabled: boolean;
  readonly minSpeedFactor: number;
  readonly maxSpeedFactor: number;
  readonly catchUpDistance: number;
  readonly leadDistance: number;
}

/** Complete AI opponent handle and state. */
export interface AIOpponent extends CarHandle {
  readonly id: string;
  readonly name: string;
  readonly color: number;
  readonly colorHex: string;
  readonly profile: RivalProfile;
  readonly state: CarState;
  readonly aiState: AIState;
  readonly mesh: THREE.Group;
}

/** Options for spawning AI rivals. */
export interface AIOpponentsOptions {
  track?: TrackData;
  seed?: number;
  rivals?: Partial<RivalProfile>[];
  rubberBanding?: Partial<RubberBandingConfig>;
}

/** Player representation passed into AI update context. */
export interface AIPlayerSnapshot {
  state?: CarState;
  position?: THREE.Vector3;
  heading?: number;
  speed?: number;
  lap?: number;
  trackProgress?: number;
}

/** Context object passed each simulation tick. */
export interface AIUpdateContext {
  track?: TrackData;
  player?: CarState | CarHandle | AIPlayerSnapshot | null;
}

/** Foundation AIHandle returned by createAIOpponents. */
export interface AIHandle {
  /** Array of all 3 active rival cars. */
  readonly rivals: readonly AIOpponent[];
  /** Three.js group containing meshes for all rivals. */
  readonly group: THREE.Group;
  /** Advance every rival by deltaSeconds. */
  update: (deltaSeconds: number, context?: AIUpdateContext | TrackData) => void;
  /** Reset rivals back to their starting grid positions. */
  reset: (track?: TrackData) => void;
  /** Release all meshes, materials, and geometries. */
  dispose: () => void;
}

/** Default configuration profiles for the 3 distinct neon rivals. */
export const DEFAULT_RIVAL_PROFILES: ReadonlyArray<RivalProfile> = [
  {
    id: 'rival-1',
    name: 'Blaze',
    color: 0xff007f, // Neon Magenta
    colorHex: '#ff007f',
    topSpeed: 38,
    acceleration: 12,
    brakeDeceleration: 22,
    laneOffset: -2.0,
    aggression: 0.85,
    lookAheadDistance: 15,
    steerGain: 5.0,
  },
  {
    id: 'rival-2',
    name: 'Apex',
    color: 0x00f0ff, // Neon Cyan
    colorHex: '#00f0ff',
    topSpeed: 35,
    acceleration: 14,
    brakeDeceleration: 24,
    laneOffset: 2.0,
    aggression: 0.70,
    lookAheadDistance: 15,
    steerGain: 5.2,
  },
  {
    id: 'rival-3',
    name: 'Viper',
    color: 0xffb700, // Neon Amber
    colorHex: '#ffb700',
    topSpeed: 32,
    acceleration: 10,
    brakeDeceleration: 20,
    laneOffset: 0.0,
    aggression: 0.55,
    lookAheadDistance: 16,
    steerGain: 4.8,
  },
];

/** Default rubber-banding parameters. */
export const DEFAULT_RUBBER_BANDING: Readonly<RubberBandingConfig> = {
  enabled: true,
  minSpeedFactor: 0.80,
  maxSpeedFactor: 1.25,
  catchUpDistance: 50,
  leadDistance: 50,
};

/** Mulberry32 deterministic pseudo-random number generator. */
export function createPrng(seed: number = 12345): () => number {
  let s = Math.floor(seed) || 1;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normalize angle in radians to [-PI, PI]. */
export function normalizeAngle(angle: number): number {
  let a = angle % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Precomputed track polyline geometry. */
export interface TrackGeometry {
  readonly waypoints: THREE.Vector3[];
  readonly totalLength: number;
  readonly segmentLengths: number[];
  readonly cumulativeDistances: number[];
  readonly closed: boolean;
  readonly width: number;
}

/** Default circular track used when none is provided. */
export function createDefaultTrack(): TrackData {
  const waypoints: THREE.Vector3[] = [];
  const count = 32;
  const radius = 100;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    waypoints.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  return {
    startLine: {
      position: new THREE.Vector3(radius, 0, 0),
      heading: 0,
    },
    waypoints,
    checkpoints: [
      new THREE.Vector3(radius, 0, 0),
      new THREE.Vector3(0, 0, radius),
      new THREE.Vector3(-radius, 0, 0),
      new THREE.Vector3(0, 0, -radius),
    ],
    closed: true,
    width: 14,
  };
}

/** Build geometry cache for fast arc-length queries and projections. */
export function buildTrackGeometry(track?: TrackData | null): TrackGeometry {
  const validWaypoints =
    track?.waypoints && track.waypoints.length >= 2
      ? track.waypoints
      : createDefaultTrack().waypoints;
  const n = validWaypoints.length;
  const closed = track?.closed !== false;
  const segCount = closed ? n : n - 1;
  const segmentLengths: number[] = new Array(segCount);
  const cumulativeDistances: number[] = new Array(segCount);

  let totalLength = 0;
  for (let i = 0; i < segCount; i++) {
    cumulativeDistances[i] = totalLength;
    const nextIdx = (i + 1) % n;
    const p0 = validWaypoints[i];
    const p1 = validWaypoints[nextIdx];
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const len = Math.hypot(dx, dz);
    segmentLengths[i] = Math.max(len, 1e-4);
    totalLength += segmentLengths[i];
  }

  return {
    waypoints: validWaypoints,
    totalLength: Math.max(totalLength, 1),
    segmentLengths,
    cumulativeDistances,
    closed,
    width: track?.width || 14,
  };
}

/** Sample track pose at an arc-length distance with optional lateral lane offset. */
export function sampleTrackAtDistance(
  geom: TrackGeometry,
  distance: number,
  laneOffset: number = 0,
): { position: THREE.Vector3; tangent: THREE.Vector3; normal: THREE.Vector3; waypointIndex: number } {
  const L = geom.totalLength;
  let s = distance % L;
  if (s < 0) s += L;

  const cum = geom.cumulativeDistances;
  let low = 0;
  let high = cum.length - 1;
  let segIdx = 0;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (cum[mid] <= s) {
      segIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const segLen = geom.segmentLengths[segIdx];
  const u = Math.min(Math.max((s - cum[segIdx]) / segLen, 0), 1);
  const n = geom.waypoints.length;
  const nextIdx = (segIdx + 1) % n;

  const p0 = geom.waypoints[segIdx];
  const p1 = geom.waypoints[nextIdx];

  const cx = p0.x + (p1.x - p0.x) * u;
  const cy = p0.y + (p1.y - p0.y) * u;
  const cz = p0.z + (p1.z - p0.z) * u;

  const dx = (p1.x - p0.x) / segLen;
  const dz = (p1.z - p0.z) / segLen;
  const tangent = new THREE.Vector3(dx, 0, dz);
  const normal = new THREE.Vector3(dz, 0, -dx);

  const px = cx + normal.x * laneOffset;
  const pz = cz + normal.z * laneOffset;

  return {
    position: new THREE.Vector3(px, cy, pz),
    tangent,
    normal,
    waypointIndex: nextIdx,
  };
}

/** Find closest arc-length distance on the track for an arbitrary point. */
export function findClosestTrackDistance(
  geom: TrackGeometry,
  pos: THREE.Vector3,
  nearIndex: number = -1,
): { distance: number; segmentIndex: number; lateralError: number } {
  let bestDistSq = Infinity;
  let bestS = 0;
  let bestSeg = 0;

  const n = geom.waypoints.length;
  const segCount = geom.segmentLengths.length;

  const indicesToCheck: number[] = [];
  if (nearIndex >= 0 && nearIndex < segCount) {
    for (let offset = -4; offset <= 4; offset++) {
      indicesToCheck.push(((nearIndex + offset) % segCount + segCount) % segCount);
    }
  } else {
    for (let i = 0; i < segCount; i++) {
      indicesToCheck.push(i);
    }
  }

  for (const i of indicesToCheck) {
    const nextIdx = (i + 1) % n;
    const p0 = geom.waypoints[i];
    const p1 = geom.waypoints[nextIdx];

    const vx = p1.x - p0.x;
    const vz = p1.z - p0.z;
    const segLen = geom.segmentLengths[i];
    const wx = pos.x - p0.x;
    const wz = pos.z - p0.z;

    const proj = (wx * vx + wz * vz) / (segLen * segLen);
    const u = Math.min(Math.max(proj, 0), 1);

    const qx = p0.x + vx * u;
    const qz = p0.z + vz * u;

    const dx = pos.x - qx;
    const dz = pos.z - qz;
    const distSq = dx * dx + dz * dz;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestS = geom.cumulativeDistances[i] + u * segLen;
      bestSeg = i;
    }
  }

  return {
    distance: bestS,
    segmentIndex: bestSeg,
    lateralError: Math.sqrt(bestDistSq),
  };
}

/** Create visual 3D mesh for an AI rival with neon paint and accents. */
export function createRivalMesh(color: number, id: string): THREE.Group {
  const group = new THREE.Group();
  group.name = `ai-car-${id}`;

  // Chassis / Main body
  const bodyGeo = new THREE.BoxGeometry(1.8, 0.5, 3.8);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x111118,
    metalness: 0.8,
    roughness: 0.2,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.4;
  group.add(bodyMesh);

  // Cabin / Roof
  const cabinGeo = new THREE.BoxGeometry(1.4, 0.4, 1.8);
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x08080c,
    metalness: 0.9,
    roughness: 0.1,
  });
  const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
  cabinMesh.position.set(0, 0.75, -0.2);
  group.add(cabinMesh);

  // Neon accent material matching rival identity
  const neonMat = new THREE.MeshBasicMaterial({
    color: color,
  });

  // Racing stripe on hood and roof
  const stripeGeo = new THREE.BoxGeometry(0.3, 0.05, 3.6);
  const stripeMesh = new THREE.Mesh(stripeGeo, neonMat);
  stripeMesh.position.set(0, 0.66, 0);
  group.add(stripeMesh);

  // Neon side skirts / underglow
  const skirtGeo = new THREE.BoxGeometry(0.08, 0.08, 3.4);
  const leftSkirt = new THREE.Mesh(skirtGeo, neonMat);
  leftSkirt.position.set(-0.92, 0.2, 0);
  group.add(leftSkirt);

  const rightSkirt = new THREE.Mesh(skirtGeo, neonMat);
  rightSkirt.position.set(0.92, 0.2, 0);
  group.add(rightSkirt);

  // Headlights & Taillights
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });

  const headlightGeo = new THREE.BoxGeometry(0.3, 0.1, 0.05);
  const leftHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
  leftHeadlight.position.set(-0.6, 0.45, 1.9);
  group.add(leftHeadlight);

  const rightHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
  rightHeadlight.position.set(0.6, 0.45, 1.9);
  group.add(rightHeadlight);

  const taillightGeo = new THREE.BoxGeometry(0.4, 0.08, 0.05);
  const leftTaillight = new THREE.Mesh(taillightGeo, taillightMat);
  leftTaillight.position.set(-0.6, 0.48, -1.9);
  group.add(leftTaillight);

  const rightTaillight = new THREE.Mesh(taillightGeo, taillightMat);
  rightTaillight.position.set(0.6, 0.48, -1.9);
  group.add(rightTaillight);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const wheelPositions = [
    [-0.95, 0.35, 1.2],
    [0.95, 0.35, 1.2],
    [-0.95, 0.35, -1.2],
    [0.95, 0.35, -1.2],
  ];

  for (const [wx, wy, wz] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    group.add(wheel);
  }

  // Rear spoiler with neon wing
  const spoilerWingGeo = new THREE.BoxGeometry(1.6, 0.06, 0.3);
  const spoilerWing = new THREE.Mesh(spoilerWingGeo, neonMat);
  spoilerWing.position.set(0, 0.85, -1.7);
  group.add(spoilerWing);

  return group;
}

/** Recursively dispose all geometries and materials in an Object3D subtree. */
export function disposeThreeHierarchy(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    }
  });
}

/** Internal mutable state for an individual rival. */
interface InternalRivalState {
  profile: RivalProfile;
  startDistanceOffset: number;
  state: CarState;
  aiState: AIState;
  mesh: THREE.Group;
  totalDistanceTraveled: number;
  steeringJitterTimer: number;
}

/**
 * Creates 3 AI rival cars that follow the racing line using pure-pursuit
 * waypoint steering with distinct pace profiles, lateral lane offsets, and
 * bounded rubber-banding.
 *
 * @param trackOrOptions Optional TrackData or configuration options.
 * @param maybeOptions Optional configuration options if first argument was TrackData.
 */
export function createAIOpponents(
  trackOrOptions?: TrackData | AIOpponentsOptions,
  maybeOptions?: AIOpponentsOptions,
): AIHandle {
  let initialTrack: TrackData | undefined;
  let options: AIOpponentsOptions = {};

  if (trackOrOptions && 'waypoints' in trackOrOptions) {
    initialTrack = trackOrOptions as TrackData;
    options = maybeOptions || {};
  } else if (trackOrOptions) {
    options = trackOrOptions as AIOpponentsOptions;
    initialTrack = options.track;
  }

  const seed = typeof options.seed === 'number' ? options.seed : 42;
  const prng = createPrng(seed);

  let currentTrack: TrackData = initialTrack || createDefaultTrack();
  let trackGeom: TrackGeometry = buildTrackGeometry(currentTrack);

  const rubberBanding: RubberBandingConfig = {
    ...DEFAULT_RUBBER_BANDING,
    ...(options.rubberBanding || {}),
  };

  const group = new THREE.Group();
  group.name = 'ai-opponents-group';

  // Merge custom rival profile overrides with defaults
  const rivalProfiles: RivalProfile[] = DEFAULT_RIVAL_PROFILES.map((def, idx) => {
    const custom = options.rivals?.[idx];
    return {
      ...def,
      ...(custom || {}),
    };
  });

  let disposed = false;
  const rivalsInternal: InternalRivalState[] = [];

  // Reset or initialize an individual rival's state
  function setupRival(
    index: number,
    prof: RivalProfile,
    _track: TrackData,
    existing?: InternalRivalState,
  ): InternalRivalState {
    const startDistanceOffset = -(index * 3.5); // Staggered starting grid
    const spawnSample = sampleTrackAtDistance(trackGeom, startDistanceOffset, prof.laneOffset);
    const startHeading = Math.atan2(spawnSample.tangent.x, spawnSample.tangent.z);

    const position = existing ? existing.state.position : new THREE.Vector3();
    position.copy(spawnSample.position);

    const state: CarState = existing
      ? existing.state
      : {
          position,
          heading: startHeading,
          speed: 0,
          driftFactor: 0,
          nitrousCharge: 1.0,
          boostActive: false,
          lap: 1,
          trackProgress: 0,
        };

    state.heading = startHeading;
    state.speed = 0;
    state.driftFactor = 0;
    state.nitrousCharge = 1.0;
    state.boostActive = false;
    state.lap = 1;
    state.trackProgress = 0;

    const aiState: AIState = existing
      ? existing.aiState
      : {
          aggression: prof.aggression,
          targetWaypoint: spawnSample.waypointIndex,
          steeringError: 0,
        };

    aiState.aggression = prof.aggression;
    aiState.targetWaypoint = spawnSample.waypointIndex;
    aiState.steeringError = 0;

    let mesh = existing?.mesh;
    if (!mesh) {
      mesh = createRivalMesh(prof.color, prof.id);
      group.add(mesh);
    }
    mesh.position.copy(position);
    mesh.rotation.y = startHeading;

    return {
      profile: prof,
      startDistanceOffset,
      state,
      aiState,
      mesh,
      totalDistanceTraveled: 0,
      steeringJitterTimer: prng() * 0.5,
    };
  }

  // Initialize rivals at starting grid
  function initializeRivals(track: TrackData): void {
    currentTrack = track;
    trackGeom = buildTrackGeometry(currentTrack);

    for (let i = 0; i < rivalProfiles.length; i++) {
      const prof = rivalProfiles[i];
      const existing = rivalsInternal[i];
      rivalsInternal[i] = setupRival(i, prof, currentTrack, existing);
    }
  }

  initializeRivals(currentTrack);

  // Public rival wrappers matching AIOpponent interface
  const publicRivals: AIOpponent[] = rivalsInternal.map((internal) => ({
    id: internal.profile.id,
    name: internal.profile.name,
    color: internal.profile.color,
    colorHex: internal.profile.colorHex,
    profile: internal.profile,
    state: internal.state,
    aiState: internal.aiState,
    mesh: internal.mesh,
  }));

  /** Update simulation by deltaSeconds. */
  function update(deltaSeconds: number, context?: AIUpdateContext | TrackData): void {
    if (disposed) return;
    if (deltaSeconds <= 0) return;

    // Resolve update context parameters
    let ctxTrack: TrackData | undefined;
    let playerSnapshot: AIPlayerSnapshot | undefined;

    if (context) {
      if ('waypoints' in context) {
        ctxTrack = context as TrackData;
      } else {
        const aiCtx = context as AIUpdateContext;
        ctxTrack = aiCtx.track;
        if (aiCtx.player) {
          if ('state' in aiCtx.player && aiCtx.player.state) {
            playerSnapshot = {
              ...aiCtx.player.state,
              position: aiCtx.player.state.position,
              heading: aiCtx.player.state.heading,
              speed: aiCtx.player.state.speed,
              lap: aiCtx.player.state.lap,
              trackProgress: aiCtx.player.state.trackProgress,
            };
          } else {
            playerSnapshot = aiCtx.player as AIPlayerSnapshot;
          }
        }
      }
    }

    if (ctxTrack && ctxTrack !== currentTrack) {
      currentTrack = ctxTrack;
      trackGeom = buildTrackGeometry(currentTrack);
    }

    const L = trackGeom.totalLength;

    // Calculate player total distance if available
    let playerTotalDistance: number | null = null;
    if (playerSnapshot) {
      if (typeof playerSnapshot.lap === 'number' && typeof playerSnapshot.trackProgress === 'number') {
        playerTotalDistance = (playerSnapshot.lap - 1) * L + playerSnapshot.trackProgress * L;
      } else if (playerSnapshot.position) {
        const closest = findClosestTrackDistance(trackGeom, playerSnapshot.position);
        const playerLap = typeof playerSnapshot.lap === 'number' ? playerSnapshot.lap : 1;
        playerTotalDistance = (playerLap - 1) * L + closest.distance;
      }
    }

    for (let i = 0; i < rivalsInternal.length; i++) {
      const r = rivalsInternal[i];
      const prof = r.profile;

      // 1. Waypoint look-ahead sampling with pure pursuit & lane offset
      const speedLookAhead = Math.max(prof.lookAheadDistance, prof.lookAheadDistance + r.state.speed * 0.35);
      const targetTrackDist = r.startDistanceOffset + r.totalDistanceTraveled + speedLookAhead;
      const targetSample = sampleTrackAtDistance(trackGeom, targetTrackDist, prof.laneOffset);

      r.aiState.targetWaypoint = targetSample.waypointIndex;

      // 2. Pure pursuit steering calculation
      const dx = targetSample.position.x - r.state.position.x;
      const dz = targetSample.position.z - r.state.position.z;
      const targetHeading = Math.atan2(dx, dz);

      // Periodic steering noise / imperfection
      r.steeringJitterTimer += deltaSeconds;
      if (r.steeringJitterTimer >= 0.4) {
        r.steeringJitterTimer = 0;
        const jitterMagnitude = (1.0 - prof.aggression) * 0.04;
        r.aiState.steeringError = (prng() - 0.5) * 2 * jitterMagnitude;
      }

      const desiredHeading = targetHeading + r.aiState.steeringError;
      const headingDiff = normalizeAngle(desiredHeading - r.state.heading);

      // Steering turn rate clamp
      const maxTurnRate = 4.0;
      const turnRate = Math.min(Math.max(headingDiff * prof.steerGain, -maxTurnRate), maxTurnRate);
      r.state.heading = normalizeAngle(r.state.heading + turnRate * deltaSeconds);

      // 3. Cornering speed modulation
      const cornerSharpness = Math.abs(headingDiff) / (Math.PI / 2);
      const cornerSpeedFactor = Math.max(0.70, 1.0 - 0.30 * Math.min(cornerSharpness, 1.0));

      // 4. Bounded rubber-banding
      let rubberBandFactor = 1.0;
      if (rubberBanding.enabled && playerTotalDistance !== null) {
        const gap = playerTotalDistance - r.totalDistanceTraveled;
        if (gap > 0) {
          // Player is ahead: boost rival pace
          const ratio = Math.min(gap / Math.max(rubberBanding.catchUpDistance, 1), 1.0);
          rubberBandFactor = 1.0 + ratio * (rubberBanding.maxSpeedFactor - 1.0);
        } else {
          // Player is behind: ease off rival pace
          const ratio = Math.min(-gap / Math.max(rubberBanding.leadDistance, 1), 1.0);
          rubberBandFactor = 1.0 - ratio * (1.0 - rubberBanding.minSpeedFactor);
        }
        rubberBandFactor = Math.min(
          Math.max(rubberBandFactor, rubberBanding.minSpeedFactor),
          rubberBanding.maxSpeedFactor,
        );
      }

      // 5. Target speed & acceleration integration
      const effectiveTopSpeed = prof.topSpeed * cornerSpeedFactor * rubberBandFactor;
      if (r.state.speed < effectiveTopSpeed) {
        const effectiveAccel = prof.acceleration * rubberBandFactor;
        r.state.speed = Math.min(effectiveTopSpeed, r.state.speed + effectiveAccel * deltaSeconds);
      } else {
        r.state.speed = Math.max(effectiveTopSpeed, r.state.speed - prof.brakeDeceleration * deltaSeconds);
      }
      r.state.speed = Math.max(0, r.state.speed);

      // 6. Integrate position & track progress
      const distanceStep = r.state.speed * deltaSeconds;
      r.state.position.x += Math.sin(r.state.heading) * distanceStep;
      r.state.position.z += Math.cos(r.state.heading) * distanceStep;
      r.state.position.y = targetSample.position.y || 0;

      r.totalDistanceTraveled += distanceStep;

      // Monotonic lap & progress calculation
      const progressFraction = (r.totalDistanceTraveled % L) / L;
      r.state.trackProgress = progressFraction < 0 ? progressFraction + 1 : progressFraction;
      r.state.lap = 1 + Math.floor(r.totalDistanceTraveled / L);

      // Drift factor based on cornering load
      r.state.driftFactor = Math.min(
        1.0,
        Math.max(0.0, (Math.abs(turnRate) / maxTurnRate) * (r.state.speed / prof.topSpeed)),
      );

      // 7. Update 3D mesh transforms
      r.mesh.position.copy(r.state.position);
      r.mesh.rotation.y = r.state.heading;
    }
  }

  /** Reset rivals to starting grid. */
  function reset(track?: TrackData): void {
    if (disposed) return;
    initializeRivals(track || currentTrack);
  }

  /** Dispose all meshes and release resources. */
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      disposeThreeHierarchy(child);
    }
  }

  return {
    get rivals() {
      return publicRivals;
    },
    get group() {
      return group;
    },
    update,
    reset,
    dispose,
  };
}
