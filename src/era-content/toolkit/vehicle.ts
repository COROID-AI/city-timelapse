import * as THREE from 'three';

export interface VehicleParams {
  type?: VehicleBodyType;
  scale?: number;
  paintColor?: number;
  chromeColor?: number;
  windowTint?: number;
  wheelStyle?: 'simple' | 'spoke' | 'wire' | 'heavy_duty';
  condition?: number;
  roofShape?: 'flat' | 'curved' | 'pointed' | 'sloped';
  bumperStyle?: 'minimal' | 'chrome_bar' | 'heavy';
  headlightStyle?: 'round' | 'rectangular' | 'quad';
  taillightStyle?: 'round' | 'rectangular' | 'vertical_strip';
  roofDetails?: RoofDetail[];
}

export type VehicleBodyType = 'car' | 'truck' | 'bus' | 'taxi' | 'tram' | 'van' | 'sedan' | 'coupe' | 'pickup' | 'tanker';
export type RoofDetail = 'luggage_rack' | 'antenna' | 'spoiler' | 'roof_light' | 'none';

export interface VehicleResult {
  group: THREE.Group;
  dispose(): void;
}

// ── Helpers ────────────────────────────────────────────────────────

function makeBox(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function makeCyl(rT: number, rB: number, h: number, seg: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, seg), mat);
}

// ── Materials ──────────────────────────────────────────────────────

function paintMat(color: number, cond: number): THREE.MeshStandardMaterial {
  const c = new THREE.Color(color);
  return new THREE.MeshStandardMaterial({ color: c, roughness: Math.min(0.3 + (1 - cond) * 0.4, 1), metalness: Math.min(0.6 + cond * 0.3, 1) });
}

function chromeMat(cond: number): THREE.MeshStandardMaterial {
  const s = 0.7 + cond * 0.25;
  return new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(s, s, s).getHex(), roughness: 0.08, metalness: 0.95 });
}

function glassMat(tint: number, cond: number): THREE.MeshPhysicalMaterial {
  const clarity = 0.15 + cond * 0.5;
  return new THREE.MeshPhysicalMaterial({ color: tint > 0 ? new THREE.Color(tint) : 0x88bbdd, transparent: true, opacity: clarity, roughness: 0.02, metalness: 0.05, transmission: 0.5, thickness: 0.02 });
}

function rubberMat(cond: number): THREE.MeshStandardMaterial {
  const shade = 0.1 + (1 - cond) * 0.15;
  return new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(shade, shade, shade), roughness: 0.95, metalness: 0 });
}

// ── Wheel builder ──────────────────────────────────────────────────

function buildWheel(style: string, radius: number, width: number, cond: number): THREE.Group {
  const g = new THREE.Group();
  const tireMat = rubberMat(cond);
  const rimMat = chromeMat(cond);
  g.add(new THREE.Mesh(new THREE.TorusGeometry(radius, width / 2, 12, 24), tireMat).rotateY(Math.PI / 2));
  g.add(makeCyl(radius * 0.3, radius * 0.3, width * 0.9, 16, rimMat).rotateZ(Math.PI / 2));
  if (style === 'spoke') {
    for (let i = 0; i < 5; i++) {
      const spoke = makeBox(width * 0.8, radius * 0.5, 0.04, rimMat);
      spoke.rotation.z = (i / 5) * Math.PI; g.add(spoke);
    }
  } else if (style === 'wire') {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI;
      const wire = makeBox(width * 0.6, radius * 0.6, 0.02, rimMat);
      wire.rotation.z = angle; g.add(wire);
    }
  } else if (style === 'heavy_duty') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.55, 0.08, 8, 16), rimMat);
    ring.rotation.y = Math.PI / 2; g.add(ring);
  }
  return g;
}

// ── Light builders ─────────────────────────────────────────────────

function buildHeadlight(style: string, pos: THREE.Vector3, cond: number): THREE.Mesh {
  let geo: THREE.BufferGeometry;
  switch (style) {
    case 'round': geo = new THREE.SphereGeometry(0.12, 12, 8); break;
    case 'rectangular': geo = new THREE.BoxGeometry(0.2, 0.15, 0.06); break;
    case 'quad': geo = new THREE.BoxGeometry(0.12, 0.12, 0.06); break;
    default: geo = new THREE.SphereGeometry(0.12, 12, 8);
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xFFFFEE, emissive: 0xFFFFAA, emissiveIntensity: cond * 0.5, roughness: 0.1, metalness: 0 }));
  mesh.position.copy(pos); return mesh;
}

