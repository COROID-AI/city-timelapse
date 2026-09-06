/**
 * Era street props factory — city-timelapse.
 *
 * Builds era-specific street furniture (gas lamps -> mercury vapor -> sodium
 * orange -> LED poles, fire hydrants, phone booths, parking meters, benches,
 * trash cans, trees that grow larger across eras, litter/graffiti levels,
 * bicycle racks, and EV chargers in 2025 only) for the city block.
 *
 * Lifecycle: `streetPropsFactory(scene)` bootstraps the props for all five
 * eras and registers the `EraDefinition.streetProps` segment on `eraRegistry`
 * (runtime fill only — no shared foundation file is modified). `update(year)`
 * swaps the visible prop set, and `dispose()` tears everything down.
 *
 * Lamp heads use dedicated emissive materials collected in
 * `lampEmissives` so Phase 4 post-processing can pick up the emissive
 * channel for bloom without touching any other material.
 */
import * as THREE from 'three';
import { eraRegistry } from '../data/eraRegistry';
import type { EraKey } from '../data/eraDefinition';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A lamp emissive material reserved for the postfx bloom pass. */
export interface LampEmissive {
  /** The era the lamp belongs to. */
  year: EraKey;
  /** The dedicated emissive material carrying the lamp glow channel. */
  material: THREE.MeshStandardMaterial;
  /** The emissive glow color for this lamp technology. */
  color: THREE.Color;
}

/** Lightweight descriptor used to register the `streetProps` segment. */
export type StreetPropId =
  | 'gasLamp'
  | 'mercuryLamp'
  | 'sodiumLamp'
  | 'ledLamp'
  | 'hydrant'
  | 'phoneBooth'
  | 'parkingMeter'
  | 'bench'
  | 'trashCan'
  | 'tree'
  | 'bikeRack'
  | 'evCharger'
  | 'litter'
  | 'graffiti';

/** The handle returned by `streetPropsFactory`. */
export interface StreetPropsHandle {
  /** Root group holding every era's prop set (added to the scene once). */
  readonly group: THREE.Group;
  /** Emissive lamp materials reserved for the postfx bloom pass. */
  readonly lampEmissives: LampEmissive[];
  /** Currently displayed era. */
  readonly currentYear: EraKey;
  /** Swap the visible street furniture to `year` (lifecycle `update`). */
  update(year: EraKey): void;
  /** Remove props from the scene and clear the registered segment. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Per-era prop configuration
// ---------------------------------------------------------------------------

interface EraProps {
  year: EraKey;
  lamp: 'gas' | 'mercury' | 'sodium' | 'led';
  lampCount: number;
  hydrants: number;
  phoneBooths: number;
  meters: number;
  benches: number;
  trashCans: number;
  /** Tree growth factor across eras (1.0 = baseline canopy). */
  treeGrowth: number;
  trees: number;
  bikeRacks: number;
  evChargers: number;
  /** Number of tiny litter pieces scattered on the sidewalk. */
  litter: number;
  /** 0 = none, 1 = light, 2 = heavy, 3 = dense tagging. */
  graffiti: 0 | 1 | 2 | 3;
}

/** Era-specific lamp technology + glow colors. */
interface LampStyle {
  emissive: number;
  material: number;
  head: 'globe' | 'panel' | 'cobra';
}

const LAMP_STYLES: Record<'gas' | 'mercury' | 'sodium' | 'led', LampStyle> = {
  gas: { emissive: 0xffc46b, material: 0x3a2f24, head: 'globe' },
  mercury: { emissive: 0xcfe6ff, material: 0x4a5258, head: 'globe' },
  sodium: { emissive: 0xffa94d, material: 0x3c3c3c, head: 'cobra' },
  led: { emissive: 0xeaf6ff, material: 0x2e3236, head: 'panel' },
};

