// =============================================================================
// City Timelapse -- Era-Distinct Vehicle System (instanced + animated)
//
// Maintains a fixed fleet of vehicles driving a closed-loop road spline. Every
// vehicle body is rendered with THREE.InstancedMesh -- one instanced mesh per
// body-part material per era -- so there is never a per-vehicle Object3D/Mesh
// allocation. Each of the six eras owns a visually distinct vehicle layer
// (silhouette, paint palette, and period detail), and EraState transitions
// crossfade the outgoing layer into the incoming layer over ~1.2s.
//
// Design notes
//   * Allocation-free per frame: all scratch vectors / matrices / quaternions
//     are pre-allocated once and reused. The only "new" calls happen at build
//     time (materials, geometries, the curve) or disposal time.
//   * Constant speed: vehicles advance an arc-length parameter along the
//     Catmull-Rom curve, so world-space speed is constant regardless of
//     curvature. Orientation (steering) aligns the body's +Z axis to the path
//     tangent.
//   * Draw-call economy: parts sharing a material within an era are merged into
//     a single geometry, yielding one InstancedMesh per material. Only the
//     active (and, during a transition, the previous) era layer is rendered.
//
// No external model/texture/audio assets are created here.
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ERA_IDS, type EraId } from '../eras';
import type { EraState } from './EraState';
import type { MaterialSlot } from './assetFactory';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The subset of the procedural asset factory consumed by vehicles. */
export interface VehicleAssetFactory {
  makeMaterial(eraId: EraId, slot: MaterialSlot): THREE.MeshStandardMaterial;
}

/** Handle returned by createVehicleSystem. */
export interface VehicleSystem {
  /** Root group to add to the scene. Contains every era's instanced meshes. */
  readonly group: THREE.Group;
  /** Advance the simulation by dt seconds (clamped internally). */
  update(dt: number): void;
  /** Tear down geometries/materials and unsubscribe from EraState. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/** Number of vehicles maintained on the loop (6-10 range). */
const VEHICLE_COUNT = 8;

/** Constant world-space driving speed, in scene units per second. */
const SPEED = 6.0;

/** Duration of the crossfade between two era layers, in seconds. */
const FADE_SECONDS = 1.2;

/** Forward axis of the authored vehicle geometry (length runs along +Z). */
const FORWARD = new THREE.Vector3(0, 0, 1);

/** Unit scale reused when composing per-instance matrices. */
const UNIT_SCALE = new THREE.Vector3(1, 1, 1);

// ---------------------------------------------------------------------------
// Internal: geometry helpers
// ---------------------------------------------------------------------------

/** A single authored body part: a geometry paired with its material. */
interface VehiclePart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

/** Create a translated axis-aligned box and return it (low-segment for perf). */
function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  g.translate(x, y, z);
  return g;
}

/** Create a wheel (cylinder with its axle along X). */
function wheel(radius: number, thickness: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius, radius, thickness, 10);
  g.rotateZ(Math.PI / 2);
  return g;
}

/** Four wheel positions for a wheelbase of the given half-width/length. */
function wheelPositions(halfW: number, halfL: number): readonly (readonly [number, number])[] {
  return [
    [halfW, halfL],
    [-halfW, halfL],
    [halfW, -halfL],
    [-halfW, -halfL],
  ] as const;
}

// ---------------------------------------------------------------------------
// Internal: per-era palettes & finishes
// ---------------------------------------------------------------------------

/** Body paint PBR finish per era (base color is white; instanceColor tints). */
const BODY_FINISH: Record<EraId, { readonly roughness: number; readonly metalness: number }> = {
  '1945': { roughness: 0.5, metalness: 0.2 },
  '1965': { roughness: 0.35, metalness: 0.3 },
  '1985': { roughness: 0.4, metalness: 0.25 },
  '2005': { roughness: 0.3, metalness: 0.4 },
  '2025': { roughness: 0.15, metalness: 0.5 },
  '2055': { roughness: 0.12, metalness: 0.6 },
};

/** Distinct per-era paint palette; cycled across the instances for variety. */
const BODY_PALETTE: Record<EraId, readonly number[]> = {
  '1945': [0x1a1a1a, 0x2a3a2a, 0x3a2422, 0x22221c],
  '1965': [0x6fc7c0, 0xe87fa8, 0xeae0c8, 0x6fa8dc],
  '1985': [0xb02a2a, 0x8a8a8a, 0x2a2a3a, 0xc0c0c0],
  '2005': [0xa0a8b0, 0x3a5a8a, 0x6a6a6a, 0xb0a898],
  '2025': [0xe8eef0, 0x2a3a4a, 0xc8d8e0, 0x3a4a5a],
  '2055': [0x2a3a4a, 0x1a2a3a, 0x4a3a5a, 0x3a4a4a],
};

