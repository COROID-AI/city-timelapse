// ===== 1965 Era Asset Generator =====
// Generates era-accurate 3D models (.glb) and textures (.png) for the 1960s
// using Three.js procedural geometry. Assets are placed under /assets/1965/<type>/.

const fs = require("fs");
const path = require("path");
const THREE = require("three");
const { GLTFExporter } = require("three/addons/exporters/GLTFExporter.js");

// FileReader polyfill for Node.js (required by GLTFExporter's writeAsync)
// Handles Blob objects and uses onloadend callbacks as the exporter expects.
class FileReader {
  constructor() { this.result = null; this.readyState = 0; }
  readAsArrayBuffer(blob) {
    this.readyState = 2;
    if (typeof blob?.arrayBuffer === "function") {
      // Blob from Node.js
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
// Returns a FakeCanvas that has a working 2D context.
global.document = {
  createElement(tag) {
    if (tag === "canvas") {
      return new FakeCanvas(1, 1);
    }
    return {};
  },
};

const ROOT = path.join(__dirname, "assets", "1965");
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
 * Uses DataTexture instead of CanvasTexture so GLTFExporter uses the
 * image.data path (putImageData) rather than requiring HTMLCanvasElement.
 */
function makeTexture(name, width, height, drawFn) {
  const canvas = document_like_canvas(width, height);
  const ctx = canvas.getContext("2d");
  drawFn(ctx, width, height);
  const pngPath = path.join(ROOT, "textures", name + ".png");
  fs.mkdirSync(path.dirname(pngPath), { recursive: true });
  const buf = canvas.toBuffer("image/png");
  fs.writeFileSync(pngPath, buf);
  // Create DataTexture from raw pixel data
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
  // node-canvas
  const { createCanvas } = require("canvas");
  canvasImpl = (w, h) => createCanvas(w, h);
} catch (e) {
  // Fallback: tiny PNG writer using a raw RGBA->PNG encoder
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
  getContext() {
    return new FakeCtx(this);
  }
  toBuffer() {
    return pngEncode(this.width, this.height, this._data);
  }
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
  translate(x, y) {
    this._offsetX += x;
    this._offsetY += y;
  }
  scale(sx, sy) {
    this._scaleX *= sx;
    this._scaleY *= sy;
  }
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
    // simple horizontal/vertical line
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
  fillText() {} // no-op in fallback
  beginPath() {}
  moveTo() {}
  lineTo() {}
  closePath() {}
  fill() {}
  stroke() {}
  drawImage(src, dx, dy, dw, dh) {
    // Copy pixel data from source canvas to this canvas
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
  const len = 8 + 25 * (1 + Math.ceil(w * 4 + 1) * h);
  const chunks = [];
  chunks.push(Buffer.from([137,80,78,71,13,10,26,10])); // signature
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  chunks.push(chunk("IHDR", ihdr));
  // IDAT
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
  // IEND
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
const MAT = {
  // 1960s palette
  turquoise: 0x40e0d0,
  avocado: 0x9a9d2b,
  harvestGold: 0xc9a66b,
  burntOrange: 0xcc5500,
  lime: 0x32cd32,
  mustard: 0xffdb58,
  hotPink: 0xff69b4,
  teal: 0x008080,
  cream: 0xf5f5dc,
  brick: 0xb22222,
  steel: 0x708090,
  chrome: 0xc0c0c0,
  asphalt: 0x333333,
  white: 0xffffff,
  black: 0x111111,
  red: 0xcc0000,
  yellow: 0xffcc00,
  green: 0x228b22,
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
  return mat;
}

// ===== BUILDING: Googie-style diner / retail =====
async function genBuilding() {
  const group = new THREE.Group();
  group.name = "googie_building";

  // Main structure: box with cantilevered roof
  const baseGeo = new THREE.BoxGeometry(8, 5, 6);
  const base = new THREE.Mesh(baseGeo, stdMat(MAT.cream, { roughness: 0.85 }));
  base.name = "main_block";
  group.add(base);

  // Googie roof: steep angled plane (boomerang shape)
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-4.5, -0.2);
  roofShape.lineTo(4.5, -0.2);
  roofShape.lineTo(3.5, 2.5);
  roofShape.lineTo(-3.5, 2.5);
  roofShape.lineTo(-4.5, -0.2);
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 6, bevelEnabled: false, curveSegments: 2 });
  roofGeo.rotateX(Math.PI / 2);
  roofGeo.translate(0, 5, 0);
  const roof = new THREE.Mesh(roofGeo, stdMat(MAT.burntOrange, { roughness: 0.7 }));
  roof.name = "googie_roof";
  group.add(roof);

  // Large plate-glass window (1960s commercial)
  const winGeo = new THREE.PlaneGeometry(5, 2.5);
  const winMat = new THREE.MeshBasicMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const win = new THREE.Mesh(winGeo, winMat);
  win.rotation.y = Math.PI;
  win.position.set(0, 1.2, 3.001);
  win.name = "storefront_window";
  group.add(win);

  // Two pillars (1960s Googie supports)
  const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, 5, 8);
  for (const x of [-3.2, 3.2]) {
    const p = new THREE.Mesh(pillarGeo, stdMat(MAT.steel, { metal: 0.6 }));
    p.position.set(x, 2.5, -2.5);
    group.add(p);
  }

  // Chrome trim band
  const trimGeo = new THREE.BoxGeometry(8, 0.3, 0.2);
  const trim = new THREE.Mesh(trimGeo, stdMat(MAT.chrome, { metal: 0.9, roughness: 0.2 }));
  trim.position.set(0, 3.2, 3.05);
  group.add(trim);

  await exportGLB(group, path.join(ROOT, "buildings", "googie_diner.glb"));
}

// ===== VEHICLE: 1965 muscle car (e.g., Mustang-style fastback) =====
async function genVehicle() {
  const group = new THREE.Group();
  group.name = "muscle_car_1965";

  // Chassis
  const chassisGeo = new THREE.BoxGeometry(5, 0.5, 1.8);
  const chassis = new THREE.Mesh(chassisGeo, stdMat(MAT.burntOrange, { roughness: 0.4 }));
  chassis.position.y = 0.7;
  chassis.name = "chassis";
  group.add(chassis);

  // Body (fastback silhouette)
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-2.4, 0);
  bodyShape.lineTo(2.4, 0);
  bodyShape.lineTo(2.2, 0.8);
  bodyShape.lineTo(0.5, 1.2);
  bodyShape.lineTo(-0.5, 1.2);
  bodyShape.lineTo(-2.2, 0.8);
  bodyShape.lineTo(-2.4, 0);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 1.6, bevelEnabled: true, curveSegments: 4, bevelThickness: 0.1 });
  bodyGeo.translate(0, 0.7, -0.8);
  const body = new THREE.Mesh(bodyGeo, stdMat(MAT.turquoise, { roughness: 0.3 }));
  body.name = "body";
  group.add(body);

  // Hood bulge
  const bulgeGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.2, 16);
  bulgeGeo.rotateZ(Math.PI / 2);
  bulgeGeo.translate(0.6, 1.1, 0);
  const bulge = new THREE.Mesh(bulgeGeo, stdMat(MAT.turquoise, { roughness: 0.3 }));
  group.add(bulge);

  // Wheels (5-spoke mag wheels - period correct)
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 16);
  const wheelMat = stdMat(MAT.chrome, { metal: 0.9, roughness: 0.2 });
  const wheelPositions = [
    [-1.6, 0.6, 0.95], [-1.6, 0.6, -0.95],
    [1.6, 0.6, 0.95], [1.6, 0.6, -0.95],
  ];
  for (const [x, y, z] of wheelPositions) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, y, z);
    w.rotation.x = Math.PI / 2;
    w.name = "wheel";
    group.add(w);
  }

  // Front grille
  const grilleGeo = new THREE.PlaneGeometry(1.2, 0.4);
  const grilleMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const grille = new THREE.Mesh(grilleGeo, grilleMat);
  grille.rotation.y = Math.PI;
  grille.position.set(-2.35, 1.0, 0);
  group.add(grille);

  // Rear fins (iconic 1960s tailfins)
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.1, 0);
  finShape.lineTo(0.15, 0.8);
  finShape.lineTo(0, 0.8);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.1, bevelEnabled: false });
  for (const x of [-2.0, 2.0]) {
    const fin = new THREE.Mesh(finGeo, stdMat(MAT.turquoise, { roughness: 0.3 }));
    fin.position.set(x, 1.7, 0);
    fin.rotation.y = x > 0 ? Math.PI : 0;
    group.add(fin);
  }

  await exportGLB(group, path.join(ROOT, "vehicles", "muscle_car_1965.glb"));
}

