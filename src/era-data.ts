/**
 * EraData — canonical era-varying visual contract for the city block.
 *
 * This module is the single source of truth every era-content task reads:
 * buildings, storefronts, billboards, vehicles, pedestrians, atmosphere and
 * street lighting all consume `ERA_DATA` instead of hard-coding per-era
 * values. Downstream tasks import from this file — they must never edit it.
 *
 * Timeline surface: the repository's concrete timeline (README, main.ts,
 * e2e, eras.ts) runs six eras 1945–2055, so this model is populated for all
 * six. The five eras named in the task brief (1945/1965/1985/2005/2025) are
 * all present and complete; '2055' is included so every timeline position has
 * its own full visual profile, matching the precedent set in `src/eras.ts`.
 *
 * The `audio` subsystem is shared from `SFX_ERA_DATA` by reference so the
 * auditory mood stays on the same data spine — one era change always moves
 * visuals and sound together.
 */

import type { EraId, SfxEraData } from './eras'
import { SFX_ERA_DATA } from './eras'

export type LampStyle =
  | 'gas' // 1945 gas mantles on cast-iron posts
  | 'chrome' // 1965 chrome-and-white pole heads
  | 'sodium' // 1985 high-pressure sodium orange glow
  | 'led' // 2005/2025 neutral white LED
  | 'hologram' // 2055 teal/cyan holographic light source

export type BuildingMaterial = 'brick' | 'pastel' | 'concrete' | 'glass' | 'composite'

export type WindowStyle = 'grid' | 'pane' | 'strip' | 'curtain' | 'hologram'

export type RoofFlavor = 'flat' | 'stepped' | 'mechanical' | 'deck' | 'spire'

export type BillboardStyle = 'painted' | 'neon' | 'sodium_lit' | 'led' | 'hologram'

export type AdMotion = 'static' | 'marquee' | 'animated' | 'scrolling' | 'holographic'

export type ParticleKind = 'dust' | 'smog' | 'neon_flakes' | 'clean' | 'hologram'

export type ToneGrade = 'sepia' | 'pastel' | 'neon' | 'neutral' | 'vivid'

/** Architecture: facade materials, heights, window treatment, roof, glow. */
export interface EraArchitecture {
  /** Human-readable style label, e.g. "post-war brick". */
  styleLabel: string
  material: BuildingMaterial
  /** Exterior wall palette, hex colors. */
  facadePalette: readonly number[]
  /** Trims, doors and corner accents. */
  accentPalette: readonly number[]
  /** Min/max building height in world units for the placeholder plot slabs. */
  heightRange: readonly [number, number]
  windowStyle: WindowStyle
  /** 0..1 — warm (incandescent) toward cool (cold glass). */
  windowWarmth: number
  roofFlavor: RoofFlavor
  /** Emissive accent color for glowing architecture (neon / teal / ...). */
  emissiveColor: number
  /** Emissive strength, 0..3. */
  emissiveIntensity: number
  roughness: number
  metalness: number
}

/** Storefronts: awnings, window density, sign color language. */
export interface EraStorefront {
  awningStyle: string
  awningPalette: readonly number[]
  signStyle: string
  /** Sign band colors snapped onto plot fronts by the layout. */
  signColors: readonly number[]
  /** 0..1 — warm shop-window light. */
  glassWarmth: number
  /** 0..1 — how densely windows cover the facade. */
  windowDensity: number
}

/** Advertising: billboard treatment, era headlines, motion. */
export interface EraAdvertising {
  billboardStyle: BillboardStyle
  billboardPalette: readonly number[]
  /** Era landmark headline for the primary billboard. */
  headline: string
  subheadline: string
  motion: AdMotion
  /** Emissive strength of ad surfaces, 0..3. */
  emissiveIntensity: number
}

