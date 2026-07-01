// Era definitions + continuous interpolation.
// Every visual aspect of the block is driven by an EraConfig. Five discrete eras
// are blended continuously during transitions so colours, heights and lighting
// interpolate; vehicle/pedestrian meshes cross-fade at the transition midpoint.

import * as THREE from 'three';
import { lerp } from './rng';

export type VehicleType = 'vintage' | 'muscle' | 'sedan' | 'suv' | 'ev';
export type PedestrianOutfit =
  | 'forties'
  | 'sixties'
  | 'eighties'
  | 'aughts'
  | 'twenties';

export interface EraConfig {
  year: number;
  label: string;
  // Sky gradient (two-stop dome)
  skyTop: number;
  skyBottom: number;
  // Fog
  fog: number;
  fogDensity: number;
  // Sun (directional)
  sunColor: number;
  sunIntensity: number;
  sunPos: [number, number, number];
  // Fill lights
  ambient: number;
  ambientIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  // Surfaces
  ground: number;
  road: number;
  sidewalk: number;
  // Buildings
  buildingColors: number[]; // length 4
  heightRange: [number, number];
  roughness: number;
  metalness: number;
  windowEmissive: number;
  windowColor: number;
  // Vehicles
  vehicleColors: number[]; // length 4
  vehicleType: VehicleType;
  // Pedestrians
  outfit: PedestrianOutfit;
  shirtColors: number[]; // length 4
  pantsColors: number[]; // length 3
  skinTones: number[]; // length 4
  hatColor: number | null;
  // Signage
  signTexts: string[]; // length 4
  neonColor: number;
  // Streetlights
  lampColor: number;
  lampIntensity: number;
}

