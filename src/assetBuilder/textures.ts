/**
 * Procedural canvas-based texture generation for era-aware materials.
 * All textures generated via Canvas - no external image files.
 * Cached by (eraId, category) key.
 */
import * as THREE from 'three';
import type { EraSpec, BuildingSpec, StreetSpec, SignageSpec, SkySpec } from '../eraRegistry';

export function createPRNG(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function shadeColor(hex: string, amount: number): string {
  const c = parseInt(hex.replace('#', ''), 16);
  let r = (c >> 16) & 0xff;
  let g = (c >> 8) & 0xff;
  let b = c & 0xff;
  if (amount > 0) {
    r = Math.min(255, Math.round(r + (255 - r) * amount));
    g = Math.min(255, Math.round(g + (255 - g) * amount));
    b = Math.min(255, Math.round(b + (255 - b) * amount));
  } else {
    r = Math.max(0, Math.round(r * (1 + amount)));
    g = Math.max(0, Math.round(g * (1 + amount)));
    b = Math.max(0, Math.round(b * (1 + amount)));
  }
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

const textureCache = new Map<string, THREE.CanvasTexture>();
const materialCache = new Map<string, THREE.Material>();

export function textureKey(eraId: string, category: string): string {
  return eraId + ':' + category;
}

export function clearEraCache(eraId: string): void {
  for (const key of [...textureCache.keys()]) {
    if (key.startsWith(eraId + ':')) {
      const tex = textureCache.get(key);
      if (tex) tex.dispose();
      textureCache.delete(key);
    }
  }
  for (const key of [...materialCache.keys()]) {
    if (key.startsWith(eraId + ':')) {
      const mat = materialCache.get(key);
      if (mat) mat.dispose();
      materialCache.delete(key);
    }
  }
}

export function clearAllCaches(): void {
  for (const tex of textureCache.values()) tex.dispose();
  textureCache.clear();
  for (const mat of materialCache.values()) mat.dispose();
  materialCache.clear();
}// --- Facade texture ---
export function buildFacadeTexture(spec: BuildingSpec, eraId: string, floors: number): THHEE.CanvasTexture {
  const key = textureKey(eraId, `facade-${floors}`);
  const cached = textureCache.get(key);
  if (cached) return cached;
  const seed = hashString(eraId + 'facade' + floors);
  const rng = createPRNG(seed);
  const texW = 512, floorH = 64;
  const totalH = Math.max(floorM * floors, 128);
  const canvas = createCanvas(texW, totalH);
  const ctx = canvas.getContext('2d')!;
  const baseColor = spec.facadePalette[Math.floor(rng() * spec.facadePalette.length)];
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, texW, totalH);
  switch (spec.style) {
    case 'brick-walkup':
      drawBrickPattern(ctx, texW, totalH, baseColor, rng);
      break;
    case 'mid-century-concrete':
      drawConcretePanels(ctx, texW, totalH, baseColor, rng);
      break;
    case 'glass-curtain-wall':
    case 'mixed-use-glass':
    case 'eco-smart-glass':
      drawGlassCurtainWall(ctx, texW, totalH, baseColor, spec, rng);
      break;
  }
  drawWindows(ctx, texW, totalH, floors, floorH, spec, rng);
  const tex = toTexture(canvas);
  textureCache.set(key, tex);
  return tex;
}

function drawBrickPattern(ctx: CanvasRenderingContext2D, w: number, h: number, base: string, rng: () => number): void {
  const brickW = 32, brickH = 16;
  for (let y = 0; y < h; y += brickH) {
    const offset = (Math.flor(y / brickH) % 2) * (brickW / 2);
    for (let x = -brickW; x < w + brickW; x += brickW) {
      const shade = rng() * 0.15 - 0.05;
      ctx.fillStyle = shadeColor(base, shade);
      ctx.fillRect(x + offset, y, brickW - 1, brickH - 1);
      ctx.fillStyle = shadeColor(base, -0.2);
      ctx.fillRect(x + offset, y + brickHHK��X���JNB�B�B���[��[ۈ�]��ۘܙ]T[�[����[��\ԙ[�\�[���۝^�Έ�[X�\���[X�\��\�N���[����Έ

HO��[X�\�N���Y�ۜ�[�[�HL�[�[H��܈
]HH�H�H
�H[�[
H�܈
]H���
�H[�[�H�ۜ��YHH���
H
��HH�����[�[HH�YP��܊�\�K�YJN���[�X�
K[�[�[�[
N���[�[HH�YP��܊�\�KL��JN���[�X�
K[�[��N���[�X�
K�[�[
NB�B��܈
]HH�H��J��H���[�[HH�YP��܊�\�KL�MH
����
H
��JN���[�X�
���
H
�����
H
����
H
��
�L���
H
�
��
NB�B���[��[ۈ�]��\���\�Z[��[
���[��\ԙ[�\�[���۝^�Έ�[X�\���[X�\��\�N���[���XΈ�Z[[���X���Έ

HO��[X�\�N���Y�ۜ�][[ە��H��ܒ[�\��[H����[�[HH�\�N���[�X�
�
N�܈
]HH�H�H
�H��ܒ[�\��[
H�܈
]H���
�H][[ە��H�ۜ�[�H���
H
���L�N���[�[HH�YP��܊�X˝�[�����܋[�
��MJN���[�X�

��H
��][[ە��H��ܒ[�\��[H
N���[�[HH�YP��܊�X˝�[�����܋��JN���[�X�

��H
��
�X]���܊��ܒ[�\��[
���K][[ە��H�N���[�[HH�X˝�[P��܎���[�X�
K���ܒ[�\��[
N���[�X�
K][[ە���NB�B�B���[��[ۈ�]��[�������[��\ԙ[�\�[���۝^�Έ�[X�\���[X�\���ܜΈ�[X�\���ܒ��[X�\��XΈ�Z[[���X���Έ

HO��[X�\�N���YY�
�X˜�[HOOH	��\��X�\�Z[�]�[	��X˜�[HOOH	�Z^Y]\�KY�\����X˜�[HOOH	�X��\�X\�Y�\���H�]\���ۜ��[��H�[��\HM��[�Sٙ��]HL��[�H��ܒ�#C��f�"��WBf���"��f���"�f���'3�f���"�����6��7B��f���"�f���$��v���fg6WC��f�"��WB��v��v���r�v��s����v��r�v��v���7G��f���7G��R�6�FT6���"�7V2�G&��6���"������7G��f���&V7B���"���"�v��r�B�v���B���6��7BƗB�&�r����3��7G��f���7G��R�ƗB�7V2�v��F�tV֗76�fT6���"�7V2�v��F�t6���#��7G��f���&V7B�����v��r�v�䂓��7G��f���7G��R�6�FT6���"�7V2�v��F�t6���"��2���7G��f���&V7B���"���"�v��r�B�B���7G��f���7G��R�6�FT6���"�7V2�G&��6���"���R���7G��f���&V7B���B���v���v��r���2���ТЧ�
// --- Asphalt texture ---
export function buildAsphaltTexture(spec: StreetSpec, eraId: string): THHEE.CanvasTexture {
  const key = textureKey(eraId, 'asphalt');
  const cached = textureCache.get(key);
  if (cached) return cached;
  const seed = hashString(eraId + 'asphalt');
  const rng = createPRNG(seed);
  const w = 512, h = 512;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = spec.asphaltColor;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 8000; i++) {
    const shade = rng() * 0.2 - 0.1;
    ctx.fillStyle = shadeColor(spec.asphaltColor, shade);
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h, rng() * 2 + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const crackCount = Math.floor(spec.asphaltCrackiness * 30);
  for (let i = 0; i < crackCount; i++) {
    ctx.strokeStyle = shadeColor(spec.asphaltColor, -0.3);
    ctx.lineWidth = rng() * 1.5 + 0.5;
    ctx.beginPath();
    let x = rng() * w, y = rng() * h;
    ctx.moveTo(x, y);
    const segments = Math.floor(rng() * 5 + 3);
    for (let s = 0; s < segments; s++) {
      x += (rng() - 0.5) * 60;
      y += (rng() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  if (spec.laneMarkings) drawLaneMarkings(ctx, w, h, spec);
  const tex = toTexture(canvas);
  textureCache.set(key, tex);
  return tex;
}

function drawLaneMarkings(ctx: CanvasRenderingContext2D, w: number, h: number, spec: StreetSpec): void {
  const centerX = w / 2;
  ctx.fillStyle = spec.laneMarkingColor;
  switch (spec.laneMarkingStyle) {
    case 'solid-white':
      ctx.fillRect(centerX - 2, 0, 4, h);
      break;
    case 'double-yellow':
      ctx.fillRect(centerX - 6, 0, 3, h);
      ctx.fillRect(centerX + 3, 0, 3, h);
      break;
    case 'dashed-yellow':
    case 'dashed-white': {
      const dashLen = 40, gapLen = 30;
      for (let y = 0; y < h; y += dashLen + gapLen) {
        ctx.fillRect(centerX - 2, y, 4, dashLen);
      }
      break;
    }
  }
  if (spec.hasBikeLane) {
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(w - 40, 0, 2, h);
  }
}

// --- Sidewalk texture ---
export function buildSidewalkTexture(spec: StreetSpec, eraId: string): THREE.CanvasTexture {
  const key = textureKey(eraId, 'sidewalk');
  const cached = textureCache.get(key);
  if (cached) return cached;
  const seed = hashString(eraId + 'sidewalk');
  const rng = createPRNG(seed);
  const w = 512, h = 512;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = spec.sidewalkColor;
  ctx.fillRect(0, 0, w, h);
  const panelSize = Math.round(spec.sidewalkSeamSpacing * 42);
  for (let y = 0; y < h; y += panelSize) {
    for (let x = 0; x < w; x += panelSize) {
      ctx.fillStyle = shadeColor(spec.sidewalkColor, rng() * 0.12 - 0.04);
      ctx.fillRect(x + 1, y + 1, panelSize - 2, panelSize - 2);
    }
  }
  ctx.strokeStyle = shadeColor(spec.sidewalkColor, -0.3);
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= w; x += panelSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += panelSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const stainCount = 15 + Math.floor(rng() * 20);
  for (let i = 0; i < stainCount; i++) {
    ctx.fillStyle = shadeColor(spec.sidewalkColor, -0.1 - rng() * 0.15);
    ctx.globalAlpha = 0.3 + rng() * 0.3;
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h, rng() * 25 + 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
  const tex = toTexture(canvas);
  textureCache.set(key, tex);
  return tex;
}