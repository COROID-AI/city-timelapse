import * as THREE from 'three';
import { ERA_IDS, type EraId } from '../eras';
import type { EraState } from './EraState';
import type {
  MaterialSlot,
  BuildingFootprint,
  SignOptions,
} from './assetFactory';

export interface AssetFactory {
  makeMaterial(eraId: EraId, slot: MaterialSlot): THREE.MeshStandardMaterial;
  makeBuildingGeometry(
    eraId: EraId,
    footprint: BuildingFootprint,
  ): THREE.BufferGeometry;
  makeStreetFurniture(eraId: EraId, variant?: number): THREE.Group;
  makeSignMaterial(
    eraId: EraId,
    text: string,
    options?: SignOptions,
  ): THREE.MeshStandardMaterial;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easeInOutCubic(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

const ERA_FACADE_SLOT: Record<EraId, MaterialSlot> = {
  '1945': 'wallBrick',
  '1965': 'wallConcrete',
  '1985': 'wallGlass',
  '2005': 'wallGlass',
  '2025': 'wallConcrete',
  '2055': 'wallGlass',
};

const ERA_SIGN_TEXTS: Record<EraId, readonly string[]> = {
  '1945': ['BAKERY', 'TAILOR', 'PHARMACY', 'HOTEL', 'DINER'],
  '1965': ['DINER', 'GAS', 'RECORDS', 'MOTEL', 'AUTO'],
  '1985': ['ARCADE', 'VIDEO', 'CLUB', 'PIZZA', 'NEON'],
  '2005': ['CAFE', 'WIFI', 'LOFTS', 'GYM', 'BANK'],
  '2025': ['EATS', 'COWORK', 'BIO LAB', 'E-CARGO', 'STUDIO'],
  '2055': ['NEXUS', 'GENESIS', 'SKYPORT', 'HOLO', 'QUANTUM'],
};

interface BuildingLot {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly heightHint: number;
  readonly rotation: number;
  readonly facesPositiveZ: boolean;
}

const LAYOUT_SEED = 0x5eed;
const BASE_X_POSITIONS = [-32, -16, 0, 16, 32] as const;
const ROW_Z_NORTH = -28;
const ROW_Z_SOUTH = 28;
const CROSSFADE_MS = 700;
const CROSSFADE_SCALE_MIN = 0.6;

function generateLots(): BuildingLot[] {
  const rng = mulberry32(LAYOUT_SEED);
  const lots: BuildingLot[] = [];
  for (const facesPositiveZ of [true, false]) {
    const baze = facesPositiveZ ? ROW_Z_NORTH : ROW_Z_SOUTH;
    for (const bx of BASE_X_POSITIONS) {
      lots.push({
        x: bx + (rng() - 0.5) * 2,
        z: baze + (rng() - 0.5) * 2,
        w: 10 + rng() * 3,
        d: 12 + rng() * 3,
        heightHint: 5 + rng() * 3,
        rotation: (rng() - 0.5) * 0.06,
        facesPositiveZ,
      });
    }
  }
  return lots;
}

function collectMaterials(group: THREE.Group): THREE.MeshStandardMaterial[] {
  const set = new Set<THREE.MeshStandardMaterial>();
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const mat = obj.material;
      if (Array.isArray(mat)) {
        for (const m of mat) {
          if (m instanceof THREE.MeshStandardMaterial) set.add(m);
        }
      } else if (mat instanceof THREE.MeshStandardMaterial) {
        set.add(mat);
      }
    }
  });
  return [...set];
}

interface EraGroupData {
  readonly group: THREE.Group;
  readonly materials: readonly THREE.MeshStandardMaterial[];
}

