// Procedural canvas texture helpers — every texture in the scene is
// generated at runtime; no external image assets are loaded.

import * as THREE from 'three';
import { mulberry32 } from './rand';

export interface TextLine {
  text: string;
  fontSize: number;
  color: string;
  y?: number;
  bold?: boolean;
}

function makeCanvas(
  w: number,
  h: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return [canvas, ctx];
}

function finalizeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeTextTexture(
  lines: TextLine[],
  bg: string,
  w = 512,
  h = 256,
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const totalH = lines.reduce((s, l) => s + l.fontSize, 0);
  let y = (h - totalH) / 2;
  for (const l of lines) {
    ctx.fillStyle = l.color;
    ctx.font = `${l.bold ? 'bold ' : ''}${l.fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lineY = y + l.fontSize / 2;
    ctx.fillText(l.text, w / 2, lineY);
    y += l.fontSize;
  }
  return finalizeTexture(canvas);
}

export interface WindowGridTexturePair {
  map: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture;
}

export function makeWindowGrid(
  facade: string,
  windowColor: string,
  rows: number,
  cols: number,
  litRatio: number,
): WindowGridTexturePair {
  const w = 256;
  const h = 256;
  const [canvasMap, ctxMap] = makeCanvas(w, h);
  const [canvasEm, ctxEm] = makeCanvas(w, h);
  ctxMap.fillStyle = facade;
  ctxMap.fillRect(0, 0, w, h);
  ctxEm.fillStyle = '#000000';
  ctxEm.fillRect(0, 0, w, h);

  const cw = w / cols;
  const ch = h / rows;
  const rand = mulberry32(hashString(facade + windowColor) + 17);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rand() < litRatio;
      const px = c * cw + cw * 0.1;
      const pw = cw * 0.8;
      const py = r * ch + ch * 0.1;
      const ph = ch * 0.8;
      ctxMap.fillStyle = lit ? windowColor : '#0e0e12';
      ctxEm.fillStyle = lit ? '#ffffff' : '#030304';
      ctxMap.fillRect(px, py, pw, ph);
      ctxEm.fillRect(px, py, pw, ph);
    }
  }
  return {
    map: finalizeTexture(canvasMap),
    emissive: finalizeTexture(canvasEm),
  };
}

export function makeNoiseTexture(seed = 1, w = 256, h = 256): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  const rand = mulberry32(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}