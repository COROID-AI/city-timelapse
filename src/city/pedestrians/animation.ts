/**
 * Crowd path, locomotion, behaviors, and gait sampling for the pedestrians.
 *
 * Walkers travel one closed loop built from the canonical sidewalk constants
 * pinned in this task's contract:
 * - sidewalk top at y = 0.15,
 * - 3-unit sidewalk width,
 * - a walking lane centered 1.5 units in from the curb (both sides),
 * - crossings at the two intersections.
 *
 * The loop is south lane (eastbound) -> east crossing -> north lane
 * (westbound) -> west crossing, so street crossing is part of the natural
 * route and no walker can ever leave the lane band. Interpenetration is
 * prevented by a circular 1D separation pass with pair-aware minimum gaps
 * (base body gap plus both pedestrians' lateral offsets), which also produces
 * natural single-file queues at crosswalks when the sidewalk ahead pauses.
 *
 * Everything here is pure math/state: no Three.js, no DOM, fully unit
 * testable. The module composes the pose joints into instance matrices.
 */

import type { CrowdTraits } from './variants';

// ---------------------------------------------------------------------------
// Canonical lane constants (pinned by the work-order contract)
// ---------------------------------------------------------------------------

/** Hard-pinned contract constants; never overridable. */
export const PINNED_LANE_CONSTANTS = Object.freeze({
  /** Sidewalk surface height. */
  SIDEWALK_TOP_Y: 0.15,
  /** Sidewalk slab width, curb to building line. */
  SIDEWALK_WIDTH: 3,
  /** Walking lane center inset from the curb. */
  LANE_CENTER_INSET: 1.5,
});

export interface CrowdLaneConstants {
  readonly sidewalkTopY: number;
  readonly sidewalkWidth: number;
  readonly laneCenterInset: number;
  /** Distance from the block centerline to each curb (street half-width). */
  readonly curbZ: number;
  /** Absolute walking-lane centerline: curbZ + laneCenterInset. */
  readonly laneZ: number;
  /** X of the two intersections where crossings sit. */
  readonly intersectionX: number;
  /** Half width of a crossing stripe along x. */
  readonly crosswalkHalfWidth: number;
  /** Pedestrian body radius used for gap math, meters. */
  readonly bodyRadius: number;
}

export interface LaneConstantsOptions {
  curbZ?: number;
  intersectionX?: number;
}

/** Resolve lane geometry from the pinned constants plus layout options. */
export function resolveLaneConstants(options: LaneConstantsOptions = {}): CrowdLaneConstants {
  const curbZ = options.curbZ ?? 12;
  return Object.freeze({
    sidewalkTopY: PINNED_LANE_CONSTANTS.SIDEWALK_TOP_Y,
    sidewalkWidth: PINNED_LANE_CONSTANTS.SIDEWALK_WIDTH,
    laneCenterInset: PINNED_LANE_CONSTANTS.LANE_CENTER_INSET,
    curbZ,
    laneZ: curbZ + PINNED_LANE_CONSTANTS.LANE_CENTER_INSET,
    intersectionX: options.intersectionX ?? 36,
    crosswalkHalfWidth: 0.9,
    bodyRadius: 0.3,
  });
}

// ---------------------------------------------------------------------------
// Loop path
// ---------------------------------------------------------------------------

export interface PathSegment {
  readonly kind: 'lane' | 'crossing';
  /** Arc-length u where this segment starts. */
  readonly start: number;
  readonly length: number;
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  /** Unit perpendicular of the travel direction (used for lateral offset). */
  readonly perpX: number;
  readonly perpZ: number;
}

export interface SegmentSample {
  readonly segment: PathSegment;
  readonly index: number;
  readonly localS: number;
}

export interface PathPoint {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  /** Yaw for a figure whose local forward is +x: atan2(-dz, dx). */
  readonly travelYaw: number;
}

export interface CrowdPath {
  readonly constants: CrowdLaneConstants;
  readonly segments: readonly PathSegment[];
  readonly totalLength: number;
  segmentAt(u: number): SegmentSample;
  pointAt(u: number, lateralOffset: number): PathPoint;
}

