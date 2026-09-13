/**
 * Street props for one era: traffic lights, fire hydrants, benches, phone
 * booths / kiosks, trash bins, mailboxes, plus litter scatter and graffiti.
 *
 * Hardware styling ages with the timeline and every prop is placed on its
 * real BlockLayout furniture anchor. Litter positions and graffiti placement
 * are procedural but fully deterministic through the seeded RNG.
 *
 * Pure parametric data (meters + hex colors) — renderers consume these specs.
 */

import type { BlockLayout, Point3D } from '../layout';
import type { ColorHex, EraId } from '../../era/types';
import { deriveSeedRng } from './street';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrafficLightResult {
  anchorId: string;
  position: Point3D;
  facing: number;
  housingStyle: string;
  lampTech: 'incandescent' | 'led';
  visorStyle: string;
  lensCount: number;
  housing: { width: number; height: number; depth: number };
  pole: { height: number; color: ColorHex };
  wear: number;
  glow: number;
  graffiti: boolean;
}

export interface HydrantResult {
  anchorId: string;
  position: Point3D;
  facing: number;
  style: 'classic' | 'modern' | 'eco';
  color: ColorHex;
  bodyHeight: number;
  bodyRadius: number;
  outletCount: number;
  chain: boolean;
  cap: 'pointed' | 'flat' | 'smart';
  wear: number;
  graffiti: boolean;
}

export interface BenchSlat {
  index: number;
  offsetX: number;
  offsetY: number;
  width: number;
  depth: number;
  color: ColorHex;
  wear: number;
}

export interface BenchResult {
  anchorId: string;
  position: Point3D;
  facing: number;
  style: 'iron_wood' | 'midcentury' | 'tube' | 'minimal' | 'green';
  frameMaterial: string;
  frameColor: ColorHex;
  length: number;
  depth: number;
  height: number;
  backrest: boolean;
  armrests: boolean;
  planter: boolean;
  slats: BenchSlat[];
  wear: number;
  graffiti: boolean;
}

export type BoothKind = 'phone_booth' | 'info_kiosk' | 'smart_kiosk';

export interface GlazingPanel {
  index: number;
  width: number;
  height: number;
  tint: ColorHex;
  opacity: number;
  mullions: number;
  hasDoor: boolean;
}

export interface KioskScreen {
  type: string;
  width: number;
  height: number;
  brightness: number;
}

export interface BoothResult {
  anchorId: string;
  position: Point3D;
  facing: number;
  kind: BoothKind;
  frameMaterial: string;
  frameColor: ColorHex;
  roof: 'domed' | 'flat' | 'awning' | 'solar';
  glazing: GlazingPanel[];
  interiorTech: string;
  decal: string;
  screen: KioskScreen | null;
  solar: boolean;
  charging: string | null;
  wear: number;
  graffiti: boolean;
}

export interface TrashBinResult {
  anchorId: string;
  position: Point3D;
  facing: number;
  style: 'wire-mesh' | 'drum' | 'slim' | 'smart';
  color: ColorHex;
  material: string;
  height: number;
  diameter: number;
  decal: string;
  solar: boolean;
  wear: number;
  graffiti: boolean;
}

export interface MailboxResult {
  anchorId: string;
  position: Point3D;
  facing: number;
  style: 'classic' | 'modern' | 'streamlined' | 'smart';
  color: ColorHex;
  height: number;
  decal: string;
  solar: boolean;
  wear: number;
  graffiti: boolean;
}

export type LitterKind =
  | 'paper'
  | 'wrapper'
  | 'leaf'
  | 'can'
  | 'bottle'
  | 'newspaper'
  | 'cup'
  | 'receipt'
  | 'butt'
  | 'mask'
  | 'vape';

export interface LitterItem {
  id: string;
  kind: LitterKind;
  position: Point3D;
  rotation: number;
  scale: number;
  color: ColorHex;
}

