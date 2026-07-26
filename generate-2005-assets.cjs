// ===== 2005 Era Asset Generator =====
// Generates era-accurate 3D models (.glb) for the early/mid 2000s
// Assets are placed under /assets/2005/<type>/.
//
// Note: we keep this generator texture-free (no image embeds) to ensure it
// can run in Node without DOM/canvas polyfills.

const fs = require("fs");
const path = require("path");
const THREE = require("three");
const { GLTFExporter } = require("three/addons/exporters/GLTFExporter.js");

// ---- Polyfills required by GLTFExporter in Node ----

// FileReader polyfill (GLTFWriter.writeAsync uses it)
class FileReader {
  constructor() { this.result = null; this.readyState = 0; }
  readAsArrayBuffer(blob) {
    this.readyState = 2;
    if (typeof blob?.arrayBuffer === "function") {
      blob.arrayBuffer().then((buf) => { this.result = buf; if (this.onloadend) this.onloadend(); });
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

// ImageData polyfill
class ImageDataPoly {
  constructor(data, width, height) {
    if (typeof data === "number") {
      this.width = data; this.height = width;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = data; this.width = width; this.height = height;
    }
  }
}
global.ImageData = ImageDataPoly;

// document polyfill (GLTFExporter.getCanvas)
global.document = {
  createElement(tag) {
    if (tag === "canvas") return new FakeCanvas(1, 1);
    return {};
  },
};

// Minimal FakeCanvas (only used if textures were embedded, which they are not)
class FakeCanvas {
  constructor(w, h) { this.width = w; this.height = h; this._data = Buffer.alloc(w * h * 4, 0); }
  getContext() { return { fillRect() {}, getImageData() { return { data: this._data, width: this.width, height: this.height }; }, putImageData() {} }; }
  toBuffer() { return Buffer.alloc(0); }
}

const ROOT = path.join(__dirname, "assets", "2005");
const CATEGORIES = ["buildings", "vehicles", "storefronts", "ads", "pedestrians", "environment"];

for (const cat of CATEGORIES) {
  fs.mkdirSync(path.join(ROOT, cat), { recursive: true });
}

const gltfExporter = new GLTFExporter();

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
      {
        binary: true,
        embedImages: false,
        forceIndices: true,
        forcePowerOfTwoTextures: false,
      }
    );
  });
}

// ===== MATERIAL HELPERS =====
const MAT = {
  asphalt: 0x333333,
  concreteLight: 0xbfbfbf,
  sidewalk: 0xcfcfcf,
  steel: 0x708090,
  chrome: 0xc0c0c0,
  brick: 0xb22222,
  cream: 0xf5f0e6,
  glass: 0x87ceeb,
  burntOrange: 0xcc5500,
  lime: 0x66cc66,
  darkNavy: 0x0b1b3a,
  yellow: 0xffcc00,
  red: 0xcc0000,
  white: 0xffffff,
  black: 0x111111,
  teal: 0x008080,
  denim: 0x2f4f8f,
};

function stdMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.7,
    metalness: opts.metal ?? 0.0,
  });
}

function semiGlassMat(color, opacity = 0.6) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });
}

