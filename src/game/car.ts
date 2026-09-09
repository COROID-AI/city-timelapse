import * as THREE from 'three';
import type { InputState, CarState, CarHandle, TrackData } from './contracts';

/** Physics and gameplay tuning configuration for the player car. */
export interface CarConfig {
  /** Forward acceleration in m/s^2. */
  acceleration: number;
  /** Braking deceleration in m/s^2. */
  braking: number;
  /** Reverse acceleration in m/s^2. */
  reverseAcceleration: number;
  /** Base top forward speed in m/s. */
  maxSpeed: number;
  /** Top reverse speed in m/s. */
  maxReverseSpeed: number;
  /** Coasting drag / rolling resistance deceleration in m/s^2. */
  drag: number;
  /** Base steering rate in radians per second. */
  steeringRate: number;
  /** Speed sensitivity factor that dampens steering at high speeds. */
  steerSpeedDecay: number;
  /** Minimum speed threshold (m/s) below which steering responsiveness scales down. */
  minSteerSpeed: number;
  /** Normal lateral grip / recovery rate factor (1/s). */
  grip: number;
  /** Reduced lateral grip factor during drift to sustain the slide (1/s). */
  driftGrip: number;
  /** Lateral slip ratio threshold (0..1) to register a drift. */
  driftThreshold: number;
  /** Nitrous charge accumulation rate per second at full drift. */
  nitrousGainRate: number;
  /** Nitrous charge consumption rate per second while boosting. */
  nitrousConsumeRate: number;
  /** Speed multiplier applied during nitrous boost. */
  boostMultiplier: number;
  /** Maximum forward speed in m/s while boost is active. */
  boostMaxSpeed: number;
  /** Forward acceleration in m/s^2 while boost is active. */
  boostAcceleration: number;
}

/** Single exported configuration object containing physics tuning defaults. */
export const DEFAULT_CAR_CONFIG: Readonly<CarConfig> = Object.freeze({
  acceleration: 28.0,
  braking: 45.0,
  reverseAcceleration: 14.0,
  maxSpeed: 52.0, // ~187 km/h
  maxReverseSpeed: 14.0, // ~50 km/h
  drag: 3.5,
  steeringRate: 2.8,
  steerSpeedDecay: 0.010,
  minSteerSpeed: 1.0,
  grip: 7.0,
  driftGrip: 2.5,
  driftThreshold: 0.20,
  nitrousGainRate: 0.35,
  nitrousConsumeRate: 0.40,
  boostMultiplier: 1.45,
  boostMaxSpeed: 75.0, // ~270 km/h
  boostAcceleration: 48.0,
});

/** Configuration alias for convenience. */
export const CAR_PHYSICS_CONFIG = DEFAULT_CAR_CONFIG;

/** Optional initialization settings when creating a player car. */
export interface PlayerCarOptions {
  /** Initial world pose. */
  initialPose?: {
    position?: THREE.Vector3;
    heading?: number;
  };
  /** Associated track geometry for track progress and lap calculations. */
  track?: TrackData;
  /** Physics configuration overrides. */
  config?: Partial<CarConfig>;
  /** Primary body color in hex (default: cyber dark blue 0x0a1128). */
  bodyColor?: number;
  /** Neon accent / underglow color in hex (default: cyber cyan 0x00f0ff). */
  accentColor?: number;
}

/** Complete handle returned by createPlayerCar(). */
export interface PlayerCarHandle extends CarHandle {
  /** Live car state conforming to CarState contract. */
  state: CarState;
  /** Three.js object representing the car in the 3D scene. */
  mesh: THREE.Object3D;
  /** Mutable physics tuning values used by this car instance. */
  readonly config: CarConfig;
  /**
   * Advances physics simulation and updates CarState and 3D mesh.
   * @param deltaSeconds Fixed time delta in seconds.
   * @param input Latest InputState snapshot.
   * @param track Optional track data override for progress calculation.
   */
  update: (deltaSeconds: number, input: InputState, track?: TrackData) => CarState;
  /** Resets car state, position, velocity, and drift/boost counters. */
  reset: (pose?: { position?: THREE.Vector3; heading?: number }) => void;
  /** Frees visual resources and geometry allocations. */
  dispose: () => void;
}

