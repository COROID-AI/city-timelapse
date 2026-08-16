import * as THREE from 'three';
import type { EraId } from '../eras.js';

// ── Street furniture builders — era-evolving fixtures ─────────────────

/** Shared geometry cache for performance */
const _geoCache = new Map<string, THREE.BufferGeometry>();

function getGeo(key: string, builder: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let geo = _geoCache.get(key);
  if (!geo) {
    geo = builder();
    _geoCache.set(key, geo);
  }
  return geo;
}

// ── Lamp Post Builders ────────────────────────────────────────────────

interface LampPostConfig {
  /** Pole height in world units */
  poleHeight: number;
  /** Pole radius */
  poleRadius: number;
  /** Light color hex */
  lightColor: string;
  /** Emissive material color */
  emissiveColor: string;
  /** Whether lamp has a glass globe/shade */
  hasGlobe?: boolean;
  /** Shade style name */
  shadeStyle: 'gas-lantern' | 'cobra-head' | 'sodium-hood' | 'led-panel';
}

const LAMP_CONFIGS: Record<EraId, LampPostConfig> = {
  '1945': {
    poleHeight: 4,
    poleRadius: 0.06,
    lightColor: '#ffcc66',
    emissiveColor: '#ffaa33',
    hasGlobe: true,
    shadeStyle: 'gas-lantern',
  },
  '1965': {
    poleHeight: 5,
    poleRadius: 0.05,
    lightColor: '#ffffff',
    emissiveColor: '#dddddd',
    hasGlobe: false,
    shadeStyle: 'cobra-head',
  },
  '1985': {
    poleHeight: 5,
    poleRadius: 0.05,
    lightColor: '#ff9933',
    emissiveColor: '#ff8800',
    hasGlobe: false,
    shadeStyle: 'sodium-hood',
  },
  '2005': {
    poleHeight: 5,
    poleRadius: 0.045,
    lightColor: '#ffffff',
    emissiveColor: '#eeeeee',
    hasGlobe: false,
    shadeStyle: 'led-panel',
  },
  '2025': {
    poleHeight: 5,
    poleRadius: 0.04,
    lightColor: '#ffffff',
    emissiveColor: '#ffffff',
    hasGlobe: false,
    shadeStyle: 'led-panel',
  },
};

/** Build a gas-lamp style post (1945) */
function buildGasLampPost(config: LampPostConfig, poleMat: THREE.Material): THREE.Group {
  const group = new THREE.Group();

  // Main pole
  const poleGeo = getGeo('lamp_pole_4', () => new THREE.CylinderGeometry(config.poleRadius, config.poleRadius * 1.2, config.poleHeight, 8));
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = config.poleHeight / 2;
  group.add(pole);

  // Decorative base
  const baseGeo = new THREE.CylinderGeometry(config.poleRadius * 2, config.poleRadius * 2.5, 0.15, 8);
  const base = new THREE.Mesh(baseGeo, poleMat);
  base.position.y = 0.075;
  group.add(base);

  // Ornate top bracket
  const bracketGeo = new THREE.TorusGeometry(0.15, 0.03, 6, 8, Math.PI);
  const bracket = new THREE.Mesh(bracketGeo, poleMat);
  bracket.position.y = config.poleHeight - 0.1;
  bracket.rotation.z = Math.PI / 2;
  group.add(bracket);

  // Glass globe
  if (config.hasGlobe) {
    const globeGeo = new THREE.SphereGeometry(0.25, 12, 8);
    const globeMat = new THREE.MeshStandardMaterial({
      color: 0xffffcc,
      transparent: true,
      opacity: 0.5,
      roughness: 0.1,
      metalness: 0.0,
      emissive: new THREE.Color(config.emissiveColor),
      emissiveIntensity: 0.8,
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    globe.position.y = config.poleHeight + 0.05;
    group.add(globe);

    // Cap on top of globe
    const capGeo = new THREE.ConeGeometry(0.15, 0.15, 8);
    const cap = new THREE.Mesh(capGeo, poleMat);
    cap.position.y = config.poleHeight + 0.35;
    group.add(cap);
  } else {
    // Open lantern housing
    const housingGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.3, 8, 1, true);
    const housingMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.6,
      metalness: 0.8,
      side: THREE.DoubleSide,
    });
    const housing = new THREE.Mesh(housingGeo, housingMat);
    housing.position.y = config.poleHeight + 0.1;
    group.add(housing);
  }

  // Point light
  const light = new THREE.PointLight(new THREE.Color(config.lightColor), 1.5, 12);
  light.position.y = config.poleHeight + 0.1;
  group.add(light);

  return group;
}

