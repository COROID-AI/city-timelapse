/**
 * RoadNetwork — the consumable, framework-free lane graph for the city block.
 *
 * This module deliberately contains *no* Three.js code: it is pure, serializable
 * data (typed nodes / edges / intersections) that later vehicle, cyclist, and
 * pedestrian tasks consume to navigate. The visual block (meshes, markings,
 * curbs) is built in `blockLayout.ts`, which emits a `RoadNetwork` whose node
 * positions are aligned with the lane geometry so ground-floor storefronts sit
 * correctly against the sidewalk.
 */

/** Plain serializable 3D point (no Three.js dependency). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Convenience constructor for a {@link Vec3}. */
export function vec(x: number, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

// ---------------------------------------------------------------------------
// Lane classification
// ---------------------------------------------------------------------------

/**
 * The functional class of a lane edge. Determines which agents (vehicles,
 * cyclists, pedestrians) may traverse it and how the edge is drawn.
 */
export type LaneType =
  | 'driving' // two-way road travel lane for vehicles
  | 'parking' // curb-side parking bay along side roads
  | 'cycling' // dedicated bike lane
  | 'walking' // sidewalk / pedestrian walking zone
  | 'crosswalk'; // marked pedestrian crossing over a driving lane

/**
 * Travel direction encoded on a lane edge. `forward` / `backward` are defined
 * relative to the edge's node ordering (a → b). Bidirectional walking and
 * cycling lanes use `both`. Parking bays are `none` (stationary).
 */
export type LaneDirection = 'forward' | 'backward' | 'both' | 'none';

/**
 * The cardinal axis / orientation of a piece of lane geometry. Used by path
 * followers to resolve right-of-way and turn geometry without parsing vectors.
 */
export type LaneAxis = 'north-south' | 'east-west';

// ---------------------------------------------------------------------------
// Nodes & edges
// ---------------------------------------------------------------------------

/**
 * A navigable point on the network. Nodes are the connection points that
 * vehicles / cyclists / pedestrians route between; edges connect them.
 *
 * `connectionPoint` marks an intersection entry/exit where an agent may switch
 * between lane edges (e.g. turn at an intersection, cross a crosswalk).
 */
export interface RoadNode {
  /** Stable unique id, e.g. `'drive-n-in'`. */
  id: string;
  /** World position, in the same coordinate frame as the block meshes. */
  position: Vec3;
  /** The functional class of the lane this node belongs to. */
  laneType: LaneType;
  /**
   * True at intersection entry/exit and crosswalk endpoints where agents are
   * permitted to transition between connected edges.
   */
  connectionPoint: boolean;
}

/**
 * A directed (or bidirectional) lane segment connecting two nodes. Edges carry
 * lane type and direction so agents can filter the graph to their mode.
 */
export interface RoadEdge {
  /** Stable unique id, e.g. `'drive-n-forward'`. */
  id: string;
  /** Origin node id. */
  from: string;
  /** Destination node id. */
  to: string;
  /** Functional lane class. */
  laneType: LaneType;
  /** Allowed travel direction along this edge. */
  direction: LaneDirection;
  /** Orientation axis of the segment. */
  axis: LaneAxis;
}

// ---------------------------------------------------------------------------
// Intersections & traffic signals
// ---------------------------------------------------------------------------

/**
 * Traffic-light phase. The controller cycles green → yellow → red (and the
 * complementary direction is red while the primary is green). Vehicles obey the
 * phase via {@link TrafficLightController.getPhase}.
 */
export type SignalPhase = 'green' | 'yellow' | 'red';

/**
 * A signalized intersection. Groups the nodes that meet at the crossing and the
 * controller that governs the signals. Later vehicle tasks query the controller
 * to decide whether to proceed.
 */
export interface Intersection {
  /** Stable unique id, e.g. `'intersection-center'`. */
  id: string;
  /** Center of the intersection in world space. */
  center: Vec3;
  /** Node ids that meet at this intersection. */
  nodeIds: string[];
}

// ---------------------------------------------------------------------------
// Building lots
// ---------------------------------------------------------------------------

/**
 * A single building lot footprint on the block perimeter. Building and
 * storefront tasks instantiate against this footprint so ground-floor
 * storefronts align with the sidewalk edge.
 */
export interface BuildingLot {
  /** Stable unique id, e.g. `'lot-n0'`. */
  id: string;
  /** Center of the lot footprint on the ground plane. */
  center: Vec3;
  /** Footprint width (along the road) in world units. */
  width: number;
  /** Footprint depth (away from the road) in world units. */
  depth: number;
  /**
   * The axis of the road that this lot fronts onto, used to orient storefronts
   * toward the street.
   */
  frontAxis: LaneAxis;
  /**
   * The sidewalk node id adjacent to this lot's storefront, so pedestrians and
   * storefronts anchor to the same connection point.
   */
  sidewalkNodeId: string;
}

// ---------------------------------------------------------------------------
// The full network
// ---------------------------------------------------------------------------

/**
 * The complete, consumable road network for the city block. Pure data: no
 * meshes, no Three.js. Vehicle, cyclist, and pedestrian tasks build path
 * followers over `nodes` / `edges`, query `intersections` for signals, and read
 * `lots` to place storefronts.
 */
export interface RoadNetwork {
  /** All navigable nodes, keyed for lookup in the order they were emitted. */
  nodes: RoadNode[];
  /** All lane edges connecting nodes. */
  edges: RoadEdge[];
  /** Signalized intersections (at least one). */
  intersections: Intersection[];
  /** Building lot footprints aligned to the sidewalk edge. */
  lots: BuildingLot[];
}

/** Look up a node by id. Returns `undefined` if not present. */
export function getNode(network: RoadNetwork, id: string): RoadNode | undefined {
  return network.nodes.find((n) => n.id === id);
}

/**
 * Return only the edges of a given lane type — the primary filter agents use to
 * build mode-specific paths (e.g. vehicles use `'driving'`, cyclists use
 * `'cycling'`, pedestrians use `'walking'` + `'crosswalk'`).
 */
export function edgesOfType(network: RoadNetwork, type: LaneType): RoadEdge[] {
  return network.edges.filter((e) => e.laneType === type);
}
