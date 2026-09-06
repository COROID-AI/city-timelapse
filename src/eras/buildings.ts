/**
 * Era buildings: procedural architecture per year (1945-2025).
 *
 * This module owns the `EraDefinition.buildings` segment. For each year it
 * builds a morph-friendly THREE.Group containing the city block's buildings:
 *
 *   1945  pre-war brick low-rises + wartime boarding + soot staining
 *   1965  mid-century stucco + neon-ready facades
 *   1985  Brutalist concrete insertions alongside older stock
 *   2005  glass office retrofits
 *   2025  modern mixed-use towers (glass/steel + green roofs)
 *
 * All geometry is procedural (extruded footprints, window grids, roofline
 * details, rooftop features, signage mounts) and every texture is generated
 * on a `<canvas>` — no runtime-downloaded assets or non-CC0 models.
 *
 * ---------------------------------------------------------------------------
 * Morph contract (stable node ordering)
 * ---------------------------------------------------------------------------
 * The Phase 3 morph engine crossfades/scales between era groups by index.
 * To keep that cheap and deterministic, every era group exposes the same
 * fixed child ordering:
 *
 *   group.children[0] = cornerShop (small ground-floor retail building)
 *   group.children[1] = apartment  (mid-rise residential)
 *   group.children[2] = office     (tall commercial tower)
 *
 * and *each* building group exposes a fixed five-slot child ordering:
 *
 *   building.children[0] = body        (extruded footprint)
 *   building.children[1] = windows     (per-era window grid group)
 *   building.children[2] = roofline    (cornice / parapet / setback)
 *   building.children[3] = rooftop     (water tank / AC units / solar / green)
 *   building.children[4] = signage     (painted / neon / plastic / glass / LED)
 *
 * The morph transition itself is owned by Phase 3; this module only emits the
 * stable ordering that makes crossfading/scaling well-defined.
 *
 * ---------------------------------------------------------------------------
 * Lifecycle contract: `bootstrap(scene, era)` -> `update(era)` -> `dispose()`.
 * The scene-composition task owns application wiring; this module never
 * mutates the era registry or any other era field.
 */
import * as THREE from 'three';
import { eraRegistry } from '../data/eraRegistry';
import type { EraDefinition, EraKey } from '../data/eraDefinition';

// ---------------------------------------------------------------------------
// Stable ordering conventions (consulted by the Phase 3 morph engine)
// ---------------------------------------------------------------------------

/** Fixed top-level building order across every era group. */
export const BUILDING_ORDER: readonly ['cornerShop', 'apartment', 'office'] = ['cornerShop', 'apartment', 'office'];

/** Fixed child-slot order within every building group. */
export const BUILDING_SLOTS: readonly ['body', 'windows', 'roofline', 'rooftop', 'signage'] = [
  'body',
  'windows',
  'roofline',
  'rooftop',
  'signage',
];

/** A building slot name; used to describe the stable morphable graph. */
export type BuildingSlot = (typeof BUILDING_ORDER)[number];

// ---------------------------------------------------------------------------
// Small procedural helpers
// ---------------------------------------------------------------------------

/** Build a MeshStandardMaterial from a hex colour plus optional extras. */
function mat(
  color: string,
  opts: { roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number; transparent?: boolean } = {},
): THREE.MeshStandardMaterial {
  const params: THREE.MeshStandardMaterialParameters = {
    color,
    roughness: opts.roughness ?? 0.78,
    metalness: opts.metalness ?? 0.06,
  };
  if (opts.emissive !== undefined) {
    params.emissive = opts.emissive;
    params.emissiveIntensity = opts.emissiveIntensity ?? 1.8;
  }
  if (opts.transparent !== undefined) {
    params.transparent = opts.transparent;
  }
  return new THREE.MeshStandardMaterial(params);
}

