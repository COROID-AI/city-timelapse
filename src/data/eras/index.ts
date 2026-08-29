/**
 * Era data module.
 *
 * Each year gets a full `TimeEra` dataset in this folder (1945.ts, 1965.ts,
 * ...). The shared contract lives in src/engine/eras.ts; subsystems consume
 * datasets through `ERA_DATA` / `getEraData()`.
 */
import type { EraId, TimeEra } from '../../engine/eras';
import { era1945 } from './1945';
import { era1965 } from './1965';

/** Per-era datasets authored so far, keyed by era id. */
export const ERA_DATA: Partial<Record<EraId, TimeEra>> = {
  '1945': era1945,
  '1965': era1965,
};

/** Returns the dataset for an era id, or undefined when not yet authored. */
export function getEraData(id: EraId): TimeEra | undefined {
  return ERA_DATA[id];
}