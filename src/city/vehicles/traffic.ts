/**
 * Era traffic: canonical lane-slot constants, closed traffic loops with
 * right-hand driving, car-following and intersection control, curbside
 * parking, working lights/wheel spin, and the `EraTransformable` fleet
 * system that swaps era variants smoothly during timeline transitions.
 *
 * Lane geometry contract (pinned for this phase):
 * - road surface at y = 0;
 * - each street is 12 units wide with two driving lanes centered at across-
 *   street coordinates 3 and 9 under right-hand traffic;
 * - a 2-unit curb parking lane hugs each curb (across coordinates [0,2] and
 *   [10,12], centered on 1 and 11);
 * - the streetcar (when the era has one) rides the centerline at 6.
 *
 * The simulation is renderer-free (no THREE.js) so pathing, spacing, braking
 * and era-swap invariants are unit-testable without a GPU. Rendering lives in
 * `models.ts`; composition lives in `index.ts`.
 */

import { ERA_MORPH_STAGES, type EraTransformable } from '../../era/contracts';
import type { EraBlend } from '../../era/timeline';
import {
  VEHICLE_KINDS,
  fleetKindForSlot,
  paintForKind,
  type FleetEra,
  type FleetSlotRole,
  type VehicleKindId,
} from './variants';

/* -------------------------------------------------------------------------- */
/* Canonical lane slot constants                                              */
/* -------------------------------------------------------------------------- */

/** Road surface height: every vehicle rests on y = 0. */
export const ROAD_SURFACE_Y = 0;

/** Total street width in scene units (curb to curb). */
export const STREET_WIDTH = 12;

/** Driving lane centers measured across the street from the low curb (0..12). */
export const LANE_CENTERS = [3, 9] as const;

/** Curb parking lane width in scene units, against each curb. */
export const CURB_PARKING_WIDTH = 2;

/** Centers of the two 2-unit curb parking lanes (across coordinates 1 and 11). */
export const PARKING_LANE_CENTERS = [1, 11] as const;

/** Center-rail streetcar track (across coordinate 6 = street centerline). */
export const RAIL_CENTER_ACROSS = 6;

/** Default half-length of each street from the intersection center. */
export const DEFAULT_STREET_HALF_LENGTH = 48;

/** Conflict box half-size around the crossing (cars reserve it one stream at a time). */
export const INTERSECTION_HALF = 7.5;

/** How many cars cruise each street loop (kept low for a small draw budget). */
export const MOVING_CARS_PER_LOOP = 5;

/** Curbside parked cars per side of each street. */
export const PARKED_PER_SIDE = 3;

/** Along-street offsets of parked cars on each side (must clear the box). */
export const PARKED_ALONG_OFFSETS: readonly number[] = [14, 28, 42];

/** Streets: 'ns' runs along Z (across = X), 'ew' runs along X (across = Z). */
export type StreetAxis = 'ns' | 'ew';

/** Convert an across-street coordinate (0..12) to a world offset from center. */
export function acrossToOffset(across: number): number {
  return across - STREET_WIDTH / 2;
}

/**
 * Driving-lane center for a direction of travel under right-hand traffic.
 *
 * Right vector = up x forward. For the NS street, +Z travel keeps +X on its
 * right (across 9); for the EW street, +X travel keeps -Z on its right
 * (across 3). The opposite directions take the opposite lanes.
 */
export function laneCenterAcross(axis: StreetAxis, forward: 1 | -1): number {
  if (axis === 'ns') return forward === 1 ? 9 : 3;
  return forward === 1 ? 3 : 9;
}

/** World-space lane center offset (X for ns streets, Z for ew streets). */
export function laneCenterWorld(axis: StreetAxis, forward: 1 | -1): number {
  return acrossToOffset(laneCenterAcross(axis, forward));
}

/** Unit travel direction (world X, Z) for a street axis and direction. */
export function travelDirection(axis: StreetAxis, forward: 1 | -1): { x: number; z: number } {
  if (axis === 'ns') return { x: 0, z: forward };
  return { x: forward, z: 0 };
}

/** Unit right vector (up x forward) for a travel direction. */
export function rightVector(dir: { x: number; z: number }): { x: number; z: number } {
  // up = (0,1,0); up x forward = (-forwardZ? no: (0,1,0) x (fx,0,fz) = (fz, 0, -fx) wait:
  // cross((0,1,0),(fx,0,fz)) = (1*fz - 0*0, 0*fx - 0*fz, 0*0 - 1*fx) = (fz, 0, -fx).
  return { x: dir.z, z: -dir.x };
}

