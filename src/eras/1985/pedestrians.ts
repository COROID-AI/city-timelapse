import { Object3D } from 'three';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { createColoredBox } from './textures';
import { PALETTE_1985 } from './palette';

/**
 * 1985 Era Pedestrians
 *
 * Requirements:
 * - Densely populated sidewalks (18+ pedestrians).
 * - Businesspeople in broad shoulder-padded power suits and bold power ties (red / blue), holding briefcases.
 * - Punks with studded leather jackets, colored crest mohawks, ripped jeans.
 * - Breakdancers with tracksuits, sweatbands, and dynamic poses.
 * - Joggers in bright neon windbreakers (hot pink, electric cyan, fluorescent lime), headbands, shorts.
 * - Boombox carriers with iconic dual-cassette silver boombox balanced on their shoulder.
 */

export interface PedestrianInstance {
  readonly root: Object3D;
  readonly type: 'business' | 'punk' | 'breakdancer' | 'jogger' | 'boombox';
  update(dt: number): void;
}

export interface Era1985PedestrianGroup {
  readonly root: Object3D;
  readonly pedestrians: readonly PedestrianInstance[];
  readonly businesspeople: readonly PedestrianInstance[];
  readonly punks: readonly PedestrianInstance[];
  readonly breakdancers: readonly PedestrianInstance[];
  readonly joggers: readonly PedestrianInstance[];
  readonly boomboxCarriers: readonly PedestrianInstance[];
  update(dt: number): void;
}

/** Builds a 1980s Businessperson in a shoulder-padded power suit */
export function createPowerSuitBusinessperson(suitColor = '#1f2937', tieColor = '#dc2626'): Object3D {
  const root = new Object3D();
  const skinColor = '#d4a373';

  // Broad shoulder-padded suit torso
  const torso = createColoredBox(0.68, 0.75, 0.32, suitColor, { x: 0, y: 1.15, z: 0 });
  // White dress shirt collar
  const shirt = createColoredBox(0.24, 0.28, 0.05, '#ffffff', { x: 0, y: 1.35, z: 0.15 });
  // Bold power tie
  const tie = createColoredBox(0.12, 0.45, 0.06, tieColor, { x: 0, y: 1.18, z: 0.16 });
  // Head & 80s slicked hair
  const head = createColoredBox(0.26, 0.28, 0.24, skinColor, { x: 0, y: 1.62, z: 0 });
  const hair = createColoredBox(0.28, 0.14, 0.26, '#382212', { x: 0, y: 1.74, z: -0.02 });
  root.add(torso, shirt, tie, head, hair);

  // Suit slacks legs
  const legL = createColoredBox(0.22, 0.78, 0.24, suitColor, { x: -0.16, y: 0.39, z: 0 });
  const legR = createColoredBox(0.22, 0.78, 0.24, suitColor, { x: 0.16, y: 0.39, z: 0 });
  // Leather dress shoes
  const shoeL = createColoredBox(0.22, 0.12, 0.32, '#111111', { x: -0.16, y: 0.06, z: 0.04 });
  const shoeR = createColoredBox(0.22, 0.12, 0.32, '#111111', { x: 0.16, y: 0.06, z: 0.04 });
  root.add(legL, legR, shoeL, shoeR);

  // Arms & executive briefcase in right hand
  const armL = createColoredBox(0.16, 0.65, 0.16, suitColor, { x: -0.42, y: 1.15, z: 0 });
  const armR = createColoredBox(0.16, 0.65, 0.16, suitColor, { x: 0.42, y: 1.15, z: 0 });
  const briefcase = createColoredBox(0.1, 0.35, 0.45, '#451a03', { x: 0.52, y: 0.75, z: 0 });
  const briefHandle = createColoredBox(0.04, 0.08, 0.15, '#d4af37', { x: 0.52, y: 0.95, z: 0 });
  root.add(armL, armR, briefcase, briefHandle);

  return root;
}

