import { EraId } from '../eras';

/**
 * Returns building asset identifiers appropriate for the given era.
 * In a real implementation, these would be paths to models, textures, or material descriptors.
 */
export function getBuildingAssetsForEra(era: EraId): string[] {
  switch (era) {
    case '1945':
      // Postwar low-rise: brick factories, row houses, low apartments
      return [
        'buildings/brick_factory',
        'buildings/row_house',
        'buildings/low_rise_apartment',
        'buildings/postwar_duplex',
      ];
    case '1965':
      // Modernist towers: concrete slabs, glass curtain walls, office towers
      return [
        'buildings/modern_apartment',
        'buildings/office_tower',
        'buildings/concrete_slab',
        'buildings/curtain_wall_office',
      ];
    case '1985':
      // Postmodern: playful forms, pastel colors, ornamentation
      return [
        'buildings/postmodern_office',
        'buildings/pastel_building',
        'buildings/glass_tower',
        'buildings/neo_eclectic',
      ];
    case '2005':
      // Glass skyscrapers: sleek, high-rise, mixed-use
      return [
        'buildings/glass_skyscraper',
        'buildings/mixed_use_tower',
        'buildings/glass_atrium',
        'buildings/sleek_office',
      ];
    case '2025':
      // Sustainable eco-buildings: green roofs, solar panels, timber
      return [
        'buildings/solar_skyscraper',
        'buildings/green_roof_building',
        'buildings/timber_tower',
        'buildings/net_zero_office',
      ];
    default:
      return [];
  }
}