// ===== BUILDING: big-box retail (contemporary 2005) =====
async function genBuilding() {
  const group = new THREE.Group();
  group.name = "bigbox_2005";

  const base = new THREE.Mesh(new THREE.BoxGeometry(14, 4.2, 10), stdMat(MAT.cream, { rough: 0.95 }));
  base.position.y = 2.1;
  base.name = "main_block";
  group.add(base);

  // Large glass facade
  const facade = new THREE.Mesh(new THREE.BoxGeometry(14, 3.8, 0.35), semiGlassMat(MAT.glass, 0.55));
  facade.position.set(0, 2.0, 5.18);
  facade.name = "glass_facade";
  group.add(facade);

  // Vertical mullions (thin pillars)
  const mullionGeo = new THREE.BoxGeometry(0.08, 3.7, 0.15);
  for (const x of [-4.6, -3.2, -1.8, -0.4, 0.4, 1.8, 3.2, 4.6]) {
    const m = new THREE.Mesh(mullionGeo, stdMat(MAT.steel, { rough: 0.6, metal: 0.7 }));
    m.position.set(x, 2.05, 5.20);
    group.add(m);
  }

  // Entrance canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.45, 2.2), stdMat(MAT.steel, { rough: 0.4, metal: 0.8 }));
  canopy.position.set(0, 4.15, 0);
  canopy.name = "entry_canopy";
  group.add(canopy);

  // LED-style sign panel
  const sign = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.75, 0.15), semiGlassMat(MAT.yellow, 0.9));
  sign.position.set(0, 4.6, 5.21);
  sign.name = "led_sign";
  group.add(sign);

  // Parking lot strip (as pavement) around store
  const pavement = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), stdMat(MAT.asphalt, { rough: 0.95, metal: 0.05 }));
  pavement.rotation.x = -Math.PI / 2;
  pavement.position.set(0, 0.01, 0);
  pavement.name = "pavement";
  group.add(pavement);

  await exportGLB(group, path.join(ROOT, "buildings", "bigbox_2005.glb"));
}

// ===== VEHICLE: early 2000s hybrid/crossover (stylized) =====
async function genVehicle() {
  const group = new THREE.Group();
  group.name = "hybrid_crossover_2005";

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.65, 1.9), stdMat(MAT.burntOrange, { rough: 0.5 }));
  chassis.position.y = 0.72;
  group.add(chassis);

  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-2.4, 0);
  bodyShape.lineTo(2.4, 0);
  bodyShape.lineTo(2.2, 0.9);
  bodyShape.lineTo(0.2, 1.25);
  bodyShape.lineTo(-0.2, 1.25);
  bodyShape.lineTo(-2.2, 0.9);
  bodyShape.lineTo(-2.4, 0);

  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.08, curveSegments: 6 });
  const body = new THREE.Mesh(bodyGeo, stdMat(MAT.lime, { rough: 0.35 }));
  body.position.set(0, 0.72, -0.8);
  group.add(body);

  // Windows
  const window = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 0.18), semiGlassMat(MAT.glass, 0.45));
  window.position.set(0, 1.35, -0.72);
  group.add(window);

  // Wheels
  const tireGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.2, 18);
  const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.15, 14);
  const tireMat = stdMat(MAT.black, { rough: 0.95, metal: 0.0 });
  const rimMat = stdMat(MAT.chrome, { rough: 0.25, metal: 0.9 });

  for (const [x, z] of [[-1.7, 0.78], [-1.7, -0.78], [1.7, 0.78], [1.7, -0.78]]) {
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(x, 0.48, z);
    group.add(tire);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(x, 0.48, z);
    group.add(rim);
  }

  // Grille
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.55), stdMat(0x222222, { rough: 0.6 }));
  grille.position.set(-2.35, 1.05, 0);
  grille.rotation.y = Math.PI;
  group.add(grille);

  // Hybrid badge
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.1), stdMat(MAT.teal, { rough: 0.35, metal: 0.6 }));
  badge.position.set(-2.25, 1.1, 0.42);
  group.add(badge);

  await exportGLB(group, path.join(ROOT, "vehicles", "hybrid_crossover_2005.glb"));
}

// ===== STOREFRONT: strip-mall shopfront (early 2000s) =====
async function genStorefront() {
  const group = new THREE.Group();
  group.name = "stripstore_2005";

  const facade = new THREE.Mesh(new THREE.BoxGeometry(10.5, 3.2, 0.3), stdMat(0xd9d0c2, { rough: 0.95 }));
  facade.position.set(0, 1.6, 0);
  group.add(facade);

  // Store windows
  const windowMat = semiGlassMat(MAT.glass, 0.55);
  const winGeo = new THREE.PlaneGeometry(4.0, 2.0);
  for (const [x] of [[-2.3], [0.0], [2.3]]) {
    const w = new THREE.Mesh(winGeo, windowMat);
    w.position.set(x, 1.65, 0.31);
    w.rotation.y = 0;
    group.add(w);
  }

  // Roller door
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.4, 0.12), stdMat(0x777777, { rough: 0.7 }));
  door.position.set(0, 1.2, 0.31);
  group.add(door);

  // Awning
  const awning = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.25, 1.8), stdMat(MAT.burntOrange, { rough: 0.6, metal: 0.1 }));
  awning.position.set(0, 2.95, 0.9);
  group.add(awning);

  // Period-correct storefront sign
  const sign = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.55, 0.12), semiGlassMat(0xffcc33, 0.95));
  sign.position.set(0, 2.6, 0.32);
  group.add(sign);

  await exportGLB(group, path.join(ROOT, "storefronts", "stripstore_2005.glb"));
}

