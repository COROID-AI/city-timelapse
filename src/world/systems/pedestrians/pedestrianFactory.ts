/**
 * Procedural Low-Poly Pedestrian Rig and Era Outfit / Prop Builder.
 *
 * Constructs lightweight hierarchical Three.js pedestrian rigs:
 * - Root -> Body -> Torso, Neck, Head (with Hair/Hats/Glasses), Left/Right Arms (with Props)
 * - Root -> Left/Right Legs (with Shoes)
 *
 * Implements era-accurate outfits and props:
 * - 1945: Double-breasted suits, fedoras, cloche hats, pleated dresses; briefcases, newspapers, umbrellas
 * - 1965: Slim charcoal suits, mod color-block shift dresses, sunglasses; transistor radios, attache cases, books
 * - 1985: Neon windbreakers, acid-wash denim, shoulder pads, high tops; shoulder boombox, walkman & headphones
 * - 2005: Track jackets, cargo pants, layered hoodies; flip phones, white earbud MP3s, coffee cups, backpacks
 * - 2025: Minimalist athleisure, technical outerwear, eco-linen; smartphones, smart AR glasses, hydro flasks
 *
 * Supports hierarchical walking animation and dynamic reclothing.
 */

import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Material,
} from 'three';
import type { EraId } from '../../../era/years';
import { getPedestrianEraSpec } from './pedestrianEraData';

/* ------------------------------------------------------------------ */
/* Shared Low-Poly Geometries (Shared across all pedestrians)         */
/* ------------------------------------------------------------------ */

interface SharedGeometries {
  torso: BoxGeometry;
  head: BoxGeometry;
  arm: BoxGeometry;
  leg: BoxGeometry;
  shoe: BoxGeometry;
  skirt: CylinderGeometry;
  fedoraCrown: CylinderGeometry;
  fedoraBrim: CylinderGeometry;
  clocheHat: CylinderGeometry;
  hairBob: BoxGeometry;
  hairLong: BoxGeometry;
  glasses: BoxGeometry;
  hoodieHood: BoxGeometry;
  cargoPocket: BoxGeometry;
  briefcase: BoxGeometry;
  newspaper: BoxGeometry;
  umbrella: CylinderGeometry;
  transistorRadio: BoxGeometry;
  attacheCase: BoxGeometry;
  paperbackBook: BoxGeometry;
  boombox: BoxGeometry;
  boomboxSpeaker: CylinderGeometry;
  headphones: BoxGeometry;
  flipPhone: BoxGeometry;
  mp3Player: BoxGeometry;
  coffeeCup: CylinderGeometry;
  smartphone: BoxGeometry;
  hydroFlask: CylinderGeometry;
}

let sharedGeometriesInstance: SharedGeometries | null = null;

