import { Era } from '../contexts/EraContext';

export interface EraConfig {
  year: Era;
  label: string;
  description: string;
  buildingStyle: {
    height: number;
    width: number;
    depth: number;
    color: string;
    windowStyle: 'none' | 'small' | 'large' | 'glass' | 'holographic';
    detailLevel: 'low' | 'medium' | 'high';
  };
  vehicleTypes: string[];
  pedestrianStyles: ('formal' | 'casual' | 'vintage' | 'modern' | 'future')[];
  skyColor: string;
  ambientColor: string;
}

export const ERA_CONFIGS: Record<Era, EraConfig> = {
  1945: {
    year: 1945,
    label: 'Post-War Era',
    description: 'Art Deco buildings rise from the ruins. Classic cars and formal attire.',
    buildingStyle: {
      height: 8,
      width: 6,
      depth: 8,
      color: '#8B7355',
      windowStyle: 'small',
      detailLevel: 'medium',
    },
    vehicleTypes: ['sedan_1940s', 'truck_1940s'],
    pedestrianStyles: ['vintage'],
    skyColor: '#87CEEB',
    ambientColor: '#FFE4B5',
  },
  1965: {
    year: 1965,
    label: 'Mid-Century',
    description: 'Modernist architecture flourishes. Muscle cars and bold fashion.',
    buildingStyle: {
      height: 12,
      width: 8,
      depth: 10,
      color: '#5D8AA8',
      windowStyle: 'large',
      detailLevel: 'medium',
    },
    vehicleTypes: ['muscle_car', 'sedan_1960s'],
    pedestrianStyles: ['casual'],
    skyColor: '#FFA07A',
    ambientColor: '#F0E68C',
  },
  1985: {
    year: 1985,
    label: 'Brutalist Era',
    description: 'Concrete giants dominate. SUVs emerge and styles get bold.',
    buildingStyle: {
      height: 20,
      width: 12,
      depth: 12,
      color: '#4A5568',
      windowStyle: 'small',
      detailLevel: 'high',
    },
    vehicleTypes: ['suv_1980s', 'box_truck'],
    pedestrianStyles: ['casual'],
    skyColor: '#87CEEB',
    ambientColor: '#DEB887',
  },
  2005: {
    year: 2005,
    label: 'Glass & Steel',
    description: 'Skyscrapers of glass and steel. Modern vehicles fill the streets.',
    buildingStyle: {
      height: 30,
      width: 15,
      depth: 15,
      color: '#A0AEC0',
      windowStyle: 'glass',
      detailLevel: 'high',
    },
    vehicleTypes: ['sedan_2000s', 'suv_modern'],
    pedestrianStyles: ['modern'],
    skyColor: '#B0E2FF',
    ambientColor: '#E6E6FA',
  },
  2025: {
    year: 2025,
    label: 'Contemporary',
    description: 'Mixed-use spaces with green architecture. EVs and hybrids everywhere.',
    buildingStyle: {
      height: 25,
      width: 12,
      depth: 12,
      color: '#87CEEB',
      windowStyle: 'glass',
      detailLevel: 'high',
    },
    vehicleTypes: ['ev_sedan', 'hybrid_suv'],
    pedestrianStyles: ['modern'],
    skyColor: '#87CEFA',
    ambientColor: '#98FB98',
  },
  2055: {
    year: 2055,
    label: 'Future',
    description: 'Futuristic skyscrapers pierce the clouds. Flying vehicles dot the sky.',
    buildingStyle: {
      height: 50,
      width: 8,
      depth: 8,
      color: '#00BFFF',
      windowStyle: 'holographic',
      detailLevel: 'high',
    },
    vehicleTypes: ['flying_car', 'shuttle'],
    pedestrianStyles: ['future'],
    skyColor: '#000080',
    ambientColor: '#4169E1',
  },
};