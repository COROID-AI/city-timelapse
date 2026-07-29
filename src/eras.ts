export const ERA_IDS = ['1945', '1965', '1985', '2005', '2025', '2055'] as const
export type EraId = typeof ERA_IDS[number]

export interface EraSpec {
  id: EraId
  year: number
  label: string
  description: string
}

export interface EraPalette {
  skyTop: string
  skyBottom: string
  fogColor: string
  sunColor: string
  sunIntensity: number
  ambientColor: string
  ambientIntensity: number
  buildingColor: string
  windowColor: string
  windowEmissive: string
  windowEmissiveIntensity: number
  roofColor: string
  roadColor: string
  sidewalkColor: string
  lampColor: string
  lampIntensity: number
  neonAccent: string
  neonIntensity: number
  particleColor: string
  particleOpacity: number
  groundTint: string
}

export interface EraBuilding {
  width: number
  depth: number
  height: number
  minHeight: number
  maxHeight: number
  windowRows: number
  windowCols: number
  windowSize: number
  setbackMin: number
  setbackMax: number
}

export const ERA_REGISTRY: EraSpec[] = [
  { id: '1945', year: 1945, label: '1945', description: 'Post-war brick & gaslight' },
  { id: '1965', year: 1965, label: '1965', description: 'Mid-century pastel chrome' },
  { id: '1985', year: 1985, label: '1985', description: 'Concrete glass & neon' },
  { id: '2005', year: 2005, label: '2005', description: 'Modern glass & digital billboards' },
  { id: '2025', year: 2025, label: '2025', description: 'Contemporary EV & LED' },
  { id: '2055', year: 2055, label: '2055', description: 'Futuristic holograms & glow' },
]

