import * as THREE from 'three';

export interface EraData {
  year: number
  primaryColors: string[]
  ambientLightColor: string
  ambientLightIntensity: number
  fogDensity: number
  fogColor: string
  buildingStyles: BuildingStyle[]
  vehicleTypes: string[]
  pedestrianPalette: PedestrianOutfit[]
  storefrontTemplates: StorefrontTemplate[]
  signageStyle: SignageStyle
  streetFurniture: StreetFurniture[]
  ambientAudioTrack: string
  dayCycleHour: number
  directionalLightHorizontalAngle: number  // Hours from south, 0-24 mapped to 0-360 degrees
  directionalLightVerticalAngle: number    // Elevation angle, 0-90 degrees (positive = up)
}

export type EraKey = '1945' | '1965' | '1985' | '2005' | '2025'

export interface BuildingStyle {
  name: string
  description: string
  roofType: 'flat' | 'pitched' | 'dome' | 'gabled'
  facadeMaterial: 'brick' | 'concrete' | 'glass' | 'steel' | 'wood'
  windowStyle: 'small' | 'medium' | 'large' | 'floor_to_ceiling'
  architecturalDetails: string[]
}

export interface VehicleType {
  name: string
  era: string
  description: string
}

export interface PedestrianOutfit {
  name: string
  description: string
  dominantColors: string[]
}

export interface StorefrontTemplate {
  name: string
  description: string
  windowType: 'display' | 'access' | 'combo'
  signageMount: 'awned' | 'wall-mounted' | 'projecting'
}

export interface SignageStyle {
  font: 'serif' | 'sans' | 'deco' | 'retro'
  colors: string[]
  illumination: 'gas' | 'electric' | 'led' | 'neon'
  typicalText: string
}

export interface StreetFurniture {
  name: string
  era: string
  description: string
}

/** Apply era-specific styles to the scene based on selected year. Updates background color and logs the era being applied. @param scene Three.js scene to update @param year The selected year (1945, 1965, 1985, 2005, 2025) */ export function applyEraStyle(scene: THREE.Scene, year: number): void {
  const era = ERAS[year as keyof typeof ERAS]
  if (!era) return

  // Update scene background color based on era
  scene.background = new THREE.Color(
    parseInt(era.colors.sky.replace('#', ''), 16) / 255,
    parseInt(era.colors.sky.replace('#', ''), 16) / 255,
    parseInt(era.colors.sky.replace('#', ''), 16) / 255
  )

  // Remove existing era-specific objects from previous transitions
  scene.traverse((child) => {
    if (child.userData?.isEraObject) {
      child.geometry.dispose()
      child.material.dispose()
      scene.remove(child)
    }
  })

  // Log the era being applied
  console.log(`Applied era: ${era.name} - ${era.description}`)
}

