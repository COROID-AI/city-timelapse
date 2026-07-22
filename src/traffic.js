// ============================================================
//  TRAFFIC & PEDESTRIANS — era-aware vehicles and walkers
//  Vehicles follow road lanes; pedestrians use sidewalks.
// ============================================================
import * as THREE from 'three';
import { makeRng, pick, rand, randInt, chance, disposeObject } from './util.js';

const HALF = 30; // half block size

export class TrafficSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Traffic';
    scene.add(this.group);
    this.vehicles = [];
    this.pedestrians = [];
    this.enabled = true;
    this.pedsEnabled = true;
  }

  setEra(era) {
    this.clear();
    const rng = makeRng(era.id * 31 + 7);
    const count = { 1945: 5, 1965: 7, 1985: 6, 2005: 8, 2025: 7, 2055: 6 }[era.id] || 6;
    for (let i = 0; i < count; i++) {
      const v = this._makeVehicle(era, rng, i);
      this.vehicles.push(v);
      this.group.add(v.group);
    }
    // pedestrians
    const pedCount = { 1945: 8, 1965: 10, 1985: 8, 2005: 12, 2025: 10, 2055: 8 }[era.id] || 10;
    for (let i = 0; i < pedCount; i++) {
      const p = this._makePedestrian(era, rng, i);
      this.pedestrians.push(p);
      this.group.add(p.group);
    }
  }

  // ---- Vehicle factory ----
  _makeVehicle(era, rng, idx) {
    const group = new THREE.Group();
    const color = pick(rng, era.palette.vehicle);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.5 });
    const type = this._vehicleType(era, rng);

    let body, length, width, wheelY;
    if (type === 'sedan40s') {
      // rounded 1940s sedan
      body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 4.0), mat);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 2.0), mat.clone());
      cabin.position.set(0, 0.8, -0.2);
      body.add(cabin);
      // rounded fenders
      const fender = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4 });
      const lf = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 1.2), fender);
      lf.position.set(0, -0.05, 1.3); body.add(lf);
      const rf = lf.clone(); rf.position.set(0, -0.05, -1.3); body.add(rf);
      length = 4.2; width = 1.9; wheelY = 0.4;
    } else if (type === 'muscle') {
      // 1960s muscle / long low car
      body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 4.6), mat);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.0), mat.clone());
      cabin.position.set(0, 0.75, -0.3);
      body.add(cabin);
      length = 4.8; width = 2.0; wheelY = 0.42;
    } else if (type === 'boxy80') {
      // boxy 80s
      body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.2, 4.0), mat);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.9, 2.6), mat.clone());
      cabin.position.set(0, 0.95, -0.1);
      body.add(cabin);
      length = 4.2; width = 1.95; wheelY = 0.45;
    } else if (type === 'suv') {
      body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 4.4), mat);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 3.0), mat.clone());
      cabin.position.set(0, 1.1, -0.1);
      body.add(cabin);
      length = 4.6; width = 2.0; wheelY = 0.5;
    } else if (type === 'ev') {
      // sleek EV
      body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 4.3), mat);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.75, 2.4), new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7 }));
      cabin.position.set(0, 0.7, -0.1);
      body.add(cabin);
      length = 4.5; width = 1.9; wheelY = 0.42;
    } else if (type === 'pod') {
      // autonomous pod
      body = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 2.0, 6, 12), mat);
      body.rotation.z = Math.PI / 2;
      const glass = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 1.8, 6, 12), new THREE.MeshStandardMaterial({ color: 0x0a2a3a, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.4 }));
      glass.rotation.z = Math.PI / 2;
      glass.scale.set(0.98, 0.9, 0.95);
      body.add(glass);
      length = 4.2; width = 2.2; wheelY = 0.5;
    } else {
      body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 4.0), mat);
      length = 4.0; width = 1.8; wheelY = 0.4;
    }
    body.castShadow = true;
    group.add(body);

    // wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const wheelPos = [
      [width / 2, wheelY, length / 2 - 0.8], [-width / 2, wheelY, length / 2 - 0.8],
      [width / 2, wheelY, -length / 2 + 0.8], [-width / 2, wheelY, -length / 2 + 0.8],
    ];
    const wheels = [];
    wheelPos.forEach(([x, y, z]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, y, z);
      group.add(w); wheels.push(w);
    });

    // headlights
    const headColor = era.id >= 2025 ? 0xddeeff : 0xfff0c0;
    [-0.5, 0.5].forEach(x => {
      const hl = new THREE.Mesh(new THREE.CircleGeometry(0.18, 8), new THREE.MeshBasicMaterial({ color: headColor }));
      hl.position.set(x, 0.5, length / 2);
      group.add(hl);
    });
    // taillights
    [-0.5, 0.5].forEach(x => {
      const tl = new THREE.Mesh(new THREE.CircleGeometry(0.14, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      tl.position.set(x, 0.5, -length / 2);
      group.add(tl);
    });

    // route: choose N-S or E-W road
    const ns = chance(rng, 0.5);
    const dir = chance(rng, 0.5) ? 1 : -1;
    const lane = ns ? (dir > 0 ? -3 : 3) : 0;
    const laneZ = !ns ? (dir > 0 ? -3 : 3) : 0;

    group.rotation.y = ns ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);

    // random start position along the road
    const start = rand(rng, -HALF, HALF);
    if (ns) group.position.set(lane, 0.3, start); else group.position.set(start, 0.3, lane);

    return {
      group, wheels, length, width,
      speed: rand(rng, 4, 8) * dir,
      axis: ns ? 'z' : 'x', dir, lane: ns ? lane : laneZ,
    };
  }

  _vehicleType(era, rng) {
    const types = {
      1945: ['sedan40s', 'sedan40s', 'sedan40s'],
      1965: ['muscle', 'muscle', 'sedan40s'],
      1985: ['boxy80', 'boxy80', 'muscle'],
      2005: ['suv', 'suv', 'boxy80'],
      2025: ['ev', 'ev', 'suv'],
      2055: ['pod', 'pod', 'ev'],
    };
    return pick(rng, types[era.id] || ['ev']);
  }

  // ---- Pedestrian factory ----
  _makePedestrian(era, rng, idx) {
    const group = new THREE.Group();
    const skinColors = [0xd8a878, 0xa87858, 0x8a5a38, 0xe8c8a0, 0x6a4828];
    const shirtColors = era.palette.vehicle.concat(era.palette.neon);

    const skinMat = new THREE.MeshStandardMaterial({ color: pick(rng, skinColors), roughness: 0.8 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: pick(rng, shirtColors), roughness: 0.85 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pick(rng, [0x2a2a3a, 0x3a3328, 0x1a1a1a, 0x4a4a5a]), roughness: 0.85 });

    // legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.9, 6);
    const legL = new THREE.Mesh(legGeo, pantsMat); legL.position.set(-0.12, 0.45, 0);
    const legR = new THREE.Mesh(legGeo, pantsMat); legR.position.set(0.12, 0.45, 0);
    group.add(legL, legR);
    // torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.8, 8), shirtMat);
    torso.position.y = 1.3;
    group.add(torso);
    // head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), skinMat);
    head.position.y = 1.85;
    group.add(head);

    // era-specific accessories
    if (era.id === 1985 && chance(rng, 0.5)) {
      // big hair / afro
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 }));
      hair.position.y = 1.9; hair.scale.y = 0.8;
      group.add(hair);
    }
    if (era.id >= 2005 && chance(rng, 0.6)) {
      // phone glow in hand
      const phone = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.2), new THREE.MeshBasicMaterial({ color: pick(rng, era.palette.neon) }));
      phone.position.set(0.25, 1.3, 0.15);
      group.add(phone);
    }
    if (era.id >= 2055 && chance(rng, 0.4)) {
      // visor / AR glasses
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.2), new THREE.MeshBasicMaterial({ color: pick(rng, era.palette.neon), transparent: true, opacity: 0.7 }));
      visor.position.set(0, 1.88, 0.15);
      group.add(visor);
    }
    if (era.id <= 1965 && chance(rng, 0.3)) {
      // hat
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.15, 8), new THREE.MeshStandardMaterial({ color: pick(rng, [0x3a2a1a, 0x1a1a1a, 0x4a3a2a]) }));
      hat.position.y = 2.05;
      group.add(hat);
    }

    group.traverse(o => { if (o.isMesh) o.castShadow = true; });

    // sidewalk path — walk along one of the 4 sidewalk strips
    const side = randInt(rng, 0, 3);
    const dir = chance(rng, 0.5) ? 1 : -1;
    const swPos = HALF - 2;
    let sx, sz;
    if (side === 0) { sx = rand(rng, -HALF, HALF); sz = -swPos; }
    else if (side === 1) { sx = rand(rng, -HALF, HALF); sz = swPos; }
    else if (side === 2) { sx = -swPos; sz = rand(rng, -HALF, HALF); }
    else { sx = swPos; sz = rand(rng, -HALF, HALF); }
    group.position.set(sx, 0, sz);
    // face direction
    if (side < 2) group.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    else group.rotation.y = dir > 0 ? 0 : Math.PI;

    return {
      group, legL, legR,
      speed: rand(rng, 1.2, 2.2) * dir,
      side, dir,
      phase: rand(rng, 0, Math.PI * 2),
    };
  }

  update(dt, elapsed) {
    // vehicles
    if (this.enabled) {
      this.vehicles.forEach(v => {
        if (v.axis === 'z') {
          v.group.position.z += v.speed * dt;
          if (v.dir > 0 && v.group.position.z > HALF + 5) v.group.position.z = -HALF - 5;
          if (v.dir < 0 && v.group.position.z < -HALF - 5) v.group.position.z = HALF + 5;
        } else {
          v.group.position.x += v.speed * dt;
          if (v.dir > 0 && v.group.position.x > HALF + 5) v.group.position.x = -HALF - 5;
          if (v.dir < 0 && v.group.position.x < -HALF - 5) v.group.position.x = HALF + 5;
        }
        // wheels spin
        v.wheels.forEach(w => { w.rotation.x += v.speed * dt * 1.5; });
      });
    }
    // pedestrians
    if (this.pedsEnabled) {
      this.pedestrians.forEach(p => {
        if (p.side < 2) {
          p.group.position.x += p.speed * dt;
          if (p.dir > 0 && p.group.position.x > HALF + 2) p.group.position.x = -HALF - 2;
          if (p.dir < 0 && p.group.position.x < -HALF - 2) p.group.position.x = HALF + 2;
        } else {
          p.group.position.z += p.speed * dt;
          if (p.dir > 0 && p.group.position.z > HALF + 2) p.group.position.z = -HALF - 2;
          if (p.dir < 0 && p.group.position.z < -HALF - 2) p.group.position.z = HALF + 2;
        }
        // walk animation
        const swing = Math.sin(elapsed * 8 + p.phase) * 0.4;
        p.legL.rotation.x = swing;
        p.legR.rotation.x = -swing;
      });
    }
  }

  setVisible(v) { this.group.visible = v; }
  setPedsVisible(v) {
    this.pedestrians.forEach(p => p.group.visible = v);
    this.pedsEnabled = v;
  }

  clear() {
    [...this.vehicles, ...this.pedestrians].forEach(item => {
      this.group.remove(item.group);
      disposeObject(item.group);
    });
    this.vehicles = []; this.pedestrians = [];
  }
}