export const ERAS: EraConfig[] = [
  // ── 1945 — postwar brick & sepia haze ──────────────────────────────────
  {
    year: 1945,
    label: 'Postwar',
    skyTop: 0x9fb8c9,
    skyBottom: 0xd9c9a8,
    fog: 0xc9b89a,
    fogDensity: 0.012,
    sunColor: 0xfff1d0,
    sunIntensity: 1.15,
    sunPos: [60, 80, 30],
    ambient: 0xb9a987,
    ambientIntensity: 0.6,
    hemiSky: 0xbcd0e0,
    hemiGround: 0x6b5a3c,
    hemiIntensity: 0.6,
    ground: 0x4a4030,
    road: 0x2b2722,
    sidewalk: 0x8a8276,
    buildingColors: [0x8a5a3a, 0x6e6256, 0x7a5340, 0x5f564a],
    heightRange: [9, 17],
    roughness: 0.92,
    metalness: 0.0,
    windowEmissive: 0.85,
    windowColor: 0xffcf7a,
    vehicleColors: [0x6b4a2a, 0x33312e, 0x7a2e22, 0xcfc2a0],
    vehicleType: 'vintage',
    outfit: 'forties',
    shirtColors: [0xe8e4da, 0x6a6f7a, 0x5a4636, 0x3a4a5a],
    pantsColors: [0x2a2a30, 0x4a4030, 0x33373d],
    skinTones: [0xe8b894, 0xc98a5e, 0x8a5a3a, 0xa8704a],
    hatColor: 0x2a2a30,
    signTexts: ['DINER', 'GAS', 'HOTEL', 'TAILOR'],
    neonColor: 0xff8a3a,
    lampColor: 0xffd9a0,
    lampIntensity: 1.1,
  },
  // ── 1965 — mid-century turquoise & chrome ─────────────────────────────
  {
    year: 1965,
    label: 'Mid-Century',
    skyTop: 0x6aa0d8,
    skyBottom: 0xcfe6ff,
    fog: 0xbcd0e0,
    fogDensity: 0.008,
    sunColor: 0xfff4d8,
    sunIntensity: 1.3,
    sunPos: [70, 90, 40],
    ambient: 0xc8d8e8,
    ambientIntensity: 0.7,
    hemiSky: 0x9fc4ec,
    hemiGround: 0x5a6a4a,
    hemiIntensity: 0.7,
    ground: 0x4a5240,
    road: 0x2c2c30,
    sidewalk: 0x9a9a92,
    buildingColors: [0x2f7d8c, 0xd98a3a, 0xb5c4d0, 0x6a6f7a],
    heightRange: [12, 27],
    roughness: 0.5,
    metalness: 0.25,
    windowEmissive: 1.0,
    windowColor: 0x8fd8ff,
    vehicleColors: [0xd23a3a, 0x2a5ad2, 0xf0e0a0, 0x222831],
    vehicleType: 'muscle',
    outfit: 'sixties',
    shirtColors: [0xff5a8a, 0x4ad8c8, 0xffd23a, 0x6a5ad8],
    pantsColors: [0x2a2a40, 0x3a4a6a, 0x5a4a3a],
    skinTones: [0xe8b894, 0xc98a5e, 0x8a5a3a, 0xa8704a],
    hatColor: null,
    signTexts: ['GOGO', 'RECORDS', 'BOWLING', 'DINETTE'],
    neonColor: 0xff5ad8,
    lampColor: 0xffeec8,
    lampIntensity: 1.0,
  },
  // ── 1985 — neon-noir glass towers ─────────────────────────────────────
  {
    year: 1985,
    label: 'Neon Era',
    skyTop: 0x3a2a5a,
    skyBottom: 0xff4a8a,
    fog: 0x5a2a4a,
    fogDensity: 0.014,
    sunColor: 0xff7ad0,
    sunIntensity: 1.0,
    sunPos: [50, 42, 60],
    ambient: 0x3a2a4a,
    ambientIntensity: 0.5,
    hemiSky: 0x6a3a7a,
    hemiGround: 0x2a1a3a,
    hemiIntensity: 0.55,
    ground: 0x2a2030,
    road: 0x1a1a22,
    sidewalk: 0x6a6a72,
    buildingColors: [0x2a2a3a, 0x3a2a4a, 0x1a2a3a, 0x4a2a3a],
    heightRange: [22, 47],
    roughness: 0.16,
    metalness: 0.85,
    windowEmissive: 1.6,
    windowColor: 0x3affd2,
    vehicleColors: [0xc0c0c8, 0x6a3a8a, 0x2a6a8a, 0xdadce0],
    vehicleType: 'sedan',
    outfit: 'eighties',
    shirtColors: [0xff2a6a, 0x2affd2, 0xffe23a, 0x8a2aff],
    pantsColors: [0x222230, 0x3a3a4a, 0x5a4a6a],
    skinTones: [0xe8b894, 0xc98a5e, 0x8a5a3a, 0xa8704a],
    hatColor: null,
    signTexts: ['ARCADE', 'VIDEO', 'MIAMI', 'DISCO'],
    neonColor: 0x2affd2,
    lampColor: 0xff5ad8,
    lampIntensity: 1.5,
  },
  // ── 2005 — clean glass, SUVs, cafe culture ───────────────────────────
  {
    year: 2005,
    label: 'Dot-Com',
    skyTop: 0x7a8a9a,
    skyBottom: 0xc0ccd6,
    fog: 0xaab4c0,
    fogDensity: 0.007,
    sunColor: 0xfff0e0,
    sunIntensity: 1.25,
    sunPos: [65, 95, 35],
    ambient: 0xc0ccd8,
    ambientIntensity: 0.65,
    hemiSky: 0xaec6e0,
    hemiGround: 0x6a6a5a,
    hemiIntensity: 0.7,
    ground: 0x4a4a42,
    road: 0x2e2e32,
    sidewalk: 0x9c9c94,
    buildingColors: [0x7a8a96, 0x8a9aa6, 0x6a7a86, 0x9aa8b4],
    heightRange: [20, 41],
    roughness: 0.3,
    metalness: 0.6,
    windowEmissive: 1.1,
    windowColor: 0xffe9c0,
    vehicleColors: [0x3a4a5a, 0x6a6a6a, 0xaab0b8, 0x5a6a3a],
    vehicleType: 'suv',
    outfit: 'aughts',
    shirtColors: [0x6a8aaa, 0xc0c0c8, 0x3a5a7a, 0x8a8a8a],
    pantsColors: [0x2a3a5a, 0x3a3a3a, 0x4a4a52],
    skinTones: [0xe8b894, 0xc98a5e, 0x8a5a3a, 0xa8704a],
    hatColor: null,
    signTexts: ['CAFE', 'WIFI', 'LOUNGE', 'MART'],
    neonColor: 0x6ad7ff,
    lampColor: 0xfff0d0,
    lampIntensity: 1.0,
  },
  // ── 2025 — sleek glass, EV pods, LED everything ──────────────────────
  {
    year: 2025,
    label: 'Smart City',
    skyTop: 0x123a5a,
    skyBottom: 0x2a6a9a,
    fog: 0x143a52,
    fogDensity: 0.006,
    sunColor: 0xeaf2ff,
    sunIntensity: 1.15,
    sunPos: [80, 100, 50],
    ambient: 0x2a4a6a,
    ambientIntensity: 0.55,
    hemiSky: 0x2a5a8a,
    hemiGround: 0x103040,
    hemiIntensity: 0.6,
    ground: 0x2a3a3a,
    road: 0x18181c,
    sidewalk: 0x80848a,
    buildingColors: [0xdfe6ec, 0xc4d0dc, 0xeef3f8, 0xaebcc8],
    heightRange: [30, 60],
    roughness: 0.12,
    metalness: 0.9,
    windowEmissive: 1.3,
    windowColor: 0x6ad7ff,
    vehicleColors: [0xf2f4f6, 0x1a2a3a, 0xc8d8e0, 0x2a4a6a],
    vehicleType: 'ev',
    outfit: 'twenties',
    shirtColors: [0xf0f0f0, 0x2a2a2e, 0xdadce0, 0x3a6a8a],
    pantsColors: [0x1a1a1e, 0x2a2a30, 0x3a3a40],
    skinTones: [0xe8b894, 0xc98a5e, 0x8a5a3a, 0xa8704a],
    hatColor: null,
    signTexts: ['HUB', 'LAB', 'AI', 'CLOUD'],
    neonColor: 0x6ad7ff,
    lampColor: 0xdfeeff,
    lampIntensity: 1.2,
  },
];

