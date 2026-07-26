import { Era } from '../eras';
import { PerformanceSettings } from '../performance/PerformanceManager';

/**
 * CityBlock — generates a detailed city block with buildings, streets,
 * sidewalks, vegetation, and era-appropriate details.
 *
 * This module creates the core 3D geometry for the city block using
 * Three.js BufferGeometry for optimal performance.
 */
export interface CityBlockConfig {
  era: Era;
  performance: PerformanceSettings;
  onReady: () => void;
}

export class CityBlock {
  private era: Era;
  private performance: PerformanceSettings;
  private onReady: () => void;
  private buildingCount: number = 0;
  private vehicleCount: number = 0;
  private pedestrianCount: number = 0;

  constructor(config: CityBlockConfig) {
    this.era = config.era;
    this.performance = config.performance;
    this.onReady = config.onReady;
  }

  updateEra(era: Era): void {
    this.era = era;
  }

  updatePerformance(settings: PerformanceSettings): void {
    this.performance = settings;
  }

  getBuildingCount(): number {
    return this.buildingCount;
  }

  getVehicleCount(): number {
    return this.vehicleCount;
  }

  getPedestrianCount(): number {
    return this.pedestrianCount;
  }

  /**
   * Generate building parameters for the current era.
   * Each building has era-appropriate height, facade style, and color.
   */
  getBuildingParams(index: number): BuildingParams {
    const era = this.era;
    const baseSeed = index * 73856093; // Prime-based seed for deterministic variation

    // Building height varies by era — post-war buildings are shorter,
    // modern/glass towers are taller
    let minHeight: number;
    let maxHeight: number;

    switch (era.buildingStyle) {
      case 'brick':
        minHeight = 8;
        maxHeight = 20;
        break;
      case 'concrete':
        minHeight = 15;
        maxHeight = 40;
        break;
      case 'glass':
        minHeight = 20;
        maxHeight = 80;
        break;
    }

    // Future era has some very tall towers
    if (era.year >= 2055) {
      maxHeight = 120;
    }

    const height = minHeight + (pseudoRandom(baseSeed) * (maxHeight - minHeight));
    const width = 8 + pseudoRandom(baseSeed + 1) * 12;
    const depth = 8 + pseudoRandom(baseSeed + 2) * 12;

    // Facade color based on era
    const facadeColor = getFacadeColor(era, baseSeed);
    const windowColor = getWindowColor(era);
    const windowCount = Math.floor(4 + pseudoRandom(baseSeed + 3) * 8);
    const windowRows = Math.floor(height / 2.5);

    // Building features by era
    const hasFireEscape = era.year <= 1965 && pseudoRandom(baseSeed + 4) > 0.5;
    const hasAntenna = era.year >= 1985 && pseudoRandom(baseSeed + 5) > 0.7;
    const hasRoofGarden = era.year >= 2005 && pseudoRandom(baseSeed + 6) > 0.6;
    const hasLedStrips = era.year >= 2025 && pseudoRandom(baseSeed + 7) > 0.5;
    const hasHologram = era.year >= 2055 && pseudoRandom(baseSeed + 8) > 0.4;

    return {
      position: [0, 0, 0] as [number, number, number],
      width,
      depth,
      height,
      facadeColor,
      windowColor,
      windowCount,
      windowRows,
      hasFireEscape,
      hasAntenna,
      hasRoofGarden,
      hasLedStrips,
      hasHologram,
      era: era.year,
    };
  }

  /**
   * Generate vehicle parameters for the current era.
   */
  getVehicleParams(index: number): VehicleParams {
    const era = this.era;
    const seed = index * 54059;

    const vehicleTypes = getVehicleTypesForEra(era);
    const type = vehicleTypes[Math.floor(pseudoRandom(seed) * vehicleTypes.length)];

    const length = getVehicleLength(type, era);
    const width = getVehicleWidth(type, era);
    const height = getVehicleHeight(type, era);

    const color = getVehicleColor(era, seed);
    const speed = 2 + pseudoRandom(seed + 1) * 8;

    return {
      type,
      length,
      width,
      height,
      color,
      speed,
      era: era.year,
    };
  }

