/**
 * Era-evolving street furniture: lamps, hydrants, mailboxes, bins, benches,
 * bus stops, parking meters to EV chargers, phone booths to kiosks to wifi
 * pylons, telegraph poles and vanishing overhead wires, tree pits,
 * bollards, and scaffolding.
 *
 * Structure per channel (`furniture` or `lighting`):
 *
 *   channelRoot
 *     └── prop:<kind>            (one pickable object per kind)
 *           └── slot:<i>         (anchored at the pinned base surface y)
 *                 └── era:<year> (lifted by that era's paving, frozen scale)
 *                       └── procedural prop meshes
 *
 * Instanced kinds (bins, meters, chargers, bollards, poles) instead build one
 * `InstancedMesh` per era with per-slot matrices baked at the era surface, so
 * repeated props stay near 60fps while still swapping with the era.
 *
 * Every material is produced by the shared procedural gfx library (canvas
 * textures + era palettes); no models or images are downloaded. Prop sounds
 * are not owned here — the module only emits documented hook events that the
 * audio task consumes (see `src/city/street/index.ts`).
 */

import * as THREE from 'three';
import {
  ProceduralGfxLibrary,
  createEraMaterial,
  createPRNG,
  createProceduralTexture,
  type PRNG,
  type ProceduralTextureType,
} from '../../gfx/materials';
import type { MaterialCategory } from '../../gfx/palettes';
import { createBeveledBoxGeometry, mergeBufferGeometries } from '../../gfx/geometry';
import { batchSetTransforms, createInstancedMesh, type InstanceTransform } from '../../gfx/instancing';
import {
  LIGHTING_PROP_KINDS,
  PROP_SURFACE,
  STREET_ERAS,
  STREET_LAYOUT,
  erasPresent,
  propVariant,
  slotsFor,
  type StreetEra,
  type StreetPropKind,
  type StreetPropVariant,
  type StreetSlot,
} from './variants';
import {
  ROAD_SURFACE_Y,
  SIDEWALK_TOP_Y,
  StreetEraLayer,
  applyEraDepthPolicy,
  eraPropScale,
  roadSurfaceY,
  sidewalkSurfaceY,
} from './roadway';

// Palette accessors are published through the shared library root export.
const { getEraPalette, getMaterialSwatch } = ProceduralGfxLibrary;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A pickable hero prop. Structurally compatible with the navigation module's
 * `PickableDescriptor` (`id`, `object`, optional focus hints), plus the era
 * metadata the integration owner needs for era-aware callout content.
 */
export interface StreetPickableDescriptor {
  /** Stable id, e.g. `street:phone-booth`. */
  readonly id: string;
  /** Prop kind this descriptor tracks across all eras. */
  readonly kind: StreetPropKind;
  /** Raycast target: the kind group containing every era variant. */
  readonly object: THREE.Object3D;
  /** Display label (from the most recent era where the prop exists). */
  readonly label: string;
  /** Eras in which the prop exists. */
  readonly eras: readonly StreetEra[];
  /** Suggested straight-line framing distance for focus flights. */
  readonly focusDistance?: number;
  /** Suggested eye height for the focus viewpoint. */
  readonly focusHeight?: number;
}

/** Options for `buildStreetFurniture`. */
export interface StreetFurnitureOptions {
  /** Which choreography channel to build: furniture swaps or lighting/line infrastructure. */
  readonly channel: 'furniture' | 'lighting';
  /** PRNG seed offset for deterministic wear/placement jitter. */
  readonly seed?: number;
}

/** Result of `buildStreetFurniture`. */
export interface FurnitureBuild {
  /** Channel root group. */
  readonly root: THREE.Group;
  /** Era layers for crossfading (five per channel). */
  readonly layers: readonly StreetEraLayer[];
  /** Hero props exposed as pickable descriptors (empty for the lighting channel). */
  readonly pickables: readonly StreetPickableDescriptor[];
}

/** Repeated prop kinds rendered with InstancedMesh per era. */
export const INSTANCED_STREET_KINDS: readonly StreetPropKind[] = [
  'litterBin',
  'parkingMeter',
  'evCharger',
  'bollard',
  'telegraphPole',
];

/** Hero kinds exposed as pickable descriptors. */
export const HERO_PICKABLE_KINDS: readonly StreetPropKind[] = [
  'phoneBooth',
  'evCharger',
  'payStation',
  'streetKiosk',
  'wifiPylon',
  'busStop',
];

// ---------------------------------------------------------------------------
// Build context & material factory (all materials via the gfx library)
// ---------------------------------------------------------------------------

interface BuildCtx {
  readonly era: StreetEra;
  readonly variant: StreetPropVariant;
  readonly rng: PRNG;
  readonly layer: StreetEraLayer;
  readonly materialCache: Map<string, THREE.MeshStandardMaterial>;
}

interface PropMaterialOptions {
  readonly category?: MaterialCategory;
  readonly color?: string;
  readonly texture?: ProceduralTextureType | 'none';
  readonly roughness?: number;
  readonly metalness?: number;
  readonly opacity?: number;
  readonly repeat?: number;
  readonly weathering?: number;
  readonly emissive?: string;
  readonly emissiveIntensity?: number;
}

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 997;
}

function defaultTexture(category: MaterialCategory): ProceduralTextureType | 'none' {
  switch (category) {
    case 'metal':
      return 'metal';
    case 'wood':
      return 'wood';
    case 'fabric':
      return 'fabric';
    case 'masonryConcrete':
    case 'asphaltStone':
      return 'concrete';
    case 'paintSignage':
      return 'signage';
    case 'neonEmissive':
      return 'neon';
    default:
      return 'none';
  }
}

/**
 * Era-true prop material, cached per (era, key) and registered with the era
 * layer so its opacity crossfades with the era weight.
 */
function propMaterial(
  ctx: BuildCtx,
  key: string,
  options: PropMaterialOptions = {},
): THREE.MeshStandardMaterial {
  const cacheKey = `${ctx.era}:${key}`;
  const cached = ctx.materialCache.get(cacheKey);
  if (cached) {
    ctx.layer.addMaterial(cached);
    return cached;
  }

  const category = options.category ?? 'metal';
  const swatch = getMaterialSwatch(ctx.era, category);
  const color = options.color ?? swatch.color;
  const texture = options.texture ?? defaultTexture(category);
  const map =
    texture === 'none'
      ? undefined
      : createProceduralTexture(texture, {
          primaryColor: color,
          seed: ctx.era + hashKey(key),
          weathering: options.weathering ?? swatch.grime * 0.5,
          repeatX: options.repeat ?? 1,
          repeatY: options.repeat ?? 1,
        });

  const params: THREE.MeshStandardMaterialParameters = {
    color,
    roughness: options.roughness ?? swatch.roughness,
    metalness: options.metalness ?? swatch.metalness,
    opacity: options.opacity ?? 1,
    transparent: true,
  };
  if (map) params.map = map;
  const material = new THREE.MeshStandardMaterial(params);
  if (options.emissive) {
    material.emissive = new THREE.Color(options.emissive);
    material.emissiveIntensity = options.emissiveIntensity ?? 1;
  }
  applyEraDepthPolicy(material, ctx.era);
  ctx.materialCache.set(cacheKey, material);
  ctx.layer.addMaterial(material);
  return material;
}

/** Era signage material straight from the shared library's signage texture. */
function signageMaterial(ctx: BuildCtx, key: string): THREE.MeshStandardMaterial {
  const cacheKey = `${ctx.era}:${key}`;
  const cached = ctx.materialCache.get(cacheKey);
  if (cached) {
    ctx.layer.addMaterial(cached);
    return cached;
  }
  const material = createEraMaterial('paintSignage', ctx.era, {
    repeatX: 2,
    repeatY: 1,
    seed: ctx.era + hashKey(key),
  });
  material.transparent = true;
  applyEraDepthPolicy(material, ctx.era);
  ctx.materialCache.set(cacheKey, material);
  ctx.layer.addMaterial(material);
  return material;
}

// ---------------------------------------------------------------------------
// Small geometry/mesh helpers
// ---------------------------------------------------------------------------

