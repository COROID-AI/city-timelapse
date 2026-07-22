// ============================================================
//  Procedural Material & Texture factory
//  Generates canvas-based textures for building facades,
//  windows, signage, roads — all era-aware and re-generable.
// ============================================================
import * as THREE from 'three';
import { makeRng, pick, randInt, chance } from './util.js';

const _canvas = document.createElement('canvas');

function newCanvas(w, h) {
  const c = _canvas.cloneNode();
  c.width = w; c.height = h;
  return { c, ctx: c.getContext('2d') };
}

// shared texture cache keyed by signature
const texCache = new Map();
function cachedTexture(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const { c, ctx } = newCanvas(w, h);
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

// lighten/darken hex
function shade(hex, amt) {
  const col = new THREE.Color(hex);
  col.offsetHSL(0, 0, amt);
  return '#' + col.getHexString();
}

// ============================================================
//  BUILDING FACADE TEXTURE
//  Generates a tileable facade with a window grid.
//  Returns { map, emissive, ao } where emissive = lit windows.
// ============================================================
export function makeBuildingFacade(opts) {
  const {
    seed, baseColor, accentColor, winOn, winOff,
    cols, rows, style, eraId, litRate = 0.4,
  } = opts;

  const W = 256, H = 512;
  const { c, ctx } = newCanvas(W, H);
  const rng = makeRng(seed);

  // base wall
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, W, H);

  // subtle vertical gradient for depth
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(255,255,255,0.06)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // brick / concrete texture noise depending on style
  if (style === 'brick' || eraId <= 1965) {
    drawBrick(ctx, W, H, baseColor, rng);
  } else if (style === 'concrete' || (eraId >= 1985 && eraId <= 2005)) {
    drawConcrete(ctx, W, H, baseColor, rng);
  } else if (style === 'glass' || eraId >= 2025) {
    drawGlassPanel(ctx, W, H, baseColor, rng);
  }

  // window grid
  const pad = 10;
  const cw = (W - pad * 2) / cols;
  const rh = (H - pad * 2) / rows;
  const litMap = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = chance(rng, litRate);
      litMap[r * cols + col] = lit ? 1 : 0;
      const x = pad + col * cw;
      const y = pad + r * rh;
      drawWindow(ctx, x, y, cw, rh, lit ? winOn : winOff, style, eraId, rng);
    }
  }

  // ground-floor storefront band
  if (chance(rng, 0.7)) {
    drawStorefront(ctx, W, H, accentColor, rng, eraId);
  }

  // rooftop detail band
  drawRoofBand(ctx, W, H, accentColor, rng, eraId);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;

  // emissive map: white where lit windows are
  const eC = newCanvas(W, H);
  eC.ctx.fillStyle = '#000';
  eC.ctx.fillRect(0, 0, W, H);
  // redraw windows lit-only
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      if (!litMap[r * cols + col]) continue;
      const x = pad + col * cw;
      const y = pad + r * rh;
      drawWindow(eC.ctx, x, y, cw, rh, winOn, style, eraId, rng, true);
    }
  }
  const emissive = new THREE.CanvasTexture(eC.c);
  emissive.colorSpace = THREE.SRGBColorSpace;
  emissive.wrapS = THREE.RepeatWrapping;
  emissive.wrapT = THREE.RepeatWrapping;
  emissive.anisotropy = 4;

  return { map, emissive };
}

function drawBrick(ctx, W, H, base, rng) {
  const bh = 12, bw = 28;
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += bh) {
    const offset = (Math.floor(y / bh) % 2) * (bw / 2);
    for (let x = -bw; x < W + bw; x += bw) {
      ctx.strokeRect(x + offset, y, bw, bh);
      if (chance(rng, 0.15)) {
        ctx.fillStyle = shade(base, (rng() - 0.5) * 0.08);
        ctx.fillRect(x + offset, y, bw, bh);
      }
    }
  }
}