/**
 * Verify right-hand placement: the chosen lane center must sit on the driver's
 * right side of the street centerline (dot of lane offset and right vector > 0).
 */
export function isRightHandLane(axis: StreetAxis, forward: 1 | -1): boolean {
  const dir = travelDirection(axis, forward);
  const right = rightVector(dir);
  const laneOffset = laneCenterWorld(axis, forward);
  const acrossWorld = axis === 'ns' ? { x: laneOffset, z: 0 } : { x: 0, z: laneOffset };
  return acrossWorld.x * right.x + acrossWorld.z * right.z > 0;
}

/* -------------------------------------------------------------------------- */
/* Traffic paths                                                              */
/* -------------------------------------------------------------------------- */

/** One sampled point on a path: position plus unit tangent. */
export interface PathSample {
  x: number;
  z: number;
  tangentX: number;
  tangentZ: number;
}

type Interval = readonly [number, number];

/**
 * A polyline path cars follow: either a closed loop (both street driving
 * loops with U-turn bulges at the street ends) or an open shuttle (the
 * streetcar's centerline run, which reverses at its terminals).
 */
export class TrafficPath {
  readonly id: string;
  readonly closed: boolean;
  readonly points: readonly { x: number; z: number }[];
  readonly length: number;
  /** Distance intervals where the path lies inside the intersection box. */
  readonly insideIntervals: readonly Interval[];

  readonly #cumulative: number[];

  constructor(id: string, points: readonly { x: number; z: number }[], closed: boolean) {
    if (points.length < 2) {
      throw new Error(`TrafficPath ${id} needs at least two points`);
    }
    this.id = id;
    this.closed = closed;
    this.points = points;
    this.#cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dz = points[i].z - points[i - 1].z;
      this.#cumulative.push(this.#cumulative[i - 1] + Math.hypot(dx, dz));
    }
    this.length = this.#cumulative[this.#cumulative.length - 1];
    this.insideIntervals = this.#computeInsideIntervals();
  }

  /** Wrap a distance into [0, length) for closed loops; clamp open paths. */
  normalize(distance: number): number {
    if (this.closed) {
      const len = this.length;
      return ((distance % len) + len) % len;
    }
    return Math.min(Math.max(distance, 0), this.length);
  }

  /** Position and tangent at a distance along the path. */
  sample(distance: number): PathSample {
    const d = this.normalize(distance);
    const cum = this.#cumulative;
    // Linear scan is fine: paths hold a few hundred points and are sampled
    // once per car per frame.
    let i = 0;
    while (i < cum.length - 2 && cum[i + 1] < d) i += 1;
    const segStart = cum[i];
    const segEnd = cum[i + 1];
    const p0 = this.points[i];
    const p1 = this.points[i + 1];
    const segLen = Math.max(segEnd - segStart, 1e-9);
    const t = Math.min(Math.max((d - segStart) / segLen, 0), 1);
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const inv = 1 / Math.max(Math.hypot(dx, dz), 1e-9);
    return {
      x: p0.x + dx * t,
      z: p0.z + dz * t,
      tangentX: dx * inv,
      tangentZ: dz * inv,
    };
  }

  /** True when a distance lies within the intersection conflict box. */
  isInside(distance: number): boolean {
    const d = this.normalize(distance);
    for (const [a, b] of this.insideIntervals) {
      if (d >= a && d <= b) return true;
    }
    return false;
  }

  /**
   * Path distance from `distance` to the start of the next intersection
   * interval ahead; Infinity when the path never re-enters the box (open
   * paths after they have already crossed it).
   */
  entryGapAhead(distance: number): number {
    if (this.insideIntervals.length === 0) return Infinity;
    const d = this.normalize(distance);
    for (const [a] of this.insideIntervals) {
      if (a > d + 1e-6) return a - d;
    }
    if (this.closed) {
      const first = this.insideIntervals[0][0];
      return first + (this.length - d);
    }
    return Infinity;
  }

  #computeInsideIntervals(): Interval[] {
    const half = INTERSECTION_HALF;
    const intervals: [number, number][] = [];
    const pts = this.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const segLen = this.#cumulative[i + 1] - this.#cumulative[i];
      const clip = clipSegmentToBox(p0.x, p0.z, p1.x, p1.z, half);
      if (!clip) continue;
      const start = this.#cumulative[i] + clip[0] * segLen;
      const end = this.#cumulative[i] + clip[1] * segLen;
      const last = intervals[intervals.length - 1];
      if (last && start - last[1] < 0.05) {
        last[1] = Math.max(last[1], end);
      } else {
        intervals.push([start, end]);
      }
    }
    return intervals;
  }
}