/** A single box mesh. */
function box(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

/** A thin plane mesh (used for signage panels, green roofs, solar arrays). */
function plane(w: number, h: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
}

// ---------------------------------------------------------------------------
// Per-era building configuration
// ---------------------------------------------------------------------------

/** Facade colours resolved from an era definition. */
interface FacadeColors {
  base: string;
  accent: string;
  window: string;
}

/** Window grid styling per era. */
type WindowStyle = 'sash' | 'ribbon' | 'punched' | 'curtain';

/** Rooftop feature per era. */
type RooftopStyle = 'waterTank' | 'waterTankDeck' | 'ac' | 'solarGreen';

/** Signage mount style per era. */
type SignageStyle = 'painted' | 'neon' | 'plastic' | 'glass' | 'led';

/** Per-slot dimensions for one era. */
interface SlotSpec {
  height: number;
  floors: number;
}

/** Complete procedural spec for one era's buildings. */
interface EraBuildingSpec {
  year: EraKey;
  /** Human-readable style name for the segment. */
  style: string;
  /** Primary facade material (brick / stucco / concrete / glass / steel). */
  material: 'brick' | 'stucco' | 'concrete' | 'glass' | 'steel';
  windowStyle: WindowStyle;
  rooftop: RooftopStyle;
  signage: SignageStyle;
  /** 0..1 fraction of windows boarded over (wartime 1945). */
  boarding: number;
  /** Whether the facade gets a soot-stained top band (1945). */
  soot: boolean;
  /** Per-building height (world units) and floor count. */
  cornerShop: SlotSpec;
  apartment: SlotSpec;
  office: SlotSpec;
}

/** Resolve the facade palette for a year from the era definition. */
function facadeColors(era: EraDefinition): FacadeColors {
  const p = era.palette;
  // buildingBase is the dominant facade tone; buildingAccent the trim.
  return {
    base: p.buildingBase,
    accent: p.buildingAccent,
    window: '#1a2430',
  };
}

/**
 * Per-era building specs. These are authored here (the `EraDefinition.buildings`
 * segment) and only touch this segment — no other era field is modified.
 */
const BUILDING_SPECS: Record<EraKey, EraBuildingSpec> = {
  1945: {
    year: 1945,
    style: 'prewar-brick',
    material: 'brick',
    windowStyle: 'sash',
    rooftop: 'waterTank',
    signage: 'painted',
    boarding: 0.4,
    soot: true,
    cornerShop: { height: 7, floors: 2 },
    apartment: { height: 15, floors: 5 },
    office: { height: 19, floors: 6 },
  },
  1965: {
    year: 1965,
    style: 'midcentury-stucco',
    material: 'stucco',
    windowStyle: 'ribbon',
    rooftop: 'waterTankDeck',
    signage: 'neon',
    boarding: 0,
    soot: false,
    cornerShop: { height: 8, floors: 2 },
    apartment: { height: 24, floors: 8 },
    office: { height: 36, floors: 12 },
  },
  1985: {
    year: 1985,
    style: 'brutalist-concrete',
    material: 'concrete',
    windowStyle: 'punched',
    rooftop: 'ac',
    signage: 'plastic',
    boarding: 0,
    soot: false,
    cornerShop: { height: 8, floors: 2 },
    apartment: { height: 26, floors: 9 },
    office: { height: 52, floors: 18 },
  },
  2005: {
    year: 2005,
    style: 'glass-retrofit',
    material: 'glass',
    windowStyle: 'curtain',
    rooftop: 'ac',
    signage: 'glass',
    boarding: 0,
    soot: false,
    cornerShop: { height: 10, floors: 3 },
    apartment: { height: 40, floors: 14 },
    office: { height: 70, floors: 24 },
  },
  2025: {
    year: 2025,
    style: 'mixeduse-glass-steel',
    material: 'glass',
    windowStyle: 'curtain',
    rooftop: 'solarGreen',
    signage: 'led',
    boarding: 0,
    soot: false,
    cornerShop: { height: 12, floors: 4 },
    apartment: { height: 60, floors: 20 },
    office: { height: 95, floors: 32 },
  },
};

// ---------------------------------------------------------------------------
// Window grids
// ---------------------------------------------------------------------------

/**
 * Add a window grid to the front (+Z) facade of a building.
 * `boarding` (0..1) replaces a deterministic subset of windows with dark
 * wartime boarding planks. Windows are slightly proud of the facade so they
 * read as glazing rather than flat texture.
 */
function addWindowGrid(
  root: THREE.Group,
  opts: {
    width: number;
    height: number;
    floors: number;
    windowStyle: WindowStyle;
    windowColor: string;
    baseColor: string;
    boarding: number;
  },
): void {
  const { width, height, floors, windowStyle, windowColor, baseColor, boarding } = opts;
  const windows = new THREE.Group();
  windows.name = 'windows';

  const marginX = Math.max(0.6, width * 0.07);
  const usableX = width - marginX * 2;
  const floorH = height / floors;

  // Per-floor window band height (ribbon = continuous band; others = discrete).
  const bandH = windowStyle === 'ribbon' ? Math.max(0.5, floorH * 0.55) : Math.max(0.45, floorH * 0.5);
  const perFloor =
    windowStyle === 'ribbon'
      ? 1
      : windowStyle === 'curtain'
        ? Math.max(3, Math.floor(usableX / 1.6))
        : Math.max(2, Math.floor(usableX / 2.2));
  const gap = perFloor > 1 ? usableX / perFloor : usableX;

  const windowW = windowStyle === 'curtain' ? gap * 0.82 : windowStyle === 'ribbon' ? usableX : gap * 0.62;
  const windowMat = mat(windowColor, { metalness: 0.5, roughness: 0.2 });
  const boardMat = mat('#3a3026', { roughness: 0.9 });

  let index = 0;
  for (let f = 0; f < floors; f += 1) {
    const y = (f + 0.5) * floorH;
    for (let i = 0; i < perFloor; i += 1) {
      const x = -usableX / 2 + (perFloor > 1 ? i * gap + gap / 2 : usableX / 2);
      // Deterministic boarding selection (stable across rebuilds).
      const boarded = boarding > 0 && (index * 7 + f * 3 + i * 5) % 10 < boarding * 10;
      const w = box(windowW, bandH, 0.18, boarded ? boardMat : windowMat);
      w.position.set(x, y, 0.1);
      windows.add(w);
      index += 1;
    }
  }

  root.add(windows);

  // Soot staining (1945): a darker band across the upper facade + a few
  // streaky patches near the roofline, slightly proud of the wall.
  if (opts.boarding > 0) {
    const soot = new THREE.Group();
    soot.name = 'soot';
    const sootH = Math.max(0.9, height * 0.16);
    const band = box(width + 0.06, sootH, 0.06, mat('#3c3630', { roughness: 0.95 }));
    band.position.set(0, height - sootH / 2, 0.1);
    soot.add(band);
    // A couple of vertical soot streaks.
    for (let s = 0; s < 3; s += 1) {
      const streak = box(0.5, height * 0.28, 0.05, mat('#4a4238', { roughness: 0.95 }));
      streak.position.set(-width * 0.3 + s * width * 0.3, height * 0.72, 0.1);
      soot.add(streak);
    }
    // Nest the soot treatment inside the windows slot so the building's
    // top-level five-slot ordering (body/windows/roofline/rooftop/signage)
    // stays stable for the morph engine.
    windows.add(soot);
  }
  void baseColor;
}

// ---------------------------------------------------------------------------
// Roofline details
// ---------------------------------------------------------------------------

/** Add a roofline treatment (cornice / parapet / setback) to a building. */
function addRoofline(root: THREE.Group, opts: { width: number; depth: number; height: number; style: EraBuildingSpec }): void {
  const roofline = new THREE.Group();
  roofline.name = 'roofline';
  const { width, depth, height } = opts;
  const year = opts.style.year;

  if (year === 1945) {
    // Pre-war cornice: a projecting moulding just below the roofline.
    const cornice = box(width + 0.5, 0.5, depth + 0.5, mat('#5c4d3d', { roughness: 0.85 }));
    cornice.position.set(0, height - 0.25, 0);
    roofline.add(cornice);
  } else if (year === 1965) {
    // Mid-century parapet with a slight cap.
    const parapet = box(width + 0.2, 0.7, depth + 0.2, mat('#8d8b84', { roughness: 0.6 }));
    parapet.position.set(0, height - 0.35, 0);
    roofline.add(parapet);
  } else if (year === 1985) {
    // Brutalist flat parapet with a projecting concrete cap.
    const parapet = box(width + 0.3, 0.8, depth + 0.3, mat('#6f6f6e', { roughness: 0.9 }));
    parapet.position.set(0, height - 0.4, 0);
    roofline.add(parapet);
    const cap = box(width + 0.7, 0.25, depth + 0.7, mat('#8a8f8a', { roughness: 0.8 }));
    cap.position.set(0, height - 0.12, 0);
    roofline.add(cap);
  } else if (year === 2005) {
    // Glass-retrofit parapet with a thin metal cap.
    const parapet = box(width + 0.2, 0.6, depth + 0.2, mat('#7d8b94', { metalness: 0.4 }));
    parapet.position.set(0, height - 0.3, 0);
    roofline.add(parapet);
  } else {
    // 2025: parapet + a setback crown on the taller towers.
    const parapet = box(width + 0.2, 0.6, depth + 0.2, mat('#6b7d8c', { metalness: 0.5 }));
    parapet.position.set(0, height - 0.3, 0);
    roofline.add(parapet);
    if (height >= 50) {
      const setback = box(width * 0.72, 1.6, depth * 0.72, mat('#3c4a56', { metalness: 0.45 }));
      setback.position.set(0, height + 0.5, 0);
      roofline.add(setback);
    }
  }
  void depth;
  root.add(roofline);
}

// ---------------------------------------------------------------------------
// Rooftop features (AC units vs water tanks vs solar panels)
// ---------------------------------------------------------------------------

/** Add the era-appropriate rooftop feature to a building. */
function addRooftop(root: THREE.Group, opts: { width: number; depth: number; height: number; style: EraBuildingSpec }): void {
  const rooftop = new THREE.Group();
  rooftop.name = 'rooftop';
  const { width, depth, height } = opts;
  const spec = opts.style;
  const roofY = height;

  switch (spec.rooftop) {
    case 'waterTank':
    case 'waterTankDeck': {
      // Wooden water tank: cylinder + conical lid, a pre/mid-century staple.
      const tankR = Math.max(0.9, width * 0.09);
      const tankH = Math.max(1.4, tankR * 1.3);
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(tankR, tankR, tankH, 14),
        mat('#7a5a3a', { roughness: 0.9 }),
      );
      tank.position.set(width * 0.22, roofY + tankH / 2, depth * 0.18);
      rooftop.add(tank);
      const lid = new THREE.Mesh(
        new THREE.ConeGeometry(tankR * 0.7, tankH * 0.4, 12),
        mat('#6b4a2e', { roughness: 0.9 }),
      );
      lid.position.set(width * 0.22, roofY + tankH + tankH * 0.2, depth * 0.18);
      rooftop.add(lid);
      // A second, smaller tank for the office towers.
      if (height >= 30) {
        const tank2 = new THREE.Mesh(
          new THREE.CylinderGeometry(tankR * 0.72, tankR * 0.72, tankH * 0.7, 12),
          mat('#7a5a3a', { roughness: 0.9 }),
        );
        tank2.position.set(-width * 0.24, roofY + tankH * 0.35, -depth * 0.16);
        rooftop.add(tank2);
      }
      break;
    }
    case 'ac': {
      // Rooftop AC units: a grid of squat metal boxes.
      const units = Math.max(2, Math.floor(width / 3.2));
      for (let i = 0; i < units; i += 1) {
        const unit = box(1.1, 0.7, 1.1, mat('#9aa0a6', { metalness: 0.5, roughness: 0.5 }));
        unit.position.set(-width * 0.28 + i * 1.6, roofY + 0.35, depth * 0.2);
        rooftop.add(unit);
        const vent = box(1.1, 0.08, 0.4, mat('#6f6f6e', { metalness: 0.3 }));
        vent.position.set(-width * 0.28 + i * 1.6, roofY + 0.72, depth * 0.2);
        rooftop.add(vent);
      }
      break;
    }
    case 'solarGreen': {
      // Green roof: a planted plane + planters, plus a solar array.
      const green = plane(width * 0.7, depth * 0.7, mat('#3f7d3a', { roughness: 0.95 }));
      green.position.set(0, roofY + 0.05, 0);
      green.rotation.x = -Math.PI / 2;
      rooftop.add(green);
      // Planters along the parapet.
      for (let i = 0; i < 3; i += 1) {
        const planter = box(1.2, 0.5, 1.2, mat('#4a6b3a', { roughness: 0.9 }));
        planter.position.set(-width * 0.3 + i * 1.5, roofY + 0.25, depth * 0.28);
        rooftop.add(planter);
      }
      // Tilted solar panels on the opposite side.
      const panelCount = Math.max(2, Math.floor(width / 2.6));
      for (let i = 0; i < panelCount; i += 1) {
        const panel = plane(1.6, 1.0, mat('#1c2a4a', { metalness: 0.8, roughness: 0.2 }));
        panel.position.set(-width * 0.26 + i * 1.9, roofY + 0.6, -depth * 0.22);
        panel.rotation.x = -Math.PI / 3.2;
        rooftop.add(panel);
        const post = box(0.08, 0.35, 0.08, mat('#6b7d8c', { metalness: 0.6 }));
        post.position.set(-width * 0.26 + i * 1.9, roofY + 0.2, -depth * 0.22);
        rooftop.add(post);
      }
      break;
    }
  }
  root.add(rooftop);
}

