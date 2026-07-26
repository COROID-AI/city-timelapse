/**
 * BlockLayout — the static urban structure of the city block.
 *
 * Builds the visual block (perimeter + side roads, lane markings, curbs,
 * sidewalks, crosswalks, parking bays, signalized intersection) AND emits a
 * consumable {@link RoadNetwork} data structure whose node positions are aligned
 * with the lane geometry so downstream building/storefront tasks place
 * ground-floor storefronts correctly against the sidewalk.
 *
 * The road surface, markings, and signal brightness cross-fade between eras via
 * a TransitionManager domain (`applyEra`): older eras get simpler, dimmer
 * markings; 2025+ get high-contrast "smart" markings and brighter signals.
 */

import {
  BoxGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  CylinderGeometry,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
} from 'three';
import { BLOCK_HALF } from '../constants.js';
import {
  DEFAULT_ERA_CONFIG,
  lerp,
  lerpHex,
  type ApplyEraFn,
  type EraKey,
} from '../eras/eraConfig.js';
import {
  type BuildingLot,
  type Intersection,
  type LaneAxis,
  type LaneDirection,
  type LaneType,
  type RoadEdge,
  type RoadNetwork,
  type RoadNode,
  vec,
} from './roadNetwork.js';
import {
  type TrafficLightController,
  createTrafficLightController,
} from './trafficLight.js';

// ---------------------------------------------------------------------------
// Lane cross-section geometry (shared by every road so lots stay aligned)
// ---------------------------------------------------------------------------
// Measured from a road's centerline outward, on each side:
//   driving lane → cycling lane → parking bay → curb → sidewalk → building face

/** Single driving-lane width (one travel direction). */
export const LANE_W = 2.6;
/** Half of the two-way driving surface (centerline → lane edge). */
export const DRIVE_HALF = LANE_W;
/** Cycling-lane width. */
export const BIKE_W = 1.3;
/** Parking-bay depth. */
export const PARK_W = 1.8;
/** Curb width (the raised lip between road and sidewalk). */
export const CURB_W = 0.4;
/** Curb height. */
export const CURB_H = 0.3;
/** Sidewalk width. */
export const WALK_W = 2.4;

/** Half-width of the paved (asphalt) surface: driving + cycling + parking. */
export const ASPHALT_HALF = DRIVE_HALF + BIKE_W + PARK_W; // 5.7
/** Outer edge of the curb. */
export const CURB_OUTER = ASPHALT_HALF + CURB_W; // 6.1
/** Center of the sidewalk band. */
export const WALK_CENTER = CURB_OUTER + WALK_W / 2; // 7.3
/** Where a building lot's ground floor meets the sidewalk. */
export const BUILDING_FACE = CURB_OUTER + WALK_W; // 8.5

/** Length of one repeating lane-marking tile, in world units. */
const ROAD_TILE = 4;
/** Length of one road half-segment (block edge → intersection edge). */
const SEG_LEN = BLOCK_HALF - ASPHALT_HALF; // 19.3

// Lane center offsets (from a road's centerline), per functional lane.
const DRIVE_LANE_OFFSET = DRIVE_HALF / 2; // 1.3
const BIKE_LANE_OFFSET = DRIVE_HALF + BIKE_W / 2; // 3.25
const PARK_LANE_OFFSET = ASPHALT_HALF - PARK_W / 2; // 4.8

/** Default traffic-light cycle period (ms) for the central intersection. */
const DEFAULT_INTERSECTION_CYCLE_MS = 14_000;

/** Lot grid cell size and gap used to arrange building footprints. */
const LOT_SIZE = 4.5;
const LOT_GAP = 0.5;

// ---------------------------------------------------------------------------
// RoadNetwork (pure, consumable data) — aligned to the geometry above
// ---------------------------------------------------------------------------

/** The length-axis sample stations used for every straight lane. */
const STATIONS = [-BLOCK_HALF, -ASPHALT_HALF, ASPHALT_HALF, BLOCK_HALF];

/**
 * Build the consumable road network: typed nodes/edges for driving, parking,
 * cycling, and walking lanes (with directions), crosswalks, the signalized
 * intersection, and building-lot footprints aligned to the sidewalk edge.
 *
 * Contains no Three.js types — vehicle, cyclist, and pedestrian tasks consume
 * this directly to build path followers.
 */
