/**
 * Era state store with subscribe / setEra pattern.
 *
 * Exposes a minimal reactive store so any module (UI, scene, audio) can
 * react to era changes without importing each other directly.
 */

import type { EraId } from '../eras.js';

type Subscriber = (era: EraId) => void;

export interface EraStore {
  /** Current active era identifier. */
  readonly era: EraId;
  /** Register a callback to be notified when the era changes. */
  subscribe(fn: Subscriber): () => void;
  /** Change the active era and notify all subscribers. */
  setEra(era: EraId): void;
}

/**
 * Creates an isolated era store instance.
 * In a single-page app we expose the singleton below, but this factory
 * lets tests or future micro-frontends spin up independent stores.
 */
function createEraStore(initial: EraId = '1945'): EraStore {
  let era: EraId = initial;
  const subs = new Set<Subscriber>();

  return {
    get era() {
      return era;
    },
    subscribe(fn: Subscriber) {
      subs.add(fn);
      // Return unsubscribe handle
      return () => {
        subs.delete(fn);
      };
    },
    setEra(next: EraId) {
      if (next !== era) {
        era = next;
        for (const fn of subs) {
          fn(era);
        }
      }
    },
  };
}

// ─── Singleton export ───────────────────────────────────────────────────

const eraStore = createEraStore();

export const subscribe = eraStore.subscribe.bind(eraStore);
export const setEra = eraStore.setEra.bind(eraStore);
export const getEra = () => eraStore.era;

export default eraStore;
