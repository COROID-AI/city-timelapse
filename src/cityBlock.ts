/**
 * Era-driven city block assembly + crossfade controller.
 *
 * `buildEraScene(era)` is a pure factory that returns a fully-populated
 * `THREE.Group` for a single era: ground, cross-shaped road grid, sidewalk
 * slabs, 6–10 procedurally-textured buildings, 2–4 storefront signs, a handful
 * of deterministically-placed vehicles, and a crowd of instanced pedestrians
 * walking a loop path. Every visual input (facade texture, sign texture,
 * vehicle silhouette, pedestrian palette) is produced by the pure asset
 * builders in `./assetBuilder`, so two different eras always look observably
 * different.
 *
 * `createCityBlock(scene)` mounts a single era-root group in the scene and
 * returns a controller whose `setActiveEra(era)` crossfades between eras
 * (opacity tween + lateral slide) within 1.5s and disposes the outgoing
 * group's GPU resources once the fade completes. The previous group stays
 * mounted for the whole transition so there is never a black frame.
 */
import * as THREE from 'three';
import {
  type Era,
  type BuildingType,
  type VehicleVariant,
  paletteFor,
  makeFacadeTexture,
  makeSignTexture,
  makeVehicle,
} from './assetBuilder';
import type { EraDefinition } from './eras/types';
import { ERAS } from './eras/data';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

/** Total square footprint of the city block. */
const BLOCK_SIZE = 60;
/** Width of the cross-shaped road running through the block. */
const ROAD_WIDTH = 12;
/** Metres added to the facade per "storey" in an era's height range. */
const STOREY_HEIGHT = 3.2;
/** Half-extent of the square pedestrian loop path (sits on the inner sidewalk). */
const PEDESTRIAN_RING_R = ROAD_WIDTH / 2 + 3;
/** Building footprint edge length on each quadrant plot. */
const BUILDING_FOOTPRINT = ((BLOCK_SIZE / 2) - (ROAD_WIDTH / 2)) / 2 * 0.7;
/** Half the building footprint edge length (used to offset storefront signs). */
const HALF_BUILDING_FOOTPRINT = BUILDING_FOOTPRINT / 2;

/** Crossfade duration in seconds (well under the 1.5s budget). */
const CROSSFADE_SECONDS = 1.0;
/** Lateral slide distance (world units) applied during a crossfade. */
const CROSSFADE_SLIDE = 5;

/** Deterministic era-specific storefront sign labels. */
const SIGN_LABELS: Record<Era, readonly string[]> = {
  1945: ['VICTORY', 'DINER', 'BAKERY'],
  1965: ['NEON', 'JUKEBOX', 'MOTEL'],
  1985: ['ARCADE', 'VIDEO', 'PIZZA'],
  2005: ['CYBER', 'WIFI', 'CAFE'],
  2025: ['NEXUS', 'DRONE', 'BIONIC'],
};

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

/** Mulberry32 seeded PRNG so every era is built deterministically. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Linear interpolation. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth ease-in-out cubic curve for the crossfade tween. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Disposes a material and any texture map attached to it (idempotent). */
function disposeMaterial(mat: THREE.Material): void {
  const m = mat as THREE.Material & { map?: THREE.Texture | null };
  m.map?.dispose();
  mat.dispose();
}

/** Recursively releases every geometry, material and texture under a group. */
export function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    if (Array.isArray(mat)) mat.forEach(disposeMaterial);
    else disposeMaterial(mat);
  });
}

/** Sets a uniform opacity across every mesh material in a group. */
function setGroupOpacity(group: THREE.Group, opacity: number): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.Material | THREE.Material[];
    const mats = Array.isArray(mat) ? mat : [mat];
    for (const m of mats) {
      const sm = m as THREE.MeshStandardMaterial;
      sm.transparent = true;
      sm.opacity = opacity;
      sm.depthWrite = opacity > 0.98;
      sm.needsUpdate = true;
    }
  });
}

/**
 * Samples a clockwise square loop of half-extent `R`. Writes the loop position
 * (y = 0) into `out` and returns the heading angle (rotation.y) so callers can
 * orient pedestrians to face their direction of travel.
 */
