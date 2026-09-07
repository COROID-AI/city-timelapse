import { Object3D } from 'three';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { ERA_1965_PALETTE } from './palette';
import { createBox } from './textures';

/**
 * 1965 Period Pedestrians Module:
 * 1. Men in slim suits and narrow ties, fedoras or groomed hair
 * 2. Women in shift dresses and pillbox hats, cat-eye glasses
 * 3. Mods in bold patterns (striped shirts, Chelsea boots, mod caps)
 * 4. Teenagers with portable transistor radios
 *
 * Includes walking stride animation and sidewalk circulation.
 */

export interface PedestrianInstance {
  readonly id: string;
  readonly archetype: 'slim_suit' | 'shift_dress' | 'mod_pattern' | 'teen_transistor';
  readonly name: string;
  readonly root: Object3D;
  speed: number;
  progress: number;
  pathIndex: number;
  legL?: Object3D;
  legR?: Object3D;
  armL?: Object3D;
  armR?: Object3D;
}

export interface PedestrianSystem {
  readonly root: Object3D;
  readonly pedestrians: readonly PedestrianInstance[];
  update(dt: number, time: number): void;
}

/**
 * 1. Man in Slim Suit & Narrow Tie.
 */
export function createSlimSuitPedestrian(suitColorHex: number): {
  root: Object3D;
  legL: Object3D;
  legR: Object3D;
  armL: Object3D;
  armR: Object3D;
} {
  const root = new Object3D();

  // Head with neat fedora / hair
  const head = createBox(0.24, 0.28, 0.24, 0xfad2b4, 0, 1.62, 0);
  const hair = createBox(0.26, 0.1, 0.26, 0x2b1d0c, 0, 1.76, 0);
  const hatBrim = createBox(0.38, 0.04, 0.38, suitColorHex, 0, 1.76, 0);
  const hatCrown = createBox(0.26, 0.15, 0.26, suitColorHex, 0, 1.84, 0);
  root.add(head, hair, hatBrim, hatCrown);

  // Slim-cut suit jacket torso
  const torso = createBox(0.42, 0.58, 0.24, suitColorHex, 0, 1.25, 0);
  const shirt = createBox(0.18, 0.45, 0.05, 0xffffff, 0, 1.3, 0.11);
  const narrowTie = createBox(
    0.06,
    0.4,
    0.06,
    ERA_1965_PALETTE.pedestrians.tieSkinnyBlack,
    0,
    1.28,
    0.12,
  );
  root.add(torso, shirt, narrowTie);

  // Slim suit arms
  const armL = createBox(0.1, 0.55, 0.1, suitColorHex, -0.26, 1.22, 0);
  const armR = createBox(0.1, 0.55, 0.1, suitColorHex, 0.26, 1.22, 0);
  root.add(armL, armR);

  // Narrow cigarette trousers legs
  const legL = createBox(0.13, 0.85, 0.13, suitColorHex, -0.11, 0.45, 0);
  const legR = createBox(0.13, 0.85, 0.13, suitColorHex, 0.11, 0.45, 0);
  root.add(legL, legR);

  // Polished leather dress shoes
  const shoeL = createBox(0.14, 0.08, 0.24, 0x111111, -0.11, 0.04, 0.04);
  const shoeR = createBox(0.14, 0.08, 0.24, 0x111111, 0.11, 0.04, 0.04);
  legL.add(shoeL);
  legR.add(shoeR);

  return { root, legL, legR, armL, armR };
}

/**
 * 2. Woman in Shift Dress & Pillbox Hat.
 */
export function createShiftDressPedestrian(dressColorHex: number, hatColorHex: number): {
  root: Object3D;
  legL: Object3D;
  legR: Object3D;
  armL: Object3D;
  armR: Object3D;
} {
  const root = new Object3D();

  // Head with styled bouffant hair + pillbox hat
  const head = createBox(0.22, 0.26, 0.22, 0xfad2b4, 0, 1.54, 0);
  const bouffantHair = createBox(0.32, 0.24, 0.3, 0x6f4e37, 0, 1.62, -0.02);
  const pillboxHat = createBox(0.24, 0.1, 0.24, hatColorHex, 0, 1.74, -0.02);
  const catEyeGlasses = createBox(0.22, 0.06, 0.05, 0x111111, 0, 1.55, 0.12);
  root.add(head, bouffantHair, pillboxHat, catEyeGlasses);

  // Geometric A-line shift dress torso
  const dressTop = createBox(0.38, 0.38, 0.22, dressColorHex, 0, 1.25, 0);
  const dressSkirt = createBox(0.44, 0.4, 0.28, dressColorHex, 0, 0.9, 0);
  root.add(dressTop, dressSkirt);

  // Bare arms with white gloves / handbag
  const armL = createBox(0.09, 0.52, 0.09, 0xfad2b4, -0.24, 1.18, 0);
  const armR = createBox(0.09, 0.52, 0.09, 0xfad2b4, 0.24, 1.18, 0);
  const handbag = createBox(0.18, 0.18, 0.08, 0xffffff, 0.28, 0.88, 0.05);
  armR.add(handbag);
  root.add(armL, armR);

  // Slender legs with low heels
  const legL = createBox(0.1, 0.72, 0.1, 0xfad2b4, -0.1, 0.36, 0);
  const legR = createBox(0.1, 0.72, 0.1, 0xfad2b4, 0.1, 0.36, 0);
  const heelL = createBox(0.11, 0.08, 0.2, 0xffffff, -0.1, 0.04, 0.04);
  const heelR = createBox(0.11, 0.08, 0.2, 0xffffff, 0.1, 0.04, 0.04);
  legL.add(heelL);
  legR.add(heelR);
  root.add(legL, legR);

  return { root, legL, legR, armL, armR };
}

