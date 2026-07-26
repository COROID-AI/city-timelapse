/**
 * Billboard / advertisement domain module.
 *
 * Places era-specific advertisements in the scene across three placement kinds:
 *  - wall-mounted  (proud mural panels on the *rear* facade — never the front
 *                   entrance / storefront signage face)
 *  - freestanding  (ground-level poster boards at building front corners,
 *                   offset beyond the storefront slot so they never block the
 *                   entrance or storefront signage)
 *  - rooftop       (panel on legs standing on the roof — above all windows
 *                   and entrances by construction)
 *
 * Placement is coordinated against the buildings so ads never overlap windows,
 * entrances, or the reserved ground-floor storefront signage zone:
 *   • rooftop ads live on the roof (no windows / no entrance there);
 *   • freestanding ads sit on the sidewalk at front *corners*, beyond the
 *     storefront slot half-width and away from the centered entrance;
 *   • wall ads mount on the rear face only (the front face holds the entrance +
 *     storefront signage), above the storefront band.
 *
 * Ad content is generated procedurally via canvas textures with an era-correct
 * palette, typography, and motifs, and the *medium evolves* across the timeline:
 *   1945 painted  →  1965 printed  →  1985 LED  →  2005 LED  →  2025 LED  →
 *   2055 holographic.
 * The ad archetype set is read from `EraConfig.ads` so content / flavor tracks
 * the single source of era truth. LED + holographic ads use emissive materials
 * (so the active bloom pass makes them glow) and cycle a few canvas frames for
 * motion.
 *
 * The module registers a single `ads` domain with the TransitionManager and
 * transforms content + medium on era change — never rebuilding the scene graph.
 */