/** Liang-Barsky clip of a segment against the axis-aligned intersection box. */
function clipSegmentToBox(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  half: number,
): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const q: number[] = [-dx, dx, -dz, dz];
  // Pair each p with q = (bound - origin): left/right then near/far planes.
  const r: number[] = [x0 + half, half - x0, z0 + half, half - z0];
  for (let i = 0; i < 4; i++) {
    const qi = q[i];
    const ri = r[i];
    if (Math.abs(qi) < 1e-12) {
      if (ri < 0) return null; // parallel and outside
      continue;
    }
    const t = ri / qi;
    if (qi < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }
  if (t1 <= t0) return null;
  return [t0, t1];
}

/**
 * Build a closed right-hand traffic loop for one street: the forward-driving
 * lane from end to end, a 180-degree U-turn bulge past the street end, the
 * return lane, and the closing U-turn.
 */
export function buildStreetLoop(axis: StreetAxis, halfLength: number): TrafficPath {
  // In (along, across) space, along = travel-axis coordinate. The forward
  // lane sits on the driver's right: ns +Z travel -> across +3; ew +X travel
  // -> across -3 (see laneCenterAcross).
  const forwardAcross = axis === 'ns' ? laneCenterWorld('ns', 1) : laneCenterWorld('ew', 1);
  const radius = Math.abs(forwardAcross);
  const sign = Math.sign(forwardAcross) || 1;

  const along: number[] = [];
  const across: number[] = [];
  const push = (a: number, c: number): void => {
    along.push(a);
    across.push(c);
  };

  const step = 4;
  // Forward straight: across = forwardAcross, along -H -> +H.
  for (let a = -halfLength; a < halfLength; a += step) push(a, forwardAcross);
  push(halfLength, forwardAcross);
  // U-turn at +H: across = R cos(phi), along = H + radius * sin(phi).
  const arcSegments = 12;
  for (let s = 1; s <= arcSegments; s++) {
    const phi = (Math.PI * s) / arcSegments;
    push(halfLength + radius * Math.sin(phi), sign * radius * Math.cos(phi));
  }
  // Return straight: across = -forwardAcross, along +H -> -H.
  for (let a = halfLength; a > -halfLength; a -= step) push(a, -forwardAcross);
  push(-halfLength, -forwardAcross);
  // U-turn at -H closing back onto the forward lane.
  for (let s = 1; s <= arcSegments; s++) {
    const phi = Math.PI + (Math.PI * s) / arcSegments;
    push(-halfLength + radius * Math.sin(phi), sign * radius * Math.cos(phi));
  }
  // Close: final point equals first.
  push(-halfLength, forwardAcross);

  const points = along.map((a, i) =>
    axis === 'ns' ? { x: across[i], z: a } : { x: a, z: across[i] },
  );
  return new TrafficPath(`${axis}-loop`, points, true);
}

/** Open centerline shuttle for the streetcar (reverses at the terminals). */
export function buildStreetcarPath(halfLength: number): TrafficPath {
  const points: { x: number; z: number }[] = [];
  const railAcross = acrossToOffset(RAIL_CENTER_ACROSS);
  for (let z = -halfLength; z <= halfLength; z += 4) {
    points.push({ x: railAcross, z });
  }
  points.push({ x: railAcross, z: halfLength });
  return new TrafficPath('rail-shuttle', points, false);
}

/* -------------------------------------------------------------------------- */
/* Pure driving control helpers                                               */
/* -------------------------------------------------------------------------- */

/** Bumper clearance that counts as comfortable following (scene units). */
export const FOLLOW_BUFFER = 3.5;
/** Settled bumper clearance behind a leader at matched speed. */
export const FOLLOW_CLEARANCE = 7;
/** Lookahead for intersection reservation checks. */
export const APPROACH_LOOKAHEAD = 18;

/**
 * Center-line stop margin before the intersection entry. Yielding cars hold
 * at least this far back so even the longest body (the streetcar) never
 * protrudes into the conflict box while waiting.
 */
export const APPROACH_STOP_MARGIN = 8;

/**
 * Static tie-break priority for simultaneous intersection contenders
 * (lower wins). The closest contender normally wins; this only decides
 * exact ties so two streets can never commit to the box in the same frame.
 */
const PATH_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  'ns-loop': 0,
  'ew-loop': 1,
  'rail-shuttle': 2,
});