export type GraffitiSurfaceKind =
  | 'traffic_light'
  | 'fire_hydrant'
  | 'bench'
  | 'booth'
  | 'trash_bin'
  | 'mailbox'
  | 'lamp_post';

export interface GraffitiMark {
  id: string;
  surfaceKind: GraffitiSurfaceKind;
  anchorId: string;
  position: Point3D;
  color: ColorHex;
  size: number;
  tag: string;
}

export interface LitterResult {
  /** 0..1 overall street-cleaning state (higher = dirtier). */
  density: number;
  items: LitterItem[];
  graffiti: GraffitiMark[];
}

export interface FurniturePropsResult {
  trafficLights: TrafficLightResult[];
  hydrants: HydrantResult[];
  benches: BenchResult[];
  booths: BoothResult[];
  bins: TrashBinResult[];
  mailboxes: MailboxResult[];
  litter: LitterResult;
}

// ---------------------------------------------------------------------------
// Per-era prop character
// ---------------------------------------------------------------------------

interface EraPropsSpec {
  trafficLight: {
    housingStyle: string;
    lampTech: 'incandescent' | 'led';
    visorStyle: string;
    housingWidth: number;
    housingHeight: number;
    housingDepth: number;
    poleHeight: number;
    poleColor: ColorHex;
    wear: number;
    glow: number;
  };
  hydrant: {
    style: 'classic' | 'modern' | 'eco';
    color: ColorHex;
    bodyHeight: number;
    bodyRadius: number;
    chain: boolean;
    cap: 'pointed' | 'flat' | 'smart';
    wear: number;
  };
  bench: {
    style: 'iron_wood' | 'midcentury' | 'tube' | 'minimal' | 'green';
    frameMaterial: string;
    frameColor: ColorHex;
    slatCount: number;
    woodColor: ColorHex;
    length: number;
    depth: number;
    height: number;
    backrest: boolean;
    armrests: boolean;
    planter: boolean;
    wear: number;
  };
  booth: {
    kind: BoothKind;
    frameMaterial: string;
    frameColor: ColorHex;
    roof: 'domed' | 'flat' | 'awning' | 'solar';
    glazingPanels: number;
    interiorTech: string;
    decal: string;
    screen: KioskScreen | null;
    solar: boolean;
    charging: string | null;
    wear: number;
  };
  bin: {
    style: 'wire-mesh' | 'drum' | 'slim' | 'smart';
    color: ColorHex;
    material: string;
    height: number;
    diameter: number;
    decal: string;
    solar: boolean;
    wear: number;
  };
  mailbox: {
    style: 'classic' | 'modern' | 'streamlined' | 'smart';
    color: ColorHex;
    height: number;
    decal: string;
    solar: boolean;
    wear: number;
  };
  litter: {
    density: number;
    count: number;
    kinds: LitterKind[];
    graffitiTarget: number;
    graffitiTags: readonly string[];
    graffitiColors: readonly ColorHex[];
  };
}

