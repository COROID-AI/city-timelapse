export type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055';

export interface EraConfig {
  year: Era;
  name: string;
  buildingStyle: {
    baseHeight: number;
    minHeight: number;
    maxHeight: number;
    windowStyle: 'colonnade' | 'grid' | 'modern' | 'glass' | 'led';
    facadeColor: string;
    roofColor: string;
  };
  vehicleStyle: {
    type: 'classic' | 'muscle' | 'sedan' | 'suv' | 'electric' | 'autonomous';
    colors: string[];
  };
  pedestrianStyle: {
    density: number;
    clothingEra: 'vintage' | 'retro' | 'modern' | 'futuristic';
  };
  storefrontStyle: {
    signStyle: 'neon' | 'led' | 'hologram' | 'digital';
    awningColors: string[];
    windowDisplay: boolean;
  };
  lighting: {
    ambient: number;
    directional: [number, number, number];
    skyTint: string;
  };
  postProcessing: {
    bloom: number;
    saturation: number;
    contrast: number;
    colorTemp: number;
  };
}

export const ERA_CONFIGS: Record<Era, EraConfig> = {
  '1945': {
    year: '1945',
    name: 'Post-War Era',
    buildingStyle: {
      baseHeight: 8,
      minHeight: 6,
      maxHeight: 12,
      windowStyle: 'colonnade',
      facadeColor: '#8B7355',
      roofColor: '#5D4037',
    },
    vehicleStyle: {
      type: 'classic',
      colors: ['#2E7D32', '#1565C0', '#795548', '#424242'],
    },
    pedestrianStyle: {
      density: 0.5,
      clothingEra: 'vintage',
    },
    storefrontStyle: {
      signStyle: 'neon',
      awningColors: ['#FF6F00', '#1565C0', '#795548'],
      windowDisplay: true,
    },
    lighting: {
      ambient: 0.6,
      directional: [1, 0.9, 0.8] as [number, number, number],
      skyTint: '#87CEEB',
    },
    postProcessing: {
      bloom: 0.3,
      saturation: 1.0,
      contrast: 1.0,
      colorTemp: 0.9,
    },
  },
  '1965': {
    year: '1965',
    name: 'Mid-Century Modern',
    buildingStyle: {
      baseHeight: 10,
      minHeight: 8,
      maxHeight: 15,
      windowStyle: 'grid',
      facadeColor: '#A1887F',
      roofColor: '#6D4C41',
    },
    vehicleStyle: {
      type: 'muscle',
      colors: ['#D32F2F', '#FF6F00', '#1565C0', '#F57C00'],
    },
    pedestrianStyle: {
      density: 0.7,
      clothingEra: 'retro',
    },
    storefrontStyle: {
      signStyle: 'neon',
      awningColors: ['#E64A19', '#1565C0', '#7B1FA2'],
      windowDisplay: true,
    },
    lighting: {
      ambient: 0.65,
      directional: [1, 0.95, 0.85] as [number, number, number],
      skyTint: '#90CAF9',
    },
    postProcessing: {
      bloom: 0.4,
      saturation: 1.1,
      contrast: 1.05,
      colorTemp: 0.95,
    },
  },
  '1985': {
    year: '1985',
    name: 'Urban Decline',
    buildingStyle: {
      baseHeight: 12,
      minHeight: 10,
      maxHeight: 20,
      windowStyle: 'grid',
      facadeColor: '#6D4C41',
      roofColor: '#4E342E',
    },
    vehicleStyle: {
      type: 'sedan',
      colors: ['#37474F', '#455A64', '#546E7A', '#263238'],
    },
    pedestrianStyle: {
      density: 0.6,
      clothingEra: 'retro',
    },
    storefrontStyle: {
      signStyle: 'neon',
      awningColors: ['#AD1457', '#4527A0', '#00695C'],
      windowDisplay: true,
    },
    lighting: {
      ambient: 0.5,
      directional: [0.9, 0.8, 0.7] as [number, number, number],
      skyTint: '#5C6BC0',
    },
    postProcessing: {
      bloom: 0.2,
      saturation: 0.9,
      contrast: 1.1,
      colorTemp: 0.85,
    },
  },
  '2005': {
    year: '2005',
    name: 'Modern Revival',
    buildingStyle: {
      baseHeight: 15,
      minHeight: 12,
      maxHeight: 25,
      windowStyle: 'modern',
      facadeColor: '#90A4AE',
      roofColor: '#455A64',
    },
    vehicleStyle: {
      type: 'suv',
      colors: ['#FFFFFF', '#000000', '#757575', '#BDBDBD'],
    },
    pedestrianStyle: {
      density: 0.9,
      clothingEra: 'modern',
    },
    storefrontStyle: {
      signStyle: 'digital',
      awningColors: ['#00ACC1', '#FFAB00', '#D81B60'],
      windowDisplay: true,
    },
    lighting: {
      ambient: 0.6,
      directional: [0.95, 0.95, 0.95] as [number, number, number],
      skyTint: '#4FC3F7',
    },
    postProcessing: {
      bloom: 0.5,
      saturation: 1.0,
      contrast: 1.0,
      colorTemp: 1.0,
    },
  },
  '2025': {
    year: '2025',
    name: 'Contemporary',
    buildingStyle: {
      baseHeight: 18,
      minHeight: 15,
      maxHeight: 30,
      windowStyle: 'glass',
      facadeColor: '#B0BEC5',
      roofColor: '#ECEFF1',
    },
    vehicleStyle: {
      type: 'electric',
      colors: ['#00E5FF', '#FF00E5', '#00FFAB', '#FFFFFF', '#000000'],
    },
    pedestrianStyle: {
      density: 1.0,
      clothingEra: 'modern',
    },
    storefrontStyle: {
      signStyle: 'digital',
      awningColors: ['#00E5FF', '#FF00E5', '#7C4DFF'],
      windowDisplay: true,
    },
    lighting: {
      ambient: 0.7,
      directional: [1, 1, 0.9] as [number, number, number],
      skyTint: '#29B6F6',
    },
    postProcessing: {
      bloom: 0.6,
      saturation: 1.1,
      contrast: 1.0,
      colorTemp: 1.0,
    },
  },
  '2055': {
    year: '2055',
    name: 'Neo-Futuristic',
    buildingStyle: {
      baseHeight: 25,
      minHeight: 20,
      maxHeight: 40,
      windowStyle: 'led',
      facadeColor: '#212121',
      roofColor: '#000000',
    },
    vehicleStyle: {
      type: 'autonomous',
      colors: ['#00E5FF', '#FF00E5', '#00FFAB', '#FFFFFF'],
    },
    pedestrianStyle: {
      density: 1.2,
      clothingEra: 'futuristic',
    },
    storefrontStyle: {
      signStyle: 'hologram',
      awningColors: ['#00E5FF', '#FF00E5', '#7C4DFF', '#18FFFF'],
      windowDisplay: true,
    },
    lighting: {
      ambient: 0.5,
      directional: [0.8, 0.9, 1.0] as [number, number, number],
      skyTint: '#283593',
    },
    postProcessing: {
      bloom: 0.8,
      saturation: 1.2,
      contrast: 0.95,
      colorTemp: 1.2,
    },
  },
};

export const ERAS: Era[] = ['1945', '1965', '1985', '2005', '2025', '2055'];