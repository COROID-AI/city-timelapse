// =============================================================================
// City Timelapse — Era-distinct Storefronts & Advertisements
//
// Places 4–6 ground-floor storefront signs and 2–3 rooftop/billboard ads that
// face the street, then transforms their signage typography, material, and ad
// technology across all six eras (1945 → 2055). Every era yields a visually
// distinct treatment:
//
//   1945  hand-painted enamel signs, fabric awnings, marquee bulbs
//   1965  glowing neon-tube frames, atomic-age starbursts
//   1985  dot-matrix LED borders, video-wall tiles
//   2005  large backlit flex-face panels, glossy vinyl trims
//   2025  clean LCD panels in dark bezels
//   2055  floating holographic volumes + animated shader ribbons
//
// An EraState subscriber drives a continuous crossfade: each era is built once
// as its own layer, and the layers' material opacity is blended by the shared
// normalized timeline position `t` (0 = 1945, 1 = 2055). The 2055 billboard
// ribbons use a dedicated ShaderMaterial whose UV scroll is advanced each frame
// by a uniform-driven speed.
//
// All artwork is procedural via the shared asset factory — no external files.
// =============================================================================

import * as THREE from 'three';
import { ERA_IDS, type EraId } from '../eras';
import type { EraState } from './EraState';
import type { MaterialSlot, SignOptions } from './assetFactory';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The subset of the procedural asset factory consumed by the storefront
 * system. The foundation supplies both methods; storefronts only needs signage
 * and structural materials.
 */
export interface StorefrontAssetFactory {
  /** Era-appropriate sign material with procedurally drawn typography. */
  makeSignMaterial(eraId: EraId, text: string, options?: SignOptions): THREE.MeshStandardMaterial;
  /** Era-appropriate structural material for a named slot. */
  makeMaterial(eraId: EraId, slot: MaterialSlot): THREE.MeshStandardMaterial;
}

