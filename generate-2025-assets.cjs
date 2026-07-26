// ===== 2025 Era Asset Generator =====
// Generates era-accurate 3D models (.glb) and textures (.png) for the 2020s
// (contemporary / near-future) using Three.js procedural geometry.
// Assets are placed under /assets/2025/<type>/.
//
// 2025 era characteristics:
//  - Contemporary glass & steel high-rises, mixed-use towers
//  - Electric / hybrid vehicles (Tesla-style sedan, electric bus, e-bike)
//  - Modern storefronts with digital displays and glass facades
//  - Digital LED billboards and holographic-style advertisements
//  - Contemporary pedestrian attire (casual wear, smartphones, backpacks)
//  - Modern streetscape: bike lanes, EV charging stations, LED streetlights,
//    smart traffic signals, solar panels, green walls

const fs = require("fs");
const path = require("path");
const THREE = require("three");
const { GLTFExporter } = require("three/addons/exporters/GLTFExporter.js");

// FileReader polyfill for Node.js (required by GLTFExporter's writeAsync)
class FileReader {
  constructor() { this.result = null; this.readyState = 0; }
  readAsArrayBuffer(blob) {
    this.readyState = 2;
    if (typeof blob?.arrayBuffer === "function") {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (this.onloadend) this.onloadend();
      });
    } else if (Buffer.isBuffer(blob)) {
      this.result = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
      if (this.onloadend) this.onloadend();
    } else {
      this.result = blob;
      if (this.onloadend) this.onloadend();
    }
  }
  readAsText(blob) { this.readAsArrayBuffer(blob); }
  readAsDataURL(blob) {
    this.readyState = 2;
    if (typeof blob?.arrayBuffer === "function") {
      blob.arrayBuffer().then((buf) => {
        this.result = "data:application/octet-stream;base64," + Buffer.from(buf).toString("base64");
        if (this.onloadend) this.onloadend();
      });
    } else if (Buffer.isBuffer(blob)) {
      this.result = "data:application/octet-stream;base64," + blob.toString("base64");
      if (this.onloadend) this.onloadend();
    } else {
      this.result = "data:application/octet-stream;base64," + Buffer.from(blob).toString("base64");
      if (this.onloadend) this.onloadend();
    }
  }
}
global.FileReader = FileReader;

