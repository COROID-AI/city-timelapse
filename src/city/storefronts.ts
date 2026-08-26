import * as THREE from 'three';
import {
  eraConfigs,
  type AdvertisementsConfig,
  type EraId,
  type StorefrontsConfig,
} from '../eras';
import { useEraTimeline } from '../store/eraTimeline';
import { getBuildingAnchors, type StreetSide } from '../scene/blockLayout';

/**
 * Era-changing storefront + advertisement subsystem.
 *
 * Renders a commercial storefront strip along the ground floor of every block
 * building: a window display, a canvas awning, a brand sign and a secondary
 * billboard above it, plus small posters pinned to the window glass.
 *
 * Every visual is driven by the Phase-1 `StorefrontsConfig` / `AdvertisementsConfig`
 * from the era store so the whole subsystem is data-driven:
 *  - Awning colour crossfades between the current and target era palettes.
 *  - Sign / billboard / poster textures are regenerated with the dominant era's
 *    ad copy whenever the dominant era changes.
 *  - The ad media type (painted poster, neon, backlit LED, digital screen) drives
 *    the drawn style of each sign and how strongly it glows.
 *  - Emissive intensity (neon glow / digital-screen brightness) is interpolated
 *    from the shared era-transition progress, so neon peaks in 1985 and digital
 *    screens brighten toward 2025 while every era morphs smoothly.
 *
 * Scene module contract: exposes `group`, `update(dt)`, `dispose()` and does not
 * start its own render loop.
 */