function sampleRing(t: number, R: number, out: THREE.Vector3): number {
  const s = ((t % 1) + 1) % 1;
  const seg = Math.floor(s * 4);
  const f = s * 4 - seg;
  switch (seg) {
    case 0:
      out.set(R, 0, -R + 2 * R * f);
      return Math.PI; // travelling +z
    case 1:
      out.set(R - 2 * R * f, 0, R);
      return -Math.PI / 2; // travelling -x
    case 2:
      out.set(-R, 0, R - 2 * R * f);
      return 0; // travelling -z
    default:
      out.set(-R + 2 * R * f, 0, -R);
      return Math.PI / 2; // travelling +x
  }
}

// ---------------------------------------------------------------------------
// Block sub-assemblies
// ---------------------------------------------------------------------------

/** Hex colour string -> THREE.Color helper for the era palette values. */
function color(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

/** Ground plane + cross-shaped road grid coloured from the era palette. */
function buildGroundAndRoads(def: EraDefinition): THREE.Group {
  const group = new THREE.Group();
  group.name = 'GroundAndRoads';

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE),
    new THREE.MeshStandardMaterial({ color: color(def.palette.ground) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'Ground';
  group.add(ground);

  const roadMaterial = new THREE.MeshStandardMaterial({
    color: color(def.palette.road),
    roughness: 0.9,
  });

  const streetH = new THREE.Mesh(
    new THREE.PlaneGeometry(BLOCK_SIZE, ROAD_WIDTH),
    roadMaterial,
  );
  streetH.rotation.x = -Math.PI / 2;
  streetH.position.y = 0.02;
  streetH.receiveShadow = true;
  streetH.name = 'StreetHorizontal';
  group.add(streetH);

  const streetV = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_WIDTH, BLOCK_SIZE),
    roadMaterial,
  );
  streetV.rotation.x = -Math.PI / 2;
  streetV.position.y = 0.02;
  streetV.receiveShadow = true;
  streetV.name = 'StreetVertical';
  group.add(streetV);

  return group;
}

/** Four raised sidewalk slabs + a planter prop on each, era-tinted. */
function buildSidewalks(def: EraDefinition): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Sidewalks';

  const slabMaterial = new THREE.MeshStandardMaterial({
    color: color(def.palette.sidewalk),
    roughness: 0.95,
  });
  const foliageMaterial = new THREE.MeshStandardMaterial({
    color: color(def.palette.foliage),
    roughness: 1,
  });

  const inner = ROAD_WIDTH / 2;
  const outer = BLOCK_SIZE / 2;
  const quadrantHalf = (outer - inner) / 2;
  const quadrantCenter = inner + quadrantHalf;
  const slabSize = quadrantHalf * 2;

  let i = 0;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const cx = sx * quadrantCenter;
      const cz = sz * quadrantCenter;

      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(slabSize, 0.4, slabSize),
        slabMaterial,
      );
      slab.position.set(cx, 0.2, cz);
      slab.receiveShadow = true;
      slab.name = `Sidewalk_${i}`;
      group.add(slab);

      // Small foliage planter prop near the inner corner of the slab.
      const planter = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 8, 6),
        foliageMaterial,
      );
      planter.position.set(
        cx - sx * (quadrantHalf - 2),
        0.9,
        cz - sz * (quadrantHalf - 2),
      );
      planter.castShadow = true;
      planter.name = `Planter_${i}`;
      group.add(planter);

      i += 1;
    }
  }
  return group;
}

interface SignAnchor {
  /** World position on the building face where a sign can sit. */
  readonly position: THREE.Vector3;
  /** Which road axis the face points toward. */
  readonly axis: 'x' | 'z';
  /** Quadrant sign so we can compute the outward facing angle. */
  readonly sign: 1 | -1;
}

const BUILDING_TYPES: readonly BuildingType[] = [
  'commercial',
  'office',
  'residential',
];

/**
 * Builds 8 procedurally-textured buildings (2 per quadrant) on the 2×2 plot
 * grid. Facade textures, heights and footprints are all derived from the era
 * definition so each era reads as visibly distinct.
 */
