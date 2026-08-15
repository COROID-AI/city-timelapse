import { useEraStore } from './eraStore';
/**
 * Compatibility wrapper.
 *
 * Some legacy components import `useStore` from `../store`.
 * This file re-exports that shape by mapping it onto the canonical
 * Zustand store implemented in `eraStore`.
 */
export const useStore = () => {
    return useEraStore(s => ({
        currentEra: s.currentEra,
        eraData: s.getEraData(),
    }));
};