/** Handle returned by {@link createStorefrontSystem}. */
export interface StorefrontSystem {
  /** Root group to add to the scene. Contains all era layers + poles. */
  readonly group: THREE.Group;
  /**
   * Per-frame update. Advances the 2055 shader ribbon scroll and re-applies
   * the era crossfade from the latest EraState timeline position.
   */
  update(dt: number): void;
  /** Tear down all GPU resources and unsubscribe from EraState. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Period-appropriate copy (distinct, era-characteristic samples per slot)
// ---------------------------------------------------------------------------

/** Ground-floor storefront sign copy, one entry per storefront slot. */
const STOREFRONT_TEXT: Record<EraId, readonly string[]> = {
  '1945': ['DINER', 'BARBER', 'PHARMACY', 'TAILOR', 'NEWSSTAND'],
  '1965': ['DINER', 'BARBER SHOP', 'DRUG STORE', 'RADIO SHACK', 'GROCERY'],
  '1985': ['PIZZA', 'ARCADE', 'VHS RENTAL', 'BOWLING', 'DELI'],
  '2005': ['CAFE', 'CELLULAR', 'INTERNET', 'DVD', 'MUSIC'],
  '2025': ['CAFE 5G', 'E-SCOOTER', 'STREAM', 'CHARGE', 'RAMEN'],
  '2055': ['HOLO-LOUNGE', 'NEURAL', 'SYNTH BAR', 'QUANTUM', 'AERO'],
};

/** Rooftop/billboard ad copy, one entry per billboard slot. */
const BILLBOARD_TEXT: Record<EraId, readonly string[]> = {
  '1945': ['SMOKE', 'COLA', 'MOTORS'],
  '1965': ['COLA', 'MUSTANG', 'TELEVISION'],
  '1985': ['BLOCKBUSTER', 'SODA POP', 'WATCH TV'],
  '2005': ['CELL PHONE', 'DOT COM', 'MP3'],
  '2025': ['STREAM 4K', 'ELECTRIC', 'CLOUD'],
  '2055': ['NEXUS AI', 'ORBIT', 'PRISM'],
};

// ---------------------------------------------------------------------------
// Layout — storefront + billboard slots facing the street
// ---------------------------------------------------------------------------

/** One ground-floor storefront sign placement. Local origin = sign center. */
interface StorefrontSlot {
  /** World position [x, y, z] of the sign center. */
  readonly pos: readonly [number, number, number];
  /** Y rotation so the sign faces the street (0 = faces +Z, PI = faces -Z). */
  readonly rotY: number;
  /** Sign panel width (scene units). */
  readonly width: number;
  /** Sign panel height (scene units). */
  readonly height: number;
}

/** One rooftop/billboard ad placement. Local origin = panel center. */
interface BillboardSlot {
  /** World position [x, y, z] of the panel center. */
  readonly pos: readonly [number, number, number];
  /** Y rotation so the panel faces the street. */
  readonly rotY: number;
  /** Panel width (scene units). */
  readonly width: number;
  /** Panel height (scene units). */
  readonly height: number;
  /** When true, this billboard hosts the animated shader ribbons for 2055. */
  readonly ribbon?: boolean;
}

/**
 * Five ground-floor storefronts lining both sides of the street block,
 * facing inward toward the road.
 */
const STOREFRONT_SLOTS: readonly StorefrontSlot[] = [
  { pos: [-13, 3.3, -8.7], rotY: 0, width: 4.4, height: 1.5 }, // north row, faces +Z
  { pos: [-1, 3.3, -8.7], rotY: 0, width: 4.4, height: 1.5 },
  { pos: [12, 3.3, -8.7], rotY: 0, width: 4.4, height: 1.5 },
  { pos: [-7, 3.3, 8.7], rotY: Math.PI, width: 4.4, height: 1.5 }, // south row, faces -Z
  { pos: [7, 3.3, 8.7], rotY: Math.PI, width: 4.4, height: 1.5 },
];

/**
 * Three rooftop billboards visible from the street, elevated on poles. The
 * first hosts the animated 2055 shader ribbons.
 */
const BILLBOARD_SLOTS: readonly BillboardSlot[] = [
  { pos: [-16, 22.5, -7], rotY: 0, width: 7.5, height: 3.6, ribbon: true },
  { pos: [16, 20.5, 7], rotY: Math.PI, width: 7.5, height: 3.6 },
  { pos: [0, 27, -8], rotY: 0, width: 6.5, height: 3.2 },
];

// ---------------------------------------------------------------------------
// Crossfade math — per-era weight from the shared timeline position
// ---------------------------------------------------------------------------

/**
 * Normalized timeline position of each era, matching EraState's eraPosition
 * (index / (length-1)). 0 = 1945, 1 = 2055.
 */
const ERA_T_POSITION: Record<EraId, number> = {
  '1945': 0.0,
  '1965': 0.2,
  '1985': 0.4,
  '2005': 0.6,
  '2025': 0.8,
  '2055': 1.0,
};

/** Spacing between adjacent era positions on the timeline. */
const ERA_SPACING = 0.2;

/**
 * Smoothstep tent weight for one era given the current timeline position.
 * Returns 1 at the era's own position, 0 once an adjacent era is reached, and
 * a smooth blend in between so two neighboring layers crossfade cleanly.
 */
function eraWeight(t: number, eraPos: number): number {
  const d = Math.abs(t - eraPos) / ERA_SPACING;
  if (d >= 1) return 0;
  const x = 1 - d;
  return x * x * (3 - 2 * x); // smoothstep
}

// ---------------------------------------------------------------------------
// 2055 shader ribbon material (uniform-driven UV scroll)
// ---------------------------------------------------------------------------

/** Vertex shader: pass through UVs. */
const RIBBON_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Fragment shader: animated diagonal light ribbons whose phase scrolls with
 * `uTime * uSpeed`. `uOpacity` carries the crossfade weight so the ribbon
 * fades in/out with the 2055 layer.
 */
const RIBBON_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uOpacity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;

  void main() {
    float phase = uTime * uSpeed;
    float sway = sin(vUv.x * 14.0 - phase * 6.2831853) * 0.5 + 0.5;
    float band = sin((vUv.y + sway * 0.18) * 9.0 - phase * 3.0);
    float ribbon = smoothstep(-0.25, 0.85, band);
    vec3 col = mix(uColorA, uColorB, ribbon);
    float alpha = (0.35 + 0.65 * ribbon) * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;

/** Build the shared 2055 ribbon ShaderMaterial (transparent, additive-ish). */
function createRibbonMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 0.55 }, // uniform-driven scroll speed
      uOpacity: { value: 0 },
      uColorA: { value: new THREE.Color(0x00e5ff) },
      uColorB: { value: new THREE.Color(0x9b5cff) },
    },
    vertexShader: RIBBON_VERT,
    fragmentShader: RIBBON_FRAG,
  });
}