function drawConcrete(ctx, W, H, base, rng) {
  // large concrete pours with seams
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1.5;
  for (let y = 0; y < H; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = shade(base, (rng() - 0.5) * 0.06);
    const x = rng() * W, y = rng() * H, s = 8 + rng() * 30;
    ctx.fillRect(x, y, s, s);
  }
}

function drawGlassPanel(ctx, W, H, base, rng) {
  // sleek glass curtain wall — vertical mullions
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 16) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  // reflective streaks
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(180,220,255,${0.04 + rng() * 0.06})`;
    ctx.fillRect(rng() * W, rng() * H, 4 + rng() * 8, 20 + rng() * 60);
  }
}

function drawWindow(ctx, x, y, w, h, color, style, eraId, rng, emissiveOnly = false) {
  const m = 2; // margin (frame)
  if (style === 'glass' || eraId >= 2025) {
    // full glazing, thin frame
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    if (!emissiveOnly) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 1, y + 1, w - 2, (h - 2) * 0.3);
    }
  } else if (eraId <= 1965) {
    // sash windows with cross frame
    ctx.fillStyle = shade(color, -0.05);
    ctx.fillRect(x + m, y + m, w - m * 2, h - m * 2);
    ctx.fillStyle = color;
    const iw = w - m * 2 - 4, ih = h - m * 2 - 4;
    ctx.fillRect(x + m + 2, y + m + 2, iw, ih);
    if (!emissiveOnly) {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + m); ctx.lineTo(x + w / 2, y + h - m);
      ctx.moveTo(x + m, y + h / 2); ctx.lineTo(x + w - m, y + h / 2);
      ctx.stroke();
    }
  } else {
    // standard framed ribbon windows
    ctx.fillStyle = shade(color, -0.08);
    ctx.fillRect(x + m, y + m, w - m * 2, h - m * 2);
    ctx.fillStyle = color;
    ctx.fillRect(x + m + 1.5, y + m + 1.5, w - m * 2 - 3, h - m * 2 - 3);
    if (!emissiveOnly && chance(rng, 0.3)) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(x + m + 1.5, y + m + 1.5, (w - m * 2 - 3) * 0.4, h - m * 2 - 3);
    }
  }
}

const SIGN_WORDS = {
  1945: ['DINER', 'CAFÉ', 'HOTEL', 'BAKERY', '5¢', 'DRUGS', 'BARBER'],
  1965: ['MOTEL', 'GAS', 'DINER', 'GO-GO', 'AUTO', 'DRIVE-IN', 'JUKEBOX'],
  1985: ['ARCADE', 'NEON', 'CLUB', 'VIDEO', 'CYBER', 'NEON CITY', 'PIXEL'],
  2005: ['CAFE', 'WIFI', 'iTECH', 'DIGITAL', '24/7', 'MART', 'GAMES'],
  2025: ['NEXUS', 'SYNC', 'ECHO', 'FLUX', 'VAULT', 'PULSE', 'AURA'],
  2055: ['QUANTUM', 'AETHER', 'BIO', 'NEXUS-9', 'GENESIS', 'HUB', 'FLUX//2'],
};

function drawStorefront(ctx, W, H, accent, rng, eraId) {
  const bandH = 36;
  const y = H - bandH;
  // awning
  ctx.fillStyle = shade(accent, -0.05);
  ctx.fillRect(0, y, W, bandH);
  // stripes
  ctx.fillStyle = shade(accent, 0.12);
  for (let x = 0; x < W; x += 16) {
    if ((x / 16) % 2 === 0) ctx.fillRect(x, y, 8, bandH);
  }
  // sign text
  if (eraId >= 1965) {
    ctx.fillStyle = eraId === 1985 ? '#000' : 'rgba(0,0,0,0.5)';
    ctx.font = `bold ${eraId >= 2025 ? 16 : 13}px monospace`;
    ctx.textAlign = 'center';
    const word = pick(rng, SIGN_WORDS[eraId] || SIGN_WORDS[2025]);
    ctx.fillText(word, W / 2, y + bandH / 2 + 5);
  } else {
    // painted sign for 1945
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.font = 'bold 13px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText(pick(rng, SIGN_WORDS[1945]), W / 2, y + bandH / 2 + 5);
  }
  ctx.textAlign = 'left';
}

function drawRoofBand(ctx, W, H, accent, rng, eraId) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, W, 14);
  if (eraId >= 1985 && chance(rng, 0.5)) {
    // rooftop sign
    ctx.fillStyle = accent;
    ctx.fillRect(W * 0.3, 2, W * 0.4, 8);
  }
}

// ============================================================
//  ROAD TEXTURE (asphalt + lane markings)
// ============================================================
export function makeRoadTexture(eraId, length = 1) {
  return cachedTexture(`road_${eraId}`, 256, 256, (ctx, W, H) => {
    const asphalt = eraId === 1945 ? '#3a3328' : eraId === 2055 ? '#14181e' : '#23262c';
    ctx.fillStyle = asphalt;
    ctx.fillRect(0, 0, W, H);
    // noise
    const rng = makeRng(eraId * 7);
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = `rgba(${rng() * 60},${rng() * 60},${rng() * 60},${0.15})`;
      ctx.fillRect(rng() * W, rng() * H, 2, 2);
    }
    // cracks for older eras
    if (eraId <= 1985) {
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        let x = rng() * W, y = rng() * H;
        ctx.moveTo(x, y);
        for (let s = 0; s < 5; s++) { x += (rng() - 0.5) * 40; y += (rng() - 0.5) * 40; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }
    // center line (dashed yellow)
    if (eraId >= 1965) {
      ctx.fillStyle = 'rgba(220,180,60,0.85)';
      for (let y = 8; y < H; y += 48) ctx.fillRect(W / 2 - 2, y, 4, 28);
    }
    // future: glowing lane guides
    if (eraId >= 2055) {
      ctx.fillStyle = 'rgba(58,255,170,0.5)';
      ctx.fillRect(8, 0, 3, H);
      ctx.fillRect(W - 11, 0, 3, H);
    }
  });
}

// ============================================================
//  SIDEWALK TEXTURE
// ============================================================
export function makeSidewalkTexture(eraId) {
  return cachedTexture(`sw_${eraId}`, 256, 256, (ctx, W, H) => {
    const sw = eraId === 1945 ? '#8a7d62' : eraId === 2055 ? '#5a6570' : '#7a8088';
    ctx.fillStyle = sw;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    for (let y = 0; y < H; y += 32) {
      for (let x = 0; x < W; x += 32) {
        const ox = (Math.floor(y / 32) % 2) * 16;
        ctx.strokeRect(x + ox, y, 32, 32);
      }
    }
    const rng = makeRng(eraId * 13);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rng() * 0.15})`;
      ctx.fillRect(rng() * W, rng() * H, 2 + rng() * 3, 1);
    }
  });
}

// ============================================================
//  NEON SIGN SPRITE TEXTURE (for glowing signs)
// ============================================================
export function makeNeonSign(text, color, seed = 1) {
  const W = 256, H = 64;
  const { c, ctx } = newCanvas(W, H);
  ctx.clearRect(0, 0, W, H);
  ctx.font = 'bold 40px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // glow layers
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, H / 2);
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#fff';
  ctx.fillText(text, W / 2, H / 2);
  ctx.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================
//  GROUND / LOT BASE TEXTURE
// ============================================================
export function makeGroundTexture(eraId) {
  return cachedTexture(`ground_${eraId}`, 256, 256, (ctx, W, H) => {
    ctx.fillStyle = eraId === 1945 ? '#6b5e44' : eraId === 2055 ? '#2a3540' : '#4a4f58';
    ctx.fillRect(0, 0, W, H);
    const rng = makeRng(eraId * 3);
    for (let i = 0; i < 800; i++) {
      ctx.fillStyle = `rgba(${rng() * 50},${rng() * 50},${rng() * 50},0.2)`;
      ctx.fillRect(rng() * W, rng() * H, 1 + rng() * 2, 1 + rng() * 2);
    }
  });
}

export { shade };
