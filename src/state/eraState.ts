import { EraState } from '../types/era';
import { EraYear, CANONICAL_ERAS, isEraYear } from '../types/city';

/**
 * Reactive era store.
 *
 * Defaults to 1945 and supports exactly the five canonical years
 * 1945/1965/1985/2005/2025. `setYear` clamps out-of-range values to the
 * nearest canonical year, so the store is always in a valid state and every
 * subscribed consumer observes a canonical year.
 */
export function createEraState(initialYear: number = 1945): EraState {
  const listeners = new Set<(year: EraYear) => void>();
  let year: EraYear = clampToCanonical(initialYear);

  function clampToCanonical(value: number): EraYear {
    if (isEraYear(value)) return value;
    // Clamp to nearest canonical year.
    let nearest = CANONICAL_ERAS[0];
    let best = Math.abs(value - CANONICAL_ERAS[0]);
    for (const candidate of CANONICAL_ERAS) {
      const d = Math.abs(value - candidate);
      if (d < best) {
        best = d;
        nearest = candidate;
      }
    }
    return nearest as EraYear;
  }

  function setYear(next: number): void {
    const clamped = clampToCanonical(next);
    if (clamped === year) return;
    year = clamped;
    for (const listener of listeners) listener(year);
  }

  function subscribe(listener: (year: EraYear) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    get year() {
      return year;
    },
    setYear,
    subscribe,
  };
}