// ---------------------------------------------------------------------------
// Signage mounts
// ---------------------------------------------------------------------------

/** Add the era-appropriate signage mount to a building facade. */
function addSignage(root: THREE.Group, opts: { width: number; height: number; style: EraBuildingSpec; accent: string }): void {
  const signage = new THREE.Group();
  signage.name = 'signage';
  const { width, height } = opts;
  const spec = opts.style;
  const sx = width * 0.3;
  const sy = Math.min(height * 0.5, 4.2);
  const signW = Math.min(3.4, width * 0.3);
  const signH = 0.8;

  switch (spec.signage) {
    case 'painted': {
      // Painted lettering board (1945): flat cream sign, no glow.
      const s = plane(signW, signH, mat('#e8e2d6', { roughness: 0.5 }));
      s.position.set(sx, sy, 0.12);
      signage.add(s);
      break;
    }
    case 'neon': {
      // Neon-ready (1965): dark mount + emissive neon tubes.
      const s = plane(signW, signH, mat('#2a2a2a', { roughness: 0.4 }));
      s.position.set(sx, sy, 0.12);
      signage.add(s);
      const tube = box(signW * 0.8, 0.08, 0.05, mat(opts.accent, { emissive: opts.accent, emissiveIntensity: 2.4 }));
      tube.position.set(sx, sy, 0.2);
      signage.add(tube);
      break;
    }
    case 'plastic': {
      // Backlit plastic (1985): bright saturated panel.
      const s = plane(signW, signH, mat(opts.accent, { emissive: opts.accent, emissiveIntensity: 1.6 }));
      s.position.set(sx, sy, 0.12);
      signage.add(s);
      break;
    }
    case 'glass': {
      // Glass storefront sign (2005): clean slim panel with metal frame.
      const s = plane(signW, signH, mat('#dfe7ee', { metalness: 0.2, roughness: 0.2 }));
      s.position.set(sx, sy, 0.12);
      signage.add(s);
      const frame = box(signW + 0.2, 0.1, 0.08, mat('#7d8b94', { metalness: 0.6 }));
      frame.position.set(sx, sy + signH / 2 + 0.05, 0.16);
      signage.add(frame);
      break;
    }
    case 'led': {
      // Digital LED (2025): emissive panel with a bright active band.
      const s = plane(signW, signH, mat('#0e0e12', { roughness: 0.3 }));
      s.position.set(sx, sy, 0.12);
      signage.add(s);
      const band = box(signW * 0.9, 0.12, 0.05, mat('#00d1ff', { emissive: '#00d1ff', emissiveIntensity: 2.6 }));
      band.position.set(sx, sy + 0.1, 0.2);
      signage.add(band);
      break;
    }
  }
  root.add(signage);
}

