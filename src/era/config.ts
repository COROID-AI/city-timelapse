/**
 * Era configuration. Six eras spanning 1945 → 2055.
 *
 * `ContinuousSceneConfig` fields are lerped every frame by `sampleEraConfig`
 * (sky/lighting/fog/post-FX). The per-era descriptor fields below are *not*
 * lerped — the scene renders discrete variant groups for buildings, vehicles,
 * pedestrians, signs, etc., and crossfades them with `variantAlpha` so the
 * city visibly timelapses rather than hard-cutting between eras.
 *
 * Colours are stored as 0xRRGGBB numbers so they can be component-interpolated
 * without depending on THREE inside the pure math/interp layer.
 */

export const ERA_YEARS = [1945, 1965, 1985, 2005, 2025, 2055] as const
export type EraYear = (typeof ERA_YEARS)[number]
export const ERA_COUNT = ERA_YEARS.length

export interface ContinuousSceneConfig {
  /** Sky gradient top (zenith). */
  skyTop: number
  /** Sky gradient bottom (horizon). */
  skyBottom: number
  /** Sun/hemisphere directional light colour. */
  sunColor: number
  /** Sun intensity (lux-ish, scene-tuned). */
  sunIntensity: number
  /** Sun azimuth angle in radians (orbit around scene). */
  sunAzimuth: number
  /** Sun elevation angle in radians (above horizon). */
  sunElevation: number
  /** Ambient/hemisphere fill colour. */
  ambientColor: number
  /** Ambient intensity. */
  ambientIntensity: number
  /** Fog colour. */
  fogColor: number
  /** Fog near plane. */
  fogNear: number
  /** Fog far plane. */
  fogFar: number
  /** Ground / road colour. */
  groundColor: number
  /** Bloom strength (post FX). */
  bloom: number
  /** Vignette darkness (post FX, 0..1). */
  vignette: number
  /** Tone-mapping exposure. */
  exposure: number
}

/** Discrete, per-era descriptor. Drives variant builders + UI/audio. */
export interface EraDescriptor {
  year: EraYear
  /** Short human label for the timeline + HUD. */
  name: string
  /** Longer flavour string for the info panel. */
  blurb: string

  buildings: {
    /** Primary facade palette (hex). */
    palette: number[]
    /** Roofline character id used by the building builder. */
    style: 'lowrise' | 'midcentury' | 'glass' | 'eclectic' | 'smart' | 'bio'
    /** Approx number of stories of the dominant towers. */
    height: number
    /** Window emissive glow colour (hex) — neon/office glow. */
    windowGlow: number
    /** Emissive intensity of window grids at night-ish. */
    windowIntensity: number
  }

  vehicles: {
    palette: number[]
    /** Silhouette family used by the vehicle builder. */
    style: 'sedan' | 'muscle' | 'box' | 'suv' | 'pod' | 'hover'
    /** Approx body length (world units). */
    length: number
    /** Roof height. */
    height: number
  }

  pedestrians: {
    palette: number[]
    /** Outfit silhouette used by the pedestrian builder. */
    style: 'civilian' | 'mod' | 'casual' | 'street' | 'tech' | 'future'
    /** Density multiplier for the crowd instancer. */
    density: number
  }

  signs: {
    palette: number[]
    /** Signage family used by the sign builder. */
    style: 'painted' | 'neon' | 'backlit' | 'led' | 'holographic' | 'projection'
    /** Emissive intensity for ads/billboards. */
    intensity: number
  }

  audio: {
    /** Base ambient bed description (drives procedural oscillator tuning). */
    ambient: string
    /** Short motif label (per-era melodic colour). */
    motif: string
    /** Root frequency (Hz) for the era motif — rises across the timeline. */
    root: number
    /** Scale intervals (semitone offsets) for the era motif. */
    scale: number[]
    /** Tempo of rhythmic motifs, in beats per minute. */
    bpm: number
    /** Relative loudness of the era layer (0..1). */
    gain: number
  }
}

export type EraIndex = 0 | 1 | 2 | 3 | 4 | 5

