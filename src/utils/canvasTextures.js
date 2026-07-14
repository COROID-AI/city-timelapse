import * as THREE from 'three';

// Procedural canvas textures. Everything is drawn into a single reusable
// <canvas> so we never touch the DOM and create no extra elements.

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function toTexture(canvas, { srgb = true, repeat = [1, 1] } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function addNoise(ctx, w, h, amount) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// A single window bay (square tile). Tiled across a face to make a facade.
export function makeFacade(style, opts) {
  const S = 128;
  const cv = makeCanvas(S);
  const ctx = cv.getContext('2d');
  const {
    wall, wall2 = wall, window: win, frame, neon,
  } = opts;

  // Base wall
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, S, S);

  const pad = S * 0.16;
  const wx = pad, wy = pad, ww = S - pad * 2, wh = S - pad * 2;

  if (style === 'brick') {
    ctx.fillStyle = wall2;
    const bh = 14, bw = 30;
    for (let y = 0; y < S; y += bh) {
      const off = (Math.floor(y / bh) % 2) * (bw / 2);
      for (let x = -bw; x < S; x += bw) {
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.strokeRect(x + off + 1, y + 1, bw - 2, bh - 2);
      }
    }
    addNoise(ctx, S, S, 18);
  } else if (style === 'concrete') {
    // horizontal slab banding
    for (let y = 0; y < S; y += 18) {
      ctx.fillStyle = (Math.floor(y / 18) % 2) ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, y, S, 18);
    }
    addNoise(ctx, S, S, 14);
  } else if (style === 'glass80s') {
    // dark reflective wall with mirror tint
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, wall2);
    g.addColorStop(1, wall);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  } else if (style === 'glassModern') {
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, wall2);
    g.addColorStop(1, wall);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  } else if (style === 'mixed') {
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, wall2);
    g.addColorStop(1, wall);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    addNoise(ctx, S, S, 10);
  } else if (style === 'future') {
    ctx.fillStyle = wall2;
    ctx.fillRect(0, 0, S, S);
    // vertical seam lines
    ctx.strokeStyle = 'rgba(120,240,255,0.10)';
    ctx.lineWidth = 1;
    for (let x = 0; x < S; x += 16) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
    }
    addNoise(ctx, S, S, 8);
  }

  // Window glass pane
  ctx.fillStyle = frame;
  ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
  ctx.fillStyle = win;
  ctx.fillRect(wx, wy, ww, wh);

  // Window mullion detail
  if (style === 'glass80s' || style === 'glassModern' || style === 'mixed') {
    ctx.strokeStyle = frame;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
    ctx.stroke();
    // glass reflection streak
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + ww * 0.4, wy);
    ctx.lineTo(wx, wy + wh * 0.4);
    ctx.closePath();
    ctx.fill();
  }
  if (style === 'brick') {
    // multi-pane classic window
    ctx.strokeStyle = frame;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.stroke();
  }

  const map = toTexture(cv, { srgb: true, repeat: [1, 1] });

  // Emissive map (glowing windows) for neon eras.
  let emissive = null;
  if (neon) {
    const ec = makeCanvas(S);
    const ex = ec.getContext('2d');
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, S, S);
    // randomly lit windows across the tile (a few)
    const litColor = Array.isArray(neon.colors) ? neon.colors : [neon.color];
    const cols = 2, rows = 2;
    for (let r = 0; r < rows; r++) {
      for (let cxx = 0; cxx < cols; cxx++) {
        if (Math.random() < 0.6) {
          ex.fillStyle = litColor[Math.floor(Math.random() * litColor.length)];
          const bx = wx + (cxx / cols) * ww + 4;
          const by = wy + (r / rows) * wh + 4;
          const bw = ww / cols - 8;
          const bh = wh / rows - 8;
          ex.fillRect(bx, by, bw, bh);
        }
      }
    }
    emissive = toTexture(ec, { srgb: true, repeat: [1, 1] });
  }

  return { map, emissive };
}

export function makeRoof(color) {
  const S = 128;
  const cv = makeCanvas(S);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, S, S);
  // tar/gravel texture
  addNoise(ctx, S, S, 22);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.strokeRect(Math.random() * S, Math.random() * S, Math.random() * 40, Math.random() * 40);
  }
  return toTexture(cv, { srgb: true });
}

export function makeAsphalt(lineColor) {
  const S = 256;
  const cv = makeCanvas(S);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#23262b';
  ctx.fillRect(0, 0, S, S);
  addNoise(ctx, S, S, 24);
  return toTexture(cv, { srgb: true });
}

export function makeSidewalk() {
  const S = 128;
  const cv = makeCanvas(S);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#9a9690';
  ctx.fillRect(0, 0, S, S);
  addNoise(ctx, S, S, 16);
  // expansion joints
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, S - 2, S - 2);
  ctx.beginPath();
  ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S);
  ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2);
  ctx.stroke();
  return toTexture(cv, { srgb: true });
}

export function makeGround(color) {
  const S = 128;
  const cv = makeCanvas(S);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = color || '#3a372f';
  ctx.fillRect(0, 0, S, S);
  addNoise(ctx, S, S, 18);
  return toTexture(cv, { srgb: true });
}

// A glowing sign/billboard texture (text + shapes) for ads & storefronts.
export function makeSign(text, fg, bg, opts = {}) {
  const W = 256, H = 128;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = fg;
  if (opts.holo) {
    ctx.globalAlpha = 0.85;
  }
  ctx.font = `bold ${opts.big ? 78 : 54}px "Arial Black", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2 + (opts.sub ? -14 : 0));
  if (opts.sub) {
    ctx.font = '24px Arial, sans-serif';
    ctx.fillText(opts.sub, W / 2, H / 2 + 34);
  }
  // border
  ctx.globalAlpha = 1;
  ctx.strokeStyle = opts.glow ? fg : 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { texture: tex, aspect: W / H };
}