/** Builds an 80s Punk with studded leather jacket, combat boots & mohawk */
export function createPunk(mohawkColor = '#ff007f'): Object3D {
  const root = new Object3D();
  const skinColor = '#e5c29f';
  const jacketColor = '#171717';
  const jeansColor = '#2563eb';

  // Studded black leather jacket torso
  const torso = createColoredBox(0.55, 0.7, 0.3, jacketColor, { x: 0, y: 1.15, z: 0 });
  // Metal studs / zippers
  const studs = createColoredBox(0.45, 0.08, 0.04, PALETTE_1985.materials.chromeMetal, {
    x: 0,
    y: 1.35,
    z: 0.15,
  });
  // Head
  const head = createColoredBox(0.25, 0.28, 0.24, skinColor, { x: 0, y: 1.6, z: 0 });
  // Tall vibrant mohawk crest
  const mohawk = createColoredBox(0.08, 0.32, 0.3, mohawkColor, { x: 0, y: 1.82, z: 0 });
  root.add(torso, studs, head, mohawk);

  // Ripped jeans
  const legL = createColoredBox(0.2, 0.78, 0.22, jeansColor, { x: -0.15, y: 0.39, z: 0 });
  const legR = createColoredBox(0.2, 0.78, 0.22, jeansColor, { x: 0.15, y: 0.39, z: 0 });
  // Black combat boots
  const bootL = createColoredBox(0.22, 0.22, 0.34, '#0a0a0a', { x: -0.15, y: 0.11, z: 0.05 });
  const bootR = createColoredBox(0.22, 0.22, 0.34, '#0a0a0a', { x: 0.15, y: 0.11, z: 0.05 });
  root.add(legL, legR, bootL, bootR);

  // Arms with studded wristbands
  const armL = createColoredBox(0.16, 0.65, 0.16, jacketColor, { x: -0.36, y: 1.15, z: 0 });
  const armR = createColoredBox(0.16, 0.65, 0.16, jacketColor, { x: 0.36, y: 1.15, z: 0 });
  root.add(armL, armR);

  return root;
}

/** Builds an 80s Breakdancer in tracksuit & sweatband */
export function createBreakdancer(suitColor = '#065f46'): Object3D {
  const root = new Object3D();
  const skinColor = '#a16207';

  // Tracksuit torso with contrasting chest chevron stripe
  const torso = createColoredBox(0.56, 0.68, 0.3, suitColor, { x: 0, y: 1.1, z: 0 });
  const stripe = createColoredBox(0.58, 0.14, 0.04, '#facc15', { x: 0, y: 1.25, z: 0.14 });
  // Head with white sweatband
  const head = createColoredBox(0.25, 0.28, 0.24, skinColor, { x: 0, y: 1.55, z: 0 });
  const sweatband = createColoredBox(0.27, 0.08, 0.26, '#ffffff', { x: 0, y: 1.62, z: 0 });
  root.add(torso, stripe, head, sweatband);

  // Trackpants & high-top sneakers
  const legL = createColoredBox(0.22, 0.75, 0.24, suitColor, { x: -0.18, y: 0.38, z: 0 });
  const legR = createColoredBox(0.22, 0.75, 0.24, suitColor, { x: 0.18, y: 0.38, z: 0 });
  const sneakerL = createColoredBox(0.24, 0.15, 0.34, '#ffffff', { x: -0.18, y: 0.08, z: 0.05 });
  const sneakerR = createColoredBox(0.24, 0.15, 0.34, '#ffffff', { x: 0.18, y: 0.08, z: 0.05 });
  root.add(legL, legR, sneakerL, sneakerR);

  // Arms in dynamic stance
  const armL = createColoredBox(
    0.15,
    0.6,
    0.15,
    suitColor,
    { x: -0.42, y: 1.15, z: 0.1 },
    { z: -0.35 },
  );
  const armR = createColoredBox(
    0.15,
    0.6,
    0.15,
    suitColor,
    { x: 0.42, y: 1.15, z: 0.1 },
    { z: 0.35 },
  );
  root.add(armL, armR);

  return root;
}