/**
 * 3. Mod in Bold Geometric Patterned Outfit.
 */
export function createModPedestrian(patternColorHex: number): {
  root: Object3D;
  legL: Object3D;
  legR: Object3D;
  armL: Object3D;
  armR: Object3D;
} {
  const root = new Object3D();

  // Head with 60s mop-top / five-point bob cut
  const head = createBox(0.23, 0.26, 0.23, 0xfad2b4, 0, 1.58, 0);
  const mopHair = createBox(0.3, 0.2, 0.3, 0x222222, 0, 1.66, 0.02);
  const modCap = createBox(0.28, 0.08, 0.32, patternColorHex, 0, 1.74, 0.04);
  root.add(head, mopHair, modCap);

  // Op-art striped / color-block mod jacket
  const modJacket = createBox(0.4, 0.54, 0.24, patternColorHex, 0, 1.24, 0);
  const stripeBand1 = createBox(0.42, 0.08, 0.25, 0x111111, 0, 1.34, 0);
  const stripeBand2 = createBox(0.42, 0.08, 0.25, 0x111111, 0, 1.14, 0);
  root.add(modJacket, stripeBand1, stripeBand2);

  // Arms
  const armL = createBox(0.1, 0.52, 0.1, patternColorHex, -0.25, 1.2, 0);
  const armR = createBox(0.1, 0.52, 0.1, patternColorHex, 0.25, 1.2, 0);
  root.add(armL, armR);

  // Tight bell-bottoms or trousers
  const legL = createBox(0.12, 0.8, 0.12, 0x111111, -0.11, 0.42, 0);
  const legR = createBox(0.12, 0.8, 0.12, 0x111111, 0.11, 0.42, 0);
  // Chelsea beatle boots
  const bootL = createBox(0.13, 0.14, 0.24, 0x2b1704, -0.11, 0.07, 0.04);
  const bootR = createBox(0.13, 0.14, 0.24, 0x2b1704, 0.11, 0.07, 0.04);
  legL.add(bootL);
  legR.add(bootR);
  root.add(legL, legR);

  return { root, legL, legR, armL, armR };
}

/**
 * 4. Teenager with Transistor Radio.
 */
export function createTeenTransistorPedestrian(): {
  root: Object3D;
  legL: Object3D;
  legR: Object3D;
  armL: Object3D;
  armR: Object3D;
} {
  const root = new Object3D();

  // Head with pompadour / surfer hairstyle
  const head = createBox(0.23, 0.26, 0.23, 0xfad2b4, 0, 1.56, 0);
  const hair = createBox(0.28, 0.18, 0.28, 0xb87333, 0, 1.66, -0.02);
  root.add(head, hair);

  // Casual polo shirt / Harrington jacket
  const polo = createBox(0.38, 0.52, 0.22, 0x2ec4b6, 0, 1.22, 0);
  const collar = createBox(0.22, 0.08, 0.24, 0xffffff, 0, 1.44, 0);
  root.add(polo, collar);

  // Left arm holding portable chrome/red transistor radio with antenna
  const armL = createBox(0.09, 0.5, 0.09, 0xfad2b4, -0.24, 1.18, 0);
  const radio = createBox(
    0.16,
    0.22,
    0.08,
    ERA_1965_PALETTE.pedestrians.transistorRadioSilver,
    -0.28,
    0.95,
    0.12,
  );
  const speakerGrille = createBox(0.12, 0.1, 0.02, 0xd90429, -0.28, 0.98, 0.17);
  const antenna = createBox(0.02, 0.35, 0.02, 0xcccccc, -0.28, 1.22, 0.12);
  armL.add(radio, speakerGrille, antenna);

  const armR = createBox(0.09, 0.5, 0.09, 0xfad2b4, 0.24, 1.18, 0);
  root.add(armL, armR);

  // Rolled cuff blue jeans + white sneakers
  const legL = createBox(0.12, 0.78, 0.12, 0x1d3557, -0.1, 0.4, 0);
  const legR = createBox(0.12, 0.78, 0.12, 0x1d3557, 0.1, 0.4, 0);
  const sneakerL = createBox(0.13, 0.08, 0.22, 0xffffff, -0.1, 0.04, 0.03);
  const sneakerR = createBox(0.13, 0.08, 0.22, 0xffffff, 0.1, 0.04, 0.03);
  legL.add(snekerLFix(sneakerL));
  legR.add(snekerLFix(sneakerR));
  root.add(legL, legR);

  return { root, legL, legR, armL, armR };
}