/** Precomputed track polyline metadata for O(N) or fast projection. */
interface TrackGeometryCache {
  waypoints: THREE.Vector3[];
  cumulativeDistances: number[];
  segmentLengths: number[];
  totalLength: number;
  closed: boolean;
}

/** Builds distance cache for track progress calculations. */
function buildTrackCache(track: TrackData): TrackGeometryCache | null {
  const pts = track.waypoints;
  if (!pts || pts.length < 2) return null;

  const count = pts.length;
  const closed = track.closed !== false;
  const numSegments = closed ? count : count - 1;
  const cumulativeDistances: number[] = [0];
  const segmentLengths: number[] = [];

  let accumulated = 0;
  for (let i = 0; i < numSegments; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % count];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    segmentLengths.push(len);
    accumulated += len;
    cumulativeDistances.push(accumulated);
  }

  return {
    waypoints: pts,
    cumulativeDistances,
    segmentLengths,
    totalLength: accumulated,
    closed,
  };
}

/** Projects car position onto track waypoints to determine progress in [0, 1). */
function computeTrackProgress(
  position: THREE.Vector3,
  cache: TrackGeometryCache,
): number {
  if (cache.totalLength <= 0) return 0;

  const pts = cache.waypoints;
  const numSegments = cache.segmentLengths.length;
  const px = position.x;
  const pz = position.z;

  let minDistanceSq = Infinity;
  let bestDistanceAlongTrack = 0;

  for (let i = 0; i < numSegments; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const segLen = cache.segmentLengths[i];
    if (segLen <= 0.0001) continue;

    const segDx = b.x - a.x;
    const segDz = b.z - a.z;

    const pDx = px - a.x;
    const pDz = pz - a.z;

    // Projection factor t along segment [0, 1]
    const dot = pDx * segDx + pDz * segDz;
    const t = Math.max(0, Math.min(1, dot / (segLen * segLen)));

    // Nearest point on segment
    const nearestX = a.x + t * segDx;
    const nearestZ = a.z + t * segDz;

    const distSq = (px - nearestX) * (px - nearestX) + (pz - nearestZ) * (pz - nearestZ);
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      bestDistanceAlongTrack = cache.cumulativeDistances[i] + t * segLen;
    }
  }

  let progress = bestDistanceAlongTrack / cache.totalLength;
  if (progress >= 1.0) {
    progress = progress % 1.0;
  }
  if (progress < 0) {
    progress = (progress % 1.0) + 1.0;
  }
  return Math.min(0.999999, Math.max(0, progress));
}

/**
 * Creates the low-poly 3D visual mesh for the player car with glowing head/taillights.
 */
