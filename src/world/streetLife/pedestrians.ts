/**
 * Era Pedestrian Crowds, Period Outfits and Walk Cycles
 *
 * Implements procedural period-accurate pedestrian models and outfits for all five eras:
 * - 1945: Wartime heavy wool trench coats, tailored overcoats, fedoras and cloche hats, briefcases.
 * - 1965: Mod tailoring, slim tonic suits with skinny ties, color-block mini dresses, sunglasses, mod handbags.
 * - 1985: Neon 80s color-blocked nylon windbreakers, acid wash jeans, bulky over-ear headphones with Walkman.
 * - 2005: Y2K baggy denim, oversized hoodies, beanies, and signature flip phones.
 * - 2025: Modern athleisure, sleek puffers, joggers, leggings, wireless earbuds, and glowing smartphones.
 *
 * All pedestrians patrol the layout's pedestrian walkway network (sidewalks and crosswalks)
 * with frame-rate-independent walk cycle kinematics and arm/leg animation.
 */

import * as THREE from 'three';
import type { EraId, EraTheme } from '../../era/types';
import type { BlockLayout, Point3D } from '../layout';
import type { Rng } from '../../lib/rng';

export type OutfitStyle =
  | 'wartime_coats'
  | 'mod_tailoring'
  | 'neon_80s'
  | 'y2k_denim'
  | 'athleisure';

export type PhoneType = 'none' | 'flip_phone' | 'smartphone';

export interface PedestrianInstance {
  id: string;
  era: EraId;
  outfitStyle: OutfitStyle;
  tags: string[];
  mesh: THREE.Group;
  segmentId: string;
  waypoints: Point3D[];
  segmentLength: number;
  distance: number;
  speed: number;
  direction: 1 | -1;
  walkPhase: number;
  lateralOffset: number;
  baseHeight: number;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  torso: THREE.Object3D;
  head: THREE.Object3D;
  accessories: string[];
  hasPhone: boolean;
  phoneType: PhoneType;
}

export interface PedestrianBuilderResult {
  group: THREE.Group;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  torso: THREE.Object3D;
  head: THREE.Object3D;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  accessories: string[];
  hasPhone: boolean;
  phoneType: PhoneType;
}

export interface CrowdOptions {
  count?: number;
}

// ============================================================================
// Material & Helper Utilities
// ============================================================================

function createStandardMat(
  materials: THREE.Material[],
  color: THREE.ColorRepresentation,
  roughness = 0.6,
  metalness = 0.1,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    transparent: true,
    opacity: 1.0,
  });
  materials.push(mat);
  return mat;
}

function createEmissiveMat(
  materials: THREE.Material[],
  color: THREE.ColorRepresentation,
  emissive: THREE.ColorRepresentation,
  intensity = 1.0,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 1.0,
  });
  materials.push(mat);
  return mat;
}

function trackGeom<T extends THREE.BufferGeometry>(geometries: THREE.BufferGeometry[], geom: T): T {
  geometries.push(geom);
  return geom;
}

function addMesh(
  parent: THREE.Object3D,
  geom: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number] = [0, 0, 0],
  rot: [number, number, number] = [0, 0, 0],
  geometries?: THREE.BufferGeometry[],
): THREE.Mesh {
  if (geometries) {
    trackGeom(geometries, geom);
  }
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  parent.add(mesh);
  return mesh;
}

// ============================================================================
// Period Procedural Pedestrian Builders
// ============================================================================

const SKIN_TONES = ['#f5d0b5', '#d4a373', '#8d5524', '#c68642', '#e0ac69', '#5c3818'];

/**
 * 1945 Pedestrian: Wartime heavy coats, double-breasted overcoats, fedoras, cloche hats, briefcases.
 * Signature: Strictly NO cell phones.
 */