/** Build a cobra-head mercury vapor lamp (1965) */
function buildCobraHeadLamp(config: LampPostConfig, poleMat: THREE.Material): THREE.Group {
  const group = new THREE.Group();

  // Tapered pole
  const poleGeo = getGeo('lamp_pole_5_cobra', () => new THREE.CylinderGeometry(config.poleRadius * 0.8, config.poleRadius, config.poleHeight, 8));
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = config.poleHeight / 2;
  group.add(pole);

  // Cobra head arm (curved pipe extending outward)
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, config.poleHeight - 0.3, 0),
    new THREE.Vector3(0.3, config.poleHeight - 0.1, 0),
    new THREE.Vector3(0.8, config.poleHeight + 0.1, 0),
    new THREE.Vector3(1.2, config.poleHeight, 0),
  ]);
  const armGeo = new THREE.TubeGeometry(armCurve, 12, 0.04, 6, false);
  const arm = new THREE.Mesh(armGeo, poleMat);
  group.add(arm);

  // Lamp head housing
  const headGeo = new THREE.BoxGeometry(0.6, 0.15, 0.35);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.5,
    metalness: 0.6,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(1.2, config.poleHeight - 0.05, 0);
  group.add(head);

  // Glow underneath
  const glowGeo = new THREE.PlaneGeometry(0.55, 0.3);
  const glowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.emissiveColor),
    emissive: new THREE.Color(config.emissiveColor),
    emissiveIntensity: 1.0,
    roughness: 0.3,
    transparent: true,
    opacity: 0.8,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(1.2, config.poleHeight - 0.13, 0);
  glow.rotation.x = Math.PI / 2;
  group.add(glow);

  // Point light
  const light = new THREE.PointLight(new THREE.Color(config.lightColor), 2, 15);
  light.position.set(1.2, config.poleHeight - 0.2, 0);
  group.add(light);

  return group;
}

/** Build a sodium-vapor hood lamp (1985) */
function buildSodiumHoodLamp(config: LampPostConfig, poleMat: THREE.Material): THREE.Group {
  const group = new THREE.Group();

  // Straight cylindrical pole
  const poleGeo = getGeo('lamp_pole_5_sodium', () => new THREE.CylinderGeometry(config.poleRadius, config.poleRadius, config.poleHeight, 8));
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = config.poleHeight / 2;
  group.add(pole);

  // Horizontal hood fixture
  const hoodGeo = new THREE.BoxGeometry(1.0, 0.12, 0.4);
  const hoodMat = new THREE.MeshStandardMaterial({
    color: 0x666666,
    roughness: 0.5,
    metalness: 0.5,
  });
  const hood = new THREE.Mesh(hoodGeo, hoodMat);
  hood.position.y = config.poleHeight + 0.05;
  group.add(hood);

  // Orange glowing panel under hood
  const panelGeo = new THREE.PlaneGeometry(0.9, 0.35);
  const panelMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.emissiveColor),
    emissive: new THREE.Color(config.emissiveColor),
    emissiveIntensity: 1.5,
    roughness: 0.4,
    transparent: true,
    opacity: 0.85,
  });
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.position.y = config.poleHeight - 0.02;
  panel.rotation.x = Math.PI / 2;
  group.add(panel);

  // Point light (warm orange sodium glow)
  const light = new THREE.PointLight(new THREE.Color(config.lightColor), 2.5, 18);
  light.position.y = config.poleHeight - 0.15;
  group.add(light);

  return group;
}