/**
 * Pick a starting phase so no car's initial center position lies inside (or
 * marginally short of) the intersection intervals: the box must start empty
 * with a single holder at most, which the reservation logic then preserves.
 */
function findClearPhase(path: TrafficPath, cars: number, margin: number): number {
  const spacing = path.length / cars;
  for (let p = 0; p < spacing; p += 0.25) {
    let ok = true;
    for (let i = 0; i < cars && ok; i++) {
      const d = path.normalize(p + i * spacing);
      for (const [a, b] of path.insideIntervals) {
        if (d > a - margin && d < b + margin) {
          ok = false;
          break;
        }
      }
    }
    if (ok) return p;
  }
  return 0;
}

/**
 * Car-following control: desired speed given the bumper gap to the leader.
 * Falls to 0 at the hard buffer and settles `FOLLOW_CLEARANCE` behind the
 * leader at matched speed, so queues form without collisions.
 */
export function desiredFollowingSpeed(bumperGap: number, leaderSpeed: number, cruise: number): number {
  if (bumperGap <= FOLLOW_BUFFER) return 0;
  const clearance = bumperGap - FOLLOW_BUFFER;
  const error = clearance - FOLLOW_CLEARANCE;
  const target = leaderSpeed + error * 0.9;
  return Math.min(Math.max(target, 0), cruise);
}

/**
 * Intersection approach control: how fast to enter when another street holds
 * the conflict box. Linearly ramps to 0 at the stop margin before entry.
 */
export function desiredApproachSpeed(entryGap: number, cruise: number): number {
  if (!Number.isFinite(entryGap)) return cruise;
  return Math.min(Math.max((entryGap - APPROACH_STOP_MARGIN) * 0.9, 0), cruise);
}

/** Comfortable acceleration and braking rates (scene units / s^2). */
export const ACCEL_PER_S2 = 6;
export const BRAKE_PER_S2 = 14;

/* -------------------------------------------------------------------------- */
/* Audio hook events                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Documented automobile audio hooks. This module owns no sound playback — it
 * only emits these events for the audio task to consume later.
 */
export type VehicleAudioHookEvent =
  | {
      /** Continuous engine loop trigger. */
      type: 'engine';
      /** Slot the sound belongs to. */
      vehicleId: string;
      /** Era whose engine character to use (EV hum vs V8 rumble). */
      era: FleetEra;
      /** Normalized load/intensity in [0, 1.35]. */
      intensity: number;
      /** Normalized engine speed in [0, 1]. */
      rpm: number;
      /** True while the car is braking (overlap with brake squeal). */
      braking: boolean;
    }
  | {
      /** One-shot horn trigger (automatic on long waits, or interaction). */
      type: 'horn';
      vehicleId: string;
      era: FleetEra;
      /** World position of the horn. */
      position: [number, number, number];
    };

/** Listener for documented automobile audio hook events. */
export type VehicleAudioListener = (event: VehicleAudioHookEvent) => void;

/* -------------------------------------------------------------------------- */
/* Slots and the era transform system                                         */
/* -------------------------------------------------------------------------- */

/** Mutable per-slot simulation + morph state. */
export interface VehicleSlotState {
  readonly slotId: string;
  readonly role: FleetSlotRole;
  /** Path id for moving/rail slots; null for parked slots. */
  readonly pathId: string | null;
  /** Roster index within the era fleet (moving/parked cycling). */
  readonly fleetIndex: number;
  /** Street loop index used to offset the fleet roster mix. */
  readonly loopOffset: number;
  /** Variant index used to pick an era paint. */
  readonly variantIndex: number;

  /** Progress along the path (closed loops wrap; rail shuttles reverse). */
  distance: number;
  /** Rail shuttle direction; loop slots always travel +1 along their loop. */
  direction: 1 | -1;
  /** Current speed (scene units / second). */
  speed: number;
  /** Cruise target from the currently visible kind. */
  cruiseSpeed: number;
  /** Accumulated wheel rotation (radians). */
  wheelSpin: number;
  /** Brake lights on. */
  braking: boolean;
  /** Headlights on (all powered moving vehicles). */
  headlights: boolean;
  /** Taillights on (all powered moving vehicles). */
  taillights: boolean;
  /** Seconds spent stopped at a red intersection reservation. */
  blockedSeconds: number;
  /** Whether the horn already fired for the current wait. */
  hornFired: boolean;
  /** Engine audio throttle accumulator. */
  audioTimer: number;

  /** World transform derived from the path (parked slots are fixed). */
  x: number;
  z: number;
  yaw: number;

