/**
 * Ground-plane city environment: roads, sidewalks, crosswalks, street props
 * (trees, hydrants, benches, lampposts), plus the central park plaza.
 * Everything is procedural geometry with era-interpolated material colors.
 */

import * as THREE from 'three';
import { getEraSegment, type AppState } from '../state';
import { type EraId } from '../eras';
import { makeAsphaltTexture, makeColorTexture } from '../textures';

export interface CityEnvironment {
  readonly group: THREE.Group;
  update(dt: number, state: AppState): void;
  setEra(era: EraId, t: number): void;
  dispose(): void;
}

export const BLOCK = 26; // half-size of the central park block
export const NORTH_ROAD_Z = 33; // center Z of the east-west road
export const WEST_ROAD_X = -33; // center X of the north-south road
export const ROAD_WIDTH = 14;
export const SIDEWALK_Z = 24.5; // sidewalk line just outside the block
export const SIDEWALK_X = -24.5;

interface EraPalette {
  road: THREE.Color;
  sidewalk: THREE.Color;
  concrete: THREE.Color;
  lamp: THREE.Color;
  grass: THREE.Color;
  lamplight: THREE.Color;
  lamplightIntensity: number;
}

const ERA_IDS_ARRAY: EraId[] = ['1945', '1965', '1985', '2005', '2025'];

function eraAt(index: number): EraId {
  return ERA_IDS_ARRAY[Math.min(Math.max(index, 0), ERA_IDS_ARRAY.length - 1)];
}

const PALETTES: Record<EraId, EraPalette> = {
  '1945': {
    road: new THREE.Color('#3a3632'),
    sidewalk: new THREE.Color('#8b8277'),
    concrete: new THREE.Color('#7a756e'),
    lamp: new THREE.Color('#2c2a26'),
    grass: new THREE.Color('#4a5c3a'),
    lamplight: new THREE.Color('#ffb45e'),
    lamplightIntensity: 1.15,
  },
  '1965': {
    road: new THREE.Color('#383b3f'),
    sidewalk: new THREE.Color('#9a9490'),
    concrete: new THREE.Color('#98928c'),
    lamp: new THREE.Color('#3a3a3e'),
    grass: new THREE.Color('#50804a'),
    lamplight: new THREE.Color('#ffcf8a'),
    lamplightIntensity: 1.0,
  },
  '1985': {
    road: new THREE.Color('#2f3438'),
    sidewalk: new THREE.Color('#9c9a96'),
    concrete: new THREE.Color('#a4a4a0'),
    lamp: new THREE.Color('#44454a'),
    grass: new THREE.Color('#517a46'),
    lamplight: new THREE.Color('#ffb45e'),
    lamplightIntensity: 0.95,
  },
  '2005': {
    road: new THREE.Color('#2c3033'),
    sidewalk: new THREE.Color('#a2a2a0'),
    concrete: new THREE.Color('#b0b2b0'),
    lamp: new THREE.Color('#5a5e64'),
    grass: new THREE.Color('#55a04a'),
    lamplight: new THREE.Color('#e8f3ff'),
    lamplightIntensity: 0.8,
  },
  '2025': {
    road: new THREE.Color('#26292c'),
    sidewalk: new THREE.Color('#b0b2b4'),
    concrete: new THREE.Color('#c8cac8'),
    lamp: new THREE.Color('#7a7e84'),
    grass: new THREE.Color('#5fb05a'),
    lamplight: new THREE.Color('#e8f7ff'),
    lamplightIntensity: 1.0,
  },
};

function lerpPalette(a: EraPalette, b: EraPalette, t: number): EraPalette {
  const c = (src: THREE.Color): THREE.Color => src.clone();
  return {
    road: c(a.road).lerp(b.road, t),
    sidewalk: c(a.sidewalk).lerp(b.sidewalk, t),
    concrete: c(a.concrete).lerp(b.concrete, t),
    lamp: c(a.lamp).lerp(b.lamp, t),
    grass: c(a.grass).lerp(b.grass, t),
    lamplight: c(a.lamplight).lerp(b.lamplight, t),
    lamplightIntensity: THREE.MathUtils.lerp(
      a.lamplightIntensity,
      b.lamplightIntensity,
      t,
    ),
  };
}