/** Build an LED panel lamp (2005+) */
function buildLEDLamp(config: LampPostConfig, poleMat: THREE.Material): THREE.Group {
  const group = new THREE.Group();

  // Sleek tapered pole
  const poleGeo = getGeo('lamp_pole_5_led', () => new THREE.CylinderGeometry(config.poleRadius * 0.6, config.poleRadius, config.poleHeight, 8));
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = config.poleHeight / 2;
  group.add(pole);

  // Slim LED panel head
  const headGeo = new THREE.BoxGeometry(0.8, 0.06, 0.3);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.3,
    metalness: 0.7,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = config.poleHeight + 0.03;
  group.add(head);

  // Full LED panel surface
  const panelGeo = new THREE.PlaneGeometry(0.75, 0.28);
  const panelMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.emissiveColor),
    emissive: new THREE.Color(config.emissiveColor),
    emissiveIntensity: 2.0,
    roughness: 0.1,
    transparent: true,
    opacity: 0.9,
  });
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.position.y = config.poleHeight - 0.01;
  panel.rotation.x = Math.PI / 2;
  group.add(panel);

  // Bright point light
  const light = new THREE.PointLight(new THREE.Color(config.lightColor), 3, 20);
  light.position.y = config.poleHeight - 0.1;
  group.add(light);

  return group;
}

// ── Phone Booth Builder ───────────────────────────────────────────────

/** Build a classic phone booth (1965-1985 era). Removed after 1985. */
export function buildPhoneBooth(eraId: EraId, width = 1.2, depth = 1.0, height = 2.8): THREE.Group {
  if (eraId === '2005' || eraId === '2025') return new THREE.Group(); // Not present in these eras

  const group = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({
    color: eraId === '1965' ? 0x336699 : 0x444444,
    roughness: 0.4,
    metalness: 0.6,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xaaccff,
    transparent: true,
    opacity: 0.3,
    roughness: 0.1,
    metalness: 0.2,
  });

  // Floor
  const floorGeo = new THREE.BoxGeometry(width, 0.05, depth);
  const floor = new THREE.Mesh(floorGeo, frameMat);
  floor.position.y = 0.025;
  group.add(floor);

  // Back wall
  const backGeo = new THREE.BoxGeometry(width, height, 0.05);
  const backWall = new THREE.Mesh(backGeo, frameMat);
  backWall.position.set(0, height / 2 + 0.05, -depth / 2 + 0.025);
  group.add(backWall);

  // Side walls (glass panels)
  [-1, 1].forEach((side) => {
    const sideGeo = new THREE.BoxGeometry(0.05, height, depth);
    const sidePanel = new THREE.Mesh(sideGeo, side === -1 ? frameMat : glassMat);
    sidePanel.position.set(side * (width / 2 - 0.025), height / 2 + 0.05, 0);
    group.add(sidePanel);
  });

  // Roof
  const roofGeo = new THREE.BoxGeometry(width + 0.1, 0.08, depth + 0.1);
  const roof = new THREE.Mesh(roofGeo, frameMat);
  roof.position.y = height + 0.05;
  group.add(roof);

  // Front glass
  const frontGeo = new THREE.BoxGeometry(width - 0.1, height - 0.1, 0.03);
  const frontGlass = new THREE.Mesh(frontGeo, glassMat);
  frontGlass.position.set(0, height / 2 + 0.05, depth / 2 - 0.025);
  group.add(frontGlass);

  // Phone handset silhouette inside
  const phoneMat = new THREE.MeshStandardMaterial({ color: eraId === '1965' ? 0x222222 : 0x111111, roughness: 0.6, metalness: 0.3 });
  const handsetGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8);
  const handset = new THREE.Mesh(handsetGeo, phoneMat);
  handset.position.set(0, height * 0.55, depth / 2 - 0.15);
  handset.rotation.z = Math.PI / 4;
  group.add(handset);

  // "PHONE" text plate
  const plateGeo = new THREE.BoxGeometry(0.6, 0.12, 0.02);
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(eraId === '1965' ? 0x336699 : 0x444444),
    emissiveIntensity: 0.3,
    roughness: 0.5,
  });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.set(0, height + 0.15, 0);
  group.add(plate);

  return group;
}