function buildBuildings(
  era: Era,
  def: EraDefinition,
): { group: THREE.Group; anchors: SignAnchor[] } {
  const group = new THREE.Group();
  group.name = 'Buildings';

  const rng = makeRng(era);
  const styles = def.buildingStyles;
  const styleCount = Math.max(1, styles.length);

  // Shared facade materials per (era, type) to keep the draw-call count sane.
  const facadeCache = new Map<BuildingType, THREE.MeshStandardMaterial>();
  const facadeFor = (type: BuildingType): THREE.MeshStandardMaterial => {
    const cached = facadeCache.get(type);
    if (cached) return cached;
    const tex = makeFacadeTexture(era, type);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    facadeCache.set(type, mat);
    return mat;
  };

  const inner = ROAD_WIDTH / 2;
  const outer = BLOCK_SIZE / 2;
  const quadrantHalf = (outer - inner) / 2;
  const quadrantCenter = inner + quadrantHalf;
  const footprint = BUILDING_FOOTPRINT; // building footprint width/depth
  const anchors: SignAnchor[] = [];

  let plotIndex = 0;
  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      const cx = sx * quadrantCenter;
      const cz = sz * quadrantCenter;

      // Two buildings per quadrant: front and back along z.
      for (const zOffset of [-quadrantHalf * 0.4, quadrantHalf * 0.4]) {
        const style = styles[plotIndex % styleCount];
        const type = BUILDING_TYPES[plotIndex % BUILDING_TYPES.length];
        const [hMin, hMax] = style.heightRange;
        const height = lerp(hMin, hMax, rng()) * STOREY_HEIGHT;

        const bx = cx;
        const bz = cz + zOffset;

        const building = new THREE.Mesh(
          new THREE.BoxGeometry(footprint, height, footprint),
          facadeFor(type),
        );
        building.position.set(bx, 0.4 + height / 2, bz);
        building.castShadow = true;
        building.receiveShadow = true;
        building.name = `Building_${plotIndex}`;
        group.add(building);

        // Record a sign anchor on the road-facing face of this building.
        anchors.push({
          position: new THREE.Vector3(bx, 0.4 + height * 0.35, bz),
          axis: plotIndex % 2 === 0 ? 'x' : 'z',
          sign: plotIndex % 2 === 0 ? sx : sz,
        });

        plotIndex += 1;
      }
    }
  }

  return { group, anchors };
}

/**
 * Attaches 3 era-specific storefront signs to building faces. Each sign uses
 * {@link makeSignTexture} so the signage medium visibly changes per era
 * (stencil → neon → dot-matrix → backlit → holographic).
 */
function buildSigns(era: Era, anchors: SignAnchor[], parent: THREE.Group): void {
  const labels = SIGN_LABELS[era];
  // Pick three spread-out anchors; clamp if fewer are available.
  const chosen = [0, 3, 5].filter((i) => i < anchors.length).slice(0, 3);
  const signGeo = new THREE.PlaneGeometry(4.5, 2.2);

  chosen.forEach((anchorIdx, n) => {
    const anchor = anchors[anchorIdx];
    if (!anchor) return;
    const tex = makeSignTexture(era, labels[n % labels.length]);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const sign = new THREE.Mesh(signGeo, mat);

    // Push the sign just outside the building face that points toward the road.
    const push = HALF_BUILDING_FOOTPRINT + 0.3;
    if (anchor.axis === 'x') {
      sign.position.set(
        anchor.position.x - anchor.sign * push,
        anchor.position.y,
        anchor.position.z,
      );
      sign.rotation.y = anchor.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      sign.position.set(
        anchor.position.x,
        anchor.position.y,
        anchor.position.z - anchor.sign * push,
      );
      sign.rotation.y = anchor.sign > 0 ? Math.PI : 0;
    }
    sign.name = `Sign_${n}`;
    parent.add(sign);
  });
}

/**
 * Places 4 vehicles deterministically along the roads (parked along the lane
 * edges). Each is built by {@link makeVehicle} so the silhouette evolves per
 * era, and positions are seeded by the era year.
 */
