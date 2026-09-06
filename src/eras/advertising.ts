/**
 * Era advertising module — block advertisements per year.
 *
 * For each supported era (1945 / 1965 / 1985 / 2005 / 2025) this factory
 * builds a set of advertisement panels and wall signs placed across the
 * block. Every ad texture is generated on a `<canvas>` using era-specific
 * typography and color palettes — never sourced from external image assets.
 *
 * Progression handled here (per the product requirement):
 *   1945  painted wall ads        -> hand-lettered brick-wall murals
 *   1965  neon signs              -> glowing tube signs on poles
 *   1985  billboard posters       -> large paper-poster billboards
 *   2005  backlit bus-stop ads    -> illuminated shelter panels
 *   2025  digital animated billboards -> animated LED panels
 *
 * Lifecycle contract: `bootstrap` (attach to a scene), `update(year)`
 * (rebuild for a new era), `dispose` (tear down). The scene-composition task
 * owns application wiring; a handoff with export paths is declared in the
 * module documentation.
 *
 * This module consumes the shared canvas-texture helper convention exported
 * by `storefronts.ts` (`makeCanvas` / `canvasToTexture`) so both signage
 * systems draw on identical graphics conventions.
 */
import * as THREE from 'three';
import { makeCanvas, canvasToTexture } from './storefronts';
import type { EraKey } from '../data/eraDefinition';

// ===========================================================================
// Era-specific ad configuration
// ===========================================================================

/** Render mode for a given era's advertisements. */
export type AdMode = 'painted' | 'neon' | 'poster' | 'backlit' | 'digital';

interface AdSpec {
  /** Headline text rendered on the ad. */
  headline: string;
  /** Sub-line / brand tagline. */
  sub: string;
  /** Primary brand color. */
  color: string;
}

const AD_SPECS: Record<string, AdSpec> = {
  'soap': { headline: 'CLEAN SOAP', sub: 'FOR EVERY HOME', color: '#c9a24a' },
  'tires': { headline: 'DURABLE TIRES', sub: 'RIDE SMOOTH', color: '#b33a2c' },
  'cola': { headline: 'COLA', sub: 'ICE COLD', color: '#c03a2a' },
  'auto': { headline: 'AUTO & MOTORS', sub: 'SINCE 1950', color: '#e0457b' },
  'tv': { headline: 'COLOR TV', sub: 'NOW IN STORES', color: '#ff7a1a' },
  'video': { headline: 'VIDEO RENTAL', sub: 'ALL NIGHT', color: '#ffd23e' },
  'arcade': { headline: 'ARCADE', sub: 'PLAY TODAY', color: '#e0457b' },
  'phone': { headline: 'CELL PHONES', sub: 'UNLIMITED DATA', color: '#2f86c8' },
  'coffee': { headline: 'COFFEE', sub: 'FRESH DAILY', color: '#5a3a22' },
  'financial': { headline: 'BANK & LOAN', sub: 'OPEN LATE', color: '#1f7fb8' },
  'ebike': { headline: 'E-BIKES', sub: 'GO ELECTRIC', color: '#00d1ff' },
  'streaming': { headline: 'STREAM NOW', sub: 'ANY DEVICE', color: '#ff4d5e' },
};

interface EraAdTheme {
  /** Which ad specs to place (ordered by prominence). */
  ads: string[];
  /** Render mode for this era. */
  mode: AdMode;
  /** Background / panel tint. */
  backdrop: string;
}

const ERA_AD_THEMES: Record<EraKey, EraAdTheme> = {
  1945: {
    ads: ['soap', 'tires'],
    mode: 'painted',
    backdrop: '#8a6a4a',
  },
  1965: {
    ads: ['cola', 'auto'],
    mode: 'neon',
    backdrop: '#14141a',
  },
  1985: {
    ads: ['tv', 'video', 'arcade'],
    mode: 'poster',
    backdrop: '#e8e0d0',
  },
  2005: {
    ads: ['phone', 'coffee', 'financial'],
    mode: 'backlit',
    backdrop: '#f4f6fa',
  },
  2025: {
    ads: ['ebike', 'streaming', 'financial'],
    mode: 'digital',
    backdrop: '#0a0a12',
  },
};

// ===========================================================================
// Ad texture painters
// ===========================================================================