const ERA_PROPS_SPECS: Record<EraId, EraPropsSpec> = {
  1945: {
    trafficLight: {
      housingStyle: 'cast_incandescent',
      lampTech: 'incandescent',
      visorStyle: 'round',
      housingWidth: 0.5,
      housingHeight: 0.72,
      housingDepth: 0.5,
      poleHeight: 4.8,
      poleColor: '#2f2a28',
      wear: 0.25,
      glow: 0.35,
    },
    hydrant: { style: 'classic', color: '#b5402e', bodyHeight: 1.1, bodyRadius: 0.14, chain: true, cap: 'pointed', wear: 0.3 },
    bench: {
      style: 'iron_wood',
      frameMaterial: 'cast-iron',
      frameColor: '#2f2a28',
      slatCount: 5,
      woodColor: '#8a6a4a',
      length: 1.8,
      depth: 0.5,
      height: 0.85,
      backrest: true,
      armrests: true,
      planter: false,
      wear: 0.35,
    },
    booth: {
      kind: 'phone_booth',
      frameMaterial: 'cast-iron',
      frameColor: '#8f3a28',
      roof: 'domed',
      glazingPanels: 3,
      interiorTech: 'incandescent',
      decal: 'TELEPHONE',
      screen: null,
      solar: false,
      charging: null,
      wear: 0.3,
    },
    bin: { style: 'wire-mesh', color: '#4a4a48', material: 'steel-mesh', height: 1.15, diameter: 0.5, decal: '', solar: false, wear: 0.4 },
    mailbox: { style: 'classic', color: '#2f5f9e', height: 1.2, decal: 'US MAIL', solar: false, wear: 0.35 },
    litter: {
      density: 0.05,
      count: 10,
      kinds: ['paper', 'wrapper', 'leaf'],
      graffitiTarget: 0,
      graffitiTags: [],
      graffitiColors: [],
    },
  },
  1965: {
    trafficLight: {
      housingStyle: 'round_incandescent',
      lampTech: 'incandescent',
      visorStyle: 'round',
      housingWidth: 0.44,
      housingHeight: 0.66,
      housingDepth: 0.42,
      poleHeight: 5.2,
      poleColor: '#5a5a5e',
      wear: 0.15,
      glow: 0.45,
    },
    hydrant: { style: 'classic', color: '#d4552e', bodyHeight: 1.0, bodyRadius: 0.14, chain: true, cap: 'pointed', wear: 0.12 },
    bench: {
      style: 'midcentury',
      frameMaterial: 'aluminum+teak',
      frameColor: '#c8ccd0',
      slatCount: 5,
      woodColor: '#a4825c',
      length: 1.9,
      depth: 0.5,
      height: 0.8,
      backrest: true,
      armrests: false,
      planter: false,
      wear: 0.15,
    },
    booth: {
      kind: 'phone_booth',
      frameMaterial: 'aluminum',
      frameColor: '#c8ccd0',
      roof: 'flat',
      glazingPanels: 4,
      interiorTech: 'incandescent',
      decal: 'BELL',
      screen: null,
      solar: false,
      charging: null,
      wear: 0.15,
    },
    bin: { style: 'drum', color: '#4f8a4f', material: 'painted-metal', height: 1.0, diameter: 0.55, decal: '', solar: false, wear: 0.2 },
    mailbox: { style: 'classic', color: '#2f5f9e', height: 1.2, decal: 'US MAIL', solar: false, wear: 0.2 },
    litter: {
      density: 0.09,
      count: 16,
      kinds: ['paper', 'can', 'wrapper'],
      graffitiTarget: 1,
      graffitiTags: ['KIDZ'],
      graffitiColors: ['#f2c531'],
    },
  },
  1985: {
    trafficLight: {
      housingStyle: 'square_incandescent',
      lampTech: 'incandescent',
      visorStyle: 'square',
      housingWidth: 0.4,
      housingHeight: 0.62,
      housingDepth: 0.4,
      poleHeight: 5.8,
      poleColor: '#3f3f44',
      wear: 0.55,
      glow: 0.5,
    },
    hydrant: { style: 'modern', color: '#c23a26', bodyHeight: 0.95, bodyRadius: 0.15, chain: false, cap: 'flat', wear: 0.5 },
    bench: {
      style: 'tube',
      frameMaterial: 'steel',
      frameColor: '#6b6b6e',
      slatCount: 4,
      woodColor: '#8a7a5a',
      length: 1.8,
      depth: 0.48,
      height: 0.8,
      backrest: true,
      armrests: true,
      planter: false,
      wear: 0.45,
    },
    booth: {
      kind: 'phone_booth',
      frameMaterial: 'steel',
      frameColor: '#7a7a7e',
      roof: 'flat',
      glazingPanels: 4,
      interiorTech: 'fluorescent',
      decal: 'PAC TEL',
      screen: null,
      solar: false,
      charging: null,
      wear: 0.5,
    },
    bin: { style: 'drum', color: '#6b6b6e', material: 'plastic', height: 0.95, diameter: 0.6, decal: '', solar: false, wear: 0.5 },
    mailbox: { style: 'modern', color: '#3d6fa8', height: 1.25, decal: 'USPS', solar: false, wear: 0.3 },
    litter: {
      density: 0.3,
      count: 42,
      kinds: ['can', 'bottle', 'wrapper', 'paper', 'newspaper'],
      graffitiTarget: 8,
      graffitiTags: ['SPRAY', 'NO FUTURE', 'COBRA', 'STATIC'],
      graffitiColors: ['#ff2bd6', '#00e5ff', '#f4f4f4', '#ffd27d'],
    },
  },
  2005: {
    trafficLight: {
      housingStyle: 'led_module',
      lampTech: 'led',
      visorStyle: 'flat',
      housingWidth: 0.38,
      housingHeight: 0.58,
      housingDepth: 0.35,
      poleHeight: 6.2,
      poleColor: '#3c3c40',
      wear: 0.1,
      glow: 0.8,
    },
    hydrant: { style: 'modern', color: '#3d8b8d', bodyHeight: 0.9, bodyRadius: 0.15, chain: false, cap: 'flat', wear: 0.15 },
    bench: {
      style: 'minimal',
      frameMaterial: 'steel+glass',
      frameColor: '#9aa0a6',
      slatCount: 4,
      woodColor: '#9a8a6a',
      length: 2.0,
      depth: 0.5,
      height: 0.8,
      backrest: true,
      armrests: false,
      planter: false,
      wear: 0.1,
    },
    booth: {
      kind: 'info_kiosk',
      frameMaterial: 'steel+glass',
      frameColor: '#9aa0a6',
      roof: 'awning',
      glazingPanels: 0,
      interiorTech: 'none',
      decal: 'CITY INFO',
      screen: { type: 'lcd', width: 0.9, height: 0.6, brightness: 0.7 },
      solar: false,
      charging: null,
      wear: 0.12,
    },
    bin: { style: 'slim', color: '#9aa0a6', material: 'aluminum', height: 1.1, diameter: 0.45, decal: 'RECYCLE', solar: false, wear: 0.1 },
    mailbox: { style: 'streamlined', color: '#5a7fae', height: 1.3, decal: 'USPS', solar: false, wear: 0.12 },
    litter: {
      density: 0.18,
      count: 26,
      kinds: ['cup', 'bottle', 'wrapper', 'receipt', 'butt'],
      graffitiTarget: 3,
      graffitiTags: ['TAG', 'WALL', 'SK8'],
      graffitiColors: ['#1f6feb', '#b9c4cc'],
    },
  },
  2025: {
    trafficLight: {
      housingStyle: 'modern_led',
      lampTech: 'led',
      visorStyle: 'flat_slim',
      housingWidth: 0.34,
      housingHeight: 0.52,
      housingDepth: 0.3,
      poleHeight: 6.6,
      poleColor: '#40444a',
      wear: 0.05,
      glow: 0.95,
    },
    hydrant: { style: 'eco', color: '#2e9e5e', bodyHeight: 0.85, bodyRadius: 0.16, chain: false, cap: 'smart', wear: 0.05 },
    bench: {
      style: 'green',
      frameMaterial: 'recycled-wood+steel',
      frameColor: '#7fbf9c',
      slatCount: 5,
      woodColor: '#a8824a',
      length: 2.1,
      depth: 0.55,
      height: 0.85,
      backrest: true,
      armrests: true,
      planter: true,
      wear: 0.04,
    },
    booth: {
      kind: 'smart_kiosk',
      frameMaterial: 'aluminum+green',
      frameColor: '#6fae8f',
      roof: 'solar',
      glazingPanels: 0,
      interiorTech: 'none',
      decal: 'CITY 5G',
      screen: { type: 'led_touch', width: 1.0, height: 0.65, brightness: 0.9 },
      solar: true,
      charging: 'usb-c',
      wear: 0.03,
    },
    bin: { style: 'smart', color: '#2e9e5e', material: 'composite', height: 1.2, diameter: 0.6, decal: 'CLEAN CITY', solar: true, wear: 0.03 },
    mailbox: { style: 'smart', color: '#3d8b8d', height: 1.3, decal: 'USPS', solar: true, wear: 0.04 },
    litter: {
      density: 0.1,
      count: 14,
      kinds: ['cup', 'mask', 'butt', 'wrapper', 'vape'],
      graffitiTarget: 0,
      graffitiTags: [],
      graffitiColors: [],
    },
  },
};

