import * as THREE from 'three';

export interface PropsParams {
  type?: PropType;
  scale?: number;
  style?: PropStyle;
  color?: number;
  condition?: number;
  lit?: boolean;
  ornate?: boolean;
}

export type PropType =
  | 'lamp_post' | 'hydrant' | 'bench' | 'trash_can' | 'phone_booth'
  | 'newspaper_box' | 'bike_rack' | 'planter' | 'ac_unit' | 'solar_panel'
  | 'ev_charger' | 'cctv' | 'bollard' | 'mailbox' | 'bus_stop';

export type PropStyle = 'classic' | 'modern' | 'industrial' | 'art_deco' | 'minimal';

export interface PropsResult {
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

function hexMat(hex: number, roughness = 0.7, metalness = 0.0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness, metalness });
}

function ironMat(cond: number): THREE.MeshStandardMaterial {
  const s = 0.15 + (1 - cond) * 0.1;
  return hexMat(new THREE.Color().setRGB(s, s, s).getHex(), 0.7, 0.6);
}

function steelMat(cond: number): THREE.MeshStandardMaterial {
  const s = 0.4 + cond * 0.4;
  return hexMat(new THREE.Color().setRGB(s, s, s).getHex(), 0.4, 0.8);
}

function concreteMat(cond: number): THREE.MeshStandardMaterial {
  const s = 0.4 + cond * 0.3;
  return hexMat(new THREE.Color().setRGB(s, s, s * 0.98).getHex(), 0.9, 0);
}

function chromeMat(cond: number): THREE.MeshStandardMaterial {
  const s = 0.7 + cond * 0.25;
  return hexMat(new THREE.Color().setRGB(s, s, s).getHex(), 0.08, 0.95);
}

// ── Lamp Post ──────────────────────────────────────────────────────

function buildLampPost(p: PropsParams): THREE.Group {
  const { scale = 1, lit = true, condition = 0.7, ornate = false } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_lamp_post';
  const poleMat = ironMat(condition);
  const baseH = 3.5 * s;
  g.add(makeCyl(0.15 * s, 0.2 * s, 0.15 * s, 12, poleMat).translateY(0.075 * s));
  g.add(makeCyl(0.04 * s, 0.06 * s, baseH, 8, poleMat).translateY(baseH / 2 + 0.15 * s));
  if (ornate || p.style === 'classic') {
    g.add(makeCyl(0.08 * s, 0.08 * s, 0.08 * s, 12, poleMat).translateY(baseH + 0.15 * s));
  }
  const arm = makeCyl(0.025 * s, 0.025 * s, 0.6 * s, 8, poleMat);
  arm.rotation.z = Math.PI / 2; arm.position.set(0.3 * s, baseH + 0.2 * s, 0); g.add(arm);
  const housingMat = hexMat(p.style === 'classic' ? 0x1A1A1A : 0x444444, 0.5, 0.3);
  g.add(makeCyl(0.12 * s, 0.15 * s, 0.25 * s, 12, housingMat).translateY(baseH + 0.2 * s));
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xFFFFDD, transparent: true, opacity: 0.3 + condition * 0.3, roughness: 0.02, transmission: 0.6, thickness: 0.01 });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 12, 10), glassMat);
  globe.position.set(0.6 * s, baseH + 0.05 * s, 0); g.add(globe);
  if (lit) {
    const light = new THREE.PointLight(0xFFEECC, 1.5 * s, 8 * s);
    light.position.set(0.6 * s, baseH + 0.05 * s, 0); g.add(light);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xFFEECC, transparent: true, opacity: 0.4 });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 8, 8), glowMat);
    glow.position.copy(light.position); g.add(glow);
  }
  return g;
}

// ── Fire Hydrant ───────────────────────────────────────────────────

