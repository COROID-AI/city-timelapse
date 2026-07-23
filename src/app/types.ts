export type EraId = 0 | 1 | 2 | 3 | 4 | 5

export type EraOption = {
  id: EraId
  year: number
  label: string
}

export type EraPalette = {
  skyTop: string
  skyBottom: string
  buildingBase: string
  buildingAccent: string
  road: string
  billboard: string
  billboardAlt: string
  neon: string
  vehicleBody: string
  vehicleAccent: string
  pedestrian: string
}

export type EraConfig = {
  id: EraId
  year: number
  label: string
  buildingScale: number
  buildingSaturation: number
  windowGlow: number
  roadWetness: number
  vehicleDensity: number
  vehicleSpeed: number
  vehicleStyle: 'vintage' | 'muscle' | 'synth' | 'modern' | 'ev' | 'futurist'
  pedestrianDensity: number
  billboardMotion: number
  ambientIntensity: number
  palette: EraPalette
  sfxProfile: {
    traffic: 'streetcar' | 'muscle' | 'synth' | 'modern' | 'ev' | 'futurist'
    uiClicks: boolean
  }
}