function buildTaillight(style: string, pos: THREE.Vector3, cond: number): THREE.Mesh {
  let geo: THREE.BufferGeometry;
  switch (style) {
    case 'round': geo = new THREE.SphereGeometry(0.1, 12, 8); break;
    case 'rectangular': geo = new THREE.BoxGeometry(0.2, 0.12, 0.06); break;
    case 'vertical_strip': geo = new THREE.BoxGeometry(0.08, 0.3, 0.06); break;
    default: geo = new THREE.BoxGeometry(0.2, 0.12, 0.06);
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xFF2200, emissive: 0xFF0000, emissiveIntensity: cond * 0.3, roughness: 0.2, metalness: 0 }));
  mesh.position.copy(pos); return mesh;
}

// ── Car body ───────────────────────────────────────────────────────

function buildCar(p: VehicleParams): THREE.Group {
  const s = p.scale ?? 1;
  const pm = paintMat(p.paintColor ?? 0xCC0000, p.condition ?? 0.7);
  const gm = glassMat(p.windowTint ?? 0.5, p.condition ?? 0.7);
  const g = new THREE.Group();
  g.name = 'vehicle_car';

  // Lower body
  const lowerBody = makeBox(3.5 * s, 0.5 * s, 1.6 * s, pm);
  lowerBody.position.y = 0.5 * s; g.add(lowerBody);

  // Cabin
  const cabinW = 2.0 * s, cabinH = 0.7 * s, cabinD = 1.5 * s;
  const cabin = makeBox(cabinW, cabinH, cabinD, pm);
  cabin.position.set(-0.2 * s, 0.5 * s + cabinH / 2 + 0.25 * s, 0); g.add(cabin);

  // Windshield
  const windscreen = makeBox(0.05, cabinH * 0.85, cabinD * 0.9, gm);
  windscreen.position.set(cabinW / 2 - 0.2 * s, 0.5 * s + cabinH / 2 + 0.25 * s, 0);
  windscreen.rotation.z = -0.15; g.add(windscreen);

  // Rear window
  const rearWindow = makeBox(0.05, cabinH * 0.6, cabinD * 0.7, gm);
  rearWindow.position.set(-cabinW / 2 - 0.2 * s, 0.5 * s + cabinH / 2 + 0.25 * s, 0);
  rearWindow.rotation.z = 0.1; g.add(rearWindow);

  // Side windows
  for (const side of [-1, 1]) {
    const sideWin = makeBox(cabinW * 0.7, cabinH * 0.5, 0.03, gm);
    sideWin.position.set(-0.2 * s, 0.5 * s + cabinH / 2 + 0.25 * s, side * (cabinD / 2 + 0.01)); g.add(sideWin);
  }

  // Wheels
  const wR = 0.3 * s, wW = 0.15 * s;
  for (const wp of [{ x: 1.0 * s, z: 0.8 * s }, { x: 1.0 * s, z: -0.8 * s }, { x: -1.0 * s, z: 0.8 * s }, { x: -1.0 * s, z: -0.8 * s }]) {
    const wheel = buildWheel(p.wheelStyle ?? 'spoke', wR, wW, p.condition ?? 0.7);
    wheel.position.set(wp.x, wR, wp.z); g.add(wheel);
  }

  // Bumpers
  const bH = (p.bumperStyle === 'heavy' ? 0.2 : p.bumperStyle !== 'minimal' ? 0.1 : 0);
  const bD = (p.bumperStyle === 'heavy' ? 0.1 : p.bumperStyle !== 'minimal' ? 0.05 : 0);
  if (bH > 0) {
    const bm = p.bumperStyle === 'chrome_bar' ? chromeMat(p.condition ?? 0.7) : pm;
    const fb = makeBox(0.1, bH * s, (1.6 + bD * 2) * s, bm);
    fb.position.set(1.75 * s, 0.3 * s, 0); g.add(fb);
    const rb = fb.clone(); rb.position.x = -1.75 * s; g.add(rb);
  }

  // Lights
  g.add(buildHeadlight(p.headlightStyle ?? 'round', new THREE.Vector3(1.75 * s, 0.55 * s, 0.5 * s), p.condition ?? 0.7));
  g.add(buildHeadlight(p.headlightStyle ?? 'round', new THREE.Vector3(1.75 * s, 0.55 * s, -0.5 * s), p.condition ?? 0.7));
  g.add(buildTaillight(p.taillightStyle ?? 'round', new THREE.Vector3(-1.75 * s, 0.55 * s, 0.5 * s), p.condition ?? 0.7));
  g.add(buildTaillight(p.taillightStyle ?? 'round', new THREE.Vector3(-1.75 * s, 0.55 * s, -0.5 * s), p.condition ?? 0.7));

  return g;
}

