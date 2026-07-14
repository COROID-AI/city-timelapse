import * as THREE from 'three';
import type { EraConfig, VehicleStyle, PedStyle } from '../config/eras';
import { makeGlowSprite, shadeHex } from '../utils/textures';
import { hash, pick, clamp } from '../utils/math';

// ============================================================================
// Vehicles + pedestrians factories. Each entity is a low-poly stylized mesh
// whose silhouette, materials, and lights change distinctly across eras:
// 1945 vintage → 1965 chrome land yachts → 1985 boxy → 2005 SUVs → 2025 EVs
// → 2055 hover drones.
// ============================================================================

const ROAD_WIDTH = 14;

// ---------------------------------------------------------------------------
// VEHICLES
// ---------------------------------------------------------------------------
export interface Vehicle {
  group: THREE.Group;
  update: (dt: number, time: number) => void;
}

export function buildVehicles(era: EraConfig, eraIndex: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `vehicles-${era.year}`;
  const vs = era.vehicle;
  const glowTex = makeGlowSprite(vs.emissive);

  for (let i = 0; i < vs.count; i++) {
    const v = makeVehicle(vs, eraIndex, i, glowTex);
    group.add(v.group);
    group.userData.vehicles = group.userData.vehicles || [];
    (group.userData.vehicles as Vehicle[]).push(v);
  }
  return group;
}

function makeVehicle(vs: VehicleStyle, eraIndex: number, i: number, glowTex: THREE.CanvasTexture): Vehicle {
  const group = new THREE.Group();
  const seed = i * 67 + eraIndex * 131;
  const color = pick(vs.bodyColors, seed);
  const dir = i % 2 === 0 ? 1 : -1; // alternate direction
  const laneOffset = dir > 0 ? 2.5 : -2.5;

  // Build body by era
  buildVehicleBody(group, vs.shape, color, vs, eraIndex, seed, glowTex);

  // position on road
  const startZ = (hash(seed) - 0.5) * 80;
  group.position.set(laneOffset, vs.shape === 'hover' ? 1.2 : 0.3, startZ);
  group.rotation.y = dir > 0 ? Math.PI : 0;

  const speed = vs.speed * dir * (0.8 + hash(seed + 2) * 0.4);

  return {
    group,
    update: (dt: number) => {
      group.position.z += speed * dt;
      // wrap around
      if (group.position.z > 48) group.position.z = -48;
      if (group.position.z < -48) group.position.z = 48;
      // hover bob
      if (vs.shape === 'hover') {
        group.position.y = 1.2 + Math.sin(performance.now() * 0.003 + seed) * 0.15;
        group.rotation.z = Math.sin(performance.now() * 0.002 + seed) * 0.05;
      }
    },
  };
}