function buildHydrant(p: PropsParams): THREE.Group {
  const { scale = 1, color = 0xCC2222, condition = 0.6 } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_hydrant';
  const bodyMat = hexMat(color, 0.4, 0.3);
  const crm = chromeMat(condition);
  g.add(makeCyl(0.12 * s, 0.15 * s, 0.2 * s, 12, bodyMat).translateY(0.1 * s));
  g.add(makeCyl(0.1 * s, 0.12 * s, 0.5 * s, 12, bodyMat).translateY(0.45 * s));
  const domeGeo = new THREE.SphereGeometry(0.1 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  g.add(new THREE.Mesh(domeGeo, bodyMat).translateY(0.7 * s));
  g.add(makeCyl(0.04 * s, 0.04 * s, 0.04 * s, 6, crm).translateY(0.78 * s));
  for (const side of [-1, 1]) {
    const nozzle = makeCyl(0.04 * s, 0.04 * s, 0.15 * s, 8, bodyMat);
    nozzle.rotation.z = side * Math.PI / 2; nozzle.position.set(side * 0.15 * s, 0.4 * s, 0); g.add(nozzle);
    const cap = makeCyl(0.05 * s, 0.05 * s, 0.04 * s, 8, crm);
    cap.rotation.z = side * Math.PI / 2; cap.position.set(side * 0.24 * s, 0.4 * s, 0); g.add(cap);
  }
  const fn = makeCyl(0.04 * s, 0.04 * s, 0.12 * s, 8, bodyMat); fn.position.set(0, 0.35 * s, 0.12 * s); g.add(fn);
  const fc = makeCyl(0.05 * s, 0.05 * s, 0.04 * s, 8, crm); fc.position.set(0, 0.35 * s, 0.2 * s); g.add(fc);
  return g;
}

// ── Bench ──────────────────────────────────────────────────────────

function buildBench(p: PropsParams): THREE.Group {
  const { scale = 1, condition = 0.7 } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_bench';
  const seatMat = p.style === 'classic' ? hexMat(0x8B6914, 0.8) : hexMat(0x666666, 0.7);
  const frameMat = ironMat(condition);
  const seatW = 1.6 * s, seatD = 0.4 * s;
  for (let i = 0; i < 4; i++) {
    const slat = makeBox(seatW, 0.03 * s, seatD, seatMat);
    slat.position.y = 0.45 * s + i * 0.03 * s; g.add(slat);
  }
  for (let i = 0; i < 3; i++) {
    const bs = makeBox(seatW, 0.03 * s, 0.03 * s, seatMat);
    bs.position.set(0, 0.65 * s + i * 0.12 * s, -seatD / 2 + 0.02 * s); g.add(bs);
  }
  for (const x of [-0.7 * s, 0.7 * s]) {
    for (const z of [-seatD / 2 + 0.02 * s, seatD / 2 - 0.02 * s]) {
      const leg = makeBox(0.04 * s, 0.45 * s, 0.04 * s, frameMat);
      leg.position.set(x, 0.225 * s, z); g.add(leg);
    }
  }
  for (const side of [-1, 1]) {
    const arm = makeBox(0.04 * s, 0.15 * s, seatD, frameMat);
    arm.position.set(side * 0.75 * s, 0.55 * s, 0); g.add(arm);
  }
  return g;
}

// ── Trash Can ──────────────────────────────────────────────────────

function buildTrashCan(p: PropsParams): THREE.Group {
  const { scale = 1, condition = 0.6 } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_trash_can';
  const bodyMat = steelMat(condition);
  const lidMat = ironMat(condition);
  g.add(makeCyl(0.2 * s, 0.18 * s, 0.7 * s, 12, bodyMat).translateY(0.35 * s));
  g.add(makeCyl(0.22 * s, 0.22 * s, 0.04 * s, 12, lidMat).translateY(0.72 * s));
  const lidGeo = new THREE.SphereGeometry(0.21 * s, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  g.add(new THREE.Mesh(lidGeo, lidMat).translateY(0.74 * s));
  g.add(makeCyl(0.015 * s, 0.015 * s, 0.1 * s, 6, lidMat).translateY(0.82 * s));
  if (p.style !== 'minimal') {
    for (const y of [0.25 * s, 0.55 * s]) {
      g.add(makeCyl(0.21 * s, 0.21 * s, 0.02 * s, 12, lidMat).translateY(y));
    }
  }
  return g;
}

// ── Phone Booth ────────────────────────────────────────────────────

function buildPhoneBooth(p: PropsParams): THREE.Group {
  const { scale = 1, color = 0x2244AA, condition = 0.7, ornate = false } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_phone_booth';
  const frameMat = ironMat(condition);
  const gm = new THREE.MeshPhysicalMaterial({ color: 0xAADDFF, transparent: true, opacity: 0.25 + condition * 0.3, roughness: 0.02, transmission: 0.5, thickness: 0.01 });
  const pm = hexMat(color, 0.5, 0.2);
  g.add(makeBox(1.0 * s, 0.05 * s, 0.6 * s, concreteMat(condition)).translateY(0.025 * s));
  g.add(makeBox(1.0 * s, 1.8 * s, 0.03 * s, pm).translateY(0.95 * s).translateZ(-0.3 * s));
  for (const side of [-1, 1]) {
    const lowerS = makeBox(0.03 * s, 0.7 * s, 0.6 * s, pm); lowerS.position.set(side * 0.5 * s, 0.4 * s, 0); g.add(lowerS);
    const upperS = makeBox(0.03 * s, 1.1 * s, 0.6 * s, gm); upperS.position.set(side * 0.5 * s, 1.3 * s, 0); g.add(upperS);
  }
  g.add(makeBox(1.05 * s, 0.06 * s, 0.65 * s, pm).translateY(1.85 * s));
  if (ornate) g.add(makeBox(1.1 * s, 0.1 * s, 0.7 * s, frameMat).translateY(1.93 * s));
  const phoneMat = hexMat(0x333333, 0.4, 0.3);
  g.add(makeBox(0.15 * s, 0.25 * s, 0.08 * s, phoneMat).translateY(1.1 * s).translateZ(-0.25 * s));
  g.add(makeBox(0.08 * s, 0.04 * s, 0.2 * s, phoneMat).translateY(1.25 * s).translateZ(-0.22 * s));
  g.add(makeBox(0.04 * s, 1.6 * s, 0.04 * s, frameMat).translateX(0.5 * s).translateY(0.85 * s).translateZ(0.28 * s));
  g.add(makeBox(0.02 * s, 1.4 * s, 0.5 * s, gm).translateX(0.5 * s).translateY(0.8 * s).translateZ(0.05 * s));
  return g;
}

// ── Newspaper Box ──────────────────────────────────────────────────

function buildNewspaperBox(p: PropsParams): THREE.Group {
  const { scale = 1, color = 0x444444 } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_newspaper_box';
  const bodyMat = hexMat(color, 0.6, 0.2);
  const gm = new THREE.MeshPhysicalMaterial({ color: 0xAADDFF, transparent: true, opacity: 0.3, roughness: 0.05, transmission: 0.4, thickness: 0.01 });
  const bw = 0.5 * s, bh = 0.6 * s, bd = 0.35 * s;
  g.add(makeBox(bw, bh, bd, bodyMat).translateY(bh / 2 + 0.05 * s));
  const dg = new THREE.PlaneGeometry(bw - 0.05 * s, bh * 0.7);
  const disp = new THREE.Mesh(dg, gm); disp.position.set(0, bh * 0.45, bd / 2 + 0.01); disp.rotation.x = -Math.PI / 6; g.add(disp);
  g.add(makeBox(bw + 0.06 * s, 0.03 * s, bd + 0.1 * s, bodyMat).translateY(bh + 0.05 * s));
  for (const x of [-bw / 2 + 0.03 * s, bw / 2 - 0.03 * s]) {
    for (const z of [-bd / 2 + 0.03 * s, bd / 2 - 0.03 * s]) {
      const leg = makeBox(0.03 * s, 0.05 * s, 0.03 * s, bodyMat); leg.position.set(x, 0.025 * s, z); g.add(leg);
    }
  }
  return g;
}

// ── Bike Rack ──────────────────────────────────────────────────────

function buildBikeRack(p: PropsParams): THREE.Group {
  const { scale = 1, condition = 0.7 } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_bike_rack';
  const rm = ironMat(condition);
  const hoopCount = 4, hs = 0.5 * s, hh = 0.7 * s, hr = 0.25 * s;
  for (let i = 0; i < hoopCount; i++) {
    const hx = -((hoopCount - 1) / 2) * hs + i * hs;
    for (const dx of [-hr, hr]) {
      const leg = makeCyl(0.015 * s, 0.015 * s, hh, 6, rm); leg.position.set(hx + dx, hh / 2, 0); g.add(leg);
    }
    const topBar = makeCyl(0.015 * s, 0.015 * s, hr * 2, 6, rm);
    topBar.rotation.z = Math.PI / 2; topBar.position.set(hx, hh, 0); g.add(topBar);
  }
  return g;
}

// ── Planter ────────────────────────────────────────────────────────

function buildPlanter(p: PropsParams): THREE.Group {
  const { scale = 1, condition = 0.7 } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_planter';
  const planterMat = p.style === 'classic' ? concreteMat(condition) : hexMat(0x8B6914, 0.7);
  g.add(makeBox(1.0 * s, 0.5 * s, 0.4 * s, planterMat).translateY(0.25 * s));
  g.add(makeBox(0.9 * s, 0.05 * s, 0.3 * s, hexMat(0x3B2F1E, 0.95)).translateY(0.48 * s));
  const plantMat = hexMat(0x2D5A27, 0.85);
  for (const bp of [{ x: -0.3 * s, z: 0 }, { x: 0, z: 0.05 * s }, { x: 0.3 * s, z: 0 }]) {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 8, 6), plantMat);
    bush.position.set(bp.x, 0.55 * s, bp.z); g.add(bush);
  }
  return g;
}