const box = (w: number, h: number, d: number): THREE.BoxGeometry => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 12): THREE.CylinderGeometry =>
  new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r: number, w = 12, h = 9): THREE.SphereGeometry => new THREE.SphereGeometry(r, w, h);
const cone = (r: number, h: number, seg = 12): THREE.ConeGeometry =>
  new THREE.ConeGeometry(r, h, seg);
const torus = (r: number, t: number, radial = 6, tubular = 16): THREE.TorusGeometry =>
  new THREE.TorusGeometry(r, t, radial, tubular);

function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeBufferGeometries(list);
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  if (name) mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Coil phone-cord tube (a small but high-value detail on hero booths). */
function coilCord(turns: number, radius: number, height: number): THREE.TubeGeometry {
  const points: THREE.Vector3[] = [];
  const steps = turns * 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, -t * height, Math.sin(a) * radius));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps, 0.014, 5);
}

// ---------------------------------------------------------------------------
// Prop builders (grouped, non-instanced kinds)
// ---------------------------------------------------------------------------

const LAMP_GLOW_BY_STYLE: Readonly<Record<string, { color: string; intensity: number }>> = {
  'gas-lantern-electric-mix': { color: '#ffb347', intensity: 2.4 },
  'ornate-electric-globe': { color: '#ffedd2', intensity: 1.6 },
  'utilitarian-cobra-head': { color: '#ffd9a0', intensity: 2.0 },
  'streamlined-cobra': { color: '#fff3dd', intensity: 2.2 },
  'led-column': { color: '#eaf4ff', intensity: 2.6 },
};

function buildLamp(ctx: BuildCtx, parent: THREE.Object3D, slotIndex: number): void {
  const poleMat = propMaterial(ctx, 'lamp.pole', { category: 'metal', roughness: 0.55 });
  const glowSpec = LAMP_GLOW_BY_STYLE[ctx.variant.style] ?? LAMP_GLOW_BY_STYLE['led-column'];
  const glowMat = propMaterial(ctx, 'lamp.glow', {
    category: 'glass',
    texture: 'none',
    color: '#fff6df',
    roughness: 0.3,
    metalness: 0,
    emissive: glowSpec.color,
    emissiveIntensity: glowSpec.intensity,
    opacity: 0.96,
  });

  addMesh(parent, cyl(0.16, 0.21, 0.18, 12).translate(0, 0.09, 0), poleMat);

  switch (ctx.variant.style) {
    case 'gas-lantern-electric-mix': {
      const poleH = 3.2;
      addMesh(parent, cyl(0.05, 0.075, poleH, 10).translate(0, poleH / 2 + 0.15, 0), poleMat);
      addMesh(parent, torus(0.07, 0.016).rotateX(Math.PI / 2).translate(0, 2.4, 0), poleMat);
      const y = poleH + 0.15;
      if (slotIndex % 2 === 0) {
        // Gas lantern: framed glass housing with a live flame.
        for (const sx of [-0.14, 0.14]) {
          for (const sz of [-0.14, 0.14]) {
            addMesh(parent, box(0.03, 0.5, 0.03).translate(sx, y + 0.25, sz), poleMat);
          }
        }
        const glassMat = propMaterial(ctx, 'lamp.gasGlass', {
          category: 'glass',
          texture: 'none',
          color: '#f2d8a0',
          opacity: 0.42,
          roughness: 0.2,
          metalness: 0,
          emissive: '#ffbf5e',
          emissiveIntensity: 0.8,
        });
        addMesh(parent, box(0.26, 0.44, 0.012).translate(0, y + 0.25, -0.14), glassMat);
        addMesh(parent, box(0.26, 0.44, 0.012).translate(0, y + 0.25, 0.14), glassMat);
        addMesh(parent, box(0.012, 0.44, 0.26).translate(-0.14, y + 0.25, 0), glassMat);
        addMesh(parent, box(0.012, 0.44, 0.26).translate(0.14, y + 0.25, 0), glassMat);
        addMesh(parent, box(0.32, 0.04, 0.32).translate(0, y + 0.01, 0), poleMat);
        addMesh(
          parent,
          cone(0.24, 0.18, 4).rotateY(Math.PI / 4).translate(0, y + 0.58, 0),
          poleMat,
        );
        addMesh(parent, cyl(0.05, 0.07, 0.16, 8).translate(0, y + 0.72, 0), poleMat);
        addMesh(parent, sph(0.045, 8, 6).translate(0, y + 0.83, 0), poleMat);
        addMesh(parent, sph(0.05, 8, 6).translate(0, y + 0.18, 0), glowMat);
      } else {
        // Early electric globes arriving on the same standard.
        addMesh(parent, box(0.3, 0.04, 0.3).translate(0, y + 0.02, 0), poleMat);
        addMesh(parent, sph(0.17, 12, 9).translate(0, y + 0.24, 0), glowMat);
        addMesh(parent, cone(0.19, 0.1, 10).translate(0, y + 0.47, 0), poleMat);
        addMesh(parent, sph(0.035, 8, 6).translate(0, y + 0.55, 0), poleMat);
      }
      break;
    }
    case 'ornate-electric-globe': {
      const poleH = 3.6;
      addMesh(parent, cyl(0.05, 0.08, poleH, 12).translate(0, poleH / 2 + 0.15, 0), poleMat);
      addMesh(parent, torus(0.1, 0.03).rotateX(Math.PI / 2).translate(0, poleH + 0.1, 0), poleMat);
      const globe = sph(0.3, 16, 12).scale(1, 1.15, 1).translate(0, poleH + 0.48, 0);
      addMesh(parent, globe, glowMat);
      addMesh(parent, cone(0.1, 0.14, 10).translate(0, poleH + 0.88, 0), poleMat);
      addMesh(parent, sph(0.04, 8, 6).translate(0, poleH + 0.97, 0), poleMat);
      break;
    }
    case 'utilitarian-cobra-head':
    case 'streamlined-cobra': {
      const cobra = ctx.variant.style === 'utilitarian-cobra-head';
      const poleH = cobra ? 6.8 : 7.2;
      const armZ = cobra ? 1.05 : 0.85;
      addMesh(parent, cyl(0.06, 0.11, poleH, 10).translate(0, poleH / 2 + 0.15, 0), poleMat);
      addMesh(parent, box(0.13, 0.1, armZ).translate(0, poleH + 0.16, -armZ / 2), poleMat);
      const headW = cobra ? 0.6 : 0.68;
      addMesh(
        parent,
        box(headW, cobra ? 0.17 : 0.14, cobra ? 0.34 : 0.28).translate(
          0,
          poleH + 0.1,
          -armZ - 0.1,
        ),
        poleMat,
      );
      addMesh(
        parent,
        box(headW - 0.12, 0.05, cobra ? 0.24 : 0.2).translate(
          0,
          poleH + 0.0,
          -armZ - 0.1,
        ),
        glowMat,
      );
      addMesh(parent, box(0.1, 0.3, 0.02).translate(0, 2.2, -0.1), poleMat);
      break;
    }
    default: {
      // Sleek LED column (2025).
      const h = ctx.variant.height;
      addMesh(parent, box(0.17, h, 0.17).translate(0, h / 2 + 0.1, 0), poleMat);
      addMesh(parent, box(0.05, 1.7, 0.19).translate(0, h - 1.3, -0.005), glowMat);
      addMesh(parent, box(0.21, 0.06, 0.21).translate(0, h + 0.14, 0), poleMat);
      addMesh(parent, sph(0.03, 8, 6).translate(0, h + 0.2, 0), poleMat);
      break;
    }
  }
}

const HYDRANT_COLOR: Readonly<Record<StreetEra, string>> = {
  1945: '#7d2a20',
  1965: '#a83226',
  1985: '#b6a832',
  2005: '#b0342a',
  2025: '#b93327',
};

