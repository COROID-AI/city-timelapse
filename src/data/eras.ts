/**
 * Era definition — the single source of truth for the whole experience.
 *
 * Every subsystem (buildings, sky, vehicles, ads, pedestrians, SFX, post)
 * reads from this typed table so that `eraFloat` remains the one coordination
 * point: animating a single floating-point era index sweeps the entire city
 * through history in lockstep.
 */

export const ERA_YEARS = [1945, 1965, 1985, 2005, 2025, 2055] as const;
export type EraYear = (typeof ERA_YEARS)[number];
export const ERA_COUNT = ERA_YEARS.length;

export const ERA_INDEX: Record<EraYear, number> = {
  1945: 0,
  1965: 1,
  1985: 2,
  2005: 3,
  2025: 4,
  2055: 5,
};

export type SkyKind = "sepia" | "hazy" | "smog" | "dawn" | "bright" | "twilight";

export interface SkyConfig {
  top: string;
  bottom: string;
  fog: string;
  kind: SkyKind;
}

export interface LightingConfig {
  /** Sun/hemisphere intensity for the key directional light */
  sun: number;
  /** Warm/cool ambient fill */
  ambient: number;
  /** Sun color */
  sunColor: string;
  /** Sun azimuth/elevation as a normalized pair */
  sunAzimuth: number;
  sunElevation: number;
  /** Per-era window glow intensity multiplier */
  windowGlow: number;
}

export interface BuildingStyle {
  /** base hue 0..1 */
  hue: number;
  saturation: number;
  lightness: number;
  /** height factor 0..1 -> multiplied by base max height */
  heightFactor: number;
  /** facade material descriptor */
  facade: "brick" | "stone" | "concrete" | "glass" | "neo-glass";
  /** window grid density */
  windowDensity: number;
  /** emissive window color */
  windowColor: string;
  /** how many buildings reach "skyscraper" status */
  skylineDensity: number;
}

export interface GroundConfig {
  asphalt: string;
  marking: string;
  sidewalk: string;
  /** 0..1 wetness for reflections */
  wetness: number;
  /** 0..1 debris / detail level */
  grime: number;
}

export interface VehicleStyle {
  body: string;
  roof: string;
  /** "boxy" | "muscle" | "minivan" | "sedan" | "pod" */
  shape: string;
  /** population factor 0..1 (how many on the road) */
  density: number;
  /** scale multiplier */
  scale: number;
  emissive: string;
}

export interface PedestrianStyle {
  torso: string;
  legs: string;
  hair: string;
  shape: "broad" | "slim" | "mixed";
  density: number;
  /** accessory type */
  accessory: "hat" | "none" | "bag" | "glasses" | "visor";
}

export interface BillboardStyle {
  palette: string[];
  text: string;
  emissive: number;
  density: number;
}

export interface PropConfig {
  lampStyle: "cobra" | "globe" | "modern" | "smart";
  lampColor: string;
  lampIntensity: number;
  treeStyle: "elm" | "sapling" | "hedge" | "eco";
  benchStyle: "wood" | "metal" | "smart";
  /** sky-traffic density (blimps/drones) 0..1 */
  skyTraffic: number;
}

export interface SfxConfig {
  /** dominant engine/idle timbre */
  baseFreq: number;
  /** ambient bed type */
  ambience: "wind" | "traffic" | "crowd" | "digital";
  /** shimmer/noise level */
  noise: number;
  /** a short musical motif to arpeggiate on era change */
  motif: number[];
}

export interface EraConfig {
  year: EraYear;
  label: string;
  sky: SkyConfig;
  lighting: LightingConfig;
  buildings: BuildingStyle;
  ground: GroundConfig;
  vehicles: VehicleStyle;
  pedestrians: PedestrianStyle;
  billboards: BillboardStyle;
  props: PropConfig;
  sfx: SfxConfig;
}

