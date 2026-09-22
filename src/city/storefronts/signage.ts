/**
 * Procedural signage texture generators for era-correct shopfront art.
 *
 * Every sign face used by the storefront module — fascia plates, transom
 * lettering, blade signs, billboards, poster walls, kiosk ads, newsstands,
 * menu boards, ticker strips, and window-display backdrops — is drawn onto
 * an HTML5 canvas at runtime through the shared `ProceduralGfxLibrary`
 * (safe canvas creation, deterministic PRNG, color utils, and the shared
 * signage/neon spec generators). No image assets, no fonts downloaded, and
 * no real trademarks: brand names and ad copy come from the invented era
 * catalogues in `variants.ts`.
 *
 * Textures are memoized per (kind, era, brand, copy, seed, size) so a city
 * block full of bays shares GPU textures, and callers pre-generate all five
 * era textures up front so era transitions crossfade materials instead of
 * rebuilding textures mid-morph (no texture popping).
 *
 * Canvas drawing is guarded: headless test environments without a 2D
 * context still receive valid texture objects plus full generator metadata.
 */

import * as THREE from 'three';
import { ProceduralGfxLibrary } from '../../gfx/materials';
import type { EraYear } from '../../era/timeline';
import {
  ERA_STOREFRONT_VARIANTS,
  brandForBay,
  headlineForSlot,
  taglineForBay,
  type EraStorefrontVariant,
} from './variants';

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

/** One generated signage texture plus its render metadata. */
export interface SignageTexture {
  /** Shared, memoized canvas texture ready for a material map. */
  readonly texture: THREE.CanvasTexture;
  /** Generator id, e.g. `fascia.neon-tube` or `billboard.bold-neon-rooftop`. */
  readonly kind: string;
  /** Canvas width in pixels. */
  readonly width: number;
  /** Canvas height in pixels. */
  readonly height: number;
  /** Emissive glow color (#rrggbb) this art expects when lit. */
  readonly emissiveColor: string;
  /** Baseline emissive intensity this art expects (era drive character). */
  readonly emissiveIntensity: number;
}

/** Inputs shared by every generator. */
export interface SignageArtOptions {
  /** Era variant declaring the treatment style. */
  variant: EraStorefrontVariant;
  /** Bay index along the facade; seeds stable per-bay art. */
  bayIndex?: number;
  /** Shop name override; defaults to the variant's deterministic bay brand. */
  brand?: string;
  /** Tagline override; defaults to the variant's deterministic bay tagline. */
  tagline?: string;
  /** Ad copy override; defaults to the variant's deterministic headline. */
  headline?: string;
  /** Texture seed override; defaults to a stable era+bay+kind derived seed. */
  seed?: number;
}

/** All sign/display art one bay needs across all five eras. */
export interface BaySignageArt {
  /** Fascia band sign (mounted in the 3.2..4.2 band). */
  readonly fascia: SignageTexture;
  /** Entry transom glass lettering. */
  readonly transom: SignageTexture;
  /** Projecting blade sign, or null for eras without one. */
  readonly blade: SignageTexture | null;
  /** Rooftop/wall billboard face. */
  readonly billboard: SignageTexture;
  /** Poster-wall / flyer quad art. */
  readonly poster: SignageTexture;
  /** Pavement kiosk advertisement art. */
  readonly kiosk: SignageTexture;
  /** Scrolling window ticker strip, or null when the era has none. */
  readonly ticker: SignageTexture | null;
  /** Backlit menu board, or null when the era has none. */
  readonly menuBoard: SignageTexture | null;
  /** Window-display backdrop art. */
  readonly windowDisplay: SignageTexture;
  /** Newsstand front-page / rack card art. */
  readonly newsstand: SignageTexture;
}

/* -------------------------------------------------------------------------- */
/* Memoization                                                                 */
/* -------------------------------------------------------------------------- */

const TEXTURE_CACHE = new Map<string, SignageTexture>();

/** Current memoized texture count (exposed for tests and diagnostics). */
export function signageCacheSize(): number {
  return TEXTURE_CACHE.size;
}

/** Dispose every memoized signage texture (teardown and test isolation). */
export function disposeSignageTextureCache(): void {
  for (const entry of TEXTURE_CACHE.values()) {
    entry.texture.dispose();
  }
  TEXTURE_CACHE.clear();
}

function memoize(
  key: string,
  create: () => SignageTexture,
): SignageTexture {
  const hit = TEXTURE_CACHE.get(key);
  if (hit) return hit;
  const made = create();
  TEXTURE_CACHE.set(key, made);
  return made;
}

/* -------------------------------------------------------------------------- */
/* Shared drawing helpers (all via gfx-materials canvas primitives)            */
/* -------------------------------------------------------------------------- */

const { createSafeCanvas, createCanvasTexture, createPRNG, parseColor } = ProceduralGfxLibrary;

/** Blend a hex color toward white by `t` in 0..1 (channel lerp + rgb string). */
function tintTowardWhite(colorStr: string, t: number): string {
  const c = parseColor(colorStr);
  const mix = (from: number, to: number): number => Math.round(from + (to - from) * t);
  return `rgb(${mix(c.r, 255)}, ${mix(c.g, 255)}, ${mix(c.b, 255)})`;
}

/** Fonts are system families only; nothing is fetched at runtime. */
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'Arial, Helvetica, sans-serif';
const CONDENSED = '"Arial Narrow", Impact, sans-serif';
const MONO = '"Courier New", Courier, monospace';

interface DrawSpec {
  width: number;
  height: number;
  seed: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number, seed: number) => void;
}

/** Run a draw callback against a safe 2D context; no-ops headlessly. */
function drawCanvas(spec: DrawSpec): HTMLCanvasElement {
  const { canvas, ctx } = createSafeCanvas(spec.width, spec.height);
  if (ctx) {
    ctx.clearRect(0, 0, spec.width, spec.height);
    spec.draw(ctx, spec.width, spec.height, spec.seed);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  return canvas;
}

/** Rounded-rectangle path helper (polyfill for older canvas impls). */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** Fill a rounded panel with a subtle vertical gradient. */
function fillPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  top: string,
  bottom: string,
): void {
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = grad;
  ctx.fill();
}

