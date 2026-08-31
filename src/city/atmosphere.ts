/**
 * Era atmosphere: gradient sky dome, sun/moon, distance fog and floating
 * particle haze (dust ➜ smog ➜ neon flakes per era).
 */

import * as THREE from 'three';
import { getEraSegment, type AppState } from '../state';
import { type EraId } from '../eras';
import { makeSkyGradientTexture, updateSkyGradientTexture } from '../textures';

export interface Atmosphere {
  readonly group: THREE.Group;
  update(dt: number, state: AppState): void;
  setEra(era: EraId, t: number): void;
  dispose(): void;
  setFog(fog: THREE.Fog | null): void;
}

interface EraAtmosSpec {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  sunColor: string;
  sunIntensity: number;
  particleColor: string;
  particleOpacity: number;
  particleSpeed: number;
  particleCount: number;
  particleSize: number;
}

const ATMOS: Record<EraId, EraAtmosSpec> = {
  '1945': {
    skyTop: '#3a5a8a',
    skyMid: '#b8a888',
    skyBottom: '#e8cfa8',
    fogColor: '#c8b89a',
    fogNear: 40,
    fogFar: 150,
    sunColor: '#ffd28a',
    sunIntensity: 1.1,
    particleColor: '#d8c8a8',
    particleOpacity: 0.25,
    particleSpeed: 0.5,
    particleCount: 260,
    particleSize: 0.05,
  },
  '1965': {
    skyTop: '#5a7ab0',
    skyMid: '#b8cce0',
    skyBottom: '#f0e8d8',
    fogColor: '#d8d8d0',
    fogNear: 45,
    fogFar: 160,
    sunColor: '#ffe0b0',
    sunIntensity: 1.2,
    particleColor: '#f0e8d0',
    particleOpacity: 0.2,
    particleSpeed: 0.6,
    particleCount: 240,
    particleSize: 0.05,
  },
  '1985': {
    skyTop: '#2a3a5a',
    skyMid: '#8a90a0',
    skyBottom: '#c0b8a8',
    fogColor: '#9a9090',
    fogNear: 35,
    fogFar: 140,
    sunColor: '#ffb45e',
    sunIntensity: 0.95,
    particleColor: '#b0a090',
    particleOpacity: 0.32,
    particleSpeed: 0.9,
    particleCount: 280,
    particleSize: 0.06,
  },
  '2005': {
    skyTop: '#1e3a5a',
    skyMid: '#5a7a8a',
    skyBottom: '#8a9098',
    fogColor: '#808a92',
    fogNear: 40,
    fogFar: 150,
    sunColor: '#d8e8ff',
    sunIntensity: 1.0,
    particleColor: '#c0d8e8',
    particleOpacity: 0.28,
    particleSpeed: 0.8,
    particleCount: 260,
    particleSize: 0.045,
  },
  '2025': {
    skyTop: '#0e1e3a',
    skyMid: '#2e4a6a',
    skyBottom: '#4a5a6a',
    fogColor: '#3a4a5a',
    fogNear: 45,
    fogFar: 160,
    sunColor: '#c0e8ff',
    sunIntensity: 1.0,
    particleColor: '#7ae8ff',
    particleOpacity: 0.35,
    particleSpeed: 1.1,
    particleCount: 300,
    particleSize: 0.05,
  },
};

export function createAtmosphere(): Atmosphere {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];

  // Sky dome
  const skyTex = makeSkyGradientTexture(
    ATMOS['1945'].skyTop,
    ATMOS['1945'].skyMid,
    ATMOS['1945'].skyBottom,
  );
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTex,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 20), skyMat);
  group.add(sky);
  disposables.push(skyMat, skyTex);

  // Sun disc
  const sunMat = new THREE.MeshBasicMaterial({
    color: ATMOS['1945'].sunColor,
    fog: false,
  });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12), sunMat);
  sun.position.set(80, 60, -130);
  group.add(sun);
  disposables.push(sunMat);

  // Particle field
  const pGeo = new THREE.BufferGeometry();
  const pMat = new THREE.PointsMaterial({
    color: ATMOS['1945'].particleColor,
    size: ATMOS['1945'].particleSize,
    transparent: true,
    opacity: ATMOS['1945'].particleOpacity,
    depthWrite: false,
  });
  const count = ATMOS['1945'].particleCount;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 160;
    positions[i * 3 + 1] = 1 + Math.random() * 34;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 160;
    seeds[i] = Math.random() * Math.PI * 2;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(pGeo, pMat);
  group.add(points);
  disposables.push(pMat, pGeo);

  const env: Atmosphere = {
    group,
    update(dt: number, state: AppState): void {
      const seg = getEraSegment(state.eraIndex);
      const lo = ATMOS[ERA_IDS[seg.lo]];
      const hi = ATMOS[ERA_IDS[seg.hi]];
      const t = seg.t;

      updateSkyGradientTexture(
        skyTex,
        lerpColor(lo.skyTop, hi.skyTop, t),
        lerpColor(lo.skyMid, hi.skyMid, t),
        lerpColor(lo.skyBottom, hi.skyBottom, t),
      );
      skyMat.map = skyTex;
      skyMat.needsUpdate = true;

      sunMat.color.set(lerpColor(lo.sunColor, hi.sunColor, t));
      pMat.color.set(lerpColor(lo.particleColor, hi.particleColor, t));
      pMat.opacity = THREE.MathUtils.lerp(lo.particleOpacity, hi.particleOpacity, t);
      pMat.size = THREE.MathUtils.lerp(lo.particleSize, hi.particleSize, t);

      // Drift particles
      const posAttr = pGeo.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const speed = THREE.MathUtils.lerp(lo.particleSpeed, hi.particleSpeed, t);
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += Math.sin(seeds[i / 3] + state.time * speed * 0.4) * dt * 0.8;
        arr[i + 2] += Math.cos(seeds[i / 3] + state.time * speed * 0.3) * dt * 0.8;
      }
      posAttr.needsUpdate = true;
    },
    setEra(_era: EraId, _t: number): void {
      // continuous
    },
    setFog(fog: THREE.Fog | null): void {
      // ownership: scene assigns via env.setFog
      void fog;
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
      group.clear();
    },
  };
  return env;
}

const ERA_IDS: EraId[] = ['1945', '1965', '1985', '2005', '2025'];

function lerpColor(a: string, b: string, t: number): string {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  const r = Math.round(((ca >> 16) & 255) + ((((cb >> 16) & 255) - ((ca >> 16) & 255)) * t));
  const g = Math.round(((ca >> 8) & 255) + ((((cb >> 8) & 255) - ((ca >> 8) & 255)) * t));
  const bl = Math.round((ca & 255) + (((cb & 255) - (ca & 255)) * t));
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}