// Per-era configuration driving every visual + audio aspect of the scene.
// The scene is built ONCE from this data; transitions interpolate properties,
// they never rebuild geometry on slider input.

export interface EraSky {
  top: number;
  horizon: number;
  sunColor: number;
  sunIntensity: number;
  sunAzimuth: number;
  sunElevation: number;
  ambientColor: number;
  ambientIntensity: number;
  hemiSky: number;
  hemiGround: number;
  fogColor: number;
  fogDensity: number;
  stars: number;
  cloudShade: number;
}

export interface EraBloom {
  strength: number;
  threshold: number;
  radius: number;
}

export interface EraBuildings {
  wall: number[];
  roof: number;
  window: number;
  windowIntensity: number;
  heightMin: number;
  heightMax: number;
  accent: number;
  accentIntensity: number;
  glassiness: number;
}

export interface EraVehicles {
  body: number[];
  type: 'retro' | 'classic' | 'boxy' | 'modern' | 'electric' | 'hover' | 'pod';
  speed: number;
  glow: number;
  count: number;
}

export interface EraProps {
  lamp: number;
  lampIntensity: number;
  treeAmount: number;
  signNeon: number;
  signColor: number;
}

export interface EraEffects {
  kind: 'smog' | 'haze' | 'clear' | 'neon' | 'dust' | 'holo' | 'rain';
  color: number;
  density: number;
}

export interface EraAudio {
  base: number;
  cutoff: number;
  detune: number;
  noise: number;
  lfo: number;
  type: OscillatorType;
  reverb: number;
}

export interface EraConfig {
  year: number;
  label: string;
  description: string;
  isNight: boolean;
  toneExposure: number;
  sky: EraSky;
  bloom: EraBloom;
  ground: { ground: number; road: number; sidewalk: number; markings: number };
  buildings: EraBuildings;
  vehicles: EraVehicles;
  props: EraProps;
  effects: EraEffects;
  audio: EraAudio;
}