const LITTER_KIND_COLORS: Record<LitterKind, readonly ColorHex[]> = {
  paper: ['#d8d2c4', '#c9c4b4'],
  wrapper: ['#b03a2e', '#f2c531', '#a8d8e8'],
  leaf: ['#7d9a4a', '#a6763a', '#c9a03c'],
  can: ['#b8bcc0', '#d4552e'],
  bottle: ['#2e6e8f', '#4f8f3f', '#7a7a7a'],
  newspaper: ['#c8c2b0', '#d8d2c0'],
  cup: ['#f4f1e8', '#e8dcc8'],
  receipt: ['#f4f4f4'],
  butt: ['#e8dcc0', '#d8c8a8'],
  mask: ['#cfd6dc', '#9fd8c8'],
  vape: ['#4a4a4e', '#7fbf9c'],
};

// ---------------------------------------------------------------------------
// Item builders
// ---------------------------------------------------------------------------

function buildTrafficLights(layout: BlockLayout, spec: EraPropsSpec): TrafficLightResult[] {
  const t = spec.trafficLight;
  return layout.getAnchorsByKind('traffic_light').map((anchor) => ({
    anchorId: anchor.id,
    position: anchor.position,
    facing: anchor.facing,
    housingStyle: t.housingStyle,
    lampTech: t.lampTech,
    visorStyle: t.visorStyle,
    lensCount: 3,
    housing: { width: t.housingWidth, height: t.housingHeight, depth: t.housingDepth },
    pole: { height: t.poleHeight, color: t.poleColor },
    wear: t.wear,
    glow: t.glow,
    graffiti: false,
  }));
}