export function createCityEnvironment(): CityEnvironment {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];

  const asphaltTex = makeAsphaltTexture('#3a3a3a');
  const sidewalkTex = makeAsphaltTexture('#8f8a84');
  const crossTex = makeColorTexture('#e8e8e8');
  disposables.push(asphaltTex, sidewalkTex, crossTex);

  // Ground base
  const groundMat = new THREE.MeshStandardMaterial({ color: '#6b6a66', roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  group.add(ground);
  disposables.push(groundMat);

  // Central park plaza
  const plazaMat = new THREE.MeshStandardMaterial({ color: '#a9a49e', roughness: 0.9 });
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(BLOCK * 2, 0.16, BLOCK * 2), plazaMat);
  plaza.position.y = 0.18;
  plaza.receiveShadow = true;
  group.add(plaza);
  disposables.push(plazaMat);

  // Roads
  const roadMat = new THREE.MeshStandardMaterial({
    color: '#3a3a3a',
    roughness: 0.9,
    map: asphaltTex,
  });
  const roadX = new THREE.Mesh(new THREE.BoxGeometry(200, 0.12, ROAD_WIDTH), roadMat);
  roadX.position.set(0, 0.04, NORTH_ROAD_Z);
  roadX.receiveShadow = true;
  group.add(roadX);

  const roadZ = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH, 0.12, 200), roadMat);
  roadZ.position.set(WEST_ROAD_X, 0.04, 0);
  roadZ.receiveShadow = true;
  group.add(roadZ);
  disposables.push(roadMat);

  // Crosswalks (white stripes) on both roads, at each side of the block
  const crossMat = new THREE.MeshBasicMaterial({ map: crossTex });
  disposables.push(crossMat);
  for (const offset of [-BLOCK - 4, BLOCK + 4]) {
    for (let s = -4; s <= 4; s += 2) {
      const stripeX = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.02, ROAD_WIDTH * 0.55),
        crossMat,
      );
      stripeX.position.set(offset, 0.1, NORTH_ROAD_Z);
      group.add(stripeX);

      const stripeZ = new THREE.Mesh(
        new THREE.BoxGeometry(ROAD_WIDTH * 0.55, 0.02, 1.2),
        crossMat,
      );
      stripeZ.position.set(WEST_ROAD_X, 0.1, offset);
      group.add(stripeZ);
    }
  }

  // Sidewalk strips around the block
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: '#8f8a84',
    roughness: 0.9,
    map: sidewalkTex,
  });
  disposables.push(sidewalkMat);
  addBox(group, sidewalkMat, BLOCK * 2 + 6, 0.14, 3, 0, 0.1, SIDEWALK_Z);
  addBox(group, sidewalkMat, BLOCK * 2 + 6, 0.14, 3, 0, 0.1, -SIDEWALK_Z);
  addBox(group, sidewalkMat, 3, 0.14, BLOCK * 2 + 6, SIDEWALK_X, 0.1, 0);
  addBox(group, sidewalkMat, 3, 0.14, BLOCK * 2 + 6, -SIDEWALK_X, 0.1, 0);

  // Park grass squares on the plaza
  const grassMats: THREE.MeshStandardMaterial[] = [];
  for (const [x, z] of [
    [-6, -6],
    [6, -6],
    [-6, 6],
    [6, 6],
  ] as const) {
    const mat = new THREE.MeshStandardMaterial({ color: '#4a5c3a', roughness: 1 });
    const park = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.1, 4.6), mat);
    park.position.set(x, 0.26, z);
    park.receiveShadow = true;
    group.add(park);
    grassMats.push(mat);
    disposables.push(mat);
  }

  // Street props: lampposts along the block edges
  const lampHeads: THREE.MeshStandardMaterial[] = [];
  const lampPositions: Array<[number, number]> = [
    [BLOCK + 4.5, 8],
    [BLOCK + 4.5, -8],
    [-BLOCK - 4.5, 8],
    [-BLOCK - 4.5, -8],
    [8, -BLOCK - 4.5],
    [-8, -BLOCK - 4.5],
  ];
  for (const [x, z] of lampPositions) {
    const headMat = new THREE.MeshStandardMaterial({
      color: '#ffd9a0',
      emissive: '#ffb45e',
      emissiveIntensity: 1.15,
    });
    const lamp = createLamp(headMat);
    lamp.position.set(x, 0, z);
    group.add(lamp);
    lampHeads.push(headMat);
    disposables.push(headMat);
    disposables.push(...collectMaterials(lamp));
  }

  // Hydrants
  for (let i = 0; i < 3; i++) {
    const hydrant = createHydrant();
    hydrant.position.set(-12 + i * 9, 0, -BLOCK - 4.5);
    group.add(hydrant);
    disposables.push(...collectMaterials(hydrant));
  }

  // Benches
  for (const [x, z] of [
    [10, SIDEWALK_Z],
    [-10, -SIDEWALK_Z],
  ] as const) {
    const bench = createBench();
    bench.position.set(x, 0, z);
    group.add(bench);
    disposables.push(...collectMaterials(bench));
  }

  // Trees
  for (const [x, z] of [
    [14, 26.6],
    [-14, 26.6],
    [14, -26.6],
    [-14, -26.6],
  ] as const) {
    const tree = createTree();
    tree.position.set(x, 0, z);
    group.add(tree);
    disposables.push(...collectMaterials(tree));
  }

  const env: CityEnvironment = {
    group,
    update(_dt: number, state: AppState): void {
      const seg = getEraSegment(state.eraIndex);
      const lo = PALETTES[eraAt(seg.lo)];
      const hi = PALETTES[eraAt(seg.hi)];
      const p = lerpPalette(lo, hi, seg.t);
      roadMat.color.copy(p.road);
      sidewalkMat.color.copy(p.sidewalk);
      plazaMat.color.copy(p.concrete);
      groundMat.color.copy(p.concrete).multiplyScalar(0.7);
      for (const m of grassMats) m.color.copy(p.grass);
      for (const hm of lampHeads) {
        hm.emissive.copy(p.lamplight);
        hm.emissiveIntensity = p.lamplightIntensity;
        hm.color.copy(p.lamplight);
      }
    },
    setEra(_era: EraId, _t: number): void {
      // Continuous interpolation happens in update(); setEra is a hook for
      // discrete props (none needed on the ground plane).
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
      group.clear();
    },
  };
  return env;
}