/** Speckled grain overlay for painted/weathered surfaces. */
function speckle(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  count: number,
  alpha: number,
): void {
  const rng = createPRNG(seed);
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    ctx.globalAlpha = alpha * rng.range(0.3, 1);
    ctx.fillStyle = rng.chance(0.5) ? '#000000' : '#ffffff';
    const size = rng.range(0.5, 2.2);
    ctx.fillRect(rng.range(0, width), rng.range(0, height), size, size);
  }
  ctx.restore();
}

/** Fit a font size so `text` never exceeds `maxWidth`. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  baseSize: number,
  family: string,
  weight: string,
  text: string,
  maxWidth: number,
): string {
  let size = baseSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 8 && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return ctx.font;
}

/** Draw text with an optional outer glow (neon/backlit looks). */
function glowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  blur: number,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Horizontal scallop/awning-stripe ribbon used by 1945/1965 treatments. */
function stripeRibbon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  a: string,
  b: string,
  count: number,
): void {
  const step = w / count;
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? a : b;
    ctx.fillRect(x + i * step, y, step + 0.5, h);
  }
}

/** Dot-matrix mask: punch a dark grid over art to fake LED pixels. */
function matrixMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pitch: number,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  for (let x = 0; x < width; x += pitch) ctx.fillRect(x, 0, 1, height);
  for (let y = 0; y < height; y += pitch) ctx.fillRect(0, y, width, 1);
  ctx.restore();
}

/** Stable derived seed for one piece of bay art. */
function derivedSeed(kind: string, variant: EraStorefrontVariant, bayIndex: number, override?: number): number {
  if (typeof override === 'number') return override;
  return variant.year * 1000 + bayIndex * 37 + kind.length * 11 + kind.charCodeAt(0);
}

/** Emissive color a lit sign of this era should glow. */
function emissiveColorFor(variant: EraStorefrontVariant): string {
  const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
  const swatch = palette.materials.neonEmissive;
  return swatch.emissive ?? palette.accent;
}

function makeTexture(
  canvas: HTMLCanvasElement,
  kind: string,
  width: number,
  height: number,
  emissiveColor: string,
  emissiveIntensity: number,
): SignageTexture {
  return {
    texture: createCanvasTexture(canvas),
    kind,
    width,
    height,
    emissiveColor,
    emissiveIntensity,
  };
}

/* -------------------------------------------------------------------------- */
/* Fascia sign generators (one per era sign kind)                              */
/* -------------------------------------------------------------------------- */

function drawEnamelPlate(
  variant: EraStorefrontVariant,
  brand: string,
  tagline: string,
  seed: number,
): SignageTexture {
  const width = 512;
  const height = 128;
  const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
  // Delegate the painted/enamel base art to the shared signage spec generator.
  const spec = ProceduralGfxLibrary.generateSignageTextureSpec({
    width,
    height,
    seed,
    title: brand,
    subtitle: tagline,
    style: 'painted-enamel',
    primaryColor: palette.materials.paintSignage.color,
    secondaryColor: '#f4e8c1',
    accentColor: palette.accent,
    weathering: palette.defaultWeathering,
    border: true,
  });
  const canvas = drawCanvas({
    width,
    height,
    seed,
    draw: (ctx, w, h) => {
      // Overwrite with the shared spec output, then add era grain.
      ctx.drawImage(spec.canvas, 0, 0, w, h);
      speckle(ctx, w, h, seed, 260, 0.10 + palette.defaultWeathering * 0.12);
    },
  });
  return makeTexture(canvas, 'fascia.enamel-plate', width, height, palette.accent, 0.1);
}

function drawChannelLetters(
  variant: EraStorefrontVariant,
  brand: string,
  tagline: string,
  seed: number,
): SignageTexture {
  const width = 512;
  const height = 128;
  const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
  const pastel = palette.materials.paintSignage.color;
  const canvas = drawCanvas({
    width,
    height,
    seed,
    draw: (ctx, w, h) => {
      // Pastel acrylic back plate: soft mint/peach panel behind the letters.
      fillPanel(ctx, 0, 0, w, h, 6, '#fbfbf6', pastel);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Extruded channel-letter shadow.
      fitFont(ctx, 46, SANS, 'bold', brand, w - 48);
      ctx.fillStyle = 'rgba(40, 40, 50, 0.35)';
      ctx.fillText(brand, w / 2 + 4, h * 0.42 + 5);
      // Letter face with slight plastic bevel highlight.
      ctx.fillStyle = '#ffffff';
      ctx.fillText(brand, w / 2, h * 0.42);
      ctx.fillStyle = tintTowardWhite(pastel, 0.35);
      ctx.font = `bold 46px ${SANS}`;
      ctx.fillText(brand, w / 2, h * 0.42 - 1);
      // Chrome underline rule + tagline.
      ctx.fillStyle = palette.accent;
      ctx.fillRect(w * 0.18, h * 0.66, w * 0.64, 3);
      fitFont(ctx, 20, SANS, 'bold', tagline, w - 60);
      ctx.fillStyle = '#3d4450';
      ctx.fillText(tagline, w / 2, h * 0.8);
    },
  });
  return makeTexture(canvas, 'fascia.pastel-channel-letters', width, height, emissiveColorFor(variant), 0.8);
}

function drawNeonFascia(
  variant: EraStorefrontVariant,
  brand: string,
  tagline: string,
  seed: number,
): SignageTexture {
  const width = 512;
  const height = 128;
  const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
  // Shared neon generator draws the glowing tube lettering.
  const spec = ProceduralGfxLibrary.generateNeonTextureSpec({
    width,
    height,
    seed,
    neonText: brand,
    primaryColor: palette.accent,
    secondaryColor: '#ffffff',
    glowRadius: 26,
  });
  const canvas = drawCanvas({
    width,
    height,
    seed,
    draw: (ctx, w, h) => {
      ctx.drawImage(spec.canvas, 0, 0, w, h);
      // Secondary tube line: tagline in a thinner tube.
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitFont(ctx, 18, CONDENSED, 'bold', tagline, w - 60);
      glowText(ctx, tagline, w / 2, h * 0.82, palette.materials.neonEmissive.emissive ?? '#ff9a3c', 12);
    },
  });
  return makeTexture(canvas, 'fascia.neon-tube', width, height, emissiveColorFor(variant), variant.emissive.baseIntensity);
}