export const ERAS: EraDescriptor[] = [
  {
    year: 1945,
    name: 'Postwar',
    blurb: 'Soot-stained brick, tram wires and a low golden haze over the rooftops.',
    buildings: {
      palette: [0x8a7a5c, 0x6b5d44, 0x9c8b6a, 0x574b38],
      style: 'lowrise',
      height: 5,
      windowGlow: 0xffcf8a,
      windowIntensity: 0.35,
    },
    vehicles: {
      palette: [0x3a3326, 0x5c4a2e, 0x2e2a22, 0x6b5a3a],
      style: 'sedan',
      length: 4.2,
      height: 1.7,
    },
    pedestrians: {
      palette: [0x4a4034, 0x6a5a44, 0x555048, 0x3a3328],
      style: 'civilian',
      density: 0.8,
    },
    signs: {
      palette: [0xc9a24a, 0x9c3b2e, 0x2e4a6b, 0xe0c068],
      style: 'painted',
      intensity: 0.25,
    },
    audio: {
      ambient: 'Distant tram bell & warm tube hum',
      motif: 'Swing clarinet',
      root: 196,
      scale: [0, 3, 5, 7, 10],
      bpm: 96,
      gain: 0.55,
    },
  },
  {
    year: 1965,
    name: 'Midcentury',
    blurb: 'Concrete slabs, chrome fenders and the first electric glow of neon.',
    buildings: {
      palette: [0xb8b2a4, 0x7d7a6e, 0xa39c8c, 0x969086],
      style: 'midcentury',
      height: 9,
      windowGlow: 0xffe6b0,
      windowIntensity: 0.5,
    },
    vehicles: {
      palette: [0xb23a2e, 0x2e4a7a, 0xd8d2c4, 0x2e2e2e],
      style: 'muscle',
      length: 5,
      height: 1.5,
    },
    pedestrians: {
      palette: [0x2a2a3a, 0x8a6a3a, 0x5a4030, 0xc8c0b0],
      style: 'mod',
      density: 1,
    },
    signs: {
      palette: [0xff3b5c, 0x2effd0, 0xffd23b, 0x5b8cff],
      style: 'neon',
      intensity: 0.8,
    },
    audio: {
      ambient: 'Reverb guitar wash & fuzz bass',
      motif: 'Go-go organ',
      root: 220,
      scale: [0, 2, 4, 7, 9],
      bpm: 112,
      gain: 0.6,
    },
  },
  {
    year: 1985,
    name: 'Neon Boom',
    blurb: 'Mirrored glass, boxy sedans and saturated neon competing with smog.',
    buildings: {
      palette: [0x3a4a5c, 0x4a5c6e, 0x5c6e80, 0x2a3a4a],
      style: 'glass',
      height: 14,
      windowGlow: 0x8fd8ff,
      windowIntensity: 0.7,
    },
    vehicles: {
      palette: [0x7a7a7a, 0x4a4a5a, 0x8a4a2a, 0x2a2a2a],
      style: 'box',
      length: 4.6,
      height: 1.5,
    },
    pedestrians: {
      palette: [0x2a5a7a, 0x8a2a5a, 0x5a8a2a, 0x2a2a2a],
      style: 'casual',
      density: 1.1,
    },
    signs: {
      palette: [0xff2a8f, 0x2afff0, 0xb02aff, 0xfff02a],
      style: 'backlit',
      intensity: 1,
    },
    audio: {
      ambient: 'Gated reverb drums & synth brass',
      motif: 'FM brass stab',
      root: 246,
      scale: [0, 3, 5, 6, 7, 10],
      bpm: 118,
      gain: 0.7,
    },
  },
  {
    year: 2005,
    name: 'Glass & Steel',
    blurb: 'Towering curtain walls, black SUVs and crisp LED billboards.',
    buildings: {
      palette: [0x2e3a44, 0x3a4a5a, 0x4a5a6a, 0x6a7a8a],
      style: 'eclectic',
      height: 20,
      windowGlow: 0xaee8ff,
      windowIntensity: 0.85,
    },
    vehicles: {
      palette: [0x1a1a1a, 0x9a9a9a, 0x2a3a4a, 0x6a6a6a],
      style: 'suv',
      length: 4.8,
      height: 1.9,
    },
    pedestrians: {
      palette: [0x2a2a2a, 0x4a4a5a, 0x6a5a4a, 0x3a3a4a],
      style: 'street',
      density: 1.3,
    },
    signs: {
      palette: [0x2a8aff, 0xff2a6a, 0x2aff8a, 0xffaa2a],
      style: 'led',
      intensity: 1.1,
    },
    audio: {
      ambient: 'Filtered house pad & digital clicks',
      motif: 'Pluck arpeggio',
      root: 277,
      scale: [0, 4, 7, 11],
      bpm: 124,
      gain: 0.75,
    },
  },
  {
    year: 2025,
    name: 'Smart City',
    blurb: 'Adaptive facades, rideshare EVs and quiet holographic wayfinding.',
    buildings: {
      palette: [0x2a3a4a, 0x3a4a5a, 0x4a5a7a, 0x5a6a8a],
      style: 'smart',
      height: 26,
      windowGlow: 0x6affd8,
      windowIntensity: 0.9,
    },
    vehicles: {
      palette: [0xeaeaea, 0x2a2a2a, 0x4a4a6a, 0x8a8a9a],
      style: 'pod',
      length: 4.2,
      height: 1.7,
    },
    pedestrians: {
      palette: [0x1a1a2a, 0x4a4a6a, 0x6a6a8a, 0x2a3a4a],
      style: 'tech',
      density: 1.4,
    },
    signs: {
      palette: [0x2affd0, 0xff2a8a, 0x8a2aff, 0x2a8aff],
      style: 'holographic',
      intensity: 1.2,
    },
    audio: {
      ambient: 'Granular drone & soft UI blips',
      motif: 'Bell arp',
      root: 311,
      scale: [0, 2, 5, 7, 9],
      bpm: 100,
      gain: 0.7,
    },
  },
  {
    year: 2055,
    name: 'Eco Future',
    blurb: 'Living green towers, silent hover traffic and luminous projection ads.',
    buildings: {
      palette: [0x2a4a3a, 0x3a5a4a, 0x4a6a5a, 0x5a8a6a],
      style: 'bio',
      height: 32,
      windowGlow: 0x9affc0,
      windowIntensity: 1,
    },
    vehicles: {
      palette: [0xcfeaff, 0x2a4a5a, 0x4affc0, 0x6a8aff],
      style: 'hover',
      length: 5,
      height: 1.4,
    },
    pedestrians: {
      palette: [0x2affd0, 0xff8acf, 0x8ab0ff, 0xc0ffc0],
      style: 'future',
      density: 1.2,
    },
    signs: {
      palette: [0x4affc0, 0xff5acf, 0x5acfff, 0xfff04a],
      style: 'projection',
      intensity: 1.3,
    },
    audio: {
      ambient: 'Shimmering pad & airy sweeps',
      motif: 'Glass marimba',
      root: 349,
      scale: [0, 2, 4, 7, 9],
      bpm: 92,
      gain: 0.65,
    },
  },
]

