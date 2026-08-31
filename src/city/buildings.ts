/**
 * City buildings. Each building is a procedural mesh with:
 *   - era-interpolated facade color (brick / stone / glass palettes)
 *   - a window texture: facade grid with lit panes (era emissive color/intensity)
 *   - height tween per era
 *   - rooftop props (water towers, aerials, AC units, solar, greenery)
 *   - a billboard/storefront CanvasTexture sign that swaps text per era
 */

import * as THREE from 'three';
import { getEraSegment, type AppState } from '../state';
import { type EraId } from '../eras';
import { makeSignTexture, makeWindowTexture } from '../textures';

export interface Buildings {
  readonly group: THREE.Group;
  update(dt: number, state: AppState): void;
  setEra(era: EraId, t: number): void;
  dispose(): void;
}

const ERA_IDS: EraId[] = ['1945', '1965', '1985', '2005', '2025'];

function nearestEra(index: number): EraId {
  return ERA_IDS[Math.min(ERA_IDS.length - 1, Math.max(0, Math.round(index)))];
}

interface BuildingSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  heights: Record<EraId, number>;
  facade: Record<EraId, string>;
  windowEmissive: Record<EraId, string>;
  windowIntensity: Record<EraId, number>;
  signLines: Partial<Record<EraId, string[]>>;
  signAccent: Record<EraId, string>;
  signPos: 'north' | 'south';
}

const SPECS: BuildingSpec[] = [
  {
    x: -16,
    z: -16,
    w: 10,
    d: 10,
    heights: { '1945': 12, '1965': 16, '1985': 20, '2005': 26, '2025': 30 },
    facade: { '1945': '#7d4a33', '1965': '#8f6f52', '1985': '#9d8d7a', '2005': '#b8a490', '2025': '#c9b8a6' },
    windowEmissive: { '1945': '#ffce7a', '1965': '#ffd7a0', '1985': '#9ad7ff', '2005': '#d8fbff', '2025': '#b8f0ff' },
    windowIntensity: { '1945': 0.55, '1965': 0.6, '1985': 0.75, '2005': 0.95, '2025': 1.0 },
    signLines: {
      '1945': ['WAR BONDS'],
      '1965': ['COLA 5c'],
      '1985': ['ARCADE'],
      '2005': ['CAFE'],
      '2025': ['NEXUS AI'],
    },
    signAccent: { '1945': '#f4b942', '1965': '#e8a0c0', '1985': '#ff4da0', '2005': '#7ae0ff', '2025': '#8affc0' },
    signPos: 'north',
  },
  {
    x: 16,
    z: -16,
    w: 10,
    d: 10,
    heights: { '1945': 13, '1965': 17, '1985': 22, '2005': 28, '2025': 34 },
    facade: { '1945': '#6c5b3d', '1965': '#d9c49a', '1985': '#9aa0a8', '2005': '#aeb6c0', '2025': '#c8d0da' },
    windowEmissive: { '1945': '#ffce7a', '1965': '#ffe2b0', '1985': '#a8e0ff', '2005': '#e0fbff', '2025': '#c0f0ff' },
    windowIntensity: { '1945': 0.5, '1965': 0.6, '1985': 0.75, '2005': 0.95, '2025': 1.0 },
    signLines: {
      '1945': ['DEPARTMENT'],
      '1965': ['DINER'],
      '1985': ['VIDEO'],
      '2005': ['PHONE+'],
      '2025': ['MARS COLONY'],
    },
    signAccent: { '1945': '#dfe2e8', '1965': '#ff5d73', '1985': '#ff2fa0', '2005': '#66e0ff', '2025': '#bfe8ff' },
    signPos: 'north',
  },
  {
    x: -16,
    z: 16,
    w: 10,
    d: 10,
    heights: { '1945': 10, '1965': 14, '1985': 18, '2005': 24, '2025': 28 },
    facade: { '1945': '#8a4e3a', '1965': '#e8b0a0', '1985': '#b0a8a0', '2005': '#c4c0bc', '2025': '#d6d2ce' },
    windowEmissive: { '1945': '#ffda8a', '1965': '#ffd7a8', '1985': '#9ad0ff', '2005': '#dcfbff', '2025': '#b8f2ff' },
    windowIntensity: { '1945': 0.55, '1965': 0.6, '1985': 0.72, '2005': 0.9, '2025': 0.95 },
    signLines: {
      '1945': ['VICTORY'],
      '1965': ['HAIR SALON'],
      '1985': ['PIZZA'],
      '2005': ['GYM'],
      '2025': ['GREEN CAFE'],
    },
    signAccent: { '1945': '#f2c86b', '1965': '#ff8fb0', '1985': '#ffcf4d', '2005': '#7ae2ff', '2025': '#8ff0b0' },
    signPos: 'south',
  },
  {
    x: 16,
    z: 16,
    w: 10,
    d: 10,
    heights: { '1945': 11, '1965': 15, '1985': 20, '2005': 26, '2025': 30 },
    facade: { '1945': '#76603f', '1965': '#b8c4a8', '1985': '#a8b0b8', '2005': '#ccd4dc', '2025': '#dce2e8' },
    windowEmissive: { '1945': '#ffd28a', '1965': '#ffe0b0', '1985': '#a0d8ff', '2005': '#e0fbff', '2025': '#c0f0ff' },
    windowIntensity: { '1945': 0.5, '1965': 0.6, '1985': 0.75, '2005': 0.95, '2025': 1.05 },
    signLines: {
      '1945': ['BAKERY'],
      '1965': ['MOTEL'],
      '1985': ['RECORDS'],
      '2005': ['COFFEE'],
      '2025': ['ROBO LAB'],
    },
    signAccent: { '1945': '#e8c06b', '1965': '#4db8ff', '1985': '#ff5ef0', '2005': '#9ae8ff', '2025': '#a8f0d0' },
    signPos: 'south',
  },
];