// ImageData polyfill (required by GLTFExporter for texture embedding)
class ImageData {
  constructor(data, width, height) {
    if (typeof data === "number") {
      this.width = data;
      this.height = width;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  }
}
global.ImageData = ImageData;

// document polyfill (required by GLTFExporter's getCanvas for texture embedding)
global.document = {
  createElement(tag) {
    if (tag === "canvas") {
      return new FakeCanvas(1, 1);
    }
    return {};
  },
};

const ROOT = path.join(__dirname, "assets", "2025");
const CATEGORIES = ["buildings", "vehicles", "storefronts", "ads", "pedestrians", "environment"];

// Ensure all category directories exist
for (const cat of CATEGORIES) {
  fs.mkdirSync(path.join(ROOT, cat), { recursive: true });
}

const gltfExporter = new GLTFExporter();

/**
 * Export a Three.js scene/group to a .glb file.
 */
function exportGLB(group, filename) {
  return new Promise((resolve, reject) => {
    gltfExporter.parse(
      group,
      (result) => {
        const output = result instanceof ArrayBuffer ? Buffer.from(result) : Buffer.from(result, "utf8");
        fs.writeFileSync(filename, output);
        console.log(`  [glb] ${path.relative(ROOT, filename)} (${output.length} bytes)`);
        resolve();
      },
      (error) => reject(error),
      { binary: true, embedImages: true, forceIndices: true, forcePowerOfTwoTextures: true }
    );
  });
}

/**
 * Create a data-URL PNG texture from a canvas drawn by `drawFn`.
 * Returns a THREE.DataTexture (also written to disk as .png).
 */
function makeTexture(name, width, height, drawFn) {
  const canvas = document_like_canvas(width, height);
  const ctx = canvas.getContext("2d");
  drawFn(ctx, width, height);
  const pngPath = path.join(ROOT, "textures", name + ".png");
  fs.mkdirSync(path.dirname(pngPath), { recursive: true });
  const buf = canvas.toBuffer("image/png");
  fs.writeFileSync(pngPath, buf);
  const data = new Uint8ClampedArray(canvas._data);
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.needsUpdate = true;
  tex.flipY = false;
  return tex;
}

/**
 * Create a canvas, draw on it, write a standalone PNG to
 * /assets/2025/textures/<name>.png, and return a DataTexture.
 * This matches the 1965 generator convention of writing standalone
 * texture PNGs alongside the embedded GLB textures.
 */
function makeNamedTexture(name, width, height, drawFn) {
  const canvas = document_like_canvas(width, height);
  const ctx = canvas.getContext("2d");
  drawFn(ctx, width, height);
  const pngPath = path.join(ROOT, "textures", name + ".png");
  fs.mkdirSync(path.dirname(pngPath), { recursive: true });
  const buf = canvas.toBuffer("image/png");
  fs.writeFileSync(pngPath, buf);
  const data = new Uint8ClampedArray(canvas._data);
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.needsUpdate = true;
  tex.flipY = false;
  return tex;
}

// Minimal canvas shim (no browser needed) using node-canvas if available,
// otherwise fall back to a pure-JS PNG writer.
let canvasImpl;
try {
  const { createCanvas } = require("canvas");
  canvasImpl = (w, h) => createCanvas(w, h);
} catch (e) {
  canvasImpl = (w, h) => new FakeCanvas(w, h);
}

function document_like_canvas(w, h) {
  return canvasImpl(w, h);
}

// ---- Fallback pure-JS canvas (no native deps) ----
class FakeCanvas {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this._data = Buffer.alloc(w * h * 4, 0);
  }
  getContext() { return new FakeCtx(this); }
  toBuffer() { return pngEncode(this.width, this.height, this._data); }
  toBlob(callback, mimeType) {
    const buf = this.toBuffer();
    const blob = new Blob([buf], { type: mimeType || "image/png" });
    callback(blob);
  }
  toDataURL() {
    return "data:image/png;base64," + this.toBuffer().toString("base64");
  }
}
class FakeCtx {
  constructor(canvas) {
    this.c = canvas;
    this.fillStyle = "#000000";
    this.strokeStyle = "#000000";
    this.lineWidth = 1;
    this._font = "16px sans-serif";
    this._flipY = false;
    this._scaleX = 1;
    this._scaleY = 1;
    this._offsetX = 0;
    this._offsetY = 0;
  }
  get font() { return this._font; } set font(v) { this._font = v; }
  translate(x, y) { this._offsetX += x; this._offsetY += y; }
  scale(sx, sy) { this._scaleX *= sx; this._scaleY *= sy; }
  fillRect(x, y, w, h) {
    const c = this.c;
    const col = parseColor(this.fillStyle);
    for (let iy = y; iy < y + h; iy++) {
      for (let ix = x; ix < x + w; ix++) {
        if (ix < 0 || iy < 0 || ix >= c.width || iy >= c.height) continue;
        const i = (iy * c.width + ix) * 4;
        c._data[i] = col.r; c._data[i+1] = col.g; c._data[i+2] = col.b; c._data[i+3] = col.a;
      }
    }
  }
  strokeRect(x, y, w, h) {
    this._strokeLine(x, y, x + w, y);
    this._strokeLine(x, y + h, x + w, y + h);
    this._strokeLine(x, y, x, y + h);
    this._strokeLine(x + w, y, x + w, y + h);
  }
  _strokeLine(x0, y0, x1, y1) {
    if (x0 === x1) { for (let y = Math.min(y0,y1); y <= Math.max(y0,y1); y++) this._setPixel(x0, y); }
    else if (y0 === y1) { for (let x = Math.min(x0,x1); x <= Math.max(x0,x1); x++) this._setPixel(x, y0); }
  }
  _setPixel(x, y) {
    const c = this.c;
    if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
    const i = (y * c.width + x) * 4;
    const col = parseColor(this.strokeStyle);
    c._data[i] = col.r; c._data[i+1] = col.g; c._data[i+2] = col.b; c._data[i+3] = col.a;
  }
  fillText() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  closePath() {}
  fill() {}
  stroke() {}
  drawImage(src, dx, dy, dw, dh) {
    if (src && src._data) {
      const c = this.c;
      const sw = src.width, sh = src.height;
      for (let iy = 0; iy < sh; iy++) {
        for (let ix = 0; ix < sw; ix++) {
          const si = (iy * sw + ix) * 4;
          const di = ((iy + dy) * c.width + (ix + dx)) * 4;
          if (di >= 0 && di + 3 < c._data.length) {
            c._data[di] = src._data[si];
            c._data[di+1] = src._data[si+1];
            c._data[di+2] = src._data[si+2];
            c._data[di+3] = src._data[si+3];
          }
        }
      }
    }
  }
  createImageData(w, h) {
    if (typeof w === "number") {
      return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
    }
    return { data: new Uint8ClampedArray(w.width * w.height * 4), width: w.width, height: w.height };
  }
  getImageData(x, y, w, h) {
    return { data: this.c._data.slice((y*this.c.width+x)*4, (y*this.c.width+x)*4 + w*h*4), width: w, height: h };
  }
  putImageData(imgData, dx, dy) {
    const c = this.c;
    const data = imgData.data;
    const w = imgData.width, h = imgData.height;
    for (let iy = 0; iy < h; iy++) {
      for (let ix = 0; ix < w; ix++) {
        const si = (iy * w + ix) * 4;
        const di = ((iy + dy) * c.width + (ix + dx)) * 4;
        if (di >= 0 && di + 3 < c._data.length && si + 3 < data.length) {
          c._data[di] = data[si];
          c._data[di+1] = data[si+1];
          c._data[di+2] = data[si+2];
          c._data[di+3] = data[si+3];
        }
      }
    }
  }
}

function parseColor(c) {
  const m = /^#([0-9a-f]{3})([0-9a-f])?$/i.exec(c) || /^#([0-9a-f]{6})$/i.exec(c);
  if (m) {
    let hex = m[1];
    if (hex.length === 3) hex = hex.split("").map(ch => ch+ch).join("");
    const n = parseInt(hex, 16);
    return { r: (n>>16)&255, g: (n>>8)&255, b: n&255, a: 255 };
  }
  return { r: 0, g: 0, b: 0, a: 255 };
}

// Minimal PNG encoder (RGBA, 8-bit, single IDAT, no filtering)
function pngEncode(w, h, data) {
  const chunks = [];
  chunks.push(Buffer.from([137,80,78,71,13,10,26,10])); // signature
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  chunks.push(chunk("IHDR", ihdr));
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w*4+1)] = 0; // filter type 0
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4;
      const dst = y * (w*4+1) + 1 + x * 4;
      raw[dst] = data[src];
      raw[dst+1] = data[src+1];
      raw[dst+2] = data[src+2];
      raw[dst+3] = data[src+3];
    }
  }
  const zlib = require("zlib");
  const idat = zlib.deflateSync(raw);
  chunks.push(chunk("IDAT", idat));
  chunks.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(chunks);
}
function chunk(type, data) {
  const out = Buffer.alloc(4 + 4 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([out.slice(4, 8), data])) >>> 0;
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c;
}