function addBox(
  group: THREE.Group,
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  group.add(mesh);
}

function createLamp(headMat: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({
    color: '#2c2a26',
    roughness: 0.6,
    metalness: 0.4,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 4.2, 10), poleMat);
  pole.position.y = 2.1;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.2), poleMat);
  arm.position.set(0, 3.7, 0.5);
  group.add(arm);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), headMat);
  head.position.set(0, 3.6, 1.12);
  head.castShadow = true;
  group.add(head);
  return group;
}

function createHydrant(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.8, 12),
    new THREE.MeshStandardMaterial({ color: '#b32323', roughness: 0.7 }),
  );
  body.position.y = 0.45;
  g.add(body);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#c93030', roughness: 0.6 }),
  );
  cap.position.y = 0.92;
  g.add(cap);
  return g;
}

function createBench(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#7a4f2c', roughness: 0.8 });
  const metal = new THREE.MeshStandardMaterial({
    color: '#3a3a3a',
    roughness: 0.5,
    metalness: 0.7,
  });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), wood);
  seat.position.y = 0.45;
  g.add(seat);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.4), metal);
    leg.position.set(sx * 0.7, 0.2, 0);
    g.add(leg);
  }
  return g;
}

function createTree(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 2.2, 10),
    new THREE.MeshStandardMaterial({ color: '#6b4a2c', roughness: 1 }),
  );
  trunk.position.y = 1.1;
  g.add(trunk);
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#4a7a40', roughness: 1 }),
  );
  canopy.position.y = 3.0;
  canopy.castShadow = true;
  g.add(canopy);
  return g;
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