// ===== STOREFRONT: 1960s diner / record shop =====
async function genStorefront() {
  const group = new THREE.Group();
  group.name = "record_shop_storefront";

  // Marquee canopy (Googie-style)
  const marqueeShape = new THREE.Shape();
  marqueeShape.moveTo(-3, 0);
  marqueeShape.lineTo(3, 0);
  marqueeShape.lineTo(2.8, 0.1);
  marqueeShape.lineTo(-2.8, 0.1);
  const marqueeGeo = new THREE.ExtrudeGeometry(marqueeShape, { depth: 2.2, bevelEnabled: false });
  marqueeGeo.translate(-3, 3.2, -1.1);
  const marquee = new THREE.Mesh(marqueeGeo, stdMat(MAT.hotPink, { roughness: 0.5 }));
  group.add(marquee);

  // Neon tube lettering (simplified as glowing tubes)
  const tubeGeo = new THREE.TorusGeometry(0.08, 0.03, 8, 24);
  const neonMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const letters = [
    { pos: [-1.8, 3.25, 0], rot: 0 },
    { pos: [-1.2, 3.25, 0], rot: 0 },
    { pos: [-0.6, 3.25, 0], rot: 0 },
    { pos: [0, 3.25, 0], rot: 0 },
    { pos: [0.6, 3.25, 0], rot: 0 },
  ];
  for (const l of letters) {
    const t = new THREE.Mesh(tubeGeo, neonMat);
    t.position.set(...l.pos);
    t.rotation.x = Math.PI / 2;
    group.add(t);
  }

  // Storefront facade
  const facadeGeo = new THREE.BoxGeometry(6, 3, 0.3);
  const facade = new THREE.Mesh(facadeGeo, stdMat(MAT.avocado, { roughness: 0.9 }));
  facade.position.set(0, 1.5, 0);
  group.add(facade);

  // Plate glass door
  const doorGeo = new THREE.PlaneGeometry(1.5, 2.2);
  const doorMat = new THREE.MeshBasicMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 1.1, 0.01);
  group.add(door);

  // Vinyl record poster (texture)
  const posterTex = makeTexture("record_poster", 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#222222";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ff69b4";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("RECORDS", w / 2, h / 2 - 20);
    ctx.fillStyle = "#ffff00";
    ctx.font = "24px sans-serif";
    ctx.fillText("THE BEAT", w / 2, h / 2 + 30);
  });
  const posterGeo = new THREE.PlaneGeometry(1.2, 1.6);
  const posterMat = new THREE.MeshBasicMaterial({ map: posterTex, side: THREE.DoubleSide });
  const poster = new THREE.Mesh(posterGeo, posterMat);
  poster.position.set(-2.2, 1.8, 0.01);
  group.add(poster);

  await exportGLB(group, path.join(ROOT, "storefronts", "record_shop.glb"));
}