  /** Currently visible era variant. */
  kindId: VehicleKindId | null;
  /** Swap morph scale in [0, 1]: only one variant is ever non-zero. */
  variantScale: number;
  /** Current paint color (lerped across the swap for continuity). */
  paint: string;
  /** Whether the slot currently presents visible geometry. */
  active: boolean;
}

/** Options for building one traffic fleet. */
export interface TrafficFleetOptions {
  /** Half-length of each street; defaults to 48. */
  streetHalfLength?: number;
  /** Blend at module construction (usually the timeline's current frame). */
  initialBlend?: EraBlend;
}

const STAGE_WINDOW = 1 / ERA_MORPH_STAGES.length;
const DEFAULT_STAGE_OFFSET = ERA_MORPH_STAGES.indexOf('fleet') / ERA_MORPH_STAGES.length;

/** Ease used for the shrink/grow swap halves (matches the era easing feel). */
function easeSwap(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  if (x < 0.5) return 4 * x * x * x;
  const inv = -2 * x + 2;
  return 1 - (inv * inv * inv) / 2;
}

/** Clamp helper local to this module (renderer-free). */
function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Linear hex color lerp used for continuous paint crossfades. */
function lerpHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * The fleet traffic system: owns every vehicle slot (moving loops, curbside
 * parking, rail shuttle), advances them each frame with car-following and
 * intersection reservation, and implements `EraTransformable` (stage
 * `fleet`) so the timeline swaps era variants smoothly mid-motion.
 *
 * Swap semantics: the incoming era's stage-local window is derived from the
 * blend fraction remapped into the fleet stage window. The outgoing variant
 * shrinks to zero in the first half and the incoming variant grows from zero
 * in the second half, so exactly one variant per slot is ever visible — no
 * overlapping variant geometry, no pop, and continuous hand-off across
 * multi-era transitions.
 */
export class TrafficFleetSystem implements EraTransformable {
  readonly stage = 'fleet' as const;

  /** Paths in registration order: ns loop, ew loop, rail shuttle. */
  readonly paths: readonly TrafficPath[];
  /** All slots in stable order: moving loops, parked curbs, rail. */
  readonly slots: readonly VehicleSlotState[];

  readonly #pathById = new Map<string, TrafficPath>();
  readonly #audioListeners = new Set<VehicleAudioListener>();

  #eraFrom: FleetEra = 1945;
  #eraTo: FleetEra = 1945;
  #swapT = 0;

