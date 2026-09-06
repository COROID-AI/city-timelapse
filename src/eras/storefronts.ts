/**
 * Era storefronts module — ground-floor retail life per year.
 *
 * For each supported era (1945 / 1965 / 1985 / 2005 / 2025) this factory
 * builds a ground-floor retail facade strip: awnings, shop windows with
 * produce/mannequin content, a door, and a signage panel. Every signage and
 * awning texture is generated on a `<canvas>` using era-specific typography
 * and color palettes — never sourced from external image assets.
 *
 * Signage progression handled here (per the product requirement):
 *   1945  painted lettering     -> cream/ivory ground, serif, gold rule
 *   1965  neon tubes            -> dark ground, glowing colored tubes
 *   1985  backlit plastic       -> bright saturated plastic glow
 *   2005  vinyl banner          -> clean white/navy banner
 *   2025  digital LED           -> pixel-dot matrix, animated cursor
 *
 * Shop-type mix per era follows the block narrative:
 *   butcher/bakery/hardware/barber  -> record/tv-era diners & gas -> video
 *   rental / arcade -> chain coffee / phone -> specialty retail tech.
 *
 * Lifecycle contract: `bootstrap` (attach to a scene), `update(year)`
 * (rebuild for a new era), `dispose` (tear down). The scene-composition task
 * owns application wiring; a handoff with export paths is declared in the
 * module documentation.
 *
 * This module also exports the shared *canvas texture helper convention*
 * (`makeCanvas` / `canvasToTexture`) that the advertising module consumes, so
 * both signage systems draw on identical graphics conventions.
 */
import * as THREE from 'three';
import type { EraKey } from '../data/eraDefinition';

// ===========================================================================
// Shared canvas-texture helper convention (used by storefronts + advertising)
// ===========================================================================

/** A draw callback that renders into a sized 2D canvas context. */
export interface CanvasDraw {
  (ctx: CanvasRenderingContext2D, w: number, h: number): void;
}

/**
 * Allocate a 2D canvas and run `draw` into its context.
 * This is the canonical canvassing entrypoint for all era signage textures.
 */
export function makeCanvas(w: number, h: number, draw: CanvasDraw): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable for signage texture');
  }
  draw(ctx, canvas.width, canvas.height);
  return canvas;
}

/** Wrap a canvas in a signed, color-managed THREE CanvasTexture. */
export function canvasToTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// ===========================================================================
// Era-specific shop configuration
// ===========================================================================

/** What fills a shop window for a given kind of store. */
export type WindowKind =
  | 'produce'
  | 'bakery'
  | 'hardware'
  | 'barber'
  | 'diner'
  | 'department'
  | 'gas'
  | 'video'
  | 'arcade'
  | 'pizza'
  | 'electronics'
  | 'coffee'
  | 'pharmacy'
  | 'fastfood'
  | 'grocery'
  | 'gym'
  | 'tech'
  | 'generic';

interface ShopSpec {
  /** Text rendered on the storefront signage. */
  label: string;
  /** Which window-content illustration to draw. */
  window: WindowKind;
}

const SHOP_SPECS: Record<string, ShopSpec> = {
  butcher: { label: 'BUTCHER & SONS', window: 'produce' },
  haberdasher: { label: 'HABERDASHERY', window: 'department' },
  bakery: { label: 'BAKERY', window: 'bakery' },
  hardware: { label: 'HARDWARE', window: 'hardware' },
  barber: { label: 'BARBER', window: 'barber' },
  diner: { label: 'DINER', window: 'diner' },
  departmentStore: { label: 'DEPT STORE', window: 'department' },
  gasStation: { label: 'GAS', window: 'gas' },
  recordStore: { label: 'RECORDS', window: 'video' },
  tvStore: { label: 'TV & RADIO', window: 'electronics' },
  videoStore: { label: 'VIDEO', window: 'video' },
  arcade: { label: 'ARCADE', window: 'arcade' },
  pizza: { label: 'PIZZA', window: 'pizza' },
  electronics: { label: 'ELECTRONICS', window: 'electronics' },
  coffee: { label: 'COFFEE', window: 'coffee' },
  pharmacy: { label: 'PHARMACY', window: 'pharmacy' },
  fastFood: { label: 'FAST FOOD', window: 'fastfood' },
  grocery: { label: 'GROCERY', window: 'grocery' },
  gym: { label: 'FITNESS', window: 'gym' },
  techShop: { label: 'E-BIKE', window: 'tech' },
  phoneStore: { label: 'PHONES', window: 'tech' },
};

