export type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

export interface EraConfig {
  buildingStyle: {
    height: number
    width: number
    depth: number
    windowPattern: string
    facadeColor: string
    roofStyle: string
  }
  vehicleStyle: {
    type: string
    color: string
    speed: number
  }
  pedestrianStyle: {
    clothingStyle: string
    prop: string
  }
  storefrontStyle: {
    signage: string
    products: string
    advertisement: string
  }
  environmentLighting: {
    color: string
    intensity: number
  }
}

export const ERA_CONFIGS: Record<Era, EraConfig> = {
  '1945': {
    buildingStyle: {
      height: 8,
      width: 12,
      depth: 10,
      windowPattern: 'grid', // Small, regular windows
      facadeColor: '#8B7355', // Brownstone
      roofStyle: 'flat'
    },
    vehicleStyle: {
      type: 'vintage',
      color: '#4A90E2',
      speed: 0.02
    },
    pedestrianStyle: {
      clothingStyle: 'vintage',
      prop: 'newspaper'
    },
    storefrontStyle: {
      signage: 'hand_painted',
      products: 'general_store',
      advertisement: 'wartime_posters'
    },
    environmentLighting: {
      color: '#FFE4B5',
      intensity: 0.8
    }
  },
  '1965': {
    buildingStyle: {
      height: 12,
      width: 15,
      depth: 12,
      windowPattern: 'large_panels',
      facadeColor: '#A0522D',
      roofStyle: 'flat_with_ac'
    },
    vehicleStyle: {
      type: 'muscle_car',
      color: '#FF4500',
      speed: 0.05
    },
    pedestrianStyle: {
      clothingStyle: 'mod',
      prop: 'umbrella'
    },
    storefrontStyle: {
      signage: 'neon',
      products: 'department_store',
      advertisement: 'retro_futuristic'
    },
    environmentLighting: {
      color: '#FFA500',
      intensity: 0.9
    }
  },
  '1985': {
    buildingStyle: {
      height: 15,
      width: 18,
      depth: 15,
      windowPattern: 'mixed_shapes',
      facadeColor: '#CD853F',
      roofStyle: 'varied'
    },
    vehicleStyle: {
      type: 'sedan',
      color: '#32CD32',
      speed: 0.04
    },
    pedestrianStyle: {
      clothingStyle: '80s',
      prop: 'boombox'
    },
    storefrontStyle: {
      signage: 'modern_neon',
      products: 'electronics',
      advertisement: 'vibrant_80s'
    },
    environmentLighting: {
      color: '#87CEEB',
      intensity: 1.0
    }
  },
  '2005': {
    buildingStyle: {
      height: 20,
      width: 20,
      depth: 18,
      windowPattern: 'glass_curtain',
      facadeColor: '#C0C0C0',
      roofStyle: 'flat_green'
    },
    vehicleStyle: {
      type: 'suv',
      color: '#4169E1',
      speed: 0.03
    },
    pedestrianStyle: {
      clothingStyle: 'early_2000s',
      prop: 'phone'
    },
    storefrontStyle: {
      signage: 'led',
      products: 'tech_gadgets',
      advertisement: 'digital_age'
    },
    environmentLighting: {
      color: '#87CEFA',
      intensity: 1.1
    }
  },
  '2025': {
    buildingStyle: {
      height: 25,
      width: 22,
      depth: 20,
      windowPattern: 'smart_glass',
      facadeColor: '#E0E0E0',
      roofStyle: 'green_tech'
    },
    vehicleStyle: {
      type: 'ev',
      color: '#00FF7F',
      speed: 0.03
    },
    pedestrianStyle: {
      clothingStyle: 'modern',
      prop: 'smartphone'
    },
    storefrontStyle: {
      signage: ' holographic',
      products: 'eco_friendly',
      advertisement: 'sustainable'
    },
    environmentLighting: {
      color: '#87CEEB',
      intensity: 1.2
    }
  },
  '2055': {
    buildingStyle: {
      height: 35,
      width: 25,
      depth: 25,
      windowPattern: 'adaptive_smart',
      facadeColor: '#FFFFFF',
      roofStyle: 'levitating_garden'
    },
    vehicleStyle: {
      type: 'autonomous_pod',
      color: '#FF00FF',
      speed: 0.06
    },
    pedestrianStyle: {
      clothingStyle: 'futuristic',
      prop: 'holographic_device'
    },
    storefrontStyle: {
      signage: 'holographic_3d',
      products: 'anti_gravity',
      advertisement: 'space_age'
    },
    environmentLighting: {
      color: '#E0FFFF',
      intensity: 1.5
    }
  }
}

export const ERAS: Era[] = ['1945', '1965', '1985', '2005', '2025', '2055']
export const ERA_LABELS: Record<Era, string> = {
  '1945': '1945 - Early Urban',
  '1965': '1965 - Mid-Century Modern',
  '1985': '1985 - Postmodern',
  '2005': '2005 - Contemporary',
  '2025': '2025 - Modern Glass',
  '2055': '2055 - Futuristic'
}