function buildEraGroup(
  era: EraId,
  af: AssetFactory,
  lots: readonly BuildingLot[],
): EraGroupData {
  const group = new THREE.Group();
  group.name = `buildings-${era}`;
  const facadeSlot = ERA_FACADE_SLOT[era];
  const signTexts = ERA_SIGN_TEXTS[era];
  lots.forEach((lot, i) => {
    const footprint: BuildingFootprint = { w: lot.w, d: lot.d, h: lot.heightHint };
    const geo = af.makeBuildingGeometry(era, footprint);
    const mat = af.makeMaterial(era, facadeSlot);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(lot.x, 0, lot.z);
    mesh.rotation.y = lot.rotation;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const signText = signTexts[i % signTexts.length];
    const signMat = af.makeSignMaterial(era, signText, { width: 256, height: 96 });
    const signGeo = new THREE.PlaneGeometry(lot.w * 0.7, 2.4);
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 3.5, lot.facesPositiveZ ? lot.d / 2 + 0.06 : -lot.d / 2 - 0.06);
    if (!lot.facesPositiveZ) sign.rotation.y = Math.PI;
    mesh.add(sign);
  });
  const sidewalkMat = af.makeMaterial(era, 'sidewalk');
  for (const side of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(82, 7), sidewalkMat);
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(0, 0.02, side * 19);
    sw.receiveShadow = true;
    group.add(sw);
  }
  for (let i = 0; i < 4; i++) {
    const lampN = af.makeStreetFurniture(era, i);
    lampN.position.set(-24 + i * 16, 0, -16);
    group.add(lampN);
    const lampS = af.makeStreetFurniture(era, i + 10);
    lampS.position.set(-24 + i * 16 + 8, 0, 16);
    group.add(lampS);
  }
  return { group, materials: collectMaterials(group) };
}

export function createBuildingBlock(
  eraState: EraState,
  assetFactory: AssetFactory,
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'building-block';
  const lots = generateLots();
  const eraGroups = new Map<EraId, EraGroupData>();
  for (const era of ERA_IDS) {
    const data = buildEraGroup(era, assetFactory, lots);
    eraGroups.set(era, data);
    root.add(data.group);
  }
  const initialEra = eraState.getEraId();
  for (const era of ERA_IDS) {
    const data = eraGroups.get(era);
    if (!data) continue;
    const isActive = era === initialEra;
    data.group.visible = isActive;
    data.group.scale.set(1, isActive ? 1 : CROSSFADE_SCALE_MIN, 1);
    for (const mat of data.materials) {
      mat.transparent = !isActive;
      mat.opacity = isActive ? 1 : 0;
    }
  }
  let displayedEra: EraId = initialEra;
  let crossfadeRaf: number | null = null;
  const resetEraGroup = (era: EraId, visible: boolean): void => {
    const data = eraGroups.get(era);
    if (!data) return;
    data.group.visible = visible;
    data.group.scale.set(1, visible ? 1 : CROSSFADE_SCALE_MIN, 1);
    for (const mat of data.materials) {
      mat.transparent = !visible;
      mat.opacity = visible ? 1 : 0;
    }
  };
  const crossfade = (from: EraId, to: EraId): void => {
    const fromData = eraGroups.get(from);
    const toData = eraGroups.get(to);
    if (!fromData || !toData) return;
    fromData.group.visible = true;
    toData.group.visible = true;
    for (const mat of fromData.materials) mat.transparent = true;
    for (const mat of toData.materials) mat.transparent = true;
    const startTime = performance.now();
    const tick = (now: number): void => {
      const p = Math.min((now - startTime) / CROSSFADE_MS, 1);
      const e = easeInOutCubic(p);
      for (const mat of fromData.materials) mat.opacity = 1 - e;
      fromData.group.scale.y = 1 - e * (1 - CROSSFADE_SCALE_MIN);
      for (const mat of toData.materials) mat.opacity = e;
      toData.group.scale.y = CROSSFADE_SCALE_MIN + e * (1 - CROSSFADE_SCALE_MIN);
      if (p < 1) {
        crossfadeRaf = requestAnimationFrame(tick);
      } else {
        resetEraGroup(from, false);
        resetEraGroup(to, true);
        crossfadeRaf = null;
      }
    };
    crossfadeRaf = requestAnimationFrame(tick);
  };
  const unsubscribe = eraState.subscribe((update) => {
    if (update.eraId !== displayedEra) {
      if (crossfadeRaf !== null) {
        cancelAnimationFrame(crossfadeRaf);
        crossfadeRaf = null;
      }
      for (const era of ERA_IDS) {
        if (era !== displayedEra) resetEraGroup(era, false);
      }
      resetEraGroup(displayedEra, true);
      const fromEra = displayedEra;
      displayedEra = update.eraId;
      crossfade(fromEra, update.eraId);
    }
  });
  root.userData.unsubscribe = unsubscribe;
  root.userData.dispose = (): void => {
    unsubscribe();
    if (crossfadeRaf !== null) cancelAnimationFrame(crossfadeRaf);
  };
  return root;
}