// ── Fire Hydrant Builder ──────────────────────────────────────────────

/** Build a fire hydrant (present in all eras, slight color variations) */
export function buildFireHydrant(eraId: EraId): THREE.Group {
  const group = new THREE.Group();

  const colors: Record<EraId, number> = {
    '1945': 0xcc3333,
    '1965': 0xdd4444,
    '1985': 0xee5555,
    '2005': 0xff6666,
    '2025': 0xff7777,
  };

  const bodyMat = new THREE.MeshStandardMaterial({
    color: colors[eraId],
    roughness: 0.5,
    metalness: 0.4,
  });

  // Base barrel
  const baseGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.5, 8);
  const base = new THREE.Mesh(baseGeo, bodyMat);
  base.position.y = 0.25;
  group.add(base);

  // Mid section
  const midGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.3, 8);
  const mid = new THREE.Mesh(midGeo, bodyMat);
  mid.position.y = 0.65;
  group.add(mid);

  // Top dome
  const topGeo = new THREE.SphereGeometry(0.14, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const top = new THREE.Mesh(topGeo, bodyMat);
  top.position.y = 0.8;
  group.add(top);

  // Side nozzles
  [-1, 1].forEach((side) => {
    const nozzleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.15, 8);
    const nozzle = new THREE.Mesh(nozzleGeo, bodyMat);
    nozzle.position.set(side * 0.18, 0.5, 0);
    nozzle.rotation.z = side * Math.PI / 2;
    group.add(nozzle);

    // Nozzle cap
    const capGeo = new THREE.SphereGeometry(0.055, 6, 4);
    const cap = new THREE.Mesh(capGeo, bodyMat);
    cap.position.set(side * 0.26, 0.5, 0);
    group.add(cap);
  });

  // Top nut
  const nutGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.04, 5);
  const nutMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 });
  const nut = new THREE.Mesh(nutGeo, nutMat);
  nut.position.y = 0.95;
  group.add(nut);

  return group;
}

// ── Traffic Light Builder ─────────────────────────────────────────────

/** Build a traffic light assembly */
export function buildTrafficLight(_eraId: EraId): THREE.Group {
  const group = new THREE.Group();

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.7 });

  // Vertical pole
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.06, 3.5, 8);
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 1.75;
  group.add(pole);

  // Horizontal arm
  const armGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6);
  const arm = new THREE.Mesh(armGeo, poleMat);
  arm.position.set(0.5, 3.4, 0);
  arm.rotation.z = Math.PI / 2;
  group.add(arm);

  // Signal housing
  const housingGeo = new THREE.BoxGeometry(0.35, 0.9, 0.25);
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.6 });
  const housing = new THREE.Mesh(housingGeo, housingMat);
  housing.position.set(1.0, 3.3, 0);
  group.add(housing);

  // Three lights
  const lightColors = [0xff0000, 0xffcc00, 0x00cc00];
  lightColors.forEach((color, i) => {
    const lightGeo = new THREE.CircleGeometry(0.1, 12);
    const lightMat = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: i === 0 ? 0.8 : 0.15,
      roughness: 0.3,
    });
    const lightMesh = new THREE.Mesh(lightGeo, lightMat);
    lightMesh.position.set(1.0, 3.65 - i * 0.28, 0.13);
    group.add(lightMesh);
  });

  return group;
}

// ── Bus Stop Builder ──────────────────────────────────────────────────

