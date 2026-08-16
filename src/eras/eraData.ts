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
    vehicleTypes: ['classic_car', 'truck', 'streetcar'],
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
      }
    ],
    storefrontTemplates: [
      {
        name: 'mall_store',
        description: ' mall storefront',
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
        description: '2005 modern bench'
      },
      {
        name: 'streetlamp',
        era: '2005',
        description: '2005 LED street lighting'
      },
      {
        name: 'bike_rack',
        era: '2005',
        description: '2005 sidewalk bike rack'
      },
      {
        name: 'transit_stop',
        era: '2005',
        description: '2005 digital transit stop with schedule display'
      },
      {
        name: 'public_art',
        era: '2005',
        description: '2005 contemporary public art sculpture'
      }
    ]
  },
  '2025': {
    year: 2025,
    primaryColors: ['#ECF0F1', '#BDC3C7', '#95A5A6'],
    ambientLightColor: '#FFFFFF',
    ambientLightIntensity: 0.9,
    fogDensity: 0.008,
    fogColor: '#7F8C8D',
    buildingStyles: [
      {
        name: 'smart_city',
        description: 'Smart city integration',
        roofType: 'flat',
        facadeMaterial: 'glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['solar panels', 'smart glass', 'LED facade']
      },
      {
        name: 'modern_residential',
        description: 'Modern residential high-rise',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['green roof', 'smart home integration', 'prefabricated panels', 'balconies', 'mixed-use base', 'glass block accents']
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
    vehicleTypes: ['autonomous', 'ev', 'sedan'],
    pedestrianPalette: [
      {
        name: 'business_suit',
        description: '2025 business attire',
        dominantColors: ['#ECF0F1', '#BDC3C7']
      },
      {
        name: 'casual',
        description: '2025 casual wear',
        dominantColors: ['#ECF0F1', '#BDC3C7']
      }
    ],
    storefrontTemplates: [
      {
        name: 'interactive_storefront',
        description: 'Interactive digital storefront',
        windowType: 'display',
        signageMount: 'wall-mounted'
      }
    ],
    signageStyle: {
      font: 'sans',
      colors: ['#ECF0F1', '#BDC3C7'],
      illumination: 'led',
      typicalText: 'OPEN'
    },
    streetFurniture: [
      {
        name: 'streetlight',
        era: '2025',
        description: '2025-era streetlight'
      },
      {
        name: 'bench',
        era: '2005',
        description: '2005 modern bench'
      },
      {
        name: 'streetlamp',
        era: '2005',
        description: '2005 LED street lighting'
      },
      {
        name: 'bike_rack',
        era: '2005',
        description: '2005 sidewalk bike rack'
      },
      {
        name: 'transit_stop',
        era: '2005',
        description: '2005 digital transit stop with schedule display'
      },
      {
        name: 'public_art',
        era: '2005',
        description: '2005 contemporary public art sculpture'
      }
    ]
  }
}