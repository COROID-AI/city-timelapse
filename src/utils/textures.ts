import * as THREE from 'three';

// ============================================================================
// Procedural texture + canvas helpers. Everything generated at runtime so the
// app runs fully offline with no external image/audio requests (no 404s).
// ============================================================================

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

function addNoise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, dark: boolean): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = clamp255(d[i] + n);
    d[i + 1] = clamp255(d[i + 1] + n);
    d[i + 2] = clamp255(d[i + 2] + n);
    if (dark) d[i] = Math.max(0, d[i] - amount * 0.3);
  }
  ctx.putImageData(img, 0, 0);
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function pseudoRand(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export function shadeHex(hex: string, factor: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  return `#${c.getHexString()}`;
}

// ---------------------------------------------------------------------------
// Window / facade texture. Style varies by era.
// ---------------------------------------------------------------------------
export interface FacadeResult {
  map: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture;
  aspect: number;
}

export interface FacadeOpts {
  style: string;
  baseColor: string;
  trimColor: string;
  windowColor: string;
  windowEmissive: string;
  emissiveInt: number;
  accent: string;
  cols: number;
  rows: number;
  litChance: number;
  seed: number;
}

export function makeFacade(opts: FacadeOpts): FacadeResult {
  const W = 512;
  const H = 512;
  const { canvas, ctx } = makeCanvas(W, H);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, shadeHex(opts.baseColor, 1.08));
  grad.addColorStop(1, shadeHex(opts.baseColor, 0.92));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const seed = opts.seed;
  const lit: boolean[] = [];

  if (opts.style === 'ribbon') {
    const bandH = H / opts.rows;
    for (let r = 0; r < opts.rows; r++) {
      const y = r * bandH;
      ctx.fillStyle = shadeHex(opts.baseColor, 0.8);
      ctx.fillRect(0, y, W, bandH * 0.45);
      const wy = y + bandH * 0.5;
      const wh = bandH * 0.38;
      ctx.fillStyle = opts.windowColor;
      ctx.fillRect(0, wy, W, wh);
      ctx.fillStyle = shadeHex(opts.trimColor, 0.85);
      const mull = W / Math.max(opts.cols, 4);
      for (let mx = mull; mx < W; mx += mull) {
        ctx.fillRect(mx - 1.5, wy, 3, wh);
      }
      for (let c = 0; c < opts.cols; c++) lit.push(pseudoRand(seed + r * 17 + c) < opts.litChance);
    }
  } else if (opts.style === 'curtain') {
    const cellW = W / opts.cols;
    const cellH = H / opts.rows;
    for (let r = 0; r < opts.rows; r++) {
      for (let c = 0; c < opts.cols; c++) {
        const x = c * cellW;
        const y = r * cellH;
        const g = ctx.createLinearGradient(x, y, x + cellW, y + cellH);
        g.addColorStop(0, shadeHex(opts.windowColor, 1.5));
        g.addColorStop(0.5, opts.windowColor);
        g.addColorStop(1, shadeHex(opts.windowColor, 0.6));
        ctx.fillStyle = g;
        ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);
        lit.push(pseudoRand(seed + r * 31 + c) < opts.litChance);
      }
    }
    ctx.strokeStyle = shadeHex(opts.trimColor, 0.9);
    ctx.lineWidth = 4;
    for (let c = 0; c <= opts.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, H);
      ctx.stroke();
    }
    for (let r = 0; r <= opts.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(W, r * cellH);
      ctx.stroke();
    }
  } else if (opts.style === 'panel') {
    const cellW = W / opts.cols;
    const cellH = H / opts.rows;
    for (let r = 0; r < opts.rows; r++) {
      for (let c = 0; c < opts.cols; c++) {
        const x = c * cellW;
        const y = r * cellH;
        ctx.fillStyle = shadeHex(opts.baseColor, 0.95 + (pseudoRand(seed + r + c) - 0.5) * 0.1);
        ctx.fillRect(x, y, cellW, cellH);
        const ww = cellW * 0.5;
        const wh = cellH * 0.55;
        const wx = x + (cellW - ww) / 2;
        const wy = y + (cellH - wh) / 2;
        ctx.fillStyle = opts.windowColor;
        ctx.fillRect(wx, wy, ww, wh);
        lit.push(pseudoRand(seed + r * 41 + c) < opts.litChance);
      }
    }
    ctx.strokeStyle = shadeHex(opts.baseColor, 0.75);
    ctx.lineWidth = 2;
    for (let c = 0; c <= opts.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, H);
      ctx.stroke();
    }
  } else if (opts.style === 'holographic') {
    ctx.fillStyle = '#06090e';
    ctx.fillRect(0, 0, W, H);
    const cellW = W / opts.cols;
    const cellH = H / opts.rows;
    for (let r = 0; r < opts.rows; r++) {
      for (let c = 0; c < opts.cols; c++) {
        const x = c * cellW;
        const y = r * cellH;
        const g = ctx.createRadialGradient(x + cellW / 2, y + cellH / 2, 2, x + cellW / 2, y + cellH / 2, cellW);
        g.addColorStop(0, shadeHex(opts.accent, 1.2));
        g.addColorStop(0.4, shadeHex(opts.accent, 0.4));
        g.addColorStop(1, '#06090e');
        ctx.fillStyle = g;
        ctx.fillRect(x + 3, y + 3, cellW - 6, cellH - 6);
        lit.push(true);
      }
    }
    ctx.strokeStyle = shadeHex(opts.accent, 1.3);
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      let px = pseudoRand(seed + i) * W;
      let py = pseudoRand(seed + i + 99) * H;
      ctx.moveTo(px, py);
      for (let s = 0; s < 4; s++) {
        if (pseudoRand(seed + i + s) > 0.5) px += (pseudoRand(seed + i + s * 3) - 0.5) * 120;
        else py += (pseudoRand(seed + i + s * 5) - 0.5) * 120;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    // grid (1945 brick)
    addBrick(ctx, W, H, opts.baseColor);
    const cellW = W / opts.cols;
    const cellH = H / opts.rows;
    for (let r = 0; r < opts.rows; r++) {
      for (let c = 0; c < opts.cols; c++) {
        const x = c * cellW;
        const y = r * cellH;
        const ww = cellW * 0.55;
        const wh = cellH * 0.5;
        const wx = x + (cellW - ww) / 2;
        const wy = y + (cellH - wh) / 2;
        ctx.fillStyle = opts.trimColor;
        ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
        ctx.fillStyle = opts.windowColor;
        ctx.fillRect(wx, wy, ww, wh);
        ctx.strokeStyle = opts.trimColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wx + ww / 2, wy);
        ctx.lineTo(wx + ww / 2, wy + wh);
        ctx.moveTo(wx, wy + wh / 2);
        ctx.lineTo(wx + ww, wy + wh / 2);
        ctx.stroke();
        lit.push(pseudoRand(seed + r * 13 + c) < opts.litChance);
      }
    }
  }

  addNoise(ctx, W, H, 14, opts.style === 'grid');

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;

  const { canvas: eCanvas, ctx: eCtx } = makeCanvas(W, H);
  eCtx.fillStyle = '#000';
  eCtx.fillRect(0, 0, W, H);
  drawLitWindows(eCtx, opts.style, opts.rows, opts.cols, lit, opts.windowEmissive, opts.emissiveInt, opts.accent);
  const emissive = new THREE.CanvasTexture(eCanvas);
  emissive.colorSpace = THREE.SRGBColorSpace;
  emissive.wrapS = THREE.RepeatWrapping;
  emissive.wrapT = THREE.RepeatWrapping;

  return { map, emissive, aspect: 1 };
}