// ── Truck body ─────────────────────────────────────────────────────

function buildTruck(p: VehicleParams): THREE.Group {
  const s = p.scale ?? 1;
  const pm = paintMat(p.paintColor ?? 0x2255AA, p.condition ?? 0.6);
  const cm = chromeMat(p.condition ?? 0.6);
  const g = new THREE.Group();
  g.name = 'vehicle_truck';

  const cab = makeBox(1.8 * s, 1.4 * s, 1.8 * s, pm);
  cab.position.set(1.0 * s, 1.1 * s, 0); g.add(cab);
  const cabRoof = makeBox(1.6 * s, 0.1 * s, 1.7 * s, pm);
  cabRoof.position.set(1.0 * s, 1.85 * s, 0); g.add(cabRoof);
  const windscreen = makeBox(0.05, 0.8 * s, 1.6 * s, glassMat(p.windowTint ?? 0.4, p.condition ?? 0.6));
  windscreen.position.set(1.9 * s, 1.3 * s, 0); g.add(windscreen);

  const bedW = 3.0 * s, bedH = 0.6 * s, bedD = 1.6 * s;
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8, metalness: 0.2 });
  const bed = makeBox(bedW, bedH, bedD, bedMat);
  bed.position.set(-1.2 * s, 0.6 * s, 0); g.add(bed);
  for (const side of [-1, 1]) {
    const sp = makeBox(bedW, bedH * 0.5, 0.05, bedMat);
    sp.position.set(-1.2 * s, 0.6 * s + bedH * 0.25, side * (bedD / 2 + 0.02)); g.add(sp);
  }

  const wR = 0.4 * s, wW = 0.2 * s;
  for (const wp of [{ x: 1.2 * s, z: 0.9 * s }, { x: 1.2 * s, z: -0.9 * s }, { x: -0.3 * s, z: 0.9 * s }, { x: -0.3 * s, z: -0.9 * s }, { x: -2.0 * s, z: 0.9 * s }, { x: -2.0 * s, z: -0.9 * s }]) {
    const wheel = buildWheel(p.wheelStyle ?? 'heavy_duty', wR, wW, p.condition ?? 0.6);
    wheel.position.set(wp.x, wR, wp.z); g.add(wheel);
  }

  const frontBumper = makeBox(0.15, 0.25 * s, 2.0 * s, cm);
  frontBumper.position.set(2.0 * s, 0.35 * s, 0); g.add(frontBumper);
  const rearBumper = frontBumper.clone();
  rearBumper.position.x = -2.75 * s; g.add(rearBumper);

  g.add(buildHeadlight(p.headlightStyle ?? 'rectangular', new THREE.Vector3(1.95 * s, 1.1 * s, 0.6 * s), p.condition ?? 0.6));
  g.add(buildHeadlight(p.headlightStyle ?? 'rectangular', new THREE.Vector3(1.95 * s, 1.1 * s, -0.6 * s), p.condition ?? 0.6));
  g.add(buildTaillight(p.taillightStyle ?? 'vertical_strip', new THREE.Vector3(-2.75 * s, 0.8 * s, 0.6 * s), p.condition ?? 0.6));
  g.add(buildTaillight(p.taillightStyle ?? 'vertical_strip', new THREE.Vector3(-2.75 * s, 0.8 * s, -0.6 * s), p.condition ?? 0.6));

  return g;
}

// ── Bus body ───────────────────────────────────────────────────────

