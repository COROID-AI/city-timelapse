import * as THREE from 'three'
import { ERAS, type Era, type EraConfig } from './types'

export const ERA_CONFIGS: Record<Era, EraConfig> = Object.fromEntries(
  ERAS.map(e => [e.era, e])
) as Record<Era, EraConfig>

export const ERA_PALETTES = {
  1945: {
    buildings: ['#8b7355', '#6b5b47', '#5d4e37', '#4a3f2e', '#3d3325'],
    accents: ['#c9a876', '#b8956a', '#a6825e', '#947052'],
    windows: ['#1a1a2e', '#16213e', '#0f0f23'],
    streets: ['#2d2d2d', '#1a1a1a', '#3d3d3d'],
    vehicles: ['#8b4513', '#654321', '#4a3728', '#2f1b0c'],
    signage: ['#ffd700', '#ff8c00', '#dc143c', '#fff8dc'],
    clothing: ['#2f4f4f', '#4b0082', '#800000', '#006400', '#483d8b']
  },
  1965: {
    buildings: ['#f5f5dc', '#e8e8e8', '#dcdcdc', '#c0c0c0', '#a9a9a9'],
    accents: ['#ff6347', '#ffa500', '#ffff00', '#32cd32', '#1e90ff'],
    windows: ['#87ceeb', '#b0e0e6', '#add8e6'],
    streets: ['#696969', '#808080', '#778899'],
    vehicles: ['#ff0000', '#0000ff', '#ffff00', '#ffa500', '#ffffff', '#000000'],
    signage: ['#ff1493', '#00ffff', '#ffff00', '#ff4500', '#adff2f'],
    clothing: ['#ff69b4', '#ffa500', '#ffff00', '#00ff00', '#00ffff', '#ff00ff']
  },
  1985: {
    buildings: ['#696969', '#778899', '#708090', '#808080', '#a9a9a9', '#2f4f4f'],
    accents: ['#ff00ff', '#00ffff', '#ffff00', '#ff4500', '#32cd32'],
    windows: ['#4682b4', '#5f9ea0', '#87ceeb', '#00bfff'],
    streets: ['#2f2f2f', '#1c1c1c', '#3d3d3d'],
    vehicles: ['#c0c0c0', '#a9a9a9', '#808080', '#696969', '#ff0000', '#000000'],
    signage: ['#ff00ff', '#00ffff', '#ffff00', '#ff1493', '#00ff00', '#ff4500'],
    clothing: ['#ff1493', '#00ffff', '#ffff00', '#ff4500', '#32cd32', '#ff00ff', '#ff69b4']
  },
  2005: {
    buildings: ['#d3d3d3', '#c0c0c0', '#a9a9a9', '#b0c4de', '#778899', '#e6e6fa'],
    accents: ['#007fff', '#ff007f', '#7fff00', '#ff7f00', '#7f00ff'],
    windows: ['#87ceeb', '#b0e0e6', '#add8e6', '#e0ffff'],
    streets: ['#4a4a4a', '#5a5a5a', '#3d3d3d'],
    vehicles: ['#c0c0c0', '#a9a9a9', '#808080', '#000000', '#ffffff', '#000080'],
    signage: ['#00ffff', '#ff007f', '#7fff00', '#ffff00', '#ff4500'],
    clothing: ['#000080', '#800080', '#008080', '#808000', '#c0c0c0', '#000000']
  },
  2025: {
    buildings: ['#e8f5e9', '#c8e6c9', '#a5d6a7', '#81c784', '#66bb6a', '#ffffff', '#f5f5f5'],
    accents: ['#00e676', '#64dd17', '#76ff03', '#b2ff59', '#00c853'],
    windows: ['#e3f2fd', '#bbdefb', '#90caf9', '#64b5f6', '#e8f5e9'],
    streets: ['#37474f', '#455a64', '#546e7a'],
    vehicles: ['#ffffff', '#e0e0e0', '#bdbdbd', '#00e676', '#2962ff'],
    signage: ['#00e676', '#64dd17', '#00bcd4', '#03a9f4', '#ffffff'],
    clothing: ['#2e7d32', '#1565c0', '#0d47a1', '#004d40', '#ffffff', '#e8f5e9']
  },
  2055: {
    buildings: ['#0d1117', '#161b22', '#1f2937', '#2d3748', '#374151'],
    accents: ['#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ff0080', '#8000ff'],
    windows: ['#00ffff33', '#ff00ff33', '#ffff0033', '#00ff0033'],
    streets: ['#0a0a0a', '#111111', '#1a1a1a'],
    vehicles: ['#000000', '#1a1a1a', '#00ffff', '#ff00ff', '#ffffff'],
    signage: ['#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ff0080', '#8000ff', '#ffffff'],
    clothing: ['#000000', '#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ffffff', '#8000ff']
  }
} as const

