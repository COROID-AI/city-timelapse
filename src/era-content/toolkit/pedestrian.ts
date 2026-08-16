import * as THREE from 'three';

// ── Parametric interfaces ──────────────────────────────────────────

export interface PedestrianParams {
  /** Outfit set type */
  outfit?: OutfitSet;
  /** Height scale (0.8-1.2) */
  heightScale?: number;
  /** Skin tone hex */
  skinTone?: number;
  /** Era-appropriate color palette overrides */
  palette?: Record<string, number>;
  /** Walk cycle phase speed (radians/sec) */
  walkSpeed?: number;
  /** Whether to animate walk cycle */
  animated?: boolean;
  /** Hat style override */
  hatStyle?: HatStyle | false;
  /** Accessory types */
  accessories?: AccessoryType[];
  /** Condition factor (affects fabric wear colors) */
  condition?: number;
}

export type OutfitSet =
  | 'worker'
  | 'business_suit'
  | 'casual_jeans'
  | 'downtown_evening'
  | 'school_child'
  | 'vintage_formal'
  | 'street_urban';

export type HatStyle = 'fedora' | 'cap' | 'beret' | 'top_hat' | 'beanie' | 'sun_hat' | false;

export type AccessoryType = 'umbrella' | 'briefcase' | 'newspaper' | 'bag' | 'phone' | 'cane' | 'camera';

export interface PedestrianResult {
  group: THREE.Group;
  dispose(): void;
  /** Update walk cycle animation */
  updateWalk(dt: number): void;
  get walkPhase(): number;
}

// ── Helpers ────────────────────────────────────────────────────────

function makeBox(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  return new THREE.Mesh(geo, mat);
}

function makeCylinder(rT: number, rB: number, h: number, seg: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(rT, rB, h, seg);
  return new THREE.Mesh(geo, mat);
}

function hexMat(hex: number, roughness = 0.7, metalness = 0.0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness,
    metalness,
  });
}

// ── Default palettes per outfit ────────────────────────────────────

const DEFAULT_PALETTES: Record<OutfitSet, { top: number; bottom: number; shoes: number; accent: number }> = {
  worker: { top: 0x4A6FA5, bottom: 0x3B3B3B, shoes: 0x2A1A0A, accent: 0xCC7722 },
  business_suit: { top: 0x1A1A2E, bottom: 0x1A1A2E, shoes: 0x111111, accent: 0xCC3333 },
  casual_jeans: { top: 0x556B2F, bottom: 0x334466, shoes: 0x222222, accent: 0xFFDD44 },
  downtown_evening: { top: 0x2C1810, bottom: 0x1A1A1A, shoes: 0x0A0A0A, accent: 0x9966CC },
  school_child: { top: 0xE8E8E8, bottom: 0x3344AA, shoes: 0x222222, accent: 0xFF6644 },
  vintage_formal: { top: 0x3D2B1F, bottom: 0x2F1B14, shoes: 0x1A0F0A, accent: 0xDDAA77 },
  street_urban: { top: 0x444444, bottom: 0x333333, shoes: 0x111111, accent: 0x00FF88 },
};

// ── Body part construction ─────────────────────────────────────────

interface BodyParts {
  head: THREE.Group;
  torso: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  // pivot points for animation
  leftShoulderPivot: THREE.Group;
  rightShoulderPivot: THREE.Group;
  leftHipPivot: THREE.Group;
  rightHipPivot: THREE.Group;
}