import {
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import {
  DEFAULT_ERA_CONFIG,
  ERA_KEYS,
  lerp,
  type ApplyEraFn,
  type EraKey,
} from '../eras/eraConfig.js';
import {
  STOREFRONT_SLOT_HEIGHT,
  type Lot,
  type StorefrontSlot,
} from '../buildings/BuildingGenerator.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** How an advertisement is physically placed in the scene. */
export type BillboardKind = 'wall' | 'freestanding' | 'rooftop';

/** The physical medium of an ad, which evolves across eras. */
export type AdMedium = 'painted' | 'printed' | 'led' | 'holographic';

/** Era-correct content motif, derived from the `EraConfig.ads` archetype set. */
export type AdMotif = 'warbond' | 'midcentury' | 'electronics' | 'mobile' | 'streaming' | 'hologram';

/** Per-era visual + content style that drives canvas generation and materials. */
export interface EraAdStyle {
  /** Physical medium — controls material emissive / roughness / animation. */
  medium: AdMedium;
  /** Ordered motifs, paired positionally with the `EraConfig.ads` archetypes. */
  motifs: AdMotif[];
  /** Era-correct palette (hex). */
  palette: { bg: string; ink: string; accent: string; accent2: string };
  /** Canvas font family used for headlines. */
  fontFamily: string;
  /** Era-correct headline copy variants (license-free, generated). */
  slogans: string[];
  /** Faux brand word rendered on the ad. */
  brand: string;
  /** Emissive color (the canvas art is used as the emissive map). */
  emissive: string;
  /** Emissive intensity; >0 enables bloom glow (LED / holographic). */
  emissiveIntensity: number;
  /** Whether this medium glows (LED / holographic). */
  emissiveLed: boolean;
  /** Surface opacity (holographic ads are translucent). */
  opacity: number;
  /** Number of canvas frames to cycle for motion (1 = static). */
  frameCount: number;
  /** Per-frame dwell time in milliseconds for animated media. */
  frameIntervalMs: number;
}

/** Return value of `createBillboards`. */
export interface BillboardSystem {
  /** Root group containing every billboard. Add this to the scene. */
  group: Group;
  /** TransitionManager-compatible era callback. Register with `registerDomain`. */
  applyEra: ApplyEraFn;
  /** Per-frame animation tick — call every frame to cycle LED / holographic frames. */
  update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Per-era ad style data (the architectural source of truth for ad content)
// ---------------------------------------------------------------------------

/**
 * The medium progression painted → printed → LED → holographic is fixed by the
 * acceptance criteria. Content motifs / palettes / slogans are era-correct and
 * license-free (procedurally rendered). Each entry is paired with the matching
 * `EraConfig.ads` archetype set so the module reads ad identity from the config.
 */
const ERA_AD_STYLE: Record<EraKey, EraAdStyle> = {
  '1945': {
    medium: 'painted',
    motifs: ['warbond', 'warbond'],
    palette: { bg: '#c9b98f', ink: '#1c1c1c', accent: '#b5463a', accent2: '#3a5a8a' },
    fontFamily: 'Georgia, serif',
    slogans: ['BUY WAR BONDS', 'VICTORY!', 'UNITED WE STAND', 'PRODUCE FOR FREEDOM'],
    brand: 'LIBERTY',
    emissive: '#000000',
    emissiveIntensity: 0,
    emissiveLed: false,
    opacity: 0.97,
    frameCount: 1,
    frameIntervalMs: 0,
  },
  '1965': {
    medium: 'printed',
    motifs: ['midcentury', 'midcentury'],
    palette: { bg: '#f0e6d2', ink: '#221a14', accent: '#d97a2c', accent2: '#2c8a8a' },
    fontFamily: '"Arial Black", Impact, sans-serif',
    slogans: ['DRIVE THE FUTURE', 'COOL REFRESHING MILES', 'JET-AGE STYLE', 'TASTE THE DIFFERENCE'],
    brand: 'ATLAS',
    emissive: '#000000',
    emissiveIntensity: 0,
    emissiveLed: false,
    opacity: 0.96,
    frameCount: 1,
    frameIntervalMs: 0,
  },
  '1985': {
    medium: 'led',
    motifs: ['electronics', 'electronics'],
    palette: { bg: '#160a2a', ink: '#ffffff', accent: '#ff2a6d', accent2: '#05d9e8' },
    fontFamily: '"Arial Black", Impact, sans-serif',
    slogans: ['NOW ON VHS', 'HI-FI SOUND', 'COMING THIS SUMMER', 'VIDEO FANTASTIC'],
    brand: 'TRIOTRON',
    emissive: '#ffffff',
    emissiveIntensity: 1.9,
    emissiveLed: true,
    opacity: 0.93,
    frameCount: 2,
    frameIntervalMs: 700,
  },
  '2005': {
    medium: 'led',
    motifs: ['mobile', 'mobile'],
    palette: { bg: '#0a2a5a', ink: '#ffffff', accent: '#ff6600', accent2: '#33aaff' },
    fontFamily: '"Arial Black", Impact, sans-serif',
    slogans: ['dot COM', 'GET ONLINE', 'MOBILE LIFE', 'CONNECT NOW'],
    brand: 'NEXUS',
    emissive: '#ffffff',
    emissiveIntensity: 2.1,
    emissiveLed: true,
    opacity: 0.93,
    frameCount: 2,
    frameIntervalMs: 650,
  },
  '2025': {
    medium: 'led',
    motifs: ['streaming', 'streaming'],
    palette: { bg: '#0a0a0a', ink: '#ffffff', accent: '#e50914', accent2: '#00b8ff' },
    fontFamily: '"Arial Black", Impact, sans-serif',
    slogans: ['STREAM NOW', 'BINGE TONIGHT', 'WATCH ANYWHERE', 'ORIGINALS'],
    brand: 'NOVA',
    emissive: '#ffffff',
    emissiveIntensity: 2.3,
    emissiveLed: true,
    opacity: 0.93,
    frameCount: 2,
    frameIntervalMs: 600,
  },
  '2055': {
    medium: 'holographic',
    motifs: ['hologram', 'hologram'],
    palette: { bg: '#04121f', ink: '#9fffe0', accent: '#00ffff', accent2: '#ff3ce6' },
    fontFamily: '"Arial Black", Impact, sans-serif',
    slogans: ['HOLO NET', 'QUANTUM LINK', 'AUGMENT REALITY', 'NEURAL STREAM'],
    brand: 'ZENITH',
    emissive: '#ffffff',
    emissiveIntensity: 3.1,
    emissiveLed: true,
    opacity: 0.62,
    frameCount: 3,
    frameIntervalMs: 450,
  },
};

/**
 * Per-era building floor data. This intentionally mirrors the private table in
 * BuildingGenerator so billboard rooftop / wall ads track the building roof
 * height exactly as buildings interpolate between eras (same seed → same height).
 */
const ERA_FLOORS: Record<EraKey, { min: number; max: number; floorHeight: number }> = {
  '1945': { min: 2, max: 5, floorHeight: 3.4 },
  '1965': { min: 4, max: 9, floorHeight: 3.3 },
  '1985': { min: 6, max: 13, floorHeight: 3.2 },
  '2005': { min: 8, max: 18, floorHeight: 3.2 },
  '2025': { min: 7, max: 16, floorHeight: 3.2 },
  '2055': { min: 12, max: 30, floorHeight: 3.3 },
};

// ---------------------------------------------------------------------------
// Medium → material property helpers
// ---------------------------------------------------------------------------

function mediumRoughness(m: AdMedium): number {
  return m === 'painted' ? 0.9 : m === 'printed' ? 0.6 : m === 'led' ? 0.3 : 0.15;
}

function mediumMetalness(m: AdMedium): number {
  return m === 'painted' ? 0.0 : m === 'printed' ? 0.05 : m === 'led' ? 0.2 : 0.3;
}

// ---------------------------------------------------------------------------
// Deterministic PRNG (matches BuildingGenerator so seeds are stable)
// ---------------------------------------------------------------------------

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(cx: number, cz: number, idx: number): number {
  return ((Math.floor(cx * 73856093) ^ Math.floor(cz * 19349663) ^ (idx * 83492791)) >>> 0) || 1;
}

/**
 * Pre-compute the total height of a building in every era. Replicates the
 * BuildingGenerator formula (same seed arithmetic) so rooftop / wall ads sit on
 * the actual roof as it interpolates.
 */
function computeEraHeights(seed: number): Record<EraKey, number> {
  const rng = createRng(seed + 999);
  const sizeFactor = 0.25 + rng() * 0.75;
  const heights = {} as Record<EraKey, number>;
  for (const era of ERA_KEYS) {
    const f = ERA_FLOORS[era];
    const floors = Math.round(lerp(f.min, f.max, sizeFactor));
    heights[era] = STOREFRONT_SLOT_HEIGHT + Math.max(1, floors) * f.floorHeight;
  }
  return heights;
}

/**
 * Rotate a local XZ offset by the lot's Y rotation using three.js' Y-axis
 * convention (front assumed +Z at rot 0). Used to map building-local offsets
 * into world space so billboard placement tracks the building's actual faces.
 */
function rotateXZ(x: number, z: number, rotY: number): [number, number] {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return [x * c + z * s, -x * s + z * c];
}

// ---------------------------------------------------------------------------
// EraConfig.ads readers (content tracks the single source of era truth)
// ---------------------------------------------------------------------------

/** The ad archetype identifiers declared for an era in `EraConfig.ads`. */
function adSetForEra(era: EraKey): string[] {
  return DEFAULT_ERA_CONFIG[era].ads.ads;
}

/** Whether the era's ad set includes a neon archetype (adds a neon accent). */
function adSetHasNeon(ads: string[]): boolean {
  return ads.some((a) => /neon/i.test(a));
}

// ---------------------------------------------------------------------------
// Canvas texture generation
// ---------------------------------------------------------------------------

/** Canvas resolution for a billboard face. */
const TEX_W = 256;
const TEX_H = 192;

/** Build the per-era cycling canvas textures for one billboard. */
function buildEraFrames(
  lotSeed: number,
  era: EraKey,
): CanvasTexture[] {
  const style = ERA_AD_STYLE[era];
  const ads = adSetForEra(era);
  const hasNeon = adSetHasNeon(ads);
  const frames: CanvasTexture[] = [];
  for (let i = 0; i < style.frameCount; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    // Deterministic per (lot, era, frame) so a billboard's art is stable.
    const rng = createRng(((lotSeed * 31) ^ (era.charCodeAt(0) * 79) ^ (i * 131) ^ 0x9e3779b9) >>> 0);
    paintAd(ctx, style, rng, hasNeon, i);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    frames.push(tex);
  }
  return frames;
}

/** Dispatch to the era / medium specific painter. */
function paintAd(
  ctx: CanvasRenderingContext2D,
  style: EraAdStyle,
  rng: () => number,
  hasNeon: boolean,
  frameIdx: number,
): void {
  switch (style.medium) {
    case 'painted':
      paintPainted(ctx, style, rng, hasNeon);
      break;
    case 'printed':
      paintPrinted(ctx, style, rng);
      break;
    case 'led':
      paintLed(ctx, style, rng, frameIdx);
      break;
    case 'holographic':
      paintHolographic(ctx, style, rng, frameIdx);
      break;
  }
}

// ---- shared canvas helpers -------------------------------------------------

function fillBg(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
}

/** Add deterministic noise speckle for a hand-painted / weathered texture. */
function addNoise(ctx: CanvasRenderingContext2D, rng: () => number, count: number, alpha: number): void {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng() * TEX_W);
    const y = Math.floor(rng() * TEX_H);
    const v = Math.floor(rng() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

/** A five-point star. */
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Centered headline with optional glow. */
function headline(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  family: string,
  color: string,
  y: number,
  glow: string | null,
): void {
  ctx.save();
  ctx.font = `bold ${size}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
    ctx.fillStyle = glow;
    ctx.fillText(text, TEX_W / 2, y);
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, TEX_W / 2, y);
  ctx.restore();
}

/** Faint horizontal scanlines (CRT / LED texture). */
function scanlines(ctx: CanvasRenderingContext2D, color: string, step: number, alpha: number): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let y = 0; y < TEX_H; y += step) {
    ctx.fillRect(0, y, TEX_W, 1);
  }
  ctx.restore();
}

// ---- 1945 painted (war-bond / poster art, hand-painted) --------------------

function paintPainted(
  ctx: CanvasRenderingContext2D,
  style: EraAdStyle,
  rng: () => number,
  hasNeon: boolean,
): void {
  const { bg, ink, accent, accent2 } = style.palette;
  fillBg(ctx, bg);
  // Vertical brush streaks for a hand-painted wall feel.
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + rng() * 0.05})`;
    ctx.fillRect(Math.floor(rng() * TEX_W), 0, 1 + Math.floor(rng() * 2), TEX_H);
  }
  addNoise(ctx, rng, 700, 0.05);

  // Top star banner.
  ctx.fillStyle = accent2;
  ctx.fillRect(0, 0, TEX_W, 22);
  const starCount = 9;
  for (let i = 0; i < starCount; i++) {
    drawStar(ctx, (TEX_W / (starCount - 1)) * i, 11, 6, 2.6, '#ffffff');
  }

  const slogan = style.slogans[Math.floor(rng() * style.slogans.length)];
  // Slight wobble: draw twice with a tiny offset for a hand-painted look.
  ctx.save();
  ctx.font = `bold 30px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accent;
  ctx.fillText(slogan, TEX_W / 2 - 1, 78);
  ctx.fillStyle = accent;
  ctx.fillText(slogan, TEX_W / 2 + 1, 78);
  ctx.fillStyle = ink;
  ctx.fillText(slogan, TEX_W / 2, 78);
  ctx.restore();

  // Central war-bond seal.
  ctx.save();
  ctx.beginPath();
  ctx.arc(TEX_W / 2, 130, 30, 0, Math.PI * 2);
  ctx.fillStyle = accent2;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(TEX_W / 2, 130, 24, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  drawStar(ctx, TEX_W / 2, 130, 16, 7, accent);
  ctx.restore();

  // Footer brand.
  ctx.save();
  ctx.font = `bold 14px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.fillText(`${style.brand} • 1945`, TEX_W / 2, 172);
  ctx.restore();

  // 1965-era neon archetype flavor (painted-over-then-neon edge) — subtle.
  if (hasNeon) {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.strokeRect(6, 6, TEX_W - 12, TEX_H - 12);
    ctx.restore();
  }

  // Wood frame border.
  ctx.strokeStyle = '#3a2c1c';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, TEX_W - 6, TEX_H - 6);
}

// ---- 1965 printed (mid-century graphic ads: cars, cigarettes) -------------

function paintPrinted(
  ctx: CanvasRenderingContext2D,
  style: EraAdStyle,
  rng: () => number,
): void {
  const { bg, ink, accent, accent2 } = style.palette;
  fillBg(ctx, bg);

  // Mid-century split background.
  ctx.fillStyle = accent2;
  ctx.fillRect(0, 0, TEX_W, 64);

  // Big sun circle + triangles.
  ctx.save();
  ctx.beginPath();
  ctx.arc(TEX_W - 52, 40, 30, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(20, 64);
  ctx.lineTo(50, 24);
  ctx.lineTo(80, 64);
  ctx.closePath();
  ctx.fill();

  const slogan = style.slogans[Math.floor(rng() * style.slogans.length)];
  headline(ctx, slogan, 26, style.fontFamily, ink, 96, null);

  // Stylized car silhouette (mid-century automotive ad).
  ctx.save();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(60, 140);
  ctx.lineTo(90, 120);
  ctx.lineTo(150, 120);
  ctx.lineTo(178, 140);
  ctx.lineTo(196, 140);
  ctx.lineTo(196, 150);
  ctx.lineTo(60, 150);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(86, 150, 11, 0, Math.PI * 2);
  ctx.arc(170, 150, 11, 0, Math.PI * 2);
  ctx.fillStyle = accent2;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.font = `bold 14px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.fillText(style.brand, TEX_W / 2, 174);
  ctx.restore();

  // Clean printed border.
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, TEX_W - 6, TEX_H - 6);
}

// ---- 1985 / 2005 / 2025 LED (bold graphics, glossy, animated) --------------

function paintLed(
  ctx: CanvasRenderingContext2D,
  style: EraAdStyle,
  rng: () => number,
  frameIdx: number,
): void {
  const { bg, ink, accent, accent2 } = style.palette;
  fillBg(ctx, bg);

  // Faint grid.
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,0.06)`;
  ctx.lineWidth = 1;
  for (let x = 0; x < TEX_W; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, TEX_H);
    ctx.stroke();
  }
  for (let y = 0; y < TEX_H; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(TEX_W, y);
    ctx.stroke();
  }
  ctx.restore();

  // Neon border rectangle (glows, alternates color per frame).
  const borderC = frameIdx % 2 === 0 ? accent : accent2;
  ctx.save();
  ctx.strokeStyle = borderC;
  ctx.lineWidth = 4;
  ctx.shadowColor = borderC;
  ctx.shadowBlur = 16;
  ctx.strokeRect(8, 8, TEX_W - 16, TEX_H - 16);
  ctx.restore();

  // Era-specific icon.
  const motif = style.motifs[0];
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 12;
  if (motif === 'streaming') {
    // Play triangle.
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(104, 40);
    ctx.lineTo(104, 76);
    ctx.lineTo(138, 58);
    ctx.closePath();
    ctx.fill();
  } else if (motif === 'mobile') {
    // @ / globe dot.
    ctx.strokeStyle = accent2;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(121, 58, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = 'bold 24px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('@', 121, 59);
  } else {
    // Electronics: CRT screen.
    ctx.strokeStyle = accent2;
    ctx.lineWidth = 3;
    ctx.strokeRect(96, 38, 50, 38);
    ctx.fillStyle = accent;
    ctx.fillRect(104, 46, 34, 22);
  }
  ctx.restore();

  const slogan = style.slogans[Math.floor(rng() * style.slogans.length)];
  headline(ctx, slogan, 24, style.fontFamily, ink, 116, accent);

  ctx.save();
  ctx.font = `bold 13px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.shadowColor = accent2;
  ctx.shadowBlur = 8;
  ctx.fillStyle = accent2;
  ctx.fillText(style.brand, TEX_W / 2, 150);
  ctx.restore();

  scanlines(ctx, '#000000', 3, 0.18);
  // Glossy diagonal highlight.
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(TEX_W, 0);
  ctx.lineTo(0, TEX_H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---- 2055 holographic (full-motion volumetric) -----------------------------

function paintHolographic(
  ctx: CanvasRenderingContext2D,
  style: EraAdStyle,
  rng: () => number,
  frameIdx: number,
): void {
  const { bg, ink, accent, accent2 } = style.palette;
  fillBg(ctx, bg);

  // Animated equalizer bars (cyan / magenta).
  const barCount = 14;
  const barW = (TEX_W - 20) / barCount;
  for (let i = 0; i < barCount; i++) {
    const h = 16 + (Math.sin(i * 0.9 + frameIdx * 1.7) * 0.5 + 0.5) * 70;
    const x = 10 + i * barW;
    ctx.save();
    ctx.shadowColor = i % 2 === 0 ? accent : accent2;
    ctx.shadowBlur = 10;
    ctx.fillStyle = i % 2 === 0 ? accent : accent2;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x, 150 - h, barW - 3, h);
    ctx.restore();
  }

  // Hexagon frame.
  ctx.save();
  ctx.translate(TEX_W / 2, 56);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const px = Math.cos(a) * 26;
    const py = Math.sin(a) * 26;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  const slogan = style.slogans[Math.floor(rng() * style.slogans.length)];
  headline(ctx, slogan, 22, style.fontFamily, ink, 108, accent);

  ctx.save();
  ctx.font = `bold 13px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.shadowColor = accent2;
  ctx.shadowBlur = 10;
  ctx.fillStyle = accent2;
  ctx.fillText(`⬡ ${style.brand}`, TEX_W / 2, 140);
  ctx.restore();

  // Glitch displacement slices.
  ctx.save();
  for (let i = 0; i < 6; i++) {
    const y = Math.floor(rng() * TEX_H);
    const dx = (rng() - 0.5) * 16;
    ctx.fillStyle = i % 2 === 0 ? `${accent}33` : `${accent2}33`;
    ctx.fillRect(dx, y, TEX_W, 2);
  }
  ctx.restore();

  // Floating particles.
  addNoise(ctx, rng, 120, 0.4);
}

// ---------------------------------------------------------------------------
// Billboard instance + placement
// ---------------------------------------------------------------------------

/** Everything needed to drive era transitions + frame animation for one ad. */
interface BillboardInstance {
  kind: BillboardKind;
  group: Group;
  panel: Mesh;
  material: MeshStandardMaterial;
  /** Per-era cycling canvas textures (length = that era's frame count). */
  eraFrames: Record<EraKey, CanvasTexture[]>;
  /** Per-era frame counts / dwell times (from `EraAdStyle`). */
  frameCount: Record<EraKey, number>;
  frameIntervalMs: Record<EraKey, number>;
  /** Per-era building roof height at this lot (for rooftop / wall tracking). */
  eraHeights: Record<EraKey, number>;
  // animation / transition state
  displayedEra: EraKey;
  frameIndex: number;
  frameAccumMs: number;
  transitioning: boolean;
}

/** Shared dark-metal material for billboard frames, posts and legs. */
function createStructureMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: '#2a2d33', roughness: 0.7, metalness: 0.6 });
}