function snekerLFix(s: Object3D): Object3D {
  return s;
}

/**
 * Builds the complete 1965 Pedestrian population across the sidewalks.
 */
export function create1965Pedestrians(_layout: CityBlockLayout): PedestrianSystem {
  const root = new Object3D();
  const pedestrians: PedestrianInstance[] = [];

  // Sidewalk circuits (North, South, East, West sidewalk paths)
  const paths = [
    // North sidewalk path
    {
      start: { x: -28, z: -31 },
      end: { x: 28, z: -31 },
    },
    // South sidewalk path
    {
      start: { x: 28, z: 31 },
      end: { x: -28, z: 31 },
    },
    // West sidewalk path
    {
      start: { x: -31, z: 28 },
      end: { x: -31, z: -28 },
    },
    // East sidewalk path
    {
      start: { x: 31, z: -28 },
      end: { x: 31, z: 28 },
    },
  ];

  // Spawn a diverse cast of 1965 pedestrians
  const configs = [
    {
      type: 'slim_suit' as const,
      name: 'Ad Executive in Navy Slim Suit',
      creator: () => createSlimSuitPedestrian(ERA_1965_PALETTE.pedestrians.suitNavy),
      pathIndex: 0,
      prog: 0.1,
      speed: 2.2,
    },
    {
      type: 'shift_dress' as const,
      name: 'Woman in Coral Shift Dress & Pillbox Hat',
      creator: () =>
        createShiftDressPedestrian(
          ERA_1965_PALETTE.pedestrians.shiftDressCoral,
          ERA_1965_PALETTE.pedestrians.pillboxHatTeal,
        ),
      pathIndex: 0,
      prog: 0.55,
      speed: 1.9,
    },
    {
      type: 'mod_pattern' as const,
      name: 'Carnaby Mod in Black & White Stripes',
      creator: () =>
        createModPedestrian(ERA_1965_PALETTE.pedestrians.modStripesBlackWhite),
      pathIndex: 1,
      prog: 0.2,
      speed: 2.6,
    },
    {
      type: 'teen_transistor' as const,
      name: 'Teenager with Portable Transistor Radio',
      creator: () => createTeenTransistorPedestrian(),
      pathIndex: 1,
      prog: 0.7,
      speed: 2.4,
    },
    {
      type: 'slim_suit' as const,
      name: 'Businessman in Charcoal Suit',
      creator: () =>
        createSlimSuitPedestrian(ERA_1965_PALETTE.pedestrians.suitCharcoal),
      pathIndex: 2,
      prog: 0.35,
      speed: 2.0,
    },
    {
      type: 'shift_dress' as const,
      name: 'Woman in Yellow Shift Dress',
      creator: () =>
        createShiftDressPedestrian(
          ERA_1965_PALETTE.pedestrians.shiftDressYellow,
          0xd90429,
        ),
      pathIndex: 3,
      prog: 0.65,
      speed: 1.8,
    },
    {
      type: 'mod_pattern' as const,
      name: 'Mod Stylist in Bold Red Check',
      creator: () => createModPedestrian(0xd90429),
      pathIndex: 2,
      prog: 0.8,
      speed: 2.5,
    },
    {
      type: 'teen_transistor' as const,
      name: 'Rock Fan Teenager',
      creator: () => createTeenTransistorPedestrian(),
      pathIndex: 3,
      prog: 0.15,
      speed: 2.3,
    },
  ];

  configs.forEach((cfg, idx) => {
    const built = cfg.creator();
    root.add(built.root);
    pedestrians.push({
      id: `ped-1965-${cfg.type}-${idx}`,
      archetype: cfg.type,
      name: cfg.name,
      root: built.root,
      speed: cfg.speed,
      progress: cfg.prog,
      pathIndex: cfg.pathIndex,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
    });
  });

  function updatePedestrians(dt: number, time: number): void {
    for (const p of pedestrians) {
      const path = paths[p.pathIndex];
      const dist = Math.hypot(path.end.x - path.start.x, path.end.z - path.start.z);
      p.progress += (p.speed * dt) / dist;
      if (p.progress > 1.0) {
        p.progress = 0.0;
      }

      const x = path.start.x + (path.end.x - path.start.x) * p.progress;
      const z = path.start.z + (path.end.z - path.start.z) * p.progress;
      p.root.position.set(x, 0, z);

      const angle = Math.atan2(path.end.x - path.start.x, path.end.z - path.start.z);
      p.root.rotation.y = angle;

      // Walking swing animation on legs and arms
      const walkCycle = Math.sin(time * 8.0 * (p.speed / 2.0) + p.progress * 10);
      if (p.legL) p.legL.rotation.x = walkCycle * 0.45;
      if (p.legR) p.legR.rotation.x = -walkCycle * 0.45;
      if (p.armL) p.armL.rotation.x = -walkCycle * 0.35;
      if (p.armR) p.armR.rotation.x = walkCycle * 0.35;
    }
  }

  // Initial update
  updatePedestrians(0.001, 0);

  return {
    root,
    pedestrians,
    update(dt: number, time: number) {
      updatePedestrians(dt, time);
    },
  };
}
