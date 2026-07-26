// Core type definitions for the city timelapse application

export type Era = {
  year: number;
  label: string;
  color: string;
  description: string;
};

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025' | '2055';

export const ERAS: Era[] = [
  { year: 1945, label: '1945', color: '#8d6e63', description: 'Post-War Reconstruction' },
  { year: 1965, label: '1965', color: '#4db6ac', description: 'Swinging Sixties' },
  { year: 1985, label: '1985', color: '#ff8a65', description: 'Neon Eighties' },
  { year: 2005, label: '2005', color: '#9575cd', description: 'Digital Dawn' },
  { year: 2025, label: '2025', color: '#64ffda', description: 'Modern Smart City' },
  { year: 2055, label: '2055', color: '#7c4dff', description: 'Future Utopia' },
];

export const ERA_IDS: EraId[] = ['1945', '1965', '1985', '2005', '2025', '2055'];

export type BuildingStyle = 'brick' | 'concrete' | 'glass' | 'neon' | 'smart' | 'futuristic';

export type VehicleType = 'classic' | 'muscle' | 'compact' | 'modern' | 'electric' | 'flying';

export type PedestrianStyle = '1940s' | '1960s' | '1980s' | '2000s' | 'casual' | 'futuristic';

export type AdStyle = 'poster' | 'neon' | 'digital' | 'holo';

export type GroundStyle = 'cobblestone' | 'asphalt' | 'painted' | 'smart';

export type EraConfig = {
  era: Era;
  buildingStyle: BuildingStyle;
  vehicleType: VehicleType;
  pedestrianStyle: PedestrianStyle;
  adStyle: AdStyle;
  groundStyle: GroundStyle;
  buildingColor: string;
  windowColor: string;
  windowLitColor: string;
  skyColor: string;
  fogColor: string;
  ambientColor: string;
  directionalColor: string;
  sunPosition: [number, number, number];
  buildingDensity: number;
  buildingHeight: number;
  vehicleCount: number;
  pedestrianCount: number;
  adCount: number;
  hasRain: boolean;
  hasSnow: boolean;
  hasNeon: boolean;
  hasFlyingCars: boolean;
};