// ===== MATERIAL HELPERS =====
// 2025 era palette: contemporary glass, steel, EV colors, digital displays
const MAT = {
  // Building / architecture
  glassBlue: 0xa3c4f3,
  glassClear: 0xe0f7ff,
  glassTinted: 0xb3d9ff,
  steelDark: 0x2c3e50,
  steelMedium: 0x34495e,
  steelLight: 0x5d6d7e,
  concrete: 0x95a5a6,
  concreteLight: 0xbdc3c7,
  brickModern: 0x95a5a6,
  charcoal: 0x2c3e50,
  blackSteel: 0x1a1a1a,
  white: 0xffffff,
  black: 0x0a0a0a,
  // EV vehicle colors
  evBlue: 0x1e3a8a,
  evRed: 0xb91c1c,
  evWhite: 0xf8fafc,
  evSilver: 0x94a3b8,
  evBlack: 0x0f172a,
  evGreen: 0x16a34a,
  // Storefront / digital
  screenBlack: 0x0a0a0a,
  ledRed: 0xef4444,
  ledGreen: 0x22c55e,
  ledBlue: 0x3b82f6,
  ledYellow: 0xfacc15,
  ledWhite: 0xf1f5f9,
  // Environment
  asphalt: 0x2d3748,
  asphaltNew: 0x1a202c,
  bikeLane: 0xfbbf24,
  bikeLaneLine: 0xf59e0b,
  crosswalk: 0xf3f4f6,
  grass: 0x22c55e,
  grassDark: 0x16a34a,
  treeGreen: 0x16a34a,
  treeBrown: 0x8b5a2b,
  evCharger: 0x1e3a8a,
  evChargerCable: 0x475569,
  streetLight: 0x334155,
  streetLightGlobe: 0xf1f5f9,
  trafficLight: 0x1e293b,
  trafficRed: 0xef4444,
  trafficYellow: 0xfacc15,
  trafficGreen: 0x22c55e,
  solarPanel: 0x0f172a,
  solarFrame: 0x64748b,
  // Pedestrian attire
  denim: 0x1e3a8a,
  hoodie: 0xb91c1c,
  jacket: 0x0f172a,
  sneaker: 0x94a3b8,
  skin: 0xfbb189,
  hair: 0x3b2314,
  // Ads
  digitalScreen: 0x0a0a0a,
  holographic: 0xa8edff,
  signFrame: 0x334155,
  logoBlue: 0x3b82f6,
  logoGreen: 0x22c55e,
  logoPink: 0xec4899,
};

function stdMat(color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.5,
    metalness: opts.metal ?? 0.0,
  });
  if (opts.emissive !== undefined) mat.emissive = new THREE.Color(opts.emissive);
  if (opts.emissiveIntensity !== undefined) mat.emissiveIntensity = opts.emissiveIntensity;
  if (opts.transparent !== undefined) mat.transparent = opts.transparent;
  if (opts.opacity !== undefined) mat.opacity = opts.opacity;
  if (opts.side !== undefined) mat.side = opts.side;
  if (opts.map !== undefined) mat.map = opts.map;
  return mat;
}

function basicMat(color, opts = {}) {
  const mat = new THREE.MeshBasicMaterial({ color });
  if (opts.transparent !== undefined) mat.transparent = opts.transparent;
  if (opts.opacity !== undefined) mat.opacity = opts.opacity;
  if (opts.side !== undefined) mat.side = opts.side;
  if (opts.map !== undefined) mat.map = opts.map;
  return mat;
}

