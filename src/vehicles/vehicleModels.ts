/**
 * VehicleModels — era-correct parametric vehicle geometry + shared materials.
 *
 * Builds stylized vehicle silhouettes from simple box geometry, with per-era
 * proportions, colors, and PBR properties that read as era-distinct at a glance:
 *
 *   1945 — tall, rounded fenders, vintage sedans/trucks/streetcars (matte)
 *   1965 — low & long muscle cars, finned wagons, microbuses (chrome, bright)
 *   1985 — angular/boxy sedans, hatchbacks, early minivans (muted two-tone)
 *   2005 — smoother sedans, tall SUVs, box trucks (silver/white metallic)
 *   2025 — very smooth EVs, crossovers, compacts (glossy white/silver)
 *   2055 — autonomous pods, sleek hover-cabs (high-metalness, cyan glass)
 *
 * Geometry is cached per archetype (one set shared by every instance of that
 * archetype) and materials are cached per **era** + color/PBR tuple, so:
 *   - the capped population reuses a handful of GPU resources, and
 *   - the whole population of one era can be opacity-faded together during an
 *     era cross-fade via {@link setEraVehicleOpacity}.
 *
 * The archetype *names* are sourced from `DEFAULT_ERA_CONFIG[era].vehicles`
 * so era identity is never hardcoded here — this module only supplies the
 * parametric definitions.
 */
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
} from 'three';
import { DEFAULT_ERA_CONFIG, type EraKey } from '../eras/eraConfig.js';

// ---------------------------------------------------------------------------
// Vehicle archetype descriptor
// ---------------------------------------------------------------------------

/**
 * Parametric description of one vehicle silhouette. All dimensions are in world
 * units (meters). The builder turns a descriptor into a {@link Group} of box
 * meshes; the descriptor alone encodes the era-correct look.
 */
export interface VehicleDescriptor {
  /** Archetype name, matching an entry in `EraConfig.vehicles.vehicles`. */
  name: string;
  /** Overall length, front-to-back (local X axis). */
  length: number;
  /** Overall width, side-to-side (local Z axis). */
  width: number;
  /** Lower body section height (local Y). */
  bodyHeight: number;
  /** Cabin/greenhouse length (X). */
  cabinLength: number;
  /** Cabin/greenhouse height (Y). */
  cabinHeight: number;
  /** Cabin/greenhouse width (Z). */
  cabinWidth: number;
  /** Cabin center offset along length (negative = toward rear). */
  cabinXOffset: number;
  /** Wheel diameter. */
  wheelDiameter: number;
  /** Whether to render protruding vintage fenders over the wheels. */
  hasFenders: boolean;
  /** Body-color palette for this archetype. */
  colors: string[];
  /** Glass / windshield color. */
  glassColor: string;
  /** PBR roughness. */
  roughness: number;
  /** PBR metalness. */
  metalness: number;
}

// ---------------------------------------------------------------------------
// Prototype catalog — one entry per eraConfig vehicle name
// ---------------------------------------------------------------------------

const FORTIES_COLORS = ['#2a3d2a', '#3a1a1a', '#1a1a1a', '#d4c5a0', '#4a4030'];
const SIXTIES_COLORS = ['#c0392b', '#1abc9c', '#f1c40f', '#2c2c2c', '#d4c5a0'];
const EIGHTIES_COLORS = ['#2c3e50', '#7f8c8d', '#8e2c4a', '#bdc3c7', '#2c502c'];
const NAUGHTIES_COLORS = ['#bdc3c7', '#ecf0f1', '#2c3e50', '#2980b9', '#1a1a1a'];
const TWENTIES_COLORS = ['#ecf0f1', '#bdc3c7', '#3498db', '#2ecc71', '#1a1a1a'];
const FUTURE_COLORS = ['#ecf0f1', '#88ccff', '#c0c0c0', '#2c3e50', '#1a2a3a'];

/**
 * The full prototype catalog. Each key matches a vehicle name string in
 * `DEFAULT_ERA_CONFIG[era].vehicles.vehicles`; if a name is missing at runtime a
 * generic sedan fallback is used so the simulation never crashes on config drift.
 */
