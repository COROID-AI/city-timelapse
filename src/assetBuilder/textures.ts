import * as THREE from 'three';
import type { BuildingType, EraId } from '../eras/types';
import { ERAS } from '../eras/data';

/**
 * Procedural texture cache keyed by a content hash, so identical facade/sign
 * requests reuse the same CanvasTexture instead of regenerating pixels. Keeps
 * memory and draw-setup cost low when swapping eras.
 */
const textureCache = new Map<string, THREE.CanvasTexture>();

function makeCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return [canvas, ctx];
}

/**
 * Build (or fetch from cache) a facade texture encoding a window grid whose
 * lit/dark pattern and tint are era-specific.
 */
export function makeFacadeTexture(era: EraId, buildingType: BuildingType): THREE.CanvasTexture {
  const key = `facade:${era}:${buildingType}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const desc = ERAS[era];
  const size = 512;
  const [canvas, ctx] = makeCanvas(size);

  // Base facade color.
  ctx.fillStyle = desc.facadeColor;
  ctx.fillRect(0, 0, size, size);

  // Subtle vertical mullions depending on silhouette.
  const cols = buildingType === 'office' ? 6 : buildingType === 'commercial' ? 4 : 3;
  const rows = buildingType === 'office' ? 12 : buildingType === 'commercial' ? 6 : 4;

  // Deterministic lit-window pattern derived from the era seed.
  let seed = desc.seed ^ (buildingType.length * 2654435761);
  const rng = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const lit = desc.windowColor;
  const dark = 'rgba(20,24,32,0.78)';

  const margin = size * 0.06;
  const cw = (size - margin * 2) / cols;
  const ch = (size - margin * 2) / rows;
  const gap = Math.min(cw, ch) * 0.18;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = margin + c * cw + gap / 2;
      const y = margin + r * ch + gap / 2;
      const isLit = rng() < desc.windowLitChance;
      ctx.fillStyle = isLit ? lit : dark;
      ctx.fillRect(x, y, cw - gap, ch - gap);
    }
  }

  // Era-specific accent: neon stripe / glass sheen / trim.
  if (desc.silhouette === 'setback') {
    ctx.fillStyle = desc.windowColor;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 0, size, 6);
    ctx.globalAlpha = 1;
  } else if (desc.silhouette === 'glass') {
    const grad = ctx.createLinearGradient(0, 0, size, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Build a storefront sign texture with era-appropriate styling and label text.
 */
export function makeSignTexture(era: EraId, label: string): THREE.CanvasTexture {
  const key = `sign:${era}:${label}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const desc = ERAS[era];
  const w = 512;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  // Background plate styled by era.
  const styles: Record<string, () => void> = {
    '1945': () => {
      ctx.fillStyle = '#3a2f22';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#d8b070';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#f0d8a8';
    },
    '1965': () => {
      ctx.fillStyle = '#b0202a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff8e0';
    },
    '1985': () => {
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, 0, w, h);
      ctx.shadowColor = '#ff2d95';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#ff2d95';
    },
    '2005': () => {
      ctx.fillStyle = '#e8eef4';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2a4a8a';
    },
    '2025': () => {
      ctx.fillStyle = '#0e2a26';
      ctx.fillRect(0, 0, w, h);
      ctx.shadowColor = '#6affd0';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#6affd0';
    },
  };
  (styles[era] ?? styles['1945'])();

  ctx.font = `bold ${h * 0.42}px 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h / 2);

  void desc; // era palette retained for future styling expansion

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/** Dispose all cached textures. Call when tearing down the whole experience. */
export function disposeTextureCache(): void {
  for (const tex of textureCache.values()) tex.dispose();
  textureCache.clear();
}
