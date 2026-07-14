import * as THREE from 'three';

// Each vehicle is a Group. userData.materials holds all materials for fading.
// userData.update(dt) drives motion; userData.setEmissive scales night glow.

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.5, metalness: opts.metalness ?? 0.3,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: true
  });
}

function collectMaterials(group) {
  const set = new Set();
  group.traverse((c) => { if (c.isMesh) { Array.isArray(c.material) ? c.material.forEach((m) => set.add(m)) : set.add(c.material); } });
  return [...set];
}

// ---------- Vintage (1945) ----------
function makeVintage(color) {
  const g = new THREE.Group();
  const body = mat(color, { roughness: 0.5, metalness: 0.4 });
  const dark = mat('#1a1a1a', { roughness: 0.6 });
  const chrome = mat('#cccccc', { roughness: 0.2, metalness: 0.9 });
  const glass = mat('#2a3340', { roughness: 0.1, metalness: 0.5 });
  // main body
  const main = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 4.0), body);
  main.position.y = 0.9; g.add(main);
  // cabin (rounded-ish)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.0), body);
  cabin.position.set(0, 1.5, -0.1); g.add(cabin);
  // roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.8), body);
  roof.position.set(0, 1.86, -0.1); g.add(roof);
  // windshield
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.1), glass);
  ws.position.set(0, 1.5, 0.95); ws.rotation.x = -0.2; g.add(ws);
  // headlights (round)
  [-0.65, 0.65].forEach((x) => {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), chrome);
    hl.position.set(x, 0.95, 2.0); g.add(hl);
  });
  // fenders / running boards silhouette
  const fender = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 3.6), mat(color, { roughness: 0.6 }));
  fender.position.y = 0.7; g.add(fender);
  // wheels
  const wgeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wgeo, dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w);
  });
  // bumper
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 0.18), chrome);
  bumper.position.set(0, 0.7, 2.05); g.add(bumper);
  g.userData.materials = collectMaterials(g);
  return g;
}

// ---------- Classic (1965) ----------
function makeClassic(color) {
  const g = new THREE.Group();
  const body = mat(color, { roughness: 0.35, metalness: 0.6 });
  const dark = mat('#1a1a1a', { roughness: 0.6 });
  const chrome = mat('#cccccc', { roughness: 0.2, metalness: 0.9 });
  const glass = mat('#3a4a5a', { roughness: 0.1, metalness: 0.4 });
  const main = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.6), body);
  main.position.y = 0.8; g.add(main);
  // sloped hood/trunk
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 2.4), body);
  cabin.position.set(0, 1.4, -0.2); g.add(cabin);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.1), glass);
  ws.position.set(0, 1.45, 1.0); ws.rotation.x = -0.35; g.add(ws);
  const wb = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 0.1), glass);
  wb.position.set(0, 1.45, -1.4); wb.rotation.x = 0.35; g.add(wb);
  [-0.7, 0.7].forEach((x) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.1), chrome);
    hl.position.set(x, 0.85, 2.3); g.add(hl);
  });
  const wgeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12);
  [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wgeo, dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.45, z); g.add(w);
  });
  g.userData.materials = collectMaterials(g);
  return g;
}

// ---------- Retro 80 (1985) ----------
function makeRetro80(color) {
  const g = new THREE.Group();
  const body = mat(color, { roughness: 0.3, metalness: 0.5 });
  const dark = mat('#101018', { roughness: 0.5 });
  const glass = mat('#1a1a28', { roughness: 0.05, metalness: 0.6 });
  const strip = mat('#ff2bd6', { emissive: '#ff2bd6', emissiveIntensity: 2, roughness: 0.3 });
  const main = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.2), body);
  main.position.y = 0.75; g.add(main);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.6, 2.2), body);
  cabin.position.set(0, 1.3, -0.1); g.add(cabin);
  // angular boxy greenhouse
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.48, 0.08), glass);
  ws.position.set(0, 1.35, 1.05); g.add(ws);
  // neon underglow strip
  const ug = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 4.0), strip);
  ug.position.y = 0.5; g.add(ug);
  const wgeo = new THREE.CylinderGeometry(0.43, 0.43, 0.28, 12);
  [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wgeo, dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.43, z); g.add(w);
  });
  g.userData.materials = collectMaterials(g);
  return g;
}

// ---------- Modern sedan (2005) ----------
function makeModern(color) {
  const g = new THREE.Group();
  const body = mat(color, { roughness: 0.25, metalness: 0.7 });
  const dark = mat('#0a0a0a', { roughness: 0.6 });
  const glass = mat('#2a3a4a', { roughness: 0.05, metalness: 0.5 });
  const main = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 4.5), body);
  main.position.y = 0.7; g.add(main);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.3), body);
  cabin.position.set(0, 1.2, -0.1); g.add(cabin);
  // rounded windshield
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.08), glass);
  ws.position.set(0, 1.25, 1.0); g.add(ws);
  [-0.65, 0.65].forEach((x) => {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mat('#fff8e0', { emissive: '#fff8e0', emissiveIntensity: 0.4 }));
    hl.position.set(x, 0.8, 2.2); g.add(hl);
  });
  const wgeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 14);
  [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wgeo, dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w);
  });
  g.userData.materials = collectMaterials(g);
  return g;
}