function buildVehicleBody(
  group: THREE.Group,
  shape: string,
  color: string,
  vs: VehicleStyle,
  eraIndex: number,
  seed: number,
  glowTex: THREE.CanvasTexture,
): void {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: eraIndex >= 4 ? 0.3 : 0.5, metalness: eraIndex >= 4 ? 0.6 : 0.3, transparent: true, opacity: 1 });

  if (shape === 'vintage') {
    // tall rounded body, big fenders
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 3.5), mat);
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);
    // rounded cabin
    const cabinMat = new THREE.MeshStandardMaterial({ color: shadeHex(color, 0.6), roughness: 0.5, transparent: true, opacity: 1 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.8), cabinMat);
    cabin.position.set(0, 1.15, -0.2);
    group.add(cabin);
    // fenders
    const fenderMat = new THREE.MeshStandardMaterial({ color: shadeHex(color, 0.5), roughness: 0.6, transparent: true, opacity: 1 });
    for (const z of [-1.2, 1.2]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 10), fenderMat);
      f.rotation.x = Math.PI / 2;
      f.rotation.z = Math.PI / 2;
      f.position.set(0, 0.3, z);
      group.add(f);
    }
    // wheels
    addWheels(group, 4, 0.45, 1.6, 3.5);
    // round headlights
    addLightSprites(group, glowTex, vs, [[-0.5, 0.5, 1.8], [0.5, 0.5, 1.8]], 0.3);
    // taillights
    addTailLights(group, '#cc3322', [[-0.5, 0.6, -1.8], [0.5, 0.6, -1.8]]);
  } else if (shape === 'classic') {
    // long chrome land yacht with fins
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 4.5), mat);
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);
    // low cabin
    const cabinMat = new THREE.MeshStandardMaterial({ color: shadeHex(color, 0.5), roughness: 0.2, metalness: 0.4, transparent: true, opacity: 1 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), cabinMat);
    cabin.position.set(0, 1.05, -0.3);
    group.add(cabin);
    // tail fins
    const finMat = new THREE.MeshStandardMaterial({ color: shadeHex(color, 0.8), roughness: 0.3, transparent: true, opacity: 1 });
    for (const x of [-0.9, 0.9]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.8), finMat);
      fin.position.set(x, 1.0, -2.0);
      fin.rotation.z = x > 0 ? -0.3 : 0.3;
      group.add(fin);
    }
    addWheels(group, 4, 0.5, 1.7, 4.5);
    addLightSprites(group, glowTex, vs, [[-0.6, 0.5, 2.3], [0.6, 0.5, 2.3]], 0.35);
    addTailLights(group, '#cc2222', [[-0.7, 0.6, -2.3], [0.7, 0.6, -2.3]]);
  } else if (shape === 'boxy') {
    // angular boxy sedan
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1, 4), mat);
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);
    const cabinMat = new THREE.MeshStandardMaterial({ color: shadeHex(color, 0.55), roughness: 0.3, transparent: true, opacity: 1 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 2.2), cabinMat);
    cabin.position.set(0, 1.45, -0.2);
    group.add(cabin);
    addWheels(group, 4, 0.5, 1.5, 4);
    addLightSprites(group, glowTex, vs, [[-0.5, 0.6, 2.1], [0.5, 0.6, 2.1]], 0.3);
    addTailLights(group, '#aa1111', [[-0.55, 0.7, -2.1], [0.55, 0.7, -2.1]]);
  } else if (shape === 'modern') {
    // rounded SUV, taller
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1.3, 4.2), mat);
    body.position.y = 0.75;
    body.castShadow = true;
    group.add(body);
    const cabinMat = new THREE.MeshStandardMaterial({ color: shadeHex(color, 0.5), roughness: 0.2, metalness: 0.3, transparent: true, opacity: 1 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.95, 2.6), cabinMat);
    cabin.position.set(0, 1.8, -0.1);
    group.add(cabin);
    addWheels(group, 4, 0.55, 1.6, 4.2);
    addLightSprites(group, glowTex, vs, [[-0.55, 0.7, 2.2], [0.55, 0.7, 2.2]], 0.35);
    addTailLights(group, '#cc2222', [[-0.6, 0.8, -2.2], [0.6, 0.8, -2.2]]);
  } else if (shape === 'electric') {
    // sleek smooth EV, no grille, blue accents
    const bodyGeo = new THREE.BoxGeometry(1.9, 1.1, 4.3);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);
    const cabinMat = new THREE.MeshStandardMaterial({ color: shadeHex(color, 0.45), roughness: 0.1, metalness: 0.2, transparent: true, opacity: 1 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.8, 2.8), cabinMat);
    cabin.position.set(0, 1.5, -0.1);
    group.add(cabin);
    // blue accent strip
    const accentMat = new THREE.MeshStandardMaterial({ color: vs.emissive, emissive: new THREE.Color(vs.emissive), emissiveIntensity: 0.8, transparent: true, opacity: 1 });
    const accent = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.05, 4.32), accentMat);
    accent.position.y = 0.5;
    group.add(accent);
    addWheels(group, 4, 0.5, 1.6, 4.3, '#1a1a1a');
    addLightSprites(group, glowTex, vs, [[-0.55, 0.6, 2.25], [0.55, 0.6, 2.25]], 0.4);
    addTailLights(group, '#cc3322', [[-0.6, 0.7, -2.25], [0.6, 0.7, -2.25]]);
  } else {
    // hover drone — no wheels, glowing underside, sleek pod
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.7, 3.5);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 0;
    body.castShadow = true;
    group.add(body);
    // dome canopy
    const canopyMat = new THREE.MeshStandardMaterial({ color: vs.emissive, emissive: new THREE.Color(vs.emissive), emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.7 });
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), canopyMat);
    canopy.position.set(0, 0.35, 0.2);
    canopy.scale.z = 1.5;
    group.add(canopy);
    // glowing thrusters
    const thrusterMat = new THREE.MeshBasicMaterial({ color: vs.emissive, transparent: true, opacity: 1 });
    for (const [tx, tz] of [[-0.7, 1.2], [0.7, 1.2], [-0.7, -1.2], [0.7, -1.2]] as const) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.2, 8), thrusterMat);
      t.position.set(tx, -0.3, tz);
      group.add(t);
      // glow sprite underneath
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: vs.emissiveInt }));
      sprite.scale.set(1.2, 1.2, 1);
      sprite.position.set(tx, -0.5, tz);
      group.add(sprite);
    }
    // front light
    addLightSprites(group, glowTex, vs, [[0, 0.2, 1.8]], 0.5);
  }
}