function buildHydrant(ctx: BuildCtx, parent: THREE.Object3D): void {
  const body = propMaterial(ctx, 'hydrant.body', {
    color: HYDRANT_COLOR[ctx.era],
    roughness: 0.52,
    metalness: 0.35,
    texture: 'metal',
  });
  const cap = propMaterial(ctx, 'hydrant.cap', {
    color: ctx.era === 2025 ? '#c2c7cc' : '#3d3a36',
    roughness: 0.45,
    metalness: 0.7,
  });
  const h = ctx.variant.height;
  addMesh(parent, cyl(0.15, 0.17, 0.07, 10).translate(0, 0.035, 0), body);
  addMesh(parent, cyl(0.1, 0.13, h * 0.62, 10).translate(0, 0.07 + h * 0.31, 0), body);
  addMesh(parent, sph(0.11, 12, 8).scale(1, 0.72, 1).translate(0, h * 0.72, 0), body);
  addMesh(parent, box(0.05, 0.05, 0.05).translate(0, h * 0.72 + 0.09, 0), cap);
  // Side and street-facing nozzle caps.
  addMesh(parent, cyl(0.05, 0.05, 0.1, 8).rotateZ(Math.PI / 2).translate(-0.12, h * 0.45, 0), cap);
  addMesh(parent, cyl(0.05, 0.05, 0.1, 8).rotateZ(Math.PI / 2).translate(0.12, h * 0.45, 0), cap);
  addMesh(parent, cyl(0.055, 0.055, 0.12, 8).rotateX(Math.PI / 2).translate(0, h * 0.5, -0.11), cap);
}

const MAILBOX_COLOR: Readonly<Record<StreetEra, string>> = {
  1945: '#2f4a34',
  1965: '#2b4f8a',
  1985: '#274b86',
  2005: '#2a508f',
  2025: '#2c6e63',
};

function buildMailbox(ctx: BuildCtx, parent: THREE.Object3D): void {
  const shell = propMaterial(ctx, 'mailbox.shell', {
    color: MAILBOX_COLOR[ctx.era],
    roughness: 0.48,
    metalness: 0.4,
    texture: 'metal',
  });
  const dark = propMaterial(ctx, 'mailbox.detail', {
    color: '#23262a',
    roughness: 0.6,
    metalness: 0.5,
    texture: 'none',
  });

  if (ctx.variant.style === 'leg-mounted-drop-box') {
    addMesh(parent, cyl(0.028, 0.028, 0.34, 8).translate(-0.13, 0.17, 0), shell);
    addMesh(parent, cyl(0.028, 0.028, 0.34, 8).translate(0.13, 0.17, 0), shell);
    addMesh(parent, box(0.42, 0.46, 0.3).translate(0, 0.57, 0), shell);
    addMesh(parent, box(0.46, 0.08, 0.34).translate(0, 0.84, 0), shell);
    addMesh(parent, box(0.3, 0.32, 0.02).translate(0, 0.56, -0.16), dark);
    addMesh(parent, cyl(0.02, 0.02, 0.12, 6).rotateZ(Math.PI / 2).translate(0, 0.72, -0.18), dark);
    return;
  }

  if (ctx.variant.style === 'parcel-locker') {
    addMesh(parent, box(0.6, 0.08, 0.44).translate(0, 0.04, 0), dark);
    addMesh(parent, box(0.56, 1.1, 0.4).translate(0, 0.63, 0), shell);
    for (const row of [0.36, 0.66, 0.96]) {
      for (const cx of [-0.14, 0.14]) {
        addMesh(parent, box(0.2, 0.24, 0.02).translate(cx, row, -0.21), dark);
      }
    }
    addMesh(parent, box(0.1, 0.14, 0.02).translate(0.16, 1.24, -0.21), dark);
    const screen = propMaterial(ctx, 'mailbox.screen', {
      texture: 'none',
      color: '#0d1b1a',
      roughness: 0.3,
      metalness: 0.1,
      emissive: '#7ef0c0',
      emissiveIntensity: 1.2,
    });
    addMesh(parent, box(0.12, 0.09, 0.02).translate(-0.14, 1.26, -0.21), screen);
    return;
  }

  // Curbside relay boxes (1965/1985/2005): pedestal + barrel body.
  addMesh(parent, cyl(0.05, 0.07, 0.5, 8).translate(0, 0.25, 0), shell);
  addMesh(parent, cyl(0.16, 0.18, 0.05, 10).translate(0, 0.025, 0), shell);
  addMesh(parent, box(0.46, 0.5, 0.34).translate(0, 0.75, 0), shell);
  addMesh(parent, cyl(0.23, 0.23, 0.46, 14).rotateZ(Math.PI / 2).translate(0, 1.0, 0), shell);
  addMesh(parent, box(0.34, 0.36, 0.02).translate(0, 0.74, -0.18), dark);
  addMesh(parent, cyl(0.02, 0.02, 0.14, 6).rotateZ(Math.PI / 2).translate(0, 0.94, -0.18), dark);
}

const WOOD_COLOR: Readonly<Record<StreetEra, string>> = {
  1945: '#5b4130',
  1965: '#7a5a3c',
  1985: '#6f5233',
  2005: '#8a6a45',
  2025: '#6d7367',
};

function buildBench(ctx: BuildCtx, parent: THREE.Object3D): void {
  const frame = propMaterial(ctx, 'bench.frame', {
    category: 'metal',
    color: ctx.era === 1945 ? '#35322e' : ctx.era === 2025 ? '#5c6461' : '#4a4f52',
    roughness: 0.5,
    metalness: 0.65,
  });
  const slat = propMaterial(ctx, 'bench.slat', {
    category: 'wood',
    color: WOOD_COLOR[ctx.era],
    roughness: 0.85,
    metalness: ctx.era === 2025 ? 0.05 : 0,
    weathering: 0.3,
  });

  for (const sx of [-0.86, 0.86]) {
    addMesh(parent, box(0.05, 0.45, 0.05).translate(sx, 0.225, -0.24), frame);
    addMesh(parent, box(0.05, 0.78, 0.05).translate(sx, 0.39, 0.24), frame);
    addMesh(parent, box(0.05, 0.05, 0.5).translate(sx, 0.42, 0), frame);
  }
  for (let i = 0; i < 4; i++) {
    addMesh(parent, box(1.74, 0.035, 0.12).translate(0, 0.47, -0.2 + i * 0.13), slat);
  }
  for (const [i, y] of [0.58, 0.7, 0.82].entries()) {
    addMesh(
      parent,
      box(1.74, 0.11, 0.03).rotateX(-0.12).translate(0, y, 0.26 + i * 0.015),
      slat,
    );
  }
}

function buildBusStop(ctx: BuildCtx, parent: THREE.Object3D): void {
  const frame = propMaterial(ctx, 'bus.frame', {
    category: 'metal',
    color: ctx.era === 1945 ? '#3a3a38' : '#5b6166',
    roughness: 0.45,
    metalness: 0.7,
  });
  const glass = propMaterial(ctx, 'bus.glass', {
    category: 'glass',
    texture: 'none',
    opacity: 0.3,
    roughness: 0.08,
    metalness: 0,
  });
  const sign = signageMaterial(ctx, 'bus.sign');

  if (ctx.variant.style === 'sign-pole') {
    addMesh(parent, cyl(0.04, 0.05, 2.4, 10).translate(0, 1.2, 0), frame);
    addMesh(parent, box(0.5, 0.34, 0.03).translate(0, 2.3, 0), sign);
    addMesh(parent, box(0.3, 0.4, 0.04).translate(0, 1.4, -0.02), frame);
    addMesh(parent, cyl(0.14, 0.14, 0.02, 12).rotateX(Math.PI / 2).translate(0, 1.75, -0.02), frame);
    return;
  }

  // Shelters 1965 onward: posts, roof, glazing, bench.
  for (const sx of [-0.8, 0.8]) {
    for (const sz of [-0.32, 0.32]) {
      addMesh(parent, box(0.06, 2.3, 0.06).translate(sx, 1.15, sz), frame);
    }
  }
  addMesh(parent, box(1.84, 0.09, 0.9).translate(0, 2.35, 0), frame);
  addMesh(parent, box(1.84, 0.16, 0.05).translate(0, 2.26, -0.44), frame);
  addMesh(parent, box(1.5, 0.34, 0.03).translate(0, 2.24, -0.46), sign);
  addMesh(parent, box(1.6, 1.7, 0.03).translate(0, 1.2, 0.34), glass);
  addMesh(parent, box(0.03, 1.7, 0.66).translate(-0.78, 1.2, 0), glass);
  addMesh(parent, box(1.4, 0.05, 0.3).translate(0, 0.45, 0.15), frame);
  addMesh(parent, box(0.05, 0.45, 0.28).translate(-0.6, 0.22, 0.15), frame);
  addMesh(parent, box(0.05, 0.45, 0.28).translate(0.6, 0.22, 0.15), frame);

  if (ctx.era !== 1965) {
    const strip = propMaterial(ctx, 'bus.strip', {
      texture: 'none',
      color: '#14181c',
      roughness: 0.3,
      metalness: 0.1,
      emissive: '#cfe8ff',
      emissiveIntensity: 1.3,
    });
    addMesh(parent, box(1.3, 0.22, 0.04).translate(0, 1.9, 0.31), strip);
  }
  if (ctx.era === 2005 || ctx.era === 2025) {
    const panel = propMaterial(ctx, 'bus.panel', {
      texture: 'none',
      color: '#101418',
      roughness: 0.25,
      metalness: 0.15,
      emissive: ctx.era === 2025 ? '#9fd0ff' : '#b7d7a8',
      emissiveIntensity: 1.7,
    });
    addMesh(parent, box(0.4, 0.55, 0.04).translate(0.55, 1.5, -0.36), panel);
  }
  if (ctx.era === 2025) {
    const solar = propMaterial(ctx, 'bus.solar', {
      texture: 'none',
      color: '#1f3a5f',
      roughness: 0.35,
      metalness: 0.6,
    });
    addMesh(parent, box(1.6, 0.05, 0.75).rotateX(-0.14).translate(0, 2.46, -0.02), solar);
    addMesh(parent, box(0.5, 0.78, 0.05).translate(-0.75, 1.3, -0.3), frame);
  }
}