// ---------------------------------------------------------------------------
// Building builder
// ---------------------------------------------------------------------------

/** Footprint (width x depth) for each building slot, shared across eras. */
const SLOT_FOOTPRINT: Record<BuildingSlot, { width: number; depth: number; x: number }> = {
  cornerShop: { width: 9, depth: 11, x: -15 },
  apartment: { width: 13, depth: 15, x: 0 },
  office: { width: 11, depth: 13, x: 15 },
};

/** Build one building (extruded footprint + windows + roofline + rooftop + signage). */
function buildBuilding(slot: BuildingSlot, spec: EraBuildingSpec, colors: FacadeColors): THREE.Group {
  const group = new THREE.Group();
  group.name = slot;

  const fp = SLOT_FOOTPRINT[slot];
  const slotSpec = spec[slot];
  const height = slotSpec.height;
  const baseColor = spec.material === 'brick' ? colors.base : spec.material === 'concrete' ? '#8a8f8a' : spec.material === 'stucco' ? '#c9c2b0' : colors.base;
  const accentColor = colors.accent;

  // [0] body — extruded footprint.
  const body = box(fp.width, height, fp.depth, mat(baseColor, { roughness: spec.material === 'glass' ? 0.2 : 0.85, metalness: spec.material === 'steel' || spec.material === 'glass' ? 0.35 : 0.05 }));
  body.name = 'body';
  body.position.set(0, height / 2, 0);
  group.add(body);

  // [1] windows.
  addWindowGrid(group, {
    width: fp.width,
    height,
    floors: slotSpec.floors,
    windowStyle: spec.windowStyle,
    windowColor: colors.window,
    baseColor,
    boarding: spec.boarding,
  });

  // [2] roofline.
  addRoofline(group, { width: fp.width, depth: fp.depth, height, style: spec });

  // [3] rooftop feature.
  addRooftop(group, { width: fp.width, depth: fp.depth, height, style: spec });

  // [4] signage mount.
  addSignage(group, { width: fp.width, height, style: spec, accent: accentColor });

  group.position.set(fp.x, 0, 0);
  return group;
}