// ===== ADVERTISEMENT: 1960s neon/electric sign =====
async function genAd() {
  const group = new THREE.Group();
  group.name = "neon_sign_1965";

  // Sign backing
  const backGeo = new THREE.BoxGeometry(4, 2.5, 0.2);
  const back = new THREE.Mesh(backGeo, stdMat(MAT.black, { roughness: 0.3 }));
  group.add(back);

  // Neon tubes forming "MOTEL" (period advertising)
  const neonMat = new THREE.MeshBasicMaterial({ color: 0xff69b4 });
  const tubeGeo = new THREE.TorusGeometry(0.06, 0.025, 8, 24);
  const positions = [
    [-1.5, 0.6, 0.1], [-1.1, 0.6, 0.1], [-0.7, 0.6, 0.1], // M
    [-0.2, 0.6, 0.1], [0.2, 0.6, 0.1], [0.6, 0.6, 0.1],   // OTEL
    [1.1, 0.6, 0.1], [1.5, 0.6, 0.1],
  ];
  for (const p of positions) {
    const t = new THREE.Mesh(tubeGeo, neonMat);
    t.position.set(...p);
    t.rotation.x = Math.PI / 2;
    group.add(t);
  }

  // Arrow pointer
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0);
  arrowShape.lineTo(0.6, 0.4);
  arrowShape.lineTo(0.2, 0.4);
  arrowShape.lineTo(0.2, 0.8);
  arrowShape.lineTo(-0.2, 0.8);
  arrowShape.lineTo(-0.2, 0.4);
  arrowShape.lineTo(-0.6, 0.4);
  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, { depth: 0.1, bevelEnabled: false });
  arrowGeo.translate(0, -0.8, 0.1);
  const arrow = new THREE.Mesh(arrowGeo, neonMat);
  group.add(arrow);

  // Advertisement poster texture
  const adTex = makeTexture("coffee_ad", 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#cc5500";
    ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("COFFEE", w / 2, h / 2 - 10);
    ctx.fillStyle = "#000";
    ctx.font = "20px sans-serif";
    ctx.fillText("5¢", w / 2, h / 2 + 40);
  });
  const adGeo = new THREE.PlaneGeometry(2, 1.5);
  const adMat = new THREE.MeshBasicMaterial({ map: adTex, side: THREE.DoubleSide });
  const adPlane = new THREE.Mesh(adGeo, adMat);
  adPlane.position.set(0, -0.7, 0.15);
  group.add(adPlane);

  await exportGLB(group, path.join(ROOT, "ads", "neon_motel_sign.glb"));
}

