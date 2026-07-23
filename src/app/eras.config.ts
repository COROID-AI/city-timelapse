import type { EraConfig, EraId, EraOption } from './types'

export const ERA_OPTIONS: EraOption[] = [
  { id: 0, year: 1945, label: '1945' },
  { id: 1, year: 1965, label: '1965' },
  { id: 2, year: 1985, label: '1985' },
  { id: 3, year: 2005, label: '2005' },
  { id: 4, year: 2025, label: '2025' },
  { id: 5, year: 2055, label: '2055' },
]

const PALETTES = {
  1945: {
    skyTop: '#2b4c7a',
    skyBottom: '#0e1830',
    buildingBase: '#7b7f86',
    buildingAccent: '#c0a58a',
    road: '#2a2d34',
    billboard: '#f3c37a',
    billboardAlt: '#f18aa6',
    neon: '#7bf0ff',
    vehicleBody: '#e6e6e6',
    vehicleAccent: '#c23d2b',
    pedestrian: '#f1c7a0',
  },
  1965: {
    skyTop: '#4f3a78',
    skyBottom: '#12102a',
    buildingBase: '#6e747c',
    buildingAccent: '#d6b98a',
    road: '#2c2f36',
    billboard: '#ffcf5c',
    billboardAlt: '#ff7b67',
    neon: '#a7ffce',
    vehicleBody: '#cfcfcf',
    vehicleAccent: '#ff3f3f',
    pedestrian: '#f1d2b7',
  },
  1985: {
    skyTop: '#2b5f78',
    skyBottom: '#07121d',
    buildingBase: '#58646f',
    buildingAccent: '#96b6d9',
    road: '#1f2a33',
    billboard: '#62f2ff',
    billboardAlt: '#ff4cd8',
    neon: '#62f2ff',
    vehicleBody: '#efefef',
    vehicleAccent: '#52ff9c',
    pedestrian: '#d9b6ff',
  },
  2005: {
    skyTop: '#1f4f86',
    skyBottom: '#041327',
    buildingBase: '#495c6f',
    buildingAccent: '#a7ffd8',
    road: '#161a22',
    billboard: '#8be7ff',
    billboardAlt: '#ffbe67',
    neon: '#9dffb5',
    vehicleBody: '#e9e9e9',
    vehicleAccent: '#3dd6ff',
    pedestrian: '#bfeaff',
  },
  2025: {
    skyTop: '#1a5d6a',
    skyBottom: '#041018',
    buildingBase: '#3b4e5a',
    buildingAccent: '#9be7d6',
    road: '#10151a',
    billboard: '#3bffb6',
    billboardAlt: '#ff6a9a',
    neon: '#3bffb6',
    vehicleBody: '#f2f2f2',
    vehicleAccent: '#4cffa7',
    pedestrian: '#c1ffef',
  },
  2055: {
    skyTop: '#4e2f7b',
    skyBottom: '#060814',
    buildingBase: '#2a3947',
    buildingAccent: '#ffb4ff',
    road: '#0a0d11',
    billboard: '#b77bff',
    billboardAlt: '#5cf8ff',
    neon: '#b77bff',
    vehicleBody: '#f6f6f6',
    vehicleAccent: '#5cf8ff',
    pedestrian: '#ffe5ff',
  },
} as const

export function getEraConfig(id: EraId): EraConfig {
  const base: Omit<EraConfig, 'id' | 'year' | 'label'> = (() => {
    switch (id) {
      case 0:
        return {
          buildingScale: 1.05,
          buildingSaturation: 0.7,
          windowGlow: 0.45,
          roadWetness: 0.55,
          vehicleDensity: 0.55,
          vehicleSpeed: 0.55,
          vehicleStyle: 'vintage',
          pedestrianDensity: 0.35,
          billboardMotion: 0.25,
          ambientIntensity: 0.65,
          palette: PALETTES[1945],
          sfxProfile: { traffic: 'streetcar', uiClicks: true },
        }
      case 1:
        return {
          buildingScale: 1.02,
          buildingSaturation: 0.85,
          windowGlow: 0.6,
          roadWetness: 0.4,
          vehicleDensity: 0.7,
          vehicleSpeed: 0.7,
          vehicleStyle: 'muscle',
          pedestrianDensity: 0.45,
          billboardMotion: 0.35,
          ambientIntensity: 0.85,
          palette: PALETTES[1965],
          sfxProfile: { traffic: 'muscle', uiClicks: true },
        }
      case 2:
        return {
          buildingScale: 1.0,
          buildingSaturation: 1.0,
          windowGlow: 0.75,
          roadWetness: 0.35,
          vehicleDensity: 0.75,
          vehicleSpeed: 0.85,
          vehicleStyle: 'synth',
          pedestrianDensity: 0.55,
          billboardMotion: 0.65,
          ambientIntensity: 1.0,
          palette: PALETTES[1985],
          sfxProfile: { traffic: 'synth', uiClicks: true },
        }
      case 3:
        return {
          buildingScale: 0.98,
          buildingSaturation: 0.95,
          windowGlow: 0.8,
          roadWetness: 0.25,
          vehicleDensity: 0.8,
          vehicleSpeed: 0.9,
          vehicleStyle: 'modern',
          pedestrianDensity: 0.6,
          billboardMotion: 0.45,
          ambientIntensity: 0.95,
          palette: PALETTES[2005],
          sfxProfile: { traffic: 'modern', uiClicks: true },
        }
      case 4:
        return {
          buildingScale: 0.97,
          buildingSaturation: 0.9,
          windowGlow: 0.95,
          roadWetness: 0.2,
          vehicleDensity: 0.85,
          vehicleSpeed: 0.95,
          vehicleStyle: 'ev',
          pedestrianDensity: 0.65,
          billboardMotion: 0.5,
          ambientIntensity: 1.05,
          palette: PALETTES[2025],
          sfxProfile: { traffic: 'ev', uiClicks: true },
        }
      case 5:
        return {
          buildingScale: 0.96,
          buildingSaturation: 1.1,
          windowGlow: 1.1,
          roadWetness: 0.15,
          vehicleDensity: 0.9,
          vehicleSpeed: 1.1,
          vehicleStyle: 'futurist',
          pedestrianDensity: 0.7,
          billboardMotion: 0.75,
          ambientIntensity: 1.2,
          palette: PALETTES[2055],
          sfxProfile: { traffic: 'futurist', uiClicks: false },
        }
    }
  })()

  const option = ERA_OPTIONS.find((e) => e.id === id)!
  return {
    id,
    year: option.year,
    label: option.label,
    ...base,
  }
}
