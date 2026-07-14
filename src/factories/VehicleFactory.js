import * as THREE from 'three';
import { WORLD, ROAD_HALF } from '../core/constants.js';

// Creates era-specific vehicles that travel along the crossroads and wrap around.
export class VehicleFactory {
  constructor(era) {
    this.era = era;
    this.cfg = era.vehicle;
    this.style = era.vehicle.style;
    this._geoCache = new Map();
  }

  _g(key, factory) {
    let g = this._geoCache.get(key);
    if (!g) { g = factory(); this._geoCache.set(key, g); }
    return g;
  }

  create({ axisNS, rng }) {
    const style = this.style;
    const color = new THREE.Color(rng.pick(this.cfg.palette));
    const dir = rng.chance(0.5) ? 1 : -1;
    const laneOff = ROAD_HALF * 0.5 * (rng.chance(0.5) ? 1 : -1);
    const speed = this.cfg.speed * dir * rng.range(0.85, 1.15);
    const fly = style === 'flying';
    const hoverY = fly ? rng.range(9, 16) : 0;

    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);

    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.5 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6, metalness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.85 });

    let length = 4.4, width = 2.0, height = 1.5;

    if (style === 'classic') {
      length = 4.8; height = 1.7;
      const chassis = new THREE.Mesh(this._g('cl_c', () => new THREE.BoxGeometry(length, height * 0.55, width)), bodyMat);
      chassis.position.y = 0.95; chassis.castShadow = true; body.add(chassis);
      const cabin = new THREE.Mesh(this._g('cl_cab', () => new THREE.BoxGeometry(length * 0.5, height * 0.5, width * 0.9)), bodyMat);
      cabin.position.set(-0.2, 1.5, 0); cabin.castShadow = true; body.add(cabin);
      // rounded fenders
      for (const sx of [-1, 1]) {
        const fender = new THREE.Mesh(this._g('cl_f', () => new THREE.CylinderGeometry(0.55, 0.55, width + 0.4, 10)), darkMat);
        fender.rotation.z = Math.PI / 2; fender.position.set(sx * length * 0.36, 0.6, 0); body.add(fender);
      }
      // headlights
      for (const sz of [-1, 1]) {
        const hl = new THREE.Mesh(this._g('hl', () => new THREE.SphereGeometry(0.18, 8, 6)), new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffd070, emissiveIntensity: 0.5 }));
        hl.position.set(length * 0.48, 0.95, sz * 0.55); body.add(hl);
      }
    } else if (style === 'muscle') {
      length = 5.0; height = 1.4;
      const chassis = new THREE.Mesh(this._g('mu_c', () => new THREE.BoxGeometry(length, height * 0.6, width)), bodyMat);
      chassis.position.y = 0.85; chassis.castShadow = true; body.add(chassis);
      const cabin = new THREE.Mesh(this._g('mu_cab', () => new THREE.BoxGeometry(length * 0.45, height * 0.55, width * 0.92)), glassMat);
      cabin.position.set(-0.1, 1.35, 0); body.add(cabin);
      // chrome strip
      const strip = new THREE.Mesh(this._g('mu_s', () => new THREE.BoxGeometry(length, 0.12, width * 0.2)), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.9, roughness: 0.2 }));
      strip.position.y = 0.7; body.add(strip);
    } else if (style === 'boxy') {
      length = 4.4; height = 1.5;
      const chassis = new THREE.Mesh(this._g('bo_c', () => new THREE.BoxGeometry(length, height, width)), bodyMat);
      chassis.position.y = 1.0; chassis.castShadow = true; body.add(chassis);
      const cabin = new THREE.Mesh(this._g('bo_cab', () => new THREE.BoxGeometry(length * 0.6, height * 0.55, width * 0.95)), glassMat);
      cabin.position.set(0, 1.7, 0); body.add(cabin);
      // neon underglow
      const glow = new THREE.Mesh(this._g('bo_g', () => new THREE.BoxGeometry(length * 0.9, 0.1, width * 0.9)), new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 1.2 }));
      glow.position.y = 0.35; body.add(glow);
    } else if (style === 'sedan') {
      length = 4.6; height = 1.4;
      const chassis = new THREE.Mesh(this._g('sd_c', () => new THREE.BoxGeometry(length, height * 0.6, width)), bodyMat);
      chassis.position.y = 0.8; chassis.castShadow = true; body.add(chassis);
      const cabin = new THREE.Mesh(this._g('sd_cab', () => new THREE.BoxGeometry(length * 0.55, height * 0.6, width * 0.9)), bodyMat);
      cabin.position.set(-0.1, 1.35, 0); cabin.castShadow = true; body.add(cabin);
      const glass = new THREE.Mesh(this._g('sd_g', () => new THREE.BoxGeometry(length * 0.5, height * 0.4, width * 0.82)), glassMat);
      glass.position.set(-0.1, 1.5, 0); body.add(glass);
    } else if (style === 'ev') {
      length = 4.4; height = 1.45;
      const chassis = new THREE.Mesh(this._g('ev_c', () => new THREE.BoxGeometry(length, height * 0.65, width)), bodyMat);
      chassis.position.y = 0.82; chassis.castShadow = true; body.add(chassis);
      const cabin = new THREE.Mesh(this._g('ev_cab', () => new THREE.BoxGeometry(length * 0.6, height * 0.5, width * 0.9)), glassMat);
      cabin.position.set(0, 1.35, 0); body.add(cabin);
      const accent = new THREE.Mesh(this._g('ev_a', () => new THREE.BoxGeometry(length * 0.95, 0.08, 0.1)), new THREE.MeshStandardMaterial({ color: 0x37e0c0, emissive: 0x37e0c0, emissiveIntensity: 1.0 }));
      accent.position.set(0, 0.7, width / 2); body.add(accent);
      const accent2 = accent.clone(); accent2.position.z = -width / 2; body.add(accent2);
    } else { // flying
      length = 5.2; width = 2.4; height = 1.0;
      const hull = new THREE.Mesh(this._g('fl_h', () => new THREE.BoxGeometry(length, height, width)), bodyMat);
      hull.castShadow = true; body.add(hull);
      const canopy = new THREE.Mesh(this._g('fl_c', () => new THREE.SphereGeometry(0.7, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2)), glassMat);
      canopy.scale.set(1.6, 1, 1.4); canopy.position.set(0, 0.3, 0); body.add(canopy);
      const glowMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 2.0 });
      for (const sx of [-1, 1]) {
        const thruster = new THREE.Mesh(this._g('fl_t', () => new THREE.CylinderGeometry(0.3, 0.5, 0.4, 8)), glowMat);
        thruster.rotation.x = Math.PI / 2; thruster.position.set(sx * length * 0.42, 0, width * 0.42); body.add(thruster);
      }
      // belly glow
      const belly = new THREE.Mesh(this._g('fl_b', () => new THREE.PlaneGeometry(length * 0.8, width * 0.8)), glowMat);
      belly.rotation.x = Math.PI / 2; belly.position.y = -0.55; body.add(belly);
    }

    // wheels for non-flying
    if (!fly) {
      const wheelGeo = this._g('wheel', () => new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10));
      const wheelMat = darkMat;
      const woff = width / 2 + 0.1;
      const positions = [[length * 0.32, 0.42, woff], [length * 0.32, 0.42, -woff], [-length * 0.32, 0.42, woff], [-length * 0.32, 0.42, -woff]];
      for (const p of positions) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.x = Math.PI / 2; wheel.position.set(...p); body.add(wheel);
      }
    }

    // Position & orient
    if (axisNS) {
      group.position.set(laneOff, hoverY, rng.range(-WORLD.half, WORLD.half));
      group.rotation.y = dir > 0 ? 0 : Math.PI;
    } else {
      group.position.set(rng.range(-WORLD.half, WORLD.half), hoverY, laneOff);
      group.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    }

    const state = { axisNS, speed, laneOff, hoverY, bob: rng.range(0, Math.PI * 2), fly };

    const update = (dt, elapsed) => {
      if (axisNS) {
        group.position.z += speed * dt;
        if (group.position.z > WORLD.half) group.position.z = -WORLD.half;
        if (group.position.z < -WORLD.half) group.position.z = WORLD.half;
      } else {
        group.position.x += speed * dt;
        if (group.position.x > WORLD.half) group.position.x = -WORLD.half;
        if (group.position.x < -WORLD.half) group.position.x = WORLD.half;
      }
      if (state.fly) {
        group.position.y = hoverY + Math.sin(elapsed * 1.5 + state.bob) * 0.4;
      }
    };

    return { group, anchor: group.position.clone(), update };
  }
}
