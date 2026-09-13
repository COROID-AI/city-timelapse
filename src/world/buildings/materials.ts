/**
 * Procedural materials for the era building sets.
 *
 * Every material used by `src/world/buildings` is generated at runtime from
 * the shared `EraPalette` / `EraBuildings` schema data plus local constants —
 * there are no asset downloads and no `fetch` calls. Facade/window/roof
 * surfaces are either flat vertex colors (solid `MeshLambertMaterial`) or
 * lazily generated canvas textures drawn by local functions (brick courses,
 * concrete staining, curtain-wall sheen). Canvas textures only materialize
 * when a real 2D canvas context exists (browser); in the headless Node/jsdom
 * test environment they degrade to the matching flat colors, so geometry and
 * composition remain fully testable without WebGL.
 *
 * Materials are created once per era build through {@link MaterialCache} and
 * shared across every building on the block, keeping the material count
 * bounded (see the per-build `materialCount` budget asserted by tests).
 */

import * as THREE from 'three';
import type { ColorHex } from '../../era/types';

// ============================================================================
// Color helpers (0..255 byte space, lowercase '#rrggbb' tokens)
// ============================================================================

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse a `#rrggbb` token into 0..255 channels. */
export function hexToRgb(hex: ColorHex): Rgb {
  const value = hex.replace('#', '');
  if (value.length !== 6) {
    throw new Error(`hexToRgb: expected 6-digit hex, got "${hex}"`);
  }
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

/** Format 0..255 channels as a lowercase `#rrggbb` token. */
export function rgbToHex(rgb: Rgb): ColorHex {
  const byte = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0');
  return `#${byte(rgb.r)}${byte(rgb.g)}${byte(rgb.b)}`;
}

/** Linear mix of two colors; `t` 0 = a, 1 = b. */
export function mixHex(a: ColorHex, b: ColorHex, t: number): ColorHex {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return rgbToHex({ r: lerp(ca.r, cb.r), g: lerp(ca.g, cb.g), b: lerp(ca.b, cb.b) });
}

/** Multiply a color's channels by `factor` (0 = black, 1 = unchanged). */
export function shadeHex(hex: ColorHex, factor: number): ColorHex {
  const c = hexToRgb(hex);
  return rgbToHex({ r: c.r * factor, g: c.g * factor, b: c.b * factor });
}

/** Blend toward black by `t`. */
export function darkenHex(hex: ColorHex, t: number): ColorHex {
  return mixHex(hex, '#000000', t);
}

/** Blend toward white by `t`. */
export function lightenHex(hex: ColorHex, t: number): ColorHex {
  return mixHex(hex, '#ffffff', t);
}

// ============================================================================
// Lazy canvas textures (procedural only — never fetched)
// ============================================================================

/**
 * A drawing procedure that paints one tile of a repeating facade texture.
 * It runs once, lazily, only when a usable canvas context exists.
 */
export interface FacadeTextureSpec {
  id: string;
  size: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

/** Which repeating tile a facade material should try to paint. */
export type FacadeTextureKind = 'brick' | 'concrete' | 'curtain' | 'none';

/** Cache of "does this environment provide a 2D canvas context" probes. */
let canvasProbe: boolean | null = null;

/** True when a real `<canvas>` 2D context is available (browser, not jsdom). */
function canvasAvailable(): boolean {
  if (canvasProbe !== null) {
    return canvasProbe;
  }
  try {
    if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') {
      canvasProbe = false;
      return false;
    }
    // jsdom ships a stub `getContext` that prints "Not implemented" and
    // throws; a real browser reports native code. Probing the implementation
    // avoids triggering that noise and keeps the headless path quiet.
    const impl = HTMLCanvasElement.prototype.getContext;
    if (typeof impl !== 'function' || !impl.toString().includes('[native code]')) {
      canvasProbe = false;
      return false;
    }
    canvasProbe = true;
  } catch {
    canvasProbe = false;
  }
  return canvasProbe;
}

/** Paint a brick-courses tile (1945 brick / sandstone facades). */
function drawBrickCourses(ctx: CanvasRenderingContext2D): void {
  const size = ctx.canvas.width;
  const courseH = size / 8;
  const brickW = size / 4;
  for (let row = 0; row < 8; row += 1) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let col = -1; col < 5; col += 1) {
      const jitter = ((row * 7 + col * 13) % 5) / 5 - 0.5;
      const t = 0.92 + 0.16 * jitter;
      ctx.fillStyle = `rgb(${Math.round(152 * t)},${Math.round(90 * t)},${Math.round(63 * t)})`;
      ctx.fillRect(col * brickW + offset, row * courseH + courseH * 0.12, brickW * 0.94, courseH * 0.76);
    }
  }
}