function addWheels(group: THREE.Group, count: number, radius: number, trackW: number, length: number, color = '#1a1a1a'): void {
  const wheelMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, transparent: true, opacity: 1 });
  const positions: number[][] = [];
  const halfL = length / 2 - 0.6;
  for (let i = 0; i < count; i++) {
    const z = i < count / 2 ? halfL : -halfL;
    const x = i % 2 === 0 ? -trackW / 2 : trackW / 2;
    positions.push([x, radius, z]);
  }
  for (const [x, y, z] of positions) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.35, 10), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    group.add(w);
  }
}

function addLightSprites(group: THREE.Group, tex: THREE.CanvasTexture, vs: VehicleStyle, positions: number[][], scale: number): void {
  const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: vs.emissiveInt });
  for (const [x, y, z] of positions) {
    const s = new THREE.Sprite(mat);
    s.scale.set(scale, scale, 1);
    s.position.set(x, y, z);
    group.add(s);
  }
}

function addTailLights(group: THREE.Group, color: string, positions: number[][]): void {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.5, transparent: true, opacity: 1 });
  for (const [x, y, z] of positions) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.05), mat);
    l.position.set(x, y, z);
    group.add(l);
  }
}

// ---------------------------------------------------------------------------
// PEDESTRIANS
// ---------------------------------------------------------------------------
export interface Pedestrian {
  group: THREE.Group;
  update: (dt: number, time: number) => void;
}

export function buildPedestrians(era: EraConfig, eraIndex: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `pedestrians-${era.year}`;
  const ps = era.pedestrian;

  for (let i = 0; i < ps.count; i++) {
    const p = makePedestrian(ps, eraIndex, i, era);
    group.add(p.group);
    group.userData.pedestrians = group.userData.pedestrians || [];
    (group.userData.pedestrians as Pedestrian[]).push(p);
  }
  return group;
}