function wrapU(u: number, total: number): number {
  const t = u % total;
  return t < 0 ? t + total : t;
}

/** Meters over which the lateral offset ramps in/out at segment corners. */
const LATERAL_RAMP = 0.6;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function makeSegment(
  kind: 'lane' | 'crossing',
  start: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): PathSegment {
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz);
  const tx = dx / length;
  const tz = dz / length;
  return {
    kind,
    start,
    length,
    ax,
    az,
    bx,
    bz,
    perpX: -tz,
    perpZ: tx,
  };
}

/**
 * Build the canonical crowd loop: two sidewalks between the two
 * intersections plus the two crossings that connect them.
 */
export function createCrowdPath(constants: CrowdLaneConstants = resolveLaneConstants()): CrowdPath {
  const ix = constants.intersectionX;
  const lz = constants.laneZ;
  const south = makeSegment('lane', 0, -ix, -lz, ix, -lz);
  const east = makeSegment('lane', 0, ix, -lz, ix, lz); // start fixed below
  const eastCross = { ...east, kind: 'crossing' as const, start: south.length };
  const northStart = south.length + eastCross.length;
  const north = makeSegment('lane', northStart, ix, lz, -ix, lz);
  const westStart = northStart + north.length;
  const westCross = { ...makeSegment('lane', 0, -ix, lz, -ix, -lz), kind: 'crossing' as const, start: westStart };
  const segments: PathSegment[] = [south, eastCross, north, westCross];
  const totalLength = westStart + westCross.length;

  const laneTop = constants.sidewalkTopY;

  const pointAt = (u: number, lateralOffset: number): PathPoint => {
    const s = wrapU(u, totalLength);
    let index = 0;
    while (index < segments.length - 1 && s >= segments[index].start + segments[index].length) {
      index += 1;
    }
    const seg = segments[index];
    const local = s - seg.start;
    const t = local / seg.length;
    // The perpendicular direction rotates 90 degrees at each corner, so the
    // lateral offset ramps to zero over LATERAL_RAMP meters at both segment
    // ends. That keeps positions continuous across segment boundaries (no
    // corner teleport) and pulls walkers toward the corner apex, which also
    // widens the minimum spacing exactly where the path bends.
    const ramp = Math.min(1, Math.min(local, seg.length - local) / LATERAL_RAMP);
    const lateral = lateralOffset * ramp;
    const dx = seg.bx - seg.ax;
    const dz = seg.bz - seg.az;
    const x = seg.ax + dx * t + seg.perpX * lateral;
    const z = seg.az + dz * t + seg.perpZ * lateral;
    const travelYaw = Math.atan2(-(dz / seg.length), dx / seg.length);

    // Lane walking stays exactly on the sidewalk top; crossings step down
    // over the curb line onto the roadway and back up at the far sidewalk.
    let y = laneTop;
    if (seg.kind === 'crossing') {
      const drop = clamp01((constants.curbZ - Math.abs(z)) / 0.4);
      y = laneTop - 0.13 * drop;
    }
    return { x, z, y, travelYaw };
  };

  const segmentAt = (u: number): SegmentSample => {
    const s = wrapU(u, totalLength);
    let index = 0;
    while (index < segments.length - 1 && s >= segments[index].start + segments[index].length) {
      index += 1;
    }
    return { segment: segments[index], index, localS: s - segments[index].start };
  };

  return { constants, segments, totalLength, segmentAt, pointAt };
}

// ---------------------------------------------------------------------------
// Walkers
// ---------------------------------------------------------------------------

export type WalkerBehavior = 'walking' | 'idle' | 'chatter' | 'windowShopping' | 'crossing';

export const WALKER_BEHAVIORS: readonly WalkerBehavior[] = Object.freeze([
  'walking',
  'idle',
  'chatter',
  'windowShopping',
  'crossing',
]);

