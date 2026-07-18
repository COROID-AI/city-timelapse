import { Color } from 'three';

/** Convenience color builder so era palettes read as hex. */
const C = (hex: number) => new Color(hex);

export interface EraParams {
  year: number;
  label: string;
  mood: string;
  // Sky / atmosphere
  topColor: Color;
  horizonColor: Color; // also used as fog color for a seamless blend
  fogNear: number;
  fogFar: number;
  // Lighting
  ambientColor: Color;
  ambientIntensity: number;
  sunColor: Color;
  sunIntensity: number;
  sunAzimuth: number; // radians
  sunElevation: number; // radians (negative = below horizon / night)
  hemiSkyColor: Color;
  hemiGroundColor: Color;
  hemiIntensity: number;
  // Color grading
  exposure: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  // Buildings
  buildingColor: Color;
  buildingStories: number;
  buildingRoughness: number;
  buildingMetalness: number;
  windowColor: Color;
  windowEmissive: number;
  // Streets
  asphaltColor: Color;
  sidewalkColor: Color;
  streetlightIntensity: number;
  // Vehicles
  vehicleColor: Color;
  headlightIntensity: number;
}

/**
 * Six eras spanning 1945 -> 2055. This array is the single source of truth
 * for every era-distinct visual parameter; everything else derives from it.
 */