function createCarMesh(bodyColor = 0x0a1128, accentColor = 0x00f0ff): THREE.Group {
  const root = new THREE.Group();
  root.name = 'player-car';

  // 1. Lower chassis / body
  const bodyGeo = new THREE.BoxGeometry(1.8, 0.45, 4.2);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.25,
    metalness: 0.85,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.35;
  bodyMesh.name = 'car-body';
  root.add(bodyMesh);

  // 2. Cockpit / cabin roof
  const cabinGeo = new THREE.BoxGeometry(1.3, 0.4, 2.0);
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x080b14,
    roughness: 0.1,
    metalness: 0.9,
  });
  const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
  cabinMesh.position.set(0, 0.7, -0.2);
  cabinMesh.name = 'car-cabin';
  root.add(cabinMesh);

  // 3. Rear spoiler wing
  const wingGeo = new THREE.BoxGeometry(1.7, 0.06, 0.35);
  const wingMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.3,
    metalness: 0.7,
  });
  const wingMesh = new THREE.Mesh(wingGeo, wingMat);
  wingMesh.position.set(0, 0.75, -1.8);
  wingMesh.name = 'car-spoiler';
  root.add(wingMesh);

  // Spoiler mounts
  const mountGeo = new THREE.BoxGeometry(0.08, 0.25, 0.08);
  const mountMat = new THREE.MeshStandardMaterial({ color: 0x111118 });
  const mountL = new THREE.Mesh(mountGeo, mountMat);
  mountL.position.set(-0.6, 0.6, -1.8);
  const mountR = new THREE.Mesh(mountGeo, mountMat);
  mountR.position.set(0.6, 0.6, -1.8);
  root.add(mountL, mountR);

  // 4. Low-poly wheels
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x181820,
    roughness: 0.8,
    metalness: 0.2,
  });
  const wheelPositions: [number, number, number][] = [
    [-0.95, 0.35, 1.3],
    [0.95, 0.35, 1.3],
    [-0.95, 0.35, -1.3],
    [0.95, 0.35, -1.3],
  ];
  wheelPositions.forEach((pos, idx) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(...pos);
    wheel.name = `car-wheel-${idx}`;
    root.add(wheel);
  });

  // 5. Glowing Headlights (Neon cyan glow facing forward along +Z)
  const headlightGeo = new THREE.BoxGeometry(0.35, 0.12, 0.05);
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const headlightL = new THREE.Mesh(headlightGeo, headlightMat);
  headlightL.position.set(-0.6, 0.4, 2.11);
  headlightL.name = 'headlight-left';
  const headlightR = new THREE.Mesh(headlightGeo, headlightMat);
  headlightR.position.set(0.6, 0.4, 2.11);
  headlightR.name = 'headlight-right';
  root.add(headlightL, headlightR);

  // 6. Glowing Taillights (Neon hot pink glow facing rear along -Z)
  const taillightGeo = new THREE.BoxGeometry(0.4, 0.1, 0.05);
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
  const taillightL = new THREE.Mesh(taillightGeo, taillightMat);
  taillightL.position.set(-0.6, 0.45, -2.11);
  taillightL.name = 'taillight-left';
  const taillightR = new THREE.Mesh(taillightGeo, taillightMat);
  taillightR.position.set(0.6, 0.45, -2.11);
  taillightR.name = 'taillight-right';
  root.add(taillightL, taillightR);

  // 7. Neon Underglow accent
  const underglowGeo = new THREE.BoxGeometry(1.6, 0.04, 3.6);
  const underglowMat = new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.8,
  });
  const underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
  underglowMesh.position.set(0, 0.1, 0);
  underglowMesh.name = 'car-underglow';
  root.add(underglowMesh);

  // 8. Exhaust Anchors (Used by downstream effects pipeline for flame particles)
  const exhaustL = new THREE.Object3D();
  exhaustL.position.set(-0.4, 0.25, -2.15);
  exhaustL.name = 'exhaust-left';
  const exhaustR = new THREE.Object3D();
  exhaustR.position.set(0.4, 0.25, -2.15);
  exhaustR.name = 'exhaust-right';
  root.add(exhaustL, exhaustR);

  return root;
}

/** Recursively disposes all geometries and materials attached to an Object3D. */
function disposeThreeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat?.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
    }
  });
}

/**
 * Creates an arcade player car driven by arrow-key input, supporting slip-based
 * drifting that charges nitrous, and a speed-surging nitrous boost.
 *
 * @param options Initial pose, track data, visual colors, and physics tuning overrides.
 */
