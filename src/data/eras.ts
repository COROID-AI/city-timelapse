import type { EraData } from '../types';

// Six eras spanning 110 years. Each field is chosen to be visually distinct and
// historically evocative. Sky/lighting move from warm hazy postwar daylight to
// smoggy 70s-80s noon, to clean contemporary dusk, to neon-hued future night.

export const ERAS: EraData[] = [
  // =========================================================================
  // 1945 — POSTWAR DAWN
  // =========================================================================
  {
    index: 0,
    year: 1945,
    label: '1945',
    name: 'Postwar Dawn',
    blurb:
      'Victory gardens and brick walk-ups. Gas lamps fading, radios crackling, the slow rhythm of a city rebuilding.',
    sky: {
      topColor: [0.27, 0.45, 0.66],
      horizonColor: [0.78, 0.74, 0.62],
      fogColor: [0.82, 0.78, 0.66],
      fogNear: 40,
      fogFar: 130,
      sunPosition: [0.45, 0.62, 0.3],
      sunColor: [1.0, 0.92, 0.74],
      sunIntensity: 1.5,
      ambientColor: [0.5, 0.5, 0.52],
      ambientIntensity: 0.55,
      hemiSkyColor: [0.42, 0.56, 0.72],
      hemiGroundColor: [0.42, 0.36, 0.28],
      hemiIntensity: 0.6,
      starIntensity: 0,
      cloudiness: 0.55,
      exposure: 1.05,
    },
    ground: {
      roadColor: [0.18, 0.17, 0.15],
      sidewalkColor: [0.6, 0.58, 0.54],
      grassColor: [0.32, 0.42, 0.2],
      wetness: 0.0,
    },
    vehicles: [
      { bodyColor: [0.32, 0.28, 0.18], roofColor: [0.22, 0.2, 0.14], scale: 1.0, shape: 'classic', speed: 5.5 },
      { bodyColor: [0.5, 0.12, 0.1], roofColor: [0.18, 0.1, 0.08], scale: 1.0, shape: 'classic', speed: 5.5 },
      { bodyColor: [0.1, 0.16, 0.28], roofColor: [0.08, 0.12, 0.2], scale: 1.0, shape: 'classic', speed: 5.0 },
      { bodyColor: [0.46, 0.44, 0.4], roofColor: [0.2, 0.18, 0.16], scale: 1.0, shape: 'classic', speed: 5.5 },
    ],
    pedestrians: [
      { shirtColor: [0.55, 0.5, 0.42], pantsColor: [0.2, 0.2, 0.26], hairColor: [0.12, 0.09, 0.06], scale: 1.0, build: 'suit' },
      { shirtColor: [0.4, 0.32, 0.24], pantsColor: [0.26, 0.22, 0.16], hairColor: [0.2, 0.14, 0.08], scale: 0.96, build: 'suit' },
      { shirtColor: [0.62, 0.56, 0.5], pantsColor: [0.16, 0.18, 0.26], hairColor: [0.08, 0.06, 0.04], scale: 1.02, build: 'suit' },
      { shirtColor: [0.28, 0.3, 0.4], pantsColor: [0.2, 0.2, 0.24], hairColor: [0.3, 0.22, 0.12], scale: 0.98, build: 'suit' },
    ],
    signage: [
      { text: 'CAMEL', background: [0.85, 0.78, 0.5], foreground: [0.2, 0.1, 0.05], glow: 0, style: 'painted' },
      { text: 'COCA-COLA', background: [0.75, 0.1, 0.08], foreground: [0.95, 0.95, 0.9], glow: 0, style: 'painted' },
      { text: 'CITY BANK', background: [0.2, 0.28, 0.4], foreground: [0.85, 0.82, 0.7], glow: 0, style: 'painted' },
    ],
    streetProp: {
      lampColor: [1.0, 0.82, 0.5],
      lampIntensity: 0.0,
      lampStyle: 'gas',
      benchColor: [0.32, 0.22, 0.14],
      treeFoliage: [0.3, 0.42, 0.22],
      treeDensity: 0.5,
    },
    ambient: {
      drone: [55, 82.5, 110],
      rumble: 0.25,
      transient: 0.18,
      gain: 0.4,
    },
  },

  // =========================================================================
  // 1965 — SPACE-AGE OPTIMISM
  // =========================================================================
  {
    index: 1,
    year: 1965,
    label: '1965',
    name: 'Space-Age Optimism',
    blurb:
      'Tail fins and go-go colours. The Interstate hums, television aerials bristle, and optimism paints the town.',
    sky: {
      topColor: [0.22, 0.5, 0.82],
      horizonColor: [0.82, 0.84, 0.78],
      fogColor: [0.86, 0.86, 0.8],
      fogNear: 50,
      fogFar: 160,
      sunPosition: [0.4, 0.75, 0.25],
      sunColor: [1.0, 0.96, 0.86],
      sunIntensity: 1.7,
      ambientColor: [0.55, 0.58, 0.62],
      ambientIntensity: 0.6,
      hemiSkyColor: [0.36, 0.6, 0.85],
      hemiGroundColor: [0.5, 0.42, 0.3],
      hemiIntensity: 0.65,
      starIntensity: 0,
      cloudiness: 0.35,
      exposure: 1.1,
    },
    ground: {
      roadColor: [0.16, 0.16, 0.16],
      sidewalkColor: [0.66, 0.64, 0.6],
      grassColor: [0.3, 0.46, 0.2],
      wetness: 0.0,
    },
    vehicles: [
      { bodyColor: [0.85, 0.72, 0.2], roofColor: [0.2, 0.16, 0.1], scale: 1.12, shape: 'muscle', speed: 7.0 },
      { bodyColor: [0.82, 0.18, 0.22], roofColor: [0.3, 0.12, 0.12], scale: 1.12, shape: 'muscle', speed: 7.0 },
      { bodyColor: [0.2, 0.32, 0.6], roofColor: [0.14, 0.2, 0.36], scale: 1.12, shape: 'muscle', speed: 7.0 },
      { bodyColor: [0.9, 0.9, 0.92], roofColor: [0.6, 0.3, 0.3], scale: 1.12, shape: 'muscle', speed: 7.0 },
      { bodyColor: [0.16, 0.4, 0.26], roofColor: [0.1, 0.24, 0.16], scale: 1.12, shape: 'muscle', speed: 7.0 },
    ],
    pedestrians: [
      { shirtColor: [0.9, 0.2, 0.3], pantsColor: [0.12, 0.12, 0.16], hairColor: [0.1, 0.06, 0.04], scale: 1.0, build: 'mod' },
      { shirtColor: [0.2, 0.4, 0.7], pantsColor: [0.9, 0.88, 0.85], hairColor: [0.18, 0.12, 0.06], scale: 1.0, build: 'mod' },
      { shirtColor: [0.95, 0.85, 0.3], pantsColor: [0.18, 0.2, 0.32], hairColor: [0.08, 0.06, 0.04], scale: 0.98, build: 'mod' },
      { shirtColor: [0.18, 0.5, 0.32], pantsColor: [0.16, 0.16, 0.18], hairColor: [0.24, 0.16, 0.08], scale: 1.02, build: 'mod' },
    ],
    signage: [
      { text: 'FORD', background: [0.1, 0.22, 0.5], foreground: [0.95, 0.95, 0.9], glow: 0.2, style: 'neon' },
      { text: 'MARLBORO', background: [0.85, 0.2, 0.15], foreground: [0.95, 0.92, 0.4], glow: 0.25, style: 'painted' },
      { text: 'MOTEL', background: [0.2, 0.7, 0.6], foreground: [1.0, 1.0, 0.9], glow: 0.3, style: 'neon' },
    ],
    streetProp: {
      lampColor: [1.0, 0.9, 0.65],
      lampIntensity: 0.1,
      lampStyle: 'globe',
      benchColor: [0.3, 0.28, 0.24],
      treeFoliage: [0.28, 0.44, 0.2],
      treeDensity: 0.45,
    },
    ambient: {
      drone: [65, 98, 130],
      rumble: 0.32,
      transient: 0.28,
      gain: 0.42,
    },
  },

  // =========================================================================
  // 1985 — NEON METROPOLIS
  // =========================================================================
  {
    index: 2,
    year: 1985,
    label: '1985',
    name: 'Neon Metropolis',
    blurb:
      'Glass towers and smoggy sunsets. Box sedans crawl past video arcades and banks of glowing CRT billboards.',
    sky: {
      topColor: [0.18, 0.24, 0.46],
      horizonColor: [0.86, 0.46, 0.28],
      fogColor: [0.78, 0.46, 0.34],
      fogNear: 35,
      fogFar: 120,
      sunPosition: [0.32, 0.34, 0.2],
      sunColor: [1.0, 0.62, 0.38],
      sunIntensity: 1.2,
      ambientColor: [0.5, 0.4, 0.46],
      ambientIntensity: 0.5,
      hemiSkyColor: [0.4, 0.34, 0.56],
      hemiGroundColor: [0.5, 0.3, 0.24],
      hemiIntensity: 0.6,
      starIntensity: 0.15,
      cloudiness: 0.5,
      exposure: 1.15,
    },
    ground: {
      roadColor: [0.14, 0.14, 0.15],
      sidewalkColor: [0.56, 0.54, 0.55],
      grassColor: [0.26, 0.36, 0.18],
      wetness: 0.3,
    },
    vehicles: [
      { bodyColor: [0.72, 0.72, 0.74], roofColor: [0.3, 0.3, 0.32], scale: 1.0, shape: 'box', speed: 6.5 },
      { bodyColor: [0.5, 0.5, 0.52], roofColor: [0.22, 0.22, 0.24], scale: 1.0, shape: 'box', speed: 6.5 },
      { bodyColor: [0.2, 0.3, 0.5], roofColor: [0.14, 0.2, 0.34], scale: 1.0, shape: 'box', speed: 6.5 },
      { bodyColor: [0.6, 0.2, 0.2], roofColor: [0.3, 0.14, 0.14], scale: 1.0, shape: 'box', speed: 6.5 },
      { bodyColor: [0.8, 0.78, 0.7], roofColor: [0.4, 0.38, 0.34], scale: 1.0, shape: 'box', speed: 6.5 },
    ],
    pedestrians: [
      { shirtColor: [0.9, 0.2, 0.6], pantsColor: [0.1, 0.1, 0.16], hairColor: [0.06, 0.04, 0.03], scale: 1.0, build: 'casual' },
      { shirtColor: [0.2, 0.6, 0.8], pantsColor: [0.6, 0.5, 0.3], hairColor: [0.2, 0.14, 0.08], scale: 0.98, build: 'casual' },
      { shirtColor: [0.16, 0.16, 0.2], pantsColor: [0.16, 0.16, 0.2], hairColor: [0.1, 0.08, 0.06], scale: 1.0, build: 'casual' },
      { shirtColor: [0.95, 0.9, 0.8], pantsColor: [0.3, 0.3, 0.4], hairColor: [0.24, 0.16, 0.08], scale: 1.02, build: 'casual' },
    ],
    signage: [
      { text: 'SEGA', background: [0.1, 0.1, 0.15], foreground: [0.2, 0.9, 0.6], glow: 0.7, style: 'crt' },
      { text: 'SONY', background: [0.08, 0.08, 0.12], foreground: [0.9, 0.3, 0.9], glow: 0.8, style: 'neon' },
      { text: 'COKE', background: [0.75, 0.1, 0.08], foreground: [0.95, 0.95, 0.9], glow: 0.5, style: 'neon' },
    ],
    streetProp: {
      lampColor: [0.95, 0.85, 0.6],
      lampIntensity: 0.5,
      lampStyle: 'cobra',
      benchColor: [0.2, 0.18, 0.2],
      treeFoliage: [0.26, 0.34, 0.18],
      treeDensity: 0.4,
    },
    ambient: {
      drone: [49, 73, 110],
      rumble: 0.4,
      transient: 0.35,
      gain: 0.45,
    },
  },

  // =========================================================================
  // 2005 — TURN OF THE MILLENNIUM
  // =========================================================================
  {
    index: 3,
    year: 2005,
    label: '2005',
    name: 'Turn of the Millennium',
    blurb:
      'SUVs and smartphones. Curving glass facades, big-box signage, and a cleaner, brighter, busier streetscape.',
    sky: {
      topColor: [0.3, 0.5, 0.78],
      horizonColor: [0.8, 0.82, 0.86],
      fogColor: [0.82, 0.84, 0.88],
      fogNear: 55,
      fogFar: 175,
      sunPosition: [0.42, 0.7, 0.28],
      sunColor: [1.0, 0.95, 0.85],
      sunIntensity: 1.6,
      ambientColor: [0.6, 0.62, 0.66],
      ambientIntensity: 0.62,
      hemiSkyColor: [0.42, 0.6, 0.82],
      hemiGroundColor: [0.5, 0.44, 0.34],
      hemiIntensity: 0.7,
      starIntensity: 0,
      cloudiness: 0.4,
      exposure: 1.1,
    },
    ground: {
      roadColor: [0.15, 0.15, 0.16],
      sidewalkColor: [0.68, 0.66, 0.64],
      grassColor: [0.28, 0.42, 0.2],
      wetness: 0.1,
    },
    vehicles: [
      { bodyColor: [0.18, 0.22, 0.28], roofColor: [0.12, 0.14, 0.18], scale: 1.15, shape: 'suv', speed: 6.0 },
      { bodyColor: [0.8, 0.8, 0.82], roofColor: [0.6, 0.6, 0.62], scale: 1.15, shape: 'suv', speed: 6.0 },
      { bodyColor: [0.5, 0.16, 0.12], roofColor: [0.3, 0.12, 0.1], scale: 1.15, shape: 'suv', speed: 6.0 },
      { bodyColor: [0.3, 0.4, 0.55], roofColor: [0.2, 0.26, 0.36], scale: 1.0, shape: 'box', speed: 6.5 },
      { bodyColor: [0.85, 0.82, 0.5], roofColor: [0.6, 0.58, 0.4], scale: 1.0, shape: 'box', speed: 6.5 },
    ],
    pedestrians: [
      { shirtColor: [0.2, 0.3, 0.5], pantsColor: [0.16, 0.18, 0.24], hairColor: [0.12, 0.08, 0.05], scale: 1.0, build: 'modern' },
      { shirtColor: [0.85, 0.85, 0.88], pantsColor: [0.2, 0.22, 0.28], hairColor: [0.18, 0.12, 0.06], scale: 1.0, build: 'modern' },
      { shirtColor: [0.6, 0.2, 0.3], pantsColor: [0.24, 0.24, 0.3], hairColor: [0.08, 0.06, 0.04], scale: 0.98, build: 'modern' },
      { shirtColor: [0.25, 0.45, 0.3], pantsColor: [0.2, 0.2, 0.24], hairColor: [0.22, 0.16, 0.1], scale: 1.02, build: 'modern' },
    ],
    signage: [
      { text: 'APPLE', background: [0.95, 0.95, 0.95], foreground: [0.1, 0.1, 0.12], glow: 0.1, style: 'led' },
      { text: 'McDONALD\'S', background: [0.85, 0.2, 0.1], foreground: [0.95, 0.8, 0.2], glow: 0.2, style: 'led' },
      { text: 'TARGET', background: [0.85, 0.15, 0.15], foreground: [0.95, 0.95, 0.95], glow: 0.15, style: 'led' },
    ],
    streetProp: {
      lampColor: [0.95, 0.92, 0.8],
      lampIntensity: 0.2,
      lampStyle: 'cobra',
      benchColor: [0.4, 0.4, 0.42],
      treeFoliage: [0.26, 0.4, 0.2],
      treeDensity: 0.6,
    },
    ambient: {
      drone: [55, 82, 123],
      rumble: 0.38,
      transient: 0.3,
      gain: 0.4,
    },
  },

  // =========================================================================
  // 2025 — CONNECTED PRESENT
  // =========================================================================
  {
    index: 4,
    year: 2025,
    label: '2025',
    name: 'Connected Present',
    blurb:
      'Electric vehicles glide past green facades. LED streetlights, ride-share pods, and sky-piercing supertall spires.',
    sky: {
      topColor: [0.16, 0.32, 0.6],
      horizonColor: [0.78, 0.66, 0.56],
      fogColor: [0.74, 0.68, 0.62],
      fogNear: 45,
      fogFar: 155,
      sunPosition: [0.36, 0.5, 0.24],
      sunColor: [1.0, 0.82, 0.62],
      sunIntensity: 1.35,
      ambientColor: [0.52, 0.54, 0.6],
      ambientIntensity: 0.55,
      hemiSkyColor: [0.32, 0.5, 0.72],
      hemiGroundColor: [0.44, 0.36, 0.3],
      hemiIntensity: 0.62,
      starIntensity: 0.1,
      cloudiness: 0.45,
      exposure: 1.12,
    },
    ground: {
      roadColor: [0.13, 0.13, 0.14],
      sidewalkColor: [0.64, 0.62, 0.6],
      grassColor: [0.24, 0.4, 0.18],
      wetness: 0.2,
    },
    vehicles: [
      { bodyColor: [0.92, 0.92, 0.94], roofColor: [0.2, 0.2, 0.24], scale: 1.05, shape: 'ev', speed: 7.5 },
      { bodyColor: [0.16, 0.2, 0.28], roofColor: [0.12, 0.14, 0.2], scale: 1.05, shape: 'ev', speed: 7.5 },
      { bodyColor: [0.5, 0.55, 0.6], roofColor: [0.3, 0.34, 0.38], scale: 1.05, shape: 'ev', speed: 7.5 },
      { bodyColor: [0.85, 0.6, 0.2], roofColor: [0.5, 0.34, 0.12], scale: 1.15, shape: 'suv', speed: 6.5 },
    ],
    pedestrians: [
      { shirtColor: [0.16, 0.16, 0.2], pantsColor: [0.16, 0.16, 0.2], hairColor: [0.1, 0.08, 0.06], scale: 1.0, build: 'athleisure' },
      { shirtColor: [0.85, 0.82, 0.78], pantsColor: [0.2, 0.22, 0.28], hairColor: [0.18, 0.12, 0.06], scale: 1.0, build: 'athleisure' },
      { shirtColor: [0.2, 0.5, 0.6], pantsColor: [0.16, 0.18, 0.24], hairColor: [0.08, 0.06, 0.04], scale: 0.98, build: 'athleisure' },
      { shirtColor: [0.8, 0.3, 0.4], pantsColor: [0.18, 0.18, 0.22], hairColor: [0.22, 0.16, 0.1], scale: 1.02, build: 'athleisure' },
    ],
    signage: [
      { text: 'TESLA', background: [0.1, 0.1, 0.12], foreground: [0.9, 0.4, 0.2], glow: 0.4, style: 'led' },
      { text: 'UBER', background: [0.08, 0.08, 0.1], foreground: [0.2, 0.2, 0.2], glow: 0.0, style: 'led' },
      { text: 'NETFLIX', background: [0.12, 0.1, 0.1], foreground: [0.85, 0.15, 0.15], glow: 0.45, style: 'led' },
    ],
    streetProp: {
      lampColor: [0.8, 0.88, 1.0],
      lampIntensity: 0.35,
      lampStyle: 'led',
      benchColor: [0.3, 0.3, 0.32],
      treeFoliage: [0.24, 0.42, 0.2],
      treeDensity: 0.7,
    },
    ambient: {
      drone: [44, 66, 99],
      rumble: 0.35,
      transient: 0.28,
      gain: 0.38,
    },
  },

  // =========================================================================
  // 2055 — SOLARPUNK FUTURE
  // =========================================================================
  {
    index: 5,
    year: 2055,
    label: '2055',
    name: 'Solarpunk Future',
    blurb:
      'Vertical forests and autonomous pods. Bioluminescent signage, holographic ads, and a cool electric night.',
    sky: {
      topColor: [0.05, 0.08, 0.2],
      horizonColor: [0.2, 0.12, 0.35],
      fogColor: [0.12, 0.1, 0.24],
      fogNear: 38,
      fogFar: 140,
      sunPosition: [0.3, 0.18, 0.2],
      sunColor: [0.5, 0.4, 0.8],
      sunIntensity: 0.4,
      ambientColor: [0.2, 0.18, 0.36],
      ambientIntensity: 0.4,
      hemiSkyColor: [0.12, 0.14, 0.34],
      hemiGroundColor: [0.16, 0.2, 0.28],
      hemiIntensity: 0.5,
      starIntensity: 0.85,
      cloudiness: 0.3,
      exposure: 1.25,
    },
    ground: {
      roadColor: [0.08, 0.08, 0.1],
      sidewalkColor: [0.4, 0.42, 0.48],
      grassColor: [0.14, 0.3, 0.16],
      wetness: 0.6,
    },
    vehicles: [
      { bodyColor: [0.85, 0.88, 0.95], roofColor: [0.2, 0.3, 0.5], scale: 0.95, shape: 'pod', speed: 9.0 },
      { bodyColor: [0.2, 0.6, 0.7], roofColor: [0.1, 0.3, 0.4], scale: 0.95, shape: 'pod', speed: 9.0 },
      { bodyColor: [0.7, 0.4, 0.9], roofColor: [0.3, 0.2, 0.5], scale: 0.95, shape: 'pod', speed: 9.0 },
    ],
    pedestrians: [
      { shirtColor: [0.2, 0.6, 0.5], pantsColor: [0.12, 0.2, 0.24], hairColor: [0.4, 0.2, 0.6], scale: 1.0, build: 'future' },
      { shirtColor: [0.8, 0.5, 0.2], pantsColor: [0.16, 0.18, 0.24], hairColor: [0.2, 0.6, 0.8], scale: 1.0, build: 'future' },
      { shirtColor: [0.5, 0.3, 0.8], pantsColor: [0.14, 0.16, 0.22], hairColor: [0.8, 0.8, 0.85], scale: 0.98, build: 'future' },
      { shirtColor: [0.16, 0.4, 0.7], pantsColor: [0.12, 0.16, 0.2], hairColor: [0.9, 0.4, 0.6], scale: 1.02, build: 'future' },
    ],
    signage: [
      { text: 'NEXUS', background: [0.05, 0.05, 0.1], foreground: [0.2, 0.9, 1.0], glow: 0.9, style: 'hologram' },
      { text: 'GENOM', background: [0.05, 0.05, 0.1], foreground: [0.6, 0.2, 0.95], glow: 0.9, style: 'hologram' },
      { text: 'AETHER', background: [0.05, 0.05, 0.1], foreground: [0.3, 0.95, 0.5], glow: 0.9, style: 'hologram' },
    ],
    streetProp: {
      lampColor: [0.4, 0.7, 1.0],
      lampIntensity: 0.8,
      lampStyle: 'smart',
      benchColor: [0.2, 0.24, 0.3],
      treeFoliage: [0.16, 0.34, 0.16],
      treeDensity: 0.9,
    },
    ambient: {
      drone: [41, 62, 93],
      rumble: 0.25,
      transient: 0.2,
      gain: 0.35,
    },
  },
];