// ===== PEDESTRIAN: 1960s stylized figure =====
async function genPedestrian() {
  const group = new THREE.Group();
  group.name = "pedestrian_1965";

  // Head
  const headGeo = new THREE.SphereGeometry(0.25, 12, 12);
  const head = new THREE.Mesh(headGeo, stdMat(0xf1c27d, { roughness: 0.7 }));
  head.position.y = 2.6;
  group.add(head);

  // Torso
  const torsoGeo = new THREE.BoxGeometry(0.5, 0.7, 0.25);
  const torso = new THREE.Mesh(torsoGeo, stdMat(MAT.burntOrange, { roughness: 0.9 }));
  torso.position.y = 2.1;
  group.add(torso);

  // Arms (holding a record / 1960s accessory)
  const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.9, 8);
  const armL = new THREE.Mesh(armGeo, stdMat(0xf1c227d, { roughness: 0.9 }));
  armL.position.set(-0.35, 2.0, 0);
  armL.rotation.z = Math.PI / 8;
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, stdMat(0xf1c227d, { roughness: 0.9 }));
  armR.position.set(0.35, 2.0, 0);
  armR.rotation.z = -Math.PI / 8;
  group.add(armR);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.9, 8);
  const legL = new THREE.Mesh(legGeo, stdMat(MAT.steel, { roughness: 0.8 }));
  legL.position.set(-0.12, 1.4, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, stdMat(MAT.steel, { roughness: 0.8 }));
  legR.position.set(0.12, 1.4, 0);
  group.add(legR);

  // Poodle skirt (1960s silhouette - flared)
  const skirtShape = new THREE.Shape();
  skirtShape.moveTo(-0.5, 0);
  skirtShape.lineTo(0.5, 0);
  skirtShape.lineTo(0.6, -0.6);
  skirtShape.lineTo(-0.6, -0.6);
  const skirtGeo = new THREE.ExtrudeGeometry(skirtShape, { depth: 0.2, bevelEnabled: false });
  skirtGeo.translate(0, 1.7, -0.1);
  const skirt = new THREE.Mesh(skirtGeo, stdMat(MAT.hotPink, { roughness: 0.9 }));
  group.add(skirt);

  await exportGLB(group, path.join(ROOT, "pedestrians", "pedestrian_poodle_skirt.glb"));
}