// ---------- EV (2025) ----------
function makeEV(color) {
  const g = new THREE.Group();
  const body = mat(color, { roughness: 0.2, metalness: 0.7 });
  const dark = mat('#0a0a0a', { roughness: 0.6 });
  const glass = mat('#1a2a3a', { roughness: 0.03, metalness: 0.6 });
  const strip = mat('#6ad7ff', { emissive: '#6ad7ff', emissiveIntensity: 2.5, roughness: 0.3 });
  // sleeker shape: lower cabin, long
  const main = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.6), body);
  main.position.y = 0.65; g.add(main);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.5, 2.2), body);
  cabin.position.set(0, 1.05, -0.1); g.add(cabin);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 0.06), glass);
  ws.position.set(0, 1.1, 0.95); g.add(ws);
  // light bar front
  const lb = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.05), strip);
  lb.position.set(0, 0.75, 2.3); g.add(lb);
  const wgeo = new THREE.CylinderGeometry(0.4, 0.4, 0.26, 14);
  [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wgeo, dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.4, z); g.add(w);
  });
  g.userData.materials = collectMaterials(g);
  return g;
}

// ---------- Hover pod (2055) ----------
function makeHover(color, accentColor) {
  const g = new THREE.Group();
  const body = mat(color, { roughness: 0.3, metalness: 0.8 });
  const glass = mat('#0a1a2a', { roughness: 0.05, metalness: 0.7 });
  const glow = mat(accentColor, { emissive: accentColor, emissiveIntensity: 4, roughness: 0.2 });
  const dark = mat('#06080c', { roughness: 0.5, metalness: 0.6 });
  // pod shape: elongated capsule
  const main = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 2.6, 6, 12), body);
  main.rotation.z = Math.PI / 2; main.position.y = 1.1; g.add(main);
  // cockpit bubble
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.8), glass);
  cockpit.position.set(0, 1.4, 0.4); g.add(cockpit);
  // glow thrusters (no wheels)
  [-0.9, 0.9].forEach((x) => {
    [-1.3, 1.3].forEach((z) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.15, 0.3, 10), glow);
      t.position.set(x, 0.4, z); g.add(t);
      const halo = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), glow);
      halo.rotation.x = -Math.PI / 2; halo.position.set(x, 0.2, z); g.add(halo);
    });
  });
  // accent strip
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 3.6), glow);
  strip.position.y = 1.05; g.add(strip);
  g.userData.hover = true;
  g.userData.materials = collectMaterials(g);
  return g;
}

export function makeVehicle(era, colorIndex) {
  const type = era.vehicle.type;
  const palette = era.vehicle.palette;
  const color = palette[colorIndex % palette.length];
  let g;
  switch (type) {
    case 'vintage': g = makeVintage(color); break;
    case 'classic': g = makeClassic(color); break;
    case 'retro80': g = makeRetro80(color); break;
    case 'modern': g = makeModern(color); break;
    case 'ev': g = makeEV(color); break;
    case 'hover': g = makeHover(color, era.building.accent[0]); break;
    default: g = makeModern(color);
  }
  g.traverse((c) => { if (c.isMesh) { c.castShadow = true; } });
  return g;
}

// Wrap a vehicle into a mover that drives along a road loop.
// road is {axis:'x'|'z', lane:offset, dir:+1|-1, length, halfWidth}
// The mover follows a straight road, wraps at ends.
export function makeVehicleMover(era, colorIndex, lane) {
  const v = makeVehicle(era, colorIndex);
  v.userData.lane = lane;
  const speed = (lane.dir) * (3.5 + Math.random() * 4); // m/s
  v.userData.speed = speed;
  v.userData.update = function (dt) {
    if (lane.axis === 'x') {
      v.position.x += speed * dt;
      v.position.z = lane.lane;
      v.rotation.y = lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (lane.dir > 0 && v.position.x > lane.max) v.position.x = lane.min - 2;
      if (lane.dir < 0 && v.position.x < lane.min) v.position.x = lane.max + 2;
    } else {
      v.position.z += speed * dt;
      v.position.x = lane.lane;
      v.rotation.y = lane.dir > 0 ? 0 : Math.PI;
      if (lane.dir > 0 && v.position.z > lane.max) v.position.z = lane.min - 2;
      if (lane.dir < 0 && v.position.z < lane.min) v.position.z = lane.max + 2;
    }
    if (v.userData.hover) {
      // gentle bobbing
      v.position.y = 0.0;
      v.position.y += Math.sin(performance.now() * 0.003 + colorIndex) * 0.06;
    } else {
      v.position.y = 0;
    }
  };
  // initial pos
  const start = lane.min + Math.random() * (lane.max - lane.min);
  if (lane.axis === 'x') { v.position.set(start, 0, lane.lane); }
  else { v.position.set(lane.lane, 0, start); }
  v.userData.update(0.0001);
  return v;
}
