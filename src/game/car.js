// Car mesh factory + arcade CarPhysics model. Physics depends only on plain
// config numbers; the mesh is synced separately so it stays unit-testable and
// GPU independent.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createExhaustFlames } from './effects.js';

/** Build a stylized low-poly neon car mesh as a Group. */
export function createCarMesh(color = 0xff3355) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x17171f, roughness: 0.5, metalness: 0.6 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.0), darkMat);
  cabin.position.y = 1.05;
  cabin.position.z = -0.2;
  group.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.9 });
  const wheelPositions = [
    [0.95, 0.38, 1.5],
    [-0.95, 0.38, 1.5],
    [0.95, 0.38, -1.5],
    [-0.95, 0.38, -1.5],
  ];
  group.userData.wheels = [];
  for (const [x, y, z] of wheelPositions) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, y, z);
    group.add(w);
    group.userData.wheels.push(w);
  }

  // Head/tail lights (emissive).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2238, toneMapped: false });
  group.userData.heads = [];
  group.userData.tails = [];
  for (const side of [1, -1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.2), headMat);
    h.position.set(side * 0.65, 0.62, 2.2);
    group.add(h);
    group.userData.heads.push(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.2), tailMat);
    t.position.set(side * 0.65, 0.75, -2.2);
    group.add(t);
    group.userData.tails.push(t);
  }

  // Underglow.
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.1, 4.2),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  glow.position.y = 0.12;
  group.add(glow);

  createExhaustFlames(group);

  group.userData.bodyMat = bodyMat;
  return group;
}

export class CarPhysics {
  constructor(opts = {}) {
    const c = CONFIG.car;
    this.accel = c.accel;
    this.reverseAccel = c.reverseAccel;
    this.topSpeed = c.topSpeed;
    this.reverseTopSpeed = c.reverseTopSpeed;
    this.brakeDecel = c.brakeDecel;
    this.grip = c.grip;
    this.steerRate = c.steerRate;
    this.steerSpeedFactor = c.steerSpeedFactor;
    this.handbrakeSlip = c.handbrakeSlip;
    this.drag = c.drag;
    this.idleFriction = c.idleFriction;
    this.width = 2.2;
    this.length = 4.6;

    // State
    this.position = new THREE.Vector3(0, 0, 0);
    this.heading = 0; // radians, 0 = +Z
    this.speed = 0; // signed forward speed
    this.lateralSlip = 0; // sideways velocity magnitude for drift/nitrous charge
    this.steerSmoothed = 0;
    this.isDrifting = false;
    this.boostMult = 1;
  }

  teleport(x, z, heading) {
    this.position.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steerSmoothed = 0;
  }

  /**
   * Advance one physics step using normalized inputs.
   * Inputs: { throttle:0|1, brake:0|1, steer:-1..1, handbrake:bool, nitroRequested:bool, boostMult }
   */
  update(dt, input) {
    const boost = input.boostMult ?? 1;
    this.boostMult = boost;
    const c = this;

    // Longitudinal.
    if (input.throttle) {
      const maxSpeed = c.topSpeed * (boost > 1 ? CONFIG.nitrous.boostTopSpeedMult : 1);
      c.speed += c.accel * (boost > 1 ? CONFIG.nitrous.boostAccelMult : 1) * dt;
      if (c.speed > maxSpeed) c.speed = maxSpeed;
    }
    if (input.brake) {
      if (c.speed > 0.5) {
        c.speed -= c.brakeDecel * dt;
        if (c.speed < 0) c.speed = 0;
      } else if (c.speed > -c.reverseTopSpeed) {
        c.speed -= c.reverseAccel * dt;
        if (c.speed < -c.reverseTopSpeed) c.speed = -c.reverseTopSpeed;
      }
    }
    // Drag / idle friction.
    if (!input.throttle && !input.brake) {
      c.speed *= Math.max(0, 1 - c.idleFriction * dt);
    }
    c.speed *= Math.max(0, 1 - c.drag * dt);

    // Steering: smoothed, speed-sensitive authority.
    c.steerSmoothed += (input.steer - c.steerSmoothed) * Math.min(1, 8 * dt);
    const speedFactor = c.steerSpeedFactor * (Math.abs(c.speed) / Math.max(20, c.topSpeed));
    const turn = c.steerSmoothed * c.steerRate * (1 + speedFactor) * dt;
    c.heading += turn;

    // Position advance along heading (signed by speed).
    c.position.x += Math.sin(c.heading) * c.speed * dt;
    c.position.z += Math.cos(c.heading) * c.speed * dt;

    // Lateral slip: sideways motion when the car is turning at speed, sharply
    // amplified by the handbrake — this is what feeds the drift -> nitrous meter.
    let slip = Math.abs(c.speed) * dt * Math.min(0.5, c.steerSmoothed * c.steerRate * 0.08);
    if (input.handbrake) {
      slip = Math.abs(c.speed) * dt * (1 + c.handbrakeSlip * 6);
    }
    // Grip physically clamps slip to keep the car on the road.
    slip = Math.min(slip, Math.abs(c.speed) * c.grip * dt + 0.05);
    c.lateralSlip = slip;
    c.isDrifting = slip > 0.03 * Math.abs(c.speed) * dt;

    return { dt, slip };
  }
}

export function syncCarMesh(mesh, physics) {
  mesh.position.copy(physics.position);
  mesh.position.y = 0.55;
  mesh.rotation.y = physics.heading;
  for (const w of mesh.userData.wheels || []) {
    w.rotation.z += Math.max(0, physics.speed) * 0.1;
  }
}