export const ERAS: EraConfig[] = [
  {
    year: 1945,
    label: "Post-War",
    sky: { top: "#d9c3a3", bottom: "#efe4cf", fog: "#e2d2b4", kind: "sepia" },
    lighting: {
      sun: 1.15,
      ambient: 0.55,
      sunColor: "#fff1d0",
      sunAzimuth: 0.32,
      sunElevation: 0.55,
      windowGlow: 0.35,
    },
    buildings: {
      hue: 0.07,
      saturation: 0.28,
      lightness: 0.5,
      heightFactor: 0.32,
      facade: "brick",
      windowDensity: 0.55,
      windowColor: "#ffcf7a",
      skylineDensity: 0.1,
    },
    ground: {
      asphalt: "#5a5247",
      marking: "#c9b787",
      sidewalk: "#9b8f74",
      wetness: 0.0,
      grime: 0.45,
    },
    vehicles: {
      body: "#6b2020",
      roof: "#3a1a1a",
      shape: "boxy",
      density: 0.28,
      scale: 1.05,
      emissive: "#ffd27a",
    },
    pedestrians: {
      torso: "#6a5a44",
      legs: "#3a3328",
      hair: "#2a1f16",
      shape: "broad",
      density: 0.4,
      accessory: "hat",
    },
    billboards: {
      palette: ["#b5482f", "#e3c46a", "#3f5a44", "#efe0c2"],
      text: "CITY",
      emissive: 0.15,
      density: 0.25,
    },
    props: {
      lampStyle: "cobra",
      lampColor: "#ffcf7a",
      lampIntensity: 0.4,
      treeStyle: "elm",
      benchStyle: "wood",
      skyTraffic: 0.2,
    },
    sfx: {
      baseFreq: 110,
      ambience: "wind",
      noise: 0.4,
      motif: [220, 277.18, 329.63],
    },
  },
  {
    year: 1965,
    label: "Boom",
    sky: { top: "#8fb6d0", bottom: "#dfeef6", fog: "#c4d6e0", kind: "hazy" },
    lighting: {
      sun: 1.3,
      ambient: 0.6,
      sunColor: "#fff6e0",
      sunAzimuth: 0.36,
      sunElevation: 0.62,
      windowGlow: 0.3,
    },
    buildings: {
      hue: 0.09,
      saturation: 0.18,
      lightness: 0.58,
      heightFactor: 0.52,
      facade: "concrete",
      windowDensity: 0.7,
      windowColor: "#ffe6a8",
      skylineDensity: 0.3,
    },
    ground: {
      asphalt: "#444b50",
      marking: "#e8d27a",
      sidewalk: "#9aa0a4",
      wetness: 0.05,
      grime: 0.3,
    },
    vehicles: {
      body: "#2b5fa0",
      roof: "#ffffff",
      shape: "muscle",
      density: 0.55,
      scale: 1.1,
      emissive: "#ffe6a8",
    },
    pedestrians: {
      torso: "#9c3b54",
      legs: "#1f2a44",
      hair: "#1a1410",
      shape: "slim",
      density: 0.55,
      accessory: "none",
    },
    billboards: {
      palette: ["#d3382f", "#f2c84b", "#2b6fb0", "#ffffff"],
      text: "GO!",
      emissive: 0.3,
      density: 0.5,
    },
    props: {
      lampStyle: "cobra",
      lampColor: "#ffd98a",
      lampIntensity: 0.5,
      treeStyle: "sapling",
      benchStyle: "metal",
      skyTraffic: 0.4,
    },
    sfx: {
      baseFreq: 146.83,
      ambience: "traffic",
      noise: 0.5,
      motif: [293.66, 369.99, 440.0, 587.33],
    },
  },
  {
    year: 1985,
    label: "Neon",
    sky: { top: "#3a4a6a", bottom: "#a07560", fog: "#7a6a5a", kind: "smog" },
    lighting: {
      sun: 0.85,
      ambient: 0.42,
      sunColor: "#ffb074",
      sunAzimuth: 0.28,
      sunElevation: 0.42,
      windowGlow: 0.7,
    },
    buildings: {
      hue: 0.58,
      saturation: 0.12,
      lightness: 0.42,
      heightFactor: 0.74,
      facade: "glass",
      windowDensity: 0.85,
      windowColor: "#ff5ac8",
      skylineDensity: 0.55,
    },
    ground: {
      asphalt: "#2b2730",
      marking: "#d8b850",
      sidewalk: "#6a6670",
      wetness: 0.35,
      grime: 0.55,
    },
    vehicles: {
      body: "#8a8a90",
      roof: "#1a1a20",
      shape: "boxy",
      density: 0.7,
      scale: 0.98,
      emissive: "#ff4ad0",
    },
    pedestrians: {
      torso: "#7a1f6a",
      legs: "#1a1a26",
      hair: "#3aa0d0",
      shape: "mixed",
      density: 0.7,
      accessory: "glasses",
    },
    billboards: {
      palette: ["#ff2fae", "#22e0ff", "#ffe23a", "#7a2fff"],
      text: "NEON",
      emissive: 0.9,
      density: 0.85,
    },
    props: {
      lampStyle: "globe",
      lampColor: "#ff5ad0",
      lampIntensity: 0.9,
      treeStyle: "hedge",
      benchStyle: "metal",
      skyTraffic: 0.5,
    },
    sfx: {
      baseFreq: 196.0,
      ambience: "crowd",
      noise: 0.6,
      motif: [196.0, 233.08, 293.66, 392.0],
    },
  },
  {
    year: 2005,
    label: "Millennial",
    sky: { top: "#6a93c0", bottom: "#cfe3f0", fog: "#bcd0e0", kind: "dawn" },
    lighting: {
      sun: 1.2,
      ambient: 0.62,
      sunColor: "#ffe9c0",
      sunAzimuth: 0.4,
      sunElevation: 0.66,
      windowGlow: 0.45,
    },
    buildings: {
      hue: 0.55,
      saturation: 0.08,
      lightness: 0.62,
      heightFactor: 0.86,
      facade: "glass",
      windowDensity: 0.92,
      windowColor: "#bfe0ff",
      skylineDensity: 0.72,
    },
    ground: {
      asphalt: "#33373c",
      marking: "#f0e0a0",
      sidewalk: "#a8aeb4",
      wetness: 0.15,
      grime: 0.25,
    },
    vehicles: {
      body: "#cfd2d6",
      roof: "#5a5e64",
      shape: "sedan",
      density: 0.85,
      scale: 1.0,
      emissive: "#fff0c0",
    },
    pedestrians: {
      torso: "#3a6a8a",
      legs: "#2a2a36",
      hair: "#2a1f1a",
      shape: "mixed",
      density: 0.85,
      accessory: "bag",
    },
    billboards: {
      palette: ["#2f8fd0", "#7ad07a", "#f2a23a", "#ffffff"],
      text: "iCity",
      emissive: 0.5,
      density: 0.7,
    },
    props: {
      lampStyle: "modern",
      lampColor: "#ffe6b0",
      lampIntensity: 0.6,
      treeStyle: "hedge",
      benchStyle: "metal",
      skyTraffic: 0.3,
    },
    sfx: {
      baseFreq: 174.61,
      ambience: "crowd",
      noise: 0.45,
      motif: [261.63, 329.63, 392.0, 523.25],
    },
  },
  {
    year: 2025,
    label: "Today",
    sky: { top: "#4a7ab0", bottom: "#dceaf5", fog: "#c8dae8", kind: "bright" },
    lighting: {
      sun: 1.35,
      ambient: 0.66,
      sunColor: "#fff4dc",
      sunAzimuth: 0.42,
      sunElevation: 0.7,
      windowGlow: 0.4,
    },
    buildings: {
      hue: 0.52,
      saturation: 0.05,
      lightness: 0.66,
      heightFactor: 0.95,
      facade: "neo-glass",
      windowDensity: 1.0,
      windowColor: "#9fe0ff",
      skylineDensity: 0.85,
    },
    ground: {
      asphalt: "#2e3236",
      marking: "#f5f5f0",
      sidewalk: "#b4bac0",
      wetness: 0.1,
      grime: 0.12,
    },
    vehicles: {
      body: "#e6e8ec",
      roof: "#222226",
      shape: "sedan",
      density: 0.9,
      scale: 1.02,
      emissive: "#cfeaff",
    },
    pedestrians: {
      torso: "#2a2a36",
      legs: "#1a1a22",
      hair: "#4a3a2a",
      shape: "slim",
      density: 0.95,
      accessory: "bag",
    },
    billboards: {
      palette: ["#22c8ff", "#7a5cff", "#26e0a0", "#ffffff"],
      text: "5G",
      emissive: 0.6,
      density: 0.8,
    },
    props: {
      lampStyle: "modern",
      lampColor: "#fff0d0",
      lampIntensity: 0.5,
      treeStyle: "eco",
      benchStyle: "smart",
      skyTraffic: 0.45,
    },
    sfx: {
      baseFreq: 164.81,
      ambience: "digital",
      noise: 0.35,
      motif: [329.63, 392.0, 493.88, 659.25],
    },
  },
  {
    year: 2055,
    label: "Future",
    sky: { top: "#1a2a5a", bottom: "#3a6ab0", fog: "#2a4a8a", kind: "twilight" },
    lighting: {
      sun: 0.7,
      ambient: 0.5,
      sunColor: "#8ac0ff",
      sunAzimuth: 0.22,
      sunElevation: 0.3,
      windowGlow: 1.0,
    },
    buildings: {
      hue: 0.6,
      saturation: 0.2,
      lightness: 0.55,
      heightFactor: 1.0,
      facade: "neo-glass",
      windowDensity: 1.0,
      windowColor: "#39e6ff",
      skylineDensity: 1.0,
    },
    ground: {
      asphalt: "#1a2230",
      marking: "#39e6ff",
      sidewalk: "#3a4660",
      wetness: 0.4,
      grime: 0.0,
    },
    vehicles: {
      body: "#2a3a5a",
      roof: "#39e6ff",
      shape: "pod",
      density: 0.6,
      scale: 0.95,
      emissive: "#39e6ff",
    },
    pedestrians: {
      torso: "#1a2a4a",
      legs: "#0a1428",
      hair: "#39e6ff",
      shape: "slim",
      density: 0.5,
      accessory: "visor",
    },
    billboards: {
      palette: ["#39e6ff", "#7a5cff", "#26e0a0", "#ff5ad0"],
      text: "NEXT",
      emissive: 1.0,
      density: 0.9,
    },
    props: {
      lampStyle: "smart",
      lampColor: "#39e6ff",
      lampIntensity: 1.0,
      treeStyle: "eco",
      benchStyle: "smart",
      skyTraffic: 0.85,
    },
    sfx: {
      baseFreq: 130.81,
      ambience: "digital",
      noise: 0.3,
      motif: [261.63, 392.0, 523.25, 783.99],
    },
  },
];

export function eraByYear(year: EraYear): EraConfig {
  return ERAS[ERA_INDEX[year]];
}