// ===== AD: roadside billboard / digital billboard (2005 vibe) =====
async function genAd() {
  const group = new THREE.Group();
  group.name = "billboard_2005";

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 16), stdMat(MAT.steel, { rough: 0.6, metal: 0.8 }));
  pole.position.set(0, 1.6, 0);
  group.add(pole);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.4, 0.08), stdMat(MAT.darkNavy, { rough: 0.4, metal: 0.2 }));
  frame.position.set(0, 2.5, 0.02);
  group.add(frame);

  // Display surface (like LCD/LED panel)
  const display = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.15), semiGlassMat(0x00aaff, 0.85));
  display.position.set(0, 2.5, 0.06);
  group.add(display);

  // Text bars (approximation)
  const barMat = stdMat(0xffcc00, { rough: 0.2, metal: 0.7 });
  for (const [i, y] of [[-1.0, 2.05], [0, 2.35], [1.0, 2.65]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 0.02), barMat);
    bar.position.set(i * 0.6, y, 0.08);
    group.add(bar);
  }

  await exportGLB(group, path.join(ROOT, "ads", "billboard_2005.glb"));
}

// ===== PEDESTRIAN: 2005 city commuter =====
async function genPedestrian() {
  const group = new THREE.Group();
  group.name = "pedestrian_2005_commuter";

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 14), stdMat(0xf1c27d, { rough: 0.75 }));
  head.position.y = 2.75;
  group.add(head);

  // Hair (cap)
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.285, 14, 14), stdMat(MAT.darkNavy, { rough: 0.5 }));
  hair.position.y = 2.83;
  hair.scale.set(1, 0.85, 1);
  group.add(hair);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.85, 0.28), stdMat(0xff6699, { rough: 0.85 }));
  torso.position.y = 2.15;
  group.add(torso);

  // Arms
  const armMat = stdMat(0xff6699, { rough: 0.85 });
  const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.65, 10);
  for (const [x, z, r] of [[-0.32, 0.0, Math.PI / 10], [0.32, 0.0, -Math.PI / 10]]) {
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(x, 1.95, z);
    arm.rotation.z = r;
    group.add(arm);
  }

  // Jeans
  const pants = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.28), stdMat(MAT.denim, { rough: 0.85 }));
  pants.position.y = 1.45;
  group.add(pants);

  // Shoes
  const shoeMat = stdMat(0x2b2b2b, { rough: 0.95 });
  const shoeGeo = new THREE.BoxGeometry(0.25, 0.12, 0.55);
  for (const [x] of [[-0.14], [0.14]]) {
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.position.set(x, 0.93, 0.0);
    group.add(shoe);
  }

  // Backpack
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.18), stdMat(MAT.asphalt, { rough: 0.9 }));
  back.position.set(0.2, 2.25, -0.15);
  group.add(back);

  // Phone
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.02), stdMat(MAT.chrome, { rough: 0.25, metal: 0.9 }));
  phone.position.set(0.48, 1.95, 0.15);
  group.add(phone);

  await exportGLB(group, path.join(ROOT, "pedestrians", "pedestrian_2005_commuter.glb"));
}