function drawPushThrough(
  variant: EraStorefrontVariant,
  brand: string,
  tagline: string,
  seed: number,
): SignageTexture {
  const width = 512;
  const height = 128;
  const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
  const glow = palette.materials.neonEmissive.emissive ?? palette.accent;
  const canvas = drawCanvas({
    width,
    height,
    seed,
    draw: (ctx, w, h) => {
      // Deep blue acrylic box with a glossy sheen.
      fillPanel(ctx, 0, 0, w, h, 8, '#0e1c33', '#173254');
      const sheen = ctx.createLinearGradient(0, 0, w, 0);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0.10)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);
      // Push-through letters: dark bezel, bright core, outer halo.
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitFont(ctx, 48, SANS, 'bold', brand, w - 48);
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 7;
      ctx.strokeText(brand, w / 2, h * 0.42);
      glowText(ctx, brand, w / 2, h * 0.42, glow, 22);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(brand, w / 2, h * 0.42);
      // Chain-identity rule and tagline.
      ctx.fillStyle = palette.accent;
      ctx.fillRect(w * 0.1, h * 0.68, w * 0.8, 4);
      fitFont(ctx, 19, SANS, 'bold', tagline, w - 60);
      ctx.fillStyle = '#cfe0ff';
      ctx.fillText(tagline, w / 2, h * 0.83);
    },
  });
  return makeTexture(canvas, 'fascia.push-through-plastic', width, height, emissiveColorFor(variant), variant.emissive.baseIntensity);
}

function drawLedMatrix(
  variant: EraStorefrontVariant,
  brand: string,
  tagline: string,
  seed: number,
): SignageTexture {
  const width = 512;
  const height = 128;
  const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
  const canvas = drawCanvas({
    width,
    height,
    seed,
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Chunky monospaced lettering reads as an LED matrix once masked.
      fitFont(ctx, 44, MONO, 'bold', brand, w - 40);
      glowText(ctx, brand, w / 2, h * 0.4, palette.accent, 14);
      ctx.fillStyle = '#eafff6';
      ctx.fillText(brand, w / 2, h * 0.4);
      fitFont(ctx, 17, MONO, 'bold', tagline, w - 60);
      ctx.fillStyle = palette.materials.neonEmissive.emissive ?? '#eafff6';
      ctx.fillText(tagline, w / 2, h * 0.76);
      // Scanning brightness band, then the LED pixel grid.
      const band = ctx.createLinearGradient(0, 0, w, h);
      band.addColorStop(0, 'rgba(255,255,255,0.06)');
      band.addColorStop(0.5, 'rgba(255,255,255,0.0)');
      band.addColorStop(1, 'rgba(255,255,255,0.06)');
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, w, h);
      matrixMask(ctx, w, h, 5);
    },
  });
  return makeTexture(canvas, 'fascia.led-matrix', width, height, emissiveColorFor(variant), variant.emissive.baseIntensity);
}

/**
 * Create the fascia-band sign texture for one era + bay.
 * Dispatch is driven entirely by `variant.fasciaSign`.
 */
