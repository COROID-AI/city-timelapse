export type Era = 1945 | 1965 | 1985 | 2005 | 2025 | 2055

export const ERA_YEARS: Era[] = [1945, 1965, 1985, 2005, 2025, 2055]

export interface EraTimeline {
  year: Era | number
  progress: number // 0 to 1 within the era
}

export interface EraConfig {
  architecture: string
  vehicle: string
  pedestrian: string
  advertisement: string
  storefront: string
  weather: string
  colorTemp: number
  bloomStrength: number
  filmGrain: number
}

export const ERA_CONFIGS: Record<Era, EraConfig> = {
  1945: {
    architecture: 'art-deco',
    vehicle: 'classic',
    pedestrian: 'vintage',
    advertisement: 'vintage-signage',
    storefront: 'mom-and-pop',
    weather: 'clear',
    colorTemp: 6500,
    bloomStrength: 0.3,
    filmGrain: 0.1,
  },
  1965: {
    architecture: 'brutalist',
    vehicle: 'muscle',
    pedestrian: '60s',
    advertisement: 'neon',
    storefront: 'mall',
    weather: 'clear',
    colorTemp: 5500,
    bloomStrength: 0.5,
    filmGrain: 0.05,
  },
  1985: {
    architecture: 'modern',
    vehicle: 'sedan',
    pedestrian: '80s',
    advertisement: 'neon',
    storefront: 'mall',
    weather: 'hazy',
    colorTemp: 4500,
    bloomStrength: 0.7,
    filmGrain: 0.2,
  },
  2005: {
    architecture: 'glass',
    vehicle: 'sedan',
    pedestrian: 'modern',
    advertisement: 'led',
    storefront: 'mall',
    weather: 'clear',
    colorTemp: 5000,
    bloomStrength: 0.6,
    filmGrain: 0.0,
  },
  2025: {
    architecture: 'glass',
    vehicle: 'ev',
    pedestrian: 'modern',
    advertisement: 'led',
    storefront: 'automated',
    weather: 'clear',
    colorTemp: 5000,
    bloomStrength: 0.8,
    filmGrain: 0.0,
  },
  2055: {
    architecture: 'eco-futuristic',
    vehicle: 'hover',
    pedestrian: 'futuristic',
    advertisement: 'holographic',
    storefront: 'automated',
    weather: 'clear',
    colorTemp: 7500,
    bloomStrength: 1.2,
    filmGrain: 0.0,
  },
}