// ===== BUILDING: Contemporary glass & steel high-rise =====
async function genBuilding() {
  const group = new THREE.Group();
  group.name = "modern_highrise";

  // --- Tower 1: Glass curtain wall skyscraper ---
  const tower1 = new THREE.Group();
  const tower1H = 22;
  const tower1Geo = new THREE.BoxGeometry(6, tower1H, 6);
  // Glass facade with slight tint
  const glassMat = stdMat(MAT.glassTinted, { rough: 0.05, metal: 0.8 });
  const tower1Mesh = new THREE.Mesh(tower1Geo, glassMat);
  tower1Mesh.position.y = tower1H / 2;
  tower1.add(tower1Mesh);

  // Steel frame grid lines on glass
  const frameMat = stdMat(MAT.steelMedium, { rough: 0.3, metal: 0.9 });
  const frameW = 0.12;
  // Vertical mullions
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const vGeo = new THREE.BoxGeometry(frameW, tower1H, frameW);
    const vMesh = new THREE.Mesh(vGeo, frameMat);
    vMesh.position.set(i * 1.4, tower1H / 2, 3);
    tower1.add(vMesh);
    const vMesh2 = vMesh.clone();
    vMesh2.position.set(i * 1.4, tower1H / 2, -3);
    tower1.add(vMesh2);
  }
  // Horizontal spandrels
  for (let i = 1; i <= 8; i++) {
    const hGeo = new THREE.BoxGeometry(6, frameW, frameW);
    const hMesh = new THREE.Mesh(hGeo, frameMat);
    hMesh.position.set(0, i * 2.4, 3);
    tower1.add(hMesh);
    const hMesh2 = hMesh.clone();
    hMesh2.position.set(0, i * 2.4, -3);
    tower1.add(hMesh2);
  }
  // Roof with HVAC units
  const roofGeo = new THREE.BoxGeometry(6, 0.8, 6);
  const roofMesh = new THREE.Mesh(roofGeo, stdMat(MAT.steelDark, { rough: 0.4, metal: 0.8 }));
  roofMesh.position.y = tower1H + 0.4;
  tower1.add(roofMesh);
  // HVAC units on roof
  for (let i = 0; i < 3; i++) {
    const hvacGeo = new THREE.BoxGeometry(1.2, 0.5, 0.8);
    const hvac = new THREE.Mesh(hvacGeo, stdMat(MAT.steelMedium, { rough: 0.3, metal: 0.9 }));
    hvac.position.set(-1.8 + i * 1.4, tower1H + 0.85, 0);
    tower1.add(hvac);
  }
  // Digital building sign
  const signGeo = new THREE.PlaneGeometry(2, 0.4);
  const signMat = stdMat(MAT.ledBlue, { emissive: MAT.ledBlue, emissiveIntensity: 0.8 });
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(0, 2, 3.01);
  tower1.add(sign);

  tower1.position.set(-8, 0, 0);
  group.add(tower1);

  // --- Tower 2: Mixed-use with retail base + residential tower ---
  const tower2 = new THREE.Group();
  const baseH = 4;
  const baseGeo = new THREE.BoxGeometry(5, baseH, 5);
  const baseMat = stdMat(MAT.concreteLight, { rough: 0.7 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = baseH / 2;
  tower2.add(base);

  // Retail windows on base
  const windowMat = stdMat(MAT.ledBlue, { emissive: MAT.ledBlue, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 });
  for (let side = 0; side < 4; side++) {
    const winGeo = new THREE.PlaneGeometry(0.8, 1.2);
    const win = new THREE.Mesh(winGeo, windowMat);
    const offset = side * Math.PI / 2;
    win.rotation.y = offset;
    win.position.set(
      Math.sin(offset) * 2.51,
      2,
      Math.cos(offset) * 2.51
    );
    tower2.add(win);
  }

  // Residential tower above
  const resH = 14;
  const resGeo = new THREE.BoxGeometry(4, resH, 4);
  const resMat = stdMat(MAT.glassBlue, { rough: 0.1, metal: 0.85 });
  const res = new THREE.Mesh(resGeo, resMat);
  res.position.y = baseH + resH / 2;
  tower2.add(res);

  // Balconies on residential tower
  for (let i = 0; i < 5; i++) {
    const balGeo = new THREE.BoxGeometry(4, 0.2, 0.8);
    const bal = new THREE.Mesh(balGeo, stdMat(MAT.steelDark, { rough: 0.3, metal: 0.9 }));
    bal.position.set(0, baseH + 1.5 + i * 2.5, 2.4);
    tower2.add(bal);
  }

  tower2.position.set(8, 0, 0);
  group.add(tower2);

  // --- Green wall / vertical garden on one side ---
  const wallGeo = new THREE.PlaneGeometry(3, 8);
  const wallTex = makeNamedTexture("green_wall_2025", 64, 64, (ctx, w, h) => {
    // Draw a vertical garden pattern
    ctx.fillStyle = "#16a34a";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * (w - 14) + 7;
      const y = Math.random() * (h - 14) + 7;
      const sz = Math.random() * 6 + 3;
      ctx.fillStyle = Math.random() > 0.5 ? "#22c55e" : "#16a34a";
      ctx.fillRect(x, y, sz, sz);
    }
  });
  const wallMat = stdMat(MAT.treeGreen, { rough: 0.8, map: wallTex });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(-8, 4, 3.01);
  group.add(wall);

  await exportGLB(group, path.join(ROOT, "buildings", "modern_highrise_2025.glb"));
}

// ===== VEHICLE: Electric sedan (Tesla-style) =====
async function genVehicle() {
  const group = new THREE.Group();
  group.name = "electric_sedan";

  // Main body (sleek aerodynamic shape)
  const bodyGeo = new THREE.BoxGeometry(4.2, 1.4, 1.6);
  const bodyMat = stdMat(MAT.evBlue, { rough: 0.1, metal: 0.9 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.2;
  group.add(body);

  // Lower front bumper
  const bumperGeo = new THREE.BoxGeometry(4.2, 0.3, 0.6);
  const bumper = new THREE.Mesh(bumperGeo, stdMat(MAT.evBlack, { rough: 0.2, metal: 0.8 }));
  bumper.position.set(0, 0.85, 0);
  group.add(bumper);

  // Roof (sloped)
  const roofGeo = new THREE.BoxGeometry(3.6, 0.8, 1.6);
  const roof = new THREE.Mesh(roofGeo, bodyMat);
  roof.position.set(0, 2.0, 0);
  roof.rotation.x = 0.15;
  group.add(roof);

  // Rear spoiler
  const spoilerGeo = new THREE.BoxGeometry(1.2, 0.1, 0.3);
  const spoiler = new THREE.Mesh(spoilerGeo, stdMat(MAT.evBlack, { rough: 0.2, metal: 0.8 }));
  spoiler.position.set(0, 2.6, 0);
  group.add(spoiler);

  // Wheels (4)
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 24);
  const wheelMat = stdMat(MAT.black, { rough: 0.4, metal: 0.7 });
  const wheelPositions = [
    [-1.3, 0.8, 0.95], [1.3, 0.8, 0.95],
    [-1.3, 0.8, -0.95], [1.3, 0.8, -0.95],
  ];
  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, y, z);
    wheel.rotation.z = Math.PI / 2;
    group.add(wheel);

    // Wheel rim detail
    const rimGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.2, 8);
    const rim = new THREE.Mesh(rimGeo, stdMat(MAT.evSilver, { rough: 0.1, metal: 0.9 }));
    rim.position.set(x, y, z);
    rim.rotation.z = Math.PI / 2;
    group.add(rim);
  }

  // Front grille (closed - EV, no air intake)
  const grilleGeo = new THREE.PlaneGeometry(1.2, 0.3);
  const grilleMat = stdMat(MAT.evBlack, { rough: 0.2, metal: 0.8 });
  const grille = new THREE.Mesh(grilleGeo, grilleMat);
  grille.position.set(0, 1.1, 2.01);
  group.add(grille);

  // LED headlights
  const headlightGeo = new THREE.PlaneGeometry(0.4, 0.2);
  const headlightMat = stdMat(MAT.ledWhite, { emissive: MAT.ledWhite, emissiveIntensity: 1.0 });
  const headlightL = new THREE.Mesh(headlightGeo, headlightMat);
  headlightL.position.set(-0.7, 1.3, 2.01);
  group.add(headlightL);
  const headlightR = headlightL.clone();
  headlightR.position.set(0.7, 1.3, 2.01);
  group.add(headlightR);

  // LED taillights
  const taillightGeo = new THREE.PlaneGeometry(0.6, 0.2);
  const taillightMat = stdMat(MAT.ledRed, { emissive: MAT.ledRed, emissiveIntensity: 0.8 });
  const taillightL = new THREE.Mesh(taillightGeo, taillightMat);
  taillightL.position.set(-0.6, 1.3, -2.01);
  group.add(taillightL);
  const taillightR = taillightL.clone();
  taillightR.position.set(0.6, 1.3, -2.01);
  group.add(taillightR);

  // Charging port
  const portGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16);
  const portMat = stdMat(MAT.evCharger, { rough: 0.3, metal: 0.7, emissive: MAT.evCharger, emissiveIntensity: 0.5 });
  const port = new THREE.Mesh(portGeo, portMat);
  port.position.set(0.9, 1.2, 1.0);
  port.rotation.x = Math.PI / 2;
  group.add(port);

  // Tesla-style logo on rear
  const logoGeo = new THREE.TorusGeometry(0.15, 0.03, 8, 16);
  const logoMat = stdMat(MAT.ledWhite, { emissive: MAT.ledWhite, emissiveIntensity: 0.6 });
  const logo = new THREE.Mesh(logoGeo, logoMat);
  logo.position.set(0, 1.4, -2.02);
  logo.rotation.y = Math.PI / 2;
  group.add(logo);

  await exportGLB(group, path.join(ROOT, "vehicles", "electric_sedan_2025.glb"));
}

