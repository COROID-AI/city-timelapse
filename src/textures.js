import * as THREE from 'three';

// ---- canvas helpers ----
function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function texFromCanvas(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// style -> geometry descriptor for window walls
function styleDesc(style) {
  switch (style) {
    case 'concrete': return { cols: 6, rows: 6, litProb: 0.34, litColor: '#ffe6b0', layout: 'ribbon' };
    case 'glass':    return { cols: 5, rows: 8, litProb: 0.42, litColor: '#dceaff', layout: 'pane' };
    case 'curtain':  return { cols: 6, rows: 10, litProb: 0.3, litColor: '#cfe2ff', layout: 'pane' };
    case 'modern':   return { cols: 4, rows: 8, litProb: 0.26, litColor: '#eaf2ff', layout: 'panel' };
    case 'cyber':    return { cols: 4, rows: 10, litProb: 0.62, litColor: '#00e5ff', layout: 'strip' };
    case 'brick':
    default:         return { cols: 5, rows: 6, litProb: 0.4, litColor: '#ffce82', layout: 'mullion' };
  }
}

function drawWallBase(ctx, era, style, W, H, rnd, variant) {
  const palette = era.building.palette;
  const base = palette[variant % palette.length];
  if (style === 'brick') {
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    const courses = 14;
    const ch = H / courses;
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.2;
    for (let i = 0; i <= courses; i++) {
      const y = i * ch;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      const off = (i % 2) ? ch : 0;
      for (let x = -ch + off; x < W; x += ch * 2) {
        ctx.beginPath(); ctx.moveTo(x + ch, y); ctx.lineTo(x + ch, y + ch); ctx.stroke();
      }
    }
    // subtle grime
    ctx.fillStyle = 'rgba(40,28,16,0.10)'; ctx.fillRect(0, 0, W, H);
  } else if (style === 'concrete') {
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, (H / 6) * i); ctx.lineTo(W, (H / 6) * i); ctx.stroke(); }
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo((W / 4) * i, 0); ctx.lineTo((W / 4) * i, H); ctx.stroke(); }
  } else if (style === 'glass' || style === 'curtain') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, base); g.addColorStop(0.5, palette[(variant + 1) % palette.length]); g.addColorStop(1, base);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // glass sheen
    const sg = ctx.createLinearGradient(0, 0, 0, H);
    sg.addColorStop(0, 'rgba(255,255,255,0.16)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.02)'); sg.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    if (style === 'curtain') {
      ctx.strokeStyle = 'rgba(10,12,18,0.5)'; ctx.lineWidth = 1.5;
      for (let i = 0; i <= styleDesc('curtain').cols; i++) { ctx.beginPath(); ctx.moveTo((W / styleDesc('curtain').cols) * i, 0); ctx.lineTo((W / styleDesc('curtain').cols) * i, H); ctx.stroke(); }
    }
  } else if (style === 'modern') {
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,130,140,0.4)'; ctx.lineWidth = 1.2;
    for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0, (H / 8) * i); ctx.lineTo(W, (H / 8) * i); ctx.stroke(); }
  } else if (style === 'cyber') {
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,229,255,0.12)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i++) { ctx.beginPath(); ctx.moveTo((W / 12) * i, 0); ctx.lineTo((W / 12) * i, H); ctx.stroke(); }
    const sg = ctx.createLinearGradient(0, 0, 0, H);
    sg.addColorStop(0, 'rgba(0,229,255,0.06)'); sg.addColorStop(1, 'rgba(255,43,214,0.05)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  }
}