/** Continuous, frame-lerped scene parameters — one entry per era. */
export const SCENE_CONFIG: ContinuousSceneConfig[] = [
  {
    // 1945 — warm golden, low sun, sooty haze
    skyTop: 0x4a5a6a,
    skyBottom: 0xc89a5a,
    sunColor: 0xffd9a0,
    sunIntensity: 1.7,
    sunAzimuth: Math.PI * 0.28,
    sunElevation: Math.PI * 0.16,
    ambientColor: 0x9a8a6a,
    ambientIntensity: 0.5,
    fogColor: 0x9a8466,
    fogNear: 22,
    fogFar: 90,
    groundColor: 0x6a5a44,
    bloom: 0.25,
    vignette: 0.45,
    exposure: 1.05,
  },
  {
    // 1965 — clearer blue, higher sun, mild haze
    skyTop: 0x2a4a7a,
    skyBottom: 0xb4c4d4,
    sunColor: 0xfff0d0,
    sunIntensity: 2.1,
    sunAzimuth: Math.PI * 0.34,
    sunElevation: Math.PI * 0.24,
    ambientColor: 0x8090a0,
    ambientIntensity: 0.6,
    fogColor: 0xb0b8c0,
    fogNear: 30,
    fogFar: 110,
    groundColor: 0x555048,
    bloom: 0.4,
    vignette: 0.4,
    exposure: 1.05,
  },
  {
    // 1985 — dusk magenta, smoggy neon
    skyTop: 0x2a1a3a,
    skyBottom: 0xc43a6a,
    sunColor: 0xff8a5a,
    sunIntensity: 1.5,
    sunAzimuth: Math.PI * 0.42,
    sunElevation: Math.PI * 0.12,
    ambientColor: 0x5a3a5a,
    ambientIntensity: 0.55,
    fogColor: 0x5a2a44,
    fogNear: 18,
    fogFar: 80,
    groundColor: 0x2a2434,
    bloom: 0.9,
    vignette: 0.55,
    exposure: 1.1,
  },
  {
    // 2005 — bright overcast glassy day
    skyTop: 0x3a4a5a,
    skyBottom: 0xaec4d4,
    sunColor: 0xeef4ff,
    sunIntensity: 2.3,
    sunAzimuth: Math.PI * 0.5,
    sunElevation: Math.PI * 0.3,
    ambientColor: 0x9aa6b4,
    ambientIntensity: 0.7,
    fogColor: 0xaeb8c4,
    fogNear: 34,
    fogFar: 120,
    groundColor: 0x3a3a40,
    bloom: 0.55,
    vignette: 0.35,
    exposure: 1.0,
  },
  {
    // 2025 — clean teal dawn, smart-city glow
    skyTop: 0x123a4a,
    skyBottom: 0x4ac4b4,
    sunColor: 0xd8fff0,
    sunIntensity: 2.0,
    sunAzimuth: Math.PI * 0.58,
    sunElevation: Math.PI * 0.2,
    ambientColor: 0x3a6a6a,
    ambientIntensity: 0.65,
    fogColor: 0x2a5a5a,
    fogNear: 28,
    fogFar: 100,
    groundColor: 0x2a3a3a,
    bloom: 0.75,
    vignette: 0.4,
    exposure: 1.05,
  },
  {
    // 2055 — luminous green-aurora night
    skyTop: 0x04121a,
    skyBottom: 0x1a6a4a,
    sunColor: 0x8affd0,
    sunIntensity: 1.6,
    sunAzimuth: Math.PI * 0.66,
    sunElevation: Math.PI * 0.1,
    ambientColor: 0x2a6a4a,
    ambientIntensity: 0.6,
    fogColor: 0x0a2a24,
    fogNear: 20,
    fogFar: 95,
    groundColor: 0x123a2a,
    bloom: 1.1,
    vignette: 0.5,
    exposure: 1.15,
  },
]

/** Convenience: the descriptor for a given era index (0..5). */
export function getEra(index: number): EraDescriptor {
  return ERAS[clampInt(index, 0, ERA_COUNT - 1)]
}

function clampInt(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(x)))
}