// Reusable temp colours to avoid per-frame allocation.
const _ca = new THREE.Color();
const _cb = new THREE.Color();

/** Interpolate two hex colours and return the resulting hex int. */
export const lerpColorHex = (a: number, b: number, t: number): number => {
  _ca.set(a);
  _cb.set(b);
  _ca.lerp(_cb, t);
  return _ca.getHex();
};

const lerpColorArr = (a: number[], b: number[], t: number): number[] =>
  a.map((v, i) => lerpColorHex(v, b[i], t));

const lerpTuple = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/**
 * Produce a continuously-interpolated EraConfig between `a` (t=0) and `b` (t=1).
 * Discrete fields (vehicle type, outfit, signage) flip to `b` once t >= 0.5 so
 * they stay consistent with the mesh cross-faRdone at the transition midpoint.
 */
export function interpolateEra(a: EraConfig, b: EraConfig, t: number): EraConfig {
  const flip = t < 0.5 ? a : b;
  return {
    year: flip.year,
    label: flip.label,
    skyTop: lerpColorHex(a.skyTop, b.skyTop, t),
    skyBottom: lerpColorHex(a.skyBottom, b.skyBottom, t),
    fog: lerpColorHex(a.fog, b.fog, t),
    fogDensity: lerp(a.fogDensity, b.fogDensity, t),
    sunColor: lerpColorHex(a.sunColor, b.sunColor, t),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    sunPos: lerpTuple(a.sunPos, b.sunPos, t),
    ambient: lerpColorHex(a.ambient, b.ambient, t),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity, t),
    hemiSky: lerpColorHex(a.hemiSky, b.hemiSky, t),
    hemiGround: lerpColorHex(a.hemiGround, b.hemiGround, t),
    hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, t),
    ground: lerpColorHex(a.ground, b.ground, t),
    road: lerpColorHex(a.road, b.road, t),
    sidewalk: lerpColorHex(a.sidewalk, b.sidewalk, t),
    buildingColors: lerpColorArr(a.buildingColors, b.buildingColors, t),
    heightRange: [lerp(a.heightRange[0], b.heightRange[0], t), lerp(a.heightRange[1], b.heightRange[1], t)],
    roughness: lerp(a.roughness, b.roughness, t),
    metalness: lerp(a.metalness, b.metalness, t),
    windowEmissive: lerp(a.windowEmissive, b.windowEmissive, t),
    windowColor: lerpColorHex(a.windowColor, b.windowColor, t),
    vehicleColors: lerpColorArr(a.vehicleColors, b.vehicleColors, t),
    vehicleType: flip.vehicleType,
    outfit: flip.outfit,
    shirtColors: lerpColorArr(a.shirtColors, b.shirtColors, t),
    pantsColors: lerpColorArr(a.pantsColors, b.pantsColors, t),
    skinTones: lerpColorArr(a.skinTones, b.skinTones, t),
    hatColor: flip.hatColor,
    signTexts: flip.signTexts,
    neonColor: lerpColorHex(a.neonColor, b.neonColor, t),
    lampColor: lerpColorHex(a.lampColor, b.lampColor, t),
    lampIntensity: lerp(a.lampIntensity, b.lampIntensity, t),
  };
}