const ERA_PROP_SET: Record<EraKey, EraProps> = {
  1945: {
    year: 1945,
    lamp: 'gas',
    lampCount: 3,
    hydrants: 2,
    phoneBooths: 1,
    meters: 2,
    benches: 2,
    trashCans: 2,
    treeGrowth: 0.45,
    trees: 3,
    bikeRacks: 0,
    evChargers: 0,
    litter: 4,
    graffiti: 0,
  },
  1965: {
    year: 1965,
    lamp: 'mercury',
    lampCount: 3,
    hydrants: 2,
    phoneBooths: 3,
    meters: 4,
    benches: 2,
    trashCans: 2,
    treeGrowth: 0.7,
    trees: 3,
    bikeRacks: 0,
    evChargers: 0,
    litter: 8,
    graffiti: 1,
  },
  1985: {
    year: 1985,
    lamp: 'sodium',
    lampCount: 3,
    hydrants: 2,
    phoneBooths: 6,
    meters: 5,
    benches: 3,
    trashCans: 3,
    treeGrowth: 0.85,
    trees: 4,
    bikeRacks: 1,
    evChargers: 0,
    litter: 14,
    graffiti: 3,
  },
  2005: {
    year: 2005,
    lamp: 'sodium',
    lampCount: 3,
    hydrants: 2,
    phoneBooths: 2,
    meters: 5,
    benches: 3,
    trashCans: 3,
    treeGrowth: 1.0,
    trees: 4,
    bikeRacks: 2,
    evChargers: 0,
    litter: 10,
    graffiti: 2,
  },
  2025: {
    year: 2025,
    lamp: 'led',
    lampCount: 4,
    hydrants: 2,
    phoneBooths: 0,
    meters: 3,
    benches: 3,
    trashCans: 3,
    treeGrowth: 1.15,
    trees: 5,
    bikeRacks: 3,
    evChargers: 3,
    litter: 5,
    graffiti: 1,
  },
};

// ---------------------------------------------------------------------------
// Prop geometry builders
// ---------------------------------------------------------------------------

function material(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

/** Gas / mercury lamp: ornate post with a glowing globe head. */
function buildGlobeLamp(cfg: EraProps, emissives: LampEmissive[]): THREE.Group {
  const lamp = LAMP_STYLES[cfg.lamp];
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 4.6, 8),
    material(lamp.material, 0.95),
  );
  post.position.set(0, 2.3, 0);
  g.add(post);

  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6),
    material(lamp.material, 0.95),
  );
  arm.position.set(0.35, 4.5, 0);
  arm.rotation.z = Math.PI / 2;
  g.add(arm);

  const emissiveMat = new THREE.MeshStandardMaterial({
    color: lamp.material,
    emissive: lamp.emissive,
    emissiveIntensity: 2.4,
    roughness: 0.4,
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), emissiveMat);
  globe.position.set(0.35, 4.95, 0);
  g.add(globe);
  emissives.push({ year: cfg.year, material: emissiveMat, color: new THREE.Color(lamp.emissive) });
  return g;
}

/** Sodium cobra-head lamp. */
function buildCobraLamp(cfg: EraProps, emissives: LampEmissive[]): THREE.Group {
  const lamp = LAMP_STYLES[cfg.lamp];
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.13, 5.4, 8),
    material(lamp.material, 0.95),
  );
  post.position.set(0, 2.7, 0);
  g.add(post);

  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6),
    material(lamp.material, 0.95),
  );
  arm.position.set(0.45, 5.2, 0);
  arm.rotation.z = Math.PI / 2;
  g.add(arm);

  const emissiveMat = new THREE.MeshStandardMaterial({
    color: lamp.material,
    emissive: lamp.emissive,
    emissiveIntensity: 2.6,
    roughness: 0.4,
  });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.35, 8), emissiveMat);
  head.position.set(0.5, 5.15, 0);
  g.add(head);
  emissives.push({ year: cfg.year, material: emissiveMat, color: new THREE.Color(lamp.emissive) });
  return g;
}

