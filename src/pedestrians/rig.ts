import * as THREE from 'three';

// ── Pedestrian rig: articulated low-poly human ────────────────────────
// Each body part is a separate mesh so we can animate joints independently.
// Walk cycle uses deterministic sine-wave joint rotation driven by elapsed time.

export interface PedestrianParts {
  /** Root group holding all parts */
  root: THREE.Group;
  /** Torso (body core) */
  torso: THREE.Mesh;
  /** Head */
  head: THREE.Mesh;
  /** Left upper arm + forearm combined */
  leftArm: THREE.Group;
  /** Right upper arm + forearm combined */
  rightArm: THREE.Group;
  /** Left leg pivot point */
  leftLeg: THREE.Group;
  /** Right leg pivot point */
  rightLeg: THREE.Group;
}

/** Build an articulated pedestrian skeleton ready for outfit attachment */
export function buildPedestrianRig(): PedestrianParts {
  const root = new THREE.Group();
  root.name = 'pedestrian_rig';

  // ── Body proportions (meters, adult-scale) ────────────────────────
  const headRadius = 0.18;
  const torsoHeight = 0.6;
  const torsoWidth = 0.32;
  const torsoDepth = 0.2;
  const upperArmLength = 0.3;
  const forearmLength = 0.28;
  const upperLegLength = 0.45;
  const lowerLegLength = 0.42;
  const footLength = 0.18;
  const footWidth = 0.09;

  // ── Torso ─────────────────────────────────────────────────────────
  const torsoGeo = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth);
  const torso = new THREE.Mesh(torsoGeo, new THREE.MeshStandardMaterial({ color: 0x888888 }));
  torso.position.y = 0.85; // hips at y=0.55, torso center higher
  torso.castShadow = true;
  torso.name = 'torso';
  root.add(torso);

  // ── Head ──────────────────────────────────────────────────────────
  const headGeo = new THREE.SphereGeometry(headRadius, 8, 6);
  const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xffccaa }));
  head.position.y = 0.85 + torsoHeight / 2 + headRadius + 0.02;
  head.castShadow = true;
  head.name = 'head';
  root.add(head);

  // ── Arms ──────────────────────────────────────────────────────────
  const armMat = new THREE.MeshStandardMaterial({ color: 0x888888 });

  // Left arm — pivot at shoulder
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-torsoWidth / 2 - 0.02, 0.85 + torsoHeight / 2 - 0.05, 0);
  leftArmPivot.name = 'left_arm_pivot';

  const leftUpperArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, upperArmLength, 0.1),
    armMat,
  );
  leftUpperArm.position.y = -upperArmLength / 2;
  leftUpperArm.castShadow = true;
  leftArmPivot.add(leftUpperArm);

  const leftForearm = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, forearmLength, 0.09),
    armMat,
  );
  leftForearm.position.y = -upperArmLength - forearmLength / 2;
  leftForearm.castShadow = true;
  leftArmPivot.add(leftForearm);

  root.add(leftArmPivot);

  // Right arm — pivot at shoulder
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(torsoWidth / 2 + 0.02, 0.85 + torsoHeight / 2 - 0.05, 0);
  rightArmPivot.name = 'right_arm_pivot';

  const rightUpperArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, upperArmLength, 0.1),
    armMat,
  );
  rightUpperArm.position.y = -upperArmLength / 2;
  rightUpperArm.castShadow = true;
  rightArmPivot.add(rightUpperArm);

  const rightForearm = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, forearmLength, 0.09),
    armMat,
  );
  rightForearm.position.y = -upperArmLength - forearmLength / 2;
  rightForearm.castShadow = true;
  rightArmPivot.add(rightForearm);

  root.add(rightArmPivot);

  // ── Legs ──────────────────────────────────────────────────────────
  const legMat = new THREE.MeshStandardMaterial({ color: 0x555577 });

  // Left leg — pivot at hip
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.08, 0.55, 0); // hip position
  leftLegPivot.name = 'left_leg_pivot';

  const leftUpperLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, upperLegLength, 0.13),
    legMat,
  );
  leftUpperLeg.position.y = -upperLegLength / 2;
  leftUpperLeg.castShadow = true;
  leftLegPivot.add(leftUpperLeg);

  const leftLowerLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, lowerLegLength, 0.11),
    legMat,
  );
  leftLowerLeg.position.y = -upperLegLength - lowerLegLength / 2;
  leftLowerLeg.castShadow = true;
  leftLegPivot.add(leftLowerLeg);

  // Foot
  const leftFoot = new THREE.Mesh(
    new THREE.BoxGeometry(footWidth, 0.06, footLength),
    new THREE.MeshStandardMaterial({ color: 0x333333 }),
  );
  leftFoot.position.set(0, -upperLegLength - lowerLegLength - 0.03, footLength / 2 - 0.02);
  leftFoot.castShadow = true;
  leftLegPivot.add(leftFoot);

  root.add(leftLegPivot);

  // Right leg — pivot at hip
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.08, 0.55, 0);
  rightLegPivot.name = 'right_leg_pivot';

  const rightUpperLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, upperLegLength, 0.13),
    legMat,
  );
  rightUpperLeg.position.y = -upperLegLength / 2;
  rightUpperLeg.castShadow = true;
  rightLegPivot.add(rightUpperLeg);

  const rightLowerLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, lowerLegLength, 0.11),
    legMat,
  );
  rightLowerLeg.position.y = -upperLegLength - lowerLegLength / 2;
  rightLowerLeg.castShadow = true;
  rightLegPivot.add(rightLowerLeg);

  const rightFoot = new THREE.Mesh(
    new THREE.BoxGeometry(footWidth, 0.06, footLength),
    new THREE.MeshStandardMaterial({ color: 0x333333 }),
  );
  rightFoot.position.set(0, -upperLegLength - lowerLegLength - 0.03, footLength / 2 - 0.02);
  rightFoot.castShadow = true;
  rightLegPivot.add(rightFoot);

  root.add(rightLegPivot);

  return { root, torso, head, leftArm: leftArmPivot, rightArm: rightArmPivot, leftLeg: leftLegPivot, rightLeg: rightLegPivot };
}