export interface WalkerPose {
  /** Pelvis rise above rest, meters. */
  bob: number;
  /** Lateral pelvis sway, meters. */
  sway: number;
  /** Forward lean, radians. */
  lean: number;
  /** Head yaw relative to the body, radians. */
  headYaw: number;
  /** Head pitch, radians. */
  headPitch: number;
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  /** Extra yaw on top of travel direction (window shopping faces the shops). */
  bodyYawOffset: number;
}

export interface Walker {
  readonly traits: CrowdTraits;
  /** Arc-length position on the closed loop, meters. */
  u: number;
  behavior: WalkerBehavior;
  behaviorTimer: number;
  decisionTimer: number;
  /** Gait phase in radians; advances with distance traveled. */
  phase: number;
  breathPhase: number;
  gesturePhase: number;
  chatTimer: number;
  headTimer: number;
  headTarget: number;
  bodyYawOffset: number;
  bodyYawTarget: number;
  talkYaw: number;
  idleYaw: number;
  /** Smoothed current speed, m/s. */
  currentSpeed: number;
  /** Distance traveled over the simulation, meters (footstep accounting). */
  traveled: number;
  prevFootSin: number;
  lastFootstepAt: number;

  // Per-frame outputs (written by advanceWalkers).
  x: number;
  y: number;
  z: number;
  yaw: number;
  segmentIndex: number;
  segmentKind: 'lane' | 'crossing';
  pose: WalkerPose;
  /** Set only on the frame a footstep should be emitted. */
  footfall: 'left' | 'right' | null;
  /** Set only on the frame a chatter burst should be emitted. */
  chatterCue: boolean;
}

/** Emitted by the advance pass; the module wraps these into documented hooks. */
export type CrowdAudioCue = (
  walker: Walker,
  kind: 'footstep' | 'chatter',
  foot: 'left' | 'right' | null,
) => void;

/** Minimum body-to-body gap along the path before lateral offsets, meters. */
export const BODY_MIN_GAP = 1.05;

/** Deterministic hash noise, kept local so animation stays dependency-free. */
function hashNoise(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) / 4294967296) * 2 - 1;
}

export interface WalkerRandom {
  next(): number;
  range(min: number, max: number): number;
  rangeInt(min: number, max: number): number;
}

const BOOT_BEHAVIORS: readonly WalkerBehavior[] = [
  'walking',
  'windowShopping',
  'chatter',
  'idle',
  'walking',
];

/**
 * Create walkers stratified around the whole loop (so crossings, lanes, and
 * every lane behavior are populated from the first frame).
 */
export function createWalkers(
  traits: readonly CrowdTraits[],
  path: CrowdPath,
  rng: WalkerRandom,
): Walker[] {
  const n = traits.length;
  const walkers: Walker[] = [];
  const gap = path.totalLength / Math.max(1, n);

  for (let i = 0; i < n; i++) {
    const t = traits[i];
    const u = wrapU(i * gap + rng.range(-0.3, 0.3), path.totalLength);
    const sample = path.segmentAt(u);
    let behavior: WalkerBehavior;
    let behaviorTimer = 0;
    if (sample.segment.kind === 'crossing') {
      behavior = 'crossing';
    } else {
      behavior = BOOT_BEHAVIORS[i % BOOT_BEHAVIORS.length];
      behaviorTimer =
        behavior === 'idle'
          ? rng.range(3, 6)
          : behavior === 'chatter'
            ? rng.range(4, 7)
            : behavior === 'windowShopping'
              ? rng.range(5, 9)
              : 0;
    }
    const starting = behavior !== 'walking' && behavior !== 'crossing';

    const walker: Walker = {
      traits: t,
      u,
      behavior,
      behaviorTimer,
      decisionTimer: rng.range(5, 11),
      phase: rng.range(0, Math.PI * 2),
      breathPhase: rng.range(0, Math.PI * 2),
      gesturePhase: rng.range(0, Math.PI * 2),
      chatTimer: behavior === 'chatter' ? rng.range(0.2, 1) : rng.range(1.5, 3),
      headTimer: rng.range(1.5, 4),
      headTarget: rng.range(-0.3, 0.3),
      bodyYawOffset: 0,
      bodyYawTarget: 0,
      talkYaw: rng.range(-0.7, 0.7),
      idleYaw: rng.range(-0.5, 0.5),
      currentSpeed: starting ? 0 : t.cruiseSpeed,
      traveled: 0,
      prevFootSin: 0,
      lastFootstepAt: -1,
      x: 0,
      y: path.constants.sidewalkTopY,
      z: 0,
      yaw: 0,
      segmentIndex: sample.index,
      segmentKind: sample.segment.kind,
      pose: {
        bob: 0,
        sway: 0,
        lean: t.leanBase,
        headYaw: 0,
        headPitch: 0,
        legL: 0,
        legR: 0,
        armL: 0,
        armR: 0,
        bodyYawOffset: 0,
      },
      footfall: null,
      chatterCue: false,
    };
    walkers.push(walker);
  }
  return walkers;
}