/** Build a low-poly humanoid body from primitive parts. */
function buildBody(params: PedestrianParams): BodyParts {
  const s = params.heightScale ?? 1;
  const skinColor = params.skinTone ?? 0xD4A574;
  const paletteKey = params.outfit ?? 'worker';
  const palette = { ...DEFAULT_PALETTES[paletteKey], ...params.palette };

  const skinMat = hexMat(skinColor, 0.8);
  const topMat = hexMat(palette.top, 0.75);
  const bottomMat = hexMat(palette.bottom, 0.75);
  const shoeMat = hexMat(palette.shoes, 0.6, 0.1);
  const accentMat = hexMat(palette.accent, 0.6, 0.2);

  // ── Head ─────────────────────────────────────────────────────
  const head = new THREE.Group();
  head.name = 'head';
  const headMesh = makeBox(0.28 * s, 0.32 * s, 0.28 * s, skinMat);
  head.add(headMesh);

  // Eyes
  for (const side of [-1, 1]) {
    const eye = makeBox(0.05 * s, 0.04 * s, 0.02, hexMat(0x111111));
    eye.position.set(side * 0.07 * s, 0.04 * s, 0.15 * s);
    head.add(eye);
  }

  // ── Torso ────────────────────────────────────────────────────
  const torso = new THREE.Group();
  torso.name = 'torso';
  const torsoMesh = makeBox(0.44 * s, 0.55 * s, 0.24 * s, topMat);
  torso.add(torsoMesh);

  // Collar/neckline accent
  const collar = makeBox(0.18 * s, 0.06 * s, 0.25 * s, accentMat);
  collar.position.y = 0.25 * s;
  torso.add(collar);

  // ── Arms ─────────────────────────────────────────────────────
  const leftArm = new THREE.Group();
  leftArm.name = 'left_arm';
  const upperArm = makeBox(0.1 * s, 0.3 * s, 0.1 * s, topMat);
  upperArm.position.y = -0.15 * s;
  leftArm.add(upperArm);
  const lowerArm = makeBox(0.09 * s, 0.28 * s, 0.09 * s, skinMat);
  lowerArm.position.y = -0.43 * s;
  leftArm.add(lowerArm);
  // Hand
  const handGeo = new THREE.SphereGeometry(0.05 * s, 6, 6);
  const leftHand = new THREE.Mesh(handGeo, skinMat);
  leftHand.position.y = -0.42 * s;
  leftArm.add(leftHand);

  const rightArm = leftArm.clone();
  rightArm.name = 'right_arm';

  // ── Legs ─────────────────────────────────────────────────────
  const leftLeg = new THREE.Group();
  leftLeg.name = 'left_leg';
  const upperLeg = makeBox(0.14 * s, 0.38 * s, 0.14 * s, bottomMat);
  upperLeg.position.y = -0.19 * s;
  leftLeg.add(upperLeg);
  const lowerLeg = makeBox(0.12 * s, 0.36 * s, 0.12 * s, bottomMat);
  lowerLeg.position.y = -0.56 * s;
  leftLeg.add(lowerLeg);
  // Shoe
  const shoe = makeBox(0.13 * s, 0.08 * s, 0.22 * s, shoeMat);
  shoe.position.set(0, -0.78 * s, 0.04 * s);
  leftLeg.add(shoe);

  const rightLeg = leftLeg.clone();
  rightLeg.name = 'right_leg';

  // ── Pivot groups ─────────────────────────────────────────────
  const leftShoulderPivot = new THREE.Group();
  leftShoulderPivot.name = 'left_shoulder_pivot';
  leftShoulderPivot.position.set(-0.28 * s, 0.22 * s, 0);
  leftShoulderPivot.add(leftArm);

  const rightShoulderPivot = new THREE.Group();
  rightShoulderPivot.name = 'right_shoulder_pivot';
  rightShoulderPivot.position.set(0.28 * s, 0.22 * s, 0);
  rightShoulderPivot.add(rightArm);

  const leftHipPivot = new THREE.Group();
  leftHipPivot.name = 'left_hip_pivot';
  leftHipPivot.position.set(-0.1 * s, -0.28 * s, 0);
  leftHipPivot.add(leftLeg);

  const rightHipPivot = new THREE.Group();
  rightHipPivot.name = 'right_hip_pivot';
  rightHipPivot.position.set(0.1 * s, -0.28 * s, 0);
  rightHipPivot.add(rightLeg);

  // Assemble into parent group
  const root = new THREE.Group();
  root.name = 'pedestrian';
  root.add(head);
  root.add(torso);
  root.add(leftShoulderPivot);
  root.add(rightShoulderPivot);
  root.add(leftHipPivot);
  root.add(rightHipPivot);

  // Store references for animation
  (root as any)._walkPhase = 0;
  (root as any)._parts = { leftShoulderPivot, rightShoulderPivot, leftHipPivot, rightHipPivot };

  // ── Add optional extras ──────────────────────────────────────
  addExtras(root, params, s);

  return {
    head,
    torso,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftShoulderPivot,
    rightShoulderPivot,
    leftHipPivot,
    rightHipPivot,
  };
}