export function createFasciaSignTexture(options: SignageArtOptions): SignageTexture {
  const { variant } = options;
  const bayIndex = options.bayIndex ?? 0;
  const brand = options.brand ?? brandForBay(variant, bayIndex);
  const tagline = options.tagline ?? taglineForBay(variant, bayIndex);
  const seed = derivedSeed(`fascia-${variant.fasciaSign}`, variant, bayIndex, options.seed);
  const key = `fascia|${variant.year}|${variant.fasciaSign}|${brand}|${tagline}|${seed}`;
  return memoize(key, () => {
    switch (variant.fasciaSign) {
      case 'enamel-plate':
        return drawEnamelPlate(variant, brand, tagline, seed);
      case 'pastel-channel-letters':
        return drawChannelLetters(variant, brand, tagline, seed);
      case 'neon-tube':
        return drawNeonFascia(variant, brand, tagline, seed);
      case 'push-through-plastic':
        return drawPushThrough(variant, brand, tagline, seed);
      case 'led-matrix':
        return drawLedMatrix(variant, brand, tagline, seed);
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Transom glass lettering                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Entry transom lettering. 1945 gets hand-painted gold-leaf serif glass;
 * later eras echo their fascia treatment at smaller scale on the glass.
 */
export function createTransomLetteringTexture(options: SignageArtOptions): SignageTexture {
  const { variant } = options;
  const bayIndex = options.bayIndex ?? 0;
  const brand = options.brand ?? brandForBay(variant, bayIndex);
  const seed = derivedSeed('transom', variant, bayIndex, options.seed);
  const key = `transom|${variant.year}|${variant.transomSign}|${brand}|${seed}`;
  return memoize(key, () => {
    const width = 512;
    const height = 96;
    const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
    if (variant.transomSign === 'gold-leaf-glass') {
      const canvas = drawCanvas({
        width,
        height,
        seed,
        draw: (ctx, w, h) => {
          // Transparent glass: only the gold-leaf paint is opaque.
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const font = fitFont(ctx, 44, SERIF, 'bold', brand, w - 60);
          ctx.font = font;
          // Gold-leaf gradient with a dark keyline, as sign-writers laid it.
          const gold = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.75);
          gold.addColorStop(0, '#f9e6a8');
          gold.addColorStop(0.45, '#d8ab41');
          gold.addColorStop(0.55, '#b8862f');
          gold.addColorStop(1, '#f2d488');
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#3a2a12';
          ctx.strokeText(brand, w / 2, h * 0.44);
          ctx.fillStyle = gold;
          ctx.fillText(brand, w / 2, h * 0.44);
          // Hairline flourishes either side of the name.
          ctx.strokeStyle = '#c9a24a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(w * 0.06, h * 0.44);
          ctx.lineTo(w * 0.14, h * 0.44);
          ctx.moveTo(w * 0.86, h * 0.44);
          ctx.lineTo(w * 0.94, h * 0.44);
          ctx.stroke();
        },
      });
      return makeTexture(canvas, 'transom.gold-leaf-glass', width, height, '#ffb45a', 0.35);
    }
    // Later eras: era-typical lettering burned into the transom glass.
    const canvas = drawCanvas({
      width,
      height,
      seed,
      draw: (ctx, w, h) => {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const glow = palette.materials.neonEmissive.emissive ?? palette.accent;
        if (variant.transomSign === 'neon-tube') {
          fitFont(ctx, 40, CONDENSED, 'bold', brand, w - 60);
          glowText(ctx, brand, w / 2, h * 0.46, glow, 18);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(brand, w / 2, h * 0.46);
        } else if (variant.transomSign === 'led-matrix') {
          fitFont(ctx, 36, MONO, 'bold', brand, w - 60);
          ctx.fillStyle = glow;
          ctx.fillText(brand, w / 2, h * 0.46);
          matrixMask(ctx, w, h, 5);
        } else {
          fitFont(ctx, 40, SANS, 'bold', brand, w - 60);
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillText(brand, w / 2 + 3, h * 0.46 + 3);
          ctx.fillStyle = variant.transomSign === 'push-through-plastic' ? '#ffffff' : palette.accent;
          ctx.fillText(brand, w / 2, h * 0.46);
        }
      },
    });
    return makeTexture(canvas, `transom.${variant.transomSign}`, width, height, emissiveColorFor(variant), variant.emissive.baseIntensity);
  });
}

/* -------------------------------------------------------------------------- */
/* Blade sign (projecting)                                                     */
/* -------------------------------------------------------------------------- */

/** Vertical projecting blade sign; null-safe via the variant's `bladeSign`. */
export function createBladeSignTexture(options: SignageArtOptions): SignageTexture | null {
  const { variant } = options;
  if (!variant.bladeSign) return null;
  const bayIndex = options.bayIndex ?? 0;
  const brand = options.brand ?? brandForBay(variant, bayIndex);
  const seed = derivedSeed('blade', variant, bayIndex, options.seed);
  const key = `blade|${variant.year}|${variant.bladeSign}|${brand}|${seed}`;
  return memoize(key, () => {
    const width = 128;
    const height = 384;
    const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
    const canvas = drawCanvas({
      width,
      height,
      seed,
      draw: (ctx, w, h) => {
        if (variant.bladeSign === 'enamel-plate') {
          fillPanel(ctx, 6, 6, w - 12, h - 12, 8, '#20303f', '#16222d');
          ctx.strokeStyle = palette.accent;
          ctx.lineWidth = 4;
          ctx.strokeRect(12, 12, w - 24, h - 24);
        } else {
          fillPanel(ctx, 6, 6, w - 12, h - 12, 10, '#101820', '#0a0f14');
        }
        // Stack the brand name down the blade, one glyph run per line.
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const letters = brand.replace(/[^A-Z0-9]/gi, '').slice(0, 8).split('');
        const lineStep = (h - 60) / Math.max(letters.length, 1);
        const size = Math.min(40, lineStep * 0.8);
        letters.forEach((letter, i) => {
          const y = 30 + lineStep * (i + 0.5);
          ctx.font = `bold ${size}px ${variant.bladeSign === 'enamel-plate' ? SERIF : SANS}`;
          if (variant.bladeSign === 'backlit-box') {
            glowText(ctx, letter, w / 2, y, palette.accent, 14);
            ctx.fillStyle = '#ffffff';
          } else {
            ctx.fillStyle = '#f4e8c1';
          }
          ctx.fillText(letter, w / 2, y);
        });
      },
    });
    const kind = `blade.${variant.bladeSign}`;
    const intensity = variant.bladeSign === 'backlit-box' ? variant.emissive.baseIntensity : 0.1;
    return makeTexture(canvas, kind, width, height, emissiveColorFor(variant), intensity);
  });
}

/* -------------------------------------------------------------------------- */
/* Billboard, poster, kiosk, newsstand, menu, ticker, window display           */
/* -------------------------------------------------------------------------- */

/** Rooftop/wall billboard face (bold era-specific ad layouts). */
export function createBillboardTexture(options: SignageArtOptions): SignageTexture {
  const { variant } = options;
  const bayIndex = options.bayIndex ?? 0;
  const brand = options.brand ?? brandForBay(variant, bayIndex);
  const headline = options.headline ?? headlineForSlot(variant, bayIndex);
  const seed = derivedSeed('billboard', variant, bayIndex, options.seed);
  const key = `billboard|${variant.year}|${variant.billboard}|${brand}|${headline}|${seed}`;
  return memoize(key, () => {
    const width = 1024;
    const height = 512;
    const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
    const accent = palette.accent;
    const canvas = drawCanvas({
      width,
      height,
      seed,
      draw: (ctx, w, h) => {
        const rng = createPRNG(seed);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        switch (variant.year) {
          case 1945: {
            // Painted canvas ad: cream ground, serif headline, product block.
            ctx.fillStyle = '#efe3c8';
            ctx.fillRect(0, 0, w, h);
            stripeRibbon(ctx, 0, 0, w, 46, accent, '#efe3c8', 16);
            stripeRibbon(ctx, 0, h - 46, w, 46, accent, '#efe3c8', 16);
            fitFont(ctx, 92, SERIF, 'bold', headline, w - 80);
            ctx.fillStyle = '#25211a';
            ctx.fillText(headline, w / 2, h * 0.36);
            ctx.strokeStyle = accent;
            ctx.lineWidth = 5;
            ctx.strokeRect(w * 0.12, h * 0.56, w * 0.76, h * 0.3);
            fitFont(ctx, 40, SANS, 'bold', brand, w - 120);
            ctx.fillStyle = accent;
            ctx.fillText(brand, w / 2, h * 0.71);
            speckle(ctx, w, h, seed, 500, 0.12);
            break;
          }
          case 1965: {
            // Pop split-color layout with a starburst.
            ctx.fillStyle = '#fdf6e9';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = accent;
            ctx.fillRect(0, 0, w * 0.42, h);
            ctx.fillStyle = '#f6c945';
            ctx.beginPath();
            ctx.arc(w * 0.72, h * 0.34, 96, 0, Math.PI * 2);
            ctx.fill();
            fitFont(ctx, 78, CONDENSED, 'bold', headline, w * 0.9);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(headline, w * 0.21, h * 0.4, w * 0.38);
            fitFont(ctx, 52, SANS, 'bold', brand, w - 100);
            ctx.fillStyle = '#26221c';
            ctx.fillText(brand, w * 0.66, h * 0.74);
            ctx.font = `bold 30px ${SANS}`;
            ctx.fillStyle = accent;
            ctx.fillText('DRIVE-IN • HI-FI • FUN', w * 0.66, h * 0.88);
            break;
          }
          case 1985: {
            // Aggressive diagonals, magenta/cyan, huge italic type.
            ctx.fillStyle = '#0c0a12';
            ctx.fillRect(0, 0, w, h);
            ctx.save();
            ctx.translate(w / 2, h / 2);
            ctx.rotate(-0.28);
            for (let i = -6; i < 8; i += 1) {
              ctx.fillStyle = i % 2 === 0 ? accent : '#22d3ee';
              ctx.globalAlpha = 0.85;
              ctx.fillRect(i * 110, -h, 54, h * 2);
            }
            ctx.restore();
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(6,4,12,0.82)';
            ctx.fillRect(0, h * 0.24, w, h * 0.5);
            ctx.save();
            ctx.translate(w / 2, h * 0.42);
            ctx.rotate(-0.05);
            fitFont(ctx, 110, CONDENSED, 'bold', headline, w - 70);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = accent;
            ctx.shadowBlur = 26;
            ctx.fillText(headline, 0, 0);
            ctx.restore();
            ctx.shadowBlur = 0;
            fitFont(ctx, 44, SANS, 'bold', brand, w - 120);
            ctx.fillStyle = '#22d3ee';
            ctx.fillText(brand, w / 2, h * 0.78);
            break;
          }
          case 2005: {
            // Clean backlit chain billboard: white field, blue header bar.
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = accent;
            ctx.fillRect(0, 0, w, 96);
            fitFont(ctx, 56, SANS, 'bold', brand, w - 80);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(brand, w / 2, 52);
            fitFont(ctx, 96, SANS, 'bold', headline, w - 100);
            ctx.fillStyle = '#16283f';
            ctx.fillText(headline, w / 2, h * 0.5);
            ctx.fillStyle = '#e8eef6';
            ctx.fillRect(0, h - 84, w, 84);
            fitFont(ctx, 34, SANS, 'bold', 'CALL NOW • 1-800-555-0199 • ASK FOR DETAILS', w - 80);
            ctx.fillStyle = accent;
            ctx.fillText('CALL NOW • 1-800-555-0199 • ASK FOR DETAILS', w / 2, h - 42);
            break;
          }
          default: {
            // 2025 minimal digital: negative space, thin type, single accent.
            ctx.fillStyle = '#f7f8f6';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = accent;
            ctx.fillRect(72, 96, 10, h - 200);
            fitFont(ctx, 64, SANS, 'bold', brand, w * 0.7);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#101418';
            ctx.fillText(brand, 112, h * 0.34);
            fitFont(ctx, 44, SANS, 'normal', headline, w * 0.72);
            ctx.fillStyle = '#3c444c';
            ctx.fillText(headline, 112, h * 0.55);
            ctx.font = `normal 26px ${SANS}`;
            ctx.fillStyle = accent;
            ctx.fillText('100% traceable • net zero delivery', 112, h * 0.74);
            // Pixel block accent (drawn, not a QR claim).
            for (let gy = 0; gy < 5; gy += 1) {
              for (let gx = 0; gx < 5; gx += 1) {
                if (rng.chance(0.55)) {
                  ctx.fillStyle = '#101418';
                  ctx.fillRect(w - 220 + gx * 26, h - 220 + gy * 26, 20, 20);
                }
              }
            }
            break;
          }
        }
      },
    });
    const lit = variant.year >= 1985;
    return makeTexture(
      canvas,
      `billboard.${variant.billboard}`,
      width,
      height,
      emissiveColorFor(variant),
      lit ? variant.emissive.baseIntensity * 0.6 : 0,
    );
  });
}

/** Poster/flyer quad art for poster walls and newsstand racks. */
export function createPosterTexture(options: SignageArtOptions): SignageTexture {
  const { variant } = options;
  const bayIndex = options.bayIndex ?? 0;
  const headline = options.headline ?? headlineForSlot(variant, bayIndex + 3);
  const seed = derivedSeed('poster', variant, bayIndex, options.seed);
  const key = `poster|${variant.year}|${headline}|${seed}`;
  return memoize(key, () => {
    const width = 256;
    const height = 384;
    const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
    const accent = palette.accent;
    const canvas = drawCanvas({
      width,
      height,
      seed,
      draw: (ctx, w, h) => {
        const rng = createPRNG(seed + 5);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        switch (variant.year) {
          case 1945:
            ctx.fillStyle = '#e9ddc0';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#2b241a';
            ctx.lineWidth = 6;
            ctx.strokeRect(10, 10, w - 20, h - 20);
            fitFont(ctx, 40, SERIF, 'bold', headline, w - 48);
            ctx.fillStyle = '#2b241a';
            ctx.fillText(headline, w / 2, h * 0.3, w - 40);
            ctx.fillStyle = accent;
            ctx.fillRect(w * 0.2, h * 0.5, w * 0.6, 4);
            fitFont(ctx, 24, SANS, 'bold', 'ADMIT ONE', w - 60);
            ctx.fillText('ADMIT ONE', w / 2, h * 0.62);
            speckle(ctx, w, h, seed, 200, 0.14);
            break;
          case 1965:
            ctx.fillStyle = '#fff3df';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(w, 0);
            ctx.lineTo(w, h * 0.44);
            ctx.lineTo(0, h * 0.6);
            ctx.closePath();
            ctx.fill();
            fitFont(ctx, 44, CONDENSED, 'bold', headline, w - 40);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(headline, w / 2, h * 0.24, w - 36);
            fitFont(ctx, 30, SANS, 'bold', 'TONIGHT ONLY', w - 40);
            ctx.fillStyle = '#26221c';
            ctx.fillText('TONIGHT ONLY', w / 2, h * 0.68);
            ctx.font = `italic 24px ${SERIF}`;
            ctx.fillText('all ages welcome', w / 2, h * 0.8);
            break;
          case 1985:
            ctx.fillStyle = '#0b0910';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 7; i += 1) {
              ctx.fillStyle = i % 2 ? '#22d3ee' : accent;
              ctx.globalAlpha = 0.5 + rng.next() * 0.5;
              ctx.save();
              ctx.translate(w / 2, h / 2);
              ctx.rotate(-0.5 + i * 0.18);
              ctx.fillRect(-200, -14 + i * 6, 400, 10);
              ctx.restore();
            }
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, h * 0.34, w, h * 0.34);
            fitFont(ctx, 42, CONDENSED, 'bold', headline, w - 32);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = accent;
            ctx.shadowBlur = 16;
            ctx.fillText(headline, w / 2, h * 0.5, w - 30);
            ctx.shadowBlur = 0;
            break;
          case 2005:
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = accent;
            ctx.fillRect(0, 0, w, 74);
            fitFont(ctx, 30, SANS, 'bold', 'SPECIAL OFFER', w - 40);
            ctx.fillStyle = '#ffffff';
            ctx.fillText('SPECIAL OFFER', w / 2, 40);
            fitFont(ctx, 40, SANS, 'bold', headline, w - 44);
            ctx.fillStyle = '#16283f';
            ctx.fillText(headline, w / 2, h * 0.4, w - 40);
            ctx.fillStyle = '#eef3f9';
            ctx.fillRect(w * 0.14, h * 0.6, w * 0.72, h * 0.26);
            fitFont(ctx, 34, SANS, 'bold', 'SAVE 25%', w - 60);
            ctx.fillStyle = accent;
            ctx.fillText('SAVE 25%', w / 2, h * 0.73);
            break;
          default:
            ctx.fillStyle = '#fbfcfb';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = accent;
            ctx.fillRect(24, 24, 6, h - 48);
            ctx.textAlign = 'left';
            fitFont(ctx, 34, SANS, 'bold', headline, w - 70);
            ctx.fillStyle = '#101418';
            ctx.fillText(headline, 48, h * 0.3, w - 70);
            ctx.font = `normal 20px ${SANS}`;
            ctx.fillStyle = '#4a525a';
            ctx.fillText('live captioned • step free', 48, h * 0.52);
            ctx.fillStyle = accent;
            ctx.fillRect(48, h * 0.62, 96, 4);
            break;
        }
      },
    });
    const lit = variant.year === 1985 || variant.year === 2025;
    return makeTexture(canvas, `poster.${variant.year}`, width, height, emissiveColorFor(variant), lit ? 1.2 : 0);
  });
}

/** Pavement kiosk advertisement card (portrait, era-specific layout). */
export function createKioskPosterTexture(options: SignageArtOptions): SignageTexture {
  const { variant } = options;
  const bayIndex = options.bayIndex ?? 0;
  const headline = options.headline ?? headlineForSlot(variant, bayIndex + 5);
  const seed = derivedSeed('kiosk', variant, bayIndex, options.seed);
  const key = `kiosk|${variant.year}|${variant.kiosk}|${headline}|${seed}`;
  return memoize(key, () => {
    const width = 256;
    const height = 384;
    const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
    const accent = palette.accent;
    const canvas = drawCanvas({
      width,
      height,
      seed,
      draw: (ctx, w, h) => {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lit = variant.year >= 1985;
        ctx.fillStyle = lit ? '#0d1117' : '#f2ead6';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = accent;
        ctx.lineWidth = lit ? 8 : 5;
        ctx.strokeRect(8, 8, w - 16, h - 16);
        if (variant.year === 1945) {
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(w / 2, h * 0.3, 64, 0, Math.PI * 2);
          ctx.fill();
          fitFont(ctx, 34, SERIF, 'bold', headline, w - 56);
          ctx.fillStyle = '#2b241a';
          ctx.fillText(headline, w / 2, h * 0.6, w - 50);
        } else {
          fitFont(ctx, 40, variant.year >= 2005 ? SANS : CONDENSED, 'bold', headline, w - 52);
          ctx.fillStyle = lit ? accent : '#26221c';
          if (lit) glowText(ctx, headline, w / 2, h * 0.38, accent, 14);
          else ctx.fillText(headline, w / 2, h * 0.38, w - 48);
          if (lit) {
            ctx.fillStyle = '#ffffff';
            ctx.fillText(headline, w / 2, h * 0.38, w - 48);
          }
          fitFont(ctx, 24, SANS, 'bold', 'SEE IT DOWNTOWN', w - 60);
          ctx.fillStyle = lit ? '#9fb4c8' : '#4a423a';
          ctx.fillText('SEE IT DOWNTOWN', w / 2, h * 0.72);
        }
        if (variant.year === 2025) matrixMask(ctx, w, h, 5);
      },
    });
    const intensity = variant.year >= 1985 ? variant.emissive.baseIntensity * 0.7 : 0;
    return makeTexture(canvas, `kiosk.${variant.kiosk}`, width, height, emissiveColorFor(variant), intensity);
  });
}

/** Backlit menu board strip; null when the era has no menu board. */
export function createMenuBoardTexture(options: SignageArtOptions): SignageTexture | null {
  const { variant } = options;
  if (!variant.menuBoard) return null;
  const bayIndex = options.bayIndex ?? 0;
  const brand = options.brand ?? brandForBay(variant, bayIndex);
  const seed = derivedSeed('menu', variant, bayIndex, options.seed);
  const key = `menu|${variant.year}|${brand}|${seed}`;
  return memoize(key, () => {
    const width = 512;
    const height = 160;
    const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
    const accent = palette.accent;
    const rows = ['HOUSE SPECIAL', 'DAILY COMBO', 'KIDS MEAL', 'REFILL'];
    const canvas = drawCanvas({
      width,
      height,
      seed,
      draw: (ctx, w, h) => {
        ctx.fillStyle = '#f7f9fc';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = accent;
        ctx.fillRect(0, 0, w, 44);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        fitFont(ctx, 28, SANS, 'bold', brand, w - 40);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(brand, 16, 24);
        ctx.font = `bold 22px ${SANS}`;
        rows.forEach((row, i) => {
          const y = 70 + i * 24;
          ctx.fillStyle = '#22303f';
          ctx.fillText(row, 24, y);
          ctx.textAlign = 'right';
          ctx.fillStyle = accent;
          ctx.fillText(`$${(4 + i * 1.5).toFixed(2)}`, w - 24, y);
          ctx.textAlign = 'left';
        });
      },
    });
    return makeTexture(canvas, `menu.${variant.year}`, width, height, emissiveColorFor(variant), variant.emissive.baseIntensity);
  });
}

/** Horizontal scrolling ticker strip (repeat-wrapped for LED scroll). */
export function createTickerTexture(options: SignageArtOptions): SignageTexture | null {
  const { variant } = options;
  if (!variant.ticker) return null;
  const bayIndex = options.bayIndex ?? 0;
  const brand = options.brand ?? brandForBay(variant, bayIndex);
  const tagline = options.tagline ?? taglineForBay(variant, bayIndex);
  const seed = derivedSeed('ticker', variant, bayIndex, options.seed);
  const key = `ticker|${variant.year}|${brand}|${tagline}|${seed}`;
  return memoize(key, () => {
    const width = 1024;
    const height = 64;
    const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
    const canvas = drawCanvas({
      width,
      height,
      seed,
      draw: (ctx, w, h) => {
        ctx.fillStyle = variant.year === 2025 ? '#05070a' : '#0b1524';
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const unit = `${brand}  •  ${tagline}  •  `;
        ctx.font = `bold 30px ${variant.year === 2025 ? MONO : SANS}`;
        const unitWidth = ctx.measureText(unit).width;
        for (let x = 0; x < w + unitWidth; x += unitWidth) {
          ctx.fillStyle = palette.materials.neonEmissive.emissive ?? palette.accent;
          ctx.fillText(unit, x, h / 2);
        }
        if (variant.year === 2025) matrixMask(ctx, w, h, 4);
      },
    });
    // Ticker texture must tile horizontally for the scroll animation.
    const texture = createCanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return {
      texture,
      kind: `ticker.${variant.year}`,
      width,
      height,
      emissiveColor: emissiveColorFor(variant),
      emissiveIntensity: variant.emissive.baseIntensity,
    };
  });
}

/** Window-display backdrop art (butcher paper through projection glass). */
export function createWindowDisplayTexture(options: SignageArtOptions): SignageTexture {
  const { variant } = options;
  const bayIndex = options.bayIndex ?? 0;
  const brand = options.brand ?? brandForBay(variant, bayIndex);
  const seed = derivedSeed('window', variant, bayIndex, options.seed);
  const key = `window|${variant.year}|${variant.windowDisplay}|${brand}|${seed}`;
  return memoize(key, () => {
    const width = 512;
    const height = 256;
    const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
    const accent = palette.accent;
    const canvas = drawCanvas({
      width,
      height,
      seed,
      draw: (ctx, w, h) => {
        const rng = createPRNG(seed + 9);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        switch (variant.windowDisplay) {
          case 'butcher-paper': {
            // Kraft butcher paper with chalk price bubbles and product names.
            ctx.fillStyle = '#d9c49a';
            ctx.fillRect(0, 0, w, h);
            speckle(ctx, w, h, seed, 420, 0.1);
            variant.windowProducts.slice(0, 4).forEach((product, i) => {
              const cx = w * (0.18 + i * 0.215);
              const cy = h * 0.42;
              ctx.fillStyle = 'rgba(250, 246, 235, 0.9)';
              ctx.beginPath();
              ctx.arc(cx, cy, 44, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#4a3b26';
              ctx.lineWidth = 3;
              ctx.stroke();
              fitFont(ctx, 18, SERIF, 'bold', product.toUpperCase(), 80);
              ctx.fillStyle = '#3d3020';
              ctx.fillText(product.toUpperCase(), cx, cy, 78);
              ctx.font = `bold 20px ${SERIF}`;
              ctx.fillStyle = accent;
              ctx.fillText(`$${(0.25 * (i + 1)).toFixed(2)}`, cx, cy + 62);
            });
            fitFont(ctx, 30, SERIF, 'bold', brand, w - 40);
            ctx.fillStyle = '#3d3020';
            ctx.fillText(brand, w / 2, h * 0.88);
            break;
          }
          case 'animated-pastel': {
            // Rotating promo discs; texture scrolls vertically in the display.
            ctx.fillStyle = '#fff1e3';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 5; i += 1) {
              ctx.fillStyle = i % 2 ? '#f6c945' : accent;
              ctx.globalAlpha = 0.85;
              ctx.beginPath();
              ctx.arc(w * (0.12 + i * 0.19), h * 0.5, 52, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
            fitFont(ctx, 34, CONDENSED, 'bold', `NOW IN STOCK`, w - 60);
            ctx.fillStyle = '#26221c';
            ctx.fillText('NOW IN STOCK', w / 2, h * 0.5);
            ctx.font = `italic 24px ${SERIF}`;
            ctx.fillText(variant.windowProducts.join(' • '), w / 2, h * 0.85, w - 40);
            break;
          }
          case 'arcade-glow': {
            // Video-arcade glow: black ground, grid horizon, product silhouettes.
            ctx.fillStyle = '#07050d';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = accent;
            ctx.lineWidth = 2;
            for (let i = 0; i < 10; i += 1) {
              ctx.globalAlpha = 0.25 + i * 0.05;
              ctx.beginPath();
              ctx.moveTo(0, h * 0.45 + i * 18);
              ctx.lineTo(w, h * 0.45 + i * 18);
              ctx.stroke();
            }
            ctx.globalAlpha = 1;
            fitFont(ctx, 46, CONDENSED, 'bold', brand, w - 60);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = accent;
            ctx.shadowBlur = 22;
            ctx.fillText(brand, w / 2, h * 0.32);
            ctx.shadowBlur = 0;
            ctx.font = `bold 24px ${MONO}`;
            ctx.fillStyle = '#22d3ee';
            ctx.fillText(variant.windowProducts.join('  '), w / 2, h * 0.72, w - 40);
            break;
          }
          case 'chain-merch': {
            // Chain-brand merch wall: white grid, price flashes.
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = accent;
            ctx.fillRect(0, 0, w, 54);
            fitFont(ctx, 30, SANS, 'bold', brand, w - 40);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(brand, w / 2, 30);
            variant.windowProducts.slice(0, 3).forEach((product, i) => {
              const x = w * (0.19 + i * 0.31);
              ctx.fillStyle = '#eef3f9';
              ctx.fillRect(x - 64, 78, 128, 128);
              fitFont(ctx, 18, SANS, 'bold', product, 118);
              ctx.fillStyle = '#22303f';
              ctx.fillText(product, x, 226, 118);
              ctx.font = `bold 22px ${SANS}`;
              ctx.fillStyle = accent;
              ctx.fillText(`$${(6.99 + i * 3).toFixed(2)}`, x, 148);
            });
            break;
          }
          default: {
            // Projection-mapped glass: soft gradient field the projector washes.
            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#0a1420');
            grad.addColorStop(0.5, '#123047');
            grad.addColorStop(1, '#0a1420');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 24; i += 1) {
              ctx.globalAlpha = 0.06 + rng.next() * 0.1;
              ctx.fillStyle = rng.pick([accent, '#eafff6', '#7ec8ad']);
              ctx.fillRect(rng.range(0, w), rng.range(0, h), rng.range(30, 140), rng.range(4, 18));
            }
            ctx.globalAlpha = 1;
            fitFont(ctx, 34, SANS, 'normal', brand, w - 60);
            ctx.fillStyle = '#eafff6';
            ctx.fillText(brand, w / 2, h * 0.42);
            ctx.font = `normal 20px ${SANS}`;
            ctx.fillStyle = accent;
            ctx.fillText(variant.windowProducts.slice(0, 3).join(' · '), w / 2, h * 0.62, w - 40);
            break;
          }
        }
      },
    });
    const lit = variant.windowDisplay === 'arcade-glow' || variant.windowDisplay === 'projection-mapped';
    return makeTexture(
      canvas,
      `window.${variant.windowDisplay}`,
      width,
      height,
      emissiveColorFor(variant),
      lit ? variant.emissive.baseIntensity * 0.5 : 0,
    );
  });
}

/** Newsstand front-page / rack-card art. */
export function createNewsstandTexture(options: SignageArtOptions): SignageTexture {
  const { variant } = options;
  const bayIndex = options.bayIndex ?? 0;
  const headline = options.headline ?? headlineForSlot(variant, bayIndex + 7);
  const seed = derivedSeed('news', variant, bayIndex, options.seed);
  const key = `news|${variant.year}|${variant.newsstand}|${headline}|${seed}`;
  return memoize(key, () => {
    const width = 256;
    const height = 192;
    const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
    const accent = palette.accent;
    const canvas = drawCanvas({
      width,
      height,
      seed,
      draw: (ctx, w, h) => {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (variant.year === 2025) {
          // Smart-glass rack card: dark, thin type.
          ctx.fillStyle = '#0c1014';
          ctx.fillRect(0, 0, w, h);
          fitFont(ctx, 22, SANS, 'bold', 'CITY DAILY • EDGE EDITION', w - 24);
          ctx.fillStyle = accent;
          ctx.fillText('CITY DAILY • EDGE EDITION', w / 2, 22, w - 20);
          fitFont(ctx, 30, SANS, 'bold', headline, w - 32);
          ctx.fillStyle = '#f2f6f8';
          ctx.fillText(headline, w / 2, h * 0.42, w - 28);
          matrixMask(ctx, w, h, 5);
          return;
        }
        // Broadsheet front page: masthead, rules, headline, grey copy lines.
        ctx.fillStyle = variant.year === 1945 ? '#efe8d5' : '#f7f5ef';
        ctx.fillRect(0, 0, w, h);
        fitFont(ctx, 26, SERIF, 'bold', 'THE CITY DAILY', w - 24);
        ctx.fillStyle = '#1d1a15';
        ctx.fillText('THE CITY DAILY', w / 2, 24);
        ctx.fillStyle = '#1d1a15';
        ctx.fillRect(12, 44, w - 24, 3);
        fitFont(ctx, 34, SERIF, 'bold', headline, w - 32);
        ctx.fillText(headline, w / 2, h * 0.4, w - 28);
        ctx.fillStyle = '#5b564c';
        for (let col = 0; col < 3; col += 1) {
          for (let line = 0; line < 8; line += 1) {
            const x = 16 + col * ((w - 32) / 3);
            const y = h * 0.58 + line * 10;
            ctx.fillRect(x, y, (w - 44) / 3, 4);
          }
        }
        if (variant.year === 1985) {
          ctx.fillStyle = accent;
          ctx.fillRect(0, h - 18, w, 18);
          fitFont(ctx, 14, SANS, 'bold', 'EXTRA • LATE EDITION', w - 20);
          ctx.fillStyle = '#ffffff';
          ctx.fillText('EXTRA • LATE EDITION', w / 2, h - 9);
        }
        speckle(ctx, w, h, seed, 90, 0.08);
      },
    });
    const lit = variant.newsstand === 'backlit-newsstand' || variant.newsstand === 'smart-glass-kiosk';
    return makeTexture(canvas, `news.${variant.newsstand}`, width, height, emissiveColorFor(variant), lit ? 1.4 : 0);
  });
}

/* -------------------------------------------------------------------------- */
/* Whole-bay convenience                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Generate every piece of sign/display art one bay needs for one era.
 * Callers pre-build this for all five eras so transitions only crossfade
 * materials — textures are never rebuilt mid-morph.
 */
export function createBaySignageArt(options: SignageArtOptions): BaySignageArt {
  return {
    fascia: createFasciaSignTexture(options),
    transom: createTransomLetteringTexture(options),
    blade: createBladeSignTexture(options),
    billboard: createBillboardTexture(options),
    poster: createPosterTexture(options),
    kiosk: createKioskPosterTexture(options),
    ticker: createTickerTexture(options),
    menuBoard: createMenuBoardTexture(options),
    windowDisplay: createWindowDisplayTexture(options),
    newsstand: createNewsstandTexture(options),
  };
}

/** All five era fascia treatments for one bay (used for crossfade morphs). */
export function createEraFasciaSet(
  variantYears: readonly EraYear[],
  bayIndex: number,
): Map<EraYear, SignageTexture> {
  const out = new Map<EraYear, SignageTexture>();
  for (const year of variantYears) {
    const variant = ERA_VARIANT_LOOKUP(year);
    out.set(year, createFasciaSignTexture({ variant, bayIndex }));
  }
  return out;
}

/** Resolve a variant from the frozen catalogue by year. */
function ERA_VARIANT_LOOKUP(year: EraYear): EraStorefrontVariant {
  return ERA_STOREFRONT_VARIANTS[year];
}