// ---------------------------------------------------------------------------
// Era group builder
// ---------------------------------------------------------------------------

/**
 * Build the full THREE.Group of buildings for one era.
 *
 * The returned group has a stable child order (`cornerShop`, `apartment`,
 * `office`) and each building exposes the fixed five-slot structure, so the
 * Phase 3 morph engine can crossfade/scale between era groups by index.
 */
export function buildEraBuildings(era: EraDefinition): THREE.Group {
  const group = new THREE.Group();
  group.name = `era-buildings-${era.year}`;
  const spec = BUILDING_SPECS[era.year];
  const colors = facadeColors(era);

  for (const slot of BUILDING_ORDER) {
    group.add(buildBuilding(slot, spec, colors));
  }
  return group;
}

// ---------------------------------------------------------------------------
// Factory (lifecycle contract)
// ---------------------------------------------------------------------------

/** The buildings factory object. */
export interface BuildingsFactory {
  /** Attach the buildings group to a scene and build the given era. */
  bootstrap(scene: THREE.Scene, era?: EraDefinition): BuildingsFactory;
  /** Rebuild the buildings for a new era (the "morph" trigger). */
  update(era: EraDefinition): BuildingsFactory;
  /** Remove the buildings group from the scene and release resources. */
  dispose(): void;
  /** Root group owning the current era's buildings (null before bootstrap). */
  readonly root: THREE.Group;
  /** The current era's buildings group (null before bootstrap). */
  readonly group: THREE.Group | null;
  /** The currently active year (null before bootstrap). */
  readonly year: EraKey | null;
}