/** A single era's retail theme: which shops appear and the awning tint. */
interface EraShopTheme {
  /** Ordered storefront keys; the first is the corner anchor shop. */
  shops: string[];
  /** Awning color used across this era's facades. */
  awning: string;
  /** Signage rendering mode. */
  sign: 'painted' | 'neon' | 'plastic' | 'vinyl' | 'led';
}

const ERA_THEMES: Record<EraKey, EraShopTheme> = {
  1945: {
    shops: ['butcher', 'haberdasher', 'hardware', 'bakery'],
    awning: '#b33a2c',
    sign: 'painted',
  },
  1965: {
    shops: ['recordStore', 'tvStore', 'diner', 'gasStation'],
    awning: '#2f7fb8',
    sign: 'neon',
  },
  1985: {
    shops: ['videoStore', 'arcade', 'pizza', 'electronics'],
    awning: '#e0457b',
    sign: 'plastic',
  },
  2005: {
    shops: ['coffee', 'phoneStore', 'pharmacy', 'fastFood'],
    awning: '#2f86c8',
    sign: 'vinyl',
  },
  2025: {
    shops: ['coffee', 'techShop', 'grocery', 'gym'],
    awning: '#00d1ff',
    sign: 'led',
  },
};

// ===========================================================================
// Signage texture painters
// ===========================================================================

