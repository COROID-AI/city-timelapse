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
        description: 'Post-war business attire',
        dominantColors: ['#2F4F4F', '#8B4513', '#FFFFFF']
      },
      {
        name: 'vintage_dress',
        description: '1940s day dress',
        dominantColors: ['#8B0000', '#FFFFFF', '#F0E68C']
      }
    ],
    storefrontTemplates: [
      {
        name: 'retail',
        description: 'Traditional storefront with display windows',
        windowType: 'display',
        signageMount: 'awned',
        typicalText: 'SHOP'
      },
      {
        name: 'diner',
        description: '1940s diner with chrome accents',
        windowType: 'display',
        signageMount: 'projecting',
        typicalText: 'CAFE'
      }
    ],
    signageStyle: {
      font: 'serif',
      colors: ['#FFFFFF', '#000000'],
      illumination: 'gas',
      typicalText: 'OPEN'
    },
    streetFurniture: [
      {
        name: 'bench',
        description: '1940s cast iron bench',
        era: '1945'
      },
      {
        name: 'streetlamp',
        description: 'Art Deco street lighting',
        era: '1945'
      }
    ],
    ambientAudioTrack: 'midcentury_jazz',
    dayCycleHour: 14,
    directionalLightHorizontalAngle: 210,
    directionalLightVerticalAngle: 45
  },

  '1965': {
    year: 1965,
    primaryColors: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
    ambientLightColor: '#E0FFFF',
    ambientLightIntensity: 2.0,
    fogDensity: 0.003,
    fogColor: '#1E90FF',
    buildingStyles: [
      {
        name: 'midcentury',
        description: 'Mid-century modern',
        roofType: 'flat',
        facadeMaterial: 'glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['clean lines', 'atrium', 'open floor plans']
      },
      {
        name: 'glass_curtain',
        description: 'Curtain wall architecture',
        roofType: 'flat',
        facadeMaterial: 'glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['aluminum framing', 'spandrel panels', 'solar shading']
      }
    ],
    vehicleTypes: ['sports_car', 'van', 'motorcycle'],
    pedestrianPalette: [
      {
        name: 'mod_fashion',
        description: '1960s mod style',
        dominantColors: ['#FF6B6B', '#4ECDC4', '#FFFFFF']
      },
      {
        name: 'office_worker',
        description: '1960s business attire',
        dominantColors: ['#45B7D1', '#FFFFFF', '#8B4513']
      }
    ],
    storefrontTemplates: [
      {
        name: 'retail',
        description: '1960s retail with large windows',
        windowType: 'display',
        signageMount: 'wall-mounted',
        typicalText: 'STORE'
      },
      {
        name: 'coffee_shop',
        description: '1960s coffee house',
        windowType: 'display',
        signageMount: 'projecting',
        typicalText: 'COFFEE'
      }
    ],
    signageStyle: {
      font: 'sans',
      colors: ['#000000', '#FFFFFF'],
      illumination: 'electric',
      typicalText: 'OPEN'
    },
    streetFurniture: [
      {
        name: 'bench',
        description: '1960s modular bench',
        era: '1965'
      },
      {
        name: 'streetlamp',
        description: '1960s futuristic street lighting',
        era: '1965'
      }
    ],
    ambientAudioTrack: '60s_rock',
    dayCycleHour: 16,
    directionalLightHorizontalAngle: 240,
    directionalLightVerticalAngle: 50
  },

  '1985': {
    year: 1985,
    primaryColors: ['#9B59B6', '#F1C40F', '#E67E22'],
    ambientLightColor: '#FFB6C1',
    ambientLightIntensity: 2.5,
    fogDensity: 0.002,
    fogColor: '#8A2BE2',
    buildingStyles: [
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
      }
    ],
    vehicleTypes: ['sports_car', 'hatchback', 'truck'],
    pedestrianPalette: [
      {
        name: 'shoulderpads',
        description: '1980s power dressing',
        dominantColors: ['#9B59B6', '#F1C40F', '#000000']
      },
      {
        name: 'casual',
        description: '1980s casual wear',
        dominantColors: ['#E67E22', '#FFFFFF', '#000000']
      }
    ],
    storefrontTemplates: [
      {
        name: 'mall',
        description: '1980s shopping mall storefront',
        windowType: 'display',
        signageMount: 'wall-mounted',
        typicalText: 'SHOP'
      },
      {
        name: 'arcade',
        description: '1980s video game arcade',
        windowType: 'display',
        signageMount: 'projecting',
        typicalText: 'ARCADE'
      }
    ],
    signageStyle: {
      font: 'deco',
      colors: ['#FF00FF', '#00FFFF'],
      illumination: 'neon',
      typicalText: 'GAMES'
    },
    streetFurniture: [
      {
        name: 'bench',
        description: '1980s concrete bench',
        era: '1985'
      },
      {
        name: 'streetlamp',
        description: '1980s neon street lighting',
        era: '1985'
      }
    ],
    ambientAudioTrack: '80s_synthwave',
    dayCycleHour: 18,
    directionalLightHorizontalAngle: 270,
    directionalLightVerticalAngle: 55
  },

  '2005': {
    year: 2005,
    primaryColors: ['#3498DB', '#E74C3C', '#2ECC71'],
    ambientLightColor: '#87CEEB',
    ambientLightIntensity: 3.0,
    fogDensity: 0.0015,
    fogColor: '#1E90FF',
    buildingStyles: [
      {
        name: 'glass_tower',
        description: 'Early 2000s glass skyscraper',
        roofType: 'flat',
        facadeMaterial: 'glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['curtain wall', 'deep window recesses', 'aluminum spandrels']
      },
      {
        name: 'condo',
        description: '2000s residential condominium',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['balconies', 'mixed-use base', 'glass block accents']
      }
    ],
    vehicleTypes: ['sedan', 'SUV', 'hatchback'],
    pedestrianPalette: [
      {
        name: 'business_casual',
        description: '2000s business casual',
        dominantColors: ['#3498DB', '#E74C3C', '#FFFFFF']
      },
      {
        name: 'tech_enthusiast',
        description: '2000s tech casual',
        dominantColors: ['#2ECC71', '#FFFFFF', '#000000']
      }
    ],
    storefrontTemplates: [
      {
        name: 'corporate',
        description: '2005 corporate storefront',
        windowType: 'display',
        signageMount: 'wall-mounted',
        typicalText: 'OFFICE'
      },
      {
        name: 'boutique',
        description: '2005 boutique retail',
        windowType: 'display',
        signageMount: 'projecting',
        typicalText: 'BOUTIQUE'
      }
    ],
    signageStyle: {
      font: 'sans',
      colors: ['#000000', '#FFFFFF'],
      illumination: 'led',
      typicalText: 'RETAIL'
    },
    streetFurniture: [
      {
        name: 'bench',
        description: '2005 modern bench',
        era: '2005'
      },
      {
        name: 'streetlamp',
        description: '2005 LED street lighting',
        era: '2005'
      }
    ],
    ambientAudioTrack: '2000s_pop',
    dayCycleHour: 15,
    directionalLightHorizontalAngle: 225,
    directionalLightVerticalAngle: 50
  },

  '2025': {
    year: 2025,
    primaryColors: ['#2C3E50', '#ECF0F1', '#E74C3C'],
    ambientLightColor: '#F5F5F5',
    ambientLightIntensity: 3.5,
    fogDensity: 0.001,
    fogColor: '#BDC3C7',
    buildingStyles: [
      {
        name: 'green_tower',
        description: 'Sustainable glass tower',
        roofType: 'flat',
        facadeMaterial: 'glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['solar panels', 'vertical gardens', 'green roof', 'rainwater collection']
      },
      {
        name: 'modular',
        description: 'Modular smart city construction',
        roofType: 'flat',
        facadeMaterial: 'steel',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['prefabricated units', 'smart glass', 'integrated sensors']
      }
    ],
    vehicleTypes: ['ev_car', 'bicycle', 'autonomous_van'],
    pedestrianPalette: [
      {
        name: 'modern',
        description: '2025 modern street style',
        dominantColors: ['#2C3E50', '#ECF0F1', '#FFFFFF']
      },
      {
        name: 'tech_wear',
        description: '2025 tech-wear fashion',
        dominantColors: ['#E74C3C', '#ECF0F1', '#2C3E50']
      }
    ],
    storefrontTemplates: [
      {
        name: 'experience',
        description: '2025 experience-based retail',
        windowType: 'display',
        signageMount: 'wall-mounted',
        typicalText: 'EXPERIENCE'
      },
      {
        name: 'kiosk',
        description: '2025 interactive kiosk',
        windowType: 'display',
        signageMount: 'projecting',
        typicalText: 'KIOSK'
      }
    ],
    signageStyle: {
      font: 'sans',
      colors: ['#000000', '#FFFFFF'],
      illumination: 'led',
      typicalText: 'DIGITAL'
    },
    streetFurniture: [
      {
        name: 'bench',
        description: '2025 smart bench with charging',
        era: '2025'
      },
      {
        name: 'streetlamp',
        description: '2025 IoT-enabled street lighting',
        era: '2025'
      }
    ],
    ambientAudioTrack: 'ambient_electronic',
    dayCycleHour: 13
  }
} as const

export type EraKey = keyof typeof ERAS
export type ERAS = typeof ERAS