export function build1945Pedestrian(
  primaryColor: string,
  variantIndex: number,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
  rng: Rng,
): PedestrianBuilderResult {
  const group = new THREE.Group();
  const accessories: string[] = [];
  const isFemale = variantIndex % 2 === 1;
  const skinColor = rng.pick(SKIN_TONES);

  const coatMat = createStandardMat(materials, primaryColor, 0.75, 0.1);
  const pantsMat = createStandardMat(materials, isFemale ? primaryColor : '#2b2a28', 0.8, 0.05);
  const skinMat = createStandardMat(materials, skinColor, 0.7, 0.0);
  const shoeMat = createStandardMat(materials, 0x1f1a17, 0.8, 0.2); // Leather shoes
  const hatMat = createStandardMat(materials, isFemale ? '#4a3f35' : primaryColor, 0.8, 0.1);
  const leatherMat = createStandardMat(materials, 0x5a3825, 0.6, 0.2);

  // 1. Torso Group
  const torso = new THREE.Group();
  torso.position.set(0, 0.85, 0);

  if (isFemale) {
    // Tailored wool coat with flared skirt
    addMesh(torso, new THREE.BoxGeometry(0.36, 0.48, 0.22), coatMat, [0, 0.24, 0], [0, 0, 0], geometries);
    // Coat skirt extending over hips
    addMesh(torso, new THREE.CylinderGeometry(0.18, 0.26, 0.45, 10), coatMat, [0, -0.15, 0], [0, 0, 0], geometries);
  } else {
    // Double-breasted long trench coat
    addMesh(torso, new THREE.BoxGeometry(0.42, 0.52, 0.24), coatMat, [0, 0.26, 0], [0, 0, 0], geometries);
    // Overcoat skirt
    addMesh(torso, new THREE.BoxGeometry(0.43, 0.48, 0.25), coatMat, [0, -0.15, 0], [0, 0, 0], geometries);
  }

  // 2. Head & Hat
  const head = new THREE.Group();
  head.position.set(0, 0.62, 0);
  addMesh(head, new THREE.SphereGeometry(0.11, 10, 10), skinMat, [0, 0, 0], [0, 0, 0], geometries);

  if (isFemale) {
    // Cloche Hat
    addMesh(head, new THREE.SphereGeometry(0.125, 10, 10), hatMat, [0, 0.04, 0], [0, 0, 0], geometries);
    addMesh(head, new THREE.CylinderGeometry(0.14, 0.15, 0.04, 12), hatMat, [0, -0.02, 0], [0, 0, 0], geometries);
    accessories.push('cloche_hat');
  } else {
    // Fedora Hat with brim
    addMesh(head, new THREE.CylinderGeometry(0.11, 0.12, 0.1, 12), hatMat, [0, 0.09, 0], [0, 0, 0], geometries);
    addMesh(head, new THREE.CylinderGeometry(0.18, 0.18, 0.02, 14), hatMat, [0, 0.04, 0], [0, 0, 0], geometries);
    accessories.push('fedora');
  }
  torso.add(head);

  // 3. Arms
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.24, 0.44, 0);
  addMesh(leftArm, new THREE.CylinderGeometry(0.05, 0.045, 0.52, 8), coatMat, [0, -0.22, 0], [0, 0, 0], geometries);
  addMesh(leftArm, new THREE.SphereGeometry(0.045, 8, 8), skinMat, [0, -0.5, 0], [0, 0, 0], geometries);
  torso.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.24, 0.44, 0);
  addMesh(rightArm, new THREE.CylinderGeometry(0.05, 0.045, 0.52, 8), coatMat, [0, -0.22, 0], [0, 0, 0], geometries);
  addMesh(rightArm, new THREE.SphereGeometry(0.045, 8, 8), skinMat, [0, -0.5, 0], [0, 0, 0], geometries);

  // Held Accessory (Briefcase or Handbag)
  if (isFemale) {
    const handbag = addMesh(rightArm, new THREE.BoxGeometry(0.18, 0.14, 0.06), leatherMat, [0.04, -0.48, 0.05], [0, 0, 0], geometries);
    void handbag;
    accessories.push('vintage_handbag');
  } else {
    const briefcase = addMesh(rightArm, new THREE.BoxGeometry(0.26, 0.2, 0.08), leatherMat, [0.06, -0.5, 0], [0, 0, 0], geometries);
    void briefcase;
    accessories.push('briefcase');
  }
  torso.add(rightArm);
  group.add(torso);

  // 4. Legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.12, 0.85, 0);
  addMesh(leftLeg, new THREE.CylinderGeometry(0.065, 0.055, 0.75, 8), pantsMat, [0, -0.38, 0], [0, 0, 0], geometries);
  addMesh(leftLeg, new THREE.BoxGeometry(0.11, 0.08, 0.22), shoeMat, [0, -0.76, 0.04], [0, 0, 0], geometries);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.12, 0.85, 0);
  addMesh(rightLeg, new THREE.CylinderGeometry(0.065, 0.055, 0.75, 8), pantsMat, [0, -0.38, 0], [0, 0, 0], geometries);
  addMesh(rightLeg, new THREE.BoxGeometry(0.11, 0.08, 0.22), shoeMat, [0, -0.76, 0.04], [0, 0, 0], geometries);
  group.add(rightLeg);

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    torso,
    head,
    geometries,
    materials,
    accessories,
    hasPhone: false,
    phoneType: 'none',
  };
}

/**
 * 1965 Pedestrian: Mod tailoring, slim tonic suits with skinny ties, color-block mini dresses,
 * Chelsea boots, sunglasses, mod handbags.
 * Signature: Strictly NO cell phones.
 */