function getSharedGeometries(): SharedGeometries {
  if (sharedGeometriesInstance) {
    return sharedGeometriesInstance;
  }

  sharedGeometriesInstance = {
    torso: new BoxGeometry(0.38, 0.52, 0.22),
    head: new BoxGeometry(0.2, 0.22, 0.2),
    arm: new BoxGeometry(0.1, 0.52, 0.1),
    leg: new BoxGeometry(0.12, 0.74, 0.12),
    shoe: new BoxGeometry(0.13, 0.08, 0.2),
    skirt: new CylinderGeometry(0.2, 0.32, 0.42, 6),
    fedoraCrown: new CylinderGeometry(0.13, 0.15, 0.1, 8),
    fedoraBrim: new CylinderGeometry(0.25, 0.25, 0.02, 8),
    clocheHat: new CylinderGeometry(0.16, 0.19, 0.14, 8),
    hairBob: new BoxGeometry(0.24, 0.16, 0.24),
    hairLong: new BoxGeometry(0.24, 0.32, 0.24),
    glasses: new BoxGeometry(0.22, 0.04, 0.06),
    hoodieHood: new BoxGeometry(0.28, 0.26, 0.22),
    cargoPocket: new BoxGeometry(0.04, 0.12, 0.1),
    briefcase: new BoxGeometry(0.08, 0.24, 0.32),
    newspaper: new BoxGeometry(0.04, 0.26, 0.18),
    umbrella: new CylinderGeometry(0.02, 0.02, 0.7, 5),
    transistorRadio: new BoxGeometry(0.06, 0.14, 0.16),
    attacheCase: new BoxGeometry(0.06, 0.22, 0.3),
    paperbackBook: new BoxGeometry(0.04, 0.18, 0.12),
    boombox: new BoxGeometry(0.14, 0.2, 0.42),
    boomboxSpeaker: new CylinderGeometry(0.06, 0.06, 0.02, 6),
    headphones: new BoxGeometry(0.26, 0.04, 0.08),
    flipPhone: new BoxGeometry(0.04, 0.1, 0.06),
    mp3Player: new BoxGeometry(0.03, 0.09, 0.06),
    coffeeCup: new CylinderGeometry(0.04, 0.03, 0.12, 6),
    smartphone: new BoxGeometry(0.02, 0.14, 0.07),
    hydroFlask: new CylinderGeometry(0.04, 0.04, 0.22, 6),
  };

  return sharedGeometriesInstance;
}

/* ------------------------------------------------------------------ */
/* Pedestrian Rig Interface                                           */
/* ------------------------------------------------------------------ */

export interface PedestrianRig {
  readonly root: Group;
  readonly bodyGroup: Group;
  readonly headGroup: Group;
  readonly leftArmGroup: Group;
  readonly rightArmGroup: Group;
  readonly leftLegGroup: Group;
  readonly rightLegGroup: Group;
  readonly materials: Material[];
  currentEra: EraId;
  outfitIndex: number;
  propName: string | null;

  setOutfit(era: EraId, outfitIndex?: number, seed?: number): void;
  updateAnimation(
    walkDistance: number,
    isWalking: boolean,
    isWindowShopping?: boolean,
    deltaSeconds?: number,
  ): void;
  dispose(): void;
}

/* ------------------------------------------------------------------ */
/* Skin & Hair Palettes                                               */
/* ------------------------------------------------------------------ */

const SKIN_PALETTE = ['#f5d0b5', '#d49e7a', '#8d5524', '#c68642', '#e0ac69', '#5c3826'];
const HAIR_PALETTE = ['#1c1917', '#451a03', '#78350f', '#b45309', '#e2e8f0', '#a16207'];
const SHOE_PALETTE = ['#1c1917', '#292524', '#44403c', '#78350f', '#f8fafc'];

/**
 * Deterministic pseudo-random number from an index/seed.
 */
function seededChoice<T>(list: readonly T[], seed: number, offset = 0): T {
  const idx = Math.abs(Math.floor(seed * 9301 + offset * 49297)) % list.length;
  return list[idx];
}

/* ------------------------------------------------------------------ */
/* Pedestrian Rig Builder                                              */
/* ------------------------------------------------------------------ */

