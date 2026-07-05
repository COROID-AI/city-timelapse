import { EraId } from '../eras';

/**
 * Returns an array of vehicle asset paths appropriate for the given era.
 * @param era The era ID
 * @returns Array of vehicle asset paths
 */
export function getVehicleAssetsForEra(era: EraId): string[] {
  switch (era) {
    case '1945':
      // Post-War Era: wartime vehicles, early sedans, trucks
      return [
        'vehicles/model_t',          // Ford Model T (still common)
        'vehicles/willys_jeep',      // Willys Jeep (military surplus)
        'vehicles/gmc_truck',        // GMC truck
        'vehicles/chevy_fleetline',  // Chevrolet Fleetline
        'vehicles/ford_f1',          // Ford F-1 truck
      ];
    case '1965':
      // Swinging Sixties: muscle cars, classic European imports
      return [
        'vehicles/mustang',          // Ford Mustang
        'vehicles/volkswagen_beetle',// Volkswagen Beetle
        'vehicles/chevy_impala',     // Chevrolet Impala
        'vehicles/ford_galaxie',     // Ford Galaxie
        'vehicles/chevy_camaro',     // Chevrolet Camaro (late 60s)
      ];
    case '1985':
      // Neon Eighties: boxy cars, minivans, early Japanese imports
      return [
        'vehicles/toyota_camry',     // Toyota Camry
        'vehicles/ford_mustang',     // Ford Mustang (Fox body)
        'vehicles/chevy_celebrity',  // Chevrolet Celebrity (representative 80s sedan)
        'vehicles/dodge_caravan',    // Dodge Caravan (early minivan)
        'vehicles/honda_accord',     // Honda Accord
      ];
    case '2005':
      // Digital Dawn: early 2000s sedans, SUVs, hybrids
      return [
        'vehicles/toyota_prius',     // Toyota Prius
        'vehicles/honda_civic',      // Honda Civic
        'vehicles/ford_f150',        // Ford F-150
        'vehicles/chevy_silverado',  // Chevrolet Silverado
        'vehicles/toyota_camry',     // Toyota Camry (popular sedan)
      ];
    case '2025':
      // Near Future: electric vehicles, hybrids, futuristic designs
      return [
        'vehicles/tesla_model3',     // Tesla Model 3
        'vehicles/chevy_bolt',       // Chevrolet Bolt EV
        'vehicles/ford_mach_e',      // Ford Mustang Mach-E
        'vehicles/tesla_model_y',    // Tesla Model Y
        'vehicles/rivian_r1t',       // Rivian R1T truck
      ];
    default:
      throw new Error(`Unknown era: ${era}`);
  }
}