function buildPayStation(ctx: BuildCtx, parent: THREE.Object3D): void {
  const shell = propMaterial(ctx, 'pay.shell', {
    color: ctx.era === 2025 ? '#3f4650' : '#5a5f57',
    roughness: 0.42,
    metalness: 0.6,
  });
  const dark = propMaterial(ctx, 'pay.dark', { texture: 'none', color: '#15181c', roughness: 0.5, metalness: 0.3 });
  const screen = propMaterial(ctx, 'pay.screen', {
    texture: 'none',
    color: '#0c1116',
    roughness: 0.25,
    metalness: 0.1,
    emissive: '#9fd0ff',
    emissiveIntensity: 1.6,
  });

  addMesh(parent, box(0.46, 0.1, 0.36).translate(0, 0.05, 0), dark);
  addMesh(parent, box(0.4, ctx.variant.height - 0.28, 0.28).translate(0, (ctx.variant.height - 0.28) / 2 + 0.1, 0), shell);
  addMesh(parent, box(0.42, 0.14, 0.3).rotateX(-0.24).translate(0, ctx.variant.height - 0.12, -0.02), shell);
  addMesh(parent, box(0.26, 0.18, 0.02).rotateX(-0.24).translate(0, ctx.variant.height - 0.14, -0.16), screen);
  addMesh(parent, box(0.14, 0.03, 0.02).translate(0.1, ctx.variant.height * 0.55, -0.15), dark);
  if (ctx.era === 2025) {
    addMesh(parent, cyl(0.05, 0.05, 0.02, 12).rotateX(Math.PI / 2).translate(-0.1, ctx.variant.height * 0.62, -0.15), screen);
    addMesh(parent, box(0.34, 0.03, 0.2).rotateX(-0.24).translate(0, ctx.variant.height + 0.0, 0), shell);
  } else {
    addMesh(parent, box(0.1, 0.16, 0.02).translate(-0.1, ctx.variant.height * 0.55, -0.15), dark);
  }
}

function buildPhoneBooth(ctx: BuildCtx, parent: THREE.Object3D): void {
  const frame = propMaterial(ctx, 'booth.frame', {
    category: 'metal',
    color: ctx.era === 2005 ? '#7d848c' : '#b9bec4',
    roughness: 0.3,
    metalness: 0.85,
  });
  const glass = propMaterial(ctx, 'booth.glass', {
    category: 'glass',
    texture: 'none',
    color: getEraPalette(ctx.era).materials.glass.color,
    opacity: 0.3,
    roughness: 0.06,
    metalness: 0,
  });
  const dark = propMaterial(ctx, 'booth.dark', { texture: 'none', color: '#1c1f22', roughness: 0.55, metalness: 0.4 });
  const sign = signageMaterial(ctx, 'booth.sign');
  const slim = ctx.variant.style === 'slim-handset-booth';
  const halfW = slim ? 0.36 : 0.44;
  const h = ctx.variant.height;

  addMesh(parent, box(halfW * 2 + 0.04, 0.06, halfW * 2 + 0.04).translate(0, 0.03, 0), frame);
  for (const sx of [-halfW, halfW]) {
    for (const sz of [-halfW, halfW]) {
      addMesh(parent, box(0.06, h - 0.2, 0.06).translate(sx, (h - 0.2) / 2 + 0.06, sz), frame);
    }
  }
  addMesh(parent, box(halfW * 2 + 0.1, 0.1, halfW * 2 + 0.1).translate(0, h - 0.08, 0), frame);
  // Glass on back, sides, and (slim era: open) front door.
  addMesh(parent, box(halfW * 2 - 0.1, h - 0.55, 0.015).translate(0, (h - 0.4) / 2 + 0.06, halfW - 0.02), glass);
  addMesh(parent, box(0.015, h - 0.55, halfW * 2 - 0.1).translate(-halfW + 0.02, (h - 0.4) / 2 + 0.06, 0), glass);
  addMesh(parent, box(0.015, h - 0.55, halfW * 2 - 0.1).translate(halfW - 0.02, (h - 0.4) / 2 + 0.06, 0), glass);
  if (!slim) {
    addMesh(parent, box(halfW * 2 - 0.1, h - 0.55, 0.015).translate(0, (h - 0.4) / 2 + 0.06, -halfW + 0.02), glass);
    addMesh(parent, box(0.03, 0.3, 0.03).translate(-0.12, 1.1, -halfW + 0.01), frame);
  }
  // Sign cap; 1985 wears a buzzing neon crown.
  addMesh(parent, box(halfW * 1.7, 0.16, 0.03).translate(0, h - 0.05, -halfW - 0.03), sign);
  if (ctx.variant.style === 'neon-top-booth') {
    const neon = propMaterial(ctx, 'booth.neon', {
      category: 'neonEmissive',
      texture: 'none',
      color: '#ff3ea5',
      roughness: 0.3,
      metalness: 0,
      emissive: '#ff3ea5',
      emissiveIntensity: 2.2,
    });
    addMesh(parent, box(halfW * 2 + 0.06, 0.1, halfW * 2 + 0.06).translate(0, h + 0.03, 0), neon);
  }
  // Interior: shelf, coin box, handset with coil cord, directory.
  addMesh(parent, box(halfW * 1.5, 0.04, 0.22).translate(0, 1.05, halfW - 0.14), dark);
  addMesh(parent, box(0.22, 0.34, 0.12).translate(0.1, 1.3, halfW - 0.1), frame);
  addMesh(parent, box(0.06, 0.2, 0.05).translate(-0.14, 1.3, halfW - 0.16), dark);
  const cord = coilCord(5, 0.035, 0.3);
  cord.translate(-0.14, 1.26, halfW - 0.16);
  addMesh(parent, cord, dark);
  addMesh(parent, box(0.24, 0.3, 0.02).translate(0.05, 1.5, halfW - 0.06), sign);
}