function buildBus(p: VehicleParams): THREE.Group {
  const s = p.scale ?? 1;
  const pm = paintMat(p.paintColor ?? 0x006633, p.condition ?? 0.65);
  const gm = glassMat(p.windowTint ?? 0.3, p.condition ?? 0.65);
  const g = new THREE.Group();
  g.name = 'vehicle_bus';

  g.add(makeBox(8 * s, 2.4 * s, 2.2 * s, pm).translateY(1.6 * s));
  g.add(makeBox(3 * s, 0.4 * s, 0.05, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 })).translateY(2.8 * s).translateZ(1.1 * s + 0.02));
  for (let i = 0; i < 6; i++) {
    const wx = -3 * s + i * 1.2 * s;
    for (const side of [-1, 1]) {
      const win = makeBox(0.9 * s, 0.8 * s, 0.04, gm);
      win.position.set(wx, 2.1 * s, side * (1.1 * s + 0.02)); g.add(win);
    }
  }
  g.add(makeBox(0.05, 1.0 * s, 2.0 * s, gm).translateX(4 * s).translateY(2.2 * s));
  g.add(makeBox(0.05, 0.8 * s, 1.8 * s, gm).translateX(-4 * s).translateY(2.2 * s));

  const wR = 0.45 * s, wW = 0.22 * s;
  for (const wp of [{ x: 2.8 * s, z: 1.15 * s }, { x: 2.8 * s, z: -1.15 * s }, { x: -2.5 * s, z: 1.15 * s }, { x: -2.5 * s, z: -1.15 * s }]) {
    const wheel = buildWheel(p.wheelStyle ?? 'heavy_duty', wR, wW, p.condition ?? 0.65);
    wheel.position.set(wp.x, wR, wp.z); g.add(wheel);
  }

  g.add(buildHeadlight(p.headlightStyle ?? 'rectangular', new THREE.Vector3(4.05 * s, 1.4 * s, 0.7 * s), p.condition ?? 0.65));
  g.add(buildHeadlight(p.headlightStyle ?? 'rectangular', new THREE.Vector3(4.05 * s, 1.4 * s, -0.7 * s), p.condition ?? 0.65));
  g.add(buildTaillight(p.taillightStyle ?? 'vertical_strip', new THREE.Vector3(-4.05 * s, 1.4 * s, 0.7 * s), p.condition ?? 0.65));
  g.add(buildTaillight(p.taillightStyle ?? 'vertical_strip', new THREE.Vector3(-4.05 * s, 1.4 * s, -0.7 * s), p.condition ?? 0.65));

  return g;
}

// ── Taxi body ──────────────────────────────────────────────────────

function buildTaxi(p: VehicleParams): THREE.Group {
  const s = p.scale ?? 1;
  const g = new THREE.Group();
  g.name = 'vehicle_taxi';
  const taxiParams: VehicleParams = { ...p };
  delete (taxiParams as any).roofDetails;
  const carGroup = buildCar(taxiParams);
  carGroup.traverse((child) => g.add(child));

  const rlMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, emissive: 0xFFFF88, emissiveIntensity: 0.8, roughness: 0.3 });
  g.add(makeBox(0.6 * s, 0.2 * s, 0.4 * s, rlMat).translateY(1.6 * s));
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
  const stripe = makeBox(3.4 * s, 0.08 * s, 0.02, stripeMat);
  stripe.position.set(0, 0.7 * s, 0.81 * s); g.add(stripe);
  const stripe2 = stripe.clone();
  stripe2.position.z = -0.81 * s; g.add(stripe2);
  return g;
}

// ── Tram body ──────────────────────────────────────────────────────