function makePedestrian(ps: PedStyle, eraIndex: number, i: number, era: EraConfig): Pedestrian {
  const group = new THREE.Group();
  const seed = i * 41 + eraIndex * 89;
  const shirt = pick(ps.shirtColors, seed);
  const pants = pick(ps.pantsColors, seed + 1);
  const skin = pick(ps.skinColors, seed + 2);

  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8, transparent: true, opacity: 1 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.8, transparent: true, opacity: 1 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7, transparent: true, opacity: 1 });

  // torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 4, 8), ps.hasCoat ? new THREE.MeshStandardMaterial({ color: pick(ps.coatColors, seed), roughness: 0.8, transparent: true, opacity: 1 }) : shirtMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);

  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), skinMat);
  head.position.y = 1.75;
  group.add(head);

  // legs
  for (const x of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 3, 6), pantsMat);
    leg.position.set(x, 0.45, 0);
    leg.castShadow = true;
    group.add(leg);
  }

  // arms
  for (const x of [-0.36, 0.36]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 3, 6), torso.material as THREE.Material);
    arm.position.set(x, 1.2, 0);
    group.add(arm);
  }

  // hat
  if (ps.hasHat) {
    const hatMat = new THREE.MeshStandardMaterial({ color: ps.hatColor, roughness: 0.7, transparent: true, opacity: 1 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 10), hatMat);
    brim.position.y = 1.93;
    group.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.18, 10), hatMat);
    crown.position.y = 2.02;
    group.add(crown);
  }

  // 2055 accent glow
  if (eraIndex === 5) {
    const glowMat = new THREE.MeshBasicMaterial({ color: ps.accentColor, transparent: true, opacity: 0.8 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 6, 12), glowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.75;
    group.add(ring);
  }

  // place on sidewalk
  const side = i % 2 === 0 ? -1 : 1;
  const xOff = side * (ROAD_WIDTH / 2 + 1.5 + hash(seed) * 2);
  const zStart = (hash(seed + 5) - 0.5) * 70;
  group.position.set(xOff, 0, zStart);

  const walkSpeed = (0.6 + hash(seed + 8) * 0.5) * side;
  const phase = hash(seed) * Math.PI * 2;

  return {
    group,
    update: (_dt: number, time: number) => {
      group.position.z += walkSpeed * _dt;
      if (group.position.z > 38) group.position.z = -38;
      if (group.position.z < -38) group.position.z = 38;
      // walking bob
      group.position.y = Math.abs(Math.sin(time * 4 + phase)) * 0.06;
      // slight sway
      group.rotation.z = Math.sin(time * 3 + phase) * 0.03;
    },
  };
}

// ---------------------------------------------------------------------------
// GROUND — road, sidewalks, crosswalks, ground plane
// ---------------------------------------------------------------------------
export function buildGround(era: EraConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = `ground-${era.year}`;

  const env = era.env;

  // base ground
  const groundMat = new THREE.MeshStandardMaterial({ color: env.groundColor, roughness: 0.95, transparent: true, opacity: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  group.add(ground);

  // road — two perpendicular roads (crossroads)
  const roadTex = makeRoadTexture(env.roadColor, env.laneColor, env.laneGlow);
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughness: 0.85,
    emissiveMap: env.laneGlow > 0.3 ? roadTex : null,
    emissive: new THREE.Color(env.laneColor),
    emissiveIntensity: env.laneGlow * 0.3,
    transparent: true,
    opacity: 1,
  });

  // main road (N-S along Z)
  roadTex.repeat.set(1, 6);
  const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, 100), roadMat);
  roadNS.rotation.x = -Math.PI / 2;
  roadNS.position.y = 0.01;
  roadNS.receiveShadow = true;
  group.add(roadNS);

  // cross road (E-W along X)
  const roadEWMat = roadMat.clone();
  const roadTex2 = makeRoadTexture(env.roadColor, env.laneColor, env.laneGlow);
  roadTex2.rotation = Math.PI / 2;
  roadTex2.center.set(0.5, 0.5);
  roadTex2.repeat.set(6, 1);
  (roadEWMat as THREE.MeshStandardMaterial).map = roadTex2;
  (roadEWMat as THREE.MeshStandardMaterial).emissiveMap = env.laneGlow > 0.3 ? roadTex2 : null;
  roadEWMat.needsUpdate = true;
  const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(100, ROAD_WIDTH), roadEWMat);
  roadEW.rotation.x = -Math.PI / 2;
  roadEW.position.y = 0.011;
  roadEW.receiveShadow = true;
  group.add(roadEW);

  // sidewalks — 4 strips along the main road
  const swMat = new THREE.MeshStandardMaterial({
    map: makeSidewalkTexture(env.sidewalkColor),
    roughness: 0.9,
    transparent: true,
    opacity: 1,
  });
  (swMat.map as THREE.Texture).repeat.set(8, 24);

  for (const [sign, side] of [[1, -1], [-1, -1], [1, 1], [-1, 1]] as const) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(4, 100), swMat);
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(sign * (ROAD_WIDTH / 2 + 2.5), 0.02, 0);
    sw.receiveShadow = true;
    group.add(sw);
  }
  // cross-street sidewalks
  const swMat2 = new THREE.MeshStandardMaterial({
    map: makeSidewalkTexture(env.sidewalkColor),
    roughness: 0.9,
    transparent: true,
    opacity: 1,
  });
  (swMat2.map as THREE.Texture).repeat.set(24, 8);
  for (const [sign] of [[1], [-1]] as const) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(100, 4), swMat2);
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(0, 0.02, sign * (ROAD_WIDTH / 2 + 2.5));
    sw.receiveShadow = true;
    group.add(sw);
  }

  // curb edges
  const curbMat = new THREE.MeshStandardMaterial({ color: shadeHex(env.sidewalkColor, 0.85), roughness: 0.9, transparent: true, opacity: 1 });
  for (const [sx] of [[1], [-1]] as const) {
    const curbNS = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 100), curbMat);
    curbNS.position.set(sx * (ROAD_WIDTH / 2 + 0.15), 0.1, 0);
    group.add(curbNS);
  }
  for (const [sz] of [[1], [-1]] as const) {
    const curbEW = new THREE.Mesh(new THREE.BoxGeometry(100, 0.2, 0.3), curbMat);
    curbEW.position.set(0, 0.1, sz * (ROAD_WIDTH / 2 + 0.15));
    group.add(curbEW);
  }

  // street lamps
  addStreetLamps(group, era);

  // crosswalk stripes
  addCrosswalk(group, ROAD_WIDTH, env.laneColor, env.laneGlow);

  return group;
}