/** Builds an 80s Jogger in a neon windbreaker & headband */
export function createNeonJogger(jacketColor = '#ec4899', shortColor = '#06b6d4'): Object3D {
  const root = new Object3D();
  const skinColor = '#f5cba7';

  // Neon windbreaker torso
  const torso = createColoredBox(0.52, 0.65, 0.28, jacketColor, { x: 0, y: 1.15, z: 0 });
  // Head with fluorescent headband
  const head = createColoredBox(0.25, 0.28, 0.24, skinColor, { x: 0, y: 1.6, z: 0 });
  const headband = createColoredBox(0.27, 0.08, 0.26, PALETTE_1985.night.neonYellow, {
    x: 0,
    y: 1.66,
    z: 0,
  });
  root.add(torso, head, headband);

  // Running shorts & bare legs
  const shorts = createColoredBox(0.48, 0.25, 0.26, shortColor, { x: 0, y: 0.72, z: 0 });
  const legL = createColoredBox(0.18, 0.6, 0.2, skinColor, { x: -0.15, y: 0.35, z: 0 });
  const legR = createColoredBox(0.18, 0.6, 0.2, skinColor, { x: 0.15, y: 0.35, z: 0 });
  // Neon running shoes with tube socks
  const sockL = createColoredBox(0.19, 0.15, 0.21, '#ffffff', { x: -0.15, y: 0.12, z: 0 });
  const sockR = createColoredBox(0.19, 0.15, 0.21, '#ffffff', { x: 0.15, y: 0.12, z: 0 });
  const shoeL = createColoredBox(0.2, 0.12, 0.32, PALETTE_1985.night.neonGreen, {
    x: -0.15,
    y: 0.06,
    z: 0.04,
  });
  const shoeR = createColoredBox(0.2, 0.12, 0.32, PALETTE_1985.night.neonGreen, {
    x: 0.15,
    y: 0.06,
    z: 0.04,
  });
  root.add(shorts, legL, legR, sockL, sockR, shoeL, shoeR);

  // Pumping running arms
  const armL = createColoredBox(
    0.14,
    0.55,
    0.14,
    jacketColor,
    { x: -0.34, y: 1.15, z: 0.1 },
    { x: 0.4 },
  );
  const armR = createColoredBox(
    0.14,
    0.55,
    0.14,
    jacketColor,
    { x: 0.34, y: 1.15, z: -0.1 },
    { x: -0.4 },
  );
  root.add(armL, armR);

  return root;
}

/** Builds an 80s Pedestrian carrying a silver dual-cassette Boombox on shoulder */
export function createBoomboxCarrier(): Object3D {
  const root = new Object3D();
  const skinColor = '#8d5b4c';
  const shirtColor = '#e11d48';
  const jeansColor = '#1e3a8a';

  // Torso
  const torso = createColoredBox(0.56, 0.7, 0.3, shirtColor, { x: 0, y: 1.15, z: 0 });
  const head = createColoredBox(0.26, 0.28, 0.24, skinColor, { x: 0, y: 1.62, z: 0 });
  const cap = createColoredBox(0.28, 0.12, 0.32, '#111111', { x: 0, y: 1.74, z: 0.04 });
  root.add(torso, head, cap);

  // Jeans & sneakers
  const legL = createColoredBox(0.2, 0.78, 0.22, jeansColor, { x: -0.16, y: 0.39, z: 0 });
  const legR = createColoredBox(0.2, 0.78, 0.22, jeansColor, { x: 0.16, y: 0.39, z: 0 });
  const shoeL = createColoredBox(0.22, 0.12, 0.32, '#ffffff', { x: -0.16, y: 0.06, z: 0.04 });
  const shoeR = createColoredBox(0.22, 0.12, 0.32, '#ffffff', { x: 0.16, y: 0.06, z: 0.04 });
  root.add(legL, legR, shoeL, shoeR);

  // Raised right arm holding boombox on right shoulder
  const armL = createColoredBox(0.15, 0.65, 0.15, shirtColor, { x: -0.36, y: 1.15, z: 0 });
  const armR = createColoredBox(
    0.15,
    0.5,
    0.15,
    shirtColor,
    { x: 0.36, y: 1.45, z: 0.1 },
    { z: -0.5 },
  );
  root.add(armL, armR);

  // Iconic Silver Twin-Cassette Boombox perched on shoulder
  const boombox = new Object3D();
  const bbBody = createColoredBox(0.75, 0.38, 0.28, PALETTE_1985.materials.chromeMetal, {
    x: 0,
    y: 0,
    z: 0,
  });
  // Twin black speaker cones
  const spk1 = createColoredBox(0.24, 0.24, 0.04, '#111111', { x: -0.22, y: 0, z: 0.15 });
  const spk2 = createColoredBox(0.24, 0.24, 0.04, '#111111', { x: 0.22, y: 0, z: 0.15 });
  // Cassette deck windows
  const deck1 = createColoredBox(0.12, 0.12, 0.04, '#333333', { x: -0.06, y: 0, z: 0.15 });
  const deck2 = createColoredBox(0.12, 0.12, 0.04, '#333333', { x: 0.06, y: 0, z: 0.15 });
  // Handle
  const handle = createColoredBox(0.65, 0.06, 0.06, '#111111', { x: 0, y: 0.22, z: 0 });
  boombox.add(bbBody, spk1, spk2, deck1, deck2, handle);
  boombox.position.set(0.42, 1.68, 0.05);
  boombox.rotation.z = -0.15;
  root.add(boombox);

  return root;
}