/** Paint a mottled concrete panel with stain drips (1985). */
function drawConcretePanel(ctx: CanvasRenderingContext2D): void {
  const size = ctx.canvas.width;
  ctx.fillStyle = '#8f8f93';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 14; i += 1) {
    const shade = 0.86 + ((i * 31 + i * 17) % 7) / 7 * 0.2;
    ctx.fillStyle = `rgba(${Math.round(143 * shade)},${Math.round(143 * shade)},${Math.round(
      147 * shade,
    )},${0.22 + (i % 2) * 0.18})`;
    ctx.beginPath();
    ctx.arc((i * 53) % size, (i * 29) % size, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = 'rgba(64,60,58,0.16)';
    ctx.fillRect((i * 17) % size, 0, 3, size * 0.4 + (i % 3) * 6);
  }
}

/** Paint a subtle curtain-wall sheen with mullion shadows (2005/2025). */
function drawCurtainSheen(ctx: CanvasRenderingContext2D): void {
  const size = ctx.canvas.width;
  ctx.fillStyle = '#b7c4cd';
  ctx.fillRect(0, 0, size, size);
  const rows = 6;
  const rowH = size / rows;
  for (let row = 0; row < rows; row += 1) {
    const band = 0.84 + ((row * 3) % 4) / 4 * 0.18;
    ctx.fillStyle = `rgb(${Math.round(183 * band)},${Math.round(196 * band)},${Math.round(205 * band)})`;
    ctx.fillRect(0, row * rowH, size, rowH * 0.5);
    ctx.fillStyle = 'rgba(30,34,40,0.25)';
    ctx.fillRect(0, row * rowH + rowH * 0.5, size, 1.5);
  }
}

/** Look up the drawing procedure for a facade texture kind. */
function facadeTexture(kind: FacadeTextureKind): FacadeTextureSpec | undefined {
  switch (kind) {
    case 'brick':
      return { id: 'brick', size: 64, draw: drawBrickCourses };
    case 'concrete':
      return { id: 'concrete', size: 64, draw: drawConcretePanel };
    case 'curtain':
      return { id: 'curtain', size: 64, draw: drawCurtainSheen };
    case 'none':
      return undefined;
  }
}

// ============================================================================
// Material cache
// ============================================================================

/** One shared-material recipe. Textures are applied lazily when canvas exists. */
export interface MaterialSpec {
  id: string;
  color: ColorHex;
  emissive?: ColorHex;
  texture?: FacadeTextureSpec;
}

/**
 * Creates shared `MeshLambertMaterial` instances, deduplicated by spec id, so
 * the whole building set for one era shares a bounded material pool. Each
 * material reports its `name` = spec id for diagnostics, disposal and budget
 * checks.
 */
export class MaterialCache {
  private readonly store = new Map<string, THREE.MeshLambertMaterial>();

  get(spec: MaterialSpec): THREE.MeshLambertMaterial {
    const existing = this.store.get(spec.id);
    if (existing) {
      return existing;
    }
    const material = new THREE.MeshLambertMaterial({
      color: spec.color,
      ...(spec.emissive ? { emissive: spec.emissive } : {}),
    });
    material.name = spec.id;
    if (spec.texture && canvasAvailable()) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = spec.texture.size;
        canvas.height = spec.texture.size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          spec.texture.draw(ctx);
          material.map = new THREE.CanvasTexture(canvas);
        }
      } catch {
        // A failed texture attempt degrades to the flat vertex color; the
        // geometry and composition remain valid either way.
      }
    }
    this.store.set(spec.id, material);
    return material;
  }

  /** Number of distinct material instances created so far. */
  get size(): number {
    return this.store.size;
  }

  /** All shared materials, for teardown and budget reporting. */
  all(): THREE.MeshLambertMaterial[] {
    return [...this.store.values()];
  }

  dispose(): void {
    for (const material of this.store.values()) {
      material.dispose();
    }
    this.store.clear();
  }
}

// ============================================================================
// Per-era material set
// ============================================================================

/**
 * The complete, bounded set of shared materials an era's buildings may use.
 * Every field is a shared instance from `cache`, so 16 lots reuse one pool.
 */
export interface EraMaterials {
  facadeA: THREE.MeshLambertMaterial;
  facadeB: THREE.MeshLambertMaterial;
  facadeC: THREE.MeshLambertMaterial;
  facadeDark: THREE.MeshLambertMaterial;
  trim: THREE.MeshLambertMaterial;
  trimDark: THREE.MeshLambertMaterial;
  roof: THREE.MeshLambertMaterial;
  roofGreen: THREE.MeshLambertMaterial;
  glassDay: THREE.MeshLambertMaterial;
  glassLit: THREE.MeshLambertMaterial;
  glassStorefront: THREE.MeshLambertMaterial;
  spandrel: THREE.MeshLambertMaterial;
  steel: THREE.MeshLambertMaterial;
  steelDark: THREE.MeshLambertMaterial;
  rust: THREE.MeshLambertMaterial;
  soot: THREE.MeshLambertMaterial;
  iron: THREE.MeshLambertMaterial;
  concrete: THREE.MeshLambertMaterial;
  glassBlock: THREE.MeshLambertMaterial;
  solar: THREE.MeshLambertMaterial;
  solarFrame: THREE.MeshLambertMaterial;
  turbine: THREE.MeshLambertMaterial;
  turbineDark: THREE.MeshLambertMaterial;
  awning: THREE.MeshLambertMaterial;
  awningDark: THREE.MeshLambertMaterial;
  mullion: THREE.MeshLambertMaterial;
  planter: THREE.MeshLambertMaterial;
  planterDark: THREE.MeshLambertMaterial;
}

