/**
 * Per-era SFX & ambient audio system (1945 -> 2025).
 *
 * Canonical entry point for the audio module. Exports the {@link AmbientAudio}
 * engine whose lifecycle (`instantiate` -> `attach` -> `update` -> `dispose`)
 * drives the Web Audio oscillator graph from the shared era registry.
 *
 * ## Lifecycle contract
 *
 * - `instantiate`: `new AmbientAudio({ audioContextFactory? })`
 * - `attach(year)`: build/start the ambience for an era (stops prior layers).
 * - `update(year)`: re-tune to another era (stops all oscillators first).
 * - `dispose()`: stop every oscillator and close the `AudioContext`.
 *
 * @packageDocumentation
 */

export { AmbientAudio } from './audio';
export type { AmbientAudioOptions } from './types';
export { buildEraAmbientProfile } from './layers';
export type {
  EraAmbientProfile,
  OscillatorLayer,
  OscillatorShape,
} from './layers';