import * as THREE from 'three';

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.7, metalness: opts.metalness ?? 0.0,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: true
  });
}

function collectMaterials(group) {
  const set = new Set();
  group.traverse((c) => { if (c.isMesh) { Array.isArray(c.material) ? c.material.forEach((m) => set.add(m)) : set.add(c.material); } });
  return [...set];
}

// A blocky low-poly pedestrian with swinging arms/legs.
export function makePedestrian(era, colorIndex) {
  const g = new THREE.Group();
  const palette = era.pedestrian.palette;
  const accent = era.pedestrian.accent[colorIndex % era.pedestrian.accent.length];
  const shirt = palette[colorIndex % palette.length];
  const pants = palette[(colorIndex + 2) % palette.length];
  const skin = mat('#caa178', { roughness: 0.8 });
  const hair = mat('#3a2a1a', { roughness: 0.9 });
  const shirtMat = mat(shirt, { roughness: 0.75 });
  const pantsMat = mat(pants, { roughness: 0.8 });
  const shoeMat = mat('#1a1a1a', { roughness: 0.6 });

  // futuristic glow accents
  let accentMat = null;
  if (era.year >= 2025) {
    accentMat = mat(accent, { emissive: accent, emissiveIntensity: era.year === 2055 ? 3 : 1.2, roughness: 0.3 });
  }

  // torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.24), shirtMat);
  torso.position.y = 1.15; g.add(torso);
  // head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), skin);
  head.position.y = 1.62; g.add(head);
  // hair
  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.28), hair);
  hairMesh.position.y = 1.76; g.add(hairMesh);

  // arms (pivot groups for swing)
  const armGeo = new THREE.BoxGeometry(0.13, 0.5, 0.13);
  const armL = new THREE.Group(); const armR = new THREE.Group();
  armL.position.set(-0.28, 1.4, 0); armR.position.set(0.28, 1.4, 0);
  const armLMesh = new THREE.Mesh(armGeo, shirtMat); armLMesh.position.y = -0.25; armL.add(armLMesh);
  const armRMesh = new THREE.Mesh(armGeo, shirtMat); armRMesh.position.y = -0.25; armR.add(armRMesh);
  g.add(armL); g.add(armR);

  // legs (pivot groups)
  const legGeo = new THREE.BoxGeometry(0.16, 0.55, 0.16);
  const legL = new THREE.Group(); const legR = new THREE.Group();
  legL.position.set(-0.11, 0.85, 0); legR.position.set(0.11, 0.85, 0);
  const legLMesh = new THREE.Mesh(legGeo, pantsMat); legLMesh.position.y = -0.275; legL.add(legLMesh);
  const legRMesh = new THREE.Mesh(legGeo, pantsMat); legRMesh.position.y = -0.275; legR.add(legRMesh);
  // shoes
  const shoeGeo = new THREE.BoxGeometry(0.18, 0.1, 0.26);
  const shoeL = new THREE.Mesh(shoeGeo, shoeMat); shoeL.position.set(0, -0.55, 0.05); legL.add(shoeL);
  const shoeR = new THREE.Mesh(shoeGeo, shoeMat); shoeR.position.set(0, -0.55, 0.05); legR.add(shoeR);
  g.add(legL); g.add(legR);

  // accent: backpack glow or visor
  if (accentMat) {
    if (era.year === 2055) {
      // visor
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.02), accentMat);
      visor.position.set(0, 1.62, 0.13); g.add(visor);
      // glow belt
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.26), accentMat);
      belt.position.y = 0.92; g.add(belt);
    } else {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.06, 0.25), accentMat);
      stripe.position.y = 1.3; g.add(stripe);
    }
  }

  g.traverse((c) => { if (c.isMesh) c.castShadow = true; });

  g.userData.materials = collectMaterials(g);
  g.userData.parts = { armL, armR, legL, legR };
  g.userData.phase = Math.random() * Math.PI * 2;
  g.userData.walkSpeed = 1.0 + Math.random() * 0.6;
  return g;
}

// Wrap into a walker that paces along a sidewalk segment.
export function makeWalker(era, colorIndex, path) {
  const p = makePedestrian(era, colorIndex);
  p.userData.path = path; // {axis, lane, min, max, dir}
  p.userData.speed = (1.0 + Math.random() * 0.5) * path.dir;
  p.userData.to = 1; // current target direction sign
  const initPos = path.min + Math.random() * (path.max - path.min);
  if (path.axis === 'x') { p.position.set(initPos, 0, path.lane); p.rotation.y = path.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  else { p.position.set(path.lane, 0, initPos); p.rotation.y = path.dir > 0 ? 0 : Math.PI; }
  p.userData.update = function (dt) {
    const path = p.userData.path;
    const speed = p.userData.speed;
    // move
    if (path.axis === 'x') {
      p.position.x += speed * dt;
      if (p.position.x > path.max) { p.position.x = path.max; p.userData.speed *= -1; p.rotation.y = Math.PI / 2; }
      if (p.position.x < path.min) { p.position.x = path.min; p.userData.speed *= -1; p.rotation.y = -Math.PI / 2; }
    } else {
      p.position.z += speed * dt;
      if (p.position.z > path.max) { p.position.z = path.max; p.userData.speed *= -1; p.rotation.y = 0; }
      if (p.position.z < path.min) { p.position.z = path.min; p.userData.speed *= -1; p.rotation.y = Math.PI; }
    }
    // limb swing
    const parts = p.userData.parts;
    const phase = p.userData.phase + performance.now() * 0.005 * Math.abs(p.userData.walkSpeed);
    const swing = Math.sin(phase) * 0.5;
    parts.armL.rotation.x = swing;
    parts.armR.rotation.x = -swing;
    parts.legL.rotation.x = -swing;
    parts.legR.rotation.x = swing;
  };
  p.userData.update(0.0001);
  return p;
}