/** LED pole with a slim rectangular panel. */
function buildLedLamp(cfg: EraProps, emissives: LampEmissive[]): THREE.Group {
  const lamp = LAMP_STYLES[cfg.lamp];
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.09, 5.8, 8),
    material(lamp.material, 0.9),
  );
  pole.position.set(0, 2.9, 0);
  g.add(pole);

  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6),
    material(lamp.material, 0.9),
  );
  arm.position.set(0.4, 5.7, 0);
  arm.rotation.z = Math.PI / 2;
  g.add(arm);

  const emissiveMat = new THREE.MeshStandardMaterial({
    color: lamp.material,
    emissive: lamp.emissive,
    emissiveIntensity: 2.8,
    roughness: 0.35,
  });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.22), emissiveMat);
  panel.position.set(0.45, 5.6, 0);
  g.add(panel);
  emissives.push({ year: cfg.year, material: emissiveMat, color: new THREE.Color(lamp.emissive) });
  return g;
}

function buildLamp(cfg: EraProps, emissives: LampEmissive[]): THREE.Group {
  switch (LAMP_STYLES[cfg.lamp].head) {
    case 'globe':
      return buildGlobeLamp(cfg, emissives);
    case 'cobra':
      return buildCobraLamp(cfg, emissives);
    case 'panel':
    default:
      return buildLedLamp(cfg, emissives);
  }
}

function buildHydrant(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.85, 10),
    material(0xb3202a, 1.0),
  );
  body.position.set(0, 0.42, 0);
  g.add(body);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), material(0xb3202a, 1.0));
  cap.position.set(0, 0.86, 0);
  g.add(cap);
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8),
    material(0x8a6f2f, 1.0),
  );
  nozzle.position.set(0.18, 0.6, 0);
  nozzle.rotation.z = Math.PI / 2;
  g.add(nozzle);
  return g;
}

function buildPhoneBooth(): THREE.Group {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 2.2, 0.06),
    material(0x3a5a78, 0.5),
  );
  frame.position.set(0, 1.1, 0);
  g.add(frame);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 2.0, 0.04),
    material(0x9fc2d8, 0.2),
  );
  glass.position.set(0, 1.1, 0.02);
  g.add(glass);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.08, 0.5),
    material(0x2e3a4a, 0.6),
  );
  roof.position.set(0, 2.2, 0);
  g.add(roof);
  const phone = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.05),
    material(0x22262a, 0.4),
  );
  phone.position.set(0, 1.35, 0.06);
  g.add(phone);
  return g;
}

function buildParkingMeter(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6),
    material(0x5a5a5a, 0.9),
  );
  pole.position.set(0, 0.55, 0);
  g.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.12), material(0x7a7a7a, 0.7));
  head.position.set(0, 1.15, 0);
  g.add(head);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.02), material(0xcfd6dd, 0.3));
  face.position.set(0, 1.18, 0.07);
  g.add(face);
  return g;
}

function buildBench(): THREE.Group {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.5), material(0x6b4a2f, 0.9));
  seat.position.set(0, 0.5, 0);
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 0.06), material(0x6b4a2f, 0.9));
  back.position.set(0, 0.85, -0.22);
  g.add(back);
  for (const z of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.4), material(0x4a4a4a, 0.8));
    leg.position.set(-0.6, 0.25, z);
    g.add(leg);
    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.4), material(0x4a4a4a, 0.8));
    leg2.position.set(0.6, 0.25, z);
    g.add(leg2);
  }
  return g;
}

function buildTrashCan(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.3, 0.8, 10),
    material(0x3f4a3a, 0.9),
  );
  body.position.set(0, 0.4, 0);
  g.add(body);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6), material(0x4a5545, 0.9));
  lid.position.set(0, 0.82, 0);
  lid.rotation.x = Math.PI;
  g.add(lid);
  return g;
}

function buildTree(growth: number): THREE.Group {
  const g = new THREE.Group();
  const trunkH = 1.6 + growth * 1.6;
  const trunkR = 0.1 + growth * 0.12;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, 8),
    material(0x5a4430, 0.95),
  );
  trunk.position.set(0, trunkH / 2, 0);
  g.add(trunk);
  const canopyR = 0.9 + growth * 1.1;
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(canopyR, 12, 10),
    material(0x3f6b32, 1.0),
  );
  canopy.position.set(0, trunkH + canopyR * 0.6, 0);
  g.add(canopy);
  return g;
}

