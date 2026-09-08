import { getEraYears } from '../scenes/eras';

/**
 * Era selection state store.
 *
 * Owns the single source of truth for the *current* era year plus a tweened
 * `progress` value in [0, 1] that drives smooth scene transitions in front of
 * the viewer. The year list is derived read-only from the shared era registry
 * (`getEraYears()`), so the store never hard-codes its own parallel array of
 * years.
 *
 * `progress` is the fraction along the road from the current era's year to the
 * *next* era year. When the current era is the last (2025) there is no next
 * era, so progress is pinned to 1 (the scene is fully settled).
 */

/** The canonical, ordered era years, derived read-only from the registry. */
export const ERA_YEARS: readonly number[] = getEraYears();

/** The current era year plus the tweened transition progress. */
export interface EraSelection {
  /** The currently selected era year (one of the five canonical years). */
  year: number;
  /**
   * Tweened progress in [0, 1] toward the next era. 0 means fully on the
   * current era, 1 means fully on the next era. Always 1 for the final era.
   */
  progress: number;
}

/** Validate that a year is one of the canonical registry years. */
function assertKnownYear(year: number): void {
  if (!ERA_YEARS.includes(year)) {
    throw new Error(
      `Unknown era year ${year}; expected one of ${ERA_YEARS.join(', ')}`,
    );
  }
}

/**
 * The store's public read surface. Kept intentionally small so the integration
 * owner can wire the slider to the scene without touching internals.
 */
export interface EraStore {
  /** The current selection (year + tweened progress). */
  readonly current: Readonly<EraSelection>;
  /** The canonical, ordered year list derived from the era registry. */
  readonly years: readonly number[];
  /**
   * Select an era year. The selection is applied immediately; `progress` is
   * reset to 0 (fully on the new year) and the scene transitions from there.
   */
  select(year: number): void;
  /**
   * Advance the tweened progress by `delta` (clamped to [0, 1]). When the
   * current year is the final era, progress stays at 1.
   */
  advance(delta: number): void;
  /**
   * Subscribe to selection changes. The listener is invoked (with no args)
   * whenever `select` or `advance` mutates the store, so scene composition can
   * re-render the block in place. Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void;
}

/**
 * Create a new era store whose state is owned entirely by this hook.
 *
 * @param initialYear the starting era year; defaults to the first registry year
 */
export function useEraStore(initialYear?: number): EraStore {
  const startYear =
    initialYear === undefined ? ERA_YEARS[0] : initialYear;
  assertKnownYear(startYear);

  let year: number = startYear;
  let progress: number = 0;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    get current(): Readonly<EraSelection> {
      return Object.freeze({ year, progress });
    },
    get years(): readonly number[] {
      return ERA_YEARS;
    },
    select(nextYear: number): void {
      assertKnownYear(nextYear);
      year = nextYear;
      progress = 0;
      notify();
    },
    advance(delta: number): void {
      if (year === ERA_YEARS[ERA_YEARS.length - 1]) {
        progress = 1;
        return;
      }
      const next = Math.min(1, Math.max(0, progress + delta));
      if (next === progress) {
        return;
      }
      progress = next;
      notify();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}