export const ERAS: EraParams[] = [
  {
    // 1945 — post-war, warm hazy daytime, low brick buildings.
    year: 1945,
    label: '1945',
    mood: 'Post-war · hazy afternoon',
    topColor: C(0x9aa6b0),
    horizonColor: C(0xcbb489),
    fogNear: 30,
    fogFar: 150,
    ambientColor: C(0xffe6c2),
    ambientIntensity: 0.85,
    sunColor: C(0xffd9a0),
    sunIntensity: 2.1,
    sunAzimuth: 0.9,
    sunElevation: 0.7,
    hemiSkyColor: C(0xb9c4d0),
    hemiGroundColor: C(0x6b5a44),
    hemiIntensity: 0.7,
    exposure: 1.12,
    bloomStrength: 0.35,
    bloomRadius: 0.5,
    bloomThreshold: 0.85,
    buildingColor: C(0x9a6a45),
    buildingStories: 4,
    buildingRoughness: 0.92,
    buildingMetalness: 0.0,
    windowColor: C(0xffcf87),
    windowEmissive: 0.18,
    asphaltColor: C(0x4a443c),
    sidewalkColor: C(0xb6a994),
    streetlightIntensity: 0.15,
    vehicleColor: C(0x7a4a2a),
    headlightIntensity: 0.1,
  },
  {
    // 1965 — mid-century, cool overcast, concrete.
    year: 1965,
    label: '1965',
    mood: 'Mid-century · overcast',
    topColor: C(0x8fa1b6),
    horizonColor: C(0xb6c2cf),
    fogNear: 34,
    fogFar: 165,
    ambientColor: C(0xdfe7f0),
    ambientIntensity: 0.95,
    sunColor: C(0xfff0dd),
    sunIntensity: 1.7,
    sunAzimuth: 1.1,
    sunElevation: 0.8,
    hemiSkyColor: C(0xaebdd0),
    hemiGroundColor: C(0x5d6066),
    hemiIntensity: 0.8,
    exposure: 1.05,
    bloomStrength: 0.4,
    bloomRadius: 0.55,
    bloomThreshold: 0.82,
    buildingColor: C(0x8d9097),
    buildingStories: 6,
    buildingRoughness: 0.78,
    buildingMetalness: 0.05,
    windowColor: C(0xcfe6ff),
    windowEmissive: 0.28,
    asphaltColor: C(0x3c3f44),
    sidewalkColor: C(0xb3b6bb),
    streetlightIntensity: 0.3,
    vehicleColor: C(0x6b6f76),
    headlightIntensity: 0.15,
  },
  {
    // 1985 — smoggy sunset, neon, smog orange.
    year: 1985,
    label: '1985',
    mood: 'Neon boom · smoggy sunset',
    topColor: C(0x5a3f63),
    horizonColor: C(0xd77a3c),
    fogNear: 26,
    fogFar: 140,
    ambientColor: C(0xffb98a),
    ambientIntensity: 0.7,
    sunColor: C(0xff9a4a),
    sunIntensity: 2.0,
    sunAzimuth: 1.4,
    sunElevation: 0.16,
    hemiSkyColor: C(0xb07a6a),
    hemiGroundColor: C(0x553a3a),
    hemiIntensity: 0.65,
    exposure: 1.0,
    bloomStrength: 0.95,
    bloomRadius: 0.7,
    bloomThreshold: 0.6,
    buildingColor: C(0x5f6b78),
    buildingStories: 9,
    buildingRoughness: 0.5,
    buildingMetalness: 0.25,
    windowColor: C(0xffd27a),
    windowEmissive: 0.7,
    asphaltColor: C(0x33312f),
    sidewalkColor: C(0x9a948c),
    streetlightIntensity: 0.55,
    vehicleColor: C(0x8a5a8a),
    headlightIntensity: 0.5,
  },
  {
    // 2005 — clear dusk, blue glass towers.
    year: 2005,
    label: '2005',
    mood: 'Glass towers · clear dusk',
    topColor: C(0x162a4e),
    horizonColor: C(0x3f6396),
    fogNear: 30,
    fogFar: 160,
    ambientColor: C(0x9fb6e0),
    ambientIntensity: 0.55,
    sunColor: C(0x9fc0ff),
    sunIntensity: 1.2,
    sunAzimuth: 1.7,
    sunElevation: 0.05,
    hemiSkyColor: C(0x3f5f96),
    hemiGroundColor: C(0x2a3340),
    hemiIntensity: 0.6,
    exposure: 1.02,
    bloomStrength: 0.85,
    bloomRadius: 0.6,
    bloomThreshold: 0.55,
    buildingColor: C(0x46566c),
    buildingStories: 14,
    buildingRoughness: 0.22,
    buildingMetalness: 0.6,
    windowColor: C(0xffe6a8),
    windowEmissive: 0.95,
    asphaltColor: C(0x23262b),
    sidewalkColor: C(0x9a9ea6),
    streetlightIntensity: 0.85,
    vehicleColor: C(0x33414d),
    headlightIntensity: 0.85,
  },
  {
    // 2025 — vibrant LED twilight.
    year: 2025,
    label: '2025',
    mood: 'Smart city · LED twilight',
    topColor: C(0x0b1230),
    horizonColor: C(0x2a3a6a),
    fogNear: 26,
    fogFar: 150,
    ambientColor: C(0x8fa6da),
    ambientIntensity: 0.45,
    sunColor: C(0x6f8fd0),
    sunIntensity: 0.7,
    sunAzimuth: 2.0,
    sunElevation: -0.02,
    hemiSkyColor: C(0x22305c),
    hemiGroundColor: C(0x202830),
    hemiIntensity: 0.55,
    exposure: 1.08,
    bloomStrength: 1.15,
    bloomRadius: 0.7,
    bloomThreshold: 0.45,
    buildingColor: C(0x3c5266),
    buildingStories: 20,
    buildingRoughness: 0.16,
    buildingMetalness: 0.72,
    windowColor: C(0xbfe0ff),
    windowEmissive: 1.15,
    asphaltColor: C(0x1d2024),
    sidewalkColor: C(0x9298a0),
    streetlightIntensity: 1.05,
    vehicleColor: C(0x2a3540),
    headlightIntensity: 1.0,
  },
  {
    // 2055 — futuristic neon night, cyan/magenta.
    year: 2055,
    label: '2055',
    mood: 'Neo future · cyan night',
    topColor: C(0x05060f),
    horizonColor: C(0x1a0a30),
    fogNear: 22,
    fogFar: 135,
    ambientColor: C(0x5a78b0),
    ambientIntensity: 0.32,
    sunColor: C(0x3a4f8a),
    sunIntensity: 0.25,
    sunAzimuth: 2.3,
    sunElevation: -0.12,
    hemiSkyColor: C(0x141833),
    hemiGroundColor: C(0x140a1e),
    hemiIntensity: 0.4,
    exposure: 1.05,
    bloomStrength: 1.7,
    bloomRadius: 0.85,
    bloomThreshold: 0.32,
    buildingColor: C(0x33586a),
    buildingStories: 28,
    buildingRoughness: 0.1,
    buildingMetalness: 0.85,
    windowColor: C(0x65f0ff),
    windowEmissive: 1.5,
    asphaltColor: C(0x121319),
    sidewalkColor: C(0x737a86),
    streetlightIntensity: 1.3,
    vehicleColor: C(0x18303a),
    headlightIntensity: 1.25,
  },
];

export const ERA_COUNT = ERAS.length;
export const STORY_HEIGHT = 1.45;