// ===== ENVIRONMENT: 1960s street scene =====
async function genEnvironment() {
  const group = new THREE.Group();
  group.name = "street_scene_1965";

  // Road (wider lanes - 1960s characteristic)
  const roadGeo = new THREE.PlaneGeometry(20, 8);
  const roadMat = stdMat(MAT.asphalt, { roughness: 0.95, metal: 0.1 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.name = "road";
  group.add(road);

  // Center line (dashed - 1960s style)
  const dashGeo = new THREE.BoxGeometry(1.5, 0.05, 0.1);
  const dashMat = stdMat(MAT.yellow, { roughness: 0.8 });
  for (let i = -8; i <= 8; i += 4) {
    const d = new THREE.Mesh(dashGeo, dashMat);
    d.position.set(i, 0.02, 0);
    group.add(d);
  }

  // Sidewalk
  const sideGeo = new THREE.PlaneGeometry(20, 2);
  const sideMat = stdMat(0xcccccc, { roughness: 0.9 });
  for (const z of [5, -5]) {
    const s = new THREE.Mesh(sideGeo, sideMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(0, 0.02, z);
    group.add(s);
  }

  // Period streetlight (cobra-style, 1960s)
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 6, 8);
  const pole = new THREE.Mesh(poleGeo, stdMat(MAT.steel, { metal: 0.8 }));
  pole.position.set(8, 3, 0);
  group.add(pole);

  const headGeo = new THREE.BoxGeometry(1.5, 0.5, 0.5);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(8, 5.8, 0);
  group.add(head);

  // Another streetlight
  const pole2 = pole.clone();
  pole2.position.set(-8, 3, 0);
  group.add(pole2);
  const head2 = new THREE.Mesh(headGeo, headMat);
  head2.position.set(-8, 5.8, 0);
  group.add(head2);

  // Fire hydrant (1960s style)
  const hydrantGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.2, 12);
  const hydrant = new THREE.Mesh(hydrantGeo, stdMat(MAT.red, { roughness: 0.5 }));
  hydrant.position.set(5, 0.6, 3);
  group.add(hydrant);
  const capGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 12);
  const cap = new THREE.Mesh(capGeo, stdMat(MAT.red, { roughness: 0.5 }));
  cap.position.set(5, 1.25, 3);
  group.add(cap);

  // Mailbox (1960s USPS style)
  const boxGeo = new THREE.BoxGeometry(0.4, 0.6, 0.3);
  const box = new THREE.Mesh(boxGeo, stdMat(MAT.red, { roughness: 0.6 }));
  box.position.set(-5, 0.8, 3);
  group.add(box);
  const flagGeo = new THREE.BoxGeometry(0.5, 0.05, 0.05);
  const flag = new THREE.Mesh(flagGeo, stdMat(MAT.red, { roughness: 0.6 }));
  flag.position.set(-4.7, 1.0, 3);
  flag.rotation.z = Math.PI / 4;
  group.add(flag);

  await exportGLB(group, path.join(ROOT, "environment", "street_scene_1965.glb"));
}

// ===== MANIFEST GENERATION =====
function writeManifests() {
  const files = {
    buildings: ["googie_diner.glb"],
    vehicles: ["muscle_car_1965.glb"],
    storefronts: ["record_shop.glb"],
    ads: ["neon_motel_sign.glb"],
    pedestrians: ["pedestrian_poodle_skirt.glb"],
    environment: ["street_scene_1965.glb"],
  };
  for (const [cat, list] of Object.entries(files)) {
    const manifestPath = path.join(ROOT, cat, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(list, null, 2) + "\n");
    console.log(`  [manifest] ${path.relative(ROOT, manifestPath)}`);
  }
}

// ===== MAIN =====
async function main() {
  console.log("Generating 1965 era assets...\n");

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

  console.log("\n✓ 1965 era assets generated successfully.");
}

main().catch((err) => {
  console.error("Generation failed:", err);
  process.exit(1);
});
