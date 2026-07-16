import { Era } from '../context/UIContext'

export interface EraConfig {
  era: Era
  label: string
  buildingStyle: 'post-war' | 'mid-century' | 'glass-steel' | 'modern' | 'sustainable' | 'futuristic'
  buildingHeight: number
  buildingMaterial: string
  vehicleType: 'classic' | 'sedan' | 'boxy' | 'suv' | 'ev' | 'flying'
  storefrontStyle: 'vintage' | 'neon' | 'arcade' | 'digital' | 'ar' | 'holographic'
  pedestrianStyle: '1940s' | '1960s' | '1980s' | '2000s' | '2020s' | 'cyberpunk'
  colorPalette: {
    primary: string
    secondary: string
    accent: string
  }
  lighting: {
    intensity: number
    color: string
  }
  ambientSound: string
}

export const eraConfigs: Record<Era, EraConfig> = {
  1945: {
    era: 1945,
    label: '1945',
    buildingStyle: 'post-war',
    buildingHeight: 3,
    buildingMaterial: '#8B7355', // Weathered brick
    vehicleType: 'classic',
    storefrontStyle: 'vintage',
    pedestrianStyle: '1940s',
    colorPalette: {
      primary: '#8B7355',
      secondary: '#654321',
      accent: '#CDAA7D',
    },
    lighting: {
      intensity: 0.8,
      color: '#FFF8DC',
    },
    ambientSound: 'post-war-ambience',
  },
  1965: {
    era: 1965,
    label: '1965',
    buildingStyle: 'mid-century',
    buildingHeight: 4,
    buildingMaterial: '#4A90E2', // Blue-toned modern
    vehicleType: 'sedan',
    storefrontStyle: 'neon',
    pedestrianStyle: '1960s',
    colorPalette: {
      primary: '#4A90E2',
      secondary: '#FF6B6B',
      accent: '#FFD166',
    },
    lighting: {
      intensity: 0.9,
      color: '#E6F3FF',
    },
    ambientSound: 'mid-century-ambience',
  },
  1985: {
    era: 1985,
    label: '1985',
    buildingStyle: 'glass-steel',
    buildingHeight: 6,
    buildingMaterial: '#C0C0C0', // Silver glass
    vehicleType: 'boxy',
    storefrontStyle: 'arcade',
    pedestrianStyle: '1980s',
    colorPalette: {
      primary: '#C0C0C0',
      secondary: '#FF2D95',
      accent: '#00FFCC',
    },
    lighting: {
      intensity: 1.0,
      color: '#F0F0FF',
    },
    ambientSound: '80s-ambience',
  },
  2005: {
    era: 2005,
    label: '2005',
    buildingStyle: 'modern',
    buildingHeight: 12,
    buildingMaterial: '#2C3E50', // Dark glass
    vehicleType: 'suv',
    storefrontStyle: 'digital',
    pedestrianStyle: '2000s',
    colorPalette: {
      primary: '#2C3E50',
      secondary: '#3498DB',
      accent: '#E74C3C',
    },
    lighting: {
      intensity: 1.1,
      color: '#FFFFFF',
    },
    ambientSound: 'modern-ambience',
  },
  2025: {
    era: 2025,
    label: '2025',
    buildingStyle: 'sustainable',
    buildingHeight: 15,
    buildingMaterial: '#27AE60', // Green glass
    vehicleType: 'ev',
    storefrontStyle: 'ar',
    pedestrianStyle: '2020s',
    colorPalette: {
      primary: '#27AE60',
      secondary: '#1ABC9C',
      accent: '#3498DB',
    },
    lighting: {
      intensity: 1.0,
      color: '#F0FFF0',
    },
    ambientSound: 'future-ambience',
  },
  2055: {
    era: 2055,
    label: '2055',
    buildingStyle: 'futuristic',
    buildingHeight: 25,
    buildingMaterial: '#9B59B6', // Holographic purple
    vehicleType: 'flying',
    storefrontStyle: 'holographic',
    pedestrianStyle: 'cyberpunk',
    colorPalette: {
      primary: '#9B59B6',
      secondary: '#FF00FF',
      accent: '#00FFFF',
    },
    lighting: {
      intensity: 1.2,
      color: '#E0E0FF',
    },
    ambientSound: 'cyberpunk-ambience',
  },
}

export const eras: Era[] = [1945, 1965, 1985, 2005, 2025, 2055]