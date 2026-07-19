export type EraType = 1945 | 1965 | 1985 | 2005 | 2025 | 2055

export interface EraConfig {
  buildingStyle: string
  vehicleStyle: string
  pedestrianStyle: string
  storefrontStyle: string
  skyColor: string
  fogColor: string
  postprocessing: PostprocessingConfig
}

export interface PostprocessingConfig {
  bloomIntensity: number
  colorCorrection: [number, number, number] // RGB tint
  grainIntensity: number
}

export const ERA_CONFIGS: Record<EraType, EraConfig> = {
  1945: {
    buildingStyle: 'brick',
    vehicleStyle: 'classic',
    pedestrianStyle: 'vintage',
    storefrontStyle: 'traditional',
    skyColor: '#87ceeb',
    fogColor: '#a0a0a0',
    postprocessing: {
      bloomIntensity: 0.3,
      colorCorrection: [1.1, 1.0, 0.9],
      grainIntensity: 0.15
    }
  },
  1965: {
    buildingStyle: 'modernist',
    vehicleStyle: 'muscle',
    pedestrianStyle: 'retro',
    storefrontStyle: 'neon',
    skyColor: '#90c4e8',
    fogColor: '#8a9a9a',
    postprocessing: {
      bloomIntensity: 0.4,
      colorCorrection: [1.05, 1.0, 1.0],
      grainIntensity: 0.1
    }
  },
  1985: {
    buildingStyle: 'glass',
    vehicleStyle: '80s',
    pedestrianStyle: 'punk',
    storefrontStyle: 'digital',
    skyColor: '#7ca0c0',
    fogColor: '#7a7a7a',
    postprocessing: {
      bloomIntensity: 0.5,
      colorCorrection: [1.0, 0.95, 1.1],
      grainIntensity: 0.08
    }
  },
  2005: {
    buildingStyle: 'contemporary',
    vehicleStyle: 'modern',
    pedestrianStyle: 'casual',
    storefrontStyle: 'led',
    skyColor: '#6ba0d0',
    fogColor: '#6a6a6a',
    postprocessing: {
      bloomIntensity: 0.6,
      colorCorrection: [0.95, 1.0, 1.1],
      grainIntensity: 0.05
    }
  },
  2025: {
    buildingStyle: 'green',
    vehicleStyle: 'electric',
    pedestrianStyle: 'tech',
    storefrontStyle: 'smart',
    skyColor: '#5a90c0',
    fogColor: '#5a5a5a',
    postprocessing: {
      bloomIntensity: 0.7,
      colorCorrection: [0.9, 1.05, 1.15],
      grainIntensity: 0.02
    }
  },
  2055: {
    buildingStyle: 'bio-integrated',
    vehicleStyle: 'hover',
    pedestrianStyle: 'futuristic',
    storefrontStyle: 'hologram',
    skyColor: '#4a6ac0',
    fogColor: '#3a3a5a',
    postprocessing: {
      bloomIntensity: 1.0,
      colorCorrection: [0.8, 1.1, 1.2],
      grainIntensity: 0
    }
  }
}