import * as THREE from 'three';
import { WORLD, ROAD_HALF } from '../core/constants.js';

// Simple low-poly pedestrians (body + head + limbs) that walk along sidewalks.
export class PedestrianFactory {
  constructor(era) {
    this.era = era;
    this.cfg = era.pedestrian;
    this.holo = era.pedestrian.palette.some((c) => c === '#16f0ff' || c === '#b04aff');
    this._geo = {
      body: new THREE.CapsuleGeometry(0.28, 0.6, 4, 8),
      head: new THREE.SphereGeometry(0.2, 10, 8),
      limb: new THREE.CapsuleGeometry(0.1, 0.5, 3, 6),
    };
  }

  create(rng) {
    const color = new THREE.Color(rng.pick(this.cfg.palette));
    const emissive = this.holo ? color : new THREE.Color(0x000000);
    const ei = this.holo ? 0.7 : 0;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, emissive, emissiveIntensity: ei });

    const group = new THREE.Group();
    const torso = new THREE.Mesh(this._geo.body, mat); torso.position.y = 1.05; torso.castShadow = true; group.add(torso);
    const head = new THREE.Mesh(this._geo.head, mat); head.position.y = 1.62; group.add(head);
    const armL = new THREE.Mesh(this._geo.limb, mat); armL.position.set(0.32, 1.05, 0); group.add(armL);
    const armR = new THREE.Mesh(this._geo.limb, mat); armR.position.set(-0.32, 1.05, 0); group.add(armR);
    const legL = new THREE.Mesh(this._geo.limb, mat); legL.position.set(0.13, 0.4, 0); group.add(legL);
    const legR = new THREE.Mesh(this._geo.limb, mat); legR.position.set(-0.13, 0.4, 0); group.add(legR);

    // choose a sidewalk strip
    const sw = ROAD_HALF + 5;
    const strips = [
      { axisNS: true, side: 1 }, { axisNS: true, side: -1 },
      { axisNS: false, side: 1 }, { axisNS: false, side: -1 },
    ];
    const strip = rng.pick(strips);
    const dir = rng.chance(0.5) ? 1 : -1;
    const speed = rng.range(1.4, 2.4) * dir;
    const lateral = rng.range(-1.6, 1.6);
    const start = rng.range(-WORLD.half + 8, WORLD.half - 8);
    const phase = rng.range(0, Math.PI * 2);

    if (strip.axisNS) {
      group.position.set(strip.side * sw + (strip.side > 0 ? lateral : -lateral), 0, start);
      group.rotation.y = dir > 0 ? 0 : Math.PI;
    } else {
      group.position.set(start, 0, strip.side * sw + (strip.side > 0 ? lateral : -lateral));
      group.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    const limbs = [armL, armR, legL, legR];

    const update = (dt, elapsed) => {
      const walk = Math.sin(elapsed * 7 + phase) * 0.5;
      limbs[0].rotation.x = walk;
      limbs[1].rotation.x = -walk;
      limbs[2].rotation.x = -walk;
      limbs[3].rotation.x = walk;
      if (strip.axisNS) {
        group.position.z += speed * dt;
        if (group.position.z > WORLD.half - 4) group.position.z = -WORLD.half + 4;
        if (group.position.z < -WORLD.half + 4) group.position.z = WORLD.half - 4;
      } else {
        group.position.x += speed * dt;
        if (group.position.x > WORLD.half - 4) group.position.x = -WORLD.half + 4;
        if (group.position.x < -WORLD.half + 4) group.position.x = WORLD.half - 4;
      }
    };

    return { group, anchor: group.position.clone(), update };
  }
}
