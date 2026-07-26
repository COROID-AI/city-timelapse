/**
 * VehicleSystem — era-correct traffic that obeys traffic lights.
 *
 * Spawns era-correct vehicles (built from {@link vehicleModels}) that drive
 * along the shared {@link RoadNetwork} driving lanes, obey the
 * {@link TrafficLightController} (stop at red, resume on green), queue without
 * overlapping, respect one-way direction and a speed limit, and swap their
 * population when the active era changes — with a brief opacity cross-fade
 * driven by the {@link TransitionManager}.
 *
 * Design notes:
 *  - Lanes are derived purely from the consumed RoadNetwork (never redefined).
 *    Each one-way driving lane becomes a directed path; vehicles circulate
 *    along it (wrapping at the block perimeter) so the capped population stays
 *    stable and performant.
 *  - Movement uses a "move as far as safe" car-following model: a vehicle may
 *    advance up to the minimum of (a) its desired speed, (b) a safe following
 *    distance behind the vehicle ahead, and (c) the stop line when the signal
 *    is red/yellow. This guarantees no overlap and correct queueing.
 *  - Era cross-fade: on era change the new era's population is spawned (faded
 *    in) while the old era's population fades out; both drive during the brief
 *    transition, then the old population is removed. Shared per-era materials
 *    make the fade a single opacity change per era (see vehicleModels).
 */
import { Group } from 'three';
import { type ApplyEraFn, type EraKey } from '../eras/eraConfig.js';
import {
  type Intersection,
  type LaneAxis,
  type LaneDirection,
  type RoadNetwork,
  type Vec3,
  edgesOfType,
} from '../world/roadNetwork.js';
import { type TrafficLightController } from '../world/trafficLight.js';
import {
  buildVehicle,
  disposeAllVehicleResources,
  getEraVehicleDescriptors,
  setEraVehicleOpacity,
  type VehicleDescriptor,
} from './vehicleModels.js';

// ---------------------------------------------------------------------------
// Tuning constants (overridable via options)
// ---------------------------------------------------------------------------

/** Default hard cap on concurrent vehicles (both eras during a cross-fade). */
const DEFAULT_MAX_VEHICLES = 16;
/** Default target population per era (the steady-state vehicle count). */
const DEFAULT_TARGET_PER_ERA = 6;
/** Default cruise speed in world units / second. */
const DEFAULT_SPEED_LIMIT = 8;
/** Minimum bumper-to-bumper gap when stopped (queue spacing). */
const DEFAULT_MIN_GAP = 1.6;
/** Gap between the vehicle's front and the stop line when halted at red. */
const DEFAULT_STOP_BUFFER = 1.0;
/** Default RNG seed for deterministic variety. */
const DEFAULT_SEED = 0xc17abc4;

export interface VehicleSystemOptions {
  /** Hard cap on concurrent vehicles. Defaults to {@link DEFAULT_MAX_VEHICLES}. */
  maxVehicles?: number;
  /** Steady-state population per era. Defaults to {@link DEFAULT_TARGET_PER_ERA}. */
  targetPerEra?: number;
  /** Cruise speed (units/sec). Defaults to {@link DEFAULT_SPEED_LIMIT}. */
  speedLimit?: number;
  /** Minimum queue gap. Defaults to {@link DEFAULT_MIN_GAP}. */
  minGap?: number;
  /** Stop-line buffer. Defaults to {@link DEFAULT_STOP_BUFFER}. */
  stopBuffer?: number;
  /** RNG seed for deterministic variety. */
  seed?: number;
}

// ---------------------------------------------------------------------------
// Lane path derivation (consumes RoadNetwork — never redefines lanes)
// ---------------------------------------------------------------------------

/**
 * A directed, traversable path built from one one-way driving lane of the
 * RoadNetwork. Vehicles follow `points` in order; `stopDistance` is the path
 * distance of the intersection entry (where they halt at red).
 */
