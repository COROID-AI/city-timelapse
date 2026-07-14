import * as THREE from 'three';
import { shadeColor } from './textures.js';

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.6, metalness: opts.metalness ?? 0.3,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: true
  });
}
function collectMaterials(group) {
  const set = new Set();
  group.traverse((c) => { if (c.isMesh) { Array.isArray(c.material) ? c.material.forEach((m) => set.add(m)) : set.add(c.material); } });
  return [...set];
}

// ---- Street lamp ----
export function makeLamp(era) {
  const g = new THREE.Group();
  const style = era.lamp.style;
  const lampColor = era.lamp.color;
  const dark = mat('#2a2a2a', { roughness: 0.6, metalness: 0.5 });
  const bulb = mat(lampColor, { emissive: lampColor, emissiveIntensity: era.night ? 6 : 1.5, roughness: 0.3 });

  if (style === 'gas') {
    // ornate 1945 gas lamp
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 8), dark);
    post.position.y = 2.1; g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.6), dark);
    arm.position.set(0, 4.0, 0.3); g.add(arm);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), dark);
    housing.position.set(0, 4.15, 0.3); g.add(housing);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), bulb);
    glass.position.set(0, 4.05, 0.3); g.add(glass);
    // decorative finial
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), dark);
    fin.position.set(0, 4.45, 0.3); g.add(fin);
  } else if (style === 'cobra') {
    // 1965/1985 cobra-head
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.2, 8), dark);
    post.position.y = 2.6; g.add(post);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.8), dark);
    head.position.set(0, 5.1, 0.35); head.rotation.x = -0.1; g.add(head);
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.7), bulb);
    light.position.set(0, 5.0, 0.4); g.add(light);
  } else if (style === 'modern' || style === 'led') {
    // 2005/2025 modern pole
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5.6, 10), dark);
    post.position.y = 2.8; g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.0), dark);
    arm.position.set(0, 5.5, 0.5); g.add(arm);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.7), bulb);
    panel.position.set(0, 5.42, 0.5); g.add(panel);
    if (style === 'led') {
      // small solar cap
      const solar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), mat('#1a2a4a', { roughness: 0.2, metalness: 0.8 }));
      solar.position.set(0, 5.6, 0); g.add(solar);
    }
  } else { // pylon (2055)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 5.4, 6), dark);
    post.position.y = 2.7; g.add(post);
    // glowing ring head
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 8, 20), bulb);
    ring.rotation.x = Math.PI / 2; ring.position.y = 5.3; g.add(ring);
    // beacon
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), bulb);
    beacon.position.y = 5.6; g.add(beacon);
  }
  g.userData.materials = collectMaterials(g);
  g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return g;
}

// ---- Traffic light ----
export function makeTrafficLight(era) {
  const g = new THREE.Group();
  const dark = mat('#161618', { roughness: 0.6, metalness: 0.4 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.5, 8), dark);
  post.position.y = 2.25; g.add(post);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.0), dark);
  arm.position.set(0, 4.3, 0.5); g.add(arm);
  // housing
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, 0.28), dark);
  housing.position.set(0, 3.7, 0.5); g.add(housing);
  // three lights
  const colors = ['#ff3a3a', '#ffd23a', '#3aff5a'];
  const active = Math.floor(performance.now() / 2200) % 3;
  colors.forEach((col, i) => {
    const intensity = i === active ? 4 : 0.15;
    const lm = mat(col, { emissive: col, emissiveIntensity: intensity, roughness: 0.3 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lm);
    bulb.position.set(0, 3.95 - i * 0.28, 0.65); g.add(bulb);
  });
  if (era.year === 2055) {
    // holographic housing
    const holo = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.0, 0.04),
      mat('#00e5ff', { emissive: '#00e5ff', emissiveIntensity: 2, transparent: true, opacity: 0.6 }));
    holo.position.set(0, 3.7, 0.68); g.add(holo);
  }
  g.userData.materials = collectMaterials(g);
  g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return g;
}

// ---- Bench ----
export function makeBench(era) {
  const g = new THREE.Group();
  const style = era.lamp.style;
  const wood = mat('#5a3a26', { roughness: 0.9 });
  const metal = mat('#2a2a2a', { roughness: 0.6, metalness: 0.5 });
  if (style === 'gas') {
    // wooden slat bench
    for (let i = 0; i < 4; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.12), wood);
      slat.position.set(0, 0.5 + i * 0.02, -0.35 + i * 0.12); g.add(slat);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.05), wood);
    back.position.set(0, 0.75, -0.45); g.add(back);
    [-0.7, 0.7].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.5), metal);
      leg.position.set(x, 0.28, -0.1); g.add(leg);
    });
  } else if (style === 'pylon') {
    // futuristic glowing bench
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), metal);
    base.position.set(0, 0.5, 0); g.add(base);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.45),
      mat('#00e5ff', { emissive: '#00e5ff', emissiveIntensity: 2, transparent: true, opacity: 0.8 }));
    seat.position.set(0, 0.56, 0); g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 0.06),
      mat('#00e5ff', { emissive: '#00e5ff', emissiveIntensity: 1.5, transparent: true, opacity: 0.5 }));
    back.position.set(0, 0.8, -0.22); g.add(back);
  } else {
    // standard metal/plastic bench
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.45), metal);
    seat.position.set(0, 0.5, 0); g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.05), metal);
    back.position.set(0, 0.75, -0.2); g.add(back);
    [-0.7, 0.7].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.45), metal);
      leg.position.set(x, 0.28, 0); g.add(leg);
    });
  }
  g.userData.materials = collectMaterials(g);
  g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return g;
}

// ---- Tree / vegetation ----
export function makeTree(era) {
  const g = new THREE.Group();
  const trunkMat = mat('#4a3020', { roughness: 0.9 });
  let leafMat;
  if (era.year === 2055) {
    leafMat = mat('#0a3a3a', { emissive: '#0a4a4a', emissiveIntensity: 0.5, roughness: 0.6 });
  } else {
    const leafColor = era.year >= 2025 ? '#3a6a3a' : (era.year <= 1965 ? '#5a6a3a' : '#4a6a3a');
    leafMat = mat(leafColor, { roughness: 0.85 });
  }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.8, 8), trunkMat);
  trunk.position.y = 0.9; g.add(trunk);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), leafMat);
  crown.position.y = 2.1; g.add(crown);
  if (era.year !== 2055) {
    const crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), leafMat);
    crown2.position.set(0.4, 2.5, 0.2); g.add(crown2);
  }
  g.userData.materials = collectMaterials(g);
  g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return g;
}