/** Per-era set of vehicle materials (independent instances for opacity fade). */
interface EraMats {
  readonly body: THREE.MeshStandardMaterial;
  readonly glass: THREE.MeshStandardMaterial;
  readonly metal: THREE.MeshStandardMaterial;
  readonly accent: THREE.MeshStandardMaterial;
  readonly wheel: THREE.MeshStandardMaterial;
  readonly wood: THREE.MeshStandardMaterial;
}

/** Build a fresh, transparent-ready material set for one era. */
function createEraMaterials(era: EraId, af: VehicleAssetFactory): EraMats {
  const finish = BODY_FINISH[era];
  const body = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: finish.roughness,
    metalness: finish.metalness,
    transparent: true,
    opacity: 1,
  });

  const glass = af.makeMaterial(era, 'wallGlass');
  glass.transparent = true;
  glass.opacity = 1;

  const metal = af.makeMaterial(era, 'streetlight');
  metal.transparent = true;
  metal.opacity = 1;

  const accent = af.makeMaterial(era, 'signNeon');
  accent.transparent = true;
  accent.opacity = 1;

  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    roughness: 0.8,
    metalness: 0.1,
    transparent: true,
    opacity: 1,
  });

  const wood = new THREE.MeshStandardMaterial({
    color: 0x6b4423,
    roughness: 0.85,
    metalness: 0.05,
    transparent: true,
    opacity: 1,
  });

  return { body, glass, metal, accent, wheel: wheelMat, wood };
}

// ---------------------------------------------------------------------------
// Internal: per-era silhouette builders (distinct shape + detail)
// ---------------------------------------------------------------------------

/** 1945 -- tall vintage sedan: wood panelling + running boards + bulb fenders. */
function build1945(m: EraMats): VehiclePart[] {
  const p: VehiclePart[] = [];
  p.push({ geometry: box(1.62, 0.32, 3.8, 0, 0.42, 0), material: m.body });
  p.push({ geometry: box(1.74, 0.5, 3.9, 0, 0.82, 0), material: m.body });
  p.push({ geometry: box(1.5, 0.62, 1.9, 0, 1.3, -0.1), material: m.body });
  // Wood side panelling.
  p.push({ geometry: box(1.76, 0.34, 2.2, 0, 0.78, 0), material: m.wood });
  // Running boards (period detail).
  p.push({ geometry: box(0.16, 0.08, 2.0, 0.86, 0.34, 0), material: m.metal });
  p.push({ geometry: box(0.16, 0.08, 2.0, -0.86, 0.34, 0), material: m.metal });
  // Bulbous fenders over the wheels.
  for (const [x, z] of wheelPositions(0.78, 1.2)) {
    p.push({ geometry: box(0.52, 0.42, 0.95, x, 0.5, z), material: m.body });
  }
  // Glasshouse.
  p.push({ geometry: box(1.42, 0.4, 1.7, 0, 1.32, -0.1), material: m.glass });
  // Wheels.
  for (const [x, z] of wheelPositions(0.82, 1.25)) {
    const g = wheel(0.34, 0.22);
    g.translate(x, 0.34, z);
    p.push({ geometry: g, material: m.wheel });
  }
  return p;
}

/** 1965 -- long low cruiser: prominent tailfins + chrome bumpers. */
function build1965(m: EraMats): VehiclePart[] {
  const p: VehiclePart[] = [];
  p.push({ geometry: box(1.8, 0.5, 4.4, 0, 0.72, 0), material: m.body });
  p.push({ geometry: box(1.62, 0.52, 2.0, 0, 1.16, -0.2), material: m.body });
  // Tailfins (period detail).
  p.push({ geometry: box(0.1, 0.55, 0.7, 0.6, 1.15, -1.9), material: m.metal });
  p.push({ geometry: box(0.1, 0.55, 0.7, -0.6, 1.15, -1.9), material: m.metal });
  // Chrome bumpers.
  p.push({ geometry: box(1.84, 0.18, 0.3, 0, 0.6, 2.15), material: m.metal });
  p.push({ geometry: box(1.84, 0.18, 0.3, 0, 0.6, -2.15), material: m.metal });
  // Glasshouse.
  p.push({ geometry: box(1.52, 0.4, 1.8, 0, 1.18, -0.2), material: m.glass });
  // Wheels.
  for (const [x, z] of wheelPositions(0.84, 1.4)) {
    const g = wheel(0.34, 0.22);
    g.translate(x, 0.34, z);
    p.push({ geometry: g, material: m.wheel });
  }
  return p;
}