// ---------------------------------------------------------------------------
// Internal: era layer bookkeeping
// ---------------------------------------------------------------------------

/** One fully-built era's worth of signage + ad technology. */
interface EraLayer {
  readonly eraId: EraId;
  /** Normalized timeline position of this era. */
  readonly pos: number;
  /** Group holding every sign/advert for this era. */
  readonly group: THREE.Group;
  /** Every fadeable material in the layer (driven by the crossfade). */
  readonly materials: THREE.Material[];
}

// ---------------------------------------------------------------------------
// Internal: mesh assembly helpers
// ---------------------------------------------------------------------------

/** Dispose a single material and any texture it owns. */
function disposeMaterial(m: THREE.Material): void {
  const anyMat = m as THREE.MeshStandardMaterial;
  anyMat.map?.dispose();
  anyMat.emissiveMap?.dispose();
  m.dispose();
}

/** Recursively collect every mesh material under an object. */
function collectMaterials(root: THREE.Object3D): THREE.Material[] {
  const out: THREE.Material[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        out.push(...mat);
      } else if (mat) {
        out.push(mat);
      }
    }
  });
  return out;
}

/** Attach a mesh to a parent, tracking its material for the crossfade. */
function attach(
  parent: THREE.Group,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  mats: THREE.Material[],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  mats.push(mat);
  return mesh;
}

/** Position + orient a slot group to face the street. */
function place(group: THREE.Group, pos: readonly [number, number, number], rotY: number): void {
  group.position.set(pos[0], pos[1], pos[2]);
  group.rotation.y = rotY;
}

// ---------------------------------------------------------------------------
// Internal: era-specific ad-technology accents (ground storefronts)
// ---------------------------------------------------------------------------

/**
 * Add era-characteristic ad-technology detailing around a storefront sign.
 * Each era gets a distinct treatment so the "technology" reads at a glance.
 */