export interface LanePath {
  /** Stable id (derived from the lane's edges). */
  id: string;
  /** Orientation axis — selects which signal phase this lane obeys. */
  axis: LaneAxis;
  /** Ordered traversable points (travel direction). */
  points: Vec3[];
  /** Length of each segment between consecutive points. */
  segLengths: number[];
  /** Cumulative distance at each point (cum[0] = 0). */
  cum: number[];
  /** Total traversable length. */
  total: number;
  /** Path distance of the intersection entry (stop line). */
  stopDistance: number;
  /** Yaw so the vehicle's +X faces the travel direction. */
  heading: number;
  /** Unit travel direction (for diagnostics / tests). */
  dir: Vec3;
}

/**
 * Build directed lane paths from the driving edges of a {@link RoadNetwork}.
 *
 * Driving edges are chained into linear lanes; each lane's travel order follows
 * its `direction` (`forward` = as stored, `backward` = reversed). The stop line
 * is the first intersection-boundary node encountered in travel order.
 */
export function buildDrivingLanes(
  network: RoadNetwork,
  intersection: Intersection,
): LanePath[] {
  const nodeById = new Map<string, { position: Vec3 }>();
  for (const n of network.nodes) {
    nodeById.set(n.id, { position: n.position });
  }

  const intersectionNodes = new Set(intersection.nodeIds);
  const drivingEdges = edgesOfType(network, 'driving');

  // Outgoing adjacency: fromId -> edges.
  const outgoing = new Map<string, typeof drivingEdges>();
  for (const e of drivingEdges) {
    let list = outgoing.get(e.from);
    if (!list) {
      list = [];
      outgoing.set(e.from, list);
    }
    list.push(e);
  }

  // Heads = 'from' nodes that are no edge's 'to' (chain starts).
  const isTo = new Set<string>();
  for (const e of drivingEdges) {
    isTo.add(e.to);
  }
  const heads: string[] = [];
  for (const e of drivingEdges) {
    if (!isTo.has(e.from)) {
      heads.push(e.from);
    }
  }

  const usedEdges = new Set<string>();
  const lanes: LanePath[] = [];

  for (const head of heads) {
    // Walk the chain from the head.
    const nodeIds: string[] = [head];
    const chainDir: LaneDirection[] = [];
    let cur = head;
    // Guard against pathological cycles.
    for (let step = 0; step < drivingEdges.length + 1; step++) {
      const outs = outgoing.get(cur);
      if (!outs || outs.length === 0) break;
      const edge = outs.find((e) => !usedEdges.has(e.id));
      if (!edge) break;
      usedEdges.add(edge.id);
      nodeIds.push(edge.to);
      chainDir.push(edge.direction);
      cur = edge.to;
    }
    if (nodeIds.length < 2 || chainDir.length === 0) continue;

    // Travel order: 'backward' lanes reverse the stored node order.
    const backward = chainDir[0] === 'backward';
    const ordered = backward ? [...nodeIds].reverse() : nodeIds;
    const axis = drivingEdges.find((e) => e.from === head)?.axis ?? 'east-west';

    const points: Vec3[] = [];
    for (const id of ordered) {
      const node = nodeById.get(id);
      if (node) points.push(node.position);
    }
    if (points.length < 2) continue;

    const segLengths: number[] = [];
    const cum: number[] = [0];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dz = points[i + 1].z - points[i].z;
      const len = Math.hypot(dx, dz);
      segLengths.push(len);
      total += len;
      cum.push(total);
    }
    if (total <= 0) continue;

    // Travel direction unit vector.
    const ddx = points[1].x - points[0].x;
    const ddz = points[1].z - points[0].z;
    const dlen = Math.hypot(ddx, ddz) || 1;
    const dir: Vec3 = { x: ddx / dlen, y: 0, z: ddz / dlen };
    // Yaw so vehicle +X faces (dir.x, dir.z): θ = atan2(-dz, dx).
    const heading = Math.atan2(-dir.z, dir.x);

    // Stop line = first intersection-boundary node in travel order.
    let stopDistance = total; // default: no stop line (shouldn't happen)
    for (let i = 0; i < ordered.length; i++) {
      if (intersectionNodes.has(ordered[i])) {
        stopDistance = cum[i];
        break;
      }
    }

    lanes.push({
      id: ordered.join('->'),
      axis,
      points,
      segLengths,
      cum,
      total,
      stopDistance,
      heading,
      dir,
    });
  }

  return lanes;
}