export function build1965Pedestrian(
  primaryColor: string,
  variantIndex: number,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
  rng: Rng,
): PedestrianBuilderResult {
  const group = new THREE.Group();
  const accessories: string[] = [];
  const isFemale = variantIndex % 2 === 1;
  const skinColor = rng.pick(SKIN_TONES);

  const suitMat = createStandardMat(materials, primaryColor, 0.5, 0.2);
  const accentMat = createStandardMat(materials, isFemale ? '#ffffff' : '#111111', 0.5, 0.1);
  const skinMat = createStandardMat(materials, skinColor, 0.7, 0.0);
  const shoeMat = createStandardMat(materials, isFemale ? 0xffffff : 0x111111, 0.4, 0.3); // White go-go boots or Chelsea boots
  const hairMat = createStandardMat(materials, isFemale ? '#c48b52' : '#332211', 0.8, 0.05);
  const glassesMat = createStandardMat(materials, 0x111111, 0.2, 0.8);

  // 1. Torso
  const torso = new THREE.Group();
  torso.position.set(0, 0.85, 0);

  if (isFemale) {
    // Mod A-line mini dress with geometric block pattern
    addMesh(torso, new THREE.BoxGeometry(0.34, 0.44, 0.2), suitMat, [0, 0.22, 0], [0, 0, 0], geometries);
    // Mod Dress Skirt
    addMesh(torso, new THREE.CylinderGeometry(0.16, 0.24, 0.35, 10), suitMat, [0, -0.12, 0], [0, 0, 0], geometries);
    // Contrast color band
    addMesh(torso, new THREE.BoxGeometry(0.35, 0.08, 0.21), accentMat, [0, 0.15, 0], [0, 0, 0], geometries);
  } else {
    // Slim tailored suit jacket with skinny lapels
    addMesh(torso, new THREE.BoxGeometry(0.38, 0.48, 0.22), suitMat, [0, 0.24, 0], [0, 0, 0], geometries);
    // White shirt collar + skinny black tie
    addMesh(torso, new THREE.BoxGeometry(0.1, 0.15, 0.02), accentMat, [0, 0.38, 0.115], [0, 0, 0], geometries);
    addMesh(torso, new THREE.BoxGeometry(0.04, 0.25, 0.025), createStandardMat(materials, 0x111111, 0.8, 0.1), [0, 0.24, 0.12], [0, 0, 0], geometries);
  }

  // 2. Head, Mod Hair & Sunglasses
  const head = new THREE.Group();
  head.position.set(0, 0.58, 0);
  addMesh(head, new THREE.SphereGeometry(0.11, 10, 10), skinMat, [0, 0, 0], [0, 0, 0], geometries);

  if (isFemale) {
    // Bouffant / Mod Bob Haircut
    addMesh(head, new THREE.SphereGeometry(0.13, 10, 10), hairMat, [0, 0.03, -0.02], [0, 0, 0], geometries);
    // Mod Headband
    addMesh(head, new THREE.CylinderGeometry(0.132, 0.132, 0.03, 12), accentMat, [0, 0.05, 0], [0, 0, 0], geometries);
    accessories.push('mod_headband');
  } else {
    // 60s Mop-top / Side-part hair
    addMesh(head, new THREE.SphereGeometry(0.125, 10, 10), hairMat, [0, 0.05, -0.02], [0, 0, 0], geometries);
  }

  // Retro Sunglasses
  addMesh(head, new THREE.BoxGeometry(0.18, 0.05, 0.04), glassesMat, [0, 0.02, 0.1], [0, 0, 0], geometries);
  accessories.push('sunglasses');
  torso.add(head);

  // 3. Arms
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.22, 0.42, 0);
  addMesh(leftArm, new THREE.CylinderGeometry(0.045, 0.04, 0.5, 8), isFemale ? skinMat : suitMat, [0, -0.22, 0], [0, 0, 0], geometries);
  addMesh(leftArm, new THREE.SphereGeometry(0.04, 8, 8), skinMat, [0, -0.48, 0], [0, 0, 0], geometries);
  torso.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.22, 0.42, 0);
  addMesh(rightArm, new THREE.CylinderGeometry(0.045, 0.04, 0.5, 8), isFemale ? skinMat : suitMat, [0, -0.22, 0], [0, 0, 0], geometries);
  addMesh(rightArm, new THREE.SphereGeometry(0.04, 8, 8), skinMat, [0, -0.48, 0], [0, 0, 0], geometries);

  if (isFemale) {
    // Mod Geometric Handbag
    addMesh(rightArm, new THREE.BoxGeometry(0.14, 0.14, 0.08), accentMat, [0.04, -0.45, 0.04], [0, 0, 0], geometries);
    accessories.push('mod_handbag');
  }
  torso.add(rightArm);
  group.add(torso);

  // 4. Legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.11, 0.85, 0);
  if (isFemale) {
    // Bare legs + white go-go boots
    addMesh(leftLeg, new THREE.CylinderGeometry(0.055, 0.045, 0.45, 8), skinMat, [0, -0.22, 0], [0, 0, 0], geometries);
    addMesh(leftLeg, new THREE.CylinderGeometry(0.058, 0.05, 0.35, 8), shoeMat, [0, -0.58, 0], [0, 0, 0], geometries);
  } else {
    // Slim cigarette suit trousers
    addMesh(leftLeg, new THREE.CylinderGeometry(0.055, 0.045, 0.75, 8), suitMat, [0, -0.38, 0], [0, 0, 0], geometries);
    addMesh(leftLeg, new THREE.BoxGeometry(0.1, 0.07, 0.2), shoeMat, [0, -0.76, 0.03], [0, 0, 0], geometries);
  }
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.11, 0.85, 0);
  if (isFemale) {
    addMesh(rightLeg, new THREE.CylinderGeometry(0.055, 0.045, 0.45, 8), skinMat, [0, -0.22, 0], [0, 0, 0], geometries);
    addMesh(rightLeg, new THREE.CylinderGeometry(0.058, 0.05, 0.35, 8), shoeMat, [0, -0.58, 0], [0, 0, 0], geometries);
  } else {
    addMesh(rightLeg, new THREE.CylinderGeometry(0.055, 0.045, 0.75, 8), suitMat, [0, -0.38, 0], [0, 0, 0], geometries);
    addMesh(rightLeg, new THREE.BoxGeometry(0.1, 0.07, 0.2), shoeMat, [0, -0.76, 0.03], [0, 0, 0], geometries);
  }
  group.add(rightLeg);

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    torso,
    head,
    geometries,
    materials,
    accessories,
    hasPhone: false,
    phoneType: 'none',
  };
}