function makeWallSet(era, variant) {
  const style = era.building.style;
  const desc = styleDesc(style);
  const { cols, rows } = desc;
  const W = 512;
  const H = Math.round((512 * rows) / cols);
  const wall = newCanvas(W, H);
  const em = newCanvas(W, H);
  const wctx = wall.getContext('2d');
  const ectx = em.getContext('2d');
  const rnd = mulberry32(1000 + variant * 97 + era.year);
  drawWallBase(wctx, era, style, W, H, rnd, variant);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, W, H);

  const cellW = W / cols;
  const cellH = H / rows;
  const accents = era.building.accent;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const x = c * cellW;
      const y = r * cellH;
      const lit = rnd() < desc.litProb;
      drawWindowCell(wctx, ectx, style, desc, era, x, y, cellW, cellH, lit, rnd, accents);
    }
  }

  const tileW = cols * 2.6; // metres one texture tile spans horizontally
  const map = texFromCanvas(wall, true);
  const emissive = texFromCanvas(em, true);
  return { map, emissive, cols, rows, tileW };
}

function drawWindowCell(wctx, ectx, style, desc, era, x, y, cw, ch, lit, rnd, accents) {
  const m = Math.min(cw, ch) * 0.16; // frame margin
  const winColor = (style === 'glass' || style === 'curtain' || style === 'modern')
    ? shade(era.building.palette[0], 40) : '#1a1c22';
  if (desc.layout === 'ribbon') {
    // horizontal strip windows
    const stripH = ch * 0.34;
    const wy = y + ch * 0.5 - stripH / 2;
    wctx.fillStyle = '#101218'; wctx.fillRect(x + m, wy, cw - m * 2, stripH);
    wctx.fillStyle = winColor; wctx.fillRect(x + m + 2, wy + 2, cw - m * 2 - 4, stripH - 4);
    if (lit) { wctx.fillStyle = desc.litColor; wctx.fillRect(x + m + 2, wy + 2, cw - m * 2 - 4, stripH - 4);
      ectx.fillStyle = desc.litColor; ectx.fillRect(x + m + 2, wy + 2, cw - m * 2 - 4, stripH - 4); }
  } else if (desc.layout === 'strip') {
    // glowing horizontal neon strip
    const stripH = ch * 0.16;
    const wy = y + ch * 0.5 - stripH / 2;
    const col = rnd() < 0.5 ? accents[0] : (accents[1] || accents[0]);
    wctx.fillStyle = col; wctx.fillRect(x + m * 0.4, wy, cw - m * 0.8, stripH);
    ectx.fillStyle = col; ectx.fillRect(x + m * 0.4, wy, cw - m * 0.8, stripH);
    // small window slit
    const slit = ch * 0.12;
    wctx.fillStyle = '#0a0c12'; wctx.fillRect(x + cw * 0.3, y + ch * 0.2, cw * 0.4, slit);
    if (lit) { ectx.fillStyle = col; ectx.fillRect(x + cw * 0.3, y + ch * 0.2, cw * 0.4, slit); }
  } else if (desc.layout === 'panel') {
    const pad = cw * 0.1;
    wctx.fillStyle = '#101218'; wctx.fillRect(x + pad, y + pad, cw - pad * 2, ch - pad * 2);
    const g = wctx.createLinearGradient(x, y, x + cw, y + ch);
    g.addColorStop(0, shade(winColor, 50)); g.addColorStop(1, shade(winColor, -10));
    wctx.fillStyle = g; wctx.fillRect(x + pad + 2, y + pad + 2, cw - pad * 2 - 4, ch - pad * 2 - 4);
    if (lit) { wctx.fillStyle = desc.litColor; wctx.globalAlpha = 0.85;
      wctx.fillRect(x + pad + 2, y + pad + 2, cw - pad * 2 - 4, ch - pad * 2 - 4); wctx.globalAlpha = 1;
      ectx.fillStyle = desc.litColor; ectx.fillRect(x + pad + 2, y + pad + 2, cw - pad * 2 - 4, ch - pad * 2 - 4); }
  } else {
    // mullion / pane: a window with frame, possibly split
    const pad = cw * 0.18;
    wctx.fillStyle = shade(era.building.palette[0], -55); // dark frame
    wctx.fillRect(x + pad, y + pad, cw - pad * 2, ch - pad * 2);
    wctx.fillStyle = winColor;
    wctx.fillRect(x + pad + 2, y + pad + 2, cw - pad * 2 - 4, ch - pad * 2 - 4);
    if (desc.layout === 'mullion') {
      wctx.fillStyle = shade(era.building.palette[0], -55);
      wctx.fillRect(x + cw * 0.5 - 1, y + pad + 2, 2, ch - pad * 2 - 4);
      wctx.fillRect(x + pad + 2, y + ch * 0.5 - 1, cw - pad * 2 - 4, 2);
    }
    if (lit) {
      wctx.fillStyle = desc.litColor; wctx.globalAlpha = 0.9;
      wctx.fillRect(x + pad + 2, y + pad + 2, cw - pad * 2 - 4, ch - pad * 2 - 4); wctx.globalAlpha = 1;
      ectx.fillStyle = desc.litColor; ectx.fillRect(x + pad + 2, y + pad + 2, cw - pad * 2 - 4, ch - pad * 2 - 4);
    }
  }
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.l = Math.max(0, Math.min(1, hsl.l + amt / 255));
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return '#' + c.getHexString();
}

