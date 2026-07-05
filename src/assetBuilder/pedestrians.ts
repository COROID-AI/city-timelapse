import { EraId } from '../eras';

/**
 * Returns an array of pedestrian asset paths appropriate for the given era.
 * @param era The era ID
 * @returns Array of pedestrian asset paths
 */
export function getPedestrianAssetsForEra(era: EraId): string[] {
  switch (era) {
    case '1945':
      // Post-War Era: workers, soldiers, homemakers, children
      return [
        'pedestrians/1945_factory_worker',
        'pedestrians/1945_soldier',
        'pedestrians/1945_homemaker',
        'pedestrians/1945_businessman',
        'pedestrians/1945_child_playing',
      ];
    case '1965':
      // Swinging Sixties: hippies, business suits, casual youth, mods
      return [
        'pedestrians/1965_hippie',
        'pedestrians/1965_businessman',
        'pedestrians/1965_mod_girl',
        'pedestrians/1965_worker',
        'pedestrians/1965_child',
      ];
    case '1985':
      // Neon Eighties: power suits, casual denim, athletic wear, yuppies
      return [
        'pedestrians/1985_yuppie',
        'pedestrians/1985_denim_teen',
        'pedestrians/1985_aerobics_instructor',
        'pedestrians/1985_businesswoman',
        'pedestrians/1985_worker',
      ];
    case '2005':
      // Digital Dawn: casual modern, business casual, early tech, youth fashion
      return [
        'pedestrians/2005_business_casual',
        'pedestrians/2005_teen_skater',
        'pedestrians/2005_tech_worker',
        'pedestrians/2005_soccer_mom',
        'pedestrians/2005_worker',
      ];
    case '2025':
      // Near Future: sustainable fashion, tech wear, casual, remote workers
      return [
        'pedestrians/2025_tech_worker',
        'pedestrians/2025_sustainable_fashion',
        'pedestrians/2025_remote_worker',
        'pedestrians/2025_fitness_enthusiast',
        'pedestrians/2025_student',
      ];
    default:
      throw new Error(`Unknown era: ${era}`);
  }
}