/**
 * 1985 Pedestrian: Neon color-blocked nylon windbreakers, acid wash jeans, neon headbands,
 * bulky over-ear headphones with cassette Walkman.
 * Signature: Strictly NO cell phones.
 */
export function build1985Pedestrian(
  primaryColor: string,
  variantIndex: number,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
  rng: Rng,
): PedestrianBuilderResult {
  const group = new THREE.Group();
  const accessories: string[] = [];
  const skinColor = rng.pick(SKIN_TONES);

  const neonColors = ['#ff2bd6', '#00e5ff', '#ffe600', '#7b2cbf', '#ff5400'];
  const neonAccent = neonColors[(variantIndex + 1) % neonColors.length]!;

  const windbreakerMat = createStandardMat(materials, primaryColor, 0.4, 0.3); // Shiny nylon
  const neonMat = createEmissiveMat(materials, neonAccent, neonAccent, 0.6);
  const denimMat = createStandardMat(materials, '#7395ae', 0.8, 0.05); // Acid wash denim
  const skinMat = createStandardMat(materials, skinColor, 0.7, 0.0);
  const sneakerMat = createStandardMat(materials, 0xffffff, 0.6, 0.1);
  const headphoneMat = createStandardMat(materials, 0xff8800, 0.5, 0.2); // Orange foam pads

  // 1. Torso (Oversized nylon windbreaker)
  const torso = new THREE.Group();
  torso.position.set(0, 0.85, 0);

  // Main jacket body (puffy, color-blocked)
  addMesh(torso, new THREE.BoxGeometry(0.44, 0.48, 0.26), windbreakerMat, [0, 0.24, 0], [0, 0, 0], geometries);
  // Geometric Neon Chevron Chest Stripe
  addMesh(torso, new THREE.BoxGeometry(0.445, 0.12, 0.265), neonMat, [0, 0.3, 0], [0, 0, 0], geometries);

  // Walkman / Cassette player on waist belt
  const walkmanMat = createStandardMat(materials, 0x334466, 0.3, 0.7);
  addMesh(torso, new THREE.BoxGeometry(0.12, 0.15, 0.05), walkmanMat, [0.23, 0.04, 0], [0, 0, 0], geometries);
  accessories.push('walkman_cassette');

  // 2. Head & Bulky Over-Ear Headphones
  const head = new THREE.Group();
  head.position.set(0, 0.6, 0);
  addMesh(head, new THREE.SphereGeometry(0.11, 10, 10), skinMat, [0, 0, 0], [0, 0, 0], geometries);
  // Big 80s hair
  addMesh(head, new THREE.SphereGeometry(0.13, 10, 10), createStandardMat(materials, 0x4a2e18, 0.9, 0.0), [0, 0.04, -0.02], [0, 0, 0], geometries);

  // Bulky Over-Ear Headphones with Headband
  // Headband band
  addMesh(head, new THREE.CylinderGeometry(0.135, 0.135, 0.03, 12), createStandardMat(materials, 0xcccccc, 0.2, 0.8), [0, 0.09, 0], [0, 0, 0], geometries);
  // Left & Right orange foam earpads
  addMesh(head, new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), headphoneMat, [-0.125, 0, 0], [0, 0, Math.PI / 2], geometries);
  addMesh(head, new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), headphoneMat, [0.125, 0, 0], [0, 0, Math.PI / 2], geometries);
  accessories.push('over_ear_headphones');

  torso.add(head);

  // 3. Arms (Puffy sleeves with neon cuffs)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.25, 0.44, 0);
  addMesh(leftArm, new THREE.CylinderGeometry(0.06, 0.05, 0.5, 8), windbreakerMat, [0, -0.22, 0], [0, 0, 0], geometries);
  addMesh(leftArm, new THREE.CylinderGeometry(0.055, 0.05, 0.08, 8), neonMat, [0, -0.42, 0], [0, 0, 0], geometries);
  addMesh(leftArm, new THREE.SphereGeometry(0.04, 8, 8), skinMat, [0, -0.48, 0], [0, 0, 0], geometries);
  torso.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.25, 0.44, 0);
  addMesh(rightArm, new THREE.CylinderGeometry(0.06, 0.05, 0.5, 8), windbreakerMat, [0, -0.22, 0], [0, 0, 0], geometries);
  addMesh(rightArm, new THREE.CylinderGeometry(0.055, 0.05, 0.08, 8), neonMat, [0, -0.42, 0], [0, 0, 0], geometries);
  addMesh(rightArm, new THREE.SphereGeometry(0.04, 8, 8), skinMat, [0, -0.48, 0], [0, 0, 0], geometries);
  torso.add(rightArm);
  group.add(torso);

  // 4. Legs (Acid wash jeans + high-top sneakers)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.12, 0.85, 0);
  addMesh(leftLeg, new THREE.CylinderGeometry(0.07, 0.055, 0.75, 8), denimMat, [0, -0.38, 0], [0, 0, 0], geometries);
  addMesh(leftLeg, new THREE.BoxGeometry(0.11, 0.09, 0.22), sneakerMat, [0, -0.76, 0.04], [0, 0, 0], geometries);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.12, 0.85, 0);
  addMesh(rightLeg, new THREE.CylinderGeometry(0.07, 0.055, 0.75, 8), denimMat, [0, -0.38, 0], [0, 0, 0], geometries);
  addMesh(rightLeg, new THREE.BoxGeometry(0.11, 0.09, 0.22), sneakerMat, [0, -0.76, 0.04], [0, 0, 0], geometries);
  group.add(rightLeg);

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    torso,
    head,
    geometries,
    materials,
    accessories,
    hasPhone: false,
    phoneType: 'none',
  };
}