/** Vehicles: traffic profile used by the vehicle lane task. */
export interface EraVehicles {
  styleLabel: string
  palette: readonly number[]
  /** Vehicle archetypes (trolley, chrome coupe, EV, drone, ...). */
  types: readonly string[]
  /** 0..1 traffic density. */
  density: number
  /** Travel speed range in world units/sec. */
  speedRange: readonly [number, number]
  /** 0..1 — chrome/trim reflectivity. */
  chromeAmount: number
  headlightColor: number
  taillightColor: number
}

/** Pedestrians: outfit palette and sidewalk density. */
export interface EraPedestrians {
  styleLabel: string
  palette: readonly number[]
  outfit: readonly string[]
  /** 0..1 sidewalk density. */
  density: number
  /** Walk speed range in world units/sec. */
  speedRange: readonly [number, number]
}

/** Atmosphere: sky/fog/sun/particle grade consumed by the sky & fx tasks. */
export interface EraAtmosphere {
  skyTop: number
  skyHorizon: number
  skyBottom: number
  fogColor: number
  fogNear: number
  fogFar: number
  sunColor: number
  sunIntensity: number
  ambientColor: number
  ambientIntensity: number
  hemisphereSky: number
  hemisphereGround: number
  hemisphereIntensity: number
  particleKind: ParticleKind
  particleColor: number
  particleDensity: number
  tone: ToneGrade
  /** 0..2 color saturation grade. */
  saturation: number
  /** 0..2 contrast grade. */
  contrast: number
}

/** Lighting & street layout surface colors consumed by the CityBlock layout. */
export interface EraLighting {
  lampStyle: LampStyle
  /** Emissive color of lamp heads (gas flame, sodium, LED, hologram). */
  lampHeadColor: number
  /** Lamp glow strength, 0..5. */
  lampHeadIntensity: number
  lampPoleColor: number
  /** Street lamp pole height in world units. */
  lampHeight: number
  /** Horizontal reach of the lamp arm toward the road. */
  lampArmReach: number
  roadSurfaceColor: number
  /** Solid edge line color. */
  laneMarkingColor: number
  /** Center lane divider color (yellow starts in the auto era). */
  dashedMarkingColor: number
  sidewalkColor: number
  curbColor: number
  crosswalkColor: number
}

/** The complete era-varying contract for one timeline position. */
export interface EraData {
  era: EraId
  year: number
  architecture: EraArchitecture
  storefronts: EraStorefront
  advertising: EraAdvertising
  vehicles: EraVehicles
  pedestrians: EraPedestrians
  atmosphere: EraAtmosphere
  lighting: EraLighting
  /** Shared mood spine from src/eras.ts — audio and visuals move together. */
  audio: SfxEraData
}

