export interface Era {
  year: number
  name: string
  color: string
  buildingStyle: 'brick' | 'modernist' | 'neon' | 'glass' | 'mixed' | 'futuristic'
  vehicleStyle: 'classic' | 'muscle' | 'boxy' | 'suv' | 'electric' | 'autonomous'
  storefrontStyle: 'vintage' | 'modernist' | 'neon' | 'digital' | 'led' | 'holographic'
}

export type EraYear = 1945 | 1965 | 1985 | 2005 | 2025 | 2055

export const ERAS: Era[] = [
  { year: 1945, name: 'Post-War Era', color: '#8B4513', buildingStyle: 'brick', vehicleStyle: 'classic', storefrontStyle: 'vintage' },
  { year: 1965, name: 'Modernist Era', color: '#2563EB', buildingStyle: 'modernist', vehicleStyle: 'muscle', storefrontStyle: 'modernist' },
  { year: 1985, name: 'Neon Era', color: '#7C3AED', buildingStyle: 'neon', vehicleStyle: 'boxy', storefrontStyle: 'neon' },
  { year: 2005, name: 'Digital Era', color: '#0EA5E9', buildingStyle: 'glass', vehicleStyle: 'suv', storefrontStyle: 'digital' },
  { year: 2025, name: 'Smart Era', color: '#14B8A6', buildingStyle: 'mixed', vehicleStyle: 'electric', storefrontStyle: 'led' },
  { year: 2055, name: 'Futuristic Era', color: '#F59E0B', buildingStyle: 'futuristic', vehicleStyle: 'autonomous', storefrontStyle: 'holographic' },
]