/** 1985 -- boxy 80s coupe: square glasshouse + rear spoiler + side skirts. */
function build1985(m: EraMats): VehiclePart[] {
  const p: VehiclePart[] = [];
  p.push({ geometry: box(1.76, 0.6, 4.0, 0, 0.78, 0), material: m.body });
  p.push({ geometry: box(1.66, 0.7, 2.1, 0, 1.4, 0), material: m.body });
  // Rear spoiler on supports.
  p.push({ geometry: box(1.7, 0.08, 0.45, 0, 1.5, -1.85), material: m.body });
  p.push({ geometry: box(0.1, 0.3, 0.1, 0.7, 1.35, -1.85), material: m.body });
  p.push({ geometry: box(0.1, 0.3, 0.1, -0.7, 1.35, -1.85), material: m.body });
  // Lower body kit.
  p.push({ geometry: box(1.82, 0.2, 3.7, 0, 0.42, 0), material: m.body });
  // Square glasshouse.
  p.push({ geometry: box(1.56, 0.55, 1.9, 0, 1.42, 0), material: m.glass });
  // Wheels.
  for (const [x, z] of wheelPositions(0.84, 1.3)) {
    const g = wheel(0.34, 0.22);
    g.translate(x, 0.34, z);
    p.push({ geometry: g, material: m.wheel });
  }
  return p;
}

/** 2005 -- chunky crossover: tall greenhouse + body-kit skirts + roof rails. */
function build2005(m: EraMats): VehiclePart[] {
  const p: VehiclePart[] = [];
  p.push({ geometry: box(1.86, 0.75, 4.1, 0, 0.88, 0), material: m.body });
  p.push({ geometry: box(1.76, 0.72, 2.6, 0, 1.55, 0), material: m.body });
  // Body-kit side skirts (period detail).
  p.push({ geometry: box(1.92, 0.2, 3.8, 0, 0.45, 0), material: m.metal });
  // Roof rails.
  p.push({ geometry: box(0.06, 0.06, 2.4, 0.6, 1.95, 0), material: m.metal });
  p.push({ geometry: box(0.06, 0.06, 2.4, -0.6, 1.95, 0), material: m.metal });
  // Tall greenhouse.
  p.push({ geometry: box(1.66, 0.6, 2.4, 0, 1.57, 0), material: m.glass });
  // Larger wheels.
  for (const [x, z] of wheelPositions(0.88, 1.35)) {
    const g = wheel(0.4, 0.24);
    g.translate(x, 0.4, z);
    p.push({ geometry: g, material: m.wheel });
  }
  return p;
}

/** 2025 -- smooth EV sedan: aero fastback + signature light bars. */
function build2025(m: EraMats): VehiclePart[] {
  const p: VehiclePart[] = [];
  p.push({ geometry: box(1.8, 0.5, 4.3, 0, 0.72, 0), material: m.body });
  p.push({ geometry: box(1.66, 0.5, 2.3, 0, 1.12, -0.1), material: m.body });
  // Flush aero undertray.
  p.push({ geometry: box(1.78, 0.12, 4.2, 0, 0.46, 0), material: m.body });
  // Signature light bars (emissive accent).
  p.push({ geometry: box(1.7, 0.06, 0.06, 0, 0.74, 2.12), material: m.accent });
  p.push({ geometry: box(1.6, 0.06, 0.06, 0, 0.78, -2.12), material: m.accent });
  // Glass canopy.
  p.push({ geometry: box(1.56, 0.4, 2.1, 0, 1.14, -0.1), material: m.glass });
  // Flush wheels.
  for (const [x, z] of wheelPositions(0.86, 1.4)) {
    const g = wheel(0.36, 0.22);
    g.translate(x, 0.36, z);
    p.push({ geometry: g, material: m.wheel });
  }
  return p;
}