/** Build a wall-mounted proud mural panel on the rear facade. */
function buildWallBillboard(
  pride: number,
  panelW: number,
  panelH: number,
  mat: MeshStandardMaterial,
  structure: MeshStandardMaterial,
): { group: Group; panel: Mesh } {
  const group = new Group();
  const panel = new Mesh(new PlaneGeometry(panelW, panelH), mat);
  // Center vertically in the window-free ground band (storefront band is
  // 0..STOREFRONT_SLOT_HEIGHT). With panelH≈2.8 this spans 0.1..2.9 — clear of
  // the first window row (centers at y≈5.15) and clear of ground burial.
  panel.position.y = Math.min(1.4, (STOREFRONT_SLOT_HEIGHT - panelH * 0.2) / 2);
  panel.position.z = pride;
  panel.castShadow = true;
  group.add(panel);
  // Thin metal frame flush with the wall.
  const frameThickness = 0.12;
  const frame = new Mesh(
    new BoxGeometry(panelW + 0.3, panelH + 0.3, frameThickness),
    structure,
  );
  frame.position.y = panel.position.y;
  frame.position.z = pride - frameThickness;
  group.add(frame);
  return { group, panel };
}

/** Build a freestanding ground poster board with two posts. */
function buildFreestandingBillboard(
  panelW: number,
  panelH: number,
  postHeight: number,
  mat: MeshStandardMaterial,
  structure: MeshStandardMaterial,
): { group: Group; panel: Mesh } {
  const group = new Group();
  const panel = new Mesh(new PlaneGeometry(panelW, panelH), mat);
  panel.position.y = postHeight;
  panel.castShadow = true;
  group.add(panel);
  // Backing board.
  const backing = new Mesh(
    new BoxGeometry(panelW + 0.2, panelH + 0.2, 0.12),
    structure,
  );
  backing.position.y = postHeight;
  backing.position.z = -0.1;
  group.add(backing);
  // Two support posts.
  for (const side of [-1, 1]) {
    const post = new Mesh(new BoxGeometry(0.16, postHeight, 0.16), structure);
    post.position.set(side * (panelW / 2 - 0.2), postHeight / 2, -0.1);
    post.castShadow = true;
    group.add(post);
  }
  return { group, panel };
}