type RooftopType = 'waterTower' | 'aerial' | 'ac' | 'solar' | 'greenery';

interface RooftopPropSpec {
  type: RooftopType;
  eras: EraId[];
  offset: [number, number];
  scale: number;
}

const ROOFTOP_PROP_SPECS: RooftopPropSpec[] = [
  { type: 'waterTower', eras: ['1945','1965'], offset: [-2,-1], scale: 1 },
  { type: 'aerial', eras: ['1965','1985','2005'], offset: [2,2], scale: 0.8 },
  { type: 'ac', eras: ['1985','2005','2025'], offset: [-2.5,2], scale: 0.9 },
  { type: 'solar', eras: ['2025'], offset: [1.5,-2], scale: 1 },
  { type: 'greenery', eras: ['2025'], offset: [2.5,1.5], scale: 0.7 },
];

function createRooftopProp(type: RooftopType): THREE.Group {
  const g = new THREE.Group();
  switch (type) {
    case 'waterTower': {
      const legs = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 1.1, 1.6, 8),
        new THREE.MeshStandardMaterial({ color: '#6b5a42', roughness: 0.9 }),
      );
      legs.position.y = 0.8;
      g.add(legs);
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.3, 1.2, 12),
        new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.8 }),
      );
      tank.position.y = 2.0;
      g.add(tank);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.3, 0.5, 12),
        new THREE.MeshStandardMaterial({ color: '#7a5c3c', roughness: 0.8 }),
      );
      cone.position.y = 2.85;
      g.add(cone);
      break;
    }
    case 'aerial': {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 3, 6),
        new THREE.MeshStandardMaterial({ color: '#4a4a4a', metalness: 0.8, roughness: 0.4 }),
      );
      pole.position.y = 1.5;
      g.add(pole);
      for (const s of [-1, 1]) {
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.04, 0.04),
          new THREE.MeshStandardMaterial({ color: '#6a6a6a', metalness: 0.8, roughness: 0.4 }),
        );
        bar.position.set(s * 0.35, 2.9, 0);
        g.add(bar);
      }
      break;
    }
    case 'ac': {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.6, 0.9),
        new THREE.MeshStandardMaterial({ color: '#b0b0b0', roughness: 0.6, metalness: 0.3 }),
      );
      body.position.y = 0.3;
      g.add(body);
      const fan = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.06, 10),
        new THREE.MeshStandardMaterial({ color: '#2e2e2e', roughness: 0.8 }),
      );
      fan.rotation.x = Math.PI / 2;
      fan.position.set(0.4, 0.3, 0);
      g.add(fan);
      break;
    }
    case 'solar': {
      for (const s of [-1, 1]) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.06, 0.7),
          new THREE.MeshStandardMaterial({
            color: '#1a3a6a',
            roughness: 0.2,
            metalness: 0.5,
            emissive: '#224080',
            emissiveIntensity: 0.3,
          }),
        );
        panel.position.set(s * 0.75, 0.4, 0);
        panel.rotation.x = -0.35;
        g.add(panel);
      }
      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6),
        new THREE.MeshStandardMaterial({ color: '#556070', roughness: 0.6 }),
      );
      stand.position.y = 0.3;
      g.add(stand);
      break;
    }
    case 'greenery': {
      for (const [x, z] of [
        [-0.5, -0.3],
        [0.4, 0.4],
        [0.1, -0.4],
      ] as const) {
        const plant = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.35, 1),
          new THREE.MeshStandardMaterial({ color: '#4f9e4a', roughness: 1 }),
        );
        plant.position.set(x, 0.3, z);
        g.add(plant);
      }
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.24, 1.2),
        new THREE.MeshStandardMaterial({ color: '#6b5238', roughness: 0.9 }),
      );
      box.position.y = 0.12;
      g.add(box);
      break;
    }
  }
  return g;
}

interface BuildingRecord {
  body: THREE.Mesh;
  facadeMat: THREE.MeshStandardMaterial;
  windowTex: THREE.CanvasTexture;
  sign: THREE.Mesh;
  signMat: THREE.MeshBasicMaterial;
  signTex: THREE.Texture;
  roofProps: THREE.Group[];
  spec: BuildingSpec;
}

