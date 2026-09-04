/**
 * Shared procedural geometry, material and texture helpers used by every
 * scene module. All content is generated in code — no external assets.
 */
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Euler,
  Group,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { EraId, ERA_IDS } from './eras';
import { blendHex, hexToRgb } from './state';

/** Convert a hex color into a THREE.Color. */
export function colorFromHex(hex: string): Color {
  return new Color(hex);
}

/** Blend two hex colors into a THREE.Color. */
export function colorBlend(a: string, b: string, t: number): Color {
  return new Color(blendHex(a, b, t));
}

/** Create a MeshStandardMaterial with a hex color. */
export function matColor(hex: string): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: colorFromHex(hex) });
}

/** Create a Mesh with a hex-colored material. */
export function meshColor(geometry: BufferGeometryLike, hex: string): Mesh {
  return new Mesh(geometry, matColor(hex));
}

type BufferGeometryLike = ConstructorParameters<typeof Mesh>[0];

/**
 * Build a procedural window-grid texture on a canvas and return it as a
 * CanvasTexture. The grid is drawn once per era palette; the scene can
 * re-tint it by swapping the material color at runtime.
 */
export function makeWindowTexture(
  cols: number,
  rows: number,
  glassHex: string,
  emissiveHex: string,
  intensity: number,
): CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) {
    throw new Error('2D canvas context unavailable');
  }
  g.fillStyle = '#0a0a0a';
  g.fillRect(0, 0, w, h);
  const [er, eg, eb] = hexToRgb(emissiveHex);
  const cellW = w / cols;
  const cellH = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + cellW * 0.12;
      const y = r * cellH + cellH * 0.12;
      const cw = cellW * 0.76;
      const ch = cellH * 0.76;
      const grad = g.createLinearGradient(x, y, x + cw, y + ch);
      const base = Math.round(intensity * 255);
      grad.addColorStop(0, `rgba(${er},${eg},${eb},${base})`);
      grad.addColorStop(0.55, `rgba(${Math.round(er * 0.7)},${Math.round(eg * 0.7)},${Math.round(eb * 0.7)},${Math.round(base * 0.7)})`);
      grad.addColorStop(1, `rgba(${Math.round(er * 0.4)},${Math.round(eg * 0.4)},${Math.round(eb * 0.4)},${Math.round(base * 0.4)})`);
      g.fillStyle = grad;
      g.fillRect(x, y, cw, ch);
    }
  }
  // Frame lines.
  g.strokeStyle = '#3a3a3a';
  g.lineWidth = 2;
  for (let c = 1; c < cols; c++) {
    g.beginPath();
    g.moveTo(c * cellW, 0);
    g.lineTo(c * cellW, h);
    g.stroke();
  }
  for (let r = 1; r < rows; r++) {
    g.beginPath();
    g.moveTo(0, r * cellH);
    g.lineTo(w, r * cellH);
    g.stroke();
  }
  return new CanvasTexture(canvas);
}

/**
 * Draw a storefront / billboard sign with era text onto a canvas and return
 * a CanvasTexture. Text is chosen per era from the palette.
 */
export function makeSignTexture(
  text: string,
  fgHex: string,
  bgHex: string,
  width = 256,
  height = 128,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  if (!g) {
    throw new Error('2D canvas context unavailable');
  }
  g.fillStyle = bgHex;
  g.fillRect(0, 0, width, height);
  g.fillStyle = fgHex;
  g.font = `bold ${Math.floor(height * 0.42)}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, width / 2, height / 2);
  return new CanvasTexture(canvas);
}

/** Create a plane mesh with a canvas texture (billboards, storefronts). */
export function makeTexturedPlane(
  texture: CanvasTexture,
  width: number,
  height: number,
  emissive = false,
): { mesh: Mesh; material: MeshStandardMaterial } {
  const geometry = new PlaneGeometry(width, height);
  const material = new MeshStandardMaterial({ map: texture });
  const mesh = new Mesh(geometry, material);
  mesh.rotation.z = Math.PI; // face +Z
  return { mesh, material };
}

/** Build a shared InstancedMesh for repeated box geometry (windows etc.). */
export function makeBoxInstanced(
  geometry: BoxGeometry,
  material: MeshStandardMaterial,
  count: number,
): InstancedMesh {
  return new InstancedMesh(geometry, material, count);
}

/** Build the shared road plane geometry once. */
export function makeRoadGeometry(width: number, depth: number): PlaneGeometry {
  return new PlaneGeometry(width, depth);
}

/** Build the shared sidewalk plane geometry once. */
export function makeSidewalkGeometry(width: number, depth: number): PlaneGeometry {
  return new PlaneGeometry(width, depth);
}

/** Build a shared sphere geometry for lamps / sun. */
export function makeSphere(radius: number, segments = 12, rings = 8): SphereGeometry {
  return new SphereGeometry(radius, segments, rings);
}

/** Build a shared box geometry for buildings / props. */
export function makeBox(width: number, height: number, depth: number): BoxGeometry {
  return new BoxGeometry(width, height, depth);
}

/** Deterministic pseudo-random generator (mulberry32) for stable scene layout. */
export class Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed & 0xffffffff;
  }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) & 0xffffffff;
    let t = this.state;
    t = Math.imul(t, t ^ 0x47995141);
    t ^= t >>> 15;
    t = Math.imul(t, t ^ 0x94d049bb);
    t ^= t >>> 13;
    return (t & 0xffffffff) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}

/** Clamp helper re-exported for scene modules. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Linear interpolation re-exported. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map an era float to the nearest era id (for discrete swaps). */
export function eraIdAt(eraFloat: number): EraId {
  const idx = Math.max(0, Math.min(ERA_IDS.length - 1, Math.round(eraFloat)));
  return ERA_IDS[idx];
}

/** Colorize a material from two era palettes by blend t. */
export function tintMaterial(material: MeshStandardMaterial, a: string, b: string, t: number): void {
  material.color.copy(colorBlend(a, b, t));
}

/** Create a THREE color from a hex string. */
export function hexColor(hex: string): Color {
  return new Color(hex);
}

/** Build a Vector3 at (x,y,z). */
export function vec3(x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z);
}

/** Build an Euler rotation. */
export function euler(x: number, y: number, z: number): Euler {
  return new Euler(x, y, z);
}