// Third-person chase camera: smooth spring/lerp follow behind and above the
// player car, look-ahead target, speed-based FOV widening, an extra wide-angle
// kick during nitrous, and subtle shake while boosting.

import { CONFIG } from './config.js';

export class ChaseCamera {
  constructor(camera, carPhysics) {
    this.camera = camera;
    this.car = carPhysics;
    const c = CONFIG.camera;
    this.followDist = c.followDist;
    this.followHeight = c.followHeight;
    this.lookAhead = c.lookAhead;
    this.fovBase = c.fovBase;
    this.fovSpeedExtra = c.fovSpeedExtra;
    this.lerp = c.lerp;
    this.shakeAmp = c.shakeAmp;
    this.shakeBoostMult = c.shakeBoostMult;

    // Initialize behind the car.
    this.eye = {
      x: this.car.position.x - Math.sin(this.car.heading) * this.followDist,
      y: this.followHeight,
      z: this.car.position.z - Math.cos(this.car.heading) * this.followDist,
    };
    this.look = { x: this.car.position.x, y: 1.2, z: this.car.position.z };
  }

  update(dt, opts = {}) {
    void dt;
    const boosting = opts.boosting ?? false;
    const speed01 = opts.speed01 ?? 0;
    const c = this.car;

    // Desired eye position behind the car.
    const tx = c.position.x - Math.sin(c.heading) * this.followDist;
    const ty = this.followHeight;
    const tz = c.position.z - Math.cos(c.heading) * this.followDist;

    // Smooth (critically damped lerp).
    const l = this.lerp;
    this.eye.x += (tx - this.eye.x) * l;
    this.eye.y += (ty - this.eye.y) * l;
    this.eye.z += (tz - this.eye.z) * l;

    // Look-ahead target slightly in front of the car.
    const lx = c.position.x + Math.sin(c.heading) * this.lookAhead;
    const lz = c.position.z + Math.cos(c.heading) * this.lookAhead;
    this.look.x += (lx - this.look.x) * l;
    this.look.y = 1.2;
    this.look.z += (lz - this.look.z) * l;

    // Shake.
    const shake = this.shakeAmp * (boosting ? this.shakeBoostMult : speed01);
    const sx = this.eye.x + (Math.random() - 0.5) * shake;
    const sy = this.eye.y + (Math.random() - 0.5) * shake;
    const sz = this.eye.z + (Math.random() - 0.5) * shake;

    this.camera.position.set(sx, sy, sz);
    this.camera.lookAt(this.look.x, this.look.y, this.look.z);

    // FOV: base + speed widening + nitrous kick.
    let fov = this.fovBase + this.fovSpeedExtra * speed01;
    if (boosting) fov = Math.max(fov, CONFIG.nitrous.boostFov);
    this.camera.fov += (fov - this.camera.fov) * 0.15;
    this.camera.updateProjectionMatrix();
  }

  teleport() {
    const c = this.car;
    this.eye.x = c.position.x - Math.sin(c.heading) * this.followDist;
    this.eye.y = this.followHeight;
    this.eye.z = c.position.z - Math.cos(c.heading) * this.followDist;
    this.look.x = c.position.x;
    this.look.y = 1.2;
    this.look.z = c.position.z;
  }
}