function buildStreetKiosk(ctx: BuildCtx, parent: THREE.Object3D): void {
  const shell = propMaterial(ctx, 'kiosk.shell', {
    color: ctx.era === 2025 ? '#dfe3e6' : '#8a6b42',
    roughness: ctx.era === 2025 ? 0.35 : 0.8,
    metalness: ctx.era === 2025 ? 0.4 : 0.05,
    texture: ctx.era === 2025 ? 'metal' : 'wood',
  });
  const dark = propMaterial(ctx, 'kiosk.dark', { texture: 'none', color: '#1b1e20', roughness: 0.6, metalness: 0.3 });
  const sign = signageMaterial(ctx, 'kiosk.sign');
  const h = ctx.variant.height;

  addMesh(parent, box(1.1, 0.08, 0.9).translate(0, 0.04, 0), dark);
  addMesh(parent, box(1.0, h - 0.3, 0.8).translate(0, (h - 0.3) / 2 + 0.08, 0), shell);
  addMesh(parent, box(1.14, 0.09, 0.94).translate(0, h - 0.14, 0), dark);
  addMesh(parent, box(1.2, 0.07, 0.5).rotateX(0.22).translate(0, h * 0.5, -0.55), shell);

  if (ctx.variant.style === 'news-kiosk') {
    for (const y of [h * 0.35, h * 0.52, h * 0.69]) {
      addMesh(parent, box(0.9, 0.3, 0.06).rotateX(-0.5).translate(0, y, -0.44), sign);
    }
    addMesh(parent, box(1.0, 0.5, 0.04).translate(0, h * 0.2, -0.42), dark);
  } else {
    const screen = propMaterial(ctx, 'kiosk.screen', {
      texture: 'none',
      color: '#0b1218',
      roughness: 0.22,
      metalness: 0.1,
      emissive: '#86c7ff',
      emissiveIntensity: 1.6,
    });
    addMesh(parent, box(0.66, 1.1, 0.04).translate(0, h * 0.55, -0.42), screen);
    const skirt = propMaterial(ctx, 'kiosk.skirt', {
      texture: 'none',
      color: '#101418',
      roughness: 0.3,
      metalness: 0.2,
      emissive: '#6ef0e0',
      emissiveIntensity: 1.4,
    });
    addMesh(parent, box(1.02, 0.06, 0.82).translate(0, 0.14, 0), skirt);
    addMesh(parent, box(0.8, 0.14, 0.03).translate(0, h - 0.05, -0.4), sign);
  }
}

function buildWifiPylon(ctx: BuildCtx, parent: THREE.Object3D): void {
  const shell = propMaterial(ctx, 'pylon.shell', {
    category: 'metal',
    color: '#c9ced4',
    roughness: 0.32,
    metalness: 0.85,
  });
  const glow = propMaterial(ctx, 'pylon.glow', {
    texture: 'none',
    color: '#0e1518',
    roughness: 0.3,
    metalness: 0.1,
    emissive: '#6ef0e0',
    emissiveIntensity: 2.4,
  });
  const h = ctx.variant.height;
  addMesh(parent, cyl(0.2, 0.24, 0.12, 14).translate(0, 0.06, 0), shell);
  addMesh(parent, cyl(0.07, 0.12, h - 0.9, 12).translate(0, (h - 0.9) / 2 + 0.12, 0), shell);
  addMesh(parent, torus(0.26, 0.03, 8, 20).rotateX(Math.PI / 2).translate(0, h - 0.75, 0), glow);
  for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    addMesh(
      parent,
      box(0.03, 0.5, 0.12).translate(Math.cos(a) * 0.1, h - 0.35, Math.sin(a) * 0.1).rotateY(-a),
      shell,
    );
  }
  addMesh(parent, sph(0.09, 10, 8).translate(0, h - 0.05, 0), shell);
  addMesh(parent, cyl(0.03, 0.03, 0.5, 8).translate(0, h + 0.25, 0), shell);
  addMesh(parent, sph(0.04, 8, 6).translate(0, h + 0.52, 0), glow);
  addMesh(parent, torus(0.13, 0.02, 6, 16).rotateX(Math.PI / 2).translate(0, 0.3, 0), glow);
}

const CANOPY_COLOR: Readonly<Record<StreetEra, string>> = {
  1945: '#4b5b3c',
  1965: '#55693f',
  1985: '#4e6440',
  2005: '#567a45',
  2025: '#5c8a4c',
};

function buildTreePit(ctx: BuildCtx, parent: THREE.Object3D): void {
  const soil = propMaterial(ctx, 'tree.soil', {
    category: 'grimeSoil',
    texture: 'none',
    roughness: 1,
    metalness: 0,
  });
  const frame = propMaterial(ctx, 'tree.frame', {
    category: 'metal',
    color: ctx.era === 2025 ? '#8b9096' : '#3f3d39',
    roughness: 0.55,
    metalness: 0.7,
  });
  const bark = propMaterial(ctx, 'tree.bark', {
    category: 'wood',
    color: '#4a3a2c',
    roughness: 0.95,
    metalness: 0,
    weathering: 0.5,
  });
  const leaf = propMaterial(ctx, 'tree.leaf', {
    category: 'grimeSoil',
    texture: 'none',
    color: CANOPY_COLOR[ctx.era],
    roughness: 0.95,
    metalness: 0,
  });

  // Recessed pit soil and a border flush with the paving.
  addMesh(parent, box(1.0, 0.06, 0.72).translate(0, -0.035, 0), soil);
  addMesh(parent, box(1.06, 0.045, 0.06).translate(0, 0.005, -0.37), frame);
  addMesh(parent, box(1.06, 0.045, 0.06).translate(0, 0.005, 0.37), frame);
  addMesh(parent, box(0.06, 0.045, 0.72).translate(-0.52, 0.005, 0), frame);
  addMesh(parent, box(0.06, 0.045, 0.72).translate(0.52, 0.005, 0), frame);

  // Era tree guards / grates.
  const style = ctx.variant.style;
  if (style === 'iron-guard-pit' || style === 'guard-pit-mature') {
    for (const a of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
      addMesh(
        parent,
        cyl(0.02, 0.02, 0.7, 6).translate(Math.cos(a) * 0.33, 0.35, Math.sin(a) * 0.33),
        frame,
      );
    }
    addMesh(parent, torus(0.33, 0.018, 6, 20).rotateX(Math.PI / 2).translate(0, 0.34, 0), frame);
    if (style === 'iron-guard-pit') {
      addMesh(parent, torus(0.33, 0.018, 6, 20).rotateX(Math.PI / 2).translate(0, 0.62, 0), frame);
    }
  } else if (style === 'steel-grate' || style === 'bio-grate') {
    addMesh(parent, box(0.38, 0.03, 0.7).translate(-0.31, 0.01, 0), frame);
    addMesh(parent, box(0.38, 0.03, 0.7).translate(0.31, 0.01, 0), frame);
    for (const z of [-0.24, 0, 0.24]) {
      addMesh(parent, box(1.0, 0.028, 0.05).translate(0, 0.01, z), frame);
    }
    if (style === 'bio-grate') {
      addMesh(parent, box(0.5, 0.02, 0.72).translate(0, -0.005, 0), soil);
    }
  }

  // Trunk, branches, and era-sized canopy.
  const h = ctx.variant.height;
  const trunkH = h * 0.45;
  const trunkR = ctx.era >= 2005 ? 0.13 : 0.1;
  addMesh(parent, cyl(trunkR * 0.7, trunkR, trunkH, 10).translate(0, trunkH / 2, 0), bark);
  for (const [i, a] of [0.6, 2.7, 4.6].entries()) {
    addMesh(
      parent,
      cyl(0.025, 0.045, h * 0.24, 6)
        .rotateZ(0.55)
        .rotateY(a)
        .translate(Math.cos(a) * h * 0.06, trunkH * 0.92 + i * 0.1, Math.sin(a) * h * 0.06),
      bark,
    );
  }
  const canopyR = h * 0.2;
  addMesh(parent, sph(canopyR, 12, 9).scale(1, 0.8, 1).translate(0, trunkH + canopyR * 0.7, 0), leaf);
  addMesh(parent, sph(canopyR * 0.7, 10, 8).scale(1, 0.8, 1).translate(canopyR * 0.8, trunkH + canopyR * 0.3, 0.3), leaf);
  addMesh(parent, sph(canopyR * 0.65, 10, 8).scale(1, 0.8, 1).translate(-canopyR * 0.7, trunkH + canopyR * 0.35, -0.35), leaf);
}

const HOARDING_COLOR: Readonly<Record<StreetEra, string>> = {
  1945: '#6b5236',
  1965: '#7a5c3a',
  1985: '#8a6b42',
  2005: '#3f6b4a',
  2025: '#e8e6df',
};

