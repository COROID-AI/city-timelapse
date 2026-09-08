/**
 * Web Audio contracts for the per-era ambient audio system.
 *
 * The real browser `AudioContext`/`OscillatorNode`/`GainNode` satisfy these
 * structural interfaces, and tests inject a lightweight mock via
 * `AmbientAudioOptions.audioContextFactory` so the audio graph can be asserted
 * in a Node test environment (where the Web Audio API is unavailable).
 */

import type { OscillatorShape } from './layers';

/** A minimal structural view of an `OscillatorNode` used by the ambient graph. */
export interface OscillatorLike {
  /** Waveform family; a plain `string` so real `OscillatorNode` is assignable. */
  type: OscillatorShape | string;
  frequency: { value: number };
  detune: { value: number };
  connect(destination: unknown): void;
  start(when?: number): void;
  stop(when?: number): void;
}

/** A minimal structural view of a `GainNode` used by the ambient graph. */
export interface GainLike {
  gain: { value: number };
  connect(destination: unknown): void;
}

/**
 * A minimal structural view of an `AudioContext`. Only the members the ambient
 * graph touches are declared; the real browser context satisfies them.
 */
export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  close(): Promise<void>;
}

/** Factory used to obtain the underlying `AudioContext`. */
export type AudioContextFactory = () => AudioContextLike;

/** Construction options for {@link AmbientAudio}. */
export interface AmbientAudioOptions {
  /**
   * Optional factory for the underlying `AudioContext`. Defaults to the
   * environment's global `AudioContext`; inject a mock in tests.
   */
  audioContextFactory?: AudioContextFactory;
}