function rollBehavior(w: Walker, rng: WalkerRandom): WalkerBehavior {
  const b = w.traits.behaviors;
  const total = b.walk + b.windowShop + b.chatter + b.idle;
  const r = rng.next() * total;
  if (r < b.walk) return 'walking';
  if (r < b.walk + b.windowShop) return 'windowShopping';
  if (r < b.walk + b.windowShop + b.chatter) return 'chatter';
  return 'idle';
}

function pauseDuration(behavior: WalkerBehavior, rng: WalkerRandom): number {
  switch (behavior) {
    case 'idle':
      return rng.range(3, 7);
    case 'chatter':
      return rng.range(4, 8);
    case 'windowShopping':
      return rng.range(5, 10);
    default:
      return 0;
  }
}

function lerpTo(current: number, target: number, rate: number): number {
  return current + (target - current) * rate;
}

/**
 * Circular 1D separation: enforce a pair-aware minimum gap between
 * neighbors on the closed path (including the wrap pair). Required gap is
 * BODY_MIN_GAP plus both pedestrians' lateral offsets, which bounds the
 * straight-line distance between any two pedestrians at >= BODY_MIN_GAP
 * even where the path bends 90 degrees at a corner.
 */
export function separateWalkers(walkers: Walker[], path: CrowdPath): void {
  const n = walkers.length;
  if (n < 2) return;
  const total = path.totalLength;

  for (let iter = 0; iter < 4; iter++) {
    // Re-sort every iteration: a backward push that crosses the u = 0 seam
    // wraps the walker to the far end of the linear range, and a stale order
    // would then read the seam neighbors as ~one lap apart and slingshot
    // them across the circle. Fresh adjacency each pass keeps seam wraps as
    // the bounded, physically correct small push they are.
    const order = walkers.map((_, i) => i).sort((a, b) => walkers[a].u - walkers[b].u);
    let moved = false;
    for (let k = 0; k < n; k++) {
      const ia = order[k];
      const ib = order[(k + 1) % n];
      const a = walkers[ia];
      const b = walkers[ib];
      const forward =
        k === n - 1 ? b.u + total - a.u : b.u - a.u;
      const needed =
        BODY_MIN_GAP + Math.abs(a.traits.lateralOffset) + Math.abs(b.traits.lateralOffset);
      const deficit = needed - forward;
      if (deficit > 0) {
        // Half each way, capped so no single pair can ever teleport a walker
        // across the loop; remaining deficit resolves on later iterations.
        const push = Math.min(deficit / 2 + 1e-6, 2);
        a.u = wrapU(a.u - push, total);
        b.u = wrapU(b.u + push, total);
        moved = true;
      }
    }
    if (!moved) break;
  }
}

const MIN_FOOTSTEP_INTERVAL = 0.16;

/**
 * Advance every walker: behavior state machine, speed smoothing, gait phase,
 * separation, and pose sampling. Positions are refreshed afterwards.
 * `emit` receives footstep/chatter cues exactly on the frames they fire.
 */