// ── AC Unit ────────────────────────────────────────────────────────

function buildACUnit(p: PropsParams): THREE.Group {
  const { scale = 1 } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_ac_unit';
  const bodyMat = hexMat(0xDDDDDD, 0.6, 0.1);
  const grillMat = hexMat(0x888888, 0.5, 0.3);
  g.add(makeBox(0.6 * s, 0.5 * s, 0.3 * s, bodyMat).translateY(0.25 * s));
  for (let i = 0; i < 5; i++) {
    const line = makeBox(0.5 * s, 0.015 * s, 0.02 * s, grillMat);
    line.position.set(0, 0.15 * s + i * 0.06 * s, 0.16 * s); g.add(line);
  }
  for (let i = 0; i < 3; i++) {
    const vent = makeBox(0.08 * s, 0.02 * s, 0.2 * s, grillMat);
    vent.position.set(-0.15 * s + i * 0.15 * s, 0.51 * s, 0); g.add(vent);
  }
  const drainMat = hexMat(0xAAAAAA, 0.5, 0.2);
  g.add(makeCyl(0.02 * s, 0.02 * s, 0.3 * s, 6, drainMat).translateX(0.25 * s).translateY(0.15 * s).translateZ(0.15 * s));
  return g;
}

// ── Solar Panel ────────────────────────────────────────────────────