function buildTram(p: VehicleParams): THREE.Group {
  const s = p.scale ?? 1;
  const pm = paintMat(p.paintColor ?? 0xCC3333, p.condition ?? 0.6);
  const gm = glassMat(p.windowTint ?? 0.3, p.condition ?? 0.6);
  const cm = chromeMat(p.condition ?? 0.6);
  const g = new THREE.Group();
  g.name = 'vehicle_tram';

  g.add(makeBox(7 * s, 2.6 * s, 2.4 * s, pm).translateY(1.7 * s));
  const roofGeo = new THREE.CylinderGeometry(1.2 * s, 1.2 * s, 7 * s, 16, 1, false, 0, Math.PI);
  const roof = new THREE.Mesh(roofGeo, pm);
  roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2;
  roof.position.set(0, 3.0 * s, 0); g.add(roof);
  for (let i = 0; i < 7; i++) {
    const wx = -3 * s + i * 1.0 * s;
    for (const side of [-1, 1]) {
      const win = makeBox(0.7 * s, 1.0 * s, 0.04, gm);
      win.position.set(wx, 2.0 * s, side * (1.2 * s + 0.02)); g.add(win);
    }
  }
  for (const doorX of [-1.5 * s, 1.5 * s]) {
    g.add(makeBox(0.06, 1.8 * s, 1.0 * s, cm).translateX(doorX).translateY(1.4 * s).translateZ(1.22 * s));
    g.add(makeBox(0.04, 1.6 * s, 0.9 * s, gm).translateX(doorX).translateY(1.4 * s).translateZ(1.23 * s));
  }
  const wR = 0.35 * s, wW = 0.18 * s;
  for (const wp of [{ x: 2.5 * s, z: 1.2 * s }, { x: 2.5 * s, z: -1.2 * s }, { x: -2.5 * s, z: 1.2 * s }, { x: -2.5 * s, z: -1.2 * s }]) {
    const wheel = buildWheel(p.wheelStyle ?? 'simple', wR, wW, p.condition ?? 0.6);
    wheel.position.set(wp.x, wR, wp.z); g.add(wheel);
  }
  const poleMat = chromeMat(p.condition ?? 0.6);
  g.add(makeCyl(0.03 * s, 0.03 * s, 2.0 * s, 8, poleMat).translateY(4.2 * s));
  g.add(makeBox(0.3 * s, 0.06 * s, 0.1 * s, poleMat).translateY(5.2 * s));
  g.add(buildHeadlight(p.headlightStyle ?? 'round', new THREE.Vector3(3.55 * s, 1.5 * s, 0.8 * s), p.condition ?? 0.6));
  g.add(buildHeadlight(p.headlightStyle ?? 'round', new THREE.Vector3(3.55 * s, 1.5 * s, -0.8 * s), p.condition ?? 0.6));
  g.add(buildTaillight(p.taillightStyle ?? 'round', new THREE.Vector3(-3.55 * s, 1.5 * s, 0.8 * s), p.condition ?? 0.6));
  g.add(buildTaillight(p.taillightStyle ?? 'round', new THREE.Vector3(-3.55 * s, 1.5 * s, -0.8 * s), p.condition ?? 0.6));

  return g;
}

// ── Van body ───────────────────────────────────────────────────────

function buildVan(p: VehicleParams): THREE.Group {
  const s = p.scale ?? 1;
  const pm = paintMat(p.paintColor ?? 0xEEEEEE, p.condition ?? 0.7);
  const gm = glassMat(p.windowTint ?? 0.4, p.condition ?? 0.7);
  const g = new THREE.Group();
  g.name = 'vehicle_van';

  g.add(makeBox(4.5 * s, 1.8 * s, 2.0 * s, pm).translateY(1.2 * s));
  g.add(makeBox(4.5 * s, 0.08 * s, 2.0 * s, pm).translateY(2.14 * s));
  g.add(makeBox(0.05, 0.7 * s, 1.8 * s, gm).translateX(2.25 * s).translateY(1.7 * s));
  for (const side of [-1, 1]) {
    g.add(makeBox(1.2 * s, 0.5 * s, 0.03, gm).translateY(1.6 * s).translateZ(side * 1.02 * s));
    g.add(makeBox(0.8 * s, 0.5 * s, 0.03, gm).translateX(1.3 * s).translateY(1.6 * s).translateZ(side * 1.02 * s));
  }
  const wR = 0.35 * s, wW = 0.18 * s;
  for (const wp of [{ x: 1.5 * s, z: 1.05 * s }, { x: 1.5 * s, z: -1.05 * s }, { x: -1.5 * s, z: 1.05 * s }, { x: -1.5 * s, z: -1.05 * s }]) {
    const wheel = buildWheel(p.wheelStyle ?? 'spoke', wR, wW, p.condition ?? 0.7);
    wheel.position.set(wp.x, wR, wp.z); g.add(wheel);
  }
  g.add(buildHeadlight(p.headlightStyle ?? 'rectangular', new THREE.Vector3(2.3 * s, 1.2 * s, 0.6 * s), p.condition ?? 0.7));
  g.add(buildHeadlight(p.headlightStyle ?? 'rectangular', new THREE.Vector3(2.3 * s, 1.2 * s, -0.6 * s), p.condition ?? 0.7));
  g.add(buildTaillight(p.taillightStyle ?? 'rectangular', new THREE.Vector3(-2.3 * s, 1.2 * s, 0.6 * s), p.condition ?? 0.7));
  g.add(buildTaillight(p.taillightStyle ?? 'rectangular', new THREE.Vector3(-2.3 * s, 1.2 * s, -0.6 * s), p.condition ?? 0.7));

  return g;
}