// ===== STOREFRONT: Modern glass storefront with digital display =====
async function genStorefront() {
  const group = new THREE.Group();
  group.name = "modern_storefront";

  // Storefront base
  const baseGeo = new THREE.BoxGeometry(6, 4, 2);
  const baseMat = stdMat(MAT.concrete, { rough: 0.6 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 2;
  group.add(base);

  // Large glass storefront windows
  const glassGeo = new THREE.PlaneGeometry(5.6, 2.8);
  const glassMat = stdMat(MAT.glassClear, { rough: 0.02, metal: 0.9, transparent: true, opacity: 0.3 });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0, 2.5, 1.01);
  group.add(glass);

  // Digital display screen (inside)
  const screenGeo = new THREE.PlaneGeometry(3, 1.2);
  const screenTex = makeNamedTexture("storefront_screen_2025", 64, 64, (ctx, w, h) => {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);
    // Draw some digital UI elements
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(8, 12, 20, 8);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(8, 28, 30, 6);
    ctx.fillStyle = "#facc15";
    ctx.fillRect(8, 42, 24, 6);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(40, 12, 16, 6);
  });
  const screenMat = stdMat(MAT.screenBlack, { emissive: MAT.ledBlue, emissiveIntensity: 0.6, map: screenTex });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 2.5, 1.02);
  group.add(screen);

  // Storefront door (automatic sliding)
  const doorGeo = new THREE.BoxGeometry(1.2, 2.2, 0.15);
  const doorMat = stdMat(MAT.steelDark, { rough: 0.3, metal: 0.9 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 1.8, 1.01);
  group.add(door);

  // Door handle / sensor
  const sensorGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16);
  const sensorMat = stdMat(MAT.ledBlue, { emissive: MAT.ledBlue, emissiveIntensity: 0.8 });
  const sensor = new THREE.Mesh(sensorGeo, sensorMat);
  sensor.position.set(0, 1.8, 1.1);
  group.add(sensor);

  // Modern sign above door
  const signGeo = new THREE.PlaneGeometry(2.5, 0.5);
  const signTex = makeNamedTexture("storefront_sign_2025", 64, 32, (ctx, w, h) => {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(16, 8, 32, 16);
  });
  const signMat = stdMat(MAT.signFrame, { emissive: MAT.ledBlue, emissiveIntensity: 0.4, map: signTex });
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(0, 4.2, 1.01);
  group.add(sign);

  // Canopy with integrated LED strips
  const canopyGeo = new THREE.BoxGeometry(6.5, 0.3, 1.5);
  const canopyMat = stdMat(MAT.steelDark, { rough: 0.3, metal: 0.9 });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 4.4, 0);
  group.add(canopy);

  // LED strip under canopy
  const ledGeo = new THREE.BoxGeometry(5.5, 0.05, 0.1);
  const ledMat = stdMat(MAT.ledWhite, { emissive: MAT.ledWhite, emissiveIntensity: 1.0 });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0, 4.25, 0.7);
  group.add(led);

  await exportGLB(group, path.join(ROOT, "storefronts", "modern_storefront_2025.glb"));
}