function buildHydrants(layout: BlockLayout, spec: EraPropsSpec, seed: number): HydrantResult[] {
  const h = spec.hydrant;
  const rng = deriveSeedRng(seed, 'hydrants');
  return layout.getAnchorsByKind('fire_hydrant').map((anchor) => ({
    anchorId: anchor.id,
    position: anchor.position,
    facing: anchor.facing,
    style: h.style,
    color: h.color,
    bodyHeight: h.bodyHeight + rng.range(-0.02, 0.02),
    bodyRadius: h.bodyRadius,
    outletCount: 2,
    chain: h.chain,
    cap: h.cap,
    wear: h.wear + rng.range(-0.05, 0.05),
    graffiti: false,
  }));
}

function buildBenches(layout: BlockLayout, spec: EraPropsSpec, seed: number): BenchResult[] {
  const b = spec.bench;
  const rng = deriveSeedRng(seed, 'benches');
  const woodTones: readonly ColorHex[] = [b.woodColor, '#7d6344'];
  const results: BenchResult[] = [];
  for (const anchor of layout.getAnchorsByKind('bench')) {
    const slats: BenchSlat[] = [];
    for (let i = 0; i < b.slatCount; i += 1) {
      slats.push({
        index: i,
        offsetX: (i - (b.slatCount - 1) / 2) * 0.16,
        offsetY: b.height * 0.16 + i * 0.075,
        width: b.length * 0.92,
        depth: 0.05,
        color: rng.pick(woodTones),
        wear: Math.max(0, b.wear + rng.range(-0.08, 0.08)),
      });
    }
    results.push({
      anchorId: anchor.id,
      position: anchor.position,
      facing: anchor.facing,
      style: b.style,
      frameMaterial: b.frameMaterial,
      frameColor: b.frameColor,
      length: b.length,
      depth: b.depth,
      height: b.height,
      backrest: b.backrest,
      armrests: b.armrests,
      planter: b.planter,
      slats,
      wear: b.wear,
      graffiti: false,
    });
  }
  return results;
}