/** Build a rooftop billboard standing on legs. */
function buildRooftopBillboard(
  panelW: number,
  panelH: number,
  mat: MeshStandardMaterial,
  structure: MeshStandardMaterial,
): { group: Group; panel: Mesh } {
  const group = new Group();
  const legH = 0.7;
  const panel = new Mesh(new PlaneGeometry(panelW, panelH), mat);
  panel.position.y = legH + panelH / 2;
  panel.castShadow = true;
  group.add(panel);
  // Backing.
  const backing = new Mesh(
    new BoxGeometry(panelW + 0.16, panelH + 0.16, 0.1),
    structure,
  );
  backing.position.set(0, legH + panelH / 2, -0.08);
  group.add(backing);
  // Legs.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new Mesh(new BoxGeometry(0.12, legH, 0.12), structure);
      leg.position.set(sx * (panelW / 2 - 0.15), legH / 2, sz * 0.1);
      leg.castShadow = true;
      group.add(leg);
    }
  }
  return { group, panel };
}

/**
 * Decide the billboard kinds for one lot so the block gets a varied but
 * coordinated mix: every building gets a rooftop ad, and wall / freestanding
 * ads alternate across the block.
 */
function kindsForLot(idx: number): BillboardKind[] {
  const kinds: BillboardKind[] = ['rooftop'];
  if (idx % 2 === 0) kinds.push('wall');
  else kinds.push('freestanding');
  return kinds;
}