  constructor(options: TrafficFleetOptions = {}) {
    const half = options.streetHalfLength ?? DEFAULT_STREET_HALF_LENGTH;
    const nsLoop = buildStreetLoop('ns', half);
    const ewLoop = buildStreetLoop('ew', half);
    const railPath = buildStreetcarPath(half);
    this.paths = [nsLoop, ewLoop, railPath];
    for (const path of this.paths) this.#pathById.set(path.id, path);

    const slots: VehicleSlotState[] = [];

    // Moving loops: five cars per street, staggered so spacing is believable
    // from frame one and no car starts inside the intersection box. The ew
    // loop offsets its roster so the two streets carry different mixes.
    const loops: Array<{ path: TrafficPath; axis: StreetAxis; offset: number; phase: number }> = [
      { path: nsLoop, axis: 'ns', offset: 0, phase: findClearPhase(nsLoop, MOVING_CARS_PER_LOOP, 2) },
      { path: ewLoop, axis: 'ew', offset: 2, phase: findClearPhase(ewLoop, MOVING_CARS_PER_LOOP, 2) },
    ];
    for (const loop of loops) {
      for (let i = 0; i < MOVING_CARS_PER_LOOP; i++) {
        const sample = loop.path.sample((i * loop.path.length) / MOVING_CARS_PER_LOOP + loop.phase);
        const yaw = Math.atan2(sample.tangentX, sample.tangentZ);
        const slot: VehicleSlotState = {
          slotId: `${loop.axis}-move-${i}`,
          role: 'moving',
          pathId: loop.path.id,
          fleetIndex: i,
          loopOffset: loop.offset,
          variantIndex: i + (loop.axis === 'ns' ? 0 : 5),
          distance: loop.path.normalize((i * loop.path.length) / MOVING_CARS_PER_LOOP + loop.phase),
          direction: 1,
          speed: 0,
          cruiseSpeed: 0,
          wheelSpin: 0,
          braking: false,
          headlights: true,
          taillights: true,
          blockedSeconds: 0,
          hornFired: false,
          audioTimer: (i * 0.07) % 0.25,
          x: sample.x,
          z: sample.z,
          yaw,
          kindId: null,
          variantScale: 1,
          paint: '#888888',
          active: true,
        };
        slots.push(slot);
      }
    }

    // Curbside parked cars: both curbs of both streets, facing the adjacent
    // lane's direction of travel (right-hand convention), clear of the box.
    let parkedIndex = 0;
    for (const axis of ['ns', 'ew'] as const) {
      for (const side of [1, -1] as const) {
        const across = RAIL_CENTER_ACROSS + side * 5; // 1 or 11 -> offset +-5
        // Parked cars face the direction of the adjacent driving lane.
        const laneForward: 1 | -1 = axis === 'ns' ? side : side === 1 ? -1 : 1;
        const dir = travelDirection(axis, laneForward);
        const yaw = Math.atan2(dir.x, dir.z);
        for (let i = 0; i < PARKED_PER_SIDE; i++) {
          const along = side * PARKED_ALONG_OFFSETS[i];
          const x = axis === 'ns' ? acrossToOffset(across) : along;
          const z = axis === 'ns' ? along : acrossToOffset(across);
          slots.push({
            slotId: `${axis}-park-${side > 0 ? 'a' : 'b'}-${i}`,
            role: 'parked',
            pathId: null,
            fleetIndex: parkedIndex,
            loopOffset: axis === 'ns' ? 0 : 1,
            variantIndex: parkedIndex,
            distance: 0,
            direction: 1,
            speed: 0,
            cruiseSpeed: 0,
            wheelSpin: 0,
            braking: false,
            headlights: false,
            taillights: false,
            blockedSeconds: 0,
            hornFired: false,
            audioTimer: 0,
            x,
            z,
            yaw,
            kindId: null,
            variantScale: 1,
            paint: '#888888',
            active: true,
          });
          parkedIndex += 1;
        }
      }
    }

    // Rail streetcar slot on the centerline shuttle, starting at its south
    // terminal (well clear of the intersection).
    const railStart = railPath.sample(0);
    slots.push({
      slotId: 'rail-tram',
      role: 'rail',
      pathId: railPath.id,
      fleetIndex: 0,
      loopOffset: 0,
      variantIndex: 0,
      distance: 0,
      direction: 1,
      speed: 0,
      cruiseSpeed: 0,
      wheelSpin: 0,
      braking: false,
      headlights: true,
      taillights: true,
      blockedSeconds: 0,
      hornFired: false,
      audioTimer: 0,
      x: railStart.x,
      z: railStart.z,
      yaw: Math.atan2(railStart.tangentX, railStart.tangentZ),
      kindId: null,
      variantScale: 1,
      paint: '#888888',
      active: true,
    });

    this.slots = slots;

    const blend = options.initialBlend ?? ({ from: 1945, to: 1965, fraction: 0 } as EraBlend);
    this.applyEraBlend(blend, DEFAULT_STAGE_OFFSET, 0);
  }

  /** Current era whose paint/engine character dominates the fleet. */
  dominantEra(): FleetEra {
    return this.#swapT >= 0.5 && this.#eraFrom !== this.#eraTo ? this.#eraTo : this.#eraFrom;
  }

