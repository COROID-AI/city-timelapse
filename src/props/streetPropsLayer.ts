/**
 * streetPropsLayer.ts — Era-driven street furniture and props.
 *
 * Owns the street-level detail of the city block: street lamps, trees,
 * hydrants, benches, trash cans, parking meters, newspaper stands (kiosks),
 * phone booths and EV chargers. Building facades and signage belong to the
 * block-structures task; this layer is an independent SceneRuntime layer that
 * reads the shared `blockLayout` sidewalk offsets and the five `eraSystem`
 * definitions read-only (constraint: never modifies src/core or src/eras).
 *
 * Placement contract (acceptance criteria):
 *  - Every prop stands on a `blockLayout` sidewalk band. The sidewalk is a
 *    3 m ring: north z∈[50,53], south z∈[-53,-50], east x∈[60,63],
 *    west x∈[-63,-60]. Props are centered on the band center line with corner
 *    clearance so their standing footprint AND their full mesh world-AABB stay
 *    inside exactly one band.
 *  - Because crosswalks are laid out entirely inside the road band (they
 *    start at the sidewalk outer edge), a prop fully inside a sidewalk band
 *    can never intersect a road lane or a crosswalk. The tests verify both
 *    the stored footprint and the actual geometry AABB against ROAD and
 *    CROSSWALK rects to prove it.
 *
 * Era prop composition:
 *  - Lamps: incandescent (1945) -> mercury (1965) -> sodium-vapor (1985) ->
 *    early LED (2005) -> LED (2025). Lamp head geometry and light color come
 *    from the era definition.
 *  - Trees: era-appropriate maturity (young / established / mature).
 *  - Hydrants, benches, trash cans: every era.
 *  - Parking meters: 1965 and later.
 *  - Newspaper stands (kiosks): 1945-1985.
 *  - Phone booths: only 1965 and 1985.
 *  - EV chargers: only 2025.
 *
 * API / lifecycle:
 *  - `attach(group)`      — add the layer root scene graph to a host group.
 *  - `applyEra(eraId, progress = 1)` — swap prop composition. Props are
 *    discrete objects, so a mid-transition call (progress < 1) defers the
 *    swap and records a pending era; the swap commits when progress reaches 1
 *    (the transition settled). Hidden era props are retained and restored on
 *    return, per the "hide or remove and restore" requirement.
 *  - `dispose()`          — remove the root, release every geometry/material,
 *    and mark the layer inert.
 *  - SceneLayer protocol (`createRoot` / `update` / `dispose`) lets the layer
 *    register directly with the headless SceneRuntime.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { SIDEWALK, type Rect } from '../core/blockLayout';
import type { FrameState, SceneLayer } from '../core/sceneRuntime';
import { ERAS, isEraId, type EraId } from '../eras/eraSystem';

/* ------------------------------------------------------------------ *
 * Public types
 * ------------------------------------------------------------------ */

/** One of the four sidewalk bands around the block. */
export type SideId = 'north' | 'east' | 'south' | 'west';

/** Street prop categories owned by this layer. */
export type PropKind =
  | 'lamp'
  | 'tree'
  | 'hydrant'
  | 'bench'
  | 'trash'
  | 'parking-meter'
  | 'newspaper-stand'
  | 'phone-booth'
  | 'ev-charger';

/** Street-lamp technologies, one per era (1945 -> 2025). */
export type LampVariant = 'incandescent' | 'mercury' | 'sodium-vapor' | 'early-led' | 'led';

/** Era-appropriate street tree maturity, applied as canopy scale. */
export type TreeMaturity = 'young' | 'established' | 'mature';

/** Axis-aligned ground rectangle (world x/z, meters, y ignored). */
export interface GroundRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** Snapshot of the era selection state machine inside the layer. */
export interface StreetPropsLayerState {
  /** The era whose props are currently visible. */
  readonly activeEra: EraId;
  /** Era waiting for a settled transition (progress 1); null when idle. */
  readonly pendingEra: EraId | null;
}

/** Per-era prop inventory: lamp technology, tree maturity and kind counts. */
export interface EraPropInventory {
  readonly eraId: EraId;
  readonly lampVariant: LampVariant;
  readonly treeMaturity: TreeMaturity;
  /** Number of prop instances per kind for the era (0 when absent). */
  readonly counts: Readonly<Record<PropKind, number>>;
}

/* ------------------------------------------------------------------ *
 * Era spec + placement data
 * ------------------------------------------------------------------ */

/** Prop kinds present in every era. */
const ALWAYS_KINDS: readonly PropKind[] = ['lamp', 'tree', 'hydrant', 'bench', 'trash'];