/** Build a bus stop shelter */
export function buildBusStop(eraId: EraId): THREE.Group {
  const group = new THREE.Group();

  const metalMat = new THREE.MeshStandardMaterial({
    color: eraId === '1945' ? 0x555555 : eraId === '2025' ? 0xcccccc : 0x666666,
    roughness: 0.4,
    metalness: 0.6,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xaaddff,
    transparent: true,
    opacity: eraId === '1945' ? 0.5 : 0.25,
    roughness: 0.1,
    metalness: 0.2,
  });

  // Posts
  const postPositions = [[-1.5, 0], [1.5, 0]];
  postPositions.forEach(([x]) => {
    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6);
    const post = new THREE.Mesh(postGeo, metalMat);
    post.position.set(x, 1.25, 0);
    group.add(post);
  });

  // Roof
  const roofGeo = new THREE.BoxGeometry(3.5, 0.06, 1.5);
  const roof = new THREE.Mesh(roofGeo, metalMat);
  roof.position.set(0, 2.53, 0);
  group.add(roof);

  // Back panel
  const backGeo = new THREE.BoxGeometry(3.0, 1.8, 0.04);
  const back = new THREE.Mesh(backGeo, glassMat);
  back.position.set(0, 1.2, -0.7);
  group.add(back);

  // Schedule board
  if (eraId !== '2025') {
    const boardGeo = new THREE.BoxGeometry(0.8, 0.5, 0.02);
    const boardMat = new THREE.MeshStandardMaterial({
      color: eraId === '1945' ? 0xf5deb3 : 0xffffff,
      roughness: 0.8,
    });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 1.6, -0.65);
    group.add(board);
  }

  return group;
}

// ── Bench Builder ─────────────────────────────────────────────────────

/** Build a public bench */
export function buildBench(eraId: EraId): THREE.Group {
  const group = new THREE.Group();

  const seatMat = new THREE.MeshStandardMaterial({
    color: eraId === '2025' ? 0x888888 : 0x8B4513,
    roughness: eraId === '2025' ? 0.3 : 0.7,
    metalness: eraId === '2025' ? 0.5 : 0.1,
  });

  const legMat = new THREE.MeshStandardMaterial({
    color: eraId === '1945' ? 0x444444 : 0x333333,
    roughness: 0.5,
    metalness: 0.6,
  });

  // Seat slats
  for (let i = 0; i < 4; i++) {
    const slatGeo = new THREE.BoxGeometry(2.0, 0.05, 0.15);
    const slat = new THREE.Mesh(slatGeo, seatMat);
    slat.position.set(0, 0.45, -0.25 + i * 0.18);
    group.add(slat);
  }

  // Legs
  [[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]].forEach(([x, z]) => {
    const legGeo = new THREE.BoxGeometry(0.06, 0.45, 0.06);
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, 0.225, z);
    group.add(leg);
  });

  // Backrest (optional for modern eras)
  if (eraId === '2025') {
    for (let i = 0; i < 3; i++) {
      const backGeo = new THREE.BoxGeometry(1.8, 0.04, 0.1);
      const back = new THREE.Mesh(backGeo, seatMat);
      back.position.set(0, 0.65 + i * 0.15, 0.35);
      group.add(back);
    }
  }

  return group;
}

// ── Trash Can Builder ─────────────────────────────────────────────────

/** Build a public trash can */
export function buildTrashCan(eraId: EraId): THREE.Group {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: eraId === '1945' ? 0x556B2F : eraId === '2025' ? 0x444444 : 0x666666,
    roughness: 0.5,
    metalness: 0.5,
  });

  // Body
  const bodyGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.8, 8);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.4;
  group.add(body);

  // Lid
  const lidGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.04, 8);
  const lid = new THREE.Mesh(lidGeo, bodyMat);
  lid.position.y = 0.82;
  group.add(lid);

  // Opening slot on lid
  const slotGeo = new THREE.BoxGeometry(0.3, 0.01, 0.06);
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const slot = new THREE.Mesh(slotGeo, slotMat);
  slot.position.y = 0.85;
  group.add(slot);

  return group;
}