function buildScaffolding(ctx: BuildCtx, parent: THREE.Object3D, slot: StreetSlot): void {
  const L = slot.length ?? 8;
  const poleMat = propMaterial(ctx, 'scaffold.pole', {
    category: 'metal',
    color: ctx.era === 1945 ? '#4f4133' : '#7d848c',
    roughness: 0.5,
    metalness: ctx.era === 1945 ? 0.1 : 0.7,
  });
  const hoarding = propMaterial(ctx, 'scaffold.hoarding', {
    category: ctx.era === 2025 ? 'metal' : 'wood',
    color: HOARDING_COLOR[ctx.era],
    roughness: ctx.era === 2025 ? 0.4 : 0.85,
    metalness: ctx.era === 2025 ? 0.2 : 0,
  });
  const plank = propMaterial(ctx, 'scaffold.plank', {
    category: 'wood',
    color: '#8a6a45',
    roughness: 0.9,
    metalness: 0,
    weathering: 0.5,
  });
  const h = ctx.variant.height;

  // Hoarding panels along the street face of the works.
  const nSeg = Math.max(2, Math.round(L / 3));
  const segW = L / nSeg;
  for (let i = 0; i < nSeg; i++) {
    const x = -L / 2 + segW * (i + 0.5);
    addMesh(parent, box(segW - 0.04, 1.1, 0.08).translate(x, 0.55, 0.05), hoarding);
  }
  addMesh(parent, box(L, 0.06, 0.12).translate(0, 1.14, 0.05), poleMat);

  // Standards, ledgers, transoms, one diagonal, working planks.
  const poleCount = Math.max(3, Math.floor(L / 2) + 1);
  for (let row = 0; row < 2; row++) {
    const z = -0.35 - row * 0.5;
    for (let i = 0; i < poleCount; i++) {
      const x = -L / 2 + (L / (poleCount - 1)) * i;
      addMesh(parent, cyl(0.03, 0.03, h, 8).translate(x, h / 2, z), poleMat);
    }
    for (const y of [1.3, 2.9, h - 0.4].filter((v) => v < h)) {
      addMesh(parent, cyl(0.025, 0.025, L, 6).rotateZ(Math.PI / 2).translate(0, y, z), poleMat);
    }
    addMesh(
      parent,
      cyl(0.022, 0.022, Math.hypot(L * 0.5, 1.6), 6)
        .rotateZ(Math.PI / 2 - Math.atan2(1.6, L * 0.5))
        .translate(0, 2.1, z),
      poleMat,
    );
  }
  for (let i = 0; i < poleCount; i++) {
    const x = -L / 2 + (L / (poleCount - 1)) * i;
    addMesh(parent, cyl(0.02, 0.02, 0.5, 6).rotateX(Math.PI / 2).translate(x, 2.9, -0.6), poleMat);
  }
  addMesh(parent, box(L - 0.3, 0.04, 0.24).translate(0, 2.94, -0.6), plank);
  addMesh(parent, box(L - 0.3, 0.04, 0.24).translate(0, 4.5, -0.6).translate(0, h > 5 ? 0 : -1.6, 0), plank);

  // Debris netting (1985+) and a printed artwork wall (2025).
  if (ctx.era >= 1985) {
    const net = propMaterial(ctx, 'scaffold.net', {
      category: 'fabric',
      color: ctx.era === 2025 ? '#dfe4e8' : '#4f7a52',
      roughness: 0.95,
      metalness: 0,
      opacity: 0.55,
      texture: 'fabric',
    });
    addMesh(parent, box(L - 0.2, Math.max(2, h - 1.6), 0.012).translate(0, (h + 1.4) / 2, -0.95), net);
  }
  if (ctx.era === 2025) {
    const art = signageMaterial(ctx, 'scaffold.art');
    addMesh(parent, box(1.8, 0.9, 0.03).translate(-L * 0.2, 2.1, -0.02), art);
  }
}

// ---------------------------------------------------------------------------
// Instanced kinds
// ---------------------------------------------------------------------------

interface InstancedParts {
  /** Main body geometry (one instance per slot). */
  readonly body: THREE.BufferGeometry;
  /** Optional secondary geometry (screens, bands, faces) with identical transforms. */
  readonly glow?: { geometry: THREE.BufferGeometry; key: string; options?: PropMaterialOptions };
  readonly bodyKey: string;
  readonly bodyOptions?: PropMaterialOptions;
  /** Extra non-uniform scale applied to the body instance (mound bulge etc.). */
  readonly bodyScale?: [number, number, number];
}

function instancedTransforms(
  slots: readonly StreetSlot[],
  surfaceY: number,
  era: StreetEra,
): InstanceTransform[] {
  const s = eraPropScale(era);
  return slots.map((slot) => ({
    position: [slot.x, surfaceY, slot.z] as [number, number, number],
    rotation: [0, slot.rot ?? 0, 0] as [number, number, number],
    scale: [s, s, s] as [number, number, number],
  }));
}

function addInstanced(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: InstanceTransform[],
  name: string,
): THREE.InstancedMesh {
  const mesh = createInstancedMesh({ geometry, material, count: transforms.length, name });
  batchSetTransforms(
    mesh,
    transforms.map((transform, index) => ({ index, transform })),
  );
  parent.add(mesh);
  return mesh;
}

function litterBinParts(ctx: BuildCtx): InstancedParts & { rimY: number; fill: number } {
  const fill = propVariant('litterBin', ctx.era).trashFill ?? 0.5;
  const geos: THREE.BufferGeometry[] = [];
  let rimY = 0.6;
  switch (ctx.variant.style) {
    case 'wire-basket':
      rimY = 0.56;
      geos.push(new THREE.CylinderGeometry(0.23, 0.19, 0.46, 10, 1, true).translate(0, 0.35, 0));
      geos.push(torus(0.23, 0.02, 6, 14).rotateX(Math.PI / 2).translate(0, 0.58, 0));
      geos.push(cyl(0.04, 0.05, 0.3, 8).translate(0, 0.15, 0));
      geos.push(cyl(0.15, 0.17, 0.04, 10).translate(0, 0.02, 0));
      break;
    case 'steel-drum':
      rimY = 0.64;
      geos.push(cyl(0.24, 0.24, 0.6, 14).translate(0, 0.33, 0));
      geos.push(torus(0.24, 0.02, 6, 14).rotateX(Math.PI / 2).translate(0, 0.63, 0));
      geos.push(cyl(0.16, 0.18, 0.04, 10).translate(0, 0.02, 0));
      break;
    case 'concrete-ring':
      rimY = 0.6;
      geos.push(cyl(0.27, 0.3, 0.6, 16).translate(0, 0.3, 0));
      geos.push(cyl(0.31, 0.31, 0.05, 16).translate(0, 0.6, 0));
      break;
    case 'slat-bin':
      rimY = 0.68;
      geos.push(cyl(0.25, 0.23, 0.64, 12).translate(0, 0.35, 0));
      geos.push(torus(0.25, 0.02, 6, 14).rotateX(Math.PI / 2).translate(0, 0.67, 0));
      geos.push(cyl(0.05, 0.06, 0.3, 8).translate(0, 0.15, 0));
      break;
    default:
      rimY = 0.78;
      geos.push(box(0.48, 0.86, 0.34).translate(0, 0.47, 0));
      geos.push(box(0.5, 0.07, 0.36).rotateX(0.16).translate(0, 0.93, -0.02));
      geos.push(box(0.3, 0.16, 0.03).translate(0, 0.7, -0.18));
      geos.push(box(0.5, 0.06, 0.36).translate(0, 0.04, 0));
      break;
  }
  return {
    body: merge(geos),
    bodyKey: 'bin.body',
    rimY,
    fill,
  };
}