/** All prop kinds in stable order (used by inventory + diagnostics). */
export const PROP_KINDS: readonly PropKind[] = [
  'lamp',
  'tree',
  'hydrant',
  'bench',
  'trash',
  'parking-meter',
  'newspaper-stand',
  'phone-booth',
  'ev-charger',
];

/** Per-era era-specific detail: lamp technology and tree maturity. */
const ERA_PROP_SPECS: Readonly<Record<EraId, { lamp: LampVariant; tree: TreeMaturity }>> = {
  1945: { lamp: 'incandescent', tree: 'mature' },
  1965: { lamp: 'mercury', tree: 'mature' },
  1985: { lamp: 'sodium-vapor', tree: 'established' },
  2005: { lamp: 'early-led', tree: 'established' },
  2025: { lamp: 'led', tree: 'young' },
};

/**
 * Optional kinds per era:
 *  - parking meters from 1965; newspaper stands 1945-1985;
 *  - phone booths only 1965/1985; EV chargers only 2025.
 */
function optionalKindsFor(eraId: EraId): readonly PropKind[] {
  const kinds: PropKind[] = [];
  if (eraId !== 1945) kinds.push('parking-meter');
  if (eraId === 1945 || eraId === 1965 || eraId === 1985) kinds.push('newspaper-stand');
  if (eraId === 1965 || eraId === 1985) kinds.push('phone-booth');
  if (eraId === 2025) kinds.push('ev-charger');
  return kinds;
}

/** Prop kinds that exist for an era (always kinds + optional kinds). */
function presentKinds(eraId: EraId): readonly PropKind[] {
  return [...ALWAYS_KINDS, ...optionalKindsFor(eraId)];
}

/** World footprint half-extents (meters) of a prop, aligned to its side. */
const PROP_BASE_HALF: Readonly<Record<PropKind, { along: number; across: number }>> = {
  lamp: { along: 0.6, across: 0.6 },
  tree: { along: 0.7, across: 0.7 },
  hydrant: { along: 0.42, across: 0.42 },
  bench: { along: 1.05, across: 0.42 },
  trash: { along: 0.45, across: 0.45 },
  'parking-meter': { along: 0.3, across: 0.3 },
  'newspaper-stand': { along: 0.95, across: 0.5 },
  'phone-booth': { along: 1.0, across: 0.85 },
  'ev-charger': { along: 0.5, across: 0.42 },
};

const SIDEWALK_BY_SIDE: Readonly<Record<SideId, Rect>> = {
  north: SIDEWALK.north,
  east: SIDEWALK.east,
  south: SIDEWALK.south,
  west: SIDEWALK.west,
};

/** Sidewalk band rectangles keyed by side order for station iteration. */
const SIDE_ORDER: readonly SideId[] = ['north', 'east', 'south', 'west'];

/**
 * Station definitions per sidewalk side. `along` is the position measured
 * from the band start along its length axis (x for north/south, z for
 * east/west); `alongMin/alongMax` bound the corner-clear reachable range
 * (kept away from the four crosswalk-adjacent corner squares). `across` is
 * the band center line coordinate.
 */
interface SideStations {
  readonly side: SideId;
  readonly alongMin: number;
  readonly alongMax: number;
  readonly across: number;
  readonly lamp: readonly number[];
  readonly tree: readonly number[];
  readonly hydrant: readonly number[];
  readonly bench: readonly number[];
  readonly trash: readonly number[];
  readonly 'parking-meter': readonly number[];
  readonly 'newspaper-stand': readonly number[];
  readonly 'phone-booth': readonly number[];
  readonly 'ev-charger': readonly number[];
}

const NE_SOUTH_CENTER = (SIDEWALK.north.minZ + SIDEWALK.north.maxZ) / 2; // z = 51.5
const S_SOUTH_CENTER = (SIDEWALK.south.minZ + SIDEWALK.south.maxZ) / 2; // z = -51.5
const EAST_CENTER = (SIDEWALK.east.minX + SIDEWALK.east.maxX) / 2; // x = 61.5
const WEST_CENTER = (SIDEWALK.west.minX + SIDEWALK.west.maxX) / 2; // x = -61.5