export const ERAS = {
  '1945': {
    year: 1945,
    primaryColors: ['#8B4513', '#CD853F', '#2F4F4F'],
    ambientLightColor: '#FFDAB9',
    ambientLightIntensity: 1.5,
    fogDensity: 0.004,
    fogColor: '#6B8E23',
    buildingStyles: [
      {
        name: 'prewar',
        description: 'Art Deco and early modernist',
        roofType: 'flat',
        facadeMaterial: 'brick',
        windowStyle: 'small',
        architecturalDetails: ['cornices', 'pilasters', 'ornate moldings']
      },
      {
        name: 'industrial',
        description: 'Post-war reconstruction',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'medium',
        architecturalDetails: ['steel beams', 'large windows', 'fire escapes']
      }
    ],
    vehicleTypes: ['vintage_sedan', 'truck', 'streetcar', 'horse_wagon', 'milk_truck', 'fire_engine', 'bicycle'],
    pedestrianPalette: [
      {
        name: 'business_suit',
        description: '1940s business attire',
        dominantColors: ['#8B4513', '#CD853F', '#2F4F4F']
      },
      {
        name: 'casual',
        description: '1940s casual wear',
        dominantColors: ['#8B4513', '#CD853F', '#2F4F4F']
      }
    ],
    storefrontTemplates: [
      {
        name: 'small_window',
        description: 'Small-pane storefront typical of 1945',
        windowType: 'display',
        signageMount: 'awned'
      }
    ],
    signageStyle: {
      font: 'serif',
      colors: ['#8B4513', '#CD853F'],
      illumination: 'gas',
      typicalText: 'OPEN'
    },
    streetFurniture: [
      {
        name: 'streetlight',
        era: '1945',
        description: '1945-era streetlight'
      },
      {
        name: 'bus_stop_shelter',
        era: '1945',
        description: '1945-era bus stop shelter'
      }
    ]
  },
  '1965': {
    year: 1965,
    primaryColors: ['#1A5E99', '#F1C40F', '#E67E22', '#2C3E50'],
    ambientLightColor: '#E0F7FA',
    ambientLightIntensity: 1.8,
    fogDensity: 0.005,
    fogColor: '#7F8C8D',
    buildingStyles: [
      {
        name: 'renovated_brick',
        description: 'Renovated brick with modern storefronts',
        roofType: 'flat',
        facadeMaterial: 'brick',
        windowStyle: 'large',
        architecturalDetails: ['concrete additions', 'air conditioning units', 'neon tube signs']
      },
      {
        name: 'mid_rise_office',
        description: 'Mid-rise office building (2-3 stories) with horizontal window banding',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['horizontal window bands', 'aluminum framing', 'signage mounting']
      },
      {
        name: 'diner',
        description: 'Diner with classic chrome trim and neon sign',
        roofType: 'flat',
        facadeMaterial: 'steel',
        windowStyle: 'large',
        architecturalDetails: ['chrome trim', 'neon tube signs', 'printed vinyl signage']
      },
      {
        name: 'department_store',
        description: 'Department store with large display windows',
        roofType: 'flat',
        facadeMaterial: 'glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['large display windows', 'printed vinyl signage', 'aluminum framing']
      }
    ],
    vehicleTypes: ['classic_car', 'truck', 'bus', 'vintage_bus'],
    pedestrianPalette: [
      {
        name: 'business_suit',
        description: '1960s business attire',
        dominantColors: ['#1A5E99', '#F1C40F', '#E67E22']
      },
      {
        name: 'casual',
        description: '1960s casual wear',
        dominantColors: ['#1A5E99', '#F1C40F', '#E67E22']
      }
    ],
    storefrontTemplates: [
      {
        name: 'large_window',
        description: 'Large plate-glass storefront typical of 1965',
        windowType: 'display',
        signageMount: 'wall-mounted'
      },
      {
        name: 'combo_window',
        description: 'Combo display/access storefront',
        windowType: 'combo',
        signageMount: 'projecting'
      }
    ],
    signageStyle: {
      font: 'sans',
      colors: ['#1A5E99', '#F1C40F', '#E67E22'],
      illumination: 'neon',
      typicalText: 'OPEN'
    },
    streetFurniture: [
      {
        name: 'bus_stop_shelter',
        era: '1965',
        description: '1965-era bus stop shelter'
      },
      {
        name: 'newspaper_vendor',
        era: '1965',
        description: 'Newspaper vending box on sidewalk'
      },
      {
        name: 'streetlight',
        era: '1965',
        description: 'Tall metal pole streetlight'
      }
    ]
  },
  '1985': {
    year: 1985,
    primaryColors: ['#5D4037', '#E67E22', '#ECF0F1'],
    ambientLightColor: '#F5D6C1',
    ambientLightIntensity: 1.2,
    fogDensity: 0.006,
    fogColor: '#964B00',
    buildingStyles: [
      {
        name: 'postmodern',
        description: 'Postmodern commercial',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'medium',
        architecturalDetails: ['decorative panels', 'colored glass', 'atrium']
      },
      {
        name: 'retail_park',
        description: 'Strip retail development',
        roofType: 'pitched',
        facadeMaterial: 'wood',
        windowStyle: 'large',
        architecturalDetails: ['canopy', 'signage panels', 'parking']
      },
      {
        name: 'brutalist',
        description: 'Brutalist concrete architecture',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'medium',
        architecturalDetails: ['exposed concrete', 'geometric forms', 'massive scale']
      },
      {
        name: 'retail',
        description: '1980s retail with neon trim',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'large',
        architecturalDetails: ['window displays', 'neon strips', 'awning']
      },
      {
        name: 'glass_curtain',
        description: '1985 glass curtain wall',
        roofType: 'flat',
        facadeMaterial: 'glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['aluminum framing', 'spandrel panels', 'reflective coating', 'environment map']
      },
      {
        name: 'retail_restoration',
        description: '1985 brick restoration with cleaned facade',
        roofType: 'flat',
        facadeMaterial: 'brick',
        windowStyle: 'large',
        architecturalDetails: ['brick cleaning', 'restored mortar', 'accent strips', 'steel-and-glass storefront']
      },
      {
        name: 'storefront',
        description: '1985 steel-and-glass storefront',
        roofType: 'flat',
        facadeMaterial: 'glass',
        windowStyle: 'large',
        architecturalDetails: ['aluminum framing', 'steel mullions', 'storefront display']
      },
      {
        name: 'marquee',
        description: '1985 digital LED marquee',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'large',
        architecturalDetails: ['LED scrolling sign', 'digital display', 'aluminum framing']
      },
      {
        name: 'atm_kiosk',
        description: '1985 ATM kiosk on sidewalk',
        roofType: 'flat',
        facadeMaterial: 'brick',
        windowStyle: 'small',
        architecturalDetails: ['ATM machine', 'drive-up lane', 'aluminum framing']
      },
      {
        name: 'chain_restaurant',
        description: '1985 chain restaurant with drive-through',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'large',
        architecturalDetails: ['bold branding', 'canopy', 'drive-through lane', 'ATM kiosk']
      },
      {
        name: 'graffiti_alley',
        description: '1985 graffiti art alley wall',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'small',
        architecturalDetails: ['graffiti mural', 'brick texture', 'alley setting']
      },
      {
        name: 'loft_conversion',
        description: '1985 loft conversion with exposed brick',
        roofType: 'flat',
        facadeMaterial: 'brick',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['exposed brick interior', 'large windows', 'steel beams']
      },
      {
        name: 'office_tower',
        description: '1985 office tower with reflective glass',
        roofType: 'flat',
        facadeMaterial: 'glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['reflective glass', 'aluminum framing', 'modern HVAC']
      }
    ],
    vehicleTypes: ['sedan', 'hatchback', 'truck'],
    pedestrianPalette: [
      {
        name: 'business_suit',
        description: '1980s business attire',
        dominantColors: ['#5D4037', '#E67E22']
      },
      {
        name: 'casual',
        description: '1980s casual wear',
        dominantColors: ['#5D4037', '#E67E22']
      },
      {
        name: 'power_dressing',
        description: '1980s power dressing',
        dominantColors: ['#9B59B6', '#F1C40F', '#000000']
      }
    ],
    storefrontTemplates: [
      {
        name: 'mall_store',
        description: 'mall storefront',
        windowType: 'display',
        signageMount: 'wall-mounted'
      }
    ],
    signageStyle: {
      font: 'deco',
      colors: ['#5D4037', '#E67E22'],
      illumination: 'led',
      typicalText: 'OPEN'
    },
    streetFurniture: [
      {
        name: 'streetlight',
        era: '1985',
        description: '1985-era streetlight'
      }
    ]
  },
  '2005': {
    year: 2005,
    primaryColors: ['#34495E', '#95A5A6', '#ECF0F1'],
    ambientLightColor: '#BDC3C7',
    ambientLightIntensity: 1.0,
    fogDensity: 0.007,
    fogColor: '#7F8C8D',
    buildingStyles: [
      {
        name: 'glass_tower',
        description: 'Glass curtain wall',
        roofType: 'flat',
        facadeMaterial: 'glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['fritted glass', 'aluminum framing', 'energy efficient']
      },
      {
        name: 'mixed_use',
        description: 'Mixed-use development',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'medium',
        architecturalDetails: ['balconies', 'signage', 'green roof']
      },
      {
        name: 'converted_warehouse',
        description: 'Industrial-chic converted warehouse',
        roofType: 'flat',
        facadeMaterial: 'weathered_brick',
        windowStyle: 'large',
        architecturalDetails: ['preserved structural beams', 'loft conversions', 'solar panels', 'green roof']
      },
      {
        name: 'boutique_hotel',
        description: 'Boutique hotel with modern facade',
        roofType: 'flat',
        facadeMaterial: 'concrete_and_glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['automated sliding doors', 'balconies', 'solar panels', 'green roof']
      },
      {
        name: 'coffee_shop',
        description: 'Coffee shop chain with outdoor seating',
        roofType: 'flat',
        facadeMaterial: 'stucco',
        windowStyle: 'display',
        architecturalDetails: ['outdoor seating', 'digital menu board', 'automated doors', 'umbrellas']
      },
      {
        name: 'tech_startup',
        description: 'Tech startup office with glass entrance',
        roofType: 'flat',
        facadeMaterial: 'glass_and_steel',
        windowStyle: 'large',
        architecturalDetails: ['glass entrance', 'digital displays', 'solar panels', 'green roof']
      }
    ],
    vehicleTypes: ['hybrid', 'ev', 'sedan'],
    pedestrianPalette: [
      {
        name: 'business_suit',
        description: '2000s business attire',
        dominantColors: ['#34495E', '#95A5A6']
      },
      {
        name: 'casual',
        description: '2000s casual wear',
        dominantColors: ['#34495E', '#95A5A6']
      }
    ],
    storefrontTemplates: [
      {
        name: 'digital_storefront',
        description: 'Digital display storefront',
        windowType: 'display',
        signageMount: 'wall-mounted'
      }
    ],
    signageStyle: {
      font: 'sans',
      colors: ['#34495E', '#95A5A6'],
      illumination: 'led',
      typicalText: 'OPEN'
    },
    streetFurniture: [
      {
        name: 'streetlight',
        era: '2005',
        description: '2005-era streetlight'
      },
      {
        name: 'bench',
        era: '2005',
        description: '2005-era bench'
      }
    ]
  },
  '2025': {
    year: 2025,
    primaryColors: ['#2C3E50', '#E67E22', '#F1C40F'],
    ambientLightColor: '#ECF0F1',
    ambientLightIntensity: 1.0,
    fogDensity: 0.003,
    fogColor: '#2C3E50',
    buildingStyles: [
      {
        name: 'sustainable',
        description: 'Sustainable modular construction',
        roofType: 'flat',
        facadeMaterial: 'recycled_glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['living walls', 'solar panels', 'rainwater collection']
      },
      {
        name: 'smart_city',
        description: 'Smart glass and steel tower',
        roofType: 'flat',
        facadeMaterial: 'glass_and_steel',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['interactive facade', 'digital displays', 'energy monitoring']
      },
      {
        name: 'neo_brutalist',
        description: 'Neo-brutalist concrete with programmable LEDs',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'medium',
        architecturalDetails: ['programmable LED strips', 'geometric cutouts', 'sensory lighting']
      }
    ],
    vehicleTypes: ['ev', 'autonomous', 'drone'],
    pedestrianPalette: [
      {
        name: 'commuter',
        description: 'Smart city commuter',
        dominantColors: ['#2C3E50', '#ECF0F1']
      },
      {
        name: 'tech_enthusiast',
        description: 'Future-focused attire',
        dominantColors: ['#E67E22', '#F1C40F']
      }
    ],
    storefrontTemplates: [
      {
        name: 'holographic_storefront',
        description: 'Holographic display storefront',
        windowType: 'display',
        signageMount: 'wall-mounted'
      }
    ],
    signageStyle: {
      font: 'sans',
      colors: ['#2C3E50', '#E67E22', '#F1C40F'],
      illumination: 'neon',
      typicalText: 'OPEN'
    },
    streetFurniture: [
      {
        name: 'interactive_kiosk',
        era: '2025',
        description: '2025-era interactive kiosk'
      },
      {
        name: 'solar_charging_station',
        era: '2025',
        description: '2025-era solar charging station'
      }
    ]
  }
}