export const VEHICLE_PROTOTYPES: Record<string, VehicleDescriptor> = {
  // ---- 1945: rounded fenders, vintage sedans/trucks/streetcars -------------
  sedan_40s: {
    name: 'sedan_40s', length: 4.2, width: 1.7, bodyHeight: 0.7,
    cabinLength: 1.8, cabinHeight: 0.8, cabinWidth: 1.5, cabinXOffset: -0.2,
    wheelDiameter: 0.55, hasFenders: true,
    colors: FORTIES_COLORS, glassColor: '#2a2a30', roughness: 0.7, metalness: 0.15,
  },
  truck_utility: {
    name: 'truck_utility', length: 4.6, width: 1.8, bodyHeight: 0.8,
    cabinLength: 1.4, cabinHeight: 0.9, cabinWidth: 1.6, cabinXOffset: 0.8,
    wheelDiameter: 0.65, hasFenders: true,
    colors: FORTIES_COLORS, glassColor: '#2a2a30', roughness: 0.75, metalness: 0.1,
  },
  streetcar: {
    name: 'streetcar', length: 5.2, width: 1.8, bodyHeight: 1.2,
    cabinLength: 4.4, cabinHeight: 0.8, cabinWidth: 1.7, cabinXOffset: 0,
    wheelDiameter: 0.5, hasFenders: false,
    colors: ['#c8a040', '#8a6020', '#c04030'], glassColor: '#3a3a40',
    roughness: 0.6, metalness: 0.25,
  },

  // ---- 1965: muscle cars, finned wagons, microbuses ------------------------
  muscle_car: {
    name: 'muscle_car', length: 4.9, width: 1.9, bodyHeight: 0.6,
    cabinLength: 1.6, cabinHeight: 0.6, cabinWidth: 1.7, cabinXOffset: -0.3,
    wheelDiameter: 0.6, hasFenders: true,
    colors: SIXTIES_COLORS, glassColor: '#1a1a25', roughness: 0.3, metalness: 0.5,
  },
  station_wagon: {
    name: 'station_wagon', length: 4.7, width: 1.8, bodyHeight: 0.65,
    cabinLength: 3.0, cabinHeight: 0.7, cabinWidth: 1.65, cabinXOffset: -0.2,
    wheelDiameter: 0.58, hasFenders: true,
    colors: SIXTIES_COLORS, glassColor: '#1a1a25', roughness: 0.35, metalness: 0.45,
  },
  delivery_van: {
    name: 'delivery_van', length: 4.5, width: 1.8, bodyHeight: 1.4,
    cabinLength: 3.6, cabinHeight: 0.5, cabinWidth: 1.7, cabinXOffset: 0.3,
    wheelDiameter: 0.55, hasFenders: false,
    colors: ['#ecf0f1', '#c8c8c8', '#d4a040'], glassColor: '#2a2a30',
    roughness: 0.5, metalness: 0.2,
  },

  // ---- 1985: boxy sedans, hatchbacks, early minivans -----------------------
  boxy_sedan: {
    name: 'boxy_sedan', length: 4.3, width: 1.7, bodyHeight: 0.65,
    cabinLength: 2.0, cabinHeight: 0.75, cabinWidth: 1.6, cabinXOffset: -0.1,
    wheelDiameter: 0.55, hasFenders: false,
    colors: EIGHTIES_COLORS, glassColor: '#1a1a22', roughness: 0.4, metalness: 0.3,
  },
  hatchback: {
    name: 'hatchback', length: 3.8, width: 1.65, bodyHeight: 0.65,
    cabinLength: 2.2, cabinHeight: 0.7, cabinWidth: 1.55, cabinXOffset: -0.2,
    wheelDiameter: 0.52, hasFenders: false,
    colors: EIGHTIES_COLORS, glassColor: '#1a1a22', roughness: 0.4, metalness: 0.3,
  },
  panel_van: {
    name: 'panel_van', length: 4.5, width: 1.8, bodyHeight: 1.3,
    cabinLength: 3.6, cabinHeight: 0.5, cabinWidth: 1.7, cabinXOffset: 0.2,
    wheelDiameter: 0.55, hasFenders: false,
    colors: ['#ecf0f1', '#7f8c8d', '#2c3e50'], glassColor: '#2a2a30',
    roughness: 0.45, metalness: 0.25,
  },

  // ---- 2005: SUVs, sedans, compacts ----------------------------------------
  modern_sedan: {
    name: 'modern_sedan', length: 4.5, width: 1.8, bodyHeight: 0.6,
    cabinLength: 2.0, cabinHeight: 0.65, cabinWidth: 1.65, cabinXOffset: -0.1,
    wheelDiameter: 0.56, hasFenders: false,
    colors: NAUGHTIES_COLORS, glassColor: '#15151a', roughness: 0.25, metalness: 0.55,
  },
  suv: {
    name: 'suv', length: 4.6, width: 1.9, bodyHeight: 0.95,
    cabinLength: 2.4, cabinHeight: 0.7, cabinWidth: 1.75, cabinXOffset: -0.1,
    wheelDiameter: 0.62, hasFenders: false,
    colors: NAUGHTIES_COLORS, glassColor: '#15151a', roughness: 0.25, metalness: 0.5,
  },
  delivery_box_truck: {
    name: 'delivery_box_truck', length: 5.0, width: 2.0, bodyHeight: 1.8,
    cabinLength: 1.3, cabinHeight: 0.6, cabinWidth: 1.8, cabinXOffset: 1.2,
    wheelDiameter: 0.65, hasFenders: false,
    colors: ['#ecf0f1', '#bdc3c7', '#f39c12'], glassColor: '#1a1a22',
    roughness: 0.4, metalness: 0.3,
  },

  // ---- 2025: EVs, crossovers, compacts/rideshare ---------------------------
  ev_sedan: {
    name: 'ev_sedan', length: 4.6, width: 1.9, bodyHeight: 0.55,
    cabinLength: 2.4, cabinHeight: 0.6, cabinWidth: 1.7, cabinXOffset: -0.05,
    wheelDiameter: 0.58, hasFenders: false,
    colors: TWENTIES_COLORS, glassColor: '#101018', roughness: 0.15, metalness: 0.6,
  },
  hybrid_suv: {
    name: 'hybrid_suv', length: 4.6, width: 1.9, bodyHeight: 0.85,
    cabinLength: 2.6, cabinHeight: 0.65, cabinWidth: 1.75, cabinXOffset: -0.05,
    wheelDiameter: 0.6, hasFenders: false,
    colors: TWENTIES_COLORS, glassColor: '#101018', roughness: 0.15, metalness: 0.55,
  },
  e_scooter: {
    // Treated as a compact micro-EV so it stays in the driving lanes.
    name: 'e_scooter', length: 3.2, width: 1.5, bodyHeight: 0.7,
    cabinLength: 1.6, cabinHeight: 0.6, cabinWidth: 1.35, cabinXOffset: -0.1,
    wheelDiameter: 0.5, hasFenders: false,
    colors: TWENTIES_COLORS, glassColor: '#101018', roughness: 0.2, metalness: 0.5,
  },

  // ---- 2055: autonomous pods, sleek EVs/hover-cabs -------------------------
  autonomous_pod: {
    name: 'autonomous_pod', length: 3.6, width: 1.9, bodyHeight: 0.9,
    cabinLength: 2.8, cabinHeight: 0.7, cabinWidth: 1.8, cabinXOffset: 0,
    wheelDiameter: 0.45, hasFenders: false,
    colors: FUTURE_COLORS, glassColor: '#0a1a2a', roughness: 0.1, metalness: 0.7,
  },
  eVTOL_drone: {
    // Ground-going autonomous drone cab.
    name: 'eVTOL_drone', length: 4.0, width: 1.9, bodyHeight: 0.7,
    cabinLength: 3.2, cabinHeight: 0.6, cabinWidth: 1.8, cabinXOffset: 0,
    wheelDiameter: 0.42, hasFenders: false,
    colors: ['#1a1a2a', '#c0c0c0', '#00ccff'], glassColor: '#0a1a2a',
    roughness: 0.08, metalness: 0.8,
  },
  maglev_cab: {
    name: 'maglev_cab', length: 4.2, width: 1.9, bodyHeight: 0.6,
    cabinLength: 3.0, cabinHeight: 0.65, cabinWidth: 1.8, cabinXOffset: -0.1,
    wheelDiameter: 0.4, hasFenders: false,
    colors: FUTURE_COLORS, glassColor: '#0a1a2a', roughness: 0.1, metalness: 0.75,
  },
};