const SIDE_STATIONS: Readonly<Record<SideId, SideStations>> = {
  north: {
    side: 'north',
    alongMin: -58,
    alongMax: 58,
    across: NE_SOUTH_CENTER,
    lamp: [-42, -6, 30],
    tree: [-54, -22, 10, 46],
    hydrant: [-50, 50],
    bench: [-16, 14],
    trash: [-32, 36],
    'parking-meter': [-38, 2, 38],
    'newspaper-stand': [24],
    'phone-booth': [-10],
    'ev-charger': [-26, 26],
  },
  east: {
    side: 'east',
    alongMin: -45,
    alongMax: 45,
    across: EAST_CENTER,
    lamp: [-30, 8],
    tree: [-42, -14, 34],
    hydrant: [-40, 40],
    bench: [-22, 22],
    trash: [-6, 30],
    'parking-meter': [-34, 2, 38],
    'newspaper-stand': [18],
    'phone-booth': [-18],
    'ev-charger': [-28, 28],
  },
  south: {
    side: 'south',
    alongMin: -58,
    alongMax: 58,
    across: S_SOUTH_CENTER,
    lamp: [-42, -6, 30],
    tree: [-54, -22, 10, 46],
    hydrant: [-50, 50],
    bench: [-16, 14],
    trash: [-32, 36],
    'parking-meter': [-38, 2, 38],
    'newspaper-stand': [24],
    'phone-booth': [-10],
    'ev-charger': [-26, 26],
  },
  west: {
    side: 'west',
    alongMin: -45,
    alongMax: 45,
    across: WEST_CENTER,
    lamp: [-30, 8],
    tree: [-42, -14, 34],
    hydrant: [-40, 40],
    bench: [-22, 22],
    trash: [-6, 30],
    'parking-meter': [-34, 2, 38],
    'newspaper-stand': [18],
    'phone-booth': [-18],
    'ev-charger': [-28, 28],
  },
};

/** Yaw aligning a prop's local +z "front" toward the street for each side. */
function sideYaw(side: SideId): number {
  switch (side) {
    case 'north':
      return 0; // +z is the road
    case 'east':
      return Math.PI / 2; // +x is the road
    case 'south':
      return Math.PI; // -z is the road
    case 'west':
      return -Math.PI / 2; // -x is the road
  }
}

/** World x/z for a station `along` a side's sidewalk band center line. */
function stationWorld(side: SideId, along: number): { x: number; z: number } {
  const band = SIDEWALK_BY_SIDE[side];
  if (side === 'north' || side === 'south') {
    return { x: along, z: (band.minZ + band.maxZ) / 2 };
  }
  return { x: (band.minX + band.maxX) / 2, z: along };
}

/** Standing footprint (ground rect) of a prop for placement verification. */
function footprintFor(side: SideId, along: number, kind: PropKind): GroundRect {
  const half = PROP_BASE_HALF[kind];
  const band = SIDEWALK_BY_SIDE[side];
  if (side === 'north' || side === 'south') {
    const across = (band.minZ + band.maxZ) / 2;
    return {
      minX: along - half.along,
      maxX: along + half.along,
      minZ: across - half.across,
      maxZ: across + half.across,
    };
  }
  const across = (band.minX + band.maxX) / 2;
  return {
    minX: across - half.across,
    maxX: across + half.across,
    minZ: along - half.along,
    maxZ: along + half.along,
  };
}

/** Era palette light color '#rrggbb' -> 0xrrggbb for emissive lamp fixtures. */
function hexToNumber(value: string): number {
  return parseInt(value.replace('#', ''), 16);
}

/* ------------------------------------------------------------------ *
 * Inventory query (single source used by tests and integration)
 * ------------------------------------------------------------------ */

/**
 * Returns the era's prop inventory: lamp technology, tree maturity and the
 * exact per-kind instance counts the layer builds (0 for absent kinds).
 */
export function getEraPropInventory(eraId: EraId): EraPropInventory {
  if (!isEraId(eraId)) {
    throw new Error(`getEraPropInventory: unknown era ${String(eraId)}; known eras: 1945, 1965, 1985, 2005, 2025`);
  }
  const counts = {} as Record<PropKind, number>;
  for (const kind of PROP_KINDS) counts[kind] = 0;
  for (const kind of presentKinds(eraId)) {
    let total = 0;
    for (const side of SIDE_ORDER) total += SIDE_STATIONS[side][kind].length;
    counts[kind] = total;
  }
  const spec = ERA_PROP_SPECS[eraId];
  return { eraId, lampVariant: spec.lamp, treeMaturity: spec.tree, counts };
}

/* ------------------------------------------------------------------ *
 * Streets props layer
 * ------------------------------------------------------------------ */

/** Era-flavored colors for props that exist in every era. */
const TREE_LEAF_COLORS: Readonly<Record<EraId, number>> = {
  1945: 0x3f5a3a,
  1965: 0x4a6b3f,
  1985: 0x2f5a4c,
  2005: 0x55804d,
  2025: 0x6f9a5a,
};

const BENCH_COLORS: Readonly<Record<EraId, { seat: number; frame: number }>> = {
  1945: { seat: 0x5a3f2b, frame: 0x33261a },
  1965: { seat: 0x7a5233, frame: 0x8a8f94 },
  1985: { seat: 0x2f3a44, frame: 0x1d242b },
  2005: { seat: 0x6b4a32, frame: 0x39434d },
  2025: { seat: 0x3f5a66, frame: 0x232d33 },
};