/**
 * Place all billboards across the lots, coordinating against the buildings so
 * nothing overlaps windows, entrances, or storefront signage zones.
 */
function placeBillboards(
  lots: Lot[],
  storefrontSlots: StorefrontSlot[],
  structure: MeshStandardMaterial,
  initialEra: EraKey,
): BillboardInstance[] {
  const instances: BillboardInstance[] = [];

  lots.forEach((lot, idx) => {
    const rot = lot.rotationY ?? 0;
    const seed = hashSeed(lot.cx, lot.cz, idx);
    const eraHeights = computeEraHeights(seed);
    const slot = storefrontSlots[idx];
    // Storefront signage half-width — freestanding ads stay clear of this.
    const slotHalfW = slot ? slot.width / 2 : 2.5;
    const w = lot.width;
    const d = lot.depth;
    const pride = 0.28;

    for (const kind of kindsForLot(idx)) {
      // Panel sizing per kind.
      const panelW = kind === 'rooftop'
        ? Math.min(Math.max(w * 0.5, 3), 5)
        : kind === 'wall'
          ? Math.min(Math.max(w * 0.6, 3.5), 5)
          : 3.4;
      const panelH = kind === 'rooftop'
        ? Math.min(Math.max(panelW * 0.5, 2), 3)
        : kind === 'wall'
          ? 2.8
          : 2.4;

      // Ad material: art is both the albedo map and emissive map; emissive
      // intensity is driven per era (0 for matte painted/printed).
      const material = new MeshStandardMaterial({
        color: '#ffffff',
        side: DoubleSide,
        transparent: true,
        opacity: 1,
        roughness: 0.5,
        metalness: 0.0,
      });

      let built: { group: Group; panel: Mesh };
      if (kind === 'wall') {
        built = buildWallBillboard(pride, panelW, panelH, material, structure);
      } else if (kind === 'freestanding') {
        built = buildFreestandingBillboard(panelW, panelH, 3.2, material, structure);
      } else {
        built = buildRooftopBillboard(panelW, panelH, material, structure);
      }

      // ---- World placement (coordinated to avoid windows/entrances/storefront)
      // Local offset assuming front = +Z at rotation 0, then rotated by lot rot.
      // Window grid: all four faces have windows above y≈3.5 (storefront band).
      // The entrance + storefront signage occupy the FRONT (+Z) face only.
      // → Rooftop ads clear everything (above roof). Freestanding ads clear
      //   everything (on the sidewalk, offset from the building). Wall ads use
      //   a SIDE face in the window-free, signage-free ground band.
      let localX = 0;
      let localZ = 0;
      let faceRotY = 0;
      if (kind === 'rooftop') {
        // Near the rear edge of the roof — clear of the front rooftop clutter.
        localX = 0;
        localZ = -d / 2 + 1.4;
        faceRotY = 0;
      } else if (kind === 'wall') {
        // Side wall (+X), within the window-free ground band (y < storefront
        // height). Side faces hold no entrance and no storefront signage, so a
        // mural here overlaps neither windows nor signage. The face normal is
        // +X, so the panel (default +Z) rotates +π/2 to face outward.
        localX = w / 2 + pride;
        localZ = 0;
        faceRotY = Math.PI / 2;
      } else {
        // Freestanding: front corner, beyond storefront half-width and away from
        // the centered entrance.
        const cornerX = Math.max(slotHalfW + 0.9, w / 2 + 1.3);
        localX = idx % 4 < 2 ? cornerX : -cornerX;
        localZ = d / 2 + 1.6;
        faceRotY = 0;
      }

      const [rx, rz] = rotateXZ(localX, localZ, rot);
      built.group.position.set(lot.cx + rx, 0, lot.cz + rz);
      built.panel.rotation.y = faceRotY + rot;
      built.group.name = `billboard-${idx}-${kind}`;

      // ---- Per-era canvas frames (content + medium read from EraConfig.ads)
      const eraFrames = {} as Record<EraKey, CanvasTexture[]>;
      const frameCount = {} as Record<EraKey, number>;
      const frameIntervalMs = {} as Record<EraKey, number>;
      for (const era of ERA_KEYS) {
        eraFrames[era] = buildEraFrames(seed, era);
        frameCount[era] = ERA_AD_STYLE[era].frameCount;
        frameIntervalMs[era] = ERA_AD_STYLE[era].frameIntervalMs;
      }

      // Initial material state from the active era. The canvas art serves as
      // both the albedo map and the emissive map; emissive intensity is driven
      // per era (0 for matte painted / printed media, >0 for LED / holographic).
      const initTex = eraFrames[initialEra][0];
      const initStyle = ERA_AD_STYLE[initialEra];
      material.map = initTex;
      material.emissiveMap = initTex;
      material.emissive.set(initStyle.emissive);
      material.emissiveIntensity = initStyle.emissiveIntensity;
      material.opacity = ERA_AD_STYLE[initialEra].opacity;
      material.roughness = mediumRoughness(ERA_AD_STYLE[initialEra].medium);
      material.metalness = mediumMetalness(ERA_AD_STYLE[initialEra].medium);
      material.needsUpdate = true;

      instances.push({
        kind,
        group: built.group,
        panel: built.panel,
        material,
        eraFrames,
        frameCount,
        frameIntervalMs,
        eraHeights,
        displayedEra: initialEra,
        frameIndex: 0,
        frameAccumMs: 0,
        transitioning: false,
      });
    }
  });

  return instances;
}