function buildVehicles(era: Era): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Vehicles';

  const rng = makeRng(era + 7);
  const lane = ROAD_WIDTH / 2 - 2.5;
  const variants: readonly VehicleVariant[] = ['car', 'truck', 'car', 'car'];

  // [x, z, rotationY]
  const slots: readonly (readonly [number, number, number])[] = [
    [-14, lane, Math.PI / 2],
    [14, -lane, -Math.PI / 2],
    [-lane, -14, 0],
    [lane, 14, Math.PI],
  ];

  slots.forEach((slot, i) => {
    const [x, z, rot] = slot;
    const variant = variants[i % variants.length];
    const vehicle = makeVehicle(era, variant);
    // Deterministic jitter so the same era always looks the same.
    vehicle.position.set(x + (rng() - 0.5) * 1.5, 0, z + (rng() - 0.5) * 1.5);
    vehicle.rotation.y = rot;
    vehicle.name = `Vehicle_${i}`;
    group.add(vehicle);
  });

  return group;
}

interface PedestrianInstances {
  /** Per-instance loop phase [0,1) and walk speed. */
  readonly phases: readonly number[];
  readonly speeds: readonly number[];
}

/**
 * Builds a single `InstancedMesh` crowd (12 figures) walking the sidewalk loop.
 * Using one instanced mesh keeps the pedestrian triangle budget low while
 * satisfying the "instanced where possible" requirement. Colours vary per era
 * via the era palette so crowds read differently across time.
 */
function buildPedestrians(
  era: Era,
): { mesh: THREE.InstancedMesh; instances: PedestrianInstances } {
  const count = 12;
  const palette = paletteFor(era);

  const geo = new THREE.CapsuleGeometry(0.18, 1.0, 4, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true;
  mesh.frustumCulled = false; // instances span the whole ring
  mesh.name = 'Pedestrians';

  const phases: number[] = [];
  const speeds: number[] = [];
  const cloth = new THREE.Color(palette.clothing);
  const skin = new THREE.Color(palette.skin);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < count; i++) {
    const phase = i / count;
    phases.push(phase);
    speeds.push(0.018 + (i % 4) * 0.004); // 0.018–0.03 loop fractions / sec

    dummy.position.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, i % 2 === 0 ? cloth : skin);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  return { mesh, instances: { phases, speeds } };
}

// ---------------------------------------------------------------------------
// Public factory + controller
// ---------------------------------------------------------------------------

/**
 * Builds a fully-populated city block group for a single era. Pure: does not
 * touch any scene or mount the group anywhere. The returned group contains
 * ground, road grid, sidewalks, ≥ 6 buildings, ≥ 2 storefront signs, ≥ 3
 * vehicles and an instanced pedestrian crowd.
 */
export function buildEraScene(era: Era): THREE.Group {
  const def: EraDefinition = ERAS[era];

  const group = new THREE.Group();
  group.name = `Era_${era}`;

  group.add(buildGroundAndRoads(def));
  group.add(buildSidewalks(def));

  const { group: buildings, anchors } = buildBuildings(era, def);
  buildSigns(era, anchors, buildings);
  group.add(buildings);

  group.add(buildVehicles(era));

  const { mesh, instances } = buildPedestrians(era);
  group.add(mesh);

  // Stash pedestrian data so the controller can advance the crowd each frame.
  group.userData.pedestrians = { mesh, instances };

  return group;
}