export function createBuildings(): Buildings {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const records: BuildingRecord[] = [];

  for (const spec of SPECS) {
    const bodyGeo = new THREE.BoxGeometry(spec.w, 1, spec.d);
    const facadeMat = new THREE.MeshStandardMaterial({
      color: spec.facade['1945'],
      roughness: 0.78,
    });
    // Window texture: bright panes on a mid facade; used as map + emissiveMap.
    const windowTex = makeWindowTexture('#20242e', '#ffdf9a', '#1c2432', 5, 6, 0.42);
    facadeMat.map = windowTex;
    facadeMat.emissive = new THREE.Color(spec.windowEmissive['1945']);
    facadeMat.emissiveMap = windowTex;
    facadeMat.emissiveIntensity = spec.windowIntensity['1945'];

    const body = new THREE.Mesh(bodyGeo, facadeMat);
    body.position.set(spec.x, 6, spec.z);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Sign billboard (era text)
    const signTex = createSignTexture(spec, '1945');
    const signMat = new THREE.MeshBasicMaterial({
      map: signTex,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2), signMat);
    const sdir = spec.signPos === 'north' ? 1 : -1;
    sign.position.set(spec.x, 4.5, spec.z + (sdir * spec.d) / 2 + 0.3);
    sign.lookAt(sign.position.x, sign.position.y, -sign.position.z * 3);
    sign.rotation.y = spec.signPos === 'north' ? 0 : Math.PI;
    group.add(sign);

    // Rooftop props (all created; era visibility toggles opacity)
    const roofProps: THREE.Group[] = [];
    for (const ps of ROOFTOP_PROP_SPECS) {
      const prop = createRooftopProp(ps.type);
      prop.position.set(spec.x + ps.offset[0], 0, spec.z + ps.offset[1]);
      prop.scale.setScalar(ps.scale);
      group.add(prop);
      roofProps.push(prop);
      disposables.push(...collectMaterials(prop));
    }

    records.push({ body, facadeMat, windowTex, sign, signMat, signTex, roofProps, spec });
    disposables.push(facadeMat, signMat, windowTex, signTex, bodyGeo);
  }

  const env: Buildings = {
    group,
    update(_dt: number, state: AppState): void {
      const seg = getEraSegment(state.eraIndex);
      const loEra = ERA_IDS[seg.lo];
      const hiEra = ERA_IDS[seg.hi];
      const t = seg.t;
      for (const rec of records) {
        const s = rec.spec;
        const h = THREE.MathUtils.lerp(s.heights[loEra], s.heights[hiEra], t);
        rec.body.scale.y = h;
        rec.body.position.y = h / 2;

        rec.facadeMat.color.copy(new THREE.Color(s.facade[loEra])).lerp(new THREE.Color(s.facade[hiEra]), t);
        rec.facadeMat.emissive.copy(new THREE.Color(s.windowEmissive[loEra])).lerp(new THREE.Color(s.windowEmissive[hiEra]), t);
        rec.facadeMat.emissiveIntensity = THREE.MathUtils.lerp(
          s.windowIntensity[loEra],
          s.windowIntensity[hiEra],
          t,
        );

        // Rooftop props ride the building height; era visibility eases opacity.
        for (let i = 0; i < rec.roofProps.length; i++) {
          const prop = rec.roofProps[i];
          const ps = ROOFTOP_PROP_SPECS[i];
          prop.position.y = h;
          const on = ps.eras.includes(state.era);
          const mat = firstMaterial(prop);
          if (mat) {
            mat.transparent = true;
            mat.opacity = THREE.MathUtils.lerp(mat.opacity, on ? 1 : 0, 0.18);
            mat.needsUpdate = true;
          }
          prop.visible = mat ? mat.opacity > 0.02 : on;
        }

        // Sign text swap at nearest discrete era.
        const wantEra = nearestEra(state.eraIndex);
        if (rec.sign.userData.currentEra !== wantEra) {
          rec.sign.userData.currentEra = wantEra;
          rec.signTex.dispose();
          rec.signTex = createSignTexture(s, wantEra);
          rec.signMat.map = rec.signTex;
          rec.signMat.needsUpdate = true;
        }
        rec.sign.position.y = Math.min(h * 0.4, 5.5);
      }
    },
    setEra(_era: EraId, _t: number): void {
      // continuous interpolation handled in update()
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
      group.clear();
    },
  };
  return env;
}

function createSignTexture(spec: BuildingSpec, era: EraId): THREE.Texture {
  const lines = spec.signLines[era] ?? ['SHOP'];
  return makeSignTexture(lines, {
    bg: '#0a0c12',
    fg: spec.signAccent[era],
    glow: spec.signAccent[era],
  });
}

function firstMaterial(obj: THREE.Object3D): THREE.Material | null {
  let found: THREE.Material | null = null;
  obj.traverse((child) => {
    if (found) return;
    const mesh = child as THREE.Mesh;
    if (mesh.material) {
      found = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    }
  });
  return found;
}

function collectMaterials(root: THREE.Object3D): THREE.Material[] {
  const out: THREE.Material[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      out.push(...mats);
    }
  });
  return out;
}