/** Rotation that makes a storefront's local +Z face outward toward the street. */
const SIDE_ROT: Record<StreetSide, number> = {
  north: Math.PI,
  south: 0,
  east: -Math.PI / 2,
  west: Math.PI / 2,
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Smoothstep easing so the morph feels natural, not linear. */
function easeInOut(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/** The visual drawing style of an ad media type. */
interface AdStyle {
  /** Background fill colour of the sign canvas. */
  bg: string;
  /** Foreground / text colour. */
  fg: string;
  /** Rendering treatment (matte poster, glowing neon, backlit, digital screen). */
  kind: 'painted' | 'neon' | 'backlit' | 'digital';
}

/** Map a Phase-1 ad media type to a concrete drawing style. */
function adStyle(mediaType: string): AdStyle {
  switch (mediaType) {
    case 'painted-posters':
      return { bg: '#e8dcc0', fg: '#4a2a1a', kind: 'painted' };
    case 'neon-signs':
      return { bg: '#1a0a2a', fg: '#ff5a5a', kind: 'neon' };
    case 'bright-neon':
      return { bg: '#1a0a1a', fg: '#ff5ad8', kind: 'neon' };
    case 'digital-billboards':
      return { bg: '#e8f0ff', fg: '#123a6a', kind: 'backlit' };
    case 'led-screens':
      return { bg: '#0a1a2a', fg: '#a0d8ff', kind: 'digital' };
    default:
      return { bg: '#e8dcc0', fg: '#4a2a1a', kind: 'painted' };
  }
}

/** How strongly window posters show for a given ad media type. */
function posterOpacity(mediaType: string): number {
  switch (mediaType) {
    case 'painted-posters':
      return 0.92;
    case 'neon-signs':
      return 0.7;
    case 'bright-neon':
      return 0.4;
    case 'digital-billboards':
      return 0.22;
    case 'led-screens':
      return 0.12;
    default:
      return 0.5;
  }
}

/** Draw era ad copy onto a canvas and return it as a reusable CanvasTexture. */
function makeSignTexture(text: string, style: AdStyle): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, w, h);

  // Decorative border.
  ctx.strokeStyle = style.fg;
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  // For painted posters add a subtle aged mottling.
  if (style.kind === 'painted') {
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = i % 2 ? '#6b4a2a' : '#c8b890';
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 6 + Math.random() * 18;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = style.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let fontSize = 72;
  // Shrink text that is too long for the canvas.
  if (text.length > 10) fontSize = 52;
  ctx.font = `bold ${fontSize}px "Arial Black", Arial, sans-serif`;

  if (style.kind === 'neon') {
    ctx.shadowColor = style.fg;
    ctx.shadowBlur = 32;
  } else if (style.kind === 'digital') {
    ctx.shadowColor = style.fg;
    ctx.shadowBlur = 18;
  }

  ctx.fillText(text, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** One parameterized storefront strip attached to a block building. */
class Storefront {
  readonly group = new THREE.Group();

  private awningMat: THREE.MeshStandardMaterial;
  private windowMat: THREE.MeshStandardMaterial;
  private signMat: THREE.MeshStandardMaterial;
  private billMat: THREE.MeshStandardMaterial;
  private posterMats: THREE.MeshStandardMaterial[] = [];

  private signTex: THREE.CanvasTexture | null = null;
  private billTex: THREE.CanvasTexture | null = null;
  private posterTexs: (THREE.CanvasTexture | null)[] = [];

  private lastEra: EraId | null = null;
  private time = 0;
  private index: number;

  private geometries: THREE.BufferGeometry[] = [];

  constructor(anchor: { position: THREE.Vector3; size: { width: number; depth: number }; side: StreetSide }, index: number) {
    this.index = index;
    const w = anchor.size.width;

    this.group.position.set(anchor.position.x, 0, anchor.position.z);
    this.group.rotation.y = SIDE_ROT[anchor.side];

    // --- Window display (glass) ---
    const winGeo = new THREE.PlaneGeometry(w * 0.78, 2.6);
    this.geometries.push(winGeo);
    this.windowMat = new THREE.MeshStandardMaterial({
      color: '#1a1a2a',
      transparent: true,
      opacity: 0.55,
      emissive: '#ffd9a0',
      emissiveIntensity: 0.4,
      roughness: 0.2,
      metalness: 0.4,
      side: THREE.DoubleSide,
    });
    const win = new THREE.Mesh(winGeo, this.windowMat);
    win.position.set(0, 2.2, 0.08);
    this.group.add(win);

    // --- Small posters pinned to the window glass ---
    const posterW = 2.4;
    const posterH = 3.0;
    for (let p = 0; p < 2; p++) {
      const pGeo = new THREE.PlaneGeometry(posterW, posterH);
      this.geometries.push(pGeo);
      const pMat = new THREE.MeshStandardMaterial({
        transparent: true,
        opacity: 0.9,
        emissive: '#ffffff',
        emissiveIntensity: 0.25,
        roughness: 0.6,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });
      this.posterMats.push(pMat);
      const poster = new THREE.Mesh(pGeo, pMat);
      poster.position.set((p === 0 ? -1 : 1) * w * 0.22, 2.3, 0.16);
      this.group.add(poster);
    }

    // --- Awning (canvas canopy above the window) ---
    const awningGeo = new THREE.BoxGeometry(w * 0.9, 0.45, 1.5);
    this.geometries.push(awningGeo);
    this.awningMat = new THREE.MeshStandardMaterial({ color: '#7a3a2a', roughness: 0.85 });
    const awning = new THREE.Mesh(awningGeo, this.awningMat);
    awning.position.set(0, 3.7, 0.9);
    this.group.add(awning);

    // --- Brand sign (the primary advertisement) ---
    const signGeo = new THREE.PlaneGeometry(w * 0.7, 1.2);
    this.geometries.push(signGeo);
    this.signMat = new THREE.MeshStandardMaterial({
      emissive: '#ffffff',
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });
    const sign = new THREE.Mesh(signGeo, this.signMat);
    sign.position.set(0, 4.6, 0.1);
    this.group.add(sign);

    // --- Billboard (secondary ad above the storefront) ---
    const billGeo = new THREE.PlaneGeometry(w * 0.6, 1.6);
    this.geometries.push(billGeo);
    this.billMat = new THREE.MeshStandardMaterial({
      emissive: '#ffffff',
      emissiveIntensity: 0.4,
      roughness: 0.4,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });
    const bill = new THREE.Mesh(billGeo, this.billMat);
    bill.position.set(0, 6.4, 0.1);
    this.group.add(bill);
  }

  /**
   * Update this storefront from the era store.
   * @param fromS / @param toS — current/target StorefrontsConfig
   * @param fromA / @param toA — current/target AdvertisementsConfig
   * @param t — eased transition progress (0..1)
   * @param dominant — the era currently rendered (drives texture copy)
   */
  update(
    dt: number,
    fromS: StorefrontsConfig,
    toS: StorefrontsConfig,
    fromA: AdvertisementsConfig,
    toA: AdvertisementsConfig,
    t: number,
    dominant: EraId,
  ): void {
    this.time += dt;

    // Awning colour crossfade between era palettes.
    const fromAwning = new THREE.Color(fromS.awningColors[this.index % fromS.awningColors.length]);
    const toAwning = new THREE.Color(toS.awningColors[this.index % toS.awningColors.length]);
    this.awningMat.color.copy(fromAwning).lerp(toAwning, t);

    // Emissive glow colour interpolates continuously with the transition.
    const fromGlow = new THREE.Color(fromA.glowColor);
    const toGlow = new THREE.Color(toA.glowColor);
    const glowCol = new THREE.Color().copy(fromGlow).lerp(toGlow, t);
    this.signMat.emissive.copy(glowCol);
    this.billMat.emissive.copy(glowCol);
    this.windowMat.emissive.copy(glowCol);
    for (const pm of this.posterMats) pm.emissive.copy(glowCol);

    // Neon glow / digital brightness follows the shared transition progress.
    const glow = lerp(fromA.glowIntensity, toA.glowIntensity, t);
    this.signMat.emissiveIntensity = 0.3 + glow * 1.6;
    this.billMat.emissiveIntensity = 0.2 + glow * 1.4;
    this.windowMat.emissiveIntensity = 0.2 + glow * 0.8;

    // Window poster visibility follows the dominant ad media type.
    const postFrom = posterOpacity(fromA.mediaType);
    const postTo = posterOpacity(toA.mediaType);
    const post = lerp(postFrom, postTo, t);
    for (const pm of this.posterMats) pm.opacity = post;

    // Regenerate sign / billboard / poster copy when the dominant era changes.
    if (this.lastEra !== dominant) {
      this.lastEra = dominant;
      const cfg = eraConfigs[dominant];
      const style = adStyle(cfg.advertisements.mediaType);
      const examples = cfg.advertisements.examples;

      this.signTex?.dispose();
      this.signTex = makeSignTexture(examples[this.index % examples.length], style);
      this.signMat.map = this.signTex;
      this.signMat.needsUpdate = true;

      this.billTex?.dispose();
      this.billTex = makeSignTexture(examples[(this.index + 1) % examples.length], style);
      this.billMat.map = this.billTex;
      this.billMat.needsUpdate = true;

      for (let p = 0; p < this.posterMats.length; p++) {
        this.posterTexs[p]?.dispose();
        this.posterTexs[p] = makeSignTexture(examples[(this.index + 2 + p) % examples.length], style);
        this.posterMats[p].map = this.posterTexs[p];
        this.posterMats[p].needsUpdate = true;
      }
    }

    // Screen-like / neon animation so the media feels alive.
    const style = adStyle(eraConfigs[dominant].advertisements.mediaType);
    if (style.kind === 'neon') {
      const flicker = 0.9 + 0.1 * Math.sin(this.time * 23 + this.index * 1.3);
      this.signMat.emissiveIntensity *= flicker;
      this.billMat.emissiveIntensity *= flicker;
    } else if (style.kind === 'digital') {
      const pulse = 0.85 + 0.15 * Math.sin(this.time * 6 + this.index * 1.7);
      this.signMat.emissiveIntensity *= pulse;
      this.billMat.emissiveIntensity *= pulse;
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    this.awningMat.dispose();
    this.windowMat.dispose();
    this.signMat.dispose();
    this.billMat.dispose();
    for (const pm of this.posterMats) pm.dispose();
    this.signTex?.dispose();
    this.billTex?.dispose();
    for (const pt of this.posterTexs) pt?.dispose();
  }
}

/** The storefront + advertisement subsystem for the whole block. */
export class Storefronts {
  readonly group = new THREE.Group();

  private items: Storefront[] = [];
  private disposed = false;

  constructor() {
    this.group.name = 'storefronts';
    const anchors = getBuildingAnchors();
    anchors.forEach((a, i) => {
      const sf = new Storefront(a, i);
      this.items.push(sf);
      this.group.add(sf.group);
    });
  }

  /** Update every storefront from the era store. Call once per frame. */
  update(dt: number): void {
    if (this.disposed) return;
    const st = useEraTimeline.getState();
    const from = eraConfigs[st.currentEra];
    const to = eraConfigs[st.targetEra];
    const t = easeInOut(st.transitionProgress);
    const dominant = st.transitionProgress >= 0.5 ? st.targetEra : st.currentEra;
    for (const sf of this.items) {
      sf.update(dt, from.storefronts, to.storefronts, from.advertisements, to.advertisements, t, dominant);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const sf of this.items) sf.dispose();
    this.items = [];
  }
}