// ===== AD: Digital LED billboard with holographic display =====
async function genAd() {
  const group = new THREE.Group();
  group.name = "digital_billboard";

  // Billboard frame
  const frameGeo = new THREE.BoxGeometry(0.3, 4, 6);
  const frameMat = stdMat(MAT.signFrame, { rough: 0.4, metal: 0.8 });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  group.add(frame);

  // LED screen
  const screenGeo = new THREE.PlaneGeometry(3.6, 5.6);
  const screenTex = makeNamedTexture("digital_billboard_screen_2025", 128, 128, (ctx, w, h) => {
    // Dark background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);
    // Draw a modern ad layout
    // Logo area
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(20, 16, 30, 20);
    // Headline bars
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(20, 44, 80, 8);
    ctx.fillRect(20, 58, 60, 8);
    // Feature icons
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(20, 76, 16, 16);
    ctx.fillStyle = "#facc15";
    ctx.fillRect(44, 76, 16, 16);
    ctx.fillStyle = "#ec4899";
    ctx.fillRect(68, 76, 16, 16);
    // Call to action button
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(20, 100, 50, 16);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(30, 106, 30, 4);
  });
  const screenMat = stdMat(MAT.digitalScreen, { emissive: MAT.ledBlue, emissiveIntensity: 0.9, map: screenTex });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  group.add(screen);

  // LED border around screen
  const borderGeo = new THREE.RingGeometry(2.9, 3.1, 4);
  const borderMat = stdMat(MAT.ledWhite, { emissive: MAT.ledWhite, emissiveIntensity: 0.8 });
  const border = new THREE.Mesh(borderGeo, borderMat);
  group.add(border);

  // Mounting pole
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 8, 16);
  const pole = new THREE.Mesh(poleGeo, frameMat);
  pole.position.y = -6;
  group.add(pole);

  // Base platform
  const baseGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 32);
  const base = new THREE.Mesh(baseGeo, frameMat);
  base.position.y = -10.2;
  group.add(base);

  // Holographic display (floating above screen)
  const holoGeo = new THREE.TorusKnotGeometry(0.5, 0.08, 64, 8);
  const holoMat = stdMat(MAT.holographic, {
    emissive: MAT.holographic,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const holo = new THREE.Mesh(holoGeo, holoMat);
  holo.position.y = 3.5;
  group.add(holo);

  await exportGLB(group, path.join(ROOT, "ads", "digital_billboard_2025.glb"));
}

// ===== PEDESTRIAN: Contemporary casual attire =====
async function genPedestrian() {
  const group = new THREE.Group();
  group.name = "pedestrian_2025";

  // Head
  const headGeo = new THREE.SphereGeometry(0.4, 16, 16);
  const head = new THREE.Mesh(headGeo, stdMat(MAT.skin, { rough: 0.6 }));
  head.position.y = 4.2;
  group.add(head);

  // Hair
  const hairGeo = new THREE.SphereGeometry(0.38, 16, 16);
  const hair = new THREE.Mesh(hairGeo, stdMat(MAT.hair, { rough: 0.8 }));
  hair.position.y = 4.25;
  group.add(hair);

  // Torso (hoodie)
  const torsoGeo = new THREE.BoxGeometry(0.8, 1.0, 0.4);
  const torso = new THREE.Mesh(torsoGeo, stdMat(MAT.hoodie, { rough: 0.7 }));
  torso.position.y = 3.3;
  group.add(torso);

  // Hood
  const hoodGeo = new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const hood = new THREE.Mesh(hoodGeo, stdMat(MAT.hoodie, { rough: 0.7 }));
  hood.position.y = 3.9;
  group.add(hood);

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.9, 12);
  const armL = new THREE.Mesh(armGeo, stdMat(MAT.hoodie, { rough: 0.7 }));
  armL.position.set(-0.5, 3.3, 0);
  armL.rotation.z = Math.PI / 8;
  group.add(armL);
  const armR = armL.clone();
  armR.position.set(0.5, 3.3, 0);
  armR.rotation.z = -Math.PI / 8;
  group.add(armR);

  // Legs (jeans)
  const legGeo = new THREE.CylinderGeometry(0.13, 0.11, 1.0, 12);
  const legL = new THREE.Mesh(legGeo, stdMat(MAT.denim, { rough: 0.6 }));
  legL.position.set(-0.15, 2.4, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.set(0.15, 2.4, 0);
  group.add(legR);

  // Feet (sneakers)
  const footGeo = new THREE.BoxGeometry(0.3, 0.15, 0.5);
  const footL = new THREE.Mesh(footGeo, stdMat(MAT.sneaker, { rough: 0.5 }));
  footL.position.set(-0.15, 1.85, 0.1);
  group.add(footL);
  const footR = footL.clone();
  footR.position.set(0.15, 1.85, 0.1);
  group.add(footR);

  // Smartphone (held in hand)
  const phoneGeo = new THREE.BoxGeometry(0.4, 0.7, 0.08);
  const phoneMat = stdMat(MAT.evBlack, { rough: 0.1, metal: 0.8 });
  const phone = new THREE.Mesh(phoneGeo, phoneMat);
  phone.position.set(0.45, 2.9, 0.15);
  phone.rotation.z = Math.PI / 10;
  group.add(phone);

  // Phone screen (glowing)
  const phoneScreenGeo = new THREE.PlaneGeometry(0.3, 0.6);
  const phoneScreenMat = stdMat(MAT.ledWhite, { emissive: MAT.ledWhite, emissiveIntensity: 0.7 });
  const phoneScreen = new THREE.Mesh(phoneScreenGeo, phoneScreenMat);
  phoneScreen.position.set(0.45, 2.9, 0.19);
  group.add(phoneScreen);

  // Backpack
  const packGeo = new THREE.BoxGeometry(0.6, 0.8, 0.25);
  const pack = new THREE.Mesh(packGeo, stdMat(MAT.jacket, { rough: 0.5 }));
  pack.position.set(0, 3.3, -0.25);
  group.add(pack);

  // Backpack straps
  const strapGeo = new THREE.BoxGeometry(0.08, 0.6, 0.05);
  const strapL = new THREE.Mesh(strapGeo, stdMat(MAT.jacket, { rough: 0.5 }));
  strapL.position.set(-0.15, 3.0, -0.35);
  group.add(strapL);
  const strapR = strapL.clone();
  strapR.position.set(0.15, 3.0, -0.35);
  group.add(strapR);

  await exportGLB(group, path.join(ROOT, "pedestrians", "pedestrian_casual_2025.glb"));
}

// ===== ENVIRONMENT: Modern streetscape with bike lanes, EV chargers, smart infrastructure =====
async function genEnvironment() {
  const group = new THREE.Group();
  group.name = "modern_street_2025";

  // --- Road surface ---
  const roadGeo = new THREE.PlaneGeometry(40, 12);
  const roadMat = stdMat(MAT.asphaltNew, { rough: 0.8 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  group.add(road);

  // --- Center dashed line ---
  const dashMat = stdMat(MAT.crosswalk, { rough: 0.7 });
  for (let i = -18; i <= 18; i += 2) {
    const dashGeo = new THREE.PlaneGeometry(0.8, 0.15);
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.rotation.x = -Math.PI / 2 + 0.01;
    dash.position.set(i, 0.01, 0);
    group.add(dash);
  }

  // --- Bike lanes (yellow-green) on both sides ---
  const bikeLaneMat = stdMat(MAT.bikeLane, { rough: 0.7 });
  const bikeLaneGeo = new THREE.PlaneGeometry(40, 2);
  const bikeLeft = new THREE.Mesh(bikeLaneGeo, bikeLaneMat);
  bikeLeft.rotation.x = -Math.PI / 2 + 0.01;
  bikeLeft.position.set(0, 0.01, 7);
  group.add(bikeLeft);
  const bikeRight = bikeLeft.clone();
  bikeRight.position.set(0, 0.01, -7);
  group.add(bikeRight);

  // Bike lane dashed lines
  const bikeLineMat = stdMat(MAT.bikeLaneLine, { rough: 0.7 });
  for (let i = -18; i <= 18; i += 1.5) {
    const lineGeo = new THREE.PlaneGeometry(0.3, 0.1);
    const lineL = new THREE.Mesh(lineGeo, bikeLineMat);
    lineL.rotation.x = -Math.PI / 2 + 0.01;
    lineL.position.set(i, 0.01, 5.5);
    group.add(lineL);
    const lineR = lineL.clone();
    lineR.position.set(i, 0.01, -5.5);
    group.add(lineR);
  }

  // --- Sidewalks ---
  const sidewalkMat = stdMat(MAT.concreteLight, { rough: 0.7 });
  const sidewalkGeo = new THREE.PlaneGeometry(40, 3);
  const sidewalkL = new THREE.Mesh(sidewalkGeo, sidewalkMat);
  sidewalkL.rotation.x = -Math.PI / 2 + 0.01;
  sidewalkL.position.set(0, 0.01, 10.5);
  group.add(sidewalkL);
  const sidewalkR = sidewalkL.clone();
  sidewalkR.position.set(0, 0.01, -10.5);
  group.add(sidewalkR);

  // --- Crosswalks ---
  const crosswalkMat = stdMat(MAT.crosswalk, { rough: 0.7 });
  const crosswalkGeo = new THREE.PlaneGeometry(3, 0.8);
  for (let i = 0; i < 4; i++) {
    const cw = new THREE.Mesh(crosswalkGeo, crosswalkMat);
    cw.rotation.x = -Math.PI / 2 + 0.01;
    cw.position.set(-15 + i * 10, 0.01, 0);
    group.add(cw);
  }

  // --- Modern LED streetlights (x4) ---
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.12, 8, 12);
  const poleMat = stdMat(MAT.streetLight, { rough: 0.4, metal: 0.8 });
  const globeGeo = new THREE.SphereGeometry(0.4, 16, 16);
  const globeMat = stdMat(MAT.streetLightGlobe, { emissive: MAT.ledWhite, emissiveIntensity: 0.8 });

  const lightPositions = [
    [-12, 0, 8], [12, 0, 8], [-12, 0, -8], [12, 0, -8],
  ];
  for (const [x, y, z] of lightPositions) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 4, z);
    group.add(pole);

    const globe = new THREE.Mesh(globeGeo, globeMat);
    globe.position.set(x, 8.2, z);
    group.add(globe);

    // LED strip around globe
    const stripGeo = new THREE.TorusGeometry(0.5, 0.05, 8, 16);
    const strip = new THREE.Mesh(stripGeo, stdMat(MAT.ledWhite, { emissive: MAT.ledWhite, emissiveIntensity: 1.0 }));
    strip.position.set(x, 8.2, z);
    group.add(strip);
  }

  // --- EV charging station ---
  const chargerGroup = new THREE.Group();
  const chargerBodyGeo = new THREE.BoxGeometry(0.8, 2.2, 0.4);
  const chargerBody = new THREE.Mesh(chargerBodyGeo, stdMat(MAT.evCharger, { rough: 0.3, metal: 0.7 }));
  chargerBody.position.y = 1.1;
  chargerGroup.add(chargerBody);

  // Screen on charger
  const chargerScreenGeo = new THREE.PlaneGeometry(0.5, 0.3);
  const chargerScreenMat = stdMat(MAT.ledBlue, { emissive: MAT.ledBlue, emissiveIntensity: 0.8 });
  const chargerScreen = new THREE.Mesh(chargerScreenGeo, chargerScreenMat);
  chargerScreen.position.set(0, 1.8, 0.21);
  chargerGroup.add(chargerScreen);

  // Cable
  const cableGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8);
  const cable = new THREE.Mesh(cableGeo, stdMat(MAT.evChargerCable, { rough: 0.5, metal: 0.6 }));
  cable.position.set(0.5, 1.0, 0);
  cable.rotation.z = Math.PI / 6;
  chargerGroup.add(cable);

  // Connector
  const connGeo = new THREE.BoxGeometry(0.15, 0.1, 0.2);
  const conn = new THREE.Mesh(connGeo, stdMat(MAT.evChargerCable, { rough: 0.5, metal: 0.6 }));
  conn.position.set(1.1, 0.2, 0);
  chargerGroup.add(conn);

  chargerGroup.position.set(-8, 0, 8.5);
  group.add(chargerGroup);

  // --- Smart traffic light ---
  const trafficGroup = new THREE.Group();
  const trafficPoleGeo = new THREE.CylinderGeometry(0.08, 0.1, 6, 12);
  const trafficPole = new THREE.Mesh(trafficPoleGeo, stdMat(MAT.trafficLight, { rough: 0.3, metal: 0.8 }));
  trafficPole.position.y = 3;
  trafficGroup.add(trafficPole);

  const trafficBoxGeo = new THREE.BoxGeometry(0.5, 1.2, 0.3);
  const trafficBox = new THREE.Mesh(trafficBoxGeo, stdMat(MAT.trafficLight, { rough: 0.3, metal: 0.8 }));
  trafficBox.position.y = 6.2;
  trafficGroup.add(trafficBox);

  // Traffic lights
  const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), stdMat(MAT.trafficRed, { emissive: MAT.trafficRed, emissiveIntensity: 0.9 }));
  redLight.position.set(0, 6.5, 0.21);
  trafficGroup.add(redLight);
  const yellowLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), stdMat(MAT.trafficYellow, { emissive: MAT.trafficYellow, emissiveIntensity: 0.9 }));
  yellowLight.position.set(0, 6.1, 0.21);
  trafficGroup.add(yellowLight);
  const greenLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), stdMat(MAT.trafficGreen, { emissive: MAT.trafficGreen, emissiveIntensity: 0.9 }));
  greenLight.position.set(0, 5.7, 0.21);
  trafficGroup.add(greenLight);

  trafficGroup.position.set(8, 0, 8.5);
  group.add(trafficGroup);

  // --- Solar panels on a pole ---
  const solarGroup = new THREE.Group();
  const solarPoleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4, 12);
  const solarPole = new THREE.Mesh(solarPoleGeo, stdMat(MAT.solarFrame, { rough: 0.3, metal: 0.8 }));
  solarPole.position.y = 2;
  solarGroup.add(solarPole);

  const solarPanelGeo = new THREE.BoxGeometry(2, 1.2, 0.05);
  const solarPanel = new THREE.Mesh(solarPanelGeo, stdMat(MAT.solarPanel, { rough: 0.1, metal: 0.85 }));
  solarPanel.position.y = 4.2;
  solarGroup.add(solarPanel);

  // Solar cells pattern
  const cellMat = stdMat(MAT.solarFrame, { rough: 0.1, metal: 0.85 });
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.01), cellMat);
      cell.position.set(-0.6 + i * 0.6, 4.2, 0.03);
      solarGroup.add(cell);
    }
  }

  solarGroup.position.set(15, 0, 8.5);
  group.add(solarGroup);

  // --- Trees (contemporary) ---
  const treeGroup = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 12);
  const trunk = new THREE.Mesh(trunkGeo, stdMat(MAT.treeBrown, { rough: 0.8 }));
  trunk.position.y = 0.75;
  treeGroup.add(trunk);

  // Multiple sphere layers for a modern tree shape
  for (let i = 0; i < 3; i++) {
    const leafGeo = new THREE.SphereGeometry(0.8 - i * 0.15, 16, 16);
    const leaf = new THREE.Mesh(leafGeo, stdMat(MAT.treeGreen, { rough: 0.7 }));
    leaf.position.y = 1.5 + i * 0.8;
    treeGroup.add(leaf);
  }

  treeGroup.position.set(-15, 0, 8.5);
  group.add(treeGroup);

  const treeGroup2 = treeGroup.clone();
  treeGroup2.position.set(15, 0, -8.5);
  group.add(treeGroup2);

  // --- Bike rack ---
  const rackGeo = new THREE.CylinderGeometry(0.05, 0.05, 2, 8);
  const rackMat = stdMat(MAT.steelMedium, { rough: 0.4, metal: 0.8 });
  const rackGroup = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(rackGeo, rackMat);
    bar.position.set(i * 0.8, 0.7, 0);
    bar.rotation.z = Math.PI / 4;
    rackGroup.add(bar);
    const bar2 = bar.clone();
    bar2.rotation.z = -Math.PI / 4;
    rackGroup.add(bar2);
  }
  rackGroup.position.set(-5, 0, 8.5);
  group.add(rackGroup);

  // --- Waste bin (smart) ---
  const binGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 16);
  const binMat = stdMat(MAT.charcoal, { rough: 0.5, metal: 0.3 });
  const bin = new THREE.Mesh(binGeo, binMat);
  bin.position.set(5, 0.4, 8.5);
  group.add(bin);

  // Bin sensor
  const sensorGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16);
  const sensor = new THREE.Mesh(sensorGeo, stdMat(MAT.ledBlue, { emissive: MAT.ledBlue, emissiveIntensity: 0.8 }));
  sensor.position.set(0, 0.45, 0.31);
  bin.add(sensor);

  await exportGLB(group, path.join(ROOT, "environment", "modern_street_2025.glb"));
}

