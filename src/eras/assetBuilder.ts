import { EraType } from './types';

/**
 * Example asset builder that returns asset names for a given era.
 * In a real implementation, this would return actual asset paths or descriptors.
 */
export function getAssetsForEra(era: EraType): string[] {
  switch (era) {
    case '1945':
      return ['buildings/brick_factory', 'vehicles/model_t', 'props/park_bench'];
    case '1965':
      return ['buildings/modern_apartment', 'vehicles/mustang', 'props/drive_in_sign'];
    case '1985':
      return ['buildings/glass_tower', 'vehicles/delorean', 'props/arcade_machine'];
    case '2005':
      return ['buildings/coffee_shop', 'vehicles/prius', 'props/wifi_router'];
    case '2025':
      return ['buildings/solar_skyscraper', 'vehicles/tesla_model3', 'props/solar_panel'];
    default:
      return [];
  }
}