const TRASH_COLORS: Readonly<Record<EraId, number>> = {
  1945: 0x3a4a32,
  1965: 0x4a6b3f,
  1985: 0x33383e,
  2005: 0x39434d,
  2025: 0x2f4f5a,
};

const METER_COLORS: Readonly<Record<EraId, number>> = {
  1945: 0x9aa0a6,
  1965: 0x9aa0a6,
  1985: 0x8a9299,
  2005: 0x6f767d,
  2025: 0x44505c,
};

const KIOSK_COLORS: Readonly<Record<EraId, { body: number; trim: number }>> = {
  1945: { body: 0x6b5238, trim: 0xc0562f },
  1965: { body: 0xa84a3a, trim: 0xf7c948 },
  1985: { body: 0x3a5a7a, trim: 0x00e5ff },
  2005: { body: 0x39434d, trim: 0x1f8fc4 },
  2025: { body: 0x2f3a44, trim: 0x00e5ff },
};

const BOOTH_COLORS: Readonly<Record<EraId, number>> = {
  1945: 0x33383e,
  1965: 0xb03a30,
  1985: 0x8a96a0,
  2005: 0x33383e,
  2025: 0x33383e,
};

/** Material construction options for the cached standard-material helper. */
interface StdOptions {
  readonly roughness?: number;
  readonly metalness?: number;
  readonly emissive?: number;
  readonly emissiveIntensity?: number;
  readonly transparent?: boolean;
  readonly opacity?: number;
}

/**
 * Era-driven street furniture and props layer.
 *
 * Implements the `SceneLayer` protocol (id, createRoot, update, dispose) so
 * it can be registered through `SceneRuntime.attachLayer`, and additionally
 * exposes `attach(group)` / `applyEra(eraId, progress)` / `dispose()`.
 */
export class StreetPropsLayer implements SceneLayer {
  readonly id = 'street-props';

  /** Layer scene-graph root; children are one group per era. */
  readonly root: Group = new Group();

  private readonly eraGroups = new Map<EraId, Group>();
  private readonly geometries = new Map<string, BufferGeometry>();
  private readonly materials = new Map<string, Material>();
  private activeEra: EraId;
  private pendingEra: EraId | null = null;
  private disposed = false;

  constructor(initialEra: EraId = 1945) {
    if (!isEraId(initialEra)) {
      throw new Error(
        `StreetPropsLayer: unknown era ${String(initialEra)}; known eras: 1945, 1965, 1985, 2005, 2025`,
      );
    }
    this.activeEra = initialEra;
    this.root.name = 'street-props';
    this.root.userData.layerType = 'street-props';
    for (const eraId of [1945, 1965, 1985, 2005, 2025] as const) {
      this.buildEraGroup(eraId);
    }
    this.setActiveEra(initialEra);
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Snapshot of the active/pending era selection. */
  getState(): StreetPropsLayerState {
    return { activeEra: this.activeEra, pendingEra: this.pendingEra };
  }

  /** SceneLayer protocol: the root object added to the scene on attach. */
  createRoot(): Object3D {
    return this.root;
  }

  /** Add the layer root to a host group (host can own the layer graph). */
  attach(target: Object3D): void {
    this.assertNotDisposed();
    target.add(this.root);
  }

  /**
   * Swap the visible prop composition toward `eraId`.
   *
   * Props are discrete objects, so during a tween (progress < 1) the current
   * era stays visible and the destination is recorded as `pendingEra`; when
   * progress reaches 1 the swap commits and the destination era's props are
   * shown. Hidden era props are retained so returning to an era restores it.
   */
  applyEra(eraId: EraId, progress = 1): void {
    this.assertNotDisposed();
    if (!isEraId(eraId)) {
      throw new Error(`StreetPropsLayer.applyEra: unknown era ${String(eraId)}; known eras: 1945, 1965, 1985, 2005, 2025`);
    }
    if (progress < 1) {
      this.pendingEra = eraId;
      return;
    }
    this.setActiveEra(eraId);
  }

  /**
   * SceneLayer protocol: called by `SceneRuntime.step()` every frame. Prop
   * swaps are event-driven through `applyEra(eraId, progress)` and commit
   * discretely at progress 1, so there is no continuous per-frame work.
   */
  update(_state: FrameState): void {
    /* Intentionally empty — discrete era props swap on transition settle. */
  }

  /** Remove the root, release every geometry/material and mark inert. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.geometries.clear();
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    this.eraGroups.clear();
  }

  /* ---------------- scene construction ---------------- */

  private buildEraGroup(eraId: EraId): void {
    const group = new Group();
    group.name = `street-props-era:${eraId}`;
    group.userData.eraId = eraId;

    for (const kind of presentKinds(eraId)) {
      for (const side of SIDE_ORDER) {
        const stations = SIDE_STATIONS[side][kind];
        for (const along of stations) {
          group.add(this.buildProp(kind, eraId, side, along));
        }
      }
    }
    this.eraGroups.set(eraId, group);
    this.root.add(group);
  }

  private buildProp(kind: PropKind, eraId: EraId, side: SideId, along: number): Group {
    const { x, z } = stationWorld(side, along);
    const prop = new Group();
    prop.name = `prop:${kind}`;
    prop.position.set(x, 0, z);
    prop.userData.kind = kind;
    prop.userData.side = side;
    prop.userData.footprint = footprintFor(side, along, kind);

    switch (kind) {
      case 'lamp':
        prop.userData.variant = ERA_PROP_SPECS[eraId].lamp;
        this.buildLamp(prop, eraId, side);
        break;
      case 'tree':
        prop.userData.variant = ERA_PROP_SPECS[eraId].tree;
        this.buildTree(prop, eraId);
        break;
      case 'hydrant':
        this.buildHydrant(prop);
        break;
      case 'bench':
        this.buildBench(prop, eraId, side);
        break;
      case 'trash':
        this.buildTrash(prop, eraId);
        break;
      case 'parking-meter':
        this.buildParkingMeter(prop, eraId);
        break;
      case 'newspaper-stand':
        this.buildNewspaperStand(prop, eraId, side);
        break;
      case 'phone-booth':
        this.buildPhoneBooth(prop, eraId, side);
        break;
      case 'ev-charger':
        this.buildEvCharger(prop, eraId, side);
        break;
    }
    return prop;
  }

  /* ---------------- cached asset builders ---------------- */

  private geo(key: string, factory: () => BufferGeometry): BufferGeometry {
    let geometry = this.geometries.get(key);
    if (!geometry) {
      geometry = factory();
      this.geometries.set(key, geometry);
    }
    return geometry;
  }

  private mat(key: string, factory: () => Material): Material {
    let material = this.materials.get(key);
    if (!material) {
      material = factory();
      this.materials.set(key, material);
    }
    return material;
  }

  private cylinder(
    key: string,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    radialSegments = 10,
  ): CylinderGeometry {
    return this.geo(key, () => new CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)) as CylinderGeometry;
  }