/** Painted storefront lettering (1945): cream ground, serif, gold rule. */
function paintSignage(ctx: CanvasRenderingContext2D, w: number, h: number, label: string): void {
  ctx.fillStyle = '#efe6cf';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#8a7a55';
  ctx.fillRect(0, h - 3, w, 3);
  ctx.fillStyle = '#3f3a2e';
  ctx.font = `bold ${Math.round(h * 0.42)}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h / 2);
}

/** Neon tube signage (1965): dark ground, glowing colored tubes. */
function paintNeon(ctx: CanvasRenderingContext2D, w: number, h: number, label: string): void {
  ctx.fillStyle = '#14141a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ff4d5e';
  ctx.lineWidth = Math.max(1, h * 0.05);
  ctx.shadowColor = '#ff4d5e';
  ctx.shadowBlur = 6;
  ctx.font = `bold ${Math.round(h * 0.4)}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(label, w / 2, h / 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff8fa0';
  ctx.fillText(label, w / 2, h / 2);
}

/** Backlit plastic (1985): saturated plastic glow, hard drop shadow. */
function paintPlastic(ctx: CanvasRenderingContext2D, w: number, h: number, label: string): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#ffd23e');
  grad.addColorStop(0.5, '#ff7a1a');
  grad.addColorStop(1, '#e0457b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff8e0';
  ctx.font = `900 ${Math.round(h * 0.44)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2 + 2, h / 2 + 2);
  ctx.fillStyle = '#1c1c2a';
  ctx.fillText(label, w / 2, h / 2);
}

/** Vinyl banner (2005): clean white/navy, straight sans-serif. */
function paintVinyl(ctx: CanvasRenderingContext2D, w: number, h: number, label: string): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1f3a5f';
  ctx.fillRect(0, 0, w, Math.round(h * 0.14));
  ctx.fillStyle = '#0f2a4a';
  ctx.font = `bold ${Math.round(h * 0.4)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h / 2);
}

/** Digital LED (2025): pixel-dot matrix with a blinking cursor. */
function paintLed(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  label: string,
  frame: number,
): void {
  ctx.fillStyle = '#07070d';
  ctx.fillRect(0, 0, w, h);
  const dot = Math.max(2, Math.round(h * 0.06));
  const gap = dot + Math.max(1, Math.round(dot * 0.3));
  ctx.fillStyle = '#00d1ff';
  const cols = Math.floor(w / gap);
  const rows = Math.floor(h / gap);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * gap + gap / 2;
      const y = r * gap + gap / 2;
      const on = ((c * 7 + r * 13 + frame) % 17) < 9;
      if (on) {
        ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
      }
    }
  }
  // Blinking cursor segment on the right.
  if ((frame / 2) % 2 === 0) {
    ctx.fillStyle = '#00d1ff';
    ctx.fillRect(w - Math.round(w * 0.06), Math.round(h * 0.3), Math.round(w * 0.04), Math.round(h * 0.4));
  }
  // Scrolling headline rendered over the LED matrix.
  ctx.fillStyle = '#e6f9ff';
  ctx.font = `bold ${Math.round(h * 0.22)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h * 0.78);
}

// ===========================================================================
// Shop-window content painters
// ===========================================================================

function paintWindowContent(kind: WindowKind, ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Glass tint base.
  const glass = ctx.createLinearGradient(0, 0, w, h);
  glass.addColorStop(0, 'rgba(190, 210, 225, 0.55)');
  glass.addColorStop(1, 'rgba(140, 165, 190, 0.5)');
  ctx.fillStyle = glass;
  ctx.fillRect(0, 0, w, h);

  switch (kind) {
    case 'produce': {
      ctx.fillStyle = '#7a2f1f';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(w * (0.15 + i * 0.18), h * 0.62, w * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#3f8f2f';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(w * (0.2 + i * 0.2), h * 0.3, w * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'bakery': {
      ctx.fillStyle = '#c98a3a';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(w * (0.12 + i * 0.2), h * 0.55, w * 0.12, h * 0.16);
      }
      break;
    }
    case 'hardware': {
      ctx.strokeStyle = '#6b6b6b';
      ctx.lineWidth = Math.max(1, w * 0.02);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(w * (0.18 + i * 0.2), h * 0.55, w * 0.05, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'barber': {
      ctx.fillStyle = '#d33a3a';
      ctx.fillRect(w * 0.42, h * 0.2, w * 0.16, h * 0.5);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(w * 0.44, h * (0.26 + i * 0.14), w * 0.12, h * 0.05);
      }
      break;
    }
    case 'diner':
    case 'fastfood': {
      ctx.fillStyle = '#e8c06a';
      ctx.fillRect(w * 0.2, h * 0.4, w * 0.6, h * 0.3);
      ctx.fillStyle = '#7a2f1f';
      ctx.fillRect(w * 0.3, h * 0.46, w * 0.4, h * 0.12);
      break;
    }
    case 'department': {
      ctx.fillStyle = '#b18a5a';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(w * (0.15 + i * 0.28), h * 0.3, w * 0.14, h * 0.5);
      }
      break;
    }
    case 'gas': {
      ctx.fillStyle = '#c33';
      ctx.fillRect(w * 0.3, h * 0.3, w * 0.4, h * 0.45);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(h * 0.3)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAS', w / 2, h / 2);
      break;
    }
    case 'video': {
      ctx.fillStyle = '#3a3a4a';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(w * (0.1 + i * 0.21), h * 0.35, w * 0.13, h * 0.4);
      }
      break;
    }
    case 'arcade': {
      ctx.fillStyle = '#ff4d5e';
      ctx.fillRect(w * 0.2, h * 0.25, w * 0.6, h * 0.55);
      ctx.fillStyle = '#ffe14d';
      ctx.font = `bold ${Math.round(h * 0.3)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME', w / 2, h / 2);
      break;
    }
    case 'pizza': {
      ctx.fillStyle = '#e8b04a';
      ctx.beginPath();
      ctx.moveTo(w * 0.3, h * 0.25);
      ctx.lineTo(w * 0.7, h * 0.25);
      ctx.lineTo(w * 0.5, h * 0.8);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'electronics': {
      ctx.fillStyle = '#2b2b33';
      ctx.fillRect(w * 0.2, h * 0.25, w * 0.6, h * 0.4);
      ctx.fillStyle = '#7fd0ff';
      ctx.fillRect(w * 0.26, h * 0.32, w * 0.48, h * 0.18);
      break;
    }
    case 'coffee': {
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(w * 0.35, h * 0.3, w * 0.3, h * 0.45);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(h * 0.25)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('COFFEE', w / 2, h / 2);
      break;
    }
    case 'pharmacy': {
      ctx.fillStyle = '#1f7fb8';
      ctx.fillRect(w * 0.3, h * 0.3, w * 0.4, h * 0.4);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(h * 0.22)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RX', w / 2, h / 2);
      break;
    }
    case 'grocery': {
      ctx.fillStyle = '#3f8f3f';
      ctx.fillRect(w * 0.12, h * 0.4, w * 0.2, h * 0.3);
      ctx.fillStyle = '#c94a2a';
      ctx.fillRect(w * 0.42, h * 0.4, w * 0.2, h * 0.3);
      ctx.fillStyle = '#e8c04a';
      ctx.fillRect(w * 0.72, h * 0.4, w * 0.2, h * 0.3);
      break;
    }
    case 'gym': {
      ctx.fillStyle = '#33333d';
      ctx.fillRect(w * 0.15, h * 0.2, w * 0.7, h * 0.6);
      ctx.fillStyle = '#e0457b';
      ctx.font = `bold ${Math.round(h * 0.3)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GYM', w / 2, h / 2);
      break;
    }
    case 'tech': {
      ctx.fillStyle = '#0f0f16';
      ctx.fillRect(w * 0.1, h * 0.2, w * 0.8, h * 0.6);
      ctx.fillStyle = '#00d1ff';
      ctx.font = `bold ${Math.round(h * 0.26)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('E-BIKE', w / 2, h / 2);
      break;
    }
    case 'generic':
    default:
      break;
  }

  // Reflection streak across the glass.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(w * 0.08, h * 0.12, w * 0.1, h * 0.76);
}