/** Sample a world position at path distance `s` along a lane (with wrap). */
export function sampleLane(lane: LanePath, s: number): Vec3 {
  const total = lane.total;
  let ds = ((s % total) + total) % total;
  let i = 0;
  while (i < lane.segLengths.length - 1 && ds > lane.cum[i + 1]) i++;
  const segLen = lane.segLengths[i] || 1;
  const local = segLen > 0 ? (ds - lane.cum[i]) / segLen : 0;
  const a = lane.points[i];
  const b = lane.points[i + 1] ?? lane.points[i];
  return { x: a.x + (b.x - a.x) * local, y: 0, z: a.z + (b.z - a.z) * local };
}

// ---------------------------------------------------------------------------
// Vehicle instance
// ---------------------------------------------------------------------------

/** One active vehicle in the simulation. */
interface VehicleInstance {
  /** The Three.js group (built from cached geometry + shared era materials). */
  group: Group;
  /** Era this vehicle belongs to (governs its materials / fade). */
  era: EraKey;
  /** Index into the system's lane list. */
  laneIndex: number;
  /** Distance along the lane path. */
  s: number;
  /** Current speed (units/sec). */
  speed: number;
  /** Vehicle length (used for following-gap math). */
  length: number;
  /** Body color palette index (variety). */
  colorIndex: number;
  /** Archetype descriptor. */
  descriptor: VehicleDescriptor;
}

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32)
// ---------------------------------------------------------------------------

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return function (): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/** Public handle for the vehicle traffic system. */
export interface VehicleSystem {
  /** Root group containing every vehicle — add this to the scene. */
  group: Group;
  /**
   * Era-application callback. Register with
   * `TransitionManager.registerDomain('vehicles', system.applyEra)`. Drives the
   * population cross-fade and opacity on era change.
   */
  applyEra: ApplyEraFn;
  /**
   * Advance the simulation one frame. Call from the render loop with the frame
   * delta in milliseconds. Reads the current signal phases from the controller.
   */
  update: (deltaMs: number) => void;
  /** Current number of active vehicles (across all eras). */
  getVehicleCount: () => number;
  /** The era currently shown as fully settled. */
  getActiveEra: () => EraKey;
  /** The derived lane paths (exposed for tests / diagnostics). */
  getLanes: () => LanePath[];
  /**
   * Per-vehicle diagnostics (era, lane index, path distance, length). Exposed
   * for tests to verify lane-following, queueing, and no-overlap invariants
   * *within a lane* (cross-lane proximity is expected and correct).
   */
  getVehicleStates: () => { era: EraKey; laneIndex: number; s: number; length: number }[];
  /** Release GPU resources held by the system. */
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the vehicle traffic system.
 *
 * @param network      shared RoadNetwork (driving lanes are consumed, not redefined)
 * @param controller   traffic-light controller for the signalized intersection
 * @param initialEra   era to populate on creation
 * @param options      tuning / cap options
 */
export function createVehicleSystem(
  network: RoadNetwork,
  controller: TrafficLightController,
  initialEra: EraKey,
  options: VehicleSystemOptions = {},
): VehicleSystem {
  const maxVehicles = options.maxVehicles ?? DEFAULT_MAX_VEHICLES;
  const targetPerEra = options.targetPerEra ?? DEFAULT_TARGET_PER_ERA;
  const speedLimit = options.speedLimit ?? DEFAULT_SPEED_LIMIT;
  const minGap = options.minGap ?? DEFAULT_MIN_GAP;
  const stopBuffer = options.stopBuffer ?? DEFAULT_STOP_BUFFER;
  const rng = createRng(options.seed ?? DEFAULT_SEED);

  const group = new Group();
  group.name = 'vehicles';

  // Derive lanes from the consumed network.
  const intersection = network.intersections[0];
  const lanes: LanePath[] = intersection
    ? buildDrivingLanes(network, intersection)
    : [];

  const vehicles: VehicleInstance[] = [];

  // Transition / era state.
  let activeEra: EraKey = initialEra;
  let transitioning = false;
  let transitionTo: EraKey = initialEra;

  // ---- spawning -----------------------------------------------------------

  /** Pick a descriptor + color for an era by deterministic index. */
  function pickArchetype(era: EraKey, idx: number): { descriptor: VehicleDescriptor; color: number } {
    const descs = getEraVehicleDescriptors(era);
    const descriptor = descs[idx % descs.length];
    const color = Math.floor(rng() * descriptor.colors.length);
    return { descriptor, color };
  }

  /**
   * Populate `era` with up to `count` vehicles spread across the lanes. Used at
   * init and at the start of an era transition (the incoming population).
   */
  function spawnPopulation(era: EraKey, count: number): void {
    if (lanes.length === 0) return;
    let spawned = 0;
    let safety = 0;
    while (spawned < count && vehicles.length < maxVehicles && safety < count * 4) {
      safety++;
      const laneIndex = spawned % lanes.length;
      const lane = lanes[laneIndex];
      // Space vehicles evenly within their lane.
      const perLane = Math.max(1, Math.ceil(count / lanes.length));
      const along = Math.floor(spawned / lanes.length);
      const s = ((along + 0.5) / perLane) * lane.total;
      const { descriptor, color } = pickArchetype(era, spawned);
      spawnOne(era, laneIndex, s, descriptor, color);
      spawned++;
    }
  }

  /** Create and add one vehicle. */
  function spawnOne(
    era: EraKey,
    laneIndex: number,
    s: number,
    descriptor: VehicleDescriptor,
    colorIndex: number,
  ): VehicleInstance {
    const vg = buildVehicle(descriptor, colorIndex, era);
    const pos = sampleLane(lanes[laneIndex], s);
    vg.position.set(pos.x, 0, pos.z);
    vg.rotation.y = lanes[laneIndex].heading;
    group.add(vg);
    const inst: VehicleInstance = {
      group: vg,
      era,
      laneIndex,
      s,
      speed: 0,
      length: descriptor.length,
      colorIndex,
      descriptor,
    };
    vehicles.push(inst);
    return inst;
  }

  /** Remove every vehicle whose era is not `keep`. */
  function purgeOtherEras(keep: EraKey): void {
    for (let i = vehicles.length - 1; i >= 0; i--) {
      if (vehicles[i].era !== keep) {
        group.remove(vehicles[i].group);
        vehicles.splice(i, 1);
      }
    }
  }

  // ---- per-frame advance --------------------------------------------------

  /** Phase a lane must obey: east-west → primary, north-south → complementary. */
  function phaseForLane(axis: LaneAxis): 'green' | 'yellow' | 'red' {
    return axis === 'north-south'
      ? controller.getComplementaryPhase()
      : controller.getPhase();
  }

  /**
   * Advance every vehicle using a "move as far as safe" car-following model.
   * Vehicles are grouped per lane, ordered by path distance; each may advance
   * up to the minimum of its desired move, the safe following distance behind
   * its leader, and the stop line when the signal is not green.
   */
  function advance(deltaSec: number): void {
    if (lanes.length === 0) return;

    // Bucket vehicles by lane.
    const byLane: VehicleInstance[][] = lanes.map(() => []);
    for (const v of vehicles) {
      byLane[v.laneIndex]?.push(v);
    }

    for (let li = 0; li < lanes.length; li++) {
      const lane = lanes[li];
      const bucket = byLane[li];
      if (bucket.length === 0) continue;

      // Order by path distance.
      bucket.sort((a, b) => a.s - b.s);
      const n = bucket.length;
      const mustStop = phaseForLane(lane.axis) !== 'green';

      for (let k = 0; k < n; k++) {
        const v = bucket[k];
        const leader = bucket[(k + 1) % n];
        // Leader path distance (unwrapped across the seam for the last vehicle).
        const leaderS = k + 1 < n ? leader.s : leader.s + lane.total;

        // Desired forward move this frame.
        const desiredMove = speedLimit * deltaSec;

        // (a) Safe following distance: front of this must stay minGap behind
        //     the back of the leader.
        const maxByLeader =
          leaderS - leader.length / 2 - v.length / 2 - minGap;

        // (b) Stop line: if the signal is not green and the vehicle has not yet
        //     reached the stop point, cap at the stop point.
        let maxByStop = Infinity;
        if (mustStop) {
          const stopPoint = lane.stopDistance - stopBuffer - v.length / 2;
          if (v.s < stopPoint) {
            maxByStop = stopPoint;
          }
        }

        const limit = Math.min(maxByLeader, maxByStop);
        let newS = Math.min(v.s + desiredMove, limit);
        if (newS < v.s) newS = v.s; // never reverse

        v.speed = deltaSec > 0 ? (newS - v.s) / deltaSec : 0;
        // Wrap into [0, total).
        v.s = ((newS % lane.total) + lane.total) % lane.total;

        // Apply transform.
        const pos = sampleLane(lane, v.s);
        v.group.position.set(pos.x, 0, pos.z);
        v.group.rotation.y = lane.heading;
      }
    }
  }

  // ---- era domain ---------------------------------------------------------

  const applyEra: ApplyEraFn = (toKey, t, fromKey) => {
    if (fromKey !== toKey) {
      // Cross-fade in progress.
      if (!transitioning || transitionTo !== toKey) {
        // Start of a new transition (or a re-anchored transition toward a
        // different destination mid-flight): spawn the incoming era's
        // population. It fades in from opacity 0 via setEraVehicleOpacity
        // below.
        transitioning = true;
        transitionTo = toKey;
        spawnPopulation(toKey, targetPerEra);
      }
      setEraVehicleOpacity(fromKey, 1 - t);
      setEraVehicleOpacity(toKey, t);
      return;
    }

    // Settled (fromKey === toKey, t === 1): finalize the destination era.
    transitioning = false;
    activeEra = toKey;
    purgeOtherEras(toKey);
    setEraVehicleOpacity(toKey, 1);
    // Ensure the active era has its full population (in case of drift).
    const activeCount = vehicles.filter((v) => v.era === toKey).length;
    if (activeCount < targetPerEra && vehicles.length < maxVehicles) {
      spawnPopulation(toKey, targetPerEra - activeCount);
    }
  };

  // ---- update -------------------------------------------------------------

  function update(deltaMs: number): void {
    const deltaSec = Math.min(deltaMs / 1000, 0.05); // clamp big frame gaps
    advance(deltaSec);
  }

  // ---- dispose ------------------------------------------------------------

  function dispose(): void {
    while (vehicles.length > 0) {
      group.remove(vehicles[0].group);
      vehicles.shift();
    }
    disposeAllVehicleResources();
  }

  // ---- initial population -------------------------------------------------
  spawnPopulation(initialEra, targetPerEra);
  setEraVehicleOpacity(initialEra, 1);

  return {
    group,
    applyEra,
    update,
    getVehicleCount: () => vehicles.length,
    getActiveEra: () => activeEra,
    getLanes: () => lanes,
    getVehicleStates: () =>
      vehicles.map((v) => ({
        era: v.era,
        laneIndex: v.laneIndex,
        s: v.s,
        length: v.length,
      })),
    dispose,
  };
}
