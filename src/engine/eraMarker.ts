import type { EraId } from '../types';

/**
 * Era marker host. Owns the single DOM/state location that reflects which era
 * is currently active so QA screenshots (and the timeline UI) can read a
 * deterministic `data-era` attribute.
 */

export type { EraId };

/** Read-only contract for anything that can hold the active era id. */
export interface EraMarkerHost {
  readonly currentEra: EraId;
  /** Persist the era id to a DOM attribute and state. */
  set(era: EraId): void;
}

const ERA_ATTR = 'era';

function rootEl(): HTMLElement | undefined {
  return typeof document !== 'undefined' ? document.documentElement : undefined;
}

/**
 * Create the era marker. Writes `data-era="YYYY"` on `<html>` and keeps the
 * value readable via `.currentEra`. Safe to construct headlessly.
 */
export function createEraMarker(): EraMarkerHost {
  let currentEra: EraId = '1945';

  return {
    get currentEra() {
      return currentEra;
    },
    set(era: EraId) {
      currentEra = era;
      const el = rootEl();
      if (el) el.dataset[ERA_ATTR] = era;
    },
  };
}