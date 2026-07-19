export interface Era {
  year: number
  label: string
  description: string
}

export interface BuildingStyle {
  height: number
  width: number
  depth: number
  color: string
  windowColor: string
  windowPattern: 'grid' | 'large' | 'small' | 'none'
  material: 'brick' | 'concrete' | 'glass' | 'metal' | 'eco'
  detailLevel: number
}

export interface VehicleStyle {
  type: 'car' | 'truck' | 'bus' | 'motorcycle' | 'hover'
  color: string
  bodyStyle: string
  wheelCount: number
  size: number
}

export interface PedestrianStyle {
  outfit: 'formal' | 'casual' | 'vintage' | 'modern' | 'futuristic'
  color: string
  height: number
}

export interface StorefrontStyle {
  type: 'shop' | 'cafe' | 'bank' | 'tech' | 'restaurant' | 'greenhouse'
  signColor: string
  windowDisplay: string
  awning: boolean
}