export function buildRoadNetwork(): RoadNetwork {
  const nodes: RoadNode[] = [];
  const edges: RoadEdge[] = [];
  const intersections: Intersection[] = [];
  const lots: BuildingLot[] = [];
  // Sidewalk nodes kept separately so lots can link to their nearest storefront
  // connection point.
  const walkingNodes: RoadNode[] = [];
  // Driving nodes sitting on the intersection box edges (for the intersection).
  const intersectionNodeIds: string[] = [];

  /** Add a straight lane (4 nodes / 3 edges) along a road for one side. */
  function addLinearLane(
    type: LaneType,
    axis: LaneAxis,
    direction: LaneDirection,
    centerOffset: number,
    sign: 1 | -1,
  ): void {
    const isNS = axis === 'north-south';
    const off = sign * centerOffset;
    const tag = sign > 0 ? 'p' : 'n';
    const ids: string[] = [];
    for (let i = 0; i < STATIONS.length; i++) {
      const s = STATIONS[i];
      const position = isNS ? vec(off, 0, s) : vec(s, 0, off);
      const id = `${type}-${axis}-${tag}-${i}`;
      ids.push(id);
      const onIntersection = i === 1 || i === 2;
      nodes.push({ id, position, laneType: type, connectionPoint: onIntersection || type === 'driving' });
      if (type === 'driving' && onIntersection) {
        intersectionNodeIds.push(id);
      }
    }
    for (let i = 0; i < 3; i++) {
      edges.push({
        id: `${type}-${axis}-${tag}-e${i}`,
        from: ids[i],
        to: ids[i + 1],
        laneType: type,
        direction,
        axis,
      });
    }
  }

  // --- Driving lanes: two directions on each road ---------------------------
  addLinearLane('driving', 'east-west', 'forward', DRIVE_LANE_OFFSET, 1);
  addLinearLane('driving', 'east-west', 'backward', DRIVE_LANE_OFFSET, -1);
  addLinearLane('driving', 'north-south', 'forward', DRIVE_LANE_OFFSET, 1);
  addLinearLane('driving', 'north-south', 'backward', DRIVE_LANE_OFFSET, -1);

  // --- Cycling lanes: bidirectional, both sides of each road ---------------
  addLinearLane('cycling', 'east-west', 'both', BIKE_LANE_OFFSET, 1);
  addLinearLane('cycling', 'east-west', 'both', BIKE_LANE_OFFSET, -1);
  addLinearLane('cycling', 'north-south', 'both', BIKE_LANE_OFFSET, 1);
  addLinearLane('cycling', 'north-south', 'both', BIKE_LANE_OFFSET, -1);

  // --- Parking bays: stationary bays along the side roads ------------------
  addLinearLane('parking', 'east-west', 'none', PARK_LANE_OFFSET, 1);
  addLinearLane('parking', 'east-west', 'none', PARK_LANE_OFFSET, -1);
  addLinearLane('parking', 'north-south', 'none', PARK_LANE_OFFSET, 1);
  addLinearLane('parking', 'north-south', 'none', PARK_LANE_OFFSET, -1);

  // --- Walking lanes: sidewalks along every road, split around the center --
  const walkStationsPerSide = [-22.5, -17.5, -12.5, -5.7];
  function addWalkLine(axis: LaneAxis, sign: 1 | -1): void {
    const isNS = axis === 'north-south';
    const off = sign * WALK_CENTER;
    const tag = sign > 0 ? 'p' : 'n';
    for (const mirror of [-1, 1] as const) {
      const seg = walkStationsPerSide.map((s) => s * mirror);
      const ids: string[] = [];
      for (const s of seg) {
        const position = isNS ? vec(off, 0, s) : vec(s, 0, off);
        const id = `walking-${axis}-${tag}-${s}`;
        const onIntersection = Math.abs(s) < ASPHALT_HALF + 0.01;
        const node: RoadNode = { id, position, laneType: 'walking', connectionPoint: onIntersection };
        nodes.push(node);
        walkingNodes.push(node);
        ids.push(id);
      }
      for (let i = 0; i < ids.length - 1; i++) {
        edges.push({
          id: `walking-${axis}-${tag}-e${seg[i]}`,
          from: ids[i],
          to: ids[i + 1],
          laneType: 'walking',
          direction: 'both',
          axis,
        });
      }
    }
  }
  addWalkLine('east-west', 1);
  addWalkLine('east-west', -1);
  addWalkLine('north-south', 1);
  addWalkLine('north-south', -1);

  // --- Crosswalks: marked crossings over each road at the intersection -----
  function addCrosswalk(id: string, a: ReturnType<typeof vec>, b: ReturnType<typeof vec>): void {
    const axis: LaneAxis = a.x !== b.x ? 'east-west' : 'north-south';
    const na: RoadNode = { id: `${id}-a`, position: a, laneType: 'crosswalk', connectionPoint: true };
    const nb: RoadNode = { id: `${id}-b`, position: b, laneType: 'crosswalk', connectionPoint: true };
    nodes.push(na, nb);
    edges.push({ id: `${id}-e`, from: na.id, to: nb.id, laneType: 'crosswalk', direction: 'both', axis });
  }
  addCrosswalk('xwalk-ew-e', vec(ASPHALT_HALF, 0, -WALK_CENTER), vec(ASPHALT_HALF, 0, WALK_CENTER));
  addCrosswalk('xwalk-ew-w', vec(-ASPHALT_HALF, 0, -WALK_CENTER), vec(-ASPHALT_HALF, 0, WALK_CENTER));
  addCrosswalk('xwalk-ns-n', vec(-WALK_CENTER, 0, -ASPHALT_HALF), vec(WALK_CENTER, 0, -ASPHALT_HALF));
  addCrosswalk('xwalk-ns-s', vec(-WALK_CENTER, 0, ASPHALT_HALF), vec(WALK_CENTER, 0, ASPHALT_HALF));

  // --- Signalized intersection at the block center -------------------------
  intersections.push({
    id: 'intersection-center',
    center: vec(0, 0, 0),
    nodeIds: intersectionNodeIds,
  });

  // --- Building lots: a grid per quadrant, each facing its nearest road ----
  function nearestWalkNodeId(x: number, z: number): string {
    let best = '';
    let bestDist = Infinity;
    for (const n of walkingNodes) {
      const dx = n.position.x - x;
      const dz = n.position.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) {
        bestDist = d;
        best = n.id;
      }
    }
    return best;
  }
  const quadrants: ReadonlyArray<readonly [number, number, number, number]> = [
    [BUILDING_FACE, BLOCK_HALF, -BLOCK_HALF, -BUILDING_FACE], // NE
    [-BLOCK_HALF, -BUILDING_FACE, -BLOCK_HALF, -BUILDING_FACE], // NW
    [BUILDING_FACE, BLOCK_HALF, BUILDING_FACE, BLOCK_HALF], // SE
    [-BLOCK_HALF, -BUILDING_FACE, BUILDING_FACE, BLOCK_HALF], // SW
  ];
  let lotIndex = 0;
  for (const [xa, xb, za, zb] of quadrants) {
    const xs = gridCenters(xa, xb);
    const zs = gridCenters(za, zb);
    for (const cx of xs) {
      for (const cz of zs) {
        // Face the nearer of the two bordering roads.
        const frontAxis: LaneAxis = Math.abs(cx) <= Math.abs(cz) ? 'north-south' : 'east-west';
        lots.push({
          id: `lot-${lotIndex++}`,
          center: vec(cx, 0, cz),
          width: LOT_SIZE,
          depth: LOT_SIZE,
          frontAxis,
          sidewalkNodeId: nearestWalkNodeId(cx, cz),
        });
      }
    }
  }

  return { nodes, edges, intersections, lots };
}