export function createPlayerCar(options: PlayerCarOptions = {}): PlayerCarHandle {
  const config: CarConfig = {
    ...DEFAULT_CAR_CONFIG,
    ...options.config,
  };

  const initialPos = options.initialPose?.position
    ? options.initialPose.position.clone()
    : options.track?.startLine?.position
      ? options.track.startLine.position.clone()
      : new THREE.Vector3(0, 0, 0);

  const initialHeading =
    options.initialPose?.heading ??
    options.track?.startLine?.heading ??
    0;

  const state: CarState = {
    position: initialPos.clone(),
    heading: initialHeading,
    speed: 0,
    driftFactor: 0,
    nitrousCharge: 0,
    boostActive: false,
    lap: 1,
    trackProgress: 0,
  };

  // Internal 2D world velocity vector (vx along X, vz along Z)
  let velocityX = 0;
  let velocityZ = 0;

  let trackCache: TrackGeometryCache | null = options.track
    ? buildTrackCache(options.track)
    : null;
  let lastTrackReference: TrackData | undefined = options.track;

  const mesh = createCarMesh(options.bodyColor, options.accentColor);
  mesh.position.copy(state.position);
  mesh.rotation.y = state.heading;

  let disposed = false;

  const reset = (pose?: { position?: THREE.Vector3; heading?: number }): void => {
    const targetPos = pose?.position ?? initialPos;
    const targetHeading = pose?.heading ?? initialHeading;

    state.position.copy(targetPos);
    state.heading = targetHeading;
    state.speed = 0;
    state.driftFactor = 0;
    state.nitrousCharge = 0;
    state.boostActive = false;
    state.lap = 1;
    state.trackProgress = 0;

    velocityX = 0;
    velocityZ = 0;

    mesh.position.copy(state.position);
    mesh.rotation.y = state.heading;
  };

  const update = (
    deltaSeconds: number,
    input: InputState,
    track?: TrackData,
  ): CarState => {
    if (disposed) return state;

    // Update track cache if a different TrackData was passed
    const activeTrack = track ?? lastTrackReference;
    if (activeTrack !== lastTrackReference) {
      lastTrackReference = activeTrack;
      trackCache = activeTrack ? buildTrackCache(activeTrack) : null;
    }

    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return state;
    }

    // ------------------------------------------------------------------------
    // 1. Nitrous Boost Trigger & State
    // ------------------------------------------------------------------------
    if (input.nitrous && state.nitrousCharge > 0) {
      state.boostActive = true;
      state.nitrousCharge = Math.max(
        0,
        state.nitrousCharge - config.nitrousConsumeRate * deltaSeconds,
      );
    } else {
      state.boostActive = false;
    }

    // ------------------------------------------------------------------------
    // 2. Speed-Sensitive Steering
    // ------------------------------------------------------------------------
    let steerDir = 0;
    if (input.left && !input.right) {
      steerDir = -1; // Steer left (decrease heading)
    } else if (input.right && !input.left) {
      steerDir = 1; // Steer right (increase heading)
    }

    const currentSpeed = state.speed;
    const absSpeed = Math.abs(currentSpeed);

    // Stationary cars cannot rotate in place; steering scales up with speed
    const lowSpeedFactor = Math.min(1.0, absSpeed / config.minSteerSpeed);

    // High-speed steering sensitivity decay for fine control
    const highSpeedSensitivity = 1.0 / (1.0 + absSpeed * config.steerSpeedDecay);

    // In reverse gear, turning direction follows natural kinematics
    const steerSign = currentSpeed >= 0 ? 1 : -1;

    const deltaHeading =
      steerDir *
      config.steeringRate *
      lowSpeedFactor *
      highSpeedSensitivity *
      steerSign *
      deltaSeconds;

    state.heading += deltaHeading;

    // ------------------------------------------------------------------------
    // 3. Velocity Decomposition into Local Forward and Lateral Axes
    // ------------------------------------------------------------------------
    // Forward unit vector in horizontal plane: f = (sin(heading), cos(heading))
    // Right unit vector in horizontal plane:   r = (cos(heading), -sin(heading))
    const sinH = Math.sin(state.heading);
    const cosH = Math.cos(state.heading);

    let vf = velocityX * sinH + velocityZ * cosH;
    let vl = velocityX * cosH - velocityZ * sinH;

    // ------------------------------------------------------------------------
    // 4. Longitudinal Acceleration, Braking, Reversing, and Drag
    // ------------------------------------------------------------------------
    const topForwardSpeed = state.boostActive
      ? config.boostMaxSpeed
      : config.maxSpeed;
    const forwardAcceleration = state.boostActive
      ? config.boostAcceleration
      : config.acceleration;

    if (input.up) {
      if (vf < topForwardSpeed) {
        vf = Math.min(topForwardSpeed, vf + forwardAcceleration * deltaSeconds);
      }
    } else if (input.down) {
      if (vf > 0) {
        // Forward braking deceleration
        vf = Math.max(0, vf - config.braking * deltaSeconds);
      } else {
        // Reverse acceleration
        vf = Math.max(
          -config.maxReverseSpeed,
          vf - config.reverseAcceleration * deltaSeconds,
        );
      }
    } else {
      // Coasting / natural rolling resistance
      if (vf > 0) {
        vf = Math.max(0, vf - config.drag * deltaSeconds);
        // If coming down from nitrous top speed, bleed off excess speed
        if (vf > config.maxSpeed) {
          vf = Math.max(
            config.maxSpeed,
            vf - config.acceleration * 0.75 * deltaSeconds,
          );
        }
      } else if (vf < 0) {
        vf = Math.min(0, vf + config.drag * deltaSeconds);
      }
    }

    // ------------------------------------------------------------------------
    // 5. Lateral Grip, Drift Detection, and Nitrous Accumulation
    // ------------------------------------------------------------------------
    const totalSpeedMagnitude = Math.sqrt(vf * vf + vl * vl);

    // Calculate slip ratio: proportion of total motion that is sideways
    let slipRatio = 0;
    if (totalSpeedMagnitude > 2.0) {
      slipRatio = Math.abs(vl) / totalSpeedMagnitude;
    }

    const isDrifting = slipRatio > config.driftThreshold;

    if (isDrifting) {
      // Calculate normalized drift factor in [0, 1]
      const targetDriftFactor = Math.min(
        1.0,
        (slipRatio - config.driftThreshold) / (1.0 - config.driftThreshold),
      );
      state.driftFactor = targetDriftFactor;

      // When actively steering into turn, drift grip sustains slide;
      // when steering wheel is centered, full grip quickly restores traction
      const effectiveGrip = steerDir !== 0 ? config.driftGrip : config.grip * 1.5;
      vl *= Math.exp(-effectiveGrip * deltaSeconds);
      if (Math.abs(vl) < 0.01) vl = 0;

      // Sustained drifting charges nitrous up to 1.0
      state.nitrousCharge = Math.min(
        1.0,
        state.nitrousCharge +
          config.nitrousGainRate * state.driftFactor * deltaSeconds,
      );
    } else {
      // Grip recovers, clearing drift factor
      state.driftFactor = 0;

      vl *= Math.exp(-config.grip * deltaSeconds);
      if (Math.abs(vl) < 0.01) vl = 0;
    }

    // ------------------------------------------------------------------------
    // 6. Reconstruct World Velocity & Update Position
    // ------------------------------------------------------------------------
    velocityX = vf * sinH + vl * cosH;
    velocityZ = vf * cosH - vl * sinH;

    state.position.x += velocityX * deltaSeconds;
    state.position.z += velocityZ * deltaSeconds;
    state.speed = vf;

    // Synchronize 3D mesh transform
    mesh.position.copy(state.position);
    mesh.rotation.y = state.heading;

    // ------------------------------------------------------------------------
    // 7. Track Progress & Lap Counting along TrackData
    // ------------------------------------------------------------------------
    if (trackCache && trackCache.totalLength > 0) {
      const newProgress = computeTrackProgress(state.position, trackCache);

      if (trackCache.closed) {
        const prevProgress = state.trackProgress;
        // Check for forward crossing of start/finish line
        if (prevProgress > 0.75 && newProgress < 0.25) {
          state.lap += 1;
        } else if (prevProgress < 0.25 && newProgress > 0.75 && state.lap > 1) {
          state.lap -= 1;
        }
      }

      state.trackProgress = newProgress;
    }

    return state;
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    disposeThreeObject(mesh);
  };

  return {
    state,
    mesh,
    get config() {
      return config;
    },
    update,
    reset,
    dispose,
  };
}
