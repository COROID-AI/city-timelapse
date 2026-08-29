/**
 * Era data module (placeholder).
 *
 * This folder will hold per-era content data (building palettes, vehicle
 * sets, storefront text, pedestrian outfits) in later phases. The shared
 * `EraId` / `EraSpec` contract lives in src/engine/eras.ts and is the common
 * key every era-data file uses.
 */
import type { EraId } from '../../engine/eras';

/** Returns the era id this module's data is keyed to. Placeholder only. */
export function eraDataModuleKey(era: EraId): EraId {
  return era;
}