function buildBooths(layout: BlockLayout, era: EraId, spec: EraPropsSpec): BoothResult[] {
  const bo = spec.booth;
  const panelWidth = bo.kind === 'phone_booth' ? 0.68 : 0;
  const panelHeight = bo.kind === 'phone_booth' ? 2.1 : 0;
  const tintByEra: Record<EraId, { tint: ColorHex; opacity: number }> = {
    1945: { tint: '#b9c9b4', opacity: 0.82 },
    1965: { tint: '#cfd6dc', opacity: 0.88 },
    1985: { tint: '#a9b0b4', opacity: 0.92 },
    2005: { tint: '#cfd6dc', opacity: 0.9 },
    2025: { tint: '#cfd6dc', opacity: 0.9 },
  };
  const glazingStyle = tintByEra[era];
  return layout.getAnchorsByKind('booth').map((anchor) => {
    const glazing: GlazingPanel[] = [];
    for (let g = 0; g < bo.glazingPanels; g += 1) {
      glazing.push({
        index: g,
        width: panelWidth,
        height: panelHeight,
        tint: glazingStyle.tint,
        opacity: glazingStyle.opacity,
        mullions: 2,
        hasDoor: g === 1,
      });
    }
    return {
      anchorId: anchor.id,
      position: anchor.position,
      facing: anchor.facing,
      kind: bo.kind,
      frameMaterial: bo.frameMaterial,
      frameColor: bo.frameColor,
      roof: bo.roof,
      glazing,
      interiorTech: bo.interiorTech,
      decal: bo.decal,
      screen: bo.screen === null ? null : { ...bo.screen },
      solar: bo.solar,
      charging: bo.charging,
      wear: bo.wear,
      graffiti: false,
    };
  });
}

function buildBins(layout: BlockLayout, spec: EraPropsSpec): TrashBinResult[] {
  const b = spec.bin;
  return layout.getAnchorsByKind('trash_bin').map((anchor) => ({
    anchorId: anchor.id,
    position: anchor.position,
    facing: anchor.facing,
    style: b.style,
    color: b.color,
    material: b.material,
    height: b.height,
    diameter: b.diameter,
    decal: b.decal,
    solar: b.solar,
    wear: b.wear,
    graffiti: false,
  }));
}

function buildMailboxes(layout: BlockLayout, spec: EraPropsSpec): MailboxResult[] {
  const m = spec.mailbox;
  return layout.getAnchorsByKind('mailbox').map((anchor) => ({
    anchorId: anchor.id,
    position: anchor.position,
    facing: anchor.facing,
    style: m.style,
    color: m.color,
    height: m.height,
    decal: m.decal,
    solar: m.solar,
    wear: m.wear,
    graffiti: false,
  }));
}

// ---------------------------------------------------------------------------
// Litter & graffiti
// ---------------------------------------------------------------------------