  /**
   * Generate pedestrian parameters for the current era.
   */
  getPedestrianParams(index: number): PedestrianParams {
    const era = this.era;
    const seed = index * 2161;

    const outfit = getOutfitForEra(era, seed);
    const height = 1.5 + pseudoRandom(seed + 1) * 0.3;
    const walkSpeed = 0.8 + pseudoRandom(seed + 2) * 0.6;

    return {
      outfit,
      height,
      walkSpeed,
      era: era.year,
    };
  }

  /**
   * Generate street furniture and details for the current era.
   */
  getStreetDetails(): StreetDetails {
    const era = this.era;

    const streetLightType = getStreetLightType(era);
    const hasBenches = era.year >= 1965;
    const hasTrashCans = era.year >= 1985;
    const hasPhoneBoxes = era.year <= 2005;
    const hasDigitalDisplays = era.year >= 2025;
    const hasEVChargers = era.year >= 2025;
    const hasSmartLights = era.year >= 2055;

    return {
      streetLightType,
      hasBenches,
      hasTrashCans,
      hasPhoneBoxes,
      hasDigitalDisplays,
      hasEVChargers,
      hasSmartLights,
      crosswalkStyle: getCrosswalkStyle(era),
      roadMarkings: getRoadMarkings(era),
      signageType: era.signage,
    };
  }

  markReady(): void {
    this.onReady();
  }
}

// Deterministic pseudo-random function (no external dependency)
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export interface BuildingParams {
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  facadeColor: string;
  windowColor: string;
  windowCount: number;
  windowRows: number;
  hasFireEscape: boolean;
  hasAntenna: boolean;
  hasRoofGarden: boolean;
  hasLedStrips: boolean;
  hasHologram: boolean;
  era: number;
}

export interface VehicleParams {
  type: 'sedan' | 'truck' | 'bus' | 'motorcycle' | 'van' | 'suv' | 'electric' | 'autonomous' | 'hover';
  length: number;
  width: number;
  height: number;
  color: string;
  speed: number;
  era: number;
}

export interface PedestrianParams {
  outfit: string;
  height: number;
  walkSpeed: number;
  era: number;
}

export interface StreetDetails {
  streetLightType: 'gas' | 'sodium' | 'led' | 'smart';
  hasBenches: boolean;
  hasTrashCans: boolean;
  hasPhoneBoxes: boolean;
  hasDigitalDisplays: boolean;
  hasEVChargers: boolean;
  hasSmartLights: boolean;
  crosswalkStyle: 'zebra' | 'continental' | 'led';
  roadMarkings: 'solid' | 'dashed' | 'digital';
  signageType: string;
}

function getFacadeColor(era: Era, seed: number): string {
  const colors: Record<string, string[]> = {
    brick: ['#8d6e63', '#795548', '#6d4c41', '#5d4037', '#a1887f'],
    concrete: ['#9e9e9e', '#bdbdbd', '#90a4ae', '#78909c', '#eceff1'],
    glass: ['#4fc3f7', '#81d4fa', '#b3e5fc', '#039be5', '#0288d1', '#29b6f6'],
  };
  const palette = colors[era.buildingStyle] || colors.concrete;
  return palette[Math.floor(pseudoRandom(seed + 10) * palette.length)];
}

function getWindowColor(era: Era): string {
  switch (era.year) {
    case 1945:
      return '#fff9c4'; // Warm yellow (incandescent)
    case 1965:
      return '#fff59d'; // Yellow
    case 1985:
      return '#ffff8b'; // Brighter yellow
    case 2005:
      return '#bbdefb'; // Blue-white LED
    case 2025:
      return '#90caf9'; // Cool blue
    case 2055:
      return '#ce93d8'; // Purple holographic
    default:
      return '#ffffff';
  }
}

function getVehicleTypesForEra(era: Era): VehicleParams['type'][] {
  switch (era.year) {
    case 1945:
      return ['sedan', 'truck', 'motorcycle'];
    case 1965:
      return ['sedan', 'truck', 'motorcycle', 'suv'];
    case 1985:
      return ['sedan', 'truck', 'motorcycle', 'suv', 'van'];
    case 2005:
      return ['sedan', 'truck', 'motorcycle', 'suv', 'van', 'electric'];
    case 2025:
      return ['sedan', 'truck', 'motorcycle', 'suv', 'van', 'electric', 'autonomous'];
    case 2055:
      return ['electric', 'autonomous', 'hover', 'sedan'];
    default:
      return ['sedan', 'truck'];
  }
}