export function advanceWalkers(
  walkers: Walker[],
  path: CrowdPath,
  dt: number,
  clock: number,
  rng: WalkerRandom,
  emit: CrowdAudioCue,
): void {
  const step = Math.max(0, Math.min(dt, 0.1));

  for (const w of walkers) {
    w.footfall = null;
    w.chatterCue = false;

    const sample = path.segmentAt(w.u);
    w.segmentIndex = sample.index;
    w.segmentKind = sample.segment.kind;
    const onCrossing = sample.segment.kind === 'crossing';

    // --- behavior selection -------------------------------------------------
    if (onCrossing) {
      if (w.behavior !== 'crossing') w.behavior = 'crossing';
    } else if (w.behavior === 'crossing') {
      // Just stepped off the crossing: pick a fresh sidewalk behavior.
      const next = rollBehavior(w, rng);
      w.behavior = next;
      w.behaviorTimer = pauseDuration(next, rng);
      w.decisionTimer = rng.range(5, 11);
    } else if (w.behavior === 'walking') {
      w.decisionTimer -= step;
      if (w.decisionTimer <= 0) {
        w.decisionTimer = rng.range(5, 11);
        const next = rollBehavior(w, rng);
        if (next !== 'walking') {
          w.behavior = next;
          w.behaviorTimer = pauseDuration(next, rng);
          if (next === 'chatter') w.chatTimer = rng.range(0.2, 1);
        }
      }
    } else {
      w.behaviorTimer -= step;
      if (w.behaviorTimer <= 0) {
        w.behavior = 'walking';
        w.decisionTimer = rng.range(4, 9);
      }
    }

    // --- target speed -------------------------------------------------------
    let targetSpeed: number;
    if (w.behavior === 'crossing') targetSpeed = w.traits.cruiseSpeed * 1.05;
    else if (w.behavior === 'walking') targetSpeed = w.traits.cruiseSpeed;
    else if (w.behavior === 'windowShopping') targetSpeed = 0.2; // slow browse shuffle
    else targetSpeed = 0;

    const accel = targetSpeed > w.currentSpeed ? 3 : 4.5;
    w.currentSpeed += Math.max(-accel * step, Math.min(accel * step, targetSpeed - w.currentSpeed));
    if (w.currentSpeed < 0.01) w.currentSpeed = 0;

    // --- advance along the loop -------------------------------------------
    const move = w.currentSpeed * step;
    if (move > 0) {
      w.u = wrapU(w.u + move, path.totalLength);
      w.traveled += move;
      w.phase += (move / w.traits.strideLength) * Math.PI * 2;
    }

    // --- footstep cue -------------------------------------------------------
    const sinNow = Math.sin(w.phase);
    const crossedZero =
      (w.prevFootSin < 0 && sinNow >= 0) || (w.prevFootSin >= 0 && sinNow < 0);
    w.prevFootSin = sinNow;
    const audible =
      w.currentSpeed > 0.15 &&
      (w.behavior === 'walking' || w.behavior === 'crossing' || w.behavior === 'windowShopping');
    if (crossedZero && audible && clock - w.lastFootstepAt >= MIN_FOOTSTEP_INTERVAL) {
      w.lastFootstepAt = clock;
      w.footfall = Math.cos(w.phase) >= 0 ? 'left' : 'right';
      emit(w, 'footstep', w.footfall);
    }

    // --- chatter cue --------------------------------------------------------
    if (w.behavior === 'chatter') {
      w.chatTimer -= step;
      if (w.chatTimer <= 0) {
        w.chatTimer = rng.range(1.4, 3.2);
        w.chatterCue = true;
        emit(w, 'chatter', null);
      }
    }

    // --- pose ---------------------------------------------------------------
    samplePose(w, step, clock);
  }

  separateWalkers(walkers, path);

  for (const w of walkers) {
    const p = path.pointAt(w.u, w.traits.lateralOffset);
    w.x = p.x;
    w.y = p.y;
    w.z = p.z;
    w.segmentIndex = path.segmentAt(w.u).index;
    w.segmentKind = path.segmentAt(w.u).segment.kind;
    w.yaw = wrapAngle(p.travelYaw + w.pose.bodyYawOffset);
  }
}