export const ERAS: EraConfig[] = [
  {
    year: 1945,
    label: '1945',
    description: 'Post-war · brick & brownstone',
    isNight: false,
    toneExposure: 0.9,
    sky: {
      top: 0xb8a06a, horizon: 0xd8c089, sunColor: 0xffe6b0, sunIntensity: 1.6,
      sunAzimuth: 0.7, sunElevation: 0.9, ambientColor: 0x9a8460, ambientIntensity: 0.5,
      hemiSky: 0xb0a070, hemiGround: 0x4a3a28, fogColor: 0xc8b080, fogDensity: 0.018,
      stars: 0, cloudShade: 0.7,
    },
    bloom: { strength: 0.25, threshold: 0.85, radius: 0.4 },
    ground: { ground: 0x6b5a40, road: 0x3a3326, sidewalk: 0x8a7a5c, markings: 0xb8a878 },
    buildings: {
      wall: [0x8a6a48, 0x9a7050, 0x7a5a3c, 0x6b4f34, 0xa07a56],
      roof: 0x4a3a2a, window: 0xffd98a, windowIntensity: 0.25,
      heightMin: 4, heightMax: 9, accent: 0x000000, accentIntensity: 0, glassiness: 0,
    },
    vehicles: {
      body: [0x4a2a1a, 0x2a2a2a, 0x5a3a2a, 0x3a2a2a, 0x6a4a2a], type: 'retro',
      speed: 3.5, glow: 0.4, count: 6,
    },
    props: { lamp: 0xffb060, lampIntensity: 0.35, treeAmount: 0.25, signNeon: 0, signColor: 0x000000 },
    effects: { kind: 'haze', color: 0xc8b080, density: 0.5 },
    audio: { base: 55, cutoff: 320, detune: 8, noise: 0.25, lfo: 0.07, type: 'sine', reverb: 0.5 },
  },
  {
    year: 1960,
    label: '1960',
    description: 'Mid-century · concrete & chrome',
    isNight: false,
    toneExposure: 1.0,
    sky: {
      top: 0x6a93c0, horizon: 0xb0c4d8, sunColor: 0xfff0d0, sunIntensity: 2.0,
      sunAzimuth: 0.55, sunElevation: 1.05, ambientColor: 0x8090a0, ambientIntensity: 0.55,
      hemiSky: 0x90b0d0, hemiGround: 0x504838, fogColor: 0xaec2d4, fogDensity: 0.010,
      stars: 0, cloudShade: 0.5,
    },
    bloom: { strength: 0.3, threshold: 0.82, radius: 0.45 },
    ground: { ground: 0x6a6258, road: 0x30302e, sidewalk: 0x9a9288, markings: 0xe0d8b8 },
    buildings: {
      wall: [0xa89c8a, 0x988878, 0xb0a496, 0x8a7e6c, 0xc0b4a0],
      roof: 0x5a544a, window: 0xbfe0ff, windowIntensity: 0.3,
      heightMin: 6, heightMax: 14, accent: 0x4080a0, accentIntensity: 0.05, glassiness: 0.2,
    },
    vehicles: {
      body: [0xb04030, 0x303060, 0xe0e0e0, 0x2050a0, 0x80a040], type: 'classic',
      speed: 5, glow: 0.5, count: 8,
    },
    props: { lamp: 0xfff0c0, lampIntensity: 0.4, treeAmount: 0.35, signNeon: 0.15, signColor: 0xff6040 },
    effects: { kind: 'haze', color: 0xaec2d4, density: 0.3 },
    audio: { base: 65, cutoff: 420, detune: 6, noise: 0.18, lfo: 0.09, type: 'sine', reverb: 0.45 },
  },
  {
    year: 1980,
    label: '1980',
    description: 'Neon boom · glass towers by night',
    isNight: true,
    toneExposure: 1.15,
    sky: {
      top: 0x140a26, horizon: 0x3a1a3a, sunColor: 0x6a5a9a, sunIntensity: 0.4,
      sunAzimuth: 0.4, sunElevation: 0.25, ambientColor: 0x3a2a4a, ambientIntensity: 0.4,
      hemiSky: 0x2a1a3a, hemiGround: 0x180818, fogColor: 0x241430, fogDensity: 0.022,
      stars: 0.4, cloudShade: 0.3,
    },
    bloom: { strength: 1.1, threshold: 0.55, radius: 0.7 },
    ground: { ground: 0x2a2438, road: 0x141018, sidewalk: 0x3a3048, markings: 0xff60a0 },
    buildings: {
      wall: [0x2a2440, 0x241c38, 0x302850, 0x1c1428, 0x382c58],
      roof: 0x140c22, window: 0xff4090, windowIntensity: 1.2,
      heightMin: 12, heightMax: 34, accent: 0xff3090, accentIntensity: 1.4, glassiness: 0.7,
    },
    vehicles: {
      body: [0x202030, 0x301020, 0x301840, 0x202838, 0x402030], type: 'boxy',
      speed: 7, glow: 1.0, count: 10,
    },
    props: { lamp: 0xff5ab0, lampIntensity: 1.1, treeAmount: 0.2, signNeon: 1.0, signColor: 0xff3090 },
    effects: { kind: 'neon', color: 0xff3090, density: 0.6 },
    audio: { base: 82, cutoff: 600, detune: 12, noise: 0.12, lfo: 0.18, type: 'sawtooth', reverb: 0.7 },
  },
  {
    year: 2000,
    label: '2000',
    description: 'Glass canyons · turn of the millennium',
    isNight: false,
    toneExposure: 1.05,
    sky: {
      top: 0x3a78c0, horizon: 0xa8c8e8, sunColor: 0xfff4e0, sunIntensity: 2.4,
      sunAzimuth: 0.6, sunElevation: 1.15, ambientColor: 0x88a0c0, ambientIntensity: 0.6,
      hemiSky: 0x88a8d0, hemiGround: 0x5a5040, fogColor: 0xa6c4e2, fogDensity: 0.006,
      stars: 0, cloudShade: 0.4,
    },
    bloom: { strength: 0.45, threshold: 0.78, radius: 0.5 },
    ground: { ground: 0x7a7468, road: 0x2a2a2c, sidewalk: 0xb0aaa0, markings: 0xf0e8c8 },
    buildings: {
      wall: [0x88a0b8, 0x6a8aa8, 0xa0b4c8, 0x7490a8, 0x5a7896],
      roof: 0x4a5460, window: 0xa8d0ff, windowIntensity: 0.6,
      heightMin: 16, heightMax: 46, accent: 0x6090d0, accentIntensity: 0.15, glassiness: 0.9,
    },
    vehicles: {
      body: [0x202020, 0xc0c0c0, 0x808088, 0x304060, 0x906040], type: 'modern',
      speed: 8, glow: 0.7, count: 12,
    },
    props: { lamp: 0xffe0a0, lampIntensity: 0.3, treeAmount: 0.45, signNeon: 0.1, signColor: 0x40a0ff },
    effects: { kind: 'clear', color: 0xa6c4e2, density: 0.15 },
    audio: { base: 73, cutoff: 500, detune: 5, noise: 0.14, lfo: 0.11, type: 'sine', reverb: 0.5 },
  },
  {
    year: 2020,
    label: '2020',
    description: 'Contemporary · LED & green streets',
    isNight: false,
    toneExposure: 1.0,
    sky: {
      top: 0x2a8ad8, horizon: 0xc0dcee, sunColor: 0xfff8e8, sunIntensity: 2.5,
      sunAzimuth: 0.65, sunElevation: 1.2, ambientColor: 0x90b4d0, ambientIntensity: 0.62,
      hemiSky: 0x90c0e0, hemiGround: 0x4a5238, fogColor: 0xbcdfee, fogDensity: 0.004,
      stars: 0, cloudShade: 0.35,
    },
    bloom: { strength: 0.5, threshold: 0.75, radius: 0.55 },
    ground: { ground: 0x6a7060, road: 0x28282c, sidewalk: 0xb8b4ac, markings: 0xf8f0d0 },
    buildings: {
      wall: [0xb0b8b8, 0x8aa0a0, 0xc4cccc, 0x6a807a, 0x9aa8a4],
      roof: 0x4a5650, window: 0xb8e8ff, windowIntensity: 0.5,
      heightMin: 18, heightMax: 52, accent: 0x40d0a0, accentIntensity: 0.25, glassiness: 0.85,
    },
    vehicles: {
      body: [0xe8e8ec, 0x202428, 0x2050a0, 0x909098, 0xd04050], type: 'electric',
      speed: 9, glow: 0.9, count: 13,
    },
    props: { lamp: 0xf0f4ff, lampIntensity: 0.35, treeAmount: 0.7, signNeon: 0.2, signColor: 0x40d0a0 },
    effects: { kind: 'clear', color: 0xbcdfee, density: 0.1 },
    audio: { base: 70, cutoff: 560, detune: 4, noise: 0.1, lfo: 0.13, type: 'triangle', reverb: 0.45 },
  },
  {
    year: 2040,
    label: '2040',
    description: 'Near-future · vertical gardens & drones',
    isNight: false,
    toneExposure: 1.1,
    sky: {
      top: 0x2090d0, horizon: 0xc0e8e0, sunColor: 0xeafaff, sunIntensity: 2.6,
      sunAzimuth: 0.5, sunElevation: 1.25, ambientColor: 0x90d0d8, ambientIntensity: 0.66,
      hemiSky: 0x80d8e0, hemiGround: 0x386a48, fogColor: 0xb8eae0, fogDensity: 0.005,
      stars: 0.05, cloudShade: 0.3,
    },
    bloom: { strength: 0.7, threshold: 0.7, radius: 0.6 },
    ground: { ground: 0x5a6a58, road: 0x202830, sidewalk: 0xc0ccc8, markings: 0x80f0d0 },
    buildings: {
      wall: [0xc0d8d0, 0xa0c8c0, 0xd0e0d8, 0x88b0a4, 0xb0d0c8],
      roof: 0x4a6a58, window: 0x80ffe0, windowIntensity: 0.7,
      heightMin: 24, heightMax: 64, accent: 0x40ffd0, accentIntensity: 0.5, glassiness: 0.8,
    },
    vehicles: {
      body: [0xe0f0f0, 0x303840, 0x60a0a0, 0xd0e8e8, 0x406070], type: 'hover',
      speed: 11, glow: 1.2, count: 11,
    },
    props: { lamp: 0xc0fff0, lampIntensity: 0.5, treeAmount: 0.85, signNeon: 0.4, signColor: 0x40ffd0 },
    effects: { kind: 'dust', color: 0x80ffe0, density: 0.4 },
    audio: { base: 78, cutoff: 720, detune: 3, noise: 0.08, lfo: 0.16, type: 'sine', reverb: 0.55 },
  },
  {
    year: 2055,
    label: '2055',
    description: 'Mega-city · holograms & sky-traffic',
    isNight: true,
    toneExposure: 1.2,
    sky: {
      top: 0x0a0a2e, horizon: 0x1a0a3a, sunColor: 0x80ffe0, sunIntensity: 0.5,
      sunAzimuth: 0.35, sunElevation: 0.3, ambientColor: 0x2a3a5a, ambientIntensity: 0.5,
      hemiSky: 0x202a4a, hemiGround: 0x0a1020, fogColor: 0x0e1230, fogDensity: 0.016,
      stars: 0.7, cloudShade: 0.2,
    },
    bloom: { strength: 1.3, threshold: 0.5, radius: 0.8 },
    ground: { ground: 0x141a2e, road: 0x080a14, sidewalk: 0x1e2438, markings: 0x40e0ff },
    buildings: {
      wall: [0x182040, 0x142038, 0x202850, 0x101830, 0x243060],
      roof: 0x080a1a, window: 0x40e0ff, windowIntensity: 1.4,
      heightMin: 34, heightMax: 90, accent: 0x40e0ff, accentIntensity: 1.6, glassiness: 0.9,
    },
    vehicles: {
      body: [0x202840, 0x303848, 0x182030, 0x404858, 0x101828], type: 'pod',
      speed: 14, glow: 1.6, count: 14,
    },
    props: { lamp: 0x60f0ff, lampIntensity: 1.3, treeAmount: 0.6, signNeon: 1.0, signColor: 0x40e0ff },
    effects: { kind: 'holo', color: 0x40e0ff, density: 0.7 },
    audio: { base: 88, cutoff: 900, detune: 2, noise: 0.06, lfo: 0.2, type: 'sine', reverb: 0.75 },
  },
];

export const ERA_COUNT = ERAS.length;