function getVehicleLength(type: string, era: Era): number {
  switch (type) {
    case 'motorcycle':
      return 1.8 + pseudoRandom(0) * 0.5;
    case 'sedan':
      return 4.0 + pseudoRandom(0) * 1.0;
    case 'suv':
      return 4.5 + pseudoRandom(0) * 1.0;
    case 'truck':
      return 6.0 + pseudoRandom(0) * 2.0;
    case 'bus':
      return 10.0 + pseudoRandom(0) * 2.0;
    case 'van':
      return 4.8 + pseudoRandom(0) * 0.8;
    case 'electric':
      return 4.2 + pseudoRandom(0) * 0.8;
    case 'autonomous':
      return 4.0 + pseudoRandom(0) * 0.8;
    case 'hover':
      return 4.0 + pseudoRandom(0) * 0.8;
    default:
      return 4.0;
  }
}

function getVehicleWidth(type: string, era: Era): number {
  switch (type) {
    case 'motorcycle':
      return 0.7;
    case 'hover':
      return 2.0;
    default:
      return 1.6 + pseudoRandom(0) * 0.4;
  }
}

function getVehicleHeight(type: string, era: Era): number {
  switch (type) {
    case 'motorcycle':
      return 1.2;
    case 'hover':
      return 0.8;
    default:
      return 1.4 + pseudoRandom(0) * 0.4;
  }
}

function getVehicleColor(era: Era, seed: number): string {
  const palettes: Record<number, string[]> = {
    1945: ['#2c1a1a', '#4a2c2a', '#3a2421', '#5d4037', '#6d4c41', '#1a1a2e'],
    1965: ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#ffffff', '#212121'],
    1985: ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#ffffff', '#212121', '#ff7043'],
    2005: ['#e53935', '#1e88e5', '#43a047', '#ffffff', '#212121', '#9e9d24', '#00838f'],
    2025: ['#e53935', '#1e88e5', '#43a047', '#ffffff', '#212121', '#00838f', '#455a64', '#ffc107'],
    2055: ['#bb86fc', '#03dac6', '#ff006e', '#76ff03', '#1fff87', '#00b0ff', '#ff1744', '#ffffff'],
  };
  const palette = palettes[era.year] || palettes[2025];
  return palette[Math.floor(pseudoRandom(seed + 20) * palette.length)];
}

function getOutfitForEra(era: Era, seed: number): string {
  const outfits: Record<number, string[]> = {
    1945: ['suit', 'dress', 'overalls', 'coat', 'hat'],
    1965: ['suit', 'minidress', 'turtleneck', 'bellbottoms', 'mod'],
    1985: ['suit', 'business', 'jeans', 'jacket', 'aerobics'],
    2005: ['business', 'casual', 'jeans', 'hoodie', 'business-casual'],
    2025: ['business', 'casual', 'athleisure', 'hoodie', 'smart-casual'],
    2055: ['smart-casual', 'tech-wear', 'holographic', 'adaptive', 'neon'],
  };
  const palette = outfits[era.year] || outfits[2025];
  return palette[Math.floor(pseudoRandom(seed + 30) * palette.length)];
}

function getStreetLightType(era: Era): StreetDetails['streetLightType'] {
  if (era.year <= 1945) return 'gas';
  if (era.year <= 1985) return 'sodium';
  if (era.year <= 2025) return 'led';
  return 'smart';
}

function getCrosswalkStyle(era: Era): StreetDetails['crosswalkStyle'] {
  if (era.year <= 1965) return 'zebra';
  if (era.year <= 2005) return 'continental';
  return 'led';
}

function getRoadMarkings(era: Era): StreetDetails['roadMarkings'] {
  if (era.year <= 1985) return 'solid';
  if (era.year <= 2025) return 'dashed';
  return 'digital';
}