export const ERA_DATA: Record<EraId, EraData> = {
  '1945': {
    era: '1945',
    year: 1945,
    architecture: {
      styleLabel: 'Post-war brick and terracotta',
      material: 'brick',
      facadePalette: [0x9c6b4f, 0x8a5a42, 0xa97c5f, 0x7d5139, 0xb5896a],
      accentPalette: [0xd8c3a0, 0xcbb08a, 0x6e4a33],
      heightRange: [6, 14],
      windowStyle: 'grid',
      windowWarmth: 0.65,
      roofFlavor: 'stepped',
      emissiveColor: 0xffd9a0,
      emissiveIntensity: 0.6,
      roughness: 0.9,
      metalness: 0.05,
    },
    storefronts: {
      awningStyle: 'canvas',
      awningPalette: [0xa35f3d, 0x7d5139, 0x4e6e58],
      signStyle: 'painted',
      signColors: [0xd8c3a0, 0x8a5a42, 0x3a3a33],
      glassWarmth: 0.7,
      windowDensity: 0.45,
    },
    advertising: {
      billboardStyle: 'painted',
      billboardPalette: [0x8a5a42, 0xd8c3a0, 0x3a3a33],
      headline: 'WAR BONDS',
      subheadline: 'BUY THEM TODAY',
      motion: 'static',
      emissiveIntensity: 0.4,
    },
    vehicles: {
      styleLabel: 'Trolleys, panel trucks and pre-war sedans',
      palette: [0x3b3b3b, 0x5a2d2d, 0x2f3b4c, 0x6e5a3a],
      types: ['trolley', 'panel truck', 'vintage sedan', 'delivery wagon'],
      density: 0.18,
      speedRange: [8, 16],
      chromeAmount: 0.25,
      headlightColor: 0xfff2cc,
      taillightColor: 0xb32424,
    },
    pedestrians: {
      styleLabel: 'Wool coats, fedoras and work overalls',
      palette: [0x6d5a4f, 0x8a7a6a, 0x4d443c],
      outfit: ['wool coat', 'fedora hat', 'ankle skirt', 'work overalls'],
      density: 0.25,
      speedRange: [1.1, 1.5],
    },
    atmosphere: {
      skyTop: 0x9db8d9,
      skyHorizon: 0xd8c9a8,
      skyBottom: 0xcfbf9c,
      fogColor: 0xcfbf9c,
      fogNear: 30,
      fogFar: 150,
      sunColor: 0xfff3dd,
      sunIntensity: 2.6,
      ambientColor: 0xffffff,
      ambientIntensity: 0.5,
      hemisphereSky: 0xcfe0f2,
      hemisphereGround: 0x9a8468,
      hemisphereIntensity: 0.75,
      particleKind: 'dust',
      particleColor: 0xdcb48c,
      particleDensity: 0.25,
      tone: 'sepia',
      saturation: 0.85,
      contrast: 0.95,
    },
    lighting: {
      lampStyle: 'gas',
      lampHeadColor: 0xffc98a,
      lampHeadIntensity: 2.2,
      lampPoleColor: 0x3a3a33,
      lampHeight: 3.1,
      lampArmReach: 0.8,
      roadSurfaceColor: 0x70706a,
      laneMarkingColor: 0xf2efe4,
      dashedMarkingColor: 0xf2efe4,
      sidewalkColor: 0xb8b0a0,
      curbColor: 0x8f887a,
      crosswalkColor: 0xefe9da,
    },
    audio: SFX_ERA_DATA['1945'],
  },
  '1965': {
    era: '1965',
    year: 1965,
    architecture: {
      styleLabel: 'Mid-century pastel storefronts',
      material: 'pastel',
      facadePalette: [0xcfe0cf, 0xd9c8c2, 0xc4d2d9, 0xe3d5c0, 0xc9cfe0],
      accentPalette: [0xf2e6c9, 0xf7c9c9, 0xa8c4a8],
      heightRange: [8, 18],
      windowStyle: 'pane',
      windowWarmth: 0.5,
      roofFlavor: 'flat',
      emissiveColor: 0xff6ec7,
      emissiveIntensity: 1.2,
      roughness: 0.7,
      metalness: 0.12,
    },
    storefronts: {
      awningStyle: 'metal',
      awningPalette: [0xf2e6c9, 0xd9b8c0, 0x9aa8c4],
      signStyle: 'neon_tube',
      signColors: [0xff6ec7, 0x3fd0ff, 0xffd23f],
      glassWarmth: 0.5,
      windowDensity: 0.55,
    },
    advertising: {
      billboardStyle: 'neon',
      billboardPalette: [0xff6ec7, 0x3fd0ff, 0xffd23f],
      headline: 'COCA-COLA 5¢',
      subheadline: 'DRINK ICE COLD',
      motion: 'marquee',
      emissiveIntensity: 1.2,
    },
    vehicles: {
      styleLabel: 'Chrome classics and convertibles',
      palette: [0xe8e0d0, 0xb0c4de, 0xd0b8c8, 0x3f7d5a],
      types: ['chrome coupe', 'classic convertible', 'vintage scooter', 'delivery truck'],
      density: 0.32,
      speedRange: [10, 18],
      chromeAmount: 0.7,
      headlightColor: 0xffffff,
      taillightColor: 0xc02020,
    },
    pedestrians: {
      styleLabel: 'Mod dresses and crisp suits',
      palette: [0xd9b8c0, 0x9aa8c4, 0xc0b8a8],
      outfit: ['mod dress', 'suit and tie', 'cap and blazer'],
      density: 0.35,
      speedRange: [1.15, 1.55],
    },
    atmosphere: {
      skyTop: 0xaed4e8,
      skyHorizon: 0xf2e9d8,
      skyBottom: 0xf4d8c4,
      fogColor: 0xf0e4d2,
      fogNear: 30,
      fogFar: 170,
      sunColor: 0xfff1d8,
      sunIntensity: 2.8,
      ambientColor: 0xffffff,
      ambientIntensity: 0.55,
      hemisphereSky: 0xcde8f8,
      hemisphereGround: 0xd9c8b0,
      hemisphereIntensity: 0.8,
      particleKind: 'dust',
      particleColor: 0xe6cd9e,
      particleDensity: 0.15,
      tone: 'pastel',
      saturation: 1.05,
      contrast: 1.0,
    },
    lighting: {
      lampStyle: 'chrome',
      lampHeadColor: 0xfff4e0,
      lampHeadIntensity: 2.6,
      lampPoleColor: 0x555452,
      lampHeight: 4.2,
      lampArmReach: 1.0,
      roadSurfaceColor: 0x6e6e6a,
      laneMarkingColor: 0xf5f0e4,
      dashedMarkingColor: 0xf5f0e4,
      sidewalkColor: 0xc6c2b8,
      curbColor: 0x97938a,
      crosswalkColor: 0xf5f0e4,
    },
    audio: SFX_ERA_DATA['1965'],
  },
  '1985': {
    era: '1985',
    year: 1985,
    architecture: {
      styleLabel: 'Concrete and glass with bright neon',
      material: 'concrete',
      facadePalette: [0x8d8d8f, 0x9a9aa0, 0x7c7e84, 0x6f7378, 0x2a3a4a],
      accentPalette: [0xffd23f, 0xff5eaa, 0x3fd0ff],
      heightRange: [10, 30],
      windowStyle: 'strip',
      windowWarmth: 0.35,
      roofFlavor: 'mechanical',
      emissiveColor: 0xff3f8e,
      emissiveIntensity: 1.8,
      roughness: 0.55,
      metalness: 0.25,
    },
    storefronts: {
      awningStyle: 'plastic',
      awningPalette: [0xd94f7a, 0xffd23f, 0x3a6ea8],
      signStyle: 'neon_box',
      signColors: [0xff3f8e, 0xffd23f, 0x3fd0ff],
      glassWarmth: 0.35,
      windowDensity: 0.7,
    },
    advertising: {
      billboardStyle: 'neon',
      billboardPalette: [0xff3f8e, 0xffd23f, 0x3fd0ff],
      headline: "McDONALD'S",
      subheadline: 'OVER 20 BILLION SERVED',
      motion: 'animated',
      emissiveIntensity: 1.8,
    },
    vehicles: {
      styleLabel: 'Boxy sedans, muscle cars and taxis',
      palette: [0x3c4046, 0xa32638, 0xcfcfcf, 0xf2c14e],
      types: ['boxy sedan', 'muscle car', 'van', 'taxi'],
      density: 0.5,
      speedRange: [9, 19],
      chromeAmount: 0.4,
      headlightColor: 0xfff2cc,
      taillightColor: 0xcc2222,
    },
    pedestrians: {
      styleLabel: 'Members-only jackets and neon windbreakers',
      palette: [0x1a2f5a, 0x8f9fb8, 0xd94f7a],
      outfit: ['members only jacket', 'acid wash jeans', 'neon windbreaker'],
      density: 0.5,
      speedRange: [1.2, 1.6],
    },
    atmosphere: {
      skyTop: 0x8fa6bf,
      skyHorizon: 0xe0d6c0,
      skyBottom: 0xd8b890,
      fogColor: 0xd8c6a8,
      fogNear: 25,
      fogFar: 130,
      sunColor: 0xffe9c4,
      sunIntensity: 2.9,
      ambientColor: 0xffffff,
      ambientIntensity: 0.5,
      hemisphereSky: 0xbfd4ea,
      hemisphereGround: 0x9a8878,
      hemisphereIntensity: 0.8,
      particleKind: 'smog',
      particleColor: 0xb8a888,
      particleDensity: 0.5,
      tone: 'neon',
      saturation: 1.3,
      contrast: 1.15,
    },
    lighting: {
      lampStyle: 'sodium',
      lampHeadColor: 0xffb347,
      lampHeadIntensity: 3.4,
      lampPoleColor: 0x3f3f3f,
      lampHeight: 5.6,
      lampArmReach: 1.2,
      roadSurfaceColor: 0x55555a,
      laneMarkingColor: 0xf5d55a,
      dashedMarkingColor: 0xf5d55a,
      sidewalkColor: 0x9a9a94,
      curbColor: 0x78787a,
      crosswalkColor: 0xf2e6c8,
    },
    audio: SFX_ERA_DATA['1985'],
  },
  '2005': {
    era: '2005',
    year: 2005,
    architecture: {
      styleLabel: 'Glass curtain walls and steel',
      material: 'glass',
      facadePalette: [0x3f5f7a, 0x4a6a8a, 0x5a7a92, 0x304b5f, 0x6b8aa0],
      accentPalette: [0x7fd0ff, 0xbfe6ff, 0x9aa7b0],
      heightRange: [12, 40],
      windowStyle: 'curtain',
      windowWarmth: 0.2,
      roofFlavor: 'mechanical',
      emissiveColor: 0xbfe6ff,
      emissiveIntensity: 1.4,
      roughness: 0.35,
      metalness: 0.6,
    },
    storefronts: {
      awningStyle: 'glass',
      awningPalette: [0xbfe6ff, 0xe8f2f8, 0x9aa7b0],
      signStyle: 'led',
      signColors: [0xffffff, 0xbfe6ff, 0x7fd0ff],
      glassWarmth: 0.2,
      windowDensity: 0.85,
    },
    advertising: {
      billboardStyle: 'led',
      billboardPalette: [0xffffff, 0xbfe6ff, 0x7fd0ff],
      headline: 'Apple',
      subheadline: 'THE FUN IS BACK',
      motion: 'scrolling',
      emissiveIntensity: 1.5,
    },
    vehicles: {
      styleLabel: 'SUVs, minivans and hybrids',
      palette: [0x888888, 0x4a6b8a, 0x8a5a3a, 0xb8b8b3],
      types: ['suv', 'minivan', 'compact car', 'hybrid taxi'],
      density: 0.66,
      speedRange: [10, 20],
      chromeAmount: 0.15,
      headlightColor: 0xffffff,
      taillightColor: 0xd93025,
    },
    pedestrians: {
      styleLabel: 'Hoodies, denim and business casual',
      palette: [0x4a5a6a, 0x9a8a7a, 0x3a4a5a],
      outfit: ['denim jacket', 'hoodie', 'business casual'],
      density: 0.6,
      speedRange: [1.25, 1.65],
    },
    atmosphere: {
      skyTop: 0x7aa6c8,
      skyHorizon: 0xdbe6ee,
      skyBottom: 0xcddde8,
      fogColor: 0xc8d8e2,
      fogNear: 30,
      fogFar: 140,
      sunColor: 0xfff6e6,
      sunIntensity: 3.1,
      ambientColor: 0xffffff,
      ambientIntensity: 0.58,
      hemisphereSky: 0xcfe8fa,
      hemisphereGround: 0xbfc9c2,
      hemisphereIntensity: 0.85,
      particleKind: 'clean',
      particleColor: 0xffffff,
      particleDensity: 0.05,
      tone: 'neutral',
      saturation: 1.0,
      contrast: 1.0,
    },
    lighting: {
      lampStyle: 'led',
      lampHeadColor: 0xf2f7ff,
      lampHeadIntensity: 4.2,
      lampPoleColor: 0x44464a,
      lampHeight: 6.2,
      lampArmReach: 1.4,
      roadSurfaceColor: 0x48484d,
      laneMarkingColor: 0xf4f4f2,
      dashedMarkingColor: 0xe8e8e6,
      sidewalkColor: 0xb6b2aa,
      curbColor: 0x85827c,
      crosswalkColor: 0xf0f0ee,
    },
    audio: SFX_ERA_DATA['2005'],
  },
  '2025': {
    era: '2025',
    year: 2025,
    architecture: {
      styleLabel: 'Contemporary glass with eco-teal accents',
      material: 'composite',
      facadePalette: [0x28343e, 0x35424f, 0x4a5a66, 0x223140, 0x3e4f5c],
      accentPalette: [0x59f0c2, 0x7fd0ff, 0xa8f0d8],
      heightRange: [14, 46],
      windowStyle: 'curtain',
      windowWarmth: 0.15,
      roofFlavor: 'deck',
      emissiveColor: 0x59f0c2,
      emissiveIntensity: 1.7,
      roughness: 0.3,
      metalness: 0.65,
    },
    storefronts: {
      awningStyle: 'glass',
      awningPalette: [0x59f0c2, 0xeaf6ff, 0x7fd0ff],
      signStyle: 'led_screen',
      signColors: [0x59f0c2, 0x7fd0ff, 0xffffff],
      glassWarmth: 0.15,
      windowDensity: 0.9,
    },
    advertising: {
      billboardStyle: 'led',
      billboardPalette: [0x59f0c2, 0x7fd0ff, 0xffffff],
      headline: 'NEXUS AI',
      subheadline: 'YOUR CITY, OPTIMIZED',
      motion: 'animated',
      emissiveIntensity: 2.0,
    },
    vehicles: {
      styleLabel: 'EVs, e-scooters and delivery drones',
      palette: [0xdfe6ea, 0x3aa0a8, 0xb8c4c8, 0x2a3744],
      types: ['ev sedan', 'e-scooter', 'delivery drone', 'electric bus'],
      density: 0.8,
      speedRange: [9, 22],
      chromeAmount: 0.05,
      headlightColor: 0xeaffff,
      taillightColor: 0xff3b30,
    },
    pedestrians: {
      styleLabel: 'Streetwear, rain shells and tech backpacks',
      palette: [0x2f3b45, 0x4a5f6e, 0x8a6f5f],
      outfit: ['streetwear', 'rain jacket', 'tech backpack'],
      density: 0.7,
      speedRange: [1.3, 1.7],
    },
    atmosphere: {
      skyTop: 0x6d9bc2,
      skyHorizon: 0xe4ecf2,
      skyBottom: 0xd4e0ea,
      fogColor: 0xd8e2ea,
      fogNear: 32,
      fogFar: 150,
      sunColor: 0xfff8ea,
      sunIntensity: 3.2,
      ambientColor: 0xffffff,
      ambientIntensity: 0.6,
      hemisphereSky: 0xd2ecff,
      hemisphereGround: 0xbdc8c0,
      hemisphereIntensity: 0.9,
      particleKind: 'clean',
      particleColor: 0xffffff,
      particleDensity: 0.05,
      tone: 'vivid',
      saturation: 1.2,
      contrast: 1.1,
    },
    lighting: {
      lampStyle: 'led',
      lampHeadColor: 0xeaf6ff,
      lampHeadIntensity: 4.8,
      lampPoleColor: 0x39424b,
      lampHeight: 6.4,
      lampArmReach: 1.5,
      roadSurfaceColor: 0x3f4146,
      laneMarkingColor: 0xf2f2f0,
      dashedMarkingColor: 0xe2e2e0,
      sidewalkColor: 0xa8a49c,
      curbColor: 0x7a7770,
      crosswalkColor: 0xefefed,
    },
    audio: SFX_ERA_DATA['2025'],
  },
  '2055': {
    era: '2055',
    year: 2055,
    architecture: {
      styleLabel: 'Futuristic composite with holographic trim',
      material: 'composite',
      facadePalette: [0x16313a, 0x1d3a44, 0x274e58, 0x2b5a66, 0x143038],
      accentPalette: [0x59f0ff, 0x7df9ff, 0x35e0d0],
      heightRange: [16, 56],
      windowStyle: 'hologram',
      windowWarmth: 0.05,
      roofFlavor: 'deck',
      emissiveColor: 0x59f0ff,
      emissiveIntensity: 3.0,
      roughness: 0.2,
      metalness: 0.8,
    },
    storefronts: {
      awningStyle: 'holo',
      awningPalette: [0x7df9ff, 0x59f0ff, 0x35e0d0],
      signStyle: 'hologram',
      signColors: [0x7df9ff, 0x59f0ff, 0xbffcff],
      glassWarmth: 0.05,
      windowDensity: 0.95,
    },
    advertising: {
      billboardStyle: 'hologram',
      billboardPalette: [0x7df9ff, 0x59f0ff, 0x35e0d0],
      headline: 'MARS COLONY',
      subheadline: 'BOOK YOUR FLIGHT',
      motion: 'holographic',
      emissiveIntensity: 3.0,
    },
    vehicles: {
      styleLabel: 'Flying drones, hover taxis and maglev pods',
      palette: [0x9fe8f0, 0x2ad0d8, 0xd8f6f8],
      types: ['flying drone', 'hover taxi', 'maglev pod'],
      density: 0.72,
      speedRange: [14, 30],
      chromeAmount: 0.02,
      headlightColor: 0xbffcff,
      taillightColor: 0xff2bd6,
    },
    pedestrians: {
      styleLabel: 'Smart textiles and lightwear',
      palette: [0x9fd8e0, 0x5a9aa8, 0xd8f4f8],
      outfit: ['smart textiles', 'lightwear', 'retro chrome'],
      density: 0.65,
      speedRange: [1.35, 1.8],
    },
    atmosphere: {
      skyTop: 0x0d1e33,
      skyHorizon: 0x1d3a52,
      skyBottom: 0x2b5f6e,
      fogColor: 0x142c3f,
      fogNear: 24,
      fogFar: 220,
      sunColor: 0xeaffff,
      sunIntensity: 2.4,
      ambientColor: 0xffffff,
      ambientIntensity: 0.55,
      hemisphereSky: 0x7ad8ea,
      hemisphereGround: 0x123a44,
      hemisphereIntensity: 0.85,
      particleKind: 'hologram',
      particleColor: 0x59f0ff,
      particleDensity: 0.55,
      tone: 'vivid',
      saturation: 1.35,
      contrast: 1.2,
    },
    lighting: {
      lampStyle: 'hologram',
      lampHeadColor: 0x7df9ff,
      lampHeadIntensity: 5.0,
      lampPoleColor: 0x2a3a3f,
      lampHeight: 5.4,
      lampArmReach: 1.3,
      roadSurfaceColor: 0x2e3238,
      laneMarkingColor: 0x9fe8f0,
      dashedMarkingColor: 0x6fd8e0,
      sidewalkColor: 0x5c6e74,
      curbColor: 0x45565c,
      crosswalkColor: 0xbffcff,
    },
    audio: SFX_ERA_DATA['2055'],
  },
}

/** Returns the full EraData contract for an id; throws for unknown ids. */
export function getEraData(id: EraId): EraData {
  const data = ERA_DATA[id]
  if (!data) {
    throw new Error(`Unknown era id: "${id}"`)
  }
  return data
}