function buildSolarPanel(p: PropsParams): THREE.Group {
  const { scale = 1, condition = 0.7 } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_solar_panel';
  const frameMat = steelMat(condition);
  const cellMat = new THREE.MeshStandardMaterial({ color: 0x1A237E, roughness: 0.3, metalness: 0.5 });
  const pw = 1.6 * s, ph = 1.0 * s, tiltAngle = Math.PI / 6;
  g.add(makeBox(pw + 0.06 * s, ph + 0.06 * s, 0.04 * s, frameMat).translateY(1.8 * s).rotateX(-tiltAngle));
  g.add(makeBox(pw, ph, 0.02 * s, cellMat).translateY(1.8 * s).rotateX(-tiltAngle));
  const gridMat = hexMat(0xCCCCCC, 0.3, 0.5);
  for (let i = 1; i < 4; i++) {
    const vLine = makeBox(0.008 * s, ph, 0.005 * s, gridMat);
    vLine.position.set(-pw / 2 + i * pw / 4, 1.8 * s, 0.015 * s); vLine.rotation.x = -tiltAngle; g.add(vLine);
  }
  for (let i = 1; i < 3; i++) {
    const hLine = makeBox(pw, 0.008 * s, 0.005 * s, gridMat);
    hLine.position.set(0, 1.8 * s - ph / 2 + i * ph / 3, 0.015 * s); hLine.rotation.x = -tiltAngle; g.add(hLine);
  }
  g.add(makeCyl(0.04 * s, 0.05 * s, 1.5 * s, 8, frameMat).translateY(1.05 * s));
  const brace = makeBox(0.8 * s, 0.03 * s, 0.03 * s, frameMat);
  brace.position.set(0.3 * s, 1.2 * s, -0.2 * s); brace.rotation.z = 0.3; g.add(brace);
  return g;
}

// ── EV Charger ─────────────────────────────────────────────────────