function addStreetLamps(group: THREE.Group, era: EraConfig): void {
  const lampMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.6, metalness: 0.5, transparent: true, opacity: 1 });
  const bulbColor = era.env.starIntensity > 0.3 ? era.building.accent : era.signage.neonColor;
  const bulbMat = new THREE.MeshStandardMaterial({
    color: shadeHex(bulbColor, 1.5),
    emissive: new THREE.Color(bulbColor),
    emissiveIntensity: era.year >= 1985 ? 1 : 0.5,
    transparent: true,
    opacity: 1,
  });

  const positions: number[][] = [];
  for (const z of [-30, -10, 10, 30]) {
    positions.push([-ROAD_WIDTH / 2 - 3, z]);
    positions.push([ROAD_WIDTH / 2 + 3, z]);
  }
  for (const [x, z] of positions) {
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5, 6), lampMat);
    pole.position.y = 2.5;
    lamp.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.1), lampMat);
    arm.position.set(x > 0 ? -0.5 : 0.5, 4.8, 0);
    lamp.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), bulbMat);
    bulb.position.set(x > 0 ? -1 : 1, 4.7, 0);
    lamp.add(bulb);
    lamp.position.set(x, 0, z);
    group.add(lamp);
  }
}

function addCrosswalk(group: THREE.Group, roadW: number, color: string, glow: number): void {
  const stripeMat = new THREE.MeshStandardMaterial({
    color: shadeHex(color, 2),
    roughness: 0.7,
    emissive: glow > 0.3 ? new THREE.Color(color) : new THREE.Color('#000000'),
    emissiveIntensity: glow,
    transparent: true,
    opacity: 1,
  });
  for (const z of [roadW / 2 + 3.5, -roadW / 2 - 3.5]) {
    for (let i = 0; i < 5; i++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 3), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-2.4 + i * 1.2, 0.015, z);
      group.add(stripe);
    }
  }
}

// ---------------------------------------------------------------------------
// Procedural textures (small versions, kept here for entity file independence)
// ---------------------------------------------------------------------------
function makeRoadTexture(color: string, laneColor: string, glow: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  // noise
  const img = ctx.getImageData(0, 0, 128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    img.data[i] = clamp(img.data[i] + n, 0, 255);
    img.data[i + 1] = clamp(img.data[i + 1] + n, 0, 255);
    img.data[i + 2] = clamp(img.data[i + 2] + n, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
  // lane
  ctx.fillStyle = laneColor;
  ctx.fillRect(61, 5, 6, 55);
  ctx.fillRect(61, 68, 6, 55);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  void glow;
  return tex;
}

function makeSidewalkTexture(color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = shadeHex(color, 0.7);
  ctx.lineWidth = 2;
  for (let x = 0; x <= 128; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke();
  }
  for (let y = 0; y <= 128; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}