/** 2055 -- autonomous hover pod: smooth lifted capsule + underglow, no wheels. */
function build2055(m: EraMats): VehiclePart[] {
  const p: VehiclePart[] = [];
  // Smooth pod body.
  const pod = new THREE.SphereGeometry(1.1, 16, 12);
  pod.scale(0.92, 0.62, 1.95);
  pod.translate(0, 1.15, 0);
  p.push({ geometry: pod, material: m.body });
  // Canopy.
  const canopy = new THREE.SphereGeometry(0.7, 14, 10);
  canopy.scale(0.8, 0.5, 1.1);
  canopy.translate(0, 1.45, -0.1);
  p.push({ geometry: canopy, material: m.glass });
  // Hover underglow disc (period detail).
  const glow = new THREE.CylinderGeometry(0.95, 1.05, 0.12, 20);
  glow.translate(0, 0.5, 0);
  p.push({ geometry: glow, material: m.accent });
  // Sensor strip.
  p.push({ geometry: box(1.5, 0.06, 0.06, 0, 1.0, 2.0), material: m.accent });
  return p;
}

/** Era to silhouette builder lookup. */
const ERA_BUILDERS: Record<EraId, (m: EraMats) => VehiclePart[]> = {
  '1945': build1945,
  '1965': build1965,
  '1985': build1985,
  '2005': build2005,
  '2025': build2025,
  '2055': build2055,
};

// ---------------------------------------------------------------------------
// Internal: era layer (one set of instanced meshes per era)
// ---------------------------------------------------------------------------

/** All instanced meshes + materials for a single era. */
interface EraLayer {
  readonly meshes: THREE.InstancedMesh[];
  /** Every material actually attached to a mesh (for opacity fading). */
  readonly materials: THREE.Material[];
}

/** Build the merged, instanced meshes for one era and tint the body instances. */
function buildEraLayer(era: EraId, af: VehicleAssetFactory): EraLayer {
  const mats = createEraMaterials(era, af);
  const parts = ERA_BUILDERS[era](mats);

  // Group parts by material so each material yields one merged InstancedMesh.
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const part of parts) {
    const list = buckets.get(part.material);
    if (list) {
      list.push(part.geometry);
    } else {
      buckets.set(part.material, [part.geometry]);
    }
  }

  const meshes: THREE.InstancedMesh[] = [];
  let bodyMesh: THREE.InstancedMesh | null = null;

  for (const [material, geometries] of buckets) {
    const merged = mergeGeometries(geometries, false);
    if (!merged) {
      throw new Error('[vehicles] mergeGeometries returned nothing for era "' + era + '"');
    }
    const mesh = new THREE.InstancedMesh(merged, material, VEHICLE_COUNT);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    if (material === mats.body) {
      bodyMesh = mesh;
    }
    meshes.push(mesh);
  }

  // Per-instance paint: cycle the era palette across the fleet.
  if (bodyMesh) {
    const palette = BODY_PALETTE[era];
    const color = new THREE.Color();
    for (let i = 0; i < VEHICLE_COUNT; i += 1) {
      color.setHex(palette[i % palette.length]);
      bodyMesh.setColorAt(i, color);
    }
    if (bodyMesh.instanceColor) {
      bodyMesh.instanceColor.needsUpdate = true;
    }
  }

  return { meshes, materials: Array.from(buckets.keys()) };
}

// ---------------------------------------------------------------------------
// Internal: closed-loop road spline
// ---------------------------------------------------------------------------

/** Build the closed stadium-shaped road loop the fleet drives. */
function buildRoadCurve(): THREE.CatmullRomCurve3 {
  const points = [
    new THREE.Vector3(-30, 0, -18),
    new THREE.Vector3(0, 0, -22),
    new THREE.Vector3(30, 0, -18),
    new THREE.Vector3(34, 0, 0),
    new THREE.Vector3(30, 0, 18),
    new THREE.Vector3(0, 0, 22),
    new THREE.Vector3(-30, 0, 18),
    new THREE.Vector3(-34, 0, 0),
  ];
  return new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
}

// ---------------------------------------------------------------------------
// createVehicleSystem
// ---------------------------------------------------------------------------

/**
 * Create the era-distinct vehicle system.
 *
 * @param eraState     Shared era controller. Era transitions trigger a ~1.2s
 *                     crossfade between the outgoing and incoming era layers.
 * @param assetFactory Procedural asset factory (only makeMaterial is used).
 */