function parkingMeterParts(ctx: BuildCtx): InstancedParts {
  const geos: THREE.BufferGeometry[] = [];
  geos.push(cyl(0.035, 0.045, 1.02, 8).translate(0, 0.51, 0));
  geos.push(cyl(0.08, 0.09, 0.05, 10).translate(0, 0.025, 0));
  let glow: InstancedParts['glow'];
  switch (ctx.variant.style) {
    case 'post-coin-meter':
      geos.push(cyl(0.14, 0.14, 0.1, 16).rotateX(Math.PI / 2).translate(0, 1.08, -0.02));
      glow = {
        geometry: cyl(0.1, 0.1, 0.03, 16).rotateX(Math.PI / 2).translate(0, 1.08, -0.08),
        key: 'meter.face',
        options: { texture: 'none', color: '#e8e2cf', roughness: 0.2, metalness: 0.1, emissive: '#ffe9c0', emissiveIntensity: 0.5 },
      };
      break;
    case 'digital-coin-meter':
      geos.push(box(0.17, 0.26, 0.13).translate(0, 1.13, 0));
      geos.push(box(0.2, 0.03, 0.16).translate(0, 1.27, -0.02));
      glow = {
        geometry: box(0.11, 0.06, 0.02).translate(0, 1.16, -0.07),
        key: 'meter.lcd',
        options: { texture: 'none', color: '#0d1410', roughness: 0.25, metalness: 0.1, emissive: '#8fe0b0', emissiveIntensity: 1.4 },
      };
      break;
    default:
      geos.push(box(0.17, 0.28, 0.13).translate(0, 1.14, 0));
      geos.push(box(0.19, 0.03, 0.16).rotateX(0.5).translate(0, 1.31, 0.01));
      glow = {
        geometry: box(0.11, 0.07, 0.02).translate(0, 1.17, -0.07),
        key: 'meter.lcd',
        options: { texture: 'none', color: '#0d1116', roughness: 0.25, metalness: 0.1, emissive: '#9fd0ff', emissiveIntensity: 1.4 },
      };
      break;
  }
  return { body: merge(geos), bodyKey: 'meter.body', glow };
}

function evChargerParts(ctx: BuildCtx): InstancedParts {
  void ctx;
  const body: THREE.BufferGeometry[] = [];
  body.push(box(0.5, 0.09, 0.4).translate(0, 0.045, 0));
  body.push(
    createBeveledBoxGeometry({ width: 0.42, height: 1.4, depth: 0.3, bevelSize: 0.03, bevelSegments: 2 }).translate(
      0,
      0.83,
      0,
    ),
  );
  body.push(box(0.1, 0.3, 0.1).translate(0.24, 1.0, 0.02));
  // Hanging connector cable with a holstered gun.
  const cablePts = [
    new THREE.Vector3(0.2, 1.4, 0.0),
    new THREE.Vector3(0.36, 1.05, 0.06),
    new THREE.Vector3(0.34, 0.5, 0.1),
    new THREE.Vector3(0.24, 0.75, 0.16),
  ];
  body.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 16, 0.03, 6));
  body.push(box(0.08, 0.2, 0.07).translate(0.24, 0.85, 0.16));
  body.push(box(0.14, 0.34, 0.12).translate(0.26, 1.1, 0.05));

  const glowParts: THREE.BufferGeometry[] = [];
  glowParts.push(box(0.26, 0.3, 0.02).translate(0, 1.25, -0.16));
  glowParts.push(torus(0.09, 0.015, 6, 18).rotateX(Math.PI / 2).translate(0, 0.85, -0.16));
  glowParts.push(box(0.3, 0.03, 0.02).translate(0, 0.5, -0.16));

  return {
    body: merge(body),
    bodyKey: 'charger.body',
    bodyOptions: { texture: 'none', color: '#e6e9ec', roughness: 0.35, metalness: 0.6 },
    glow: {
      geometry: merge(glowParts),
      key: 'charger.glow',
      options: {
        texture: 'none',
        color: '#0d1416',
        roughness: 0.25,
        metalness: 0.1,
        emissive: '#7ef0c0',
        emissiveIntensity: 1.9,
      },
    },
  };
}

function bollardParts(ctx: BuildCtx): InstancedParts {
  const geos: THREE.BufferGeometry[] = [];
  geos.push(cyl(0.055, 0.075, 0.88, 10).translate(0, 0.44, 0));
  geos.push(cyl(0.1, 0.11, 0.07, 10).translate(0, 0.035, 0));
  geos.push(sph(0.058, 10, 8).scale(1, 0.6, 1).translate(0, 0.9, 0));
  let glow: InstancedParts['glow'];
  if (ctx.era === 1985) {
    glow = {
      geometry: torus(0.062, 0.014, 6, 14).rotateX(Math.PI / 2).translate(0, 0.72, 0),
      key: 'bollard.band',
      options: { texture: 'none', color: '#f2f2ee', roughness: 0.4, metalness: 0.1, emissive: '#fff6df', emissiveIntensity: 0.6 },
    };
  } else if (ctx.era === 2025) {
    glow = {
      geometry: torus(0.062, 0.016, 6, 14).rotateX(Math.PI / 2).translate(0, 0.8, 0),
      key: 'bollard.band',
      options: { texture: 'none', color: '#0e1518', roughness: 0.3, metalness: 0.1, emissive: '#6ef0e0', emissiveIntensity: 1.8 },
    };
  }
  return { body: merge(geos), bodyKey: 'bollard.body', glow };
}

function telegraphPoleParts(ctx: BuildCtx): InstancedParts {
  const wood: THREE.BufferGeometry[] = [];
  wood.push(cyl(0.085, 0.13, 7.3, 10).translate(0, 3.65, 0));
  wood.push(box(1.7, 0.09, 0.1).translate(0, 6.85, 0));
  const doubleArm = ctx.era === 1945 || ctx.era === 1965;
  if (doubleArm) wood.push(box(1.7, 0.09, 0.1).translate(0, 6.35, 0));
  wood.push(cyl(0.022, 0.022, 0.6, 6).rotateZ(0.9).translate(-0.4, 6.55, 0));
  wood.push(cyl(0.022, 0.022, 0.6, 6).rotateZ(-0.9).translate(0.4, 6.55, 0));

  const insulators: THREE.BufferGeometry[] = [];
  for (const x of [-0.7, -0.35, 0.35, 0.7]) {
    insulators.push(cyl(0.03, 0.05, 0.09, 8).translate(x, 6.94, 0));
    insulators.push(sph(0.045, 8, 6).translate(x, 7.0, 0));
    if (doubleArm) insulators.push(cyl(0.03, 0.05, 0.09, 8).translate(x, 6.44, 0));
  }

  return {
    body: merge(wood),
    bodyKey: 'pole.wood',
    bodyOptions: { category: 'wood', color: '#4a3b2c', roughness: 0.95, metalness: 0, weathering: 0.6 },
    glow: {
      geometry: merge(insulators),
      key: 'pole.insulator',
      options: { texture: 'none', color: '#7fa08c', roughness: 0.2, metalness: 0.05, opacity: 0.9 },
    },
  };
}

function buildInstancedKind(
  kind: StreetPropKind,
  ctx: BuildCtx,
  slots: readonly StreetSlot[],
  parent: THREE.Object3D,
  surfaceY: number,
): void {
  const transforms = instancedTransforms(slots, surfaceY, ctx.era);
  let parts: InstancedParts & { rimY?: number; fill?: number };

  switch (kind) {
    case 'litterBin':
      parts = litterBinParts(ctx);
      break;
    case 'parkingMeter':
      parts = parkingMeterParts(ctx);
      break;
    case 'evCharger':
      parts = evChargerParts(ctx);
      break;
    case 'bollard':
      parts = bollardParts(ctx);
      break;
    case 'telegraphPole':
      parts = telegraphPoleParts(ctx);
      break;
    default:
      throw new Error(`Kind ${kind} is not instanced`);
  }

  const bodyMat = propMaterial(ctx, `${kind}.body`, parts.bodyOptions);
  addInstanced(parent, parts.body, bodyMat, transforms, `${kind}:instances:${ctx.era}`);

  if (parts.glow) {
    const glowMat = propMaterial(ctx, `${kind}.${parts.glow.key}`, parts.glow.options);
    addInstanced(parent, parts.glow.geometry, glowMat, transforms, `${kind}:glow:${ctx.era}`);
  }

  if (kind === 'litterBin' && parts.rimY !== undefined && parts.fill !== undefined) {
    // Era trash mound: scaled by the era's fill level, anchored on the rim.
    const fill = parts.fill;
    const moundGeo = new THREE.SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    moundGeo.translate(0, parts.rimY - 0.04, 0);
    const moundMat = propMaterial(ctx, 'bin.trash', {
      category: 'grimeSoil',
      texture: 'none',
      roughness: 1,
      metalness: 0,
      weathering: 0.8,
    });
    const sx = 0.95 + fill * 0.3;
    const sy = 0.35 + fill * 0.9;
    const moundTransforms = transforms.map((t) => {
      const base = (t.scale as [number, number, number]) ?? [1, 1, 1];
      return {
        ...t,
        scale: [base[0] * sx, base[1] * sy, base[2] * sx] as [number, number, number],
      };
    });
    addInstanced(parent, moundGeo, moundMat, moundTransforms, `bin:trash:${ctx.era}`);
  }
}