  /** The blend pair last dispatched to the system. */
  currentBlend(): { from: FleetEra; to: FleetEra; fraction: number } {
    return { from: this.#eraFrom, to: this.#eraTo, fraction: this.#swapT };
  }

  /** Subscribe to documented engine/horn hook events; returns unsubscribe. */
  subscribeAudio(listener: VehicleAudioListener): () => void {
    this.#audioListeners.add(listener);
    return () => {
      this.#audioListeners.delete(listener);
    };
  }

  /** Emit a horn for one slot (or the first active car) — interaction hook. */
  honk(slotId?: string): boolean {
    const slot = slotId
      ? this.slots.find((s) => s.slotId === slotId)
      : this.slots.find((s) => s.active && s.role === 'moving');
    if (!slot || !slot.active) return false;
    this.#emit({
      type: 'horn',
      vehicleId: slot.slotId,
      era: this.dominantEra(),
      position: [slot.x, 0, slot.z],
    });
    return true;
  }

  /**
   * EraTransformable: apply one transition frame. `stageOffset` is the fleet
   * stage's start within the transition (2/6); the blend fraction is remapped
   * into that stage window so the fleet swaps after facades and signage.
   */
  applyEraBlend(blend: EraBlend, stageOffset: number, _stageProgress: number): void {
    this.#eraFrom = blend.from;
    this.#eraTo = blend.to;
    const from = blend.from as FleetEra;
    const to = blend.to as FleetEra;
    let t: number;
    if (from === to) {
      t = 1;
    } else {
      t = clamp((blend.fraction - stageOffset) / STAGE_WINDOW, 0, 1);
    }
    this.#swapT = t;

    for (const slot of this.slots) {
      const kindFrom = fleetKindForSlot(slot.role, slot.fleetIndex, slot.loopOffset, from);
      const kindTo = fleetKindForSlot(slot.role, slot.fleetIndex, slot.loopOffset, to);

      let kindId: VehicleKindId | null;
      let scale: number;
      if (t < 0.5) {
        kindId = kindFrom;
        scale = kindFrom ? 1 - easeSwap(t * 2) : 0;
      } else {
        kindId = kindTo;
        scale = kindTo ? easeSwap((t - 0.5) * 2) : 0;
      }
      if (kindId === null) scale = 0;

      const paintFrom = kindFrom ? paintForKind(kindFrom, slot.variantIndex, from) : null;
      const paintTo = kindTo ? paintForKind(kindTo, slot.variantIndex, to) : null;
      let paint = '#888888';
      if (paintFrom && paintTo) paint = lerpHex(paintFrom, paintTo, t);
      else if (paintFrom) paint = paintFrom;
      else if (paintTo) paint = paintTo;

      slot.kindId = kindId;
      slot.variantScale = scale;
      slot.paint = paint;
      slot.active = kindId !== null && scale > 0;
      slot.cruiseSpeed = kindId && slot.role !== 'parked' ? VEHICLE_KINDS[kindId].speed : 0;
      if (slot.role === 'parked') {
        slot.headlights = false;
        slot.taillights = false;
        slot.braking = false;
      } else {
        slot.headlights = slot.active;
        slot.taillights = slot.active;
      }
      if (!slot.active) {
        slot.speed = 0;
        slot.blockedSeconds = 0;
        slot.hornFired = false;
      }
    }
  }

  /**
   * Advance every slot by `deltaSeconds`: reserve the intersection box,
   * follow leaders with bumper gaps, integrate speed with bounded accel and
   * brake rates, rotate wheels, flip brake lights, and emit audio hooks.
   */
  update(deltaSeconds: number): void {
    const dt = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    if (dt === 0) return;

    // Active slots per path (parked and hidden era variants are excluded).
    const activeByPath = new Map<string, VehicleSlotState[]>();
    for (const slot of this.slots) {
      if (!slot.pathId || !slot.active) continue;
      const list = activeByPath.get(slot.pathId) ?? [];
      list.push(slot);
      activeByPath.set(slot.pathId, list);
    }

    // Intersection reservation state, computed from pre-movement positions:
    // - `insidePaths`: paths with a car already inside the conflict box (they
    //   keep the box until they clear);
    // - `contenderGaps`: per path, the closest entry gap of a car still
    //   approaching. The closest contender across streets wins the box; ties
    //   break by static path priority so two arrivals in the same frame can
    //   never both commit.
    const insidePaths = new Set<string>();
    const contenderGaps = new Map<string, number>();
    for (const [pathId, list] of activeByPath) {
      const path = this.#pathById.get(pathId);
      if (!path) continue;
      let minGap = Infinity;
      for (const slot of list) {
        if (path.isInside(slot.distance)) {
          insidePaths.add(pathId);
        } else {
          const gap = path.entryGapAhead(slot.distance);
          if (gap < minGap) minGap = gap;
        }
      }
      if (minGap < Infinity) contenderGaps.set(pathId, minGap);
    }

    for (const slot of this.slots) {
      if (slot.role === 'parked' || !slot.pathId || !slot.active) continue;
      const path = this.#pathById.get(slot.pathId);
      if (!path) continue;
      const cruise = slot.cruiseSpeed;
      const def = slot.kindId ? VEHICLE_KINDS[slot.kindId] : null;
      const halfLength = def ? def.length / 2 : 2;

      // 1. Leader along this path (nearest active car ahead, honoring the
      //    loop direction and closed-path wraparound).
      let desired = cruise;
      const peers = activeByPath.get(slot.pathId) ?? [];
      let leader: VehicleSlotState | null = null;
      let leaderDelta = Infinity;
      for (const other of peers) {
        if (other === slot) continue;
        let delta = (other.distance - slot.distance) * slot.direction;
        if (path.closed) {
          if (delta < 0) delta += path.length;
          if (delta <= 1e-6) delta += path.length;
        }
        if (delta > 0 && delta < leaderDelta) {
          leaderDelta = delta;
          leader = other;
        }
      }
      if (leader) {
        const leaderDef = leader.kindId ? VEHICLE_KINDS[leader.kindId] : null;
        const leaderHalf = leaderDef ? leaderDef.length / 2 : 2;
        const bumperGap = leaderDelta - halfLength - leaderHalf;
        desired = Math.min(desired, desiredFollowingSpeed(bumperGap, leader.speed, cruise));
      }

      // 2. Intersection reservation: yield to any other street inside the box
      //    or closer to its entry line (static priority breaks exact ties),
      //    ramping to a stop before the entry line — brake lights come on.
      const myInside = path.isInside(slot.distance);
      const myGap = path.entryGapAhead(slot.distance);
      let blocked = false;
      if (!myInside && myGap <= APPROACH_LOOKAHEAD) {
        for (const holder of insidePaths) {
          if (holder !== slot.pathId) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          const myPriority = PATH_PRIORITY[slot.pathId] ?? 0;
          for (const [otherPath, gap] of contenderGaps) {
            if (otherPath === slot.pathId) continue;
            const otherPriority = PATH_PRIORITY[otherPath] ?? 0;
            const closer = gap < myGap - 1e-6;
            const tie = Math.abs(gap - myGap) <= 1e-6 && otherPriority < myPriority;
            if (closer || tie) {
              blocked = true;
              break;
            }
          }
        }
      }

      if (blocked && myGap <= APPROACH_LOOKAHEAD) {
        desired = Math.min(desired, desiredApproachSpeed(myGap, cruise));
        if (slot.speed < 0.5 && myGap <= APPROACH_STOP_MARGIN + 1) {
          slot.blockedSeconds += dt;
          if (slot.blockedSeconds > 1.5 && !slot.hornFired) {
            slot.hornFired = true;
            this.#emit({
              type: 'horn',
              vehicleId: slot.slotId,
              era: this.dominantEra(),
              position: [slot.x, 0, slot.z],
            });
          }
        }
      } else {
        slot.blockedSeconds = 0;
        slot.hornFired = false;
      }

      // 3. Bounded integration: brake hard toward the target, accelerate
      //    gently up to it. Brake lights track deceleration or a held stop.
      const wasSpeed = slot.speed;
      if (desired < slot.speed) {
        slot.speed = Math.max(desired, slot.speed - BRAKE_PER_S2 * dt);
        slot.braking = true;
      } else {
        slot.speed = Math.min(desired, slot.speed + ACCEL_PER_S2 * dt);
        slot.braking = slot.speed < 0.01 && desired < 0.01;
      }
      if (slot.speed > wasSpeed + 1e-6) slot.braking = false;

      // 4. Advance along the path; the rail shuttle reverses at its terminals.
      let next = slot.distance + slot.direction * slot.speed * dt;
      if (path.closed) {
        next = path.normalize(next);
      } else {
        if (next >= path.length) {
          next = path.length;
          slot.direction = -1;
        } else if (next <= 0) {
          next = 0;
          slot.direction = 1;
        }
      }
      slot.distance = next;

      // 5. Wheel rotation from distance travelled over the wheel radius.
      const radius = def ? def.wheelRadius : 0.33;
      slot.wheelSpin += (slot.speed * dt) / Math.max(radius, 0.05);

      // 6. Sample the transform.
      const sample = path.sample(slot.distance);
      slot.x = sample.x;
      slot.z = sample.z;
      const headingSign = path.closed ? 1 : slot.direction;
      slot.yaw = Math.atan2(sample.tangentX * headingSign, sample.tangentZ * headingSign);

      // 7. Engine audio hook, throttled per slot.
      slot.audioTimer += dt;
      if (slot.speed > 0.2 && slot.audioTimer >= 0.25) {
        slot.audioTimer = 0;
        const rpm = clamp(slot.speed / Math.max(cruise, 1), 0, 1);
        this.#emit({
          type: 'engine',
          vehicleId: slot.slotId,
          era: this.dominantEra(),
          intensity: 0.3 + 0.7 * rpm + (slot.braking ? 0.1 : 0),
          rpm,
          braking: slot.braking,
        });
      } else if (slot.speed <= 0.2) {
        slot.audioTimer = Math.min(slot.audioTimer, 0.24);
      }
    }
  }

  #emit(event: VehicleAudioHookEvent): void {
    for (const listener of this.#audioListeners) listener(event);
  }
}