/** Painted wall ad (1945): brick backdrop, hand-lettered serif. */
function paintPaintedAd(ctx: CanvasRenderingContext2D, w: number, h: number, spec: AdSpec): void {
  // Brick wall backdrop.
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(60,40,30,0.5)';
  ctx.lineWidth = Math.max(1, h * 0.008);
  const rowH = Math.max(6, Math.round(h / 14));
  for (let y = 0; y < h; y += rowH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    const offset = (y / rowH) % 2 === 0 ? rowH / 2 : 0;
    for (let x = offset; x < w; x += rowH * 2) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + rowH);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#efe6cf';
  ctx.fillRect(0, h * 0.08, w, h * 0.14);
  ctx.fillStyle = spec.color;
  ctx.font = `bold ${Math.round(h * 0.2)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.headline, w / 2, h * 0.15);
  ctx.fillStyle = '#3f3a2e';
  ctx.font = `${Math.round(h * 0.11)}px Georgia, serif`;
  ctx.fillText(spec.sub, w / 2, h * 0.6);
}

/** Neon sign (1965): dark panel, glowing tube headline. */
function paintNeonAd(ctx: CanvasRenderingContext2D, w: number, h: number, spec: AdSpec): void {
  ctx.fillStyle = '#14141a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = spec.color;
  ctx.lineWidth = Math.max(2, h * 0.03);
  ctx.shadowColor = spec.color;
  ctx.shadowBlur = 8;
  ctx.font = `bold ${Math.round(h * 0.32)}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(spec.headline, w / 2, h * 0.35);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(h * 0.12)}px 'Courier New', monospace`;
  ctx.fillText(spec.sub, w / 2, h * 0.72);
}

/** Billboard poster (1985): paper sheet, bold sans headline. */
function paintPosterAd(ctx: CanvasRenderingContext2D, w: number, h: number, spec: AdSpec): void {
  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = spec.color;
  ctx.fillRect(0, h * 0.18, w, h * 0.3);
  ctx.fillStyle = '#1c1c2a';
  ctx.font = `900 ${Math.round(h * 0.22)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.headline, w / 2, h * 0.33);
  ctx.fillStyle = '#5a5a5a';
  ctx.font = `${Math.round(h * 0.12)}px Arial, sans-serif`;
  ctx.fillText(spec.sub, w / 2, h * 0.72);
}