function addStorefrontAccents(
  eraId: EraId,
  slot: StorefrontSlot,
  parent: THREE.Group,
  factory: StorefrontAssetFactory,
  mats: THREE.Material[],
): void {
  const w = slot.width;
  const h = slot.height;
  const fz = 0.14; // accent depth, just in front of the sign

  switch (eraId) {
    case '1945': {
      // Fabric awning + ring of marquee bulbs.
      const awning = factory.makeMaterial(eraId, 'wallBrick');
      attach(parent, new THREE.BoxGeometry(w + 0.4, 0.34, 0.7), awning, 0, h / 2 + 0.32, 0.12, mats);
      const bulb = factory.makeMaterial(eraId, 'signNeon');
      const n = Math.max(6, Math.round(w / 0.55));
      for (let i = 0; i < n; i += 1) {
        const x = -w / 2 + ((i + 0.5) * w) / n;
        attach(parent, new THREE.SphereGeometry(0.07, 8, 8), bulb, x, h / 2 + 0.04, fz, mats);
        attach(parent, new THREE.SphereGeometry(0.07, 8, 8), bulb, x, -h / 2 - 0.04, fz, mats);
      }
      break;
    }
    case '1965': {
      // Glowing neon-tube frame + atomic-age starburst.
      const neon = factory.makeMaterial(eraId, 'signNeon');
      const t = 0.08;
      attach(parent, new THREE.BoxGeometry(w + 0.3, t, t), neon, 0, h / 2 + 0.12, fz, mats);
      attach(parent, new THREE.BoxGeometry(w + 0.3, t, t), neon, 0, -h / 2 - 0.12, fz, mats);
      attach(parent, new THREE.BoxGeometry(t, h + 0.3, t), neon, -w / 2 - 0.12, 0, fz, mats);
      attach(parent, new THREE.BoxGeometry(t, h + 0.3, t), neon, w / 2 + 0.12, 0, fz, mats);
      attach(parent, new THREE.TorusGeometry(0.28, 0.045, 8, 20), neon, 0, h / 2 + 0.62, fz, mats);
      break;
    }
    case '1985': {
      // Dot-matrix LED border + video-wall tiles.
      const led = factory.makeMaterial(eraId, 'signNeon');
      const t = 0.06;
      attach(parent, new THREE.BoxGeometry(w + 0.25, t, t), led, 0, h / 2 + 0.1, fz, mats);
      attach(parent, new THREE.BoxGeometry(w + 0.25, t, t), led, 0, -h / 2 - 0.1, fz, mats);
      const tile = factory.makeMaterial(eraId, 'wallGlass');
      for (let r = 0; r < 2; r += 1) {
        for (let c = 0; c < 3; c += 1) {
          attach(
            parent,
            new THREE.BoxGeometry(0.3, 0.3, 0.05),
            tile,
            w / 2 + 0.45 + c * 0.34,
            -h / 2 + 0.2 + r * 0.34,
            fz,
            mats,
          );
        }
      }
      break;
    }
    case '2005': {
      // Backlit flex-face glow panel behind the sign + glossy vinyl trim.
      const glow = factory.makeMaterial(eraId, 'signNeon');
      attach(parent, new THREE.BoxGeometry(w + 0.55, h + 0.55, 0.1), glow, 0, 0, -0.06, mats);
      const trim = factory.makeMaterial(eraId, 'wallGlass');
      attach(parent, new THREE.BoxGeometry(w + 0.75, 0.12, 0.22), trim, 0, h / 2 + 0.34, 0.1, mats);
      attach(parent, new THREE.BoxGeometry(w + 0.75, 0.12, 0.22), trim, 0, -h / 2 - 0.34, 0.1, mats);
      break;
    }
    case '2025': {
      // Clean dark LCD bezel frame.
      const bezel = factory.makeMaterial(eraId, 'wallConcrete');
      const bw = 0.12;
      attach(parent, new THREE.BoxGeometry(w + 0.4, bw, 0.22), bezel, 0, h / 2 + 0.16, 0.1, mats);
      attach(parent, new THREE.BoxGeometry(w + 0.4, bw, 0.22), bezel, 0, -h / 2 - 0.16, 0.1, mats);
      attach(parent, new THREE.BoxGeometry(bw, h + 0.4, 0.22), bezel, -w / 2 - 0.16, 0, 0.1, mats);
      attach(parent, new THREE.BoxGeometry(bw, h + 0.4, 0.22), bezel, w / 2 + 0.16, 0, 0.1, mats);
      break;
    }
    case '2055': {
      // Floating holographic platform ring + glow border.
      const holo = factory.makeMaterial(eraId, 'signHologram');
      const ring = attach(
        parent,
        new THREE.TorusGeometry(w * 0.34, 0.05, 8, 24),
        holo,
        0,
        -h / 2 - 0.45,
        0.18,
        mats,
      );
      ring.rotation.x = Math.PI / 2;
      attach(parent, new THREE.BoxGeometry(w + 0.4, 0.06, 0.06), holo, 0, h / 2 + 0.28, 0.2, mats);
      break;
    }
    default: {
      const _exhaustive: never = eraId;
      throw new Error(`[storefronts] Unknown era id: ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal: build one era's storefronts + billboards
// ---------------------------------------------------------------------------

/** Build a single ground-floor storefront sign for one era at a slot. */
function buildStorefront(
  eraId: EraId,
  slotIndex: number,
  slot: StorefrontSlot,
  factory: StorefrontAssetFactory,
): THREE.Group {
  const g = new THREE.Group();
  g.name = `storefront-${eraId}-${slotIndex}`;
  const mats: THREE.Material[] = [];

  // Backboard (era-tinted shop facade surface behind the sign).
  const wallMat = factory.makeMaterial(eraId, 'wallStucco');
  attach(g, new THREE.BoxGeometry(slot.width + 0.7, slot.height + 1.3, 0.3), wallMat, 0, 0, -0.16, mats);

  // Sign panel with era typography + material + light.
  const signMat = factory.makeSignMaterial(eraId, STOREFRONT_TEXT[eraId][slotIndex], {
    width: 256,
    height: 128,
  });
  attach(g, new THREE.BoxGeometry(slot.width, slot.height, 0.18), signMat, 0, 0, 0.05, mats);

  // Era-specific ad-technology accents.
  addStorefrontAccents(eraId, slot, g, factory, mats);

  place(g, slot.pos, slot.rotY);
  return g;
}

/** Build a single billboard advertisement for one era at a slot. */
function buildBillboard(
  eraId: EraId,
  slotIndex: number,
  slot: BillboardSlot,
  factory: StorefrontAssetFactory,
  ribbonMat: THREE.ShaderMaterial,
): THREE.Group {
  const g = new THREE.Group();
  g.name = `billboard-${eraId}-${slotIndex}`;
  const mats: THREE.Material[] = [];

  // Billboard ad panel with era typography.
  const signMat = factory.makeSignMaterial(eraId, BILLBOARD_TEXT[eraId][slotIndex], {
    width: 512,
    height: 256,
  });
  attach(g, new THREE.BoxGeometry(slot.width, slot.height, 0.25), signMat, 0, 0, 0, mats);

  // 2055: animated shader ribbons on the designated ribbon billboard.
  if (eraId === '2055' && slot.ribbon) {
    const ribbonW = slot.width * 0.96;
    attach(g, new THREE.PlaneGeometry(ribbonW, 0.34), ribbonMat, 0, slot.height / 2 + 0.3, 0.2, mats);
    attach(g, new THREE.PlaneGeometry(ribbonW, 0.34), ribbonMat, 0, -slot.height / 2 - 0.3, 0.2, mats);
  }

  place(g, slot.pos, slot.rotY);
  return g;
}

/** Build one era layer: all storefronts + all billboards for that era. */
function buildEraLayer(
  eraId: EraId,
  factory: StorefrontAssetFactory,
  ribbonMat: THREE.ShaderMaterial,
): EraLayer {
  const group = new THREE.Group();
  group.name = `storefronts-era-${eraId}`;

  STOREFRONT_SLOTS.forEach((slot, i) => {
    group.add(buildStorefront(eraId, i, slot, factory));
  });
  BILLBOARD_SLOTS.forEach((slot, i) => {
    group.add(buildBillboard(eraId, i, slot, factory, ribbonMat));
  });

  const materials = collectMaterials(group);
  for (const m of materials) {
    m.transparent = true;
  }

  return { eraId, pos: ERA_T_POSITION[eraId], group, materials };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Create the era-distinct storefront + advertisement system.
 *
 * Builds all six era layers up front and wires an EraState subscriber so the
 * signage and ad technology crossfade smoothly as the timeline position `t`
 * animates between stops. The returned update() must be called each frame to
 * advance the 2055 shader ribbon scroll and keep the crossfade in sync with
 * the latest timeline position.
 *
 * @param eraState      Shared era state controller.
 * @param assetFactory  Procedural asset factory (sign + structural materials).
 */
export function createStorefrontSystem(
  eraState: EraState,
  assetFactory: StorefrontAssetFactory,
): StorefrontSystem {
  const root = new THREE.Group();
  root.name = 'storefronts';

  // Shared structural poles for the billboards (era-agnostic, always visible).
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.6, metalness: 0.7 });
  for (const slot of BILLBOARD_SLOTS) {
    const [x, y, z] = slot.pos;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, y, 10), poleMat);
    pole.position.set(x, y / 2, z);
    root.add(pole);
  }

  // One shared ribbon shader drives every 2055 ribbon strip.
  const ribbonMat = createRibbonMaterial();

  // Build all six era layers.
  const layers: EraLayer[] = ERA_IDS.map((eraId) => buildEraLayer(eraId, assetFactory, ribbonMat));
  for (const layer of layers) {
    root.add(layer.group);
  }

  // Track the latest timeline position; the subscriber drives the crossfade.
  let currentT = eraState.getT();
  const unsubscribe = eraState.subscribe((update) => {
    currentT = update.t;
  });

  /** Re-apply per-era opacity weights from the current timeline position. */
  function applyCrossfade(): void {
    let weight2055 = 0;
    for (const layer of layers) {
      const w = eraWeight(currentT, layer.pos);
      if (layer.eraId === '2055') weight2055 = w;
      const visible = w > 0.0001;
      layer.group.visible = visible;
      if (visible) {
        for (const m of layer.materials) {
          m.opacity = w;
        }
      }
    }
    // Shader ribbon fades with the 2055 layer via its own uniform.
    ribbonMat.uniforms.uOpacity.value = weight2055;
  }

  applyCrossfade();

  return {
    group: root,
    update(dt: number): void {
      // Advance the 2055 ribbon scroll; speed is uniform-driven (uSpeed).
      ribbonMat.uniforms.uTime.value += dt;
      applyCrossfade();
    },
    dispose(): void {
      unsubscribe();
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) {
            mat.forEach(disposeMaterial);
          } else if (mat) {
            disposeMaterial(mat);
          }
        }
      });
      ribbonMat.dispose();
      poleMat.dispose();
    },
  };
}