/**
 * Creates dense 1985 pedestrian population spread across the sidewalks
 */
export function create1985Pedestrians(layout: CityBlockLayout): Era1985PedestrianGroup {
  const root = new Object3D();
  const allPedestrians: PedestrianInstance[] = [];
  const businessList: PedestrianInstance[] = [];
  const punkList: PedestrianInstance[] = [];
  const breakdancerList: PedestrianInstance[] = [];
  const joggerList: PedestrianInstance[] = [];
  const boomboxList: PedestrianInstance[] = [];

  // Define walking paths along the sidewalk network
  const sidewalkBounds = {
    minX: layout.bounds.minX + 1.5,
    maxX: layout.bounds.maxX - 1.5,
    minZ: layout.bounds.minZ + 1.5,
    maxZ: layout.bounds.maxZ - 1.5,
  };

  const pedestrianConfigs = [
    // Businesspeople (Power suits)
    {
      type: 'business' as const,
      factory: () => createPowerSuitBusinessperson('#1e293b', '#dc2626'),
      startPos: { x: -18, z: -30.5 },
      dir: { x: 1, z: 0 },
      speed: 1.4,
    },
    {
      type: 'business' as const,
      factory: () => createPowerSuitBusinessperson('#0f172a', '#2563eb'),
      startPos: { x: 14, z: -30.5 },
      dir: { x: -1, z: 0 },
      speed: 1.3,
    },
    {
      type: 'business' as const,
      factory: () => createPowerSuitBusinessperson('#334155', '#eab308'),
      startPos: { x: 30.5, z: -12 },
      dir: { x: 0, z: 1 },
      speed: 1.5,
    },
    {
      type: 'business' as const,
      factory: () => createPowerSuitBusinessperson('#1e1b4b', '#ef4444'),
      startPos: { x: 30.5, z: 15 },
      dir: { x: 0, z: -1 },
      speed: 1.4,
    },
    {
      type: 'business' as const,
      factory: () => createPowerSuitBusinessperson('#1f2937', '#059669'),
      startPos: { x: -12, z: 30.5 },
      dir: { x: 1, z: 0 },
      speed: 1.35,
    },

    // Punks (Mohawks & leather)
    {
      type: 'punk' as const,
      factory: () => createPunk('#ff007f'),
      startPos: { x: -30.5, z: 8 },
      dir: { x: 0, z: -1 },
      speed: 1.2,
    },
    {
      type: 'punk' as const,
      factory: () => createPunk('#00ff66'),
      startPos: { x: -30.5, z: -16 },
      dir: { x: 0, z: 1 },
      speed: 1.25,
    },
    {
      type: 'punk' as const,
      factory: () => createPunk('#00e5ff'),
      startPos: { x: -6, z: -30.5 },
      dir: { x: 1, z: 0 },
      speed: 1.15,
    },
    {
      type: 'punk' as const,
      factory: () => createPunk('#ffea00'),
      startPos: { x: 8, z: 30.5 },
      dir: { x: -1, z: 0 },
      speed: 1.2,
    },

    // Breakdancers
    {
      type: 'breakdancer' as const,
      factory: () => createBreakdancer('#065f46'),
      startPos: { x: 4, z: -30.5 },
      dir: { x: 0.8, z: 0 },
      speed: 0.9,
    },
    {
      type: 'breakdancer' as const,
      factory: () => createBreakdancer('#991b1b'),
      startPos: { x: -22, z: 30.5 },
      dir: { x: -0.8, z: 0 },
      speed: 0.85,
    },
    {
      type: 'breakdancer' as const,
      factory: () => createBreakdancer('#1e40af'),
      startPos: { x: -30.5, z: -4 },
      dir: { x: 0, z: 0.9 },
      speed: 0.95,
    },

    // Joggers (Neon windbreakers)
    {
      type: 'jogger' as const,
      factory: () => createNeonJogger('#ec4899', '#06b6d4'),
      startPos: { x: -28, z: -30.5 },
      dir: { x: 1, z: 0 },
      speed: 3.2,
    },
    {
      type: 'jogger' as const,
      factory: () => createNeonJogger('#10b981', '#f43f5e'),
      startPos: { x: 26, z: 30.5 },
      dir: { x: -1, z: 0 },
      speed: 3.4,
    },
    {
      type: 'jogger' as const,
      factory: () => createNeonJogger('#8b5cf6', '#eab308'),
      startPos: { x: -30.5, z: 22 },
      dir: { x: 0, z: -1 },
      speed: 3.0,
    },

    // Boombox carriers
    {
      type: 'boombox' as const,
      factory: createBoomboxCarrier,
      startPos: { x: 0, z: -30.5 },
      dir: { x: 1, z: 0 },
      speed: 1.1,
    },
    {
      type: 'boombox' as const,
      factory: createBoomboxCarrier,
      startPos: { x: -4, z: 30.5 },
      dir: { x: -1, z: 0 },
      speed: 1.15,
    },
    {
      type: 'boombox' as const,
      factory: createBoomboxCarrier,
      startPos: { x: 30.5, z: 0 },
      dir: { x: 0, z: 1 },
      speed: 1.05,
    },
  ];

  pedestrianConfigs.forEach((cfg) => {
    const mesh = cfg.factory();
    mesh.position.set(cfg.startPos.x, 0, cfg.startPos.z);
    root.add(mesh);

    let curX = cfg.startPos.x;
    let curZ = cfg.startPos.z;
    let dx = cfg.dir.x;
    let dz = cfg.dir.z;

    const instance: PedestrianInstance = {
      root: mesh,
      type: cfg.type,
      update(dt: number) {
        curX += dx * cfg.speed * dt;
        curZ += dz * cfg.speed * dt;

        // Bounce back if reaching sidewalk limits
        if (curX > sidewalkBounds.maxX || curX < sidewalkBounds.minX) {
          dx = -dx;
          curX = Math.max(sidewalkBounds.minX, Math.min(sidewalkBounds.maxX, curX));
        }
        if (curZ > sidewalkBounds.maxZ || curZ < sidewalkBounds.minZ) {
          dz = -dz;
          curZ = Math.max(sidewalkBounds.minZ, Math.min(sidewalkBounds.maxZ, curZ));
        }

        mesh.position.set(curX, 0, curZ);
        mesh.rotation.y = Math.atan2(dx, dz);
      },
    };

    allPedestrians.push(instance);
    if (cfg.type === 'business') businessList.push(instance);
    else if (cfg.type === 'punk') punkList.push(instance);
    else if (cfg.type === 'breakdancer') breakdancerList.push(instance);
    else if (cfg.type === 'jogger') joggerList.push(instance);
    else if (cfg.type === 'boombox') boomboxList.push(instance);
  });

  return {
    root,
    pedestrians: allPedestrians,
    businesspeople: businessList,
    punks: punkList,
    breakdancers: breakdancerList,
    joggers: joggerList,
    boomboxCarriers: boomboxList,
    update(dt: number) {
      for (const p of allPedestrians) {
        p.update(dt);
      }
    },
  };
}