/**
 * Build the material pool for one era from its (possibly theme-overridden)
 * palette and building theme. Colors are derived procedurally: facade base
 * tones come straight from `palette.facadeMaterials`, while trims, glass,
 * metal, roof and wear tones are mixes/shades of the shared palette tokens.
 * `textureKind` selects the repeating canvas tile painted on the primary
 * facade material when a canvas context exists.
 */
export function createEraMaterials(
  cache: MaterialCache,
  palette: {
    facadeMaterials: readonly ColorHex[];
    accent: ColorHex;
    signageGlow: ColorHex;
    sky: ColorHex;
  },
  glow: { interior: ColorHex; storefront: ColorHex; signage: ColorHex },
  textureKind: FacadeTextureKind,
): EraMaterials {
  const facades = palette.facadeMaterials;
  const facadeA = facades.length > 0 ? facades[0]! : '#9aa0a6';
  const facadeB = facades.length > 1 ? facades[1]! : facadeA;
  const facadeC = facades.length > 2 ? facades[2]! : mixHex(facadeA, facadeB, 0.5);
  const concreteBase = mixHex(facadeB, '#8b8b90', 0.55);
  const glassDay = mixHex(palette.sky, '#1c2733', 0.55);
  const steelTone = mixHex(facadeA, '#5a6068', 0.55);
  void palette.signageGlow; // reserved: sign-band materials can use it later
  void glow.signage; // reserved for per-era signage emissive tuning

  return {
    // Flat facade tones + the era's repeating canvas tile on the main tone.
    facadeA: cache.get({ id: 'facade-a', color: facadeA, texture: facadeTexture(textureKind) }),
    facadeB: cache.get({ id: 'facade-b', color: facadeB }),
    facadeC: cache.get({ id: 'facade-c', color: facadeC }),
    facadeDark: cache.get({ id: 'facade-dark', color: darkenHex(facadeB, 0.28) }),

    // Cornices, parapets, window trims, sills, quoins and sign bands.
    trim: cache.get({ id: 'trim', color: mixHex(facadeC, palette.accent, 0.3) }),
    trimDark: cache.get({ id: 'trim-dark', color: shadeHex(mixHex(facadeC, palette.accent, 0.3), 0.55) }),

    // Roofs: dark membrane, plus the 2025 green roof cap.
    roof: cache.get({ id: 'roof', color: darkenHex(facadeB, 0.62) }),
    roofGreen: cache.get({ id: 'roof-green', color: mixHex(facadeA, '#3f7d4c', 0.6) }),

    // Glass + emissive night variants.
    glassDay: cache.get({ id: 'glass-day', color: glassDay, emissive: glow.interior }),
    glassLit: cache.get({
      id: 'glass-lit',
      color: lightenHex(glassDay, 0.18),
      emissive: lightenHex(glow.interior, 0.12),
    }),
    glassStorefront: cache.get({
      id: 'glass-storefront',
      color: lightenHex(glassDay, 0.3),
      emissive: glow.storefront,
    }),
    spandrel: cache.get({ id: 'spandrel', color: darkenHex(glassDay, 0.3) }),

    // Metals & concrete.
    steel: cache.get({ id: 'steel', color: steelTone }),
    steelDark: cache.get({ id: 'steel-dark', color: shadeHex(steelTone, 0.62) }),
    rust: cache.get({ id: 'rust', color: mixHex(palette.accent, '#7a3b1e', 0.55) }),
    soot: cache.get({ id: 'soot', color: '#3b3a3d' }),
    iron: cache.get({ id: 'iron', color: mixHex(steelTone, '#121316', 0.45) }),
    concrete: cache.get({ id: 'concrete', color: concreteBase, texture: facadeTexture(textureKind) }),
    glassBlock: cache.get({ id: 'glass-block', color: '#cfe3ea', emissive: glow.storefront }),

    // 2025 green-tech details.
    solar: cache.get({ id: 'solar', color: '#22314f' }),
    solarFrame: cache.get({ id: 'solar-frame', color: '#3d4654' }),
    turbine: cache.get({ id: 'turbine', color: '#e8e9ea' }),
    turbineDark: cache.get({ id: 'turbine-dark', color: '#9aa0a8' }),
    awning: cache.get({ id: 'awning', color: palette.accent }),
    awningDark: cache.get({ id: 'awning-dark', color: shadeHex(palette.accent, 0.6) }),
    mullion: cache.get({ id: 'mullion', color: mixHex(steelTone, '#d6dbe2', 0.35) }),
    planter: cache.get({ id: 'planter', color: mixHex(facadeA, '#2f6b3a', 0.65) }),
    planterDark: cache.get({ id: 'planter-dark', color: darkenHex(facadeA, 0.55) }),
  };
}