// ===== ENVIRONMENT: suburban/urban street scene (2005 characteristics) =====
async function genEnvironment() {
  const group = new THREE.Group();
  group.name = "street_scene_2005";

  // Asphalt road
  const road = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), stdMat(MAT.asphalt, { rough: 0.98, metal: 0.05 }));
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  group.add(road);

  // Dashed centerline
  const dashGeo = new THREE.BoxGeometry(1.6, 0.03, 0.08);
  const dashMat = stdMat(MAT.yellow, { rough: 0.8 });
  let idx = 0;
  for (let x = -12; x <= 12; x += 3) {
    // alternate gaps
    if (idx % 2 === 0) {
      const d = new THREE.Mesh(dashGeo, dashMat);
      d.position.set(x, 0.03, 0);
      group.add(d);
    }
    idx++;
  }

  // Crosswalk (early-2000s zebra stripes)
  const crossGeo = new THREE.PlaneGeometry(9, 0.6);
  const whiteMat = stdMat(0xffffff, { rough: 0.9 });
  const cross = new THREE.Mesh(crossGeo, whiteMat);
  cross.rotation.x = -Math.PI / 2;
  cross.position.set(0, 0.031, 0);
  group.add(cross);

  // Add stripe strips (so it reads as crosswalk)
  const stripeGeo = new THREE.BoxGeometry(0.55, 0.01, 0.12);
  for (let i = -4; i <= 4; i++) {
    const s = new THREE.Mesh(stripeGeo, whiteMat);
    s.position.set(i * 0.95, 0.035, 0.02);
    group.add(s);
  }

  // Sidewalks
  const sidewalkL = new THREE.Mesh(new THREE.PlaneGeometry(30, 2.8), stdMat(MAT.sidewalk, { rough: 0.95 }));
  sidewalkL.rotation.x = -Math.PI / 2;
  sidewalkL.position.set(0, 0.01, 5.2);
  group.add(sidewalkL);

  const sidewalkR = sidewalkL.clone();
  sidewalkR.position.set(0, 0.01, -5.2);
  group.add(sidewalkR);

  // Street furniture: parking meter + trash can
  const meter = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.25, 12), stdMat(MAT.steel, { rough: 0.7, metal: 0.7 }));
  meter.position.set(10, 0.62, 2.2);
  group.add(meter);

  const trash = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.65, 14), stdMat(0x444444, { rough: 0.9 }));
  trash.position.set(-10, 0.33, 2.2);
  group.add(trash);

  // Streetlight (standard straight pole)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7.5, 16), stdMat(MAT.steel, { rough: 0.6, metal: 0.85 }));
  pole.position.set(12, 3.75, 0);
  group.add(pole);

  const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.25), semiGlassMat(MAT.yellow, 0.95));
  head.position.set(12, 7.0, 0);
  group.add(head);

  const pole2 = pole.clone();
  pole2.position.set(-12, 3.75, 0);
  group.add(pole2);

  const head2 = head.clone();
  head2.position.set(-12, 7.0, 0);
  group.add(head2);

  // Hydrant
  const hydrant = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 1.1, 12), stdMat(MAT.red, { rough: 0.6 }));
  hydrant.position.set(4, 0.55, 3.0);
  group.add(hydrant);

  await exportGLB(group, path.join(ROOT, "environment", "street_scene_2005.glb"));
}

function writeManifests() {
  const files = {
    buildings: ["bigbox_2005.glb"],
    vehicles: ["hybrid_crossover_2005.glb"],
    storefronts: ["stripstore_2005.glb"],
    ads: ["billboard_2005.glb"],
    pedestrians: ["pedestrian_2005_commuter.glb"],
    environment: ["street_scene_2005.glb"],
  };

  for (const [cat, list] of Object.entries(files)) {
    const manifestPath = path.join(ROOT, cat, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(list, null, 2) + "\n");
    console.log(`  [manifest] ${path.relative(ROOT, manifestPath)}`);
  }
}

async function main() {
  console.log("Generating 2005 era assets...\n");

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

  console.log("\n✓ 2005 era assets generated successfully.");
}

main().catch((err) => {
  console.error("Generation failed:", err);
  process.exit(1);
});