export function createPedestrianRig(initialEra: EraId = '1945', seed = 0): PedestrianRig {
  const geo = getSharedGeometries();
  const materials: Material[] = [];

  const root = new Group();
  root.name = `pedestrian-agent-${seed}`;

  // Materials
  const skinColor = seededChoice(SKIN_PALETTE, seed, 1);
  const hairColor = seededChoice(HAIR_PALETTE, seed, 2);
  const shoeColor = seededChoice(SHOE_PALETTE, seed, 3);

  const skinMat = new MeshBasicMaterial({ color: skinColor });
  const hairMat = new MeshBasicMaterial({ color: hairColor });
  const shoeMat = new MeshBasicMaterial({ color: shoeColor });
  const topMat = new MeshBasicMaterial({ color: 0x555555 });
  const bottomMat = new MeshBasicMaterial({ color: 0x333333 });
  const accessoryMat = new MeshBasicMaterial({ color: 0x222222 });
  const propMat = new MeshBasicMaterial({ color: 0x888888 });
  const accentMat = new MeshBasicMaterial({ color: 0x00ffff });

  materials.push(skinMat, hairMat, shoeMat, topMat, bottomMat, accessoryMat, propMat, accentMat);

  // Body Group (Y = 0.82 hips center)
  const bodyGroup = new Group();
  bodyGroup.name = 'body-group';
  bodyGroup.position.set(0, 0.82, 0);
  root.add(bodyGroup);

  // Torso
  const torsoMesh = new Mesh(geo.torso, topMat);
  torsoMesh.position.set(0, 0.26, 0);
  torsoMesh.name = 'torso-mesh';
  bodyGroup.add(torsoMesh);

  // Skirt / Coat extension (for dress outfits)
  const skirtMesh = new Mesh(geo.skirt, bottomMat);
  skirtMesh.position.set(0, -0.12, 0);
  skirtMesh.name = 'skirt-mesh';
  skirtMesh.visible = false;
  bodyGroup.add(skirtMesh);

  // Head Group (Y = 0.52 above hips)
  const headGroup = new Group();
  headGroup.name = 'head-group';
  headGroup.position.set(0, 0.54, 0);
  bodyGroup.add(headGroup);

  const headMesh = new Mesh(geo.head, skinMat);
  headMesh.position.set(0, 0.12, 0);
  headMesh.name = 'head-mesh';
  headGroup.add(headMesh);

  // Hair Nodes
  const hairBobMesh = new Mesh(geo.hairBob, hairMat);
  hairBobMesh.position.set(0, 0.18, -0.02);
  hairBobMesh.name = 'hair-bob';
  headGroup.add(hairBobMesh);

  const hairLongMesh = new Mesh(geo.hairLong, hairMat);
  hairLongMesh.position.set(0, 0.12, -0.04);
  hairLongMesh.name = 'hair-long';
  hairLongMesh.visible = false;
  headGroup.add(hairLongMesh);

  // Hat & Headwear Nodes
  const hatGroup = new Group();
  hatGroup.name = 'hat-group';
  hatGroup.position.set(0, 0.22, 0);
  headGroup.add(hatGroup);

  const fedoraCrownMesh = new Mesh(geo.fedoraCrown, accessoryMat);
  fedoraCrownMesh.position.set(0, 0.05, 0);
  const fedoraBrimMesh = new Mesh(geo.fedoraBrim, accessoryMat);
  fedoraBrimMesh.position.set(0, 0.01, 0);
  const fedoraGroup = new Group();
  fedoraGroup.add(fedoraCrownMesh, fedoraBrimMesh);
  fedoraGroup.name = 'fedora';
  fedoraGroup.visible = false;
  hatGroup.add(fedoraGroup);

  const clocheMesh = new Mesh(geo.clocheHat, accessoryMat);
  clocheMesh.position.set(0, 0.02, 0);
  clocheMesh.name = 'cloche-hat';
  clocheMesh.visible = false;
  hatGroup.add(clocheMesh);

  const glassesMesh = new Mesh(geo.glasses, accessoryMat);
  glassesMesh.position.set(0, 0.13, 0.11);
  glassesMesh.name = 'glasses';
  glassesMesh.visible = false;
  headGroup.add(glassesMesh);

  const headphonesMesh = new Mesh(geo.headphones, accentMat);
  headphonesMesh.position.set(0, 0.18, 0);
  headphonesMesh.name = 'headphones';
  headphonesMesh.visible = false;
  headGroup.add(headphonesMesh);

  const hoodieMesh = new Mesh(geo.hoodieHood, topMat);
  hoodieMesh.position.set(0, 0.1, -0.08);
  hoodieMesh.name = 'hoodie-hood';
  hoodieMesh.visible = false;
  headGroup.add(hoodieMesh);

  // Left Arm Group (Shoulder pivot at X = -0.24, Y = 0.48)
  const leftArmGroup = new Group();
  leftArmGroup.name = 'left-arm-group';
  leftArmGroup.position.set(-0.24, 0.48, 0);
  bodyGroup.add(leftArmGroup);

  const leftArmMesh = new Mesh(geo.arm, topMat);
  leftArmMesh.position.set(0, -0.22, 0);
  leftArmMesh.name = 'left-arm-mesh';
  leftArmGroup.add(leftArmMesh);

  const leftPropGroup = new Group();
  leftPropGroup.name = 'left-prop-group';
  leftPropGroup.position.set(0, -0.44, 0);
  leftArmGroup.add(leftPropGroup);

  // Right Arm Group (Shoulder pivot at X = 0.24, Y = 0.48)
  const rightArmGroup = new Group();
  rightArmGroup.name = 'right-arm-group';
  rightArmGroup.position.set(0.24, 0.48, 0);
  bodyGroup.add(rightArmGroup);

  const rightArmMesh = new Mesh(geo.arm, topMat);
  rightArmMesh.position.set(0, -0.22, 0);
  rightArmMesh.name = 'right-arm-mesh';
  rightArmGroup.add(rightArmMesh);

  const rightPropGroup = new Group();
  rightPropGroup.name = 'right-prop-group';
  rightPropGroup.position.set(0, -0.44, 0);
  rightArmGroup.add(rightPropGroup);

  // Left Leg Group (Hip pivot at X = -0.11, Y = 0.74 from ground)
  const leftLegGroup = new Group();
  leftLegGroup.name = 'left-leg-group';
  leftLegGroup.position.set(-0.11, 0.74, 0);
  root.add(leftLegGroup);

  const leftLegMesh = new Mesh(geo.leg, bottomMat);
  leftLegMesh.position.set(0, -0.34, 0);
  leftLegMesh.name = 'left-leg-mesh';
  leftLegGroup.add(leftLegMesh);

  const leftShoeMesh = new Mesh(geo.shoe, shoeMat);
  leftShoeMesh.position.set(0, -0.71, 0.04);
  leftShoeMesh.name = 'left-shoe-mesh';
  leftLegGroup.add(leftShoeMesh);

  // Right Leg Group (Hip pivot at X = 0.11, Y = 0.74 from ground)
  const rightLegGroup = new Group();
  rightLegGroup.name = 'right-leg-group';
  rightLegGroup.position.set(0.11, 0.74, 0);
  root.add(rightLegGroup);

  const rightLegMesh = new Mesh(geo.leg, bottomMat);
  rightLegMesh.position.set(0, -0.34, 0);
  rightLegMesh.name = 'right-leg-mesh';
  rightLegGroup.add(rightLegMesh);

  const rightShoeMesh = new Mesh(geo.shoe, shoeMat);
  rightShoeMesh.position.set(0, -0.71, 0.04);
  rightShoeMesh.name = 'right-shoe-mesh';
  rightLegGroup.add(rightShoeMesh);

  // Prop Meshes (Created in hand nodes, toggled as needed)
  const briefcaseMesh = new Mesh(geo.briefcase, propMat);
  briefcaseMesh.position.set(0, -0.1, 0.06);
  briefcaseMesh.name = 'prop-briefcase';

  const newspaperMesh = new Mesh(geo.newspaper, propMat);
  newspaperMesh.position.set(0, -0.05, 0.06);
  newspaperMesh.name = 'prop-newspaper';

  const umbrellaMesh = new Mesh(geo.umbrella, accessoryMat);
  umbrellaMesh.position.set(0, -0.15, 0);
  umbrellaMesh.name = 'prop-umbrella';

  const transistorMesh = new Mesh(geo.transistorRadio, propMat);
  transistorMesh.position.set(0, 0, 0.06);
  transistorMesh.name = 'prop-transistor';

  const attacheMesh = new Mesh(geo.attacheCase, propMat);
  attacheMesh.position.set(0, -0.08, 0.06);
  attacheMesh.name = 'prop-attache';

  const bookMesh = new Mesh(geo.paperbackBook, propMat);
  bookMesh.position.set(0, 0, 0.06);
  bookMesh.name = 'prop-book';

  const boomboxMesh = new Mesh(geo.boombox, propMat);
  boomboxMesh.position.set(0, 0.18, 0.05);
  boomboxMesh.name = 'prop-boombox';
  const speakerL = new Mesh(geo.boomboxSpeaker, accentMat);
  speakerL.rotation.x = Math.PI / 2;
  speakerL.position.set(0.08, 0, -0.12);
  const speakerR = new Mesh(geo.boomboxSpeaker, accentMat);
  speakerR.rotation.x = Math.PI / 2;
  speakerR.position.set(0.08, 0, 0.12);
  boomboxMesh.add(speakerL, speakerR);

  const flipPhoneMesh = new Mesh(geo.flipPhone, propMat);
  flipPhoneMesh.position.set(0, 0.05, 0.05);
  flipPhoneMesh.name = 'prop-flip-phone';

  const mp3Mesh = new Mesh(geo.mp3Player, accentMat);
  mp3Mesh.position.set(0, 0.05, 0.05);
  mp3Mesh.name = 'prop-mp3';

  const coffeeMesh = new Mesh(geo.coffeeCup, propMat);
  coffeeMesh.position.set(0, 0.06, 0.04);
  coffeeMesh.name = 'prop-coffee';

  const smartphoneMesh = new Mesh(geo.smartphone, accentMat);
  smartphoneMesh.position.set(0, 0.06, 0.05);
  smartphoneMesh.name = 'prop-smartphone';

  const hydroFlaskMesh = new Mesh(geo.hydroFlask, accentMat);
  hydroFlaskMesh.position.set(0, -0.04, 0.04);
  hydroFlaskMesh.name = 'prop-hydroflask';

  let currentEra: EraId = initialEra;
  let currentOutfitIndex = seed % 2;
  let activePropName: string | null = null;

  /* ---------------------------------------------------------------- */
  /* Outfitting Method                                                */
  /* ---------------------------------------------------------------- */

  function clearHandProps(): void {
    while (leftPropGroup.children.length > 0) {
      leftPropGroup.remove(leftPropGroup.children[0]);
    }
    while (rightPropGroup.children.length > 0) {
      rightPropGroup.remove(rightPropGroup.children[0]);
    }
    activePropName = null;
  }

  function setOutfit(era: EraId, outfitIndex = currentOutfitIndex, seedOffset = seed): void {
    currentEra = era;
    currentOutfitIndex = outfitIndex;
    const spec = getPedestrianEraSpec(era);
    const outfit = spec.outfits[outfitIndex % spec.outfits.length];

    // Pick top and bottom colors
    const topHex = seededChoice(outfit.topPalette, seedOffset, 4);
    const bottomHex = seededChoice(outfit.bottomPalette, seedOffset, 5);
    (topMat.color as Color).set(topHex);
    (bottomMat.color as Color).set(bottomHex);

    // Reset visibility of head accessories
    fedoraGroup.visible = false;
    clocheMesh.visible = false;
    glassesMesh.visible = false;
    headphonesMesh.visible = false;
    hoodieMesh.visible = false;
    skirtMesh.visible = false;
    hairBobMesh.visible = true;
    hairLongMesh.visible = false;

    clearHandProps();

    const isDress = outfit.accessories.includes('dress') || outfit.accessories.includes('mod_dress');
    if (isDress) {
      skirtMesh.visible = true;
      hairLongMesh.visible = true;
      hairBobMesh.visible = false;
    }

    // Era-specific silhouettes and headwear
    switch (era) {
      case '1945': {
        (accessoryMat.color as Color).set('#292524');
        (propMat.color as Color).set('#451a03');
        if (outfit.accessories.includes('fedora')) {
          fedoraGroup.visible = true;
        } else if (outfit.accessories.includes('cloche_hat')) {
          clocheMesh.visible = true;
        }
        break;
      }
      case '1965': {
        (accessoryMat.color as Color).set('#0f172a');
        (propMat.color as Color).set('#94a3b8');
        if (outfit.accessories.includes('sunglasses_wayfarer') || outfit.accessories.includes('cat_eye_glasses')) {
          glassesMesh.visible = true;
        }
        break;
      }
      case '1985': {
        (accessoryMat.color as Color).set('#f43f5e');
        (propMat.color as Color).set('#1e293b');
        (accentMat.color as Color).set('#38bdf8');
        if (outfit.accessories.includes('headphones')) {
          headphonesMesh.visible = true;
        }
        if (outfit.accessories.includes('aviator_glasses')) {
          glassesMesh.visible = true;
        }
        break;
      }
      case '2005': {
        (accessoryMat.color as Color).set('#334155');
        (propMat.color as Color).set('#f8fafc');
        (accentMat.color as Color).set('#6366f1');
        if (outfit.accessories.includes('hoodie')) {
          hoodieMesh.visible = true;
        }
        break;
      }
      case '2025': {
        (accessoryMat.color as Color).set('#0f172a');
        (propMat.color as Color).set('#0d9488');
        (accentMat.color as Color).set('#38bdf8');
        if (outfit.accessories.includes('smart_ar_glasses')) {
          glassesMesh.visible = true;
        }
        if (outfit.accessories.includes('wireless_headband')) {
          headphonesMesh.visible = true;
        }
        break;
      }
    }

    // Assign Era Props based on propProbability
    const hasProp = (seedOffset % 100) / 100 <= spec.propProbability;
    if (hasProp && spec.typicalProps.length > 0) {
      const propType = seededChoice(spec.typicalProps, seedOffset, 6);
      activePropName = propType;

      switch (propType) {
        case 'folded_newspaper':
          leftPropGroup.add(newspaperMesh);
          break;
        case 'leather_briefcase':
          rightPropGroup.add(briefcaseMesh);
          break;
        case 'umbrella':
          rightPropGroup.add(umbrellaMesh);
          break;
        case 'transistor_radio':
          rightPropGroup.add(transistorMesh);
          break;
        case 'attache_case':
          rightPropGroup.add(attacheMesh);
          break;
        case 'paperback_book':
          leftPropGroup.add(bookMesh);
          break;
        case 'shoulder_boombox':
          rightPropGroup.add(boomboxMesh);
          break;
        case 'portable_cassette_walkman':
          leftPropGroup.add(mp3Mesh);
          headphonesMesh.visible = true;
          break;
        case 'flip_phone':
          rightPropGroup.add(flipPhoneMesh);
          break;
        case 'takeout_coffee_cup':
          rightPropGroup.add(coffeeMesh);
          break;
        case 'white_earbud_mp3':
          leftPropGroup.add(mp3Mesh);
          break;
        case 'bezel_less_smartphone':
        case 'smartphone':
          rightPropGroup.add(smartphoneMesh);
          break;
        case 'hydro_flask':
          leftPropGroup.add(hydroFlaskMesh);
          break;
        default:
          rightPropGroup.add(briefcaseMesh);
          break;
      }
    }
  }

  // Initialize outfit
  setOutfit(initialEra, currentOutfitIndex, seed);

  /* ---------------------------------------------------------------- */
  /* Animation Update                                                 */
  /* ---------------------------------------------------------------- */

  const STRIDE_LENGTH = 0.85;
  let idleTimer = (seed % 10);

  function updateAnimation(
    walkDistance: number,
    isWalking: boolean,
    isWindowShopping = false,
    deltaSeconds = 0.016,
  ): void {
    idleTimer += deltaSeconds;

    if (isWalking) {
      // Natural walking stride phase
      const phase = walkDistance * ((Math.PI * 2) / STRIDE_LENGTH);
      const legAngle = Math.sin(phase) * 0.52;

      leftLegGroup.rotation.x = legAngle;
      rightLegGroup.rotation.x = -legAngle;

      // Vertical hip bounce (two peaks per full stride cycle)
      const bounce = Math.abs(Math.sin(phase)) * 0.035;
      bodyGroup.position.y = 0.82 + bounce;

      // Slight pelvis & torso sway
      bodyGroup.rotation.y = Math.sin(phase) * 0.05;
      headGroup.rotation.y = -Math.sin(phase) * 0.03;
      headGroup.rotation.x = 0;

      // Arm swing (opposite to legs)
      const isCarryingBoombox = activePropName === 'shoulder_boombox';
      const isUsingPhone = activePropName === 'bezel_less_smartphone' || activePropName === 'flip_phone';

      if (isCarryingBoombox) {
        // Boombox hoisted up on shoulder
        rightArmGroup.rotation.x = -1.45;
        rightArmGroup.rotation.z = -0.35;
        leftArmGroup.rotation.x = -legAngle * 0.65;
        leftArmGroup.rotation.z = 0;
      } else if (isUsingPhone) {
        // Phone held up towards chest/face
        rightArmGroup.rotation.x = -1.1;
        rightArmGroup.rotation.z = -0.2;
        leftArmGroup.rotation.x = -legAngle * 0.65;
        leftArmGroup.rotation.z = 0;
      } else {
        leftArmGroup.rotation.x = -legAngle * 0.65;
        rightArmGroup.rotation.x = legAngle * 0.65;
        leftArmGroup.rotation.z = 0;
        rightArmGroup.rotation.z = 0;
      }
    } else if (isWindowShopping) {
      // Standing and browsing storefront window
      leftLegGroup.rotation.x = 0.04;
      rightLegGroup.rotation.x = -0.04;
      bodyGroup.position.y = 0.82 + Math.sin(idleTimer * 1.5) * 0.008;
      bodyGroup.rotation.y = 0;

      // Looking around and gazing up/down at storefront
      headGroup.rotation.y = Math.sin(idleTimer * 0.8) * 0.25;
      headGroup.rotation.x = 0.08 + Math.sin(idleTimer * 0.5) * 0.05;

      leftArmGroup.rotation.x = -0.15 + Math.sin(idleTimer * 1.2) * 0.05;
      rightArmGroup.rotation.x = -0.3 + Math.cos(idleTimer * 1.1) * 0.05;
      leftArmGroup.rotation.z = -0.05;
      rightArmGroup.rotation.z = 0.05;
    } else {
      // General idle standing
      leftLegGroup.rotation.x = 0;
      rightLegGroup.rotation.x = 0;
      bodyGroup.position.y = 0.82 + Math.sin(idleTimer * 1.5) * 0.006;
      bodyGroup.rotation.y = 0;
      headGroup.rotation.y = Math.sin(idleTimer * 0.6) * 0.15;
      headGroup.rotation.x = 0;
      leftArmGroup.rotation.x = 0;
      rightArmGroup.rotation.x = 0;
      leftArmGroup.rotation.z = 0;
      rightArmGroup.rotation.z = 0;
    }
  }

  function dispose(): void {
    clearHandProps();
    for (const mat of materials) {
      mat.dispose();
    }
    if (root.parent) {
      root.parent.remove(root);
    }
  }

  return {
    root,
    bodyGroup,
    headGroup,
    leftArmGroup,
    rightArmGroup,
    leftLegGroup,
    rightLegGroup,
    materials,
    get currentEra() {
      return currentEra;
    },
    set currentEra(v: EraId) {
      currentEra = v;
    },
    get outfitIndex() {
      return currentOutfitIndex;
    },
    set outfitIndex(v: number) {
      currentOutfitIndex = v;
    },
    get propName() {
      return activePropName;
    },
    setOutfit,
    updateAnimation,
    dispose,
  };
}