// ===========================================================================
// Storefront factory
// ===========================================================================

/** A single storefront strip attached to the scene. */
export interface StorefrontRig {
  /** Root group holding all meshes for this storefront. */
  group: THREE.Group;
  /** The signage mesh (its texture is swapped on era update). */
  signMesh: THREE.Mesh;
  /** The sign texture currently applied. */
  signTexture: THREE.CanvasTexture;
  /** The awning mesh (its color is swapped on era update). */
  awningMesh: THREE.Mesh;
  /** The window-content texture mesh (swapped on era update). */
  windowMesh: THREE.Mesh;
  /** Width of this storefront in world units. */
  width: number;
  /** Current era this rig was built for. */
  era: EraKey;
}

/** The storefronts factory object. */
export interface StorefrontsFactory {
  /** Attach the storefront strip to a scene; returns the rigs built. */
  bootstrap: (scene: THREE.Scene) => StorefrontRig[];
  /** Rebuild the storefronts for a new era. */
  update: (year: EraKey) => StorefrontRig[];
  /** Remove all storefront meshes from the scene. */
  dispose: () => void;
  /** The rigs currently attached (read-only accessor). */
  readonly rigs: StorefrontRig[];
}

const STORE_WIDTH = 3.2;
const STORE_HEIGHT = 3.6;
const SIGN_W = 2.2;
const SIGN_H = 0.7;
const AWNING_H = 0.5;
const WINDOW_W = 1.7;
const WINDOW_H = 1.5;

/**
 * Build the storefronts module. The returned factory is wired to a single
 * scene so `update` and `dispose` can cheaply manage the attached rigs.
 */
