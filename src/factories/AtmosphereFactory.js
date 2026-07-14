import * as THREE from 'three';
import { WORLD } from '../core/constants.js';

// Per-era atmospheric particles using THREE.Points (GPU-instanced rendering).
// Each era gets distinct particle types: dust motes (1945), smog (1965),
// neon haze (1985), clean air sparkle (2005), data motes (2025), digital
// debris (2055). All rendered in a single draw call via Points.
export class AtmosphereFactory {
  constructor(era, eraKey) {
    this.era = era;
    this.eraKey = eraKey;
  }

  create() {
    const cfg = this._cfg();
    const count = cfg.count;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * WORLD.half * 2;
      pos[i * 3 + 1] = Math.random() * cfg.maxHeight;
      pos[i * 3 + 2] = (Math.random() - 0.5) * WORLD.half * 2;
      vel[i * 3] = (Math.random() - 0.5) * cfg.drift;
      vel[i * 3 + 1] = Math.random() * cfg.rise;
      vel[i * 3 + 2] = (Math.random() - 0.5) * cfg.drift;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(cfg.color),
      size: cfg.size,
      sizeAttenuation: true,
      transparent: true,
      opacity: cfg.opacity,
      blending: cfg.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
      fog: true,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;

    const update = (dt, elapsed) => {
      const arr = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        arr[i * 3] += vel[i * 3] * dt;
        arr[i * 3 + 1] += vel[i * 3 + 1] * dt;
        arr[i * 3 + 2] += vel[i * 3 + 2] * dt;
        // wrap
        if (arr[i * 3 + 1] > cfg.maxHeight) arr[i * 3 + 1] = 0;
        if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = cfg.maxHeight;
        const lim = WORLD.half;
        if (arr[i * 3] > lim) arr[i * 3] = -lim;
        if (arr[i * 3] < -lim) arr[i * 3] = lim;
        if (arr[i * 3 + 2] > lim) arr[i * 3 + 2] = -lim;
        if (arr[i * 3 + 2] < -lim) arr[i * 3 + 2] = lim;
      }
      geo.attributes.position.needsUpdate = true;
    };

    return { obj: points, update };
  }

  _cfg() {
    switch (this.eraKey) {
      case '1945':
        return { count: 180, color: '#d8c6a0', size: 0.3, opacity: 0.5, maxHeight: 30, drift: 0.4, rise: 0.15, additive: false };
      case '1965':
        return { count: 120, color: '#c4d4e8', size: 0.35, opacity: 0.4, maxHeight: 40, drift: 0.5, rise: 0.1, additive: false };
      case '1985':
        return { count: 220, color: '#ff3df0', size: 0.25, opacity: 0.6, maxHeight: 55, drift: 0.3, rise: 0.2, additive: true };
      case '2005':
        return { count: 90, color: '#ffffff', size: 0.2, opacity: 0.35, maxHeight: 80, drift: 0.2, rise: 0.08, additive: true };
      case '2025':
        return { count: 160, color: '#ffd79a', size: 0.22, opacity: 0.45, maxHeight: 90, drift: 0.35, rise: 0.12, additive: true };
      case '2055':
        return { count: 280, color: '#16f0ff', size: 0.3, opacity: 0.7, maxHeight: 110, drift: 0.6, rise: 0.3, additive: true };
      default:
        return { count: 100, color: '#ffffff', size: 0.25, opacity: 0.4, maxHeight: 50, drift: 0.3, rise: 0.1, additive: false };
    }
  }
}