/** Evenly spaced footprint centers within [a, b] using LOT_SIZE/LOT_GAP. */
function gridCenters(a: number, b: number): number[] {
  const out: number[] = [];
  const step = LOT_SIZE + LOT_GAP;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  let c = lo + LOT_SIZE / 2;
  while (c + LOT_SIZE / 2 <= hi + 1e-6) {
    out.push(c);
    c += step;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Canvas-texture lane markings (era-driven vocabulary)
// ---------------------------------------------------------------------------

type MarkingStyle = 'simple' | 'standard' | 'smart';

/**
 * Paint a road-surface marking tile onto a canvas. The canvas width is one
 * length tile (repeats along the road); the height is the full paved
 * cross-section (mapped once). Markings are drawn white so the material's
 * `color` can tint them to the era's marking color.
 */
function paintMarkings(ctx: CanvasRenderingContext2D, w: number, h: number, style: MarkingStyle): void {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';

  const crossPx = (offset: number): number =>
    ((offset / ASPHALT_HALF) * 0.5 + 0.5) * h;

  // Center dashed line — present in every era.
  const cy = crossPx(0);
  const dash = w / 4;
  ctx.fillRect(0, cy - 2, dash, 4);
  ctx.fillRect(dash * 2, cy - 2, dash, 4);

  if (style === 'simple') {
    return; // older eras: just a faded centerline
  }

  // Solid lane-separator lines (driving-lane edges) on both sides of center.
  for (const off of [-DRIVE_HALF, DRIVE_HALF]) {
    const y = crossPx(off);
    ctx.fillRect(0, y - 1, w, 2);
  }
  // Cycling-lane edges.
  for (const off of [-(DRIVE_HALF + BIKE_W), DRIVE_HALF + BIKE_W]) {
    const y = crossPx(off);
    ctx.fillRect(0, y - 1, w, 2);
  }
  // Asphalt edge lines.
  ctx.fillRect(0, 0, w, 2);
  ctx.fillRect(0, h - 2, w, 2);
  // Parking-bay tick marks.
  for (const off of [-PARK_LANE_OFFSET, PARK_LANE_OFFSET]) {
    const y = crossPx(off);
    for (let x = 0; x < w; x += w / 2) {
      ctx.fillRect(x, y - 1, w / 4, 2);
    }
  }

  if (style === 'smart') {
    // Bike-lane symbology: a small circle in each cycling lane.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (const off of [-BIKE_LANE_OFFSET, BIKE_LANE_OFFSET]) {
      const y = crossPx(off);
      ctx.beginPath();
      ctx.arc(w / 2, y, Math.min(w, h) * 0.06, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** Create the repeating road-marking texture for a given era vocabulary. */
function createMarkingTexture(style: MarkingStyle): CanvasTexture {
  const w = 64;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    paintMarkings(ctx, w, h, style);
  }
  const tex = new CanvasTexture(canvas);
  // Repeat along the road length (S = u); clamp across the cross-section (T = v).
  tex.wrapS = RepeatWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.repeat.set(SEG_LEN / ROAD_TILE, 1);
  tex.anisotropy = 4;
  return tex;
}

/** Create the zebra-stripe texture used on crosswalks. */
function createCrosswalkTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < size; y += 16) {
      ctx.fillRect(0, y, size, 9);
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

// ---------------------------------------------------------------------------
// Visual block + controller + era domain
// ---------------------------------------------------------------------------

/** A set of red/yellow/green lamp materials for one signal direction. */
interface LampSet {
  red: MeshStandardMaterial;
  yellow: MeshStandardMaterial;
  green: MeshStandardMaterial;
}

/** Result of building the block: scene graph, network, controller, era hook. */
export interface BlockLayout {
  /** Group to add to the scene (roads, curbs, sidewalks, markings, signals). */
  group: Group;
  /** Consumable lane graph for vehicles, cyclists, and pedestrians. */
  network: RoadNetwork;
  /** Traffic-light controller for the central signalized intersection. */
  controller: TrafficLightController;
  /** TransitionManager domain callback (markings/surface/signal intensity). */
  applyEra: ApplyEraFn;
  /** Advance signals one frame; call from the render loop with delta in ms. */
  update: (deltaMs: number) => void;
  /** Release GPU resources held by the block. */
  dispose: () => void;
}

/**
 * Create the full city block: visual geometry + consumable road network +
 * signalized intersection controller + era-transition domain.
 */
export function createBlock(initialEra: EraKey = '1945'): BlockLayout {
  const group = new Group();
  group.name = 'block';

  const network = buildRoadNetwork();
  const controller = createTrafficLightController({
    cycleMs: DEFAULT_INTERSECTION_CYCLE_MS,
  });

  // --- Shared materials -----------------------------------------------------
  const initialRoad = DEFAULT_ERA_CONFIG[initialEra].road;
  const surfaceMat = new MeshStandardMaterial({
    color: initialRoad.surfaceColor,
    roughness: initialRoad.surfaceRoughness,
    metalness: 0.0,
  });
  const markingTextures: Record<MarkingStyle, CanvasTexture> = {
    simple: createMarkingTexture('simple'),
    standard: createMarkingTexture('standard'),
    smart: createMarkingTexture('smart'),
  };
  const markingMat = new MeshStandardMaterial({
    color: initialRoad.markingColor,
    transparent: true,
    roughness: 0.6,
    metalness: 0.0,
  });
  markingMat.map = markingTextures[initialRoad.markingStyle];
  const crosswalkMat = new MeshStandardMaterial({
    color: initialRoad.markingColor,
    map: createCrosswalkTexture(),
    transparent: true,
    roughness: 0.6,
  });
  const curbMat = new MeshStandardMaterial({ color: 0x9a9a96, roughness: 0.9 });
  const sidewalkMat = new MeshStandardMaterial({ color: 0xb8b4ac, roughness: 0.95 });
  const poleMat = new MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.6, metalness: 0.4 });
  const headMat = new MeshStandardMaterial({ color: 0x202024, roughness: 0.5, metalness: 0.3 });

  // --- One road half-segment (asphalt + markings + curbs + sidewalks) ------
  function addRoadHalf(roadGroup: Group, sign: 1 | -1): void {
    const centerX = sign * ((BLOCK_HALF + ASPHALT_HALF) / 2);
    const asphalt = new Mesh(new PlaneGeometry(SEG_LEN, ASPHALT_HALF * 2), surfaceMat);
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.set(centerX, 0.01, 0);
    asphalt.receiveShadow = true;
    roadGroup.add(asphalt);

    const markings = new Mesh(new PlaneGeometry(SEG_LEN, ASPHALT_HALF * 2), markingMat);
    markings.rotation.x = -Math.PI / 2;
    markings.position.set(centerX, 0.02, 0);
    roadGroup.add(markings);

    for (const side of [-1, 1] as const) {
      const curb = new Mesh(new BoxGeometry(SEG_LEN, CURB_H, CURB_W), curbMat);
      curb.position.set(centerX, CURB_H / 2, side * ASPHALT_HALF);
      curb.receiveShadow = true;
      roadGroup.add(curb);

      const sidewalk = new Mesh(new PlaneGeometry(SEG_LEN, WALK_W), sidewalkMat);
      sidewalk.rotation.x = -Math.PI / 2;
      sidewalk.position.set(centerX, CURB_H + 0.01, side * WALK_CENTER);
      sidewalk.receiveShadow = true;
      roadGroup.add(sidewalk);
    }
  }

  // E-W road (perimeter road running east–west).
  const ewRoad = new Group();
  ewRoad.name = 'road-ew';
  addRoadHalf(ewRoad, -1);
  addRoadHalf(ewRoad, 1);
  group.add(ewRoad);

  // N-S road (side road running north–south) — same geometry, rotated 90°.
  const nsRoad = new Group();
  nsRoad.name = 'road-ns';
  addRoadHalf(nsRoad, -1);
  addRoadHalf(nsRoad, 1);
  nsRoad.rotation.y = Math.PI / 2;
  group.add(nsRoad);

  // Central intersection cap (covers the square where the roads cross).
  const intersectionCap = new Mesh(
    new PlaneGeometry(ASPHALT_HALF * 2, ASPHALT_HALF * 2),
    surfaceMat,
  );
  intersectionCap.rotation.x = -Math.PI / 2;
  intersectionCap.position.set(0, 0.015, 0);
  intersectionCap.receiveShadow = true;
  group.add(intersectionCap);

  // --- Crosswalks at the four intersection arms ----------------------------
  const crosswalkDepth = 2.2;
  function addCrosswalkMesh(x: number, z: number, horizontal: boolean): void {
    const geom = horizontal
      ? new PlaneGeometry(ASPHALT_HALF * 2, crosswalkDepth)
      : new PlaneGeometry(crosswalkDepth, ASPHALT_HALF * 2);
    const mesh = new Mesh(geom, crosswalkMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.025, z);
    group.add(mesh);
  }
  addCrosswalkMesh(ASPHALT_HALF, 0, false);
  addCrosswalkMesh(-ASPHALT_HALF, 0, false);
  addCrosswalkMesh(0, ASPHALT_HALF, true);
  addCrosswalkMesh(0, -ASPHALT_HALF, true);

  // --- Signalized intersection: four signal heads --------------------------
  function makeLampSet(): LampSet {
    return {
      red: new MeshStandardMaterial({ color: 0xff2b2b, emissive: 0xff2b2b, emissiveIntensity: 0.05 }),
      yellow: new MeshStandardMaterial({ color: 0xffd23b, emissive: 0xffd23b, emissiveIntensity: 0.05 }),
      green: new MeshStandardMaterial({ color: 0x39ff7a, emissive: 0x39ff7a, emissiveIntensity: 0.05 }),
    };
  }
  // E-W signals govern the east–west road; N-S signals the complementary phase.
  const ewLamps = makeLampSet();
  const nsLamps = makeLampSet();

  function addSignal(x: number, z: number, lamps: LampSet): void {
    const signal = new Group();
    const pole = new Mesh(new CylinderGeometry(0.12, 0.15, 3, 8), poleMat);
    pole.position.y = 1.5;
    const housing = new Mesh(new BoxGeometry(0.5, 1.2, 0.4), headMat);
    housing.position.y = 3.4;
    const red = new Mesh(new BoxGeometry(0.34, 0.34, 0.42), lamps.red);
    red.position.y = 3.78;
    const yellow = new Mesh(new BoxGeometry(0.34, 0.34, 0.42), lamps.yellow);
    yellow.position.y = 3.4;
    const green = new Mesh(new BoxGeometry(0.34, 0.34, 0.42), lamps.green);
    green.position.y = 3.02;
    signal.add(pole, housing, red, yellow, green);
    signal.position.set(x, 0, z);
    signal.name = 'traffic-signal';
    group.add(signal);
  }
  const corner = ASPHALT_HALF + 0.6;
  addSignal(corner, corner, ewLamps); // SE corner → E-W signal
  addSignal(-corner, -corner, ewLamps); // NW corner → E-W signal
  addSignal(corner, -corner, nsLamps); // NE corner → N-S signal
  addSignal(-corner, corner, nsLamps); // SW corner → N-S signal

  // --- Era-driven appearance ----------------------------------------------
  let baseSignalIntensity = initialRoad.signalIntensity;
  let currentMarkingStyle: MarkingStyle = initialRoad.markingStyle;

  const applyEra: ApplyEraFn = (toKey, t, fromKey) => {
    const from = DEFAULT_ERA_CONFIG[fromKey].road;
    const to = DEFAULT_ERA_CONFIG[toKey].road;

    surfaceMat.color.set(lerpHex(from.surfaceColor, to.surfaceColor, t));
    surfaceMat.roughness = lerp(from.surfaceRoughness, to.surfaceRoughness, t);

    const markingColor = lerpHex(from.markingColor, to.markingColor, t);
    markingMat.color.set(markingColor);
    crosswalkMat.color.set(markingColor);

    // Marking vocabulary swaps discretely to the destination era's style.
    if (to.markingStyle !== currentMarkingStyle) {
      currentMarkingStyle = to.markingStyle;
      markingMat.map = markingTextures[currentMarkingStyle];
      markingMat.needsUpdate = true;
    }

    baseSignalIntensity = lerp(from.signalIntensity, to.signalIntensity, t);
  };

  function syncLamps(lamps: LampSet, phase: 'red' | 'yellow' | 'green'): void {
    const on = baseSignalIntensity * 1.6;
    lamps.red.emissiveIntensity = phase === 'red' ? on : 0.04;
    lamps.yellow.emissiveIntensity = phase === 'yellow' ? on : 0.04;
    lamps.green.emissiveIntensity = phase === 'green' ? on : 0.04;
  }

  function update(deltaMs: number): void {
    controller.update(deltaMs);
    syncLamps(ewLamps, controller.getPhase());
    syncLamps(nsLamps, controller.getComplementaryPhase());
  }

  function dispose(): void {
    group.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        const mat = mesh.material as Material | Material[];
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat.dispose();
        }
      }
    });
    Object.values(markingTextures).forEach((tex) => tex.dispose());
    if (crosswalkMat.map) {
      crosswalkMat.map.dispose();
    }
  }

  return { group, network, controller, applyEra, update, dispose };
}
