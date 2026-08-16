export const erasData: Record<string, EraData> = {
  '1945': {
    name: '1945',
    description: 'Post-war reconstruction era',
    buildings: ['prewar', 'industrial'],
    vehicles: ['classic_car', 'truck'],
    pedestrians: ['business_suit', 'vintage_dress'],
    colors: { sky: '#87CEEB', building: '#D2B48C' }
  },
  '1965': {
    name: '1965',
    description: 'Mid-century modern era',
    buildings: ['midcentury', 'glass_curtain'],
    vehicles: ['sports_car', 'van'],
    pedestrians: ['mod_fashion', 'office_worker'],
    colors: { sky: '#87CEEB', building: '#FFD700' }
  },
  '1985': {
    name: '1985',
    description: 'Eighties neon era',
    buildings: ['brutalist', 'retail'],
    vehicles: ['sports_car', 'hatchback'],
    pedestrians: ['shoulderpads', 'casual'],
    colors: { sky: '#87CEEB', building: '#8A2BE2' }
  },
  '2005': {
    name: '2005',
    description: 'Early 2000s era',
    buildings: ['glass_tower', 'condo'],
    vehicles: ['sedan', 'SUV'],
    pedestrians: ['business_casual', 'tech_enthusiast'],
    colors: { sky: '#87CEEB', building: '#1E90FF' }
  },
  '2025': {
    name: '2025',
    description: 'Sustainable smart city era',
    buildings: ['green_tower', 'modular'],
    vehicles: ['ev_car', 'bicycle'],
    pedestrians: ['modern', 'tech_wear'],
    colors: { sky: '#87CEEB', building: '#32CD32' }
  },
  '2055': {
    name: '2055',
    description: 'Futuristic era',
    buildings: ['neon', 'holographic'],
    vehicles: ['flying_car', 'drone'],
    pedestrians: ['cyberpunk', 'synthetic_fabric'],
    colors: { sky: '#1a1a2e', building: '#0f0f23' }
  }
}

export interface EraData {
  name: string
  description: string
  buildings: string[]
  vehicles: string[]
  pedestrians: string[]
  colors: { sky: string; building: string }
}