// ---------------------------------------------------------------------------
// Era transition — billboard content + medium transform
// ---------------------------------------------------------------------------

/**
 * Build the per-frame `applyEra` callback for all billboards. During a cross-fade
 * it interpolates emissive intensity, opacity and PBR values between the source
 * and destination era media, swaps the canvas art at the transition midpoint,
 * and tracks each building's roof height so rooftop / wall ads ride the roof.
 */
function createBillboardsApplyEra(instances: BillboardInstance[]): ApplyEraFn {
  return (toKey: EraKey, t: number, fromKey: EraKey) => {
    const fromStyle = ERA_AD_STYLE[fromKey];
    const toStyle = ERA_AD_STYLE[toKey];

    for (const bb of instances) {
      const transitioning = t > 0 && t < 1;
      bb.transitioning = transitioning;

      // Roof / facade height interpolation (rooftop + wall ads track it).
      const height = lerp(bb.eraHeights[fromKey], bb.eraHeights[toKey], t);

      // Which era's art is currently shown — source for the first half of the
      // cross-fade, destination for the second half (a midpoint content swap,
      // smoothed by the emissive / opacity ramps below).
      const eraShown: EraKey = t < 0.5 ? fromKey : toKey;
      bb.displayedEra = eraShown;
      const fi = transitioning ? 0 : bb.frameIndex;
      const frames = bb.eraFrames[eraShown];
      const tex = frames[fi] ?? frames[0];

      if (bb.material.map !== tex) {
        bb.material.map = tex;
        bb.material.emissiveMap = tex;
        bb.material.needsUpdate = true;
      }

      // Emissive ramp — LED / holographic art glows via the bloom pass.
      const shownStyle = ERA_AD_STYLE[eraShown];
      bb.material.emissive.set(shownStyle.emissive);
      bb.material.emissiveIntensity = lerp(fromStyle.emissiveIntensity, toStyle.emissiveIntensity, t);

      // Opacity + PBR cross-fade across media.
      bb.material.opacity = lerp(fromStyle.opacity, toStyle.opacity, t);
      bb.material.transparent =
        fromStyle.opacity < 1 || toStyle.opacity < 1 || bb.material.emissiveIntensity > 0.01;
      bb.material.roughness = lerp(mediumRoughness(fromStyle.medium), mediumRoughness(toStyle.medium), t);
      bb.material.metalness = lerp(mediumMetalness(fromStyle.medium), mediumMetalness(toStyle.medium), t);

      // Rooftop ads ride the interpolated roof height (wall ads stay in the
      // fixed window-free ground band, so they do not move vertically).
      if (bb.kind === 'rooftop') {
        bb.group.position.y = height;
      }
    }
  };
}