// ── Deterministic walk-cycle animation ────────────────────────────────

/**
 * Apply a deterministic, time-based walk cycle to a pedestrain rig.
 * @param parts   The articulated parts returned by buildPedestrianRig()
 * @param t       Elapsed time in seconds (monotonically increasing)
 * @param speed   Walking speed multiplier (1.0 = normal pace)
 */
export function animateWalkCycle(parts: PedestrianParts, t: number, speed: number): void {
  const cycleSpeed = 3.0 * speed; // full stride cycles per second at speed=1
  const angle = t * cycleSpeed;

  // Leg swing: ±30° alternating
  const legAmplitude = Math.PI / 6; // ~30 degrees
  const leftAngle = Math.sin(angle) * legAmplitude;
  const rightAngle = Math.sin(angle + Math.PI) * legAmplitude;

  parts.leftLeg.rotation.x = leftAngle;
  parts.rightLeg.rotation.x = rightAngle;

  // Arm swing: opposite phase to legs (natural gait)
  parts.leftArm.rotation.x = -rightAngle * 0.8;
  parts.rightArm.rotation.x = -leftAngle * 0.8;

  // Slight torso bob up/down
  parts.root.position.y = Math.abs(Math.sin(angle)) * 0.015;

  // Subtle torso sway side-to-side
  parts.torso.rotation.z = Math.sin(angle * 0.5) * 0.02;
}

/** Reset all joints to zero pose */
export function resetPose(parts: PedestrianParts): void {
  parts.leftLeg.rotation.x = 0;
  parts.rightLeg.rotation.x = 0;
  parts.leftArm.rotation.x = 0;
  parts.rightArm.rotation.x = 0;
  parts.root.position.y = 0;
  parts.torso.rotation.z = 0;
}