/** Advances an era group's pedestrian crowd along the loop path. */
function updatePedestrians(group: THREE.Group, elapsed: number): void {
  const data = group.userData.pedestrians as
    | { mesh: THREE.InstancedMesh; instances: PedestrianInstances }
    | undefined;
  if (!data) return;

  const { mesh, instances } = data;
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3(1, 1, 1);
  const eul = new THREE.Euler();
  const m4 = new THREE.Matrix4();

  for (let i = 0; i < instances.phases.length; i++) {
    const t = instances.phases[i] + instances.speeds[i] * elapsed;
    const angle = sampleRing(t, PEDESTRIAN_RING_R, pos);
    pos.y = 0.7; // capsule centre so feet rest on the slab
    eul.set(0, angle, 0);
    quat.setFromEuler(eul);
    m4.compose(pos, quat, scl);
    mesh.setMatrixAt(i, m4);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

interface FadeState {
  readonly group: THREE.Group;
  elapsed: number;
}

/** Controller returned by {@link createCityBlock}. */
export interface CityBlockController {
  /** Root group mounted in the scene; all era groups are children of this. */
  readonly root: THREE.Group;
  /** The era currently fully visible (null until the first build resolves). */
  getActiveEra: () => Era | null;
  /**
   * Crossfades to the given era: builds the new group, fades it in while the
   * outgoing group fades and slides out, then disposes the outgoing group.
   * No-op if the era is already active.
   */
  setActiveEra: (era: Era) => void;
  /** Advances crowd + crossfade animation. Call once per frame. */
  update: (delta: number) => void;
  /** Cancels the internal tick and disposes every mounted group. */
  dispose: () => void;
}

/**
 * Mounts an era-root group in `scene` and returns a controller. The initial
 * era is shown immediately (no fade). Replaces the original static
 * `createCityBlock(scene)` call site while staying backward compatible.
 */
export function createCityBlock(
  scene: THREE.Scene,
  initialEra: Era = 2025,
): CityBlockController {
  const root = new THREE.Group();
  root.name = 'CityBlockRoot';
  scene.add(root);

  let activeEra: Era | null = null;
  let activeGroup: THREE.Group | null = null;
  let incoming: FadeState | null = null;
  let outgoing: FadeState | null = null;
  let elapsed = 0;

  // Show the initial era instantly.
  const initial = buildEraScene(initialEra);
  root.add(initial);
  activeGroup = initial;
  activeEra = initialEra;

  const setActiveEra = (era: Era): void => {
    if (era === activeEra) return;

    const next = buildEraScene(era);
    // Start fully transparent and offset to the right, then slide+fade in.
    setGroupOpacity(next, 0);
    next.position.x = CROSSFADE_SLIDE;
    root.add(next);
    incoming = { group: next, elapsed: 0 };

    // The previously-active group begins fading out.
    if (activeGroup) {
      outgoing = { group: activeGroup, elapsed: 0 };
    }
    activeGroup = next;
    activeEra = era;
  };

  const update = (delta: number): void => {
    elapsed += delta;

    if (incoming) {
      incoming.elapsed += delta;
      const t = Math.min(1, incoming.elapsed / CROSSFADE_SECONDS);
      const e = easeInOutCubic(t);
      setGroupOpacity(incoming.group, e);
      incoming.group.position.x = lerp(CROSSFADE_SLIDE, 0, e);
      if (t >= 1) {
        setGroupOpacity(incoming.group, 1);
        incoming.group.position.x = 0;
        incoming = null;
      }
    }

    if (outgoing) {
      outgoing.elapsed += delta;
      const t = Math.min(1, outgoing.elapsed / CROSSFADE_SECONDS);
      const e = easeInOutCubic(t);
      setGroupOpacity(outgoing.group, 1 - e);
      outgoing.group.position.x = lerp(0, -CROSSFADE_SLIDE, e);
      if (t >= 1) {
        root.remove(outgoing.group);
        disposeGroup(outgoing.group);
        outgoing = null;
      }
    }

    // Walk the crowds on whichever groups are currently mounted.
    if (activeGroup) updatePedestrians(activeGroup, elapsed);
    if (incoming) updatePedestrians(incoming.group, elapsed);
  };

  // Self-contained tick so the crowd and crossfade animate even before the
  // integration task wires this into the main render loop.
  const clock = new THREE.Clock();
  let rafId = 0;
  const tick = () => {
    rafId = requestAnimationFrame(tick);
    update(Math.min(clock.getDelta(), 0.1));
  };
  tick();

  const dispose = (): void => {
    cancelAnimationFrame(rafId);
    rafId = 0;
    for (const g of [activeGroup, incoming?.group, outgoing?.group]) {
      if (!g) continue;
      root.remove(g);
      disposeGroup(g);
    }
    activeGroup = null;
    incoming = null;
    outgoing = null;
    activeEra = null;
    scene.remove(root);
  };

  return {
    root,
    getActiveEra: () => activeEra,
    setActiveEra,
    update,
    dispose,
  };
}