/** Backlit bus-stop ad (2005): bright illuminated shelter panel. */
function paintBacklitAd(ctx: CanvasRenderingContext2D, w: number, h: number, spec: AdSpec): void {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#e8eef6');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Glow frame (backlit).
  ctx.fillStyle = spec.color;
  ctx.fillRect(0, 0, w, Math.round(h * 0.05));
  ctx.fillRect(0, h - Math.round(h * 0.05), w, Math.round(h * 0.05));
  ctx.fillStyle = '#0f2a4a';
  ctx.font = `bold ${Math.round(h * 0.24)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.headline, w / 2, h * 0.4);
  ctx.fillStyle = '#3a5a7a';
  ctx.font = `${Math.round(h * 0.12)}px Arial, sans-serif`;
  ctx.fillText(spec.sub, w / 2, h * 0.72);
}

/** Digital animated billboard (2025): pixel-dot matrix, animated sweep. */
function paintDigitalAd(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spec: AdSpec,
  frame: number,
): void {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, w, h);
  const dot = Math.max(2, Math.round(h * 0.05));
  const gap = dot + Math.max(1, Math.round(dot * 0.3));
  ctx.fillStyle = spec.color;
  const cols = Math.floor(w / gap);
  const rows = Math.floor(h / gap);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * gap + gap / 2;
      const y = r * gap + gap / 2;
      const on = ((c * 5 + r * 9 + frame) % 13) < 7;
      if (on) {
        ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
      }
    }
  }
  // Animated sweep highlight.
  const sweepX = (frame % 24) / 24 * w;
  const grad = ctx.createLinearGradient(sweepX - w * 0.15, 0, sweepX + w * 0.15, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Headline overlay.
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(h * 0.2)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.headline, w / 2, h * 0.4);
  ctx.fillStyle = '#9fd8ff';
  ctx.font = `${Math.round(h * 0.11)}px Arial, sans-serif`;
  ctx.fillText(spec.sub, w / 2, h * 0.74);
}

// ===========================================================================
// Ad factory
// ===========================================================================

/** A single advertisement rig attached to the scene. */
export interface AdRig {
  /** Root group holding all meshes for this ad. */
  group: THREE.Group;
  /** The ad panel mesh (its texture is swapped on era update). */
  panel: THREE.Mesh;
  /** The texture currently applied to the panel. */
  texture: THREE.CanvasTexture;
  /** World position of the ad. */
  position: THREE.Vector3;
  /** Current era this rig was built for. */
  era: EraKey;
}

/** The advertising factory object. */
export interface AdvertisingFactory {
  /** Attach the ad rigs to a scene; returns the rigs built. */
  bootstrap: (scene: THREE.Scene) => AdRig[];
  /** Rebuild the ads for a new era. */
  update: (year: EraKey) => AdRig[];
  /** Remove all ad meshes from the scene. */
  dispose: () => void;
  /** The rigs currently attached (read-only accessor). */
  readonly rigs: AdRig[];
}

const PANEL_W = 4.4;
const PANEL_H = 2.4;

/**
 * Build the advertising module. The returned factory is wired to a single
 * scene so `update` and `dispose` can cheaply manage the attached rigs.
 */
export function createAdvertisingFactory(): AdvertisingFactory {
  let rigs: AdRig[] = [];
  let currentYear: EraKey | null = null;
  let frame = 0;

  function buildRig(year: EraKey, index: number): AdRig {
    const theme = ERA_AD_THEMES[year];
    const spec = AD_SPECS[theme.ads[index % theme.ads.length]];
    const group = new THREE.Group();

    const canvas = makeCanvas(PANEL_W * 128, PANEL_H * 128, (ctx, w, h) => {
      switch (theme.mode) {
        case 'painted':
          paintPaintedAd(ctx, w, h, spec);
          break;
        case 'neon':
          paintNeonAd(ctx, w, h, spec);
          break;
        case 'poster':
          paintPosterAd(ctx, w, h, spec);
          break;
        case 'backlit':
          paintBacklitAd(ctx, w, h, spec);
          break;
        case 'digital':
          paintDigitalAd(ctx, w, h, spec, frame);
          break;
      }
    });
    const texture = canvasToTexture(canvas);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(PANEL_W, PANEL_H),
      new THREE.MeshStandardMaterial({ map: texture }),
    );

    // Spread ad panels along the block at varying heights.
    const x = (index - 1) * 6.0;
    const y = 4.2 + (index % 2) * 1.6;
    const pos = new THREE.Vector3(x, y, 6.5);
    panel.position.copy(pos);
    group.add(panel);

    return { group, panel, texture, position: pos, era: year };
  }

  return {
    get rigs() {
      return rigs;
    },
    bootstrap(scene: THREE.Scene): AdRig[] {
      const year: EraKey = currentYear ?? 1945;
      currentYear = year;
      const theme = ERA_AD_THEMES[year];
      rigs = theme.ads.map((_, i) => buildRig(year, i));
      for (const rig of rigs) {
        scene.add(rig.group);
      }
      return rigs;
    },
    update(year: EraKey): AdRig[] {
      frame += 1;
      currentYear = year;
      const theme = ERA_AD_THEMES[year];
      const next = theme.ads.map((_, i) => buildRig(year, i));
      for (const rig of rigs) {
        if (rig.group.parent) {
          rig.group.parent.remove(rig.group);
        }
      }
      rigs = next;
      for (const rig of rigs) {
        if (rig.group.parent !== null) {
          rig.group.parent.add(rig.group);
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
    },
  };
}

// ===========================================================================
// Era-specific ad definition (registers the advertising segment)
// ===========================================================================

/**
 * Resolve the advertisement definition for a year. This is the canonical
 * per-era ad descriptor the composition task can query.
 */
export function advertisingDefinition(year: EraKey): {
  year: EraKey;
  mode: AdMode;
  backdrop: string;
  ads: string[];
  headlines: string[];
} {
  const theme = ERA_AD_THEMES[year];
  return {
    year,
    mode: theme.mode,
    backdrop: theme.backdrop,
    ads: theme.ads,
    headlines: theme.ads.map((k) => AD_SPECS[k].headline),
  };
}

/** Convenience default export used by the composition task. */
export function advertisingFactory(): AdvertisingFactory {
  return createAdvertisingFactory();
}