function drawLitWindows(
  ctx: CanvasRenderingContext2D,
  style: string,
  rows: number,
  cols: number,
  lit: boolean[],
  color: string,
  intensity: number,
  accent: string,
): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.globalAlpha = Math.min(1, intensity * 1.6);
  const idx = (r: number, c: number) => r * cols + c;
  if (style === 'ribbon') {
    const bandH = H / rows;
    for (let r = 0; r < rows; r++) {
      let anyLit = false;
      for (let c = 0; c < cols; c++) {
        if (lit[idx(r, c)]) {
          anyLit = true;
          break;
        }
      }
      if (anyLit) {
        ctx.fillStyle = color;
        ctx.fillRect(0, r * bandH + bandH * 0.5, W, bandH * 0.38);
      }
    }
  } else if (style === 'curtain') {
    const cellW = W / cols;
    const cellH = H / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (lit[idx(r, c)]) {
          ctx.fillStyle = color;
          ctx.fillRect(c * cellW + 2, r * cellH + 2, cellW - 4, cellH - 4);
        }
      }
    }
  } else if (style !== 'holographic') {
    const cellW = W / cols;
    const cellH = H / rows;
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (lit[i]) {
          const ww = cellW * 0.55;
          const wh = cellH * 0.5;
          ctx.fillStyle = color;
          ctx.fillRect(c * cellW + (cellW - ww) / 2, r * cellH + (cellH - wh) / 2, ww, wh);
        }
        i++;
      }
    }
  } else {
    ctx.fillStyle = accent;
    ctx.globalAlpha = intensity * 0.5;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 1;
}

function addBrick(ctx: CanvasRenderingContext2D, w: number, h: number, color: string): void {
  const bw = 32;
  const bh = 16;
  for (let y = 0; y < h; y += bh) {
    const offset = (Math.floor(y / bh) % 2) * (bw / 2);
    for (let x = -bw; x < w; x += bw) {
      const v = pseudoRand(x * 7 + y * 13) * 0.25;
      ctx.fillStyle = shadeHex(color, 0.9 + v);
      ctx.fillRect(x + offset, y, bw - 1.5, bh - 1.5);
    }
  }
}

