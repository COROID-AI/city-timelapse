import { EraYear } from './city';

/**
 * Era domain types.
 *
 * `EraState` is the reactive store that drives the whole scene. `EraRegistry`
 * holds typed, human- and machine-readable metadata per canonical era year.
 */

/** Metadata describing a single canonical era. */
export interface EraMeta {
  /** Canonical year, one of 1945/1965/1985/2005/2025. */
  year: EraYear;
  /** Short human-readable label shown on the timeline slider. */
  label: string;
  /** One-line thematic description. */
  description: string;
  /** Dominant palette hint used by placeholder renderers. */
  accentColor: string;
  /** Free-form tags the downstream era modules may key off. */
  tags: readonly string[];
}

/** The reactive era store. */
export interface EraState {
  /** Current selected year, defaults to 1945. */
  readonly year: EraYear;
  /** Set the era, clamping invalid values to the nearest canonical year. */
  setYear(year: number): void;
  /** Subscribe to era changes. Returns an unsubscribe function. */
  subscribe(listener: (year: EraYear) => void): () => void;
}