/** Generic fallback if an eraConfig vehicle name has no prototype. */
const FALLBACK_DESCRIPTOR: VehicleDescriptor = VEHICLE_PROTOTYPES.modern_sedan;

/**
 * Return the descriptors for every archetype an era is configured to show, read
 * from `DEFAULT_ERA_CONFIG` so era identity stays centralized.
 */
export function getEraVehicleDescriptors(era: EraKey): VehicleDescriptor[] {
  const names = DEFAULT_ERA_CONFIG[era].vehicles.vehicles;
  const descs = names.map((n) => VEHICLE_PROTOTYPES[n] ?? FALLBACK_DESCRIPTOR);
  return descs.length > 0 ? descs : [FALLBACK_DESCRIPTOR];
}

// ---------------------------------------------------------------------------
// Cached geometry (one set per archetype, shared by every instance)
// ---------------------------------------------------------------------------

interface VehicleGeometry {
  body: BufferGeometry;
  cabin: BufferGeometry;
  wheel: BufferGeometry;
  fender: BufferGeometry | null;
}

const geometryCache = new Map<string, VehicleGeometry>();

/** Build (or fetch cached) the box-geometry set for one archetype. */
function getGeometry(desc: VehicleDescriptor): VehicleGeometry {
  const cached = geometryCache.get(desc.name);
  if (cached) return cached;

  const body = new BoxGeometry(desc.length, desc.bodyHeight, desc.width);
  const cabin = new BoxGeometry(desc.cabinLength, desc.cabinHeight, desc.cabinWidth);
  // Wheel: slightly flattened box (longer in travel dir, thin across).
  const wd = desc.wheelDiameter;
  const wheel = new BoxGeometry(wd * 0.7, wd, wd * 0.42);

  let fender: BufferGeometry | null = null;
  if (desc.hasFenders) {
    fender = new BoxGeometry(wd * 1.5, wd * 1.25, desc.width * 0.22);
  }

  const geo: VehicleGeometry = { body, cabin, wheel, fender };
  geometryCache.set(desc.name, geo);
  return geo;
}