// ---------------------------------------------------------------------------
export function makeRoad(color: string, laneColor: string): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  addNoise(ctx, W, H, 18, true);
  ctx.fillStyle = laneColor;
  ctx.fillRect(W / 2 - 3, 10, 6, 80);
  ctx.fillRect(W / 2 - 3, 150, 6, 80);
  ctx.globalAlpha = 0.6;
  ctx.fillRect(24, 0, 4, H);
  ctx.fillRect(W - 28, 0, 4, H);
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// ---------------------------------------------------------------------------
export function makeSidewalk(color: string): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  addNoise(ctx, W, H, 10, false);
  ctx.strokeStyle = shadeHex(color, 0.75);
  ctx.lineWidth = 2;
  const tile = 64;
  for (let x = 0; x <= W; x += tile) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += tile) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = shadeHex(color, 0.6);
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    let px = pseudoRand(i) * W;
    let py = pseudoRand(i + 50) * H;
    ctx.moveTo(px, py);
    for (let s = 0; s < 5; s++) {
      px += (pseudoRand(i + s) - 0.5) * 40;
      py += (pseudoRand(i + s + 30) - 0.5) * 40;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// ---------------------------------------------------------------------------
export function makeGrass(): THREE.CanvasTexture {
  const W = 128;
  const H = 128;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#3a6a3a';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2000; i++) {
    const x = pseudoRand(i) * W;
    const y = pseudoRand(i + 999) * H;
    const g = pseudoRand(i + 333);
    ctx.fillStyle = shadeHex('#3a6a3a', 0.7 + g * 0.7);
    ctx.fillRect(x, y, 2, 2 + pseudoRand(i + 7) * 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ---------------------------------------------------------------------------
export interface SignOpts {
  text: string;
  sub?: string;
  bg: string;
  fg: string;
  font: string;
  style: string;
  width: number;
  height: number;
  vertical?: boolean;
}

export function makeSign(opts: SignOpts): THREE.CanvasTexture {
  const W = Math.round(opts.width);
  const H = Math.round(opts.height);
  const { canvas, ctx } = makeCanvas(W, H);

  if (opts.style === 'neon' || opts.style === 'holographic') {
    ctx.fillStyle = '#080406';
  } else {
    ctx.fillStyle = opts.bg;
  }
  ctx.fillRect(0, 0, W, H);

  if (opts.style === 'digital') {
    ctx.fillStyle = shadeHex(opts.bg, 1.3);
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.08;
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, y, W, 1);
    }
    ctx.globalAlpha = 1;
  }

  if (opts.style === 'holographic') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, shadeHex(opts.bg, 1.2));
    g.addColorStop(0.5, opts.bg);
    g.addColorStop(1, shadeHex(opts.bg, 0.7));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = opts.fg;
    for (let i = 0; i < 30; i++) {
      ctx.fillRect(0, (i / 30) * H, W, 1);
    }
    ctx.globalAlpha = 1;
  }

  const txt = opts.text.toUpperCase();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const font = opts.font;

  if (opts.style === 'neon') {
    ctx.font = `bold ${Math.round(H * 0.4)}px ${font}`;
    ctx.shadowColor = opts.fg;
    ctx.shadowBlur = 24;
    ctx.fillStyle = opts.fg;
    ctx.fillText(txt, W / 2, H / 2);
    ctx.shadowBlur = 8;
    ctx.fillText(txt, W / 2, H / 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(txt, W / 2, H / 2);
    ctx.shadowBlur = 0;
  } else {
    const mainSize = opts.vertical ? Math.round(H * 0.16) : Math.round(H * 0.42);
    ctx.font = `bold ${mainSize}px ${font}`;
    ctx.fillStyle = opts.fg;
    if (opts.style === 'holographic') {
      ctx.shadowColor = opts.fg;
      ctx.shadowBlur = 18;
    }
    ctx.fillText(txt, W / 2, opts.sub ? H * 0.42 : H / 2);
    if (opts.sub) {
      ctx.shadowBlur = opts.style === 'holographic' ? 10 : 0;
      ctx.font = `${Math.round(H * 0.18)}px ${font}`;
      ctx.fillText(opts.sub.toUpperCase(), W / 2, H * 0.72);
    }
    ctx.shadowBlur = 0;
  }

  addNoise(ctx, W, H, 6, false);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---------------------------------------------------------------------------
export function makeStarSprite(): THREE.CanvasTexture {
  const S = 64;
  const { canvas, ctx } = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
export function makeGlowSprite(color: string): THREE.CanvasTexture {
  const S = 64;
  const { canvas, ctx } = makeCanvas(S, S);
  const c = new THREE.Color(color);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},1)`);
  g.addColorStop(0.4, `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},0.5)`);
  g.addColorStop(1, `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
