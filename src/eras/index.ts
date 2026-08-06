import type { EraConfig } from './types';

export * from './types';

/**
 * The five canonical eras of the city timelapse, oldest first.
 * Keyboard hotkeys 1-5 map positionally onto this list.
 */
export const ERA_YEARS = [1945, 1965, 1985, 2005, 2025] as const;

/** Union of the canonical era years. */
export type EraYear = (typeof ERA_YEARS)[number];

/** Registry mapping each era year to its configuration. */
export type EraRegistry = Partial<Record<EraYear, EraConfig>>;

/**
 * Default empty era registry. Era-specific content tasks register their
 * configurations here (via {@link registerEra}) without editing foundation
 * files.
 */
export const eraRegistry: EraRegistry = {};

/** Register (or replace) the config for a given era year. */
export function registerEra(year: EraYear, config: EraConfig): void {
  eraRegistry[year] = config;
}

/** The currently selected era year, or null when none is loaded. */
export let activeEra: EraYear | null = null;

/** Set which era is currently active in the timeline. */
export function setActiveEra(year: EraYear | null): void {
  activeEra = year;
}