  private box(key: string, width: number, height: number, depth: number): BoxGeometry {
    return this.geo(key, () => new BoxGeometry(width, height, depth)) as BoxGeometry;
  }

  private sphere(key: string, radius: number, widthSegments = 12, heightSegments = 10): SphereGeometry {
    return this.geo(key, () => new SphereGeometry(radius, widthSegments, heightSegments)) as SphereGeometry;
  }

  private stdMat(key: string, color: number, options: StdOptions = {}): MeshStandardMaterial {
    return this.mat(`std:${key}`, () =>
      new MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.9,
        metalness: options.metalness ?? 0,
        emissive: options.emissive ?? 0x000000,
        emissiveIntensity: options.emissiveIntensity ?? 1,
        transparent: options.transparent ?? false,
        opacity: options.opacity ?? 1,
      }),
    ) as MeshStandardMaterial;
  }

  private addMesh(
    parent: Object3D,
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
    name?: string,
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.name = name ?? '';
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  /* ---------------- prop builders ---------------- */

  private buildLamp(prop: Group, eraId: EraId, side: SideId): void {
    const variant = ERA_PROP_SPECS[eraId].lamp;
    const light = hexToNumber(ERAS[eraId].palette.light);
    prop.rotation.y = sideYaw(side);

    switch (variant) {
      case 'incandescent': {
        const iron = this.stdMat('lamp:iron', 0x2b2a27);
        this.addMesh(prop, this.cylinder('lamp:base:incandescent', 0.18, 0.22, 0.3, 8), iron, 0, 0.15, 0);
        this.addMesh(prop, this.cylinder('lamp:pole:incandescent', 0.05, 0.09, 4.4, 8), iron, 0, 2.35, 0);
        const arm = this.addMesh(prop, this.cylinder('lamp:arm:incandescent', 0.035, 0.035, 0.9, 8), iron, 0, 4.25, 0.45);
        arm.rotation.x = Math.PI / 2;
        this.addMesh(prop, this.cylinder('lamp:finial:incandescent', 0.025, 0.025, 0.22, 8), iron, 0, 4.48, 0.9);
        this.addMesh(
          prop,
          this.sphere('lamp:globe:incandescent', 0.3, 14, 12),
          this.stdMat('lamp:globe:incandescent', light, { emissive: light, emissiveIntensity: 0.9, roughness: 0.4 }),
          0,
          4.22,
          0.9,
        );
        break;
      }
      case 'mercury': {
        const silver = this.stdMat('lamp:pole:mercury', 0xb9c1c7, { metalness: 0.6, roughness: 0.4 });
        this.addMesh(prop, this.cylinder('lamp:base:mercury', 0.16, 0.2, 0.3, 8), silver, 0, 0.15, 0);
        this.addMesh(prop, this.cylinder('lamp:pole:mercury', 0.06, 0.08, 5.2, 8), silver, 0, 2.75, 0);
        const arm = this.addMesh(prop, this.cylinder('lamp:arm:mercury', 0.03, 0.03, 0.95, 8), silver, 0, 4.75, 0.475);
        arm.rotation.x = Math.PI / 2;
        this.addMesh(prop, this.box('lamp:head:mercury', 0.72, 0.22, 0.16), silver, 0, 4.85, 0.95);
        this.addMesh(
          prop,
          this.box('lamp:glass:mercury', 0.5, 0.1, 0.12),
          this.stdMat('lamp:glass:mercury', light, { emissive: light, emissiveIntensity: 0.95, roughness: 0.3 }),
          0,
          4.68,
          0.95,
        );
        break;
      }
      case 'sodium-vapor': {
        const dark = this.stdMat('lamp:pole:sodium-vapor', 0x2e3237, { roughness: 0.7 });
        this.addMesh(prop, this.cylinder('lamp:base:sodium-vapor', 0.17, 0.21, 0.32, 8), dark, 0, 0.16, 0);
        this.addMesh(prop, this.cylinder('lamp:pole:sodium-vapor', 0.06, 0.09, 6.0, 8), dark, 0, 3.18, 0);
        const arm = this.addMesh(
          prop,
          this.cylinder('lamp:arm:sodium-vapor', 0.035, 0.035, 1.05, 8),
          dark,
          0,
          5.6,
          0.525,
        );
        arm.rotation.x = Math.PI / 2;
        this.addMesh(prop, this.box('lamp:cobra:sodium-vapor', 0.85, 0.26, 0.2), dark, 0, 5.62, 1.05);
        this.addMesh(
          prop,
          this.box('lamp:glow:sodium-vapor', 0.5, 0.1, 0.14),
          this.stdMat('lamp:glow:sodium-vapor', light, { emissive: light, emissiveIntensity: 1.0, roughness: 0.35 }),
          0,
          5.44,
          1.05,
        );
        break;
      }
      case 'early-led': {
        const gray = this.stdMat('lamp:pole:early-led', 0x9aa3ab, { metalness: 0.4, roughness: 0.5 });
        this.addMesh(prop, this.cylinder('lamp:base:early-led', 0.15, 0.19, 0.3, 8), gray, 0, 0.15, 0);
        this.addMesh(prop, this.cylinder('lamp:pole:early-led', 0.05, 0.075, 6.2, 8), gray, 0, 3.32, 0);
        const arm = this.addMesh(prop, this.cylinder('lamp:arm:early-led', 0.03, 0.03, 1.05, 8), gray, 0, 5.8, 0.525);
        arm.rotation.x = Math.PI / 2;
        this.addMesh(prop, this.box('lamp:head:early-led', 0.95, 0.12, 0.16), gray, 0, 5.86, 1.05);
        this.addMesh(
          prop,
          this.box('lamp:strip:early-led', 0.7, 0.05, 0.09),
          this.stdMat('lamp:strip:early-led', light, { emissive: light, emissiveIntensity: 0.9, roughness: 0.3 }),
          0,
          5.74,
          1.05,
        );
        break;
      }
      case 'led': {
        const white = this.stdMat('lamp:pole:led', 0xe8edf2, { roughness: 0.4 });
        this.addMesh(prop, this.cylinder('lamp:base:led', 0.14, 0.18, 0.28, 8), white, 0, 0.14, 0);
        this.addMesh(prop, this.cylinder('lamp:pole:led', 0.04, 0.06, 6.4, 8), white, 0, 3.4, 0);
        const arm = this.addMesh(prop, this.cylinder('lamp:arm:led', 0.025, 0.025, 1.0, 8), white, 0, 6.0, 0.5);
        arm.rotation.x = Math.PI / 2;
        this.addMesh(prop, this.box('lamp:head:led', 1.05, 0.1, 0.2), white, 0, 6.06, 1.0);
        this.addMesh(
          prop,
          this.box('lamp:strip-left:led', 0.45, 0.04, 0.06),
          this.stdMat('lamp:strip-left:led', light, { emissive: light, emissiveIntensity: 1.0, roughness: 0.3 }),
          -0.23,
          5.97,
          1.0,
        );
        this.addMesh(
          prop,
          this.box('lamp:strip-right:led', 0.45, 0.04, 0.06),
          this.stdMat('lamp:strip-right:led', 0x00e5ff, { emissive: 0x00e5ff, emissiveIntensity: 0.9, roughness: 0.3 }),
          0.23,
          5.97,
          1.0,
        );
        break;
      }
    }
  }

  private buildTree(prop: Group, eraId: EraId): void {
    const maturity = ERA_PROP_SPECS[eraId].tree;
    const scale = maturity === 'young' ? 0.7 : maturity === 'established' ? 1 : 1.3;
    const trunkHeight = 2.1 * scale;
    const canopyRadius = 0.95 * scale;
    const bark = this.stdMat('tree:bark', 0x5f4632, { roughness: 1 });
    const leaf = this.stdMat(`tree:leaf:${eraId}`, TREE_LEAF_COLORS[eraId], { roughness: 1 });

    this.addMesh(
      prop,
      this.cylinder(`tree:trunk:${scale.toFixed(2)}`, 0.1 * scale, 0.24 * scale, trunkHeight, 7),
      bark,
      0,
      trunkHeight / 2,
      0,
    );
    this.addMesh(
      prop,
      this.sphere(`tree:canopy:${canopyRadius.toFixed(2)}`, canopyRadius, 12, 10),
      leaf,
      0,
      trunkHeight + canopyRadius * 0.55,
      0,
    );
    this.addMesh(
      prop,
      this.sphere(`tree:canopy2:${(canopyRadius * 0.62).toFixed(2)}`, canopyRadius * 0.62, 10, 8),
      leaf,
      canopyRadius * 0.35,
      trunkHeight + canopyRadius,
      canopyRadius * 0.2,
    );
  }

  private buildHydrant(prop: Group): void {
    const red = this.stdMat('hydrant:red', 0xc0392b, { roughness: 0.7 });
    this.addMesh(prop, this.cylinder('hydrant:base', 0.18, 0.2, 0.2, 10), red, 0, 0.1, 0);
    this.addMesh(prop, this.cylinder('hydrant:body', 0.1, 0.13, 0.6, 10), red, 0, 0.5, 0);
    this.addMesh(prop, this.cylinder('hydrant:cap', 0.13, 0.13, 0.08, 10), red, 0, 0.84, 0);
    const nozzle = this.cylinder('hydrant:nozzle', 0.05, 0.05, 0.26, 8);
    const nx = this.addMesh(prop, nozzle, red, 0.19, 0.42, 0);
    nx.rotation.z = Math.PI / 2;
    const nz = this.addMesh(prop, nozzle, red, 0, 0.42, 0.19);
    nz.rotation.x = Math.PI / 2;
  }

  private buildBench(prop: Group, eraId: EraId, side: SideId): void {
    prop.rotation.y = sideYaw(side);
    const palette = BENCH_COLORS[eraId];
    const seat = this.stdMat(`bench:seat:${eraId}`, palette.seat, { roughness: 0.8 });
    const frame = this.stdMat(`bench:frame:${eraId}`, palette.frame, { metalness: 0.4, roughness: 0.6 });
    this.addMesh(prop, this.box(`bench:seat:${eraId}`, 1.7, 0.07, 0.5), seat, 0, 0.46, 0);
    this.addMesh(prop, this.box(`bench:back:${eraId}`, 1.7, 0.5, 0.06), seat, 0, 0.88, -0.24);
    for (const [lx, lz] of [
      [-0.75, 0.2],
      [0.75, 0.2],
      [-0.75, -0.2],
      [0.75, -0.2],
    ] as const) {
      this.addMesh(prop, this.box(`bench:leg:${eraId}`, 0.08, 0.46, 0.08), frame, lx, 0.23, lz);
    }
  }

  private buildTrash(prop: Group, eraId: EraId): void {
    const body = this.stdMat(`trash:body:${eraId}`, TRASH_COLORS[eraId], { roughness: 0.85 });
    this.addMesh(prop, this.cylinder(`trash:body:${eraId}`, 0.24, 0.2, 0.62, 12), body, 0, 0.31, 0);
    this.addMesh(prop, this.cylinder(`trash:rim:${eraId}`, 0.26, 0.26, 0.06, 12), body, 0, 0.65, 0);
    this.addMesh(prop, this.cylinder(`trash:lid:${eraId}`, 0.2, 0.2, 0.05, 12), body, 0, 0.7, 0);
  }

  private buildParkingMeter(prop: Group, eraId: EraId): void {
    const body = this.stdMat(`meter:body:${eraId}`, METER_COLORS[eraId], { metalness: 0.5, roughness: 0.5 });
    this.addMesh(prop, this.cylinder(`meter:pole:${eraId}`, 0.03, 0.03, 1.0, 8), body, 0, 0.5, 0);
    this.addMesh(prop, this.box(`meter:head:${eraId}`, 0.16, 0.24, 0.13), body, 0, 1.12, 0);
    this.addMesh(
      prop,
      this.box(`meter:window:${eraId}`, 0.1, 0.1, 0.02),
      this.stdMat(`meter:window:${eraId}`, 0x14181c, { emissive: 0x9fd0e0, emissiveIntensity: 0.4 }),
      0,
      1.16,
      0.07,
    );
  }

  private buildNewspaperStand(prop: Group, eraId: EraId, side: SideId): void {
    prop.rotation.y = sideYaw(side);
    const palette = KIOSK_COLORS[eraId];
    const body = this.stdMat(`kiosk:body:${eraId}`, palette.body, { roughness: 0.8 });
    const trim = this.stdMat(`kiosk:trim:${eraId}`, palette.trim, { roughness: 0.6 });
    this.addMesh(prop, this.box(`kiosk:base:${eraId}`, 0.95, 0.08, 0.5), body, 0, 0.04, 0);
    this.addMesh(prop, this.box(`kiosk:body:${eraId}`, 0.85, 0.72, 0.42), body, 0, 0.51, 0);
    const paper = this.cylinder(`kiosk:paper:${eraId}`, 0.05, 0.05, 0.3, 6);
    const paperMat = this.stdMat(`kiosk:paper:${eraId}`, 0xd8c9a8, { roughness: 0.9 });
    for (const i of [0, 1, 2]) {
      const rolled = this.addMesh(prop, paper, paperMat, -0.25 + i * 0.25, 0.62, 0.22);
      rolled.rotation.x = Math.PI / 2;
    }
    this.addMesh(prop, this.box(`kiosk:sign:${eraId}`, 0.4, 0.26, 0.06), trim, 0, 0.92, 0.24);
  }

  private buildPhoneBooth(prop: Group, eraId: EraId, side: SideId): void {
    prop.rotation.y = sideYaw(side);
    const frame = this.stdMat(`booth:frame:${eraId}`, BOOTH_COLORS[eraId], { roughness: 0.6 });
    const glass = this.stdMat(`booth:glass:${eraId}`, 0xcfe6f0, {
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
    });
    const interior = this.stdMat(`booth:interior:${eraId}`, 0x22262a, { roughness: 0.9 });
    this.addMesh(prop, this.box(`booth:base:${eraId}`, 1.0, 0.06, 0.85), frame, 0, 0.03, 0);
    this.addMesh(prop, this.box(`booth:roof:${eraId}`, 1.04, 0.08, 0.9), frame, 0, 2.36, 0);
    this.addMesh(prop, this.box(`booth:wall-back:${eraId}`, 0.95, 2.2, 0.03), glass, 0, 1.2, -0.4);
    this.addMesh(prop, this.box(`booth:wall-left:${eraId}`, 0.03, 2.2, 0.8), glass, -0.47, 1.2, 0);
    this.addMesh(prop, this.box(`booth:wall-right:${eraId}`, 0.03, 2.2, 0.8), glass, 0.47, 1.2, 0);
    this.addMesh(prop, this.box(`booth:door:${eraId}`, 0.12, 2.0, 0.03), frame, -0.18, 1.1, 0.4);
    this.addMesh(prop, this.box(`booth:phone:${eraId}`, 0.16, 0.2, 0.1), interior, 0.1, 1.05, 0.22);
  }

  private buildEvCharger(prop: Group, eraId: EraId, side: SideId): void {
    prop.rotation.y = sideYaw(side);
    const body = this.stdMat('charger:body', 0x2f3a44, { metalness: 0.3, roughness: 0.5 });
    const accent = this.stdMat('charger:accent', 0x00e5ff, {
      emissive: 0x00e5ff,
      emissiveIntensity: 0.8,
      roughness: 0.4,
    });
    this.addMesh(prop, this.box('charger:base', 0.5, 0.06, 0.4), body, 0, 0.03, 0);
    this.addMesh(prop, this.box('charger:pedestal', 0.4, 1.1, 0.28), body, 0, 0.66, 0);
    this.addMesh(prop, this.box('charger:screen', 0.22, 0.28, 0.03), accent, 0, 0.72, 0.15);
    const cable = this.addMesh(
      prop,
      this.geo('charger:cable', () => new TorusGeometry(0.14, 0.03, 8, 16)),
      this.stdMat('charger:cable', 0x11151a, { roughness: 0.7 }),
      -0.22,
      0.7,
      0,
    );
    cable.rotation.x = Math.PI / 2;
    void eraId; // charger only exists in 2025; kept for symmetric era plumbing
  }

  /* ---------------- era selection ---------------- */

  private setActiveEra(eraId: EraId): void {
    for (const [id, group] of this.eraGroups) {
      group.visible = id === eraId;
    }
    this.activeEra = eraId;
    this.pendingEra = null;
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('StreetPropsLayer has been disposed and can no longer be used');
    }
  }
}