function buildEVCharger(p: PropsParams): THREE.Group {
  const { scale = 1, color = 0x00AA66 } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_ev_charger';
  const bodyMat = hexMat(color, 0.4, 0.2);
  const screenMat = hexMat(0x111111, 0.1, 0.5);
  g.add(makeBox(0.35 * s, 1.6 * s, 0.25 * s, bodyMat).translateY(0.8 * s));
  g.add(makeBox(0.25 * s, 0.3 * s, 0.01 * s, screenMat).translateY(1.15 * s).translateZ(0.13 * s));
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x00FF88, transparent: true, opacity: 0.3 });
  g.add(makeBox(0.23 * s, 0.28 * s, 0.005 * s, glowMat).translateY(1.15 * s).translateZ(0.14 * s));
  g.add(makeBox(0.1 * s, 0.15 * s, 0.08 * s, hexMat(0x333333, 0.5, 0.2)).translateX(0.1 * s).translateY(0.7 * s).translateZ(0.15 * s));
  const cableMat = hexMat(0x222222, 0.8);
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    const cx = 0.1 * s + t * 0.3 * s, cy = 0.7 * s - t * 0.3 * s, cz = 0.15 * s + t * 0.2 * s;
    const seg = makeCyl(0.012 * s, 0.012 * s, 0.08 * s, 6, cableMat);
    seg.position.set(cx, cy, cz); seg.rotation.z = Math.PI / 4; g.add(seg);
  }
  const connector = makeBox(0.08 * s, 0.1 * s, 0.06 * s, hexMat(0x444444, 0.4, 0.3));
  connector.position.set(0.4 * s, 0.4 * s, 0.35 * s); connector.rotation.z = -0.3; g.add(connector);
  const ledRingMat = new THREE.MeshBasicMaterial({ color: 0x00FF88, transparent: true, opacity: 0.6 });
  const ledRing = new THREE.Mesh(new THREE.TorusGeometry(0.04 * s, 0.008 * s, 8, 16), ledRingMat);
  ledRing.position.set(0, 0.95 * s, 0.13 * s); g.add(ledRing);
  return g;
}

// ── CCTV Camera ────────────────────────────────────────────────────

function buildCCTV(p: PropsParams): THREE.Group {
  const { scale = 1, ornate = false, condition = 0.7 } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_cctv';
  const mountMat = ironMat(condition);
  const cameraMat = hexMat(0xCCCCCC, 0.4, 0.3);
  g.add(makeCyl(0.025 * s, 0.03 * s, 2.5 * s, 8, mountMat).translateY(1.25 * s));
  const arm = makeCyl(0.02 * s, 0.02 * s, 0.5 * s, 8, mountMat);
  arm.rotation.z = Math.PI / 2; arm.position.set(0.25 * s, 2.5 * s, 0); g.add(arm);
  const housing = makeCyl(0.06 * s, 0.05 * s, 0.25 * s, 10, cameraMat);
  housing.rotation.z = Math.PI / 2; housing.position.set(0.5 * s, 2.45 * s, 0); g.add(housing);
  const hood = makeCyl(0.07 * s, 0.06 * s, 0.05 * s, 10, cameraMat);
  hood.rotation.z = Math.PI / 2; hood.position.set(0.65 * s, 2.45 * s, 0); g.add(hood);
  const irMat = hexMat(0x220000, 0.3, 0);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.008 * s, 6, 6), irMat);
    led.position.set(0.65 * s + Math.cos(angle) * 0.04 * s, 2.45 * s + Math.sin(angle) * 0.04 * s, 0); g.add(led);
  }
  if (ornate) g.add(makeCyl(0.035 * s, 0.035 * s, 0.06 * s, 10, mountMat).translateY(2.5 * s));
  return g;
}

// ── Bollard ────────────────────────────────────────────────────────

function buildBollard(p: PropsParams): THREE.Group {
  const { scale = 1, condition = 0.7 } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_bollard';
  const bodyMat = steelMat(condition);
  const reflectorMat = hexMat(0xFFFF00, 0.2, 0);
  g.add(makeCyl(0.05 * s, 0.06 * s, 0.9 * s, 10, bodyMat).translateY(0.45 * s));
  g.add(makeCyl(0.065 * s, 0.065 * s, 0.06 * s, 10, reflectorMat).translateY(0.65 * s));
  g.add(makeCyl(0.055 * s, 0.05 * s, 0.04 * s, 10, bodyMat).translateY(0.92 * s));
  g.add(makeCyl(0.1 * s, 0.1 * s, 0.02 * s, 10, bodyMat).translateY(0.01 * s));
  return g;
}