/**
 * 2005 Pedestrian: Y2K baggy denim, oversized hoodies, beanies, and signature flip phones!
 * Signature: **Flip Phone** accessory held in hand.
 */
export function build2005Pedestrian(
  primaryColor: string,
  _variantIndex: number,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
  rng: Rng,
): PedestrianBuilderResult {
  const group = new THREE.Group();
  const accessories: string[] = [];
  const skinColor = rng.pick(SKIN_TONES);

  const hoodieMat = createStandardMat(materials, primaryColor, 0.8, 0.05);
  const denimMat = createStandardMat(materials, '#3a506b', 0.7, 0.05); // Dark/baggy denim
  const skinMat = createStandardMat(materials, skinColor, 0.7, 0.0);
  const shoeMat = createStandardMat(materials, 0x222222, 0.7, 0.1); // Chunky skate shoes
  const silverMat = createStandardMat(materials, 0xcccccc, 0.25, 0.8); // Metallic silver phone
  const screenMat = createEmissiveMat(materials, 0x88ccff, 0x5599ff, 1.4); // Blue backlit flip screen

  // 1. Torso (Baggy Zip-Up Hoodie)
  const torso = new THREE.Group();
  torso.position.set(0, 0.85, 0);

  addMesh(torso, new THREE.BoxGeometry(0.42, 0.5, 0.26), hoodieMat, [0, 0.25, 0], [0, 0, 0], geometries);
  // Zipper
  addMesh(torso, new THREE.BoxGeometry(0.02, 0.48, 0.01), silverMat, [0, 0.25, 0.135], [0, 0, 0], geometries);

  // 2. Head & Beanie
  const head = new THREE.Group();
  head.position.set(0, 0.6, 0);
  addMesh(head, new THREE.SphereGeometry(0.11, 10, 10), skinMat, [0, 0, 0], [0, 0, 0], geometries);
  // Slouchy knit beanie
  addMesh(head, new THREE.SphereGeometry(0.13, 10, 10), hoodieMat, [0, 0.05, -0.03], [0, 0, 0], geometries);
  accessories.push('beanie');
  torso.add(head);

  // 3. Arms + Signature Flip Phone
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.24, 0.44, 0);
  addMesh(leftArm, new THREE.CylinderGeometry(0.055, 0.045, 0.5, 8), hoodieMat, [0, -0.22, 0], [0, 0, 0], geometries);
  addMesh(leftArm, new THREE.SphereGeometry(0.04, 8, 8), skinMat, [0, -0.48, 0], [0, 0, 0], geometries);
  torso.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.24, 0.44, 0);
  addMesh(rightArm, new THREE.CylinderGeometry(0.055, 0.045, 0.5, 8), hoodieMat, [0, -0.22, 0], [0, 0, 0], geometries);
  addMesh(rightArm, new THREE.SphereGeometry(0.04, 8, 8), skinMat, [0, -0.48, 0], [0, 0, 0], geometries);

  // Flip Phone in Right Hand
  const flipPhone = new THREE.Group();
  flipPhone.position.set(0, -0.48, 0.08);
  // Lower keypad body
  addMesh(flipPhone, new THREE.BoxGeometry(0.045, 0.08, 0.015), silverMat, [0, 0, 0], [0, 0, 0], geometries);
  // Flipped open upper screen
  addMesh(flipPhone, new THREE.BoxGeometry(0.042, 0.07, 0.012), silverMat, [0, 0.06, 0.015], [-0.4, 0, 0], geometries);
  // Backlit screen
  addMesh(flipPhone, new THREE.BoxGeometry(0.035, 0.05, 0.005), screenMat, [0, 0.06, 0.022], [-0.4, 0, 0], geometries);

  rightArm.add(flipPhone);
  accessories.push('flip_phone');
  torso.add(rightArm);
  group.add(torso);

  // 4. Legs (Baggy Low-Rise Jeans)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.12, 0.85, 0);
  addMesh(leftLeg, new THREE.CylinderGeometry(0.075, 0.065, 0.75, 8), denimMat, [0, -0.38, 0], [0, 0, 0], geometries);
  addMesh(leftLeg, new THREE.BoxGeometry(0.12, 0.09, 0.24), shoeMat, [0, -0.76, 0.04], [0, 0, 0], geometries);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.12, 0.85, 0);
  addMesh(rightLeg, new THREE.CylinderGeometry(0.075, 0.065, 0.75, 8), denimMat, [0, -0.38, 0], [0, 0, 0], geometries);
  addMesh(rightLeg, new THREE.BoxGeometry(0.12, 0.09, 0.24), shoeMat, [0, -0.76, 0.04], [0, 0, 0], geometries);
  group.add(rightLeg);

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    torso,
    head,
    geometries,
    materials,
    accessories,
    hasPhone: true,
    phoneType: 'flip_phone',
  };
}

