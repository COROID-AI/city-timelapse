export type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

export interface EraConfig {
  era: Era
  buildingStyle: BuildingStyle
  vehicleTypes: VehicleType[]
  storefrontStyle: StorefrontStyle
  pedestrianStyle: PedestrianStyle
  colorPalette: ColorPalette
  audioAmbience: string
}

export type BuildingStyle = 'brick' | 'modernist' | 'glass_steel' | 'mixed_use' | 'sustainable' | 'futuristic'

export type VehicleType = 'classic' | 'muscle' | 'boxy_80s' | 'suv' | 'ev' | 'flying'

export type StorefrontStyle = 'vintage' | 'modernist' | 'glass' | 'contemporary' | 'eco' | 'holographic'

export type PedestrianStyle = '1940s' | '1960s' | '1980s' | '2000s' | '2020s' | '2050s'

export interface ColorPalette {
  primary: string
  secondary: string
  accent: string
  sky: string
}

export const ERA_CONFIGS: EraConfig[] = [
  {
    era: '1945',
    buildingStyle: 'brick',
    vehicleTypes: ['classic'],
    storefrontStyle: 'vintage',
    pedestrianStyle: '1940s',
    colorPalette: { primary: '#8B4513', secondary: '#A0522D', accent: '#CD853F', sky: '#87CEEB' },
    audioAmbience: 'wartime_city',
  },
  {
    era: '1965',
    buildingStyle: 'modernist',
    vehicleTypes: ['classic', 'muscle'],
    storefrontStyle: 'modernist',
    pedestrianStyle: '1960s',
    colorPalette: { primary: '#696969', secondary: '#2F4F4F', accent: '#DAA520', sky: '#87CEEB' },
    audioAmbience: 'busy_1960s',
  },
  {
    era: '1985',
    buildingStyle: 'glass_steel',
    vehicleTypes: ['boxy_80s'],
    storefrontStyle: 'glass',
    pedestrianStyle: '1980s',
    colorPalette: { primary: '#C0C0C0', secondary: '#2F4F4F', accent: '#FF6B6B', sky: '#4682B4' },
    audioAmbience: 'neon_80s',
  },
  {
    era: '2005',
    buildingStyle: 'mixed_use',
    vehicleTypes: ['suv'],
    storefrontStyle: 'contemporary',
    pedestrianStyle: '2000s',
    colorPalette: { primary: '#5F9EA0', secondary: '#708090', accent: '#32CD32', sky: '#87CEFA' },
    audioAmbience: 'modern_city',
  },
  {
    era: '2025',
    buildingStyle: 'sustainable',
    vehicleTypes: ['ev'],
    storefrontStyle: 'eco',
    pedestrianStyle: '2020s',
    colorPalette: { primary: '#2E8B57', secondary: '#3CB371', accent: '#90EE90', sky: '#87CEEB' },
    audioAmbience: 'green_city',
  },
  {
    era: '2055',
    buildingStyle: 'futuristic',
    vehicleTypes: ['flying'],
    storefrontStyle: 'holographic',
    pedestrianStyle: '2050s',
    colorPalette: { primary: '#00CED1', secondary: '#40E0D0', accent: '#FF00FF', sky: '#4169E1' },
    audioAmbience: 'future_city',
  },
]