// ── Sedan (refined car) ────────────────────────────────────────────

function buildSedan(params: VehicleParams): THREE.Group {
  const result = buildCar({ ...params, roofShape: 'curved' as const });
  result.name = 'vehicle_sedan';
  return result;
}

// ── Coupe (sloped roof car) ────────────────────────────────────────

function buildCoupe(params: VehicleParams): THREE.Group {
  const result = buildCar({ ...params, roofShape: 'sloped' as const });
  result.name = 'vehicle_coupe';
  return result;
}

// ── Pickup truck ───────────────────────────────────────────────────

function buildPickup(p: VehicleParams): THREE.Group {
  const s = p.scale ?? 1;
  const g = new THREE.Group();
  g.name = 'vehicle_pickup';
  const pm = paintMat(p.paintColor ?? 0x336699, p.condition ?? 0.7);

  g.add(makeBox(1.8 * s, 1.3 * s, 1.8 * s, pm).translateX(1.0 * s).translateY(1.0 * s));
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.2 });
  g.add(makeBox(2.5 * s, 0.5 * s, 1.6 * s, bedMat).translateX(-1.0 * s).translateY(0.55 * s));
  const wR = 0.35 * s, wW = 0.18 * s;
  for (const wp of [{ x: 1.2 * s, z: 0.9 * s }, { x: 1.2 * s, z: -0.9 * s }, { x: -1.8 * s, z: 0.9 * s }, { x: -1.8 * s, z: -0.9 * s }]) {
    const wheel = buildWheel(p.wheelStyle ?? 'spoke', wR, wW, p.condition ?? 0.7);
    wheel.position.set(wp.x, wR, wp.z); g.add(wheel);
  }
  return g;
}

// ── Tanker truck ───────────────────────────────────────────────────

function buildTanker(p: VehicleParams): THREE.Group {
  const s = p.scale ?? 1;
  const cond = p.condition ?? 0.6;
  const g = new THREE.Group();
  g.name = 'vehicle_tanker';
  const pm = paintMat(p.paintColor ?? 0x666699, cond);

  g.add(makeBox(1.8 * s, 1.4 * s, 1.8 * s, pm).translateX(2.5 * s).translateY(1.1 * s));
  const tankGeo = new THREE.CylinderGeometry(0.8 * s, 0.8 * s, 4.0 * s, 16, 1);
  const tank = new THREE.Mesh(tankGeo, pm);
  tank.rotation.z = Math.PI / 2; tank.position.set(-0.5 * s, 1.2 * s, 0); g.add(tank);
  for (const side of [-1, 1]) {
    const capGeo = new THREE.SphereGeometry(0.8 * s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, pm);
    cap.rotation.z = side * Math.PI / 2;
    cap.position.set(-0.5 * s + side * 2.0 * s, 1.2 * s, 0); g.add(cap);
  }
  const wR = 0.4 * s, wW = 0.2 * s;
  for (const wp of [{ x: 2.5 * s, z: 0.95 * s }, { x: 2.5 * s, z: -0.95 * s }, { x: 0.0 * s, z: 0.95 * s }, { x: 0.0 * s, z: -0.95 * s }, { x: -2.0 * s, z: 0.95 * s }, { x: -2.0 * s, z: -0.95 * s }]) {
    const wheel = buildWheel('heavy_duty', wR, wW, cond);
    wheel.position.set(wp.x, wR, wp.z); g.add(wheel);
  }
  return g;
}

// ── Style registry ─────────────────────────────────────────────────

const BODY_BUILDERS: Record<VehicleBodyType, (p: VehicleParams) => THREE.Group> = {
  car: buildCar, truck: buildTruck, bus: buildBus, taxi: buildTaxi, tram: buildTram,
  van: buildVan, sedan: buildSedan, coupe: buildCoupe, pickup: buildPickup, tanker: buildTanker,
};

/**
 * Generate a parametric vehicle of the specified body type.
 */
export function generateVehicle(params: VehicleParams): VehicleResult {
  const { type = 'car' } = params;
  const builder = BODY_BUILDERS[type];
  const vehicleGroup = builder(params);

  return {
    group: vehicleGroup,
    dispose() {
      vehicleGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose();
          const m = (obj as THREE.Mesh).material;
          if (Array.isArray(m)) { for (const mat of m) mat.dispose(); } else if (m) { m.dispose(); }
        }
      });
    },
  };
}