/**
 * 2025 Pedestrian: Modern athleisure, sleek puffers, joggers, leggings, wireless earbuds,
 * and signature smartphones!
 * Signature: **Smartphone** held in hand with glowing OLED screen.
 */
export function build2025Pedestrian(
  primaryColor: string,
  _variantIndex: number,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
  rng: Rng,
): PedestrianBuilderResult {
  const group = new THREE.Group();
  const accessories: string[] = [];
  const skinColor = rng.pick(SKIN_TONES);

  const pufferMat = createStandardMat(materials, primaryColor, 0.35, 0.2); // Matte performance puffer
  const athleisureMat = createStandardMat(materials, '#2b2d42', 0.8, 0.05); // Dark athletic joggers/leggings
  const skinMat = createStandardMat(materials, skinColor, 0.7, 0.0);
  const sneakerMat = createStandardMat(materials, 0xfafafa, 0.4, 0.1); // Crisp white sneakers
  const phoneBodyMat = createStandardMat(materials, 0x111116, 0.1, 0.9); // Titanium/glass slab
  const oledScreenMat = createEmissiveMat(materials, 0xffffff, 0x90caf9, 2.2); // Glowing OLED screen

  // 1. Torso (Matte Puffer Jacket / Performance Hoodie)
  const torso = new THREE.Group();
  torso.position.set(0, 0.85, 0);

  addMesh(torso, new THREE.BoxGeometry(0.4, 0.48, 0.25), pufferMat, [0, 0.24, 0], [0, 0, 0], geometries);
  // Puffer horizontal segments
  addMesh(torso, new THREE.BoxGeometry(0.405, 0.1, 0.255), pufferMat, [0, 0.32, 0], [0, 0, 0], geometries);
  addMesh(torso, new THREE.BoxGeometry(0.405, 0.1, 0.255), pufferMat, [0, 0.16, 0], [0, 0, 0], geometries);

  // 2. Head & Wireless Earbuds
  const head = new THREE.Group();
  head.position.set(0, 0.58, 0);
  addMesh(head, new THREE.SphereGeometry(0.11, 10, 10), skinMat, [0, 0, 0], [0, 0, 0], geometries);
  // Sleek modern haircut
  addMesh(head, new THREE.SphereGeometry(0.125, 10, 10), createStandardMat(materials, 0x221a14, 0.8, 0.05), [0, 0.04, -0.02], [0, 0, 0], geometries);

  // Tiny white wireless earbuds in both ears
  const earbudMat = createStandardMat(materials, 0xffffff, 0.2, 0.5);
  addMesh(head, new THREE.SphereGeometry(0.015, 6, 6), earbudMat, [-0.115, 0, 0.02], [0, 0, 0], geometries);
  addMesh(head, new THREE.SphereGeometry(0.015, 6, 6), earbudMat, [0.115, 0, 0.02], [0, 0, 0], geometries);
  accessories.push('wireless_earbuds');
  torso.add(head);

  // 3. Arms + Signature Smartphone
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.23, 0.42, 0);
  addMesh(leftArm, new THREE.CylinderGeometry(0.05, 0.042, 0.48, 8), pufferMat, [0, -0.22, 0], [0, 0, 0], geometries);
  addMesh(leftArm, new THREE.SphereGeometry(0.04, 8, 8), skinMat, [0, -0.46, 0], [0, 0, 0], geometries);
  torso.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.23, 0.42, 0);
  addMesh(rightArm, new THREE.CylinderGeometry(0.05, 0.042, 0.48, 8), pufferMat, [0, -0.22, 0], [0, 0, 0], geometries);
  addMesh(rightArm, new THREE.SphereGeometry(0.04, 8, 8), skinMat, [0, -0.46, 0], [0, 0, 0], geometries);

  // Smartphone in Right Hand
  const phone = new THREE.Group();
  phone.position.set(0, -0.46, 0.06);
  // Thin glass & metal chassis
  addMesh(phone, new THREE.BoxGeometry(0.042, 0.088, 0.008), phoneBodyMat, [0, 0, 0], [0.3, 0, 0], geometries);
  // Glowing OLED screen surface
  addMesh(phone, new THREE.BoxGeometry(0.038, 0.082, 0.002), oledScreenMat, [0, 0, 0.005], [0.3, 0, 0], geometries);

  rightArm.add(phone);
  accessories.push('smartphone');
  torso.add(rightArm);
  group.add(torso);

  // 4. Legs (Tapered Athleisure Joggers / Leggings)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.11, 0.85, 0);
  addMesh(leftLeg, new THREE.CylinderGeometry(0.06, 0.042, 0.75, 8), athleisureMat, [0, -0.38, 0], [0, 0, 0], geometries);
  addMesh(leftLeg, new THREE.BoxGeometry(0.1, 0.08, 0.22), sneakerMat, [0, -0.76, 0.04], [0, 0, 0], geometries);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.11, 0.85, 0);
  addMesh(rightLeg, new THREE.CylinderGeometry(0.06, 0.042, 0.75, 8), athleisureMat, [0, -0.38, 0], [0, 0, 0], geometries);
  addMesh(rightLeg, new THREE.BoxGeometry(0.1, 0.08, 0.22), sneakerMat, [0, -0.76, 0.04], [0, 0, 0], geometries);
  group.add(rightLeg);

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    torso,
    head,
    geometries,
    materials,
    accessories,
    hasPhone: true,
    phoneType: 'smartphone',
  };
}