function buildBikeRack(): THREE.Group {
  const g = new THREE.Group();
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), material(0x9aa0a6, 0.7));
  rail.position.set(0, 0.85, 0);
  g.add(rail);
  for (const z of [-0.4, 0.4]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 6), material(0x9aa0a6, 0.7));
    leg.position.set(0, 0.42, z);
    g.add(leg);
  }
  return g;
}

function buildEVCharger(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.3), material(0x1f2937, 0.6));
  body.position.set(0, 0.55, 0);
  g.add(body);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.03), material(0x0c0e12, 0.2));
  screen.position.set(0, 0.8, 0.16);
  g.add(screen);
  const glow = new THREE.MeshStandardMaterial({ color: 0x1f2937, emissive: 0x00d1ff, emissiveIntensity: 1.8 });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.02), glow);
  strip.position.set(0, 0.62, 0.16);
  g.add(strip);
  return g;
}

function buildLitter(count: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const size = 0.04 + (i % 3) * 0.015;
    const paper = new THREE.Mesh(
      new THREE.BoxGeometry(size, 0.015, size * 0.7),
      material([0xcfd6dd, 0xb8bcc2, 0x9c8f7a, 0x7a8a9a][i % 4], 0.6),
    );
    paper.position.set((i % 5) * 0.3 - 0.6, 0.01, (i % 2 === 0 ? 1 : -1) * (0.2 + 0.4 * (i % 3)));
    paper.rotation.y = i * 0.9;
    g.add(paper);
  }
  return g;
}

