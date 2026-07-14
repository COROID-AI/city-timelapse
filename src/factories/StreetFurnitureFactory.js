import * as THREE from 'three';
import { WORLD, ROAD_HALF } from '../core/constants.js';

// Lamp posts + traffic lights, styled per era. Lamps carry emissive glow that
// the bloom pass picks up for night/neon eras.
export class StreetFurnitureFactory {
  constructor(era) {
    this.era = era;
    this.cfg = era.furniture;
    this.style = era.furniture.lamp;
    this.hasLight = era.furniture.trafficLight;
    this._poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 6.5, 8);
  }

  _lampHead(style, color) {
    const g = new THREE.Group();
    const armMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.4 });
    if (style === 'iron') {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), armMat);
      head.position.y = 0.25; g.add(head);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffcf80, emissiveIntensity: 1.4 }));
      bulb.position.y = 0.1; g.add(bulb);
    } else if (style === 'steel' || style === 'modern') {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), armMat);
      arm.rotation.z = Math.PI / 2; arm.position.set(0.7, 0.3, 0); g.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), armMat);
      head.position.set(1.4, 0.3, 0); g.add(head);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.3), new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffe0a0, emissiveIntensity: 1.3 }));
      bulb.position.set(1.4, 0.18, 0); g.add(bulb);
    } else if (style === 'led' || style === 'smart') {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 6), armMat);
      arm.rotation.z = Math.PI / 2; arm.position.set(0.6, 0.3, 0); g.add(arm);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.4), new THREE.MeshStandardMaterial({ color: 0xfff8e8, emissive: 0xfff0c0, emissiveIntensity: 1.5 }));
      panel.position.set(1.2, 0.3, 0); g.add(panel);
      // small sensor nub for smart
      if (style === 'smart') {
        const nub = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), new THREE.MeshStandardMaterial({ color: 0x37e0c0, emissive: 0x37e0c0, emissiveIntensity: 1.0 }));
        nub.position.set(0, 0.5, 0); g.add(nub);
      }
    } else { // holo
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x16f0ff, emissive: 0x16f0ff, emissiveIntensity: 2.2, transparent: true, opacity: 0.8 }));
      beam.position.set(0.6, 0.3, 0); g.add(beam);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 }));
      arm.rotation.z = Math.PI / 2; arm.position.set(0.3, 0.3, 0); g.add(arm);
    }
    return g;
  }

  createLamps(rng) {
    const lamps = [];
    const color = new THREE.Color(rng.pick(this.cfg.palette));
    const poleMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.4 });
    // place along both roads at intervals, both sides
    const spacing = 34;
    for (let z = -WORLD.half + 16; z < WORLD.half - 10; z += spacing) {
      for (const side of [1, -1]) {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(this._poleGeo, poleMat);
        pole.position.y = 3.25; pole.castShadow = true; g.add(pole);
        const head = this._lampHead(this.style, color);
        head.position.y = 6.4;
        if (side < 0) head.rotation.y = Math.PI;
        g.add(head);
        g.position.set(side * (ROAD_HALF + 2.4), 0, z);
        lamps.push({ group: g, anchor: g.position.clone() });
      }
    }
    for (let x = -WORLD.half + 16; x < WORLD.half - 10; x += spacing) {
      for (const side of [1, -1]) {
        if (Math.abs(x) < 14) continue; // skip intersection
        const g = new THREE.Group();
        const pole = new THREE.Mesh(this._poleGeo, poleMat);
        pole.position.y = 3.25; pole.castShadow = true; g.add(pole);
        const head = this._lampHead(this.style, color);
        head.position.y = 6.4;
        head.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        g.add(head);
        g.position.set(x, 0, side * (ROAD_HALF + 2.4));
        lamps.push({ group: g, anchor: g.position.clone() });
      }
    }
    return lamps;
  }

  createTrafficLights(rng) {
    if (!this.hasLight) return [];
    const out = [];
    const color = new THREE.Color(rng.pick(this.cfg.palette));
    const poleMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.4 });
    const corners = [[ROAD_HALF + 1.5, ROAD_HALF + 1.5], [-(ROAD_HALF + 1.5), ROAD_HALF + 1.5], [ROAD_HALF + 1.5, -(ROAD_HALF + 1.5)], [-(ROAD_HALF + 1.5), -(ROAD_HALF + 1.5)]];
    for (const [x, z] of corners) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 8), poleMat);
      pole.position.y = 2.5; pole.castShadow = true; g.add(pole);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.4), poleMat);
      box.position.set(0.5, 4.2, 0); g.add(box);
      const colors = [0xff3030, 0xffc030, 0x30ff60];
      for (let i = 0; i < 3; i++) {
        const lit = i === 2;
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: lit ? 1.6 : 0.15 }));
        dot.position.set(0.72, 4.6 - i * 0.35, 0); g.add(dot);
      }
      g.position.set(x, 0, z);
      out.push({ group: g, anchor: g.position.clone() });
    }
    return out;
  }
}
