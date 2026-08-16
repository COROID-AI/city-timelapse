/**
 * Era-aware crossfade mixer stub.
 *
 * Manages layered audio (ambient, traffic, events, music) and performs
 * smooth crossfades between eras via GainNode exponential ramps.
 * Respects browser autoplay policy by initialising on first user gesture.
 */

import type { EraId } from '../eras.js';

export interface SfxMixerOptions {
  /** Crossfade duration in seconds (default 1.5). */
  crossfadeDuration?: number;
}

export interface SfxMixer {
  /** Set the active era and crossfade to its audio profile. */
  setEra(era: EraId): void;
  /** Mute all audio output. */
  mute(): void;
  /** Unmute all audio output. */
  unmute(): void;
  /** Check whether the AudioContext has been resumed (autoplay policy). */
  isPlaying(): boolean;
  /** Trigger resume on first user gesture if needed. */
  initOnGesture(element: HTMLElement): void;
  /** Disconnect all nodes and free resources. */
  dispose(): void;
}

/**
 * Factory function for creating an SfxMixer instance.
 * Currently returns a stub that logs era changes without audio.
 */
export function createSfxMixer(options: SfxMixerOptions = {}): SfxMixer {
  const crossfadeDuration = options.crossfadeDuration ?? 1.5;
  let currentEra: EraId | null = null;

  console.log(`[SfxMixer] Created with ${crossfadeDuration}s crossfade`);

  return {
    setEra(era: EraId) {
      console.log(`[SfxMixer] setEra(${era}) — crossfade ${crossfadeDuration}s`);
      currentEra = era;
    },
    mute() {
      console.log('[SfxMixer] muted');
    },
    unmute() {
      console.log('[SfxMixer] unmuted');
    },
    isPlaying() {
      return currentEra !== null;
    },
    initOnGesture(el: HTMLElement) {
      el.addEventListener('click', () => {
        console.log('[SfxMixer] Autoplay policy satisfied via click');
      }, { once: true });
    },
    dispose() {
      console.log('[SfxMixer] disposed');
    },
  };
}
