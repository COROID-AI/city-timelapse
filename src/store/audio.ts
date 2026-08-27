import { create } from 'zustand';

/**
 * Global audio mute store.
 *
 * Holds the single mute flag that controls all audio output. The mixer reads
 * this to zero its master gain, and the mute toggle button writes to it. Kept
 * separate from the era timeline store so audio state is orthogonal to era
 * selection.
 */
interface AudioState {
  muted: boolean;
  /** Toggle the mute flag. */
  toggleMute: () => void;
  /** Set the mute flag explicitly. */
  setMuted: (muted: boolean) => void;
}

export const useAudio = create<AudioState>((set) => ({
  muted: false,
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setMuted: (muted) => set({ muted }),
}));