/** Add accessories and hats based on params. */
function addExtras(root: THREE.Group, params: PedestrianParams, s: number): void {
  const paletteKey = params.outfit ?? 'worker';
  const palette = { ...DEFAULT_PALETTES[paletteKey], ...params.palette };
  const accentMat = hexMat(palette.accent, 0.6, 0.2);
  const shoeMat = hexMat(palette.shoes, 0.6, 0.1);

  // Hat
  if (params.hatStyle) {
    switch (params.hatStyle) {
      case 'fedora': {
        const crown = makeBox(0.24 * s, 0.18 * s, 0.24 * s, accentMat);
        crown.position.y = 0.25 * s;
        root.add(crown);
        const brim = makeCylinder(0.2 * s, 0.2 * s, 0.02 * s, 12, accentMat);
        brim.rotation.x = Math.PI / 2;
        brim.position.y = 0.17 * s;
        root.add(brim);
        break;
      }
      case 'cap': {
        const capTop = makeBox(0.26 * s, 0.08 * s, 0.22 * s, accentMat);
        capTop.position.set(0, 0.22 * s, 0.02 * s);
        root.add(capTop);
        const visor = makeBox(0.12 * s, 0.02 * s, 0.1 * s, accentMat);
        visor.position.set(0, 0.2 * s, 0.16 * s);
        root.add(visor);
        break;
      }
      case 'top_hat': {
        const hatBody = makeCylinder(0.1 * s, 0.1 * s, 0.35 * s, 12, accentMat);
        hatBody.position.y = 0.38 * s;
        root.add(hatBody);
        const hatBand = makeCylinder(0.11 * s, 0.11 * s, 0.04 * s, 12, hexMat(0x111111));
        hatBand.position.y = 0.22 * s;
        root.add(hatBand);
        break;
      }
      case 'beret': {
        const beretGeo = new THREE.SphereGeometry(0.16 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const beret = new THREE.Mesh(beretGeo, accentMat);
        beret.position.set(0.04 * s, 0.2 * s, 0.02 * s);
        beret.rotation.z = -0.2;
        root.add(beret);
        break;
      }
      case 'beanie': {
        const beanieGeo = new THREE.SphereGeometry(0.17 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
        const beanie = new THREE.Mesh(beanieGeo, accentMat);
        beanie.position.y = 0.2 * s;
        root.add(beanie);
        break;
      }
      case 'sun_hat': {
        const crownS = makeCylinder(0.08 * s, 0.1 * s, 0.15 * s, 10, accentMat);
        crownS.position.y = 0.25 * s;
        root.add(crownS);
        const brimS = makeCylinder(0.25 * s, 0.25 * s, 0.015 * s, 16, accentMat);
        brimS.position.y = 0.18 * s;
        root.add(brimS);
        break;
      }
    }
  }

  // Accessories
  if (!params.accessories) return;
  for (const acc of params.accessories) {
    switch (acc) {
      case 'briefcase': {
        const bc = makeBox(0.22 * s, 0.16 * s, 0.12 * s, shoeMat);
        bc.position.set(0.32 * s, -0.1 * s, 0.12 * s);
        root.add(bc);
        const handle = makeCylinder(0.015 * s, 0.015 * s, 0.08 * s, 6, shoeMat);
        handle.position.set(0.32 * s, 0.02 * s, 0.12 * s);
        root.add(handle);
        break;
      }
      case 'newspaper': {
        const paper = makeBox(0.2 * s, 0.01 * s, 0.18 * s, hexMat(0xEEEEEE));
        paper.position.set(0.3 * s, -0.05 * s, 0.15 * s);
        root.add(paper);
        break;
      }
      case 'bag': {
        const bag = makeBox(0.2 * s, 0.25 * s, 0.12 * s, accentMat);
        bag.position.set(-0.3 * s, -0.05 * s, 0.1 * s);
        root.add(bag);
        const strap = makeCylinder(0.012 * s, 0.012 * s, 0.35 * s, 6, shoeMat);
        strap.position.set(-0.3 * s, 0.1 * s, 0.1 * s);
        root.add(strap);
        break;
      }
      case 'phone': {
        const phone = makeBox(0.06 * s, 0.12 * s, 0.01 * s, hexMat(0x222222, 0.2, 0.5));
        phone.position.set(0.3 * s, -0.15 * s, 0.15 * s);
        phone.rotation.x = 0.1;
        root.add(phone);
        break;
      }
      case 'cane': {
        const cane = makeCylinder(0.015 * s, 0.02 * s, 0.9 * s, 6, shoeMat);
        cane.position.set(0.35 * s, -0.35 * s, 0.1 * s);
        cane.rotation.z = 0.05;
        root.add(cane);
        const caneHead = makeCylinder(0.03 * s, 0.03 * s, 0.04 * s, 8, shoeMat);
        caneHead.position.set(0.35 * s, 0.1 * s, 0.1 * s);
        root.add(caneHead);
        break;
      }
      case 'umbrella': {
        const shaft = makeCylinder(0.012 * s, 0.012 * s, 0.8 * s, 6, shoeMat);
        shaft.position.set(-0.3 * s, 0.1 * s, 0.1 * s);
        root.add(shaft);
        const canopyGeo = new THREE.SphereGeometry(0.25 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        const canopy = new THREE.Mesh(canopyGeo, accentMat);
        canopy.position.set(-0.3 * s, 0.5 * s, 0.1 * s);
        root.add(canopy);
        break;
      }
      case 'camera': {
        const camBody = makeBox(0.14 * s, 0.09 * s, 0.06 * s, hexMat(0x333333, 0.3, 0.4));
        camBody.position.set(0.3 * s, -0.05 * s, 0.18 * s);
        root.add(camBody);
        const lens = makeCylinder(0.035 * s, 0.035 * s, 0.04 * s, 10, hexMat(0x111111, 0.1, 0.6));
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0.3 * s, -0.05 * s, 0.22 * s);
        root.add(lens);
        break;
      }
    }
  }
}

// ── Walk cycle ─────────────────────────────────────────────────────

/**
 * Animate the walk cycle on a pedestrian group.
 * Uses sine-based limb oscillation around hip/shoulder pivots.
 */
function animateWalkCycle(root: THREE.Group, dt: number, speed: number): void {
  const phase = ((root as any)._walkPhase ?? 0) + dt * speed;
  (root as any)._walkPhase = phase;

  const parts = (root as any)._parts as {
    leftShoulderPivot: THREE.Group;
    rightShoulderPivot: THREE.Group;
    leftHipPivot: THREE.Group;
    rightHipPivot: THREE.Group;
  };

  if (!parts) return;

  const swing = Math.sin(phase);
  const armSwing = 0.4;
  const legSwing = 0.5;

  // Arms swing opposite to legs
  parts.leftShoulderPivot.rotation.x = -armSwing * swing;
  parts.rightShoulderPivot.rotation.x = armSwing * swing;

  // Legs swing alternating
  parts.leftHipPivot.rotation.x = legSwing * swing;
  parts.rightHipPivot.rotation.x = -legSwing * swing;

  // Slight body bob
  root.position.y = Math.abs(Math.sin(phase * 2)) * 0.02;
}

// ── Main entry point ───────────────────────────────────────────────

/**
 * Generate a parametric low-poly pedestrian.
 * Returns a group with walk-cycle animation capability.
 */
export function generatePedestrian(params: PedestrianParams): PedestrianResult {
  const {
    outfit = 'worker',
    heightScale = 1,
    skinTone,
    palette,
    walkSpeed = 3,
    animated = true,
    hatStyle,
    accessories = [],
    condition = 0.7,
  } = params;

  const group = new THREE.Group();
  group.name = `pedestrian_${outfit}`;

  const bodyParts = buildBody({
    outfit,
    heightScale,
    skinTone,
    palette,
    walkSpeed,
    animated,
    hatStyle,
    accessories,
    condition,
  });

  // Attach body parts to group
  group.add(bodyParts.head);
  group.add(bodyParts.torso);
  group.add(bodyParts.leftShoulderPivot);
  group.add(bodyParts.rightShoulderPivot);
  group.add(bodyParts.leftHipPivot);
  group.add(bodyParts.rightHipPivot);

  const walkPhase = () => (group as any)._walkPhase ?? 0;

  return {
    group,
    dispose() {
      group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose();
          const m = (obj as THREE.Mesh).material;
          if (Array.isArray(m)) {
            for (const mat of m) mat.dispose();
          } else if (m) {
            m.dispose();
          }
        }
      });
    },
    updateWalk(dt: number) {
      animateWalkCycle(group, dt, walkSpeed);
    },
    get walkPhase() {
      return walkPhase();
    },
  };
}