// ============================================================================
// Crowd Factory
// ============================================================================

export function createEraCrowd(
  era: EraId,
  layout: BlockLayout,
  theme: EraTheme,
  options: CrowdOptions = {},
  rng: Rng,
): {
  pedestrians: PedestrianInstance[];
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
} {
  const pedestrians: PedestrianInstance[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const segments = layout.pedestrianNetwork.segments;
  const outfitColors = theme.pedestrians.outfitColors.length > 0
    ? theme.pedestrians.outfitColors
    : ['#4a453b', '#5c5446', '#3b4044', '#665948'];

  const count = options.count ?? Math.min(12, segments.length);
  let pedCounter = 1;

  for (let i = 0; i < count; i += 1) {
    const segment = segments[i % segments.length]!;
    const color = outfitColors[i % outfitColors.length]!;
    const speed = rng.range(theme.pedestrians.walkSpeedRange[0], theme.pedestrians.walkSpeedRange[1]);
    const startDist = rng.range(1, Math.max(2, segment.length - 1));
    const direction: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const lateralOffset = rng.range(-1.0, 1.0); // Lateral offset within sidewalk width (4m)

    let buildResult: PedestrianBuilderResult;
    let outfitStyle: OutfitStyle;
    const tags: string[] = [String(era)];

    switch (era) {
      case 1945:
        outfitStyle = 'wartime_coats';
        tags.push('wartime_coats', 'vintage_coat', 'no_phones');
        buildResult = build1945Pedestrian(color, i, materials, geometries, rng);
        break;
      case 1965:
        outfitStyle = 'mod_tailoring';
        tags.push('mod_tailoring', 'tonic_suit', 'mod_dress', 'no_phones');
        buildResult = build1965Pedestrian(color, i, materials, geometries, rng);
        break;
      case 1985:
        outfitStyle = 'neon_80s';
        tags.push('neon_80s', 'windbreaker', 'neon', 'headphones', 'no_phones');
        buildResult = build1985Pedestrian(color, i, materials, geometries, rng);
        break;
      case 2005:
        outfitStyle = 'y2k_denim';
        tags.push('y2k_denim', 'baggy_jeans', 'hoodie', 'flip_phone');
        buildResult = build2005Pedestrian(color, i, materials, geometries, rng);
        break;
      case 2025:
      default:
        outfitStyle = 'athleisure';
        tags.push('athleisure', 'joggers', 'puffer', 'smartphone', 'wireless_earbuds');
        buildResult = build2025Pedestrian(color, i, materials, geometries, rng);
        break;
    }

    pedestrians.push({
      id: `pedestrian-${era}-${pedCounter++}`,
      era,
      outfitStyle,
      tags,
      mesh: buildResult.group,
      segmentId: segment.id,
      waypoints: segment.waypoints,
      segmentLength: segment.length,
      distance: startDist,
      speed,
      direction,
      walkPhase: rng.range(0, Math.PI * 2),
      lateralOffset,
      baseHeight: layout.dimensions.curbHeight,
      leftLeg: buildResult.leftLeg,
      rightLeg: buildResult.rightLeg,
      leftArm: buildResult.leftArm,
      rightArm: buildResult.rightArm,
      torso: buildResult.torso,
      head: buildResult.head,
      accessories: buildResult.accessories,
      hasPhone: buildResult.hasPhone,
      phoneType: buildResult.phoneType,
    });
  }

  return { pedestrians, geometries, materials };
}

// ============================================================================
// Frame-Rate Independent Walkway Animation & Walk Cycles
// ============================================================================

/**
 * Sample position and forward heading vector along a sequence of 3D waypoints.
 */
function sampleWalkwayPath(
  waypoints: readonly Point3D[],
  totalLength: number,
  t: number,
): { pos: Point3D; dir: Point3D } {
  if (waypoints.length < 2) {
    const p = waypoints[0] ?? { x: 0, y: 0, z: 0 };
    return { pos: p, dir: { x: 1, y: 0, z: 0 } };
  }

  const targetDist = t * totalLength;
  let accumulated = 0;

  for (let i = 1; i < waypoints.length; i += 1) {
    const p0 = waypoints[i - 1]!;
    const p1 = waypoints[i]!;
    const segDist = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);

    if (accumulated + segDist >= targetDist || i === waypoints.length - 1) {
      const segT = segDist > 0 ? (targetDist - accumulated) / segDist : 0;
      const clampedT = Math.max(0, Math.min(1, segT));

      const dx = segDist > 0 ? (p1.x - p0.x) / segDist : 1;
      const dy = segDist > 0 ? (p1.y - p0.y) / segDist : 0;
      const dz = segDist > 0 ? (p1.z - p0.z) / segDist : 0;

      return {
        pos: {
          x: p0.x + (p1.x - p0.x) * clampedT,
          y: p0.y + (p1.y - p0.y) * clampedT,
          z: p0.z + (p1.z - p0.z) * clampedT,
        },
        dir: { x: dx, y: dy, z: dz },
      };
    }
    accumulated += segDist;
  }

  const last = waypoints[waypoints.length - 1]!;
  return { pos: last, dir: { x: 1, y: 0, z: 0 } };
}