function buildGraffiti(level: 0 | 1 | 2 | 3): THREE.Group {
  const g = new THREE.Group();
  if (level === 0) {
    return g;
  }
  // A low retaining wall that tags get painted on.
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6.0, 1.1, 0.15), material(0x8a8378, 0.9));
  wall.position.set(0, 0.55, 0);
  g.add(wall);
  const colors = [0xe0457b, 0x2f86c8, 0xf2c13b, 0x7a4fd0, 0x3fb26f, 0xe56b1f];
  const tags = level * 4;
  for (let i = 0; i < tags; i++) {
    const tag = new THREE.Mesh(
      new THREE.BoxGeometry(0.5 + (i % 3) * 0.2, 0.25 + (i % 2) * 0.2, 0.02),
      material(colors[i % colors.length], 0.5),
    );
    tag.position.set(-2.6 + (i % 5) * 1.3, 0.4 + (i % 2) * 0.35, 0.085);
    g.add(tag);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Era prop set assembly
// ---------------------------------------------------------------------------

/** Build the full street-furniture set for one era. */
function buildEraSet(
  cfg: EraProps,
  emissives: LampEmissive[],
): { group: THREE.Group; ids: StreetPropId[] } {
  const group = new THREE.Group();
  const ids = new Set<StreetPropId>();

  // Sidewalk runs along z; x offsets alternate sides.
  const lane = (i: number, side: -1 | 1) => side * (1.6 + (i % 3) * 0.25);

  for (let i = 0; i < cfg.lampCount; i++) {
    const lamp = buildLamp(cfg, emissives);
    lamp.position.set(lane(i, i % 2 === 0 ? -1 : 1), 0, -10 + i * 6.5);
    group.add(lamp);
  }
  ids.add(cfg.lamp === 'gas' ? 'gasLamp' : cfg.lamp === 'mercury' ? 'mercuryLamp' : cfg.lamp === 'sodium' ? 'sodiumLamp' : 'ledLamp');

  for (let i = 0; i < cfg.hydrants; i++) {
    const h = buildHydrant();
    h.position.set(0.4 + i * 1.2, 0, -9 + i * 7);
    group.add(h);
  }
  ids.add('hydrant');

  for (let i = 0; i < cfg.phoneBooths; i++) {
    const b = buildPhoneBooth();
    b.position.set(-3.2 + (i % 3) * 1.1, 0, -8 + Math.floor(i / 3) * 2.4);
    group.add(b);
  }
  if (cfg.phoneBooths > 0) {
    ids.add('phoneBooth');
  }

  for (let i = 0; i < cfg.meters; i++) {
    const m = buildParkingMeter();
    m.position.set(2.0 + (i % 3) * 0.9, 0, -7 + i * 3.4);
    group.add(m);
  }
  if (cfg.meters > 0) {
    ids.add('parkingMeter');
  }

  for (let i = 0; i < cfg.benches; i++) {
    const b = buildBench();
    b.position.set(-1.8 - (i % 2) * 0.4, 0, -6 + i * 5);
    group.add(b);
  }
  ids.add('bench');

  for (let i = 0; i < cfg.trashCans; i++) {
    const t = buildTrashCan();
    t.position.set(2.6 + i * 0.5, 0, -4 + i * 4);
    group.add(t);
  }
  ids.add('trashCan');

  for (let i = 0; i < cfg.trees; i++) {
    const tree = buildTree(cfg.treeGrowth);
    tree.position.set(lane(i, i % 2 === 0 ? 1 : -1), 0, -11 + i * 5.5);
    group.add(tree);
  }
  ids.add('tree');

  for (let i = 0; i < cfg.bikeRacks; i++) {
    const r = buildBikeRack();
    r.position.set(-2.2 - i * 0.3, 0, -3 + i * 3);
    group.add(r);
  }
  if (cfg.bikeRacks > 0) {
    ids.add('bikeRack');
  }

  for (let i = 0; i < cfg.evChargers; i++) {
    const c = buildEVCharger();
    c.position.set(2.4 + i * 0.6, 0, -1 + i * 2.2);
    group.add(c);
  }
  if (cfg.evChargers > 0) {
    ids.add('evCharger');
  }

  const litter = buildLitter(cfg.litter);
  litter.position.set(0, 0, 8);
  group.add(litter);
  if (cfg.litter > 0) {
    ids.add('litter');
  }

  const graffiti = buildGraffiti(cfg.graffiti);
  graffiti.position.set(0, 0, 11);
  group.add(graffiti);
  if (cfg.graffiti > 0) {
    ids.add('graffiti');
  }

  return { group, ids: [...ids] };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Bootstrap the street props for all five eras and return a lifecycle handle.
 *
 * - Registers the `EraDefinition.streetProps` segment on `eraRegistry` for
 *   each year (runtime fill — the shared foundation files are untouched).
 * - Adds one root group to `scene`; `update(year)` toggles which era's props
 *   are visible.
 * - Collects every lamp emissive material into `lampEmissives` for Phase 4.
 */
export function streetPropsFactory(scene: THREE.Scene): StreetPropsHandle {
  const root = new THREE.Group();
  const lampEmissives: LampEmissive[] = [];
  const eraGroups: Partial<Record<EraKey, THREE.Group>> = {};
  let currentYear: EraKey = 1945;

  // Build + register every era's prop set.
  for (const year of [1945, 1965, 1985, 2005, 2025] as EraKey[]) {
    const cfg = ERA_PROP_SET[year];
    const { group, ids } = buildEraSet(cfg, lampEmissives);
    group.visible = year === 1945;
    eraGroups[year] = group;
    root.add(group);
    // Register the streetProps segment (runtime fill, other fields untouched).
    eraRegistry[year].streetProps = ids;
  }

  scene.add(root);

  const handle: StreetPropsHandle = {
    group: root,
    lampEmissives,
    get currentYear() {
      return currentYear;
    },
    update(year: EraKey): void {
      if (year === currentYear) {
        return;
      }
      eraGroups[currentYear]!.visible = false;
      eraGroups[year]!.visible = true;
      currentYear = year;
    },
    dispose(): void {
      scene.remove(root);
      for (const year of [1945, 1965, 1985, 2005, 2025] as EraKey[]) {
        eraRegistry[year].streetProps = [];
      }
      lampEmissives.length = 0;
    },
  };

  return handle;
}