function buildLitter(layout: BlockLayout, era: EraId, seed: number, spec: EraPropsSpec): LitterResult {
  const rng = deriveSeedRng(seed, 'litter');
  const items: LitterItem[] = [];
  const bands = layout.sidewalkBands;
  for (let i = 0; i < spec.litter.count; i += 1) {
    const band = bands[i % bands.length]!;
    const kind = rng.pick(spec.litter.kinds);
    items.push({
      id: `litter-${era}-${i}`,
      kind,
      position: {
        x: rng.range(band.bounds.minX + 0.4, band.bounds.maxX - 0.4),
        y: band.elevation + 0.012,
        z: rng.range(band.bounds.minZ + 0.4, band.bounds.maxZ - 0.4),
      },
      rotation: rng.range(0, Math.PI * 2),
      scale: rng.range(0.7, 1.25),
      color: rng.pick(LITTER_KIND_COLORS[kind]),
    });
  }

  // Graffiti is placed deterministically on `graffitiTarget` distinct surfaces
  // spread across every fixture kind (coprime stepping so early eras don't
  // only decorate benches).
  const surfaces: Array<{ surfaceKind: GraffitiSurfaceKind; anchorId: string; position: Point3D }> = [];
  const allSurfaces: Array<Array<{ surfaceKind: GraffitiSurfaceKind; anchorId: string; position: Point3D }>> = [
    layout.getAnchorsByKind('traffic_light').map((a) => ({ surfaceKind: 'traffic_light' as const, anchorId: a.id, position: a.position })),
    layout.getAnchorsByKind('fire_hydrant').map((a) => ({ surfaceKind: 'fire_hydrant' as const, anchorId: a.id, position: a.position })),
    layout.getAnchorsByKind('bench').map((a) => ({ surfaceKind: 'bench' as const, anchorId: a.id, position: a.position })),
    layout.getAnchorsByKind('booth').map((a) => ({ surfaceKind: 'booth' as const, anchorId: a.id, position: a.position })),
    layout.getAnchorsByKind('trash_bin').map((a) => ({ surfaceKind: 'trash_bin' as const, anchorId: a.id, position: a.position })),
    layout.getAnchorsByKind('mailbox').map((a) => ({ surfaceKind: 'mailbox' as const, anchorId: a.id, position: a.position })),
  ];
  for (const group of allSurfaces) {
    group.sort((a, b) => (a.anchorId < b.anchorId ? -1 : a.anchorId > b.anchorId ? 1 : 0));
    surfaces.push(...group);
  }

  const graffiti: GraffitiMark[] = [];
  const tagged = new Set<string>();
  const STEP = 7; // coprime with the pool size, spreads tags across kinds
  for (let i = 0; i < spec.litter.graffitiTarget; i += 1) {
    const surface = surfaces[(i * STEP) % surfaces.length]!;
    tagged.add(surface.anchorId);
    const grng = deriveSeedRng(seed, `graffiti:${i}:${surface.anchorId}`);
    graffiti.push({
      id: `graffiti-${era}-${i}`,
      surfaceKind: surface.surfaceKind,
      anchorId: surface.anchorId,
      position: {
        x: surface.position.x + grng.range(-0.35, 0.35),
        y: surface.position.y + 0.25 + grng.range(-0.15, 0.2),
        z: surface.position.z + grng.range(-0.35, 0.35),
      },
      color: grng.pick(spec.litter.graffitiColors),
      size: grng.range(0.5, 1.4),
      tag: spec.litter.graffitiTags[i % spec.litter.graffitiTags.length]!,
    });
  }

  return { density: spec.litter.density, items, graffiti };
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Build every street prop for one era, plus the litter/graffiti layer.
 * Deterministic for a given seed.
 */
export function buildFurnitureProps(layout: BlockLayout, era: EraId, seed: number): FurniturePropsResult {
  const spec = ERA_PROPS_SPECS[era];
  const trafficLights = buildTrafficLights(layout, spec);
  const hydrants = buildHydrants(layout, spec, seed);
  const benches = buildBenches(layout, spec, seed);
  const booths = buildBooths(layout, era, spec);
  const bins = buildBins(layout, spec);
  const mailboxes = buildMailboxes(layout, spec);
  const litter = buildLitter(layout, era, seed, spec);

  const tagged = new Set(litter.graffiti.map((mark) => mark.anchorId));
  for (const item of trafficLights) {
    item.graffiti = tagged.has(item.anchorId);
  }
  for (const item of hydrants) {
    item.graffiti = tagged.has(item.anchorId);
  }
  for (const item of benches) {
    item.graffiti = tagged.has(item.anchorId);
  }
  for (const item of booths) {
    item.graffiti = tagged.has(item.anchorId);
  }
  for (const item of bins) {
    item.graffiti = tagged.has(item.anchorId);
  }
  for (const item of mailboxes) {
    item.graffiti = tagged.has(item.anchorId);
  }

  return { trafficLights, hydrants, benches, booths, bins, mailboxes, litter };
}