/** Overhead wires: one merged tube mesh per era, sagging pole-top to pole-top. */
function buildOverheadWires(ctx: BuildCtx, parent: THREE.Object3D): void {
  const count = ctx.variant.wireCount ?? 0;
  if (count === 0) return;
  const geos: THREE.BufferGeometry[] = [];
  for (const span of STREET_LAYOUT.wireSpans) {
    const dx = span.bx - span.ax;
    const dz = span.bz - span.az;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const perpX = -dz / len;
    const perpZ = dx / len;
    const half = (count - 1) / 2;
    for (let i = 0; i < count; i++) {
      const off = (i - half) * 0.2;
      const y = 6.72 + i * 0.11;
      const p0 = new THREE.Vector3(span.ax + perpX * off, y, span.az + perpZ * off);
      const p1 = new THREE.Vector3(span.bx + perpX * off, y, span.bz + perpZ * off);
      const mid = new THREE.Vector3(
        (p0.x + p1.x) / 2,
        y - (0.16 + len * 0.012),
        (p0.z + p1.z) / 2,
      );
      geos.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, mid, p1), 10, 0.016, 5));
    }
  }
  if (geos.length === 0) return;
  const wireMat = propMaterial(ctx, 'wire.cable', {
    texture: 'none',
    color: '#17181a',
    roughness: 0.85,
    metalness: 0.35,
  });
  const mergedGeo = merge(geos);
  for (const g of geos) g.dispose();
  addMesh(parent, mergedGeo, wireMat, `wires:instances:${ctx.era}`);
}

// ---------------------------------------------------------------------------
// Channel build
// ---------------------------------------------------------------------------

function buildProp(
  kind: StreetPropKind,
  ctx: BuildCtx,
  parent: THREE.Object3D,
  slot: StreetSlot,
  slotIndex: number,
): void {
  switch (kind) {
    case 'lamp':
      buildLamp(ctx, parent, slotIndex);
      break;
    case 'hydrant':
      buildHydrant(ctx, parent);
      break;
    case 'mailbox':
      buildMailbox(ctx, parent);
      break;
    case 'bench':
      buildBench(ctx, parent);
      break;
    case 'busStop':
      buildBusStop(ctx, parent);
      break;
    case 'payStation':
      buildPayStation(ctx, parent);
      break;
    case 'phoneBooth':
      buildPhoneBooth(ctx, parent);
      break;
    case 'streetKiosk':
      buildStreetKiosk(ctx, parent);
      break;
    case 'wifiPylon':
      buildWifiPylon(ctx, parent);
      break;
    case 'treePit':
      buildTreePit(ctx, parent);
      break;
    case 'scaffolding':
      buildScaffolding(ctx, parent, slot);
      break;
    default:
      throw new Error(`Kind ${kind} must be built instanced or globally`);
  }
}

/**
 * Build one choreography channel of street furniture.
 *
 * Returns era layers so the module can crossfade them; picks up hero
 * pickable descriptors (kind groups that contain every era variant).
 */
/** Kinds owned by the roadway build (manholes/drains live on the road). */
const ROADWAY_OWNED_KINDS: readonly StreetPropKind[] = ['manhole', 'drainGrate'];

export function buildStreetFurniture(options: StreetFurnitureOptions): FurnitureBuild {
  const { channel, seed = 2025 } = options;
  const kinds: readonly StreetPropKind[] =
    channel === 'lighting'
      ? LIGHTING_PROP_KINDS
      : (Object.keys(STREET_LAYOUT.propSlots) as StreetPropKind[]).filter(
          (kind) =>
            !LIGHTING_PROP_KINDS.includes(kind) && !ROADWAY_OWNED_KINDS.includes(kind),
        );

  const root = new THREE.Group();
  root.name = channel === 'lighting' ? 'street:lighting' : 'street:furniture';

  const layers = new Map<StreetEra, StreetEraLayer>();
  for (const era of STREET_ERAS) {
    const layer = new StreetEraLayer(era);
    layers.set(era, layer);
    layer.applyWeight(era === 1945 ? 1 : 0);
  }
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const pickables: StreetPickableDescriptor[] = [];

  for (const kind of kinds) {
    const kindGroup = new THREE.Group();
    kindGroup.name = `prop:${kind}`;
    root.add(kindGroup);

    const slots = slotsFor(kind);
    const surface = PROP_SURFACE[kind];
    const baseY = surface === 'sidewalk' ? SIDEWALK_TOP_Y : ROAD_SURFACE_Y;
    const instanced = INSTANCED_STREET_KINDS.includes(kind);

    const surfaceYFor = (era: StreetEra): number =>
      surface === 'sidewalk' ? sidewalkSurfaceY(era) : surface === 'road' ? roadSurfaceY(era) : 0;
    const makeCtx = (
      era: StreetEra,
      variant: StreetPropVariant,
      layer: StreetEraLayer,
    ): BuildCtx => {
      let kindSeed = era * 97;
      for (let i = 0; i < kind.length; i++) kindSeed = (kindSeed * 31 + kind.charCodeAt(i)) | 0;
      return { era, variant, rng: createPRNG(Math.abs(seed + kindSeed)), layer, materialCache };
    };

    if (kind === 'overheadWires' || instanced) {
      // Global spans and instanced kinds: one era group per era directly
      // under the kind group, with instance matrices baked at the era surface.
      for (const era of STREET_ERAS) {
        const variant = propVariant(kind, era);
        if (!variant.present) continue;
        const layer = layers.get(era);
        if (!layer) continue;
        const ctx = makeCtx(era, variant, layer);
        const eraGroup = new THREE.Group();
        eraGroup.name = `era:${era}`;
        kindGroup.add(eraGroup);
        layer.addGroup(eraGroup);
        if (kind === 'overheadWires') {
          buildOverheadWires(ctx, eraGroup);
        } else {
          buildInstancedKind(kind, ctx, slots, eraGroup, surfaceYFor(era));
        }
      }
    } else {
      // Grouped props: one slot group anchored at the pinned base surface,
      // with one era subgroup per present era inside it.
      slots.forEach((slot, slotIndex) => {
        const slotGroup = new THREE.Group();
        slotGroup.name = `slot:${slotIndex}`;
        slotGroup.position.set(slot.x, baseY, slot.z);
        slotGroup.rotation.y = slot.rot ?? 0;
        kindGroup.add(slotGroup);

        for (const era of STREET_ERAS) {
          const variant = propVariant(kind, era);
          if (!variant.present) continue;
          const layer = layers.get(era);
          if (!layer) continue;
          const ctx = makeCtx(era, variant, layer);

          const eraGroup = new THREE.Group();
          eraGroup.name = `era:${era}`;
          eraGroup.position.y = surfaceYFor(era) - baseY;
          eraGroup.scale.setScalar(eraPropScale(era));
          slotGroup.add(eraGroup);
          layer.addGroup(eraGroup);

          buildProp(kind, ctx, eraGroup, slot, slotIndex);
        }
      });
    }

    if (HERO_PICKABLE_KINDS.includes(kind)) {
      const present = erasPresent(kind);
      const latest = present[present.length - 1];
      pickables.push({
        id: `street:${kind.replace(/([A-Z])/g, '-$1').toLowerCase()}`,
        kind,
        object: kindGroup,
        label: latest ? propVariant(kind, latest).label : kind,
        eras: present,
        focusDistance: kind === 'wifiPylon' ? 8 : 7,
        focusHeight: 2,
      });
    }
  }

  return { root, layers: [...layers.values()], pickables };
}