/**
 * Build the per-frame animation tick. LED + holographic billboards cycle their
 * canvas frames for motion while settled; cycling pauses during a cross-fade so
 * the transition reads cleanly.
 */
function createBillboardsUpdate(instances: BillboardInstance[]): (deltaMs: number) => void {
  return (deltaMs: number) => {
    for (const bb of instances) {
      if (bb.transitioning) continue;
      const n = bb.frameCount[bb.displayedEra];
      if (n <= 1) continue;
      bb.frameAccumMs += deltaMs;
      if (bb.frameAccumMs < bb.frameIntervalMs[bb.displayedEra]) continue;
      bb.frameAccumMs = 0;
      bb.frameIndex = (bb.frameIndex + 1) % n;
      const tex = bb.eraFrames[bb.displayedEra][bb.frameIndex] ?? bb.eraFrames[bb.displayedEra][0];
      bb.material.map = tex;
      bb.material.emissiveMap = tex;
      bb.material.needsUpdate = true;
    }
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Create the billboard / advertisement domain.
 *
 * @param lots            Buildable lots (one building each) from BlockLayout /
 *                        `createDefaultLots()`.
 * @param storefrontSlots Reserved ground-floor signage slots from
 *                        `createBuildings()`, same order as `lots`. Used to keep
 *                        freestanding ads clear of storefront signage zones.
 * @param initialEra      Era to snap to on construction (defaults to 1945).
 *
 * Returns a group to add to the scene, an `applyEra` callback to register with
 * the TransitionManager, and an `update` tick to call every frame for LED /
 * holographic frame cycling.
 */
export function createBillboards(
  lots: Lot[],
  storefrontSlots: StorefrontSlot[],
  initialEra: EraKey = '1945',
): BillboardSystem {
  const structure = createStructureMaterial();
  const instances = placeBillboards(lots, storefrontSlots, structure, initialEra);

  const group = new Group();
  group.name = 'billboards';
  for (const bb of instances) {
    group.add(bb.group);
  }

  const applyEra = createBillboardsApplyEra(instances);
  const update = createBillboardsUpdate(instances);

  return { group, applyEra, update };
}