export function updatePedestrians(
  pedestrians: PedestrianInstance[],
  dt: number,
  layout: BlockLayout,
): void {
  for (const p of pedestrians) {
    const segLen = Math.max(1, p.segmentLength);

    // 1. Advance distance along walkway segment
    p.distance += p.speed * p.direction * dt;
    if (p.distance >= segLen) {
      p.distance = segLen;
      p.direction = -1;
    } else if (p.distance <= 0) {
      p.distance = 0;
      p.direction = 1;
    }

    // 2. Advance walk cycle phase (radians)
    p.walkPhase += (p.speed / 0.6) * dt * Math.PI * 2;

    // 3. Sample walkway path position & heading
    const normT = Math.max(0, Math.min(1, p.distance / segLen));
    const sample = sampleWalkwayPath(p.waypoints, segLen, normT);

    const fwdX = sample.dir.x * p.direction;
    const fwdZ = sample.dir.z * p.direction;
    const yaw = Math.atan2(fwdX, fwdZ);

    // Lateral normal vector (perpendicular to travel)
    const normX = -fwdZ;
    const normZ = fwdX;

    const posX = sample.pos.x + normX * p.lateralOffset;
    const posZ = sample.pos.z + normZ * p.lateralOffset;
    const posY = sample.pos.y > 0 ? sample.pos.y : layout.dimensions.curbHeight;

    p.mesh.position.set(posX, posY, posZ);
    p.mesh.rotation.y = yaw;

    // 4. Walk Cycle Limbs Kinematics
    const swingAngle = Math.sin(p.walkPhase) * 0.45;
    p.leftLeg.rotation.x = swingAngle;
    p.rightLeg.rotation.x = -swingAngle;

    if (p.hasPhone) {
      // Raised arm posture holding phone in front of face
      p.rightArm.rotation.x = -1.15;
      p.rightArm.rotation.y = -0.25;
      p.rightArm.rotation.z = 0.15;
      // Other arm swings naturally
      p.leftArm.rotation.x = -swingAngle * 0.8;
      p.leftArm.rotation.y = 0;
      p.leftArm.rotation.z = 0;
    } else {
      // Natural inverse arm swing
      p.leftArm.rotation.x = -swingAngle * 0.8;
      p.rightArm.rotation.x = swingAngle * 0.8;
      p.leftArm.rotation.y = 0;
      p.rightArm.rotation.y = 0;
      p.leftArm.rotation.z = 0;
      p.rightArm.rotation.z = 0;
    }

    // Vertical Torso Bobbing
    p.torso.position.y = 0.85 + Math.abs(Math.sin(p.walkPhase)) * 0.03;
  }
}