export function createVehicleSystem(
  eraState: EraState,
  assetFactory: VehicleAssetFactory,
): VehicleSystem {
  const group = new THREE.Group();
  group.name = 'vehicles';

  // Build one layer per era and parent every instanced mesh to the group.
  const layers: Record<EraId, EraLayer> = {} as Record<EraId, EraLayer>;
  for (const id of ERA_IDS) {
    const layer = buildEraLayer(id, assetFactory);
    layers[id] = layer;
    for (const mesh of layer.meshes) group.add(mesh);
  }

  // Road path + cached length for constant-speed arc-length travel.
  const curve = buildRoadCurve();
  const totalLength = curve.getLength();
  const spacing = totalLength / VEHICLE_COUNT;

  // Pre-allocated per-frame scratch (never re-created in update).
  const tmpPos = new THREE.Vector3();
  const tmpTan = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpMat = new THREE.Matrix4();
  const hoverMat = new THREE.Matrix4();

  // Per-vehicle arc-length distance along the loop + cached transform.
  const distances = new Float64Array(VEHICLE_COUNT);
  const transforms: THREE.Matrix4[] = [];
  for (let i = 0; i < VEHICLE_COUNT; i += 1) {
    distances[i] = i * spacing;
    transforms.push(new THREE.Matrix4());
  }

  // Crossfade state.
  let activeEra: EraId = eraState.getEraId();
  let prevEra: EraId = activeEra;
  let transitioning = false;
  let transitionT = 0;
  let elapsed = 0;

  // Initial visibility: only the starting era is shown.
  for (const id of ERA_IDS) {
    const isActive = id === activeEra;
    const layer = layers[id];
    for (const mesh of layer.meshes) mesh.visible = isActive;
    for (const mat of layer.materials) mat.opacity = isActive ? 1 : 0;
  }

  // React to era changes by kicking off a fresh crossfade.
  const unsubscribe = eraState.subscribe((update) => {
    if (update.eraId !== activeEra) {
      prevEra = activeEra;
      activeEra = update.eraId;
      transitioning = true;
      transitionT = 0;
    }
  });

  /** Advance positions and recompute cached transforms (allocation-free). */
  function advance(dt: number): void {
    for (let i = 0; i < VEHICLE_COUNT; i += 1) {
      distances[i] += SPEED * dt;
      let u = distances[i] / totalLength;
      u -= Math.floor(u); // wrap into [0, 1)

      curve.getPointAt(u, tmpPos);
      curve.getTangentAt(u, tmpTan);
      tmpTan.normalize();

      tmpQuat.setFromUnitVectors(FORWARD, tmpTan);
      tmpMat.compose(tmpPos, tmpQuat, UNIT_SCALE);
      transforms[i].copy(tmpMat);
    }
  }

  /** Write cached transforms into a layer, with hover bob for 2055. */
  function writeToLayer(id: EraId, layer: EraLayer): void {
    const isHover = id === '2055';
    for (let i = 0; i < VEHICLE_COUNT; i += 1) {
      if (isHover) {
        hoverMat.copy(transforms[i]);
        hoverMat.elements[13] += 0.06 * Math.sin(elapsed * 2.0 + i * 0.9);
        for (const mesh of layer.meshes) mesh.setMatrixAt(i, hoverMat);
      } else {
        for (const mesh of layer.meshes) mesh.setMatrixAt(i, transforms[i]);
      }
    }
    for (const mesh of layer.meshes) mesh.instanceMatrix.needsUpdate = true;
  }

  function update(dt: number): void {
    const step = Math.min(Math.max(dt, 0), 0.1);
    elapsed += step;

    advance(step);

    if (transitioning) {
      transitionT += step / FADE_SECONDS;
      if (transitionT >= 1) {
        transitionT = 1;
        transitioning = false;
      }
    }

    for (const id of ERA_IDS) {
      let opacity = 0;
      if (id === activeEra) {
        opacity = transitioning ? transitionT : 1;
      } else if (transitioning && id === prevEra) {
        opacity = 1 - transitionT;
      }

      const layer = layers[id];
      const visible = opacity > 0;

      for (const mesh of layer.meshes) mesh.visible = visible;
      for (const mat of layer.materials) mat.opacity = opacity;

      if (visible) {
        writeToLayer(id, layer);
      }
    }
  }

  function dispose(): void {
    unsubscribe();
    for (const id of ERA_IDS) {
      const layer = layers[id];
      for (const mesh of layer.meshes) {
        group.remove(mesh);
        mesh.geometry.dispose();
      }
      for (const mat of layer.materials) mat.dispose();
    }
  }

  return { group, update, dispose };
}