// ── Mailbox Builder ───────────────────────────────────────────────────

/** Build a mailbox (1945-1985). Removed in later eras. */
export function buildMailbox(eraId: EraId): THREE.Group {
  if (eraId === '2005' || eraId === '2025') return new THREE.Group();

  const group = new THREE.Group();

  const boxMat = new THREE.MeshStandardMaterial({
    color: eraId === '1945' ? 0x2a4a6a : 0x003399,
    roughness: 0.5,
    metalness: 0.4,
  });

  // Box body
  const boxGeo = new THREE.BoxGeometry(0.4, 0.35, 0.25);
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.y = 1.0;
  group.add(box);

  // Curved top
  const topGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.25, 8, 1, false, 0, Math.PI);
  const top = new THREE.Mesh(topGeo, boxMat);
  top.rotation.z = Math.PI / 2;
  top.rotation.y = Math.PI / 2;
  top.position.y = 1.18;
  group.add(top);

  // Flag
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.6 });
  const flagGeo = new THREE.BoxGeometry(0.02, 0.15, 0.1);
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(0.22, 1.05, 0);
  group.add(flag);

  // Post
  const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 });
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.y = 0.4;
  group.add(post);

  // "MAIL" text plate
  const plateGeo = new THREE.BoxGeometry(0.2, 0.06, 0.01);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.set(0, 1.0, 0.13);
  group.add(plate);

  return group;
}

// ── Newspaper Stand Builder (1945-1985 only) ─────────────────────────