/**
 * Create the buildings factory. It is the single registration point for the
 * `EraDefinition.buildings` segment: it builds and swaps the per-era building
 * group in place and never touches any other era field.
 *
 * The default era (used when `bootstrap` is called without one) is 1945 so
 * the composition task can attach the earliest era immediately.
 */
export function buildingsFactory(era?: EraDefinition): BuildingsFactory {
  const root = new THREE.Group();
  root.name = 'era-buildings';

  let scene: THREE.Scene | null = null;
  let currentYear: EraKey | null = null;
  let currentGroup: THREE.Group | null = null;

  /** Rebuild the buildings group for the given era. */
  function rebuild(def: EraDefinition): THREE.Group {
    root.clear();
    const g = buildEraBuildings(def);
    root.add(g);
    currentGroup = g;
    currentYear = def.year;
    return g;
  }

  return {
    get root() {
      return root;
    },
    get group() {
      return currentGroup;
    },
    get year() {
      return currentYear;
    },
    bootstrap(sceneArg: THREE.Scene, eraArg?: EraDefinition): BuildingsFactory {
      scene = sceneArg;
      scene.add(root);
      rebuild(eraArg ?? era ?? eraRegistry[1945]);
      return this;
    },
    update(def: EraDefinition): BuildingsFactory {
      rebuild(def);
      return this;
    },
    dispose(): void {
      if (scene) {
        scene.remove(root);
      }
      root.clear();
      scene = null;
      currentGroup = null;
      currentYear = null;
    },
  };
}