function wrapAngle(a: number): number {
  let t = a;
  while (t > Math.PI) t -= Math.PI * 2;
  while (t < -Math.PI) t += Math.PI * 2;
  return t;
}

/** Compose the per-behavior pose for one walker (called from advance). */
function samplePose(w: Walker, dt: number, clock: number): void {
  const t = w.traits;
  const pose = w.pose;
  w.breathPhase += dt * 1.4;

  if (w.behavior === 'walking' || w.behavior === 'crossing') {
    const s = Math.sin(w.phase);
    const amp = t.strideAmp;
    const arm = t.armAmp;
    pose.legL = amp * s;
    pose.legR = -amp * s;
    // Contralateral arm swing (left arm follows the right leg).
    pose.armL = -arm * s;
    pose.armR = arm * s;
    pose.bob = t.bobAmp * (0.5 - 0.5 * Math.cos(2 * w.phase));
    pose.sway = t.swayAmp * Math.sin(w.phase);
    pose.lean = t.leanBase + 0.02;
    pose.headPitch = 0;

    // Crossing pedestrians scan both ways for traffic.
    if (w.behavior === 'crossing') {
      pose.headYaw = lerpTo(pose.headYaw, 0.45 * Math.sin(clock * 2.1 + t.index), Math.min(1, dt * 4));
      w.bodyYawTarget = 0;
    } else {
      w.headTimer -= dt;
      if (w.headTimer <= 0) {
        w.headTimer = 1.5 + ((hashNoise(t.index * 17 + Math.floor(clock)) + 1) / 2) * 2.5;
        w.headTarget = hashNoise(t.index * 31 + Math.floor(clock * 0.5)) * 0.35;
      }
      pose.headYaw = lerpTo(pose.headYaw, w.headTarget, Math.min(1, dt * 2.5));
      w.bodyYawTarget = 0;
    }
  } else {
    // Standing behaviors: relaxed stance, breathing, micro-motion.
    pose.legL = 0.04;
    pose.legR = -0.04;
    pose.bob = 0.006 * Math.sin(w.breathPhase);
    pose.sway = 0.004 * Math.sin(w.breathPhase * 0.6);
    pose.lean = t.leanBase;
    pose.armL = 0.05 * Math.sin(w.breathPhase);
    pose.armR = -0.05 * Math.sin(w.breathPhase);
    pose.headPitch = 0.05;

    if (w.behavior === 'windowShopping') {
      // Face outward from the street (away from the path's perpendicular
      // toward the curb) and sweep the gaze across the shop windows.
      w.bodyYawTarget = Math.PI / 2;
      pose.headYaw = 0.55 * Math.sin(clock * 1.1 + t.index);
      pose.armL = 0.12 * Math.sin(w.breathPhase);
      pose.armR = -0.12 * Math.sin(w.breathPhase);
    } else if (w.behavior === 'chatter') {
      w.gesturePhase += dt * 2.6;
      w.bodyYawTarget = w.talkYaw;
      pose.armR = -0.5 + 0.28 * Math.sin(w.gesturePhase);
      pose.armL = 0.08 * Math.sin(w.breathPhase);
      pose.headYaw = 0.25 * Math.sin(w.gesturePhase * 0.8);
      pose.bob = 0.004 * Math.sin(w.gesturePhase * 1.3);
    } else {
      w.bodyYawTarget = w.idleYaw;
      w.headTimer -= dt;
      if (w.headTimer <= 0) {
        w.headTimer = 2 + ((hashNoise(t.index * 13 + Math.floor(clock)) + 1) / 2) * 3;
        w.headTarget = hashNoise(t.index * 7 + Math.floor(clock * 0.4)) * 0.5;
      }
      pose.headYaw = lerpTo(pose.headYaw, w.headTarget, Math.min(1, dt * 2));
    }
  }

  const rate = Math.min(1, dt * 4);
  w.bodyYawOffset = lerpTo(w.bodyYawOffset, w.bodyYawTarget, rate);
  pose.bodyYawOffset = w.bodyYawOffset;
}