// ---------------------------------------------------------------------------
// Cached materials — keyed per ERA so a whole population can fade together
// ---------------------------------------------------------------------------

/**
 * Per-era material registries. Within an era, vehicles sharing the same body
 * color/PBR reuse one material; glass and tyres are one material per era. This
 * honors "shared materials" (within an era) while letting
 * {@link setEraVehicleOpacity} fade the entire era population as one unit during
 * a cross-fade.
 */
const bodyMaterialsByEra = new Map<EraKey, Map<string, MeshStandardMaterial>>();
const glassMaterialsByEra = new Map<EraKey, MeshStandardMaterial>();
const wheelMaterialsByEra = new Map<EraKey, MeshStandardMaterial>();

/** Shared body material for an era, cached by color + PBR tuple. */
function getBodyMaterial(
  era: EraKey,
  color: string,
  roughness: number,
  metalness: number,
): MeshStandardMaterial {
  let bucket = bodyMaterialsByEra.get(era);
  if (!bucket) {
    bucket = new Map();
    bodyMaterialsByEra.set(era, bucket);
  }
  const key = `${color}|${roughness.toFixed(2)}|${metalness.toFixed(2)}`;
  let mat = bucket.get(key);
  if (!mat) {
    mat = new MeshStandardMaterial({ color, roughness, metalness });
    bucket.set(key, mat);
  }
  return mat;
}

/** Shared dark glass material for an era. */
function getGlassMaterial(era: EraKey, color: string): MeshStandardMaterial {
  let mat = glassMaterialsByEra.get(era);
  if (!mat) {
    mat = new MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.4 });
    glassMaterialsByEra.set(era, mat);
  }
  return mat;
}

/** Shared dark wheel/tyre material for an era. */
function getWheelMaterial(era: EraKey): MeshStandardMaterial {
  let mat = wheelMaterialsByEra.get(era);
  if (!mat) {
    mat = new MeshStandardMaterial({ color: '#15151a', roughness: 0.85, metalness: 0.1 });
    wheelMaterialsByEra.set(era, mat);
  }
  return mat;
}

/**
 * Set the render opacity of every material belonging to `era`'s population.
 * Used by the VehicleSystem during an era cross-fade to fade the outgoing era
 * out and the incoming era in. Opaque (opacity 1) materials are marked
 * non-transparent for correct depth sorting.
 */