// ===== MANIFEST GENERATION =====
function writeManifests() {
  const files = {
    buildings: ["modern_highrise_2025.glb"],
    vehicles: ["electric_sedan_2025.glb"],
    storefronts: ["modern_storefront_2025.glb"],
    ads: ["digital_billboard_2025.glb"],
    pedestrians: ["pedestrian_casual_2025.glb"],
    environment: ["modern_street_2025.glb"],
  };
  for (const [cat, list] of Object.entries(files)) {
    const manifestPath = path.join(ROOT, cat, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(list, null, 2) + "\n");
    console.log(`  [manifest] ${path.relative(ROOT, manifestPath)}`);
  }
}

// ===== MAIN =====
async function main() {
  console.log("Generating 2025 era assets...\n");

  console.log("Buildings:");
  await genBuilding();

  console.log("Vehicles:");
  await genVehicle();

  console.log("Storefronts:");
  await genStorefront();

  console.log("Ads:");
  await genAd();

  console.log("Pedestrians:");
  await genPedestrian();

  console.log("Environment:");
  await genEnvironment();

  console.log("Manifests:");
  writeManifests();

  // Clean up .gitkeep placeholders
  for (const cat of CATEGORIES) {
    const keep = path.join(ROOT, cat, ".gitkeep");
    if (fs.existsSync(keep)) fs.unlinkSync(keep);
  }

  console.log("\n✓ 2025 era assets generated successfully.");
}

main().catch((err) => {
  console.error("Generation failed:", err);
  process.exit(1);
});