// ---- storefront ----
function makeStorefront(era) {
  const W = 512, H = 256;
  const c = newCanvas(W, H);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(era.year + 7);
  const night = era.night;
  // upper band (awning / sign backing)
  ctx.fillStyle = shade(era.building.palette[0], -30); ctx.fillRect(0, 0, W, H * 0.32);
  // shop count
  const shops = 2 + Math.floor(rnd() * 2);
  const sw = W / shops;
  const accents = era.building.accent;
  for (let i = 0; i < shops; i++) {
    const x = i * sw;
    // glass
    const gg = ctx.createLinearGradient(x, H * 0.32, x, H);
    if (night) { gg.addColorStop(0, '#2a3346'); gg.addColorStop(1, '#0e1320'); }
    else { gg.addColorStop(0, shade(accents[0], 10)); gg.addColorStop(1, shade(accents[0], -60)); }
    ctx.fillStyle = gg; ctx.fillRect(x + 4, H * 0.34, sw - 8, H * 0.64);
    // door
    ctx.fillStyle = night ? '#1a2030' : shade(era.building.palette[0], -70);
    ctx.fillRect(x + sw * 0.6, H * 0.42, sw * 0.22, H * 0.56);
    // lit interior glow at night
    if (night) { ctx.fillStyle = 'rgba(255,210,138,0.35)'; ctx.fillRect(x + 6, H * 0.36, sw - 12, H * 0.6); }
    // sign strip
    const sc = accents[i % accents.length];
    ctx.fillStyle = sc; ctx.fillRect(x + 6, H * 0.06, sw - 12, H * 0.18);
  }
  // mullions between shops
  ctx.fillStyle = shade(era.building.palette[0], -60);
  for (let i = 1; i < shops; i++) ctx.fillRect(i * sw - 2, H * 0.34, 4, H * 0.64);
  return texFromCanvas(c, true);
}

// ---- road markings texture (a single dash tile) ----
function makeRoadLine(era) {
  const W = 64, H = 256;
  const c = newCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = era.ground.line;
  ctx.fillRect(W * 0.3, H * 0.1, W * 0.4, H * 0.35);
  ctx.fillRect(W * 0.3, H * 0.6, W * 0.4, H * 0.35);
  const t = texFromCanvas(c, true);
  return t;
}

// cache per era
const cache = new Map();

export function getEraTextures(era, index) {
  const key = index;
  if (cache.has(key)) return cache.get(key);
  const wallSets = [];
  for (let i = 0; i < 3; i++) wallSets.push(makeWallSet(era, i));
  const set = {
    wallSets,
    storefront: makeStorefront(era),
    roadLine: makeRoadLine(era)
  };
  cache.set(key, set);
  return set;
}

// procedural sky gradient texture (fallback / used for fog color sampling)
export { shade as shadeColor };