// ── Mailbox ────────────────────────────────────────────────────────

function buildMailbox(p: PropsParams): THREE.Group {
  const { scale = 1, color = 0x003366, condition = 0.6 } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_mailbox';
  const bodyMat = hexMat(color, 0.5, 0.2);
  const flagMat = hexMat(0xFF0000, 0.6, 0.1);
  const postMat = ironMat(condition);
  g.add(makeCyl(0.025 * s, 0.03 * s, 1.0 * s, 8, postMat).translateY(0.5 * s));
  g.add(makeBox(0.35 * s, 0.25 * s, 0.2 * s, bodyMat).translateY(0.9 * s));
  const topGeo = new THREE.SphereGeometry(0.175 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  g.add(new THREE.Mesh(topGeo, bodyMat).translateY(1.025 * s));
  g.add(makeBox(0.15 * s, 0.18 * s, 0.02 * s, hexMat(0x002244, 0.5, 0.2)).translateY(0.88 * s).translateZ(0.11 * s));
  g.add(makeCyl(0.008 * s, 0.008 * s, 0.2 * s, 6, postMat).translateX(0.18 * s).translateY(0.95 * s));
  g.add(makeBox(0.1 * s, 0.06 * s, 0.01 * s, flagMat).translateX(0.23 * s).translateY(1.02 * s));
  return g;
}

// ── Bus Stop ───────────────────────────────────────────────────────

function buildBusStop(p: PropsParams): THREE.Group {
  const { scale = 1, condition = 0.7, ornate = false } = p;
  const s = scale;
  const g = new THREE.Group(); g.name = 'prop_bus_stop';
  const frameMat = ironMat(condition);
  const gm = new THREE.MeshPhysicalMaterial({ color: 0xAADDFF, transparent: true, opacity: 0.25, roughness: 0.02, transmission: 0.5, thickness: 0.01 });
  g.add(makeBox(1.5 * s, 1.4 * s, 0.03 * s, gm).translateY(1.2 * s).translateZ(-0.4 * s));
  g.add(makeBox(1.6 * s, 0.05 * s, 0.6 * s, frameMat).translateY(1.95 * s).translateZ(-0.1 * s));
  for (const x of [-0.7 * s, 0.7 * s]) {
    const pole = makeCyl(0.03 * s, 0.035 * s, 1.95 * s, 8, frameMat);
    pole.position.set(x, 0.975 * s, -0.35 * s); g.add(pole);
  }
  g.add(makeBox(1.2 * s, 0.04 * s, 0.35 * s, hexMat(0x8B6914, 0.7)).translateY(0.45 * s).translateZ(-0.35 * s));
  for (const x of [-0.5 * s, 0.5 * s]) {
    const leg = makeBox(0.04 * s, 0.43 * s, 0.04 * s, frameMat);
    leg.position.set(x, 0.215 * s, -0.35 * s); g.add(leg);
  }
  if (ornate) g.add(makeBox(0.5 * s, 0.3 * s, 0.02 * s, hexMat(0x003366, 0.5, 0.2)).translateY(1.7 * s).translateZ(-0.37 * s));
  return g;
}

// ── Style registry ─────────────────────────────────────────────────

const PROP_BUILDERS: Record<PropType, (p: PropsParams) => THREE.Group> = {
  lamp_post: buildLampPost, hydrant: buildHydrant, bench: buildBench,
  trash_can: buildTrashCan, phone_booth: buildPhoneBooth, newspaper_box: buildNewspaperBox,
  bike_rack: buildBikeRack, planter: buildPlanter, ac_unit: buildACUnit,
  solar_panel: buildSolarPanel, ev_charger: buildEVCharger, cctv: buildCCTV,
  bollard: buildBollard, mailbox: buildMailbox, bus_stop: buildBusStop,
};

export function generateProp(params: PropsParams): PropsResult {
  const { type = 'lamp_post' } = params;
  const builder = PROP_BUILDERS[type];
  const propGroup = builder(params);
  return {
    group: propGroup,
    dispose() {
      propGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose();
          const m = (obj as THREE.Mesh).material;
          if (Array.isArray(m)) { for (const mat of m) mat.dispose(); } else if (m) { m.dispose(); }
        }
        if ((obj as THREE.Light).isLight && (obj as THREE.Light).dispose) (obj as THREE.Light).dispose();
      });
    },
  };
}
