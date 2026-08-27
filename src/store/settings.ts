import { create } from 'zustand';

/**
 * Global settings store.
 *
 * Holds user-facing rendering/quality preferences that are decoupled from the
 * era timeline. The postprocessing toggle lets low-end devices disable the
 * bloom / vignette / tone-mapping pipeline entirely for a cheaper frame.
 */
interface SettingsState {
  /** Whether the postprocessing effect chain is rendered. */
  postprocessingEnabled: boolean;
  /** Enable or disable the postprocessing chain. */
  setPostprocessingEnabled: (enabled: boolean) => void;
  /** Flip the postprocessing toggle. */
  togglePostprocessing: () => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  postprocessingEnabled: true,
  setPostprocessingEnabled: (enabled) =>
    set({ postprocessingEnabled: enabled }),
  togglePostprocessing: () =>
    set({ postprocessingEnabled: !get().postprocessingEnabled }),
}));