export const LIGHTING_PRESETS = {
  warm_vintage: {
    ambient: { color: 0xffd700, intensity: 0.4 },
    sun: { color: 0xffb347, intensity: 1.2, position: [100, 150, 100] },
    fill: { color: 0xff8c00, intensity: 0.3, position: [-50, 50, -50] },
    hemisphere: { skyColor: 0x87ceeb, groundColor: 0x8b7355, intensity: 0.6 }
  },
  bright_modern: {
    ambient: { color: 0xffffff, intensity: 0.5 },
    sun: { color: 0xffffee, intensity: 1.5, position: [100, 200, 100] },
    fill: { color: 0x87ceeb, intensity: 0.4, position: [-50, 80, -50] },
    hemisphere: { skyColor: 0x6eb5ff, groundColor: 0xc0c0c0, intensity: 0.8 }
  },
  cool_toned: {
    ambient: { color: 0xa6d8ff, intensity: 0.4 },
    sun: { color: 0xffffff, intensity: 1.3, position: [80, 180, 80] },
    fill: { color: 0x00bcd4, intensity: 0.3, position: [-60, 60, -60] },
    hemisphere: { skyColor: 0xa6d8ff, groundColor: 0x455a64, intensity: 0.7 }
  },
  futuristic: {
    ambient: { color: 0x2c3e70, intensity: 0.3 },
    sun: { color: 0x00ffff, intensity: 0.8, position: [50, 100, 50] },
    fill: { color: 0xff00ff, intensity: 0.4, position: [-40, 40, -40] },
    hemisphere: { skyColor: 0x0d1117, groundColor: 0x1a1a2e, intensity: 0.5 }
  }
} as const

export const SKY_CONFIGS = {
  1945: { topColor: 0x87ceeb, bottomColor: 0xffb347, sunPosition: new THREE.Vector3(100, 150, 100) },
  1965: { topColor: 0x6eb5ff, bottomColor: 0x87ceeb, sunPosition: new THREE.Vector3(100, 200, 100) },
  1985: { topColor: 0x5a9bd4, bottomColor: 0x87ceeb, sunPosition: new THREE.Vector3(100, 180, 100) },
  2005: { topColor: 0x88c4ff, bottomColor: 0xb0e0e6, sunPosition: new THREE.Vector3(100, 200, 100) },
  2025: { topColor: 0xa6d8ff, bottomColor: 0xe3f2fd, sunPosition: new THREE.Vector3(80, 180, 80) },
  2055: { topColor: 0x0d1117, bottomColor: 0x1a1a2e, sunPosition: new THREE.Vector3(50, 100, 50) }
} as const

export function getEraConfig(era: Era): EraConfig {
  return ERA_CONFIGS[era] || ERA_CONFIGS[1945]
}

export function getPalette(era: Era) {
  return ERA_PALETTES[era] || ERA_PALETTES[1945]
}

export function getLightingPreset(era: Era) {
  const config = getEraConfig(era)
  return LIGHTING_PRESETS[config.lightingPreset as keyof typeof LIGHTING_PRESETS] || LIGHTING_PRESETS.warm_vintage
}

export function getSkyConfig(era: Era) {
  return SKY_CONFIGS[era] || SKY_CONFIGS[1945]
}

export function interpolateColor(color1: number, color2: number, factor: number): number {
  const c1 = new THREE.Color(color1)
  const c2 = new THREE.Color(color2)
  return c1.clone().lerp(c2, factor).getHex()
}

export function interpolateVector3(v1: THREE.Vector3, v2: THREE.Vector3, factor: number): THREE.Vector3 {
  return v1.clone().lerp(v2, factor)
}

export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor
}