export function setEraVehicleOpacity(era: EraKey, opacity: number): void {
  const o = Math.max(0, Math.min(1, opacity));
  const transparent = o < 1;

  const bodies = bodyMaterialsByEra.get(era);
  if (bodies) {
    for (const mat of bodies.values()) {
      mat.transparent = transparent;
      mat.opacity = o;
      mat.needsUpdate = true;
    }
  }
  const glass = glassMaterialsByEra.get(era);
  if (glass) {
    glass.transparent = transparent;
    glass.opacity = o;
    glass.needsUpdate = true;
  }
  const wheel = wheelMaterialsByEra.get(era);
  if (wheel) {
    wheel.transparent = transparent;
    wheel.opacity = o;
    wheel.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Vehicle builder
// ---------------------------------------------------------------------------

/**
 * Build one vehicle {@link Group} from a descriptor. Geometry and materials are
 * shared/cached per era, so this is a lightweight assembly of cached parts —
 * safe to call for every vehicle in the capped population.
 *
 * The vehicle is built facing **+X** (length along X, width along Z, height
 * along Y), sitting on the ground plane (y = 0), with its origin at the
 * geometric center. The caller positions/rotates it so +X points along the
 * travel heading.
 *
 * @param desc        archetype descriptor
 * @param colorIndex  index into `desc.colors` (varies per vehicle for variety)
 * @param era         era key — scopes the shared material cache so a whole era
 *                    population fades together during a cross-fade
 */
export function buildVehicle(desc: VehicleDescriptor, colorIndex: number, era: EraKey): Group {
  const geo = getGeometry(desc);
  const group = new Group();
  group.name = `vehicle-${desc.name}`;

  const color = desc.colors[colorIndex % desc.colors.length];
  const bodyMat = getBodyMaterial(era, color, desc.roughness, desc.metalness);
  const glassMat = getGlassMaterial(era, desc.glassColor);
  const wheelMat = getWheelMaterial(era);

  const groundY = desc.wheelDiameter / 2;
  const bodyCenterY = groundY + desc.bodyHeight / 2;

  // Body
  const bodyMesh = new Mesh(geo.body, bodyMat);
  bodyMesh.position.y = bodyCenterY;
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  // Cabin / greenhouse (glass)
  const cabinMesh = new Mesh(geo.cabin, glassMat);
  cabinMesh.position.set(
    desc.cabinXOffset,
    groundY + desc.bodyHeight + desc.cabinHeight / 2,
    0,
  );
  cabinMesh.castShadow = true;
  group.add(cabinMesh);

  // Four wheels at the axles
  const axleX = desc.length * 0.32;
  const wheelZ = desc.width / 2 - desc.wheelDiameter * 0.12;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const w = new Mesh(geo.wheel, wheelMat);
      w.position.set(sx * axleX, groundY, sz * wheelZ);
      group.add(w);
    }
  }

  // Vintage fenders (1945 / some 1965)
  if (geo.fender) {
    const fenderY = groundY + desc.wheelDiameter * 0.25;
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        const f = new Mesh(geo.fender, bodyMat);
        f.position.set(sx * axleX, fenderY, sz * (desc.width / 2 + desc.width * 0.06));
        f.castShadow = true;
        group.add(f);
      }
    }
  }

  return group;
}

// ---------------------------------------------------------------------------
// Resource disposal
// ---------------------------------------------------------------------------

/**
 * Dispose every cached geometry and material. Call when the vehicle system is
 * torn down (not on every era transition — era materials are retained so the
 * user can flip back without rebuilding).
 */
export function disposeAllVehicleResources(): void {
  for (const geo of geometryCache.values()) {
    geo.body.dispose();
    geo.cabin.dispose();
    geo.wheel.dispose();
    geo.fender?.dispose();
  }
  geometryCache.clear();

  for (const bucket of bodyMaterialsByEra.values()) {
    for (const mat of bucket.values()) {
      mat.dispose();
    }
  }
  bodyMaterialsByEra.clear();

  for (const mat of glassMaterialsByEra.values()) {
    mat.dispose();
  }
  glassMaterialsByEra.clear();

  for (const mat of wheelMaterialsByEra.values()) {
    mat.dispose();
  }
  wheelMaterialsByEra.clear();
}