/** Build a newspaper stand / newsrack (1945-1985). Absent in later eras. */
export function buildNewspaperStand(eraId: EraId): THREE.Group {
  if (eraId === '2005' || eraId === '2025') return new THREE.Group();

  const group = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({
    color: eraId === '1945' ? 0x444444 : eraId === '1965' ? 0x336699 : 0x555555,
    roughness: 0.5,
    metalness: 0.5,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xaaccff,
    transparent: true,
    opacity: 0.3,
    roughness: 0.1,
    metalness: 0.2,
  });

  // Base
  const baseGeo = new THREE.BoxGeometry(0.6, 0.05, 0.4);
  const base = new THREE.Mesh(baseGeo, frameMat);
  base.position.y = 0.025;
  group.add(base);

  // Back panel
  const backGeo = new THREE.BoxGeometry(0.55, 0.9, 0.03);
  const back = new THREE.Mesh(backGeo, frameMat);
  back.position.set(0, 0.5, -0.18);
  group.add(back);

  // Glass front
  const frontGeo = new THREE.BoxGeometry(0.55, 0.85, 0.02);
  const front = new THREE.Mesh(frontGeo, glassMat);
  front.position.set(0, 0.48, 0.18);
  group.add(front);

  // Side panels
  [-1, 1].forEach((side) => {
    const sideGeo = new THREE.BoxGeometry(0.03, 0.85, 0.36);
    const sidePanel = new THREE.Mesh(sideGeo, side === -1 ? frameMat : glassMat);
    sidePanel.position.set(side * 0.28, 0.48, 0);
    group.add(sidePanel);
  });

  // Roof
  const roofGeo = new THREE.BoxGeometry(0.65, 0.04, 0.45);
  const roof = new THREE.Mesh(roofGeo, frameMat);
  roof.position.y = 0.93;
  group.add(roof);

  // Magazine/newspaper mock items inside
  const paperColors = ['#cc3333', '#3366cc', '#33aa33', '#cc9900'];
  paperColors.forEach((color, i) => {
    const paperGeo = new THREE.BoxGeometry(0.12, 0.35, 0.02);
    const paperMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const paper = new THREE.Mesh(paperGeo, paperMat);
    paper.position.set(-0.15 + i * 0.1, 0.4, 0.05);
    paper.rotation.y = (Math.random() - 0.5) * 0.2;
    group.add(paper);
  });

  return group;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Build all era-appropriate street furniture for a given era.
 * Returns a THREE.Group containing lamp posts, benches, hydrants,
 * and era-specific items like phone booths, mailboxes, and newsstands.
 *
 * Furniture is positioned along sidewalks at regular intervals.
 * The `sidewalkZ` parameter controls which side of the street they're placed on.
 */
export function buildStreetFurniture(
  eraId: EraId,
  sidewalkZ: number,
  spacing = 8,
  count = 4,
): THREE.Group {
  const group = new THREE.Group();

  // Common materials
  const poleMat = new THREE.MeshStandardMaterial({
    color: eraId === '1945' ? 0x444444 : eraId === '2025' ? 0x888888 : 0x555555,
    roughness: 0.5,
    metalness: 0.6,
  });

  const lampConfig = LAMP_CONFIGS[eraId];

  // ── Lamp posts ───────────────────────────────────────────────────
  for (let i = 0; i < count; i++) {
    let lamp: THREE.Group;
    switch (eraId) {
      case '1945':
        lamp = buildGasLampPost(lampConfig, poleMat);
        break;
      case '1965':
        lamp = buildCobraHeadLamp(lampConfig, poleMat);
        break;
      case '1985':
        lamp = buildSodiumHoodLamp(lampConfig, poleMat);
        break;
      default:
        lamp = buildLEDLamp(lampConfig, poleMat);
        break;
    }
    lamp.position.set(-spacing * count / 2 + i * spacing, 0, sidewalkZ);
    group.add(lamp);
  }

  // ── Fire hydrants (every other lamp post) ────────────────────────
  for (let i = 0; i < count; i += 2) {
    const hydrant = buildFireHydrant(eraId);
    hydrant.position.set(-spacing * count / 2 + i * spacing + 0.8, 0, sidewalkZ + 0.5);
    group.add(hydrant);
  }

  // ── Benches ──────────────────────────────────────────────────────
  for (let i = 1; i < count; i += 2) {
    const bench = buildBench(eraId);
    bench.position.set(-spacing * count / 2 + i * spacing - 1.5, 0, sidewalkZ - 0.5);
    bench.rotation.y = Math.PI / 2;
    group.add(bench);
  }

  // ── Trash cans ───────────────────────────────────────────────────
  for (let i = 0; i < count; i += 3) {
    const trash = buildTrashCan(eraId);
    trash.position.set(-spacing * count / 2 + i * spacing + 0.3, 0, sidewalkZ + 0.8);
    group.add(trash);
  }

  // ── Phone booths (1965-1985 only) ────────────────────────────────
  if (eraId === '1965' || eraId === '1985') {
    const booth = buildPhoneBooth(eraId);
    booth.position.set(-spacing * 0.5, 0, sidewalkZ + 1.5);
    group.add(booth);
  }

  // ── Mailboxes (1945-1985 only) ───────────────────────────────────
  if (['1945', '1965', '1985'].includes(eraId)) {
    const mailbox = buildMailbox(eraId);
    mailbox.position.set(spacing * count / 2 - 1, 0, sidewalkZ + 1.0);
    group.add(mailbox);
  }

  // ── Newspaper stands (1945-1985 only) ────────────────────────────
  if (['1945', '1965', '1985'].includes(eraId)) {
    const stand = buildNewspaperStand(eraId);
    stand.position.set(spacing * count / 2 - 3, 0, sidewalkZ + 1.2);
    group.add(stand);
  }

  // ── Traffic lights at corners ────────────────────────────────────
  const trafficLight = buildTrafficLight(eraId);
  trafficLight.position.set(-spacing * count / 2 - 2, 0, sidewalkZ);
  group.add(trafficLight);

  const trafficLight2 = buildTrafficLight(eraId);
  trafficLight2.position.set(spacing * count / 2 + 2, 0, sidewalkZ);
  group.add(trafficLight2);

  // ── Bus stops ────────────────────────────────────────────────────
  const busStop = buildBusStop(eraId);
  busStop.position.set(0, 0, sidewalkZ + 1.5);
  group.add(busStop);

  return group;
}