export function createStorefrontsFactory(): StorefrontsFactory {
  let rigs: StorefrontRig[] = [];
  let currentYear: EraKey | null = null;
  // The scene the rigs are currently attached to (set on bootstrap) so that
  // `update` can reattach the freshly built rigs for a new era.
  let sceneRef: THREE.Scene | null = null;
  let frame = 0;

  function buildRig(year: EraKey, index: number): StorefrontRig {
    const theme = ERA_THEMES[year];
    const specKey = theme.shops[index % theme.shops.length];
    const spec = SHOP_SPECS[specKey];
    const group = new THREE.Group();
    const x = (index - (theme.shops.length - 1) / 2) * STORE_WIDTH;

    // --- Signage panel ---
    const signCanvas = makeCanvas(SIGN_W * 128, SIGN_H * 128, (ctx, w, h) => {
      switch (theme.sign) {
        case 'painted':
          paintSignage(ctx, w, h, spec.label);
          break;
        case 'neon':
          paintNeon(ctx, w, h, spec.label);
          break;
        case 'plastic':
          paintPlastic(ctx, w, h, spec.label);
          break;
        case 'vinyl':
          paintVinyl(ctx, w, h, spec.label);
          break;
        case 'led':
          paintLed(ctx, w, h, spec.label, frame);
          break;
      }
    });
    const signTexture = canvasToTexture(signCanvas);
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(SIGN_W, SIGN_H),
      new THREE.MeshStandardMaterial({ map: signTexture }),
    );
    signMesh.position.set(x, STORE_HEIGHT - SIGN_H / 2 - 0.1, 0.02);

    // --- Awning (striped canvas) ---
    const awningCanvas = makeCanvas(SIGN_W * 96, AWNING_H * 96, (ctx, w, h) => {
      const stripe = Math.max(2, Math.round(w / 10));
      for (let i = 0; i * stripe < w; i++) {
        ctx.fillStyle = i % 2 === 0 ? theme.awning : '#e8e2d6';
        ctx.fillRect(i * stripe, 0, stripe, h);
      }
    });
    const awningTexture = canvasToTexture(awningCanvas);
    const awningMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(SIGN_W, AWNING_H),
      new THREE.MeshStandardMaterial({ map: awningTexture }),
    );
    awningMesh.position.set(x, STORE_HEIGHT - SIGN_H - AWNING_H / 2 - 0.12, 0.02);

    // --- Shop window with content ---
    const windowCanvas = makeCanvas(WINDOW_W * 128, WINDOW_H * 128, (ctx, w, h) => {
      paintWindowContent(spec.window, ctx, w, h);
    });
    const windowTexture = canvasToTexture(windowCanvas);
    const windowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(WINDOW_W, WINDOW_H),
      new THREE.MeshStandardMaterial({ map: windowTexture, transparent: true }),
    );
    windowMesh.position.set(x - WINDOW_W / 4 - 0.05, WINDOW_H / 2 + 0.1, 0.02);

    // --- Door ---
    const doorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.9, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x3a2f26, roughness: 0.6 }),
    );
    doorMesh.position.set(x + WINDOW_W / 4 + 0.2, 1.9 / 2 + 0.1, 0.02);

    group.add(signMesh, awningMesh, windowMesh, doorMesh);
    return {
      group,
      signMesh,
      signTexture,
      awningMesh,
      windowMesh,
      width: STORE_WIDTH,
      era: year,
    };
  }

  return {
    get rigs() {
      return rigs;
    },
    bootstrap(scene: THREE.Scene): StorefrontRig[] {
      // Default to the earliest era on bootstrap.
      const year: EraKey = currentYear ?? 1945;
      currentYear = year;
      sceneRef = scene;
      const theme = ERA_THEMES[year];
      rigs = theme.shops.map((_, i) => buildRig(year, i));
      for (const rig of rigs) {
        scene.add(rig.group);
      }
      return rigs;
    },
    update(year: EraKey): StorefrontRig[] {
      // Advance the LED animation frame on each update.
      frame += 1;
      currentYear = year;
      const theme = ERA_THEMES[year];
      const next = theme.shops.map((_, i) => buildRig(year, i));
      for (const rig of rigs) {
        // Remove old groups from the scene.
        if (rig.group.parent) {
          rig.group.parent.remove(rig.group);
        }
      }
      rigs = next;
      // Reattach the newly built rigs.
      if (sceneRef) {
        for (const rig of rigs) {
          sceneRef.add(rig.group);
        }
      }
      return rigs;
    },
    dispose(): void {
      for (const rig of rigs) {
        if (rig.group.parent) {
          rig.group.parent.remove(rig.group);
        }
      }
      rigs = [];
      currentYear = null;
      sceneRef = null;
    },
  };
}

// ===========================================================================
// Era-specific facade definition (registers the storefronts segment)
// ===========================================================================

/**
 * Resolve the storefront definition for a year. This is the canonical
 * per-era facade descriptor the composition task can query.
 */
export function storefrontsDefinition(year: EraKey): {
  year: EraKey;
  awning: string;
  sign: 'painted' | 'neon' | 'plastic' | 'vinyl' | 'led';
  shops: string[];
  labels: string[];
} {
  const theme = ERA_THEMES[year];
  return {
    year,
    awning: theme.awning,
    sign: theme.sign,
    shops: theme.shops,
    labels: theme.shops.map((k) => SHOP_SPECS[k].label),
  };
}

/** Convenience default export used by the composition task. */
export function storefrontsFactory(): StorefrontsFactory {
  return createStorefrontsFactory();
}