export const ERA_CONFIGS: Record<EraId, EraConfig> = {
  '1945': {
    era: ERAS[0],
    buildingStyle: 'brick',
    vehicleType: 'classic',
    pedestrianStyle: '1940s',
    adStyle: 'poster',
    groundStyle: 'cobblestone',
    buildingColor: '#8d6e63',
    windowColor: '#263238',
    windowLitColor: '#ffd54f',
    skyColor: '#87ceeb',
    fogColor: '#a8d8ea',
    ambientColor: '#87ceeb',
    directionalColor: '#fff9e6',
    sunPosition: [5, 10, 5],
    buildingDensity: 0.6,
    buildingHeight: 12,
    vehicleCount: 3,
    pedestrianCount: 6,
    adCount: 2,
    hasRain: false,
    hasSnow: false,
    hasNeon: false,
    hasFlyingCars: false,
  },
  '1965': {
    era: ERAS[1],
    buildingStyle: 'concrete',
    vehicleType: 'muscle',
    pedestrianStyle: '1960s',
    adStyle: 'neon',
    groundStyle: 'asphalt',
    buildingColor: '#eceff1',
    windowColor: '#37474f',
    windowLitColor: '#ffeb3b',
    skyColor: '#87ceeb',
    fogColor: '#b3e5fc',
    ambientColor: '#87ceeb',
    directionalColor: '#fff9e6',
    sunPosition: [5, 10, 5],
    buildingDensity: 0.7,
    buildingHeight: 18,
    vehicleCount: 5,
    pedestrianCount: 8,
    adCount: 4,
    hasRain: false,
    hasSnow: false,
    hasNeon: true,
    hasFlyingCars: false,
  },
  '1985': {
    era: ERAS[2],
    buildingStyle: 'concrete',
    vehicleType: 'compact',
    pedestrianStyle: '1980s',
    adStyle: 'neon',
    groundStyle: 'asphalt',
    buildingColor: '#607d8b',
    windowColor: '#263238',
    windowLitColor: '#ff4081',
    skyColor: '#4a4a6a',
    fogColor: '#5d4079',
    ambientColor: '#4a4a6a',
    directionalColor: '#ffd54f',
    sunPosition: [3, 8, 3],
    buildingDensity: 0.8,
    buildingHeight: 22,
    vehicleCount: 6,
    pedestrianCount: 10,
    adCount: 6,
    hasRain: true,
    hasSnow: false,
    hasNeon: true,
    hasFlyingCars: false,
  },
  '2005': {
    era: ERAS[3],
    buildingStyle: 'glass',
    vehicleType: 'modern',
    pedestrianStyle: '2000s',
    adStyle: 'digital',
    groundStyle: 'painted',
    buildingColor: '#cfd8dc',
    windowColor: '#1a237e',
    windowLitColor: '#00e676',
    skyColor: '#87ceeb',
    fogColor: '#e3f2fd',
    ambientColor: '#87ceeb',
    directionalColor: '#fff9e6',
    sunPosition: [5, 10, 5],
    buildingDensity: 0.9,
    buildingHeight: 28,
    vehicleCount: 8,
    pedestrianCount: 12,
    adCount: 8,
    hasRain: false,
    hasSnow: false,
    hasNeon: true,
    hasFlyingCars: false,
  },
  '2025': {
    era: ERAS[4],
    buildingStyle: 'smart',
    vehicleType: 'electric',
    pedestrianStyle: 'casual',
    adStyle: 'digital',
    groundStyle: 'smart',
    buildingColor: '#e0f7fa',
    windowColor: '#006064',
    windowLitColor: '#00e5ff',
    skyColor: '#87ceeb',
    fogColor: '#e0f7fa',
    ambientColor: '#87ceeb',
    directionalColor: '#fff9e6',
    sunPosition: [5, 10, 5],
    buildingDensity: 1.0,
    buildingHeight: 35,
    vehicleCount: 10,
    pedestrianCount: 15,
    adCount: 10,
    hasRain: false,
    hasSnow: false,
    hasNeon: true,
    hasFlyingCars: false,
  },
  '2055': {
    era: ERAS[5],
    buildingStyle: 'futuristic',
    vehicleType: 'flying',
    pedestrianStyle: 'futuristic',
    adStyle: 'holo',
    groundStyle: 'smart',
    buildingColor: '#e8eaf6',
    windowColor: '#0d47a1',
    windowLitColor: '#7c4dff',
    skyColor: '#1a237e',
    fogColor: '#311b92',
    ambientColor: '#4a148c',
    directionalColor: '#e040fb',
    sunPosition: [3, 6, 3],
    buildingDensity: 1.0,
    buildingHeight: 50,
    vehicleCount: 12,
    pedestrianCount: 18,
    adCount: 12,
    hasRain: false,
    hasSnow: false,
    hasNeon: true,
    hasFlyingCars: true,
  },
};

// Linear interpolation helpers
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const lerpColor = (a: string, b: string, t: number): string => {
  const ah = a.replace('#', '');
  const bh = b.replace('#', '');
  const ar = parseInt(ah.substring(0, 2), 16);
  const ag = parseInt(ah.substring(2, 4), 16);
  const ab = parseInt(ah.substring(4, 6), 16);
  const br = parseInt(bh.substring(0, 2), 16);
  const bg = parseInt(bh.substring(2, 4), 16);
  const bb = parseInt(bh.substring(4, 6), 16);
  const rr = Math.round(ar + (br - ar) * t).toString(16).padStart(2, '0');
  const rg = Math.round(ag + (bg - ag) * t).toString(16).padStart(2, '0');
  const rb = Math.round(ab + (bb - ab) * t).toString(16).padStart(2, '0');
  return `#${rr}${rg}${rb}`;
};

export const lerpVec3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