export const ERA_PALETTES: Record<EraId, EraPalette> = {
  '1945': {
    skyTop: '#3a4a6b', skyBottom: '#c4a882', fogColor: '#c4a882', sunColor: '#ffd699',
    sunIntensity: 1.2, ambientColor: '#8b7355', ambientIntensity: 0.3,
    buildingColor: '#8b6b4a', windowColor: '#ffe4b5', windowEmissive: '#ffcc66', windowEmissiveIntensity: 0.15,
    roofColor: '#6b4a2a', roadColor: '#3a3a3a', sidewalkColor: '#9a8a7a',
    lampColor: '#ff9933', lampIntensity: 0.6, neonAccent: '#ff6600', neonIntensity: 0.3,
    particleColor: '#e0c8a0', particleOpacity: 0.3, groundTint: '#5a4a3a',
  },
  '1965': {
    skyTop: '#4a6a8b', skyBottom: '#d4c8a8', fogColor: '#d4c8a8', sunColor: '#ffe8c0',
    sunIntensity: 1.4, ambientColor: '#9a8a6a', ambientIntensity: 0.35,
    buildingColor: '#b8a88a', windowColor: '#ffe8c0', windowEmissive: '#ffffcc', windowEmissiveIntensity: 0.2,
    roofColor: '#8a7a5a', roadColor: '#2a2a2a', sidewalkColor: '#a89888',
    lampColor: '#ddaa44', lampIntensity: 0.7, neonAccent: '#ff4488', neonIntensity: 0.5,
    particleColor: '#d4c4a0', particleOpacity: 0.25, groundTint: '#4a3a2a',
  },
  '1985': {
    skyTop: '#1a2a3a', skyBottom: '#4a5a6a', fogColor: '#4a5a6a', sunColor: '#ffcc88',
    sunIntensity: 1.6, ambientColor: '#2a3a5a', ambientIntensity: 0.25,
    buildingColor: '#6a6a6a', windowColor: '#aaddff', windowEmissive: '#ff4488', windowEmissiveIntensity: 0.6,
    roofColor: '#4a4a4a', roadColor: '#1a1a1a', sidewalkColor: '#7a7a7a',
    lampColor: '#ffaa22', lampIntensity: 0.8, neonAccent: '#ff00ff', neonIntensity: 1.0,
    particleColor: '#8844aa', particleOpacity: 0.4, groundTint: '#2a2a2a',
  },
  '2005': {
    skyTop: '#1a3a5a', skyBottom: '#6a8a9a', fogColor: '#6a8a9a', sunColor: '#ffffff',
    sunIntensity: 1.8, ambientColor: '#3a5a7a', ambientIntensity: 0.3,
    buildingColor: '#aabbcc', windowColor: '#ddeeff', windowEmissive: '#00aaff', windowEmissiveIntensity: 0.7,
    roofColor: '#5a6a7a', roadColor: '#1a1a1a', sidewalkColor: '#8a8a8a',
    lampColor: '#fff0aa', lampIntensity: 0.9, neonAccent: '#00ffaa', neonIntensity: 1.0,
    particleColor: '#6688cc', particleOpacity: 0.2, groundTint: '#3a3a3a',
  },
  '2025': {
    skyTop: '#0a1a2a', skyBottom: '#2a4a5a', fogColor: '#2a4a5a', sunColor: '#aaddff',
    sunIntensity: 2.0, ambientColor: '#1a2a3a', ambientIntensity: 0.2,
    buildingColor: '#4a5a6a', windowColor: '#cceeff', windowEmissive: '#44ffaa', windowEmissiveIntensity: 0.85,
    roofColor: '#3a4a5a', roadColor: '#0a0a0a', sidewalkColor: '#6a6a6a',
    lampColor: '#aaffaa', lampIntensity: 1.0, neonAccent: '#ff44ff', neonIntensity: 1.2,
    particleColor: '#44ffaa', particleOpacity: 0.3, groundTint: '#1a1a1a',
  },
  '2055': {
    skyTop: '#0a0a1a', skyBottom: '#0a1a3a', fogColor: '#0a1a3a', sunColor: '#44ddff',
    sunIntensity: 2.4, ambientColor: '#0a1a3a', ambientIntensity: 0.15,
    buildingColor: '#1a2a3a', windowColor: '#aaffee', windowEmissive: '#00ffcc', windowEmissiveIntensity: 1.0,
    roofColor: '#0a1a2a', roadColor: '#050510', sidewalkColor: '#2a3a4a',
    lampColor: '#00ffcc', lampIntensity: 1.2, neonAccent: '#00ffff', neonIntensity: 1.5,
    particleColor: '#00ffff', particleOpacity: 0.5, groundTint: '#0a0a1a',
  },
}

export const ERA_BUILDINGS: Record<EraId, EraBuilding> = {
  '1945': { width: 10, depth: 10, height: 18, minHeight: 6, maxHeight: 22, windowRows: 4, windowCols: 4, windowSize: 0.6, setbackMin: 0, setbackMax: 0 },
  '1965': { width: 10, depth: 10, height: 22, minHeight: 8, maxHeight: 28, windowRows: 5, windowCols: 5, windowSize: 0.65, setbackMin: 0, setbackMax: 0.5 },
  '1985': { width: 12, depth: 12, height: 30, minHeight: 10, maxHeight: 36, windowRows: 7, windowCols: 6, windowSize: 0.7, setbackMin: 0, setbackMax: 1.0 },
  '2005': { width: 14, depth: 14, height: 40, minHeight: 12, maxHeight: 50, windowRows: 9, windowCols: 7, windowSize: 0.75, setbackMin: 0, setbackMax: 1.5 },
  '2025': { width: 14, depth: 14, height: 45, minHeight: 12, maxHeight: 55, windowRows: 10, windowCols: 8, windowSize: 0.8, setbackMin: 0, setbackMax: 2.0 },
  '2055': { width: 16, depth: 16, height: 55, minHeight: 15, maxHeight: 65, windowRows: 12, windowCols: 9, windowSize: 0.85, setbackMin: 0, setbackMax: 3.0 },
}