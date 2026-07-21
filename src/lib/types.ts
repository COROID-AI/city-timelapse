export type Era = 1945 | 1965 | 1985 | 2005 | 2025 | 2055

export interface EraConfig {
  era: Era
  label: string
  buildingStyle: string
  vehicleType: string
  signageType: string
  clothingStyle: string
  lightingPreset: string
  skyColor: string
  postProcessing: string
  audioAmbiance: string
}

export interface LoadingState {
  progress: number
  loadedAssets: string[]
  totalAssets: number
}

export interface ErrorState {
  hasError: boolean
  message: string
}

export const ERAS: EraConfig[] = [
  {
    era: 1945,
    label: "1945 - Post-War Elegance",
    buildingStyle: "artdeco",
    vehicleType: "vintage",
    signageType: "handpainted",
    clothingStyle: "vintage",
    lightingPreset: "warm_vintage",
    skyColor: "#87ceeb",
    postProcessing: "film_grain",
    audioAmbiance: "street_1945"
  },
  {
    era: 1965,
    label: "1965 - Mid-Century Modern",
    buildingStyle: "modern",
    vehicleType: "classic",
    signageType: "neon",
    clothingStyle: "retro",
    lightingPreset: "bright_modern",
    skyColor: "#6eb5ff",
    postProcessing: "none",
    audioAmbiance: "street_1965"
  },
  {
    era: 1985,
    label: "1985 - Brutalist Era",
    buildingStyle: "brutalist",
    vehicleType: "boxy",
    signageType: "neon",
    clothingStyle: "80s",
    lightingPreset: "bright_modern",
    skyColor: "#5a9bd4",
    postProcessing: "bloom",
    audioAmbiance: "disco"
  },
  {
    era: 2005,
    label: "2005 - Early Digital",
    buildingStyle: "contemporary",
    vehicleType: "modern_suv",
    signageType: "led",
    clothingStyle: "early_2000s",
    lightingPreset: "bright_modern",
    skyColor: "#88c4ff",
    postProcessing: "color_correction",
    audioAmbiance: "street_2005"
  },
  {
    era: 2025,
    label: "2025 - Sustainable Future",
    buildingStyle: "sustainable",
    vehicleType: "electric",
    signageType: "led",
    clothingStyle: "modern",
    lightingPreset: "cool_toned",
    skyColor: "#a6d8ff",
    postProcessing: "ambient_occlusion",
    audioAmbiance: "street_2025"
  },
  {
    era: 2055,
    label: "2055 - Cyberpunk Metropolis",
    buildingStyle: "futuristic",
    vehicleType: "autonomous",
    signageType: "holographic",
    clothingStyle: "cyberpunk",
    lightingPreset: "futuristic",
    skyColor: "#2c3e70",
    postProcessing: "cyberpunk",
    audioAmbiance: "futuristic"
  }
]