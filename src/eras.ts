/**
 * Era Types and Registry
 * Defines the time periods for the city timelapse scene
 */

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

export interface EraSpec {
  id: EraId
  year: number
  label: string
  description: string
}

export interface TrafficProfile {
  density: number // 0-1
  speed: number // base speed multiplier
  vehicleTypes: string[] // types of vehicles present
}

export interface AmbientTones {
  lowFreq: number // Hz
  highFreq: number // Hz
  baseVolume: number // 0-1
  noiseColor: 'brown' | 'pink' | 'white' | 'blue'
}

export interface EventType {
  name: string
  probability: number // chance per second
  duration: number // seconds
}

export interface SfxEraData {
  ambientTones: AmbientTones
  trafficProfile: TrafficProfile
  eventTypes: EventType[]
  musicStyle: 'ambient' | 'jazz' | 'rock' | 'electronic' | 'synthwave' | 'digital'
}

// Era registry - ordered chronologically
export const ERA_REGISTRY: EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: 'Post-War Era',
    description: 'Reconstruction and optimism after the war',
  },
  {
    id: '1965',
    year: 1965,
    label: 'Mid-Century Modern',
    description: 'Space age dreams and economic boom',
  },
  {
    id: '1985',
    year: 1985,
    label: 'Neon Decade',
    description: 'Bold colors and technological awakening',
  },
  {
    id: '2005',
    year: 2005,
    label: 'Digital Dawn',
    description: 'Early internet and sleek minimalism',
  },
  {
    id: '2025',
    year: 2025,
    label: 'Sustainable Present',
    description: 'Green technology and urban renewal',
  },
  {
    id: '2055',
    year: 2055,
    label: 'Biotech Future',
    description: 'Organic architecture and autonomous life',
  },
]

export const ERA_IDS: readonly EraId[] = ERA_REGISTRY.map((e) => e.id) as readonly EraId[]

export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((e) => e.id === id)
  if (!spec) {
    throw new Error(`Unknown era: ${id}`)
  }
  return spec
}

// Era-specific audio parameters
export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambientTones: {
      lowFreq: 50,
      highFreq: 200,
      baseVolume: 0.3,
      noiseColor: 'brown',
    },
    trafficProfile: {
      density: 0.4,
      speed: 0.8,
      vehicleTypes: ['sedan', 'truck', 'bus'],
    },
    eventTypes: [
      { name: 'streetcar', probability: 0.1, duration: 5 },
      { name: 'factory_horn', probability: 0.05, duration: 2 },
    ],
    musicStyle: 'ambient',
  },
  '1965': {
    ambientTones: {
      lowFreq: 80,
      highFreq: 800,
      baseVolume: 0.35,
      noiseColor: 'pink',
    },
    trafficProfile: {
      density: 0.6,
      speed: 1.0,
      vehicleTypes: ['sedan', 'convertible', 'bus'],
    },
    eventTypes: [
      { name: 'jet_flyby', probability: 0.08, duration: 3 },
      { name: 'construction', probability: 0.04, duration: 4 },
    ],
    musicStyle: 'jazz',
  },
  '1985': {
    ambientTones: {
      lowFreq: 100,
      highFreq: 2000,
      baseVolume: 0.4,
      noiseColor: 'white',
    },
    trafficProfile: {
      density: 0.7,
      speed: 1.2,
      vehicleTypes: ['sedan', 'motorcycle', 'truck'],
    },
    eventTypes: [
      { name: 'siren', probability: 0.1, duration: 4 },
      { name: 'neon_hum', probability: 0.15, duration: 6 },
    ],
    musicStyle: 'synthwave',
  },
  '2005': {
    ambientTones: {
      lowFreq: 150,
      highFreq: 4000,
      baseVolume: 0.3,
      noiseColor: 'blue',
    },
    trafficProfile: {
      density: 0.8,
      speed: 1.3,
      vehicleTypes: ['sedan', 'suv', 'van'],
    },
    eventTypes: [
      { name: 'cellphone_ring', probability: 0.12, duration: 2 },
      { name: 'traffic_light', probability: 0.2, duration: 1 },
    ],
    musicStyle: 'electronic',
  },
  '2025': {
    ambientTones: {
      lowFreq: 200,
      highFreq: 8000,
      baseVolume: 0.25,
      noiseColor: 'pink',
    },
    trafficProfile: {
      density: 0.7,
      speed: 1.4,
      vehicleTypes: ['ev_sedan', 'ev_suv', 'electric_bus'],
    },
    eventTypes: [
      { name: 'ev_whir', probability: 0.15, duration: 3 },
      { name: 'notification_chime', probability: 0.1, duration: 1.5 },
    ],
    musicStyle: 'electronic',
  },
  '2055': {
    ambientTones: {
      lowFreq: 300,
      highFreq: 12000,
      baseVolume: 0.35,
      noiseColor: 'blue',
    },
    trafficProfile: {
      density: 0.9,
      speed: 1.6,
      vehicleTypes: ['autonomous_pod', 'hover_vehicle', 'drone'],
    },
    eventTypes: [
      { name: 'digital_pulse', probability: 0.2, duration: 2 },
      { name: 'bio_luminescence', probability: 0.18, duration: 3 },
    ],
    musicStyle: 'digital',
  },
}