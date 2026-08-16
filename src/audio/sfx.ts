/**
 * Procedural SFX buffer generator stub.
 *
 * Generates AudioBuffers from SfxEraData parameters using WebAudio API
 * (noise beds, tonal drones, traffic engine sounds). The concrete
 * implementation will use createBuffer + scriptProcessor or AudioWorklet.
 */

import type { EraId } from '../eras.js';
import type { SfxEraData } from '../eras.js';

export interface EraAudioBuffers {
  /** Continuous ambient noise bed. */
  ambient: AudioBuffer;
  /** Loopable traffic/engine sound layer. */
  traffic: AudioBuffer;
  /** One-shot event sounds for this era. */
  events: AudioBuffer[];
}

export interface SfxPlayer {
  /** Start playing all layers at their configured volumes. */
  play(): void;
  /** Stop playback and reset buffers. */
  stop(): void;
  /** Dispose all AudioBufferSourceNodes and free resources. */
  dispose(): void;
}

/**
 * Generate era-specific AudioBuffers procedurally.
 * @param ctx — active AudioContext
 * @param data — SfxEraData for the target era
 * @returns EraAudioBuffers ready for playback
 */
export function generateEraAudioBuffers(
  _ctx: AudioContext,
  _data: SfxEraData,
): EraAudioBuffers {
  // Stub: return empty buffers that will be replaced by actual synthesis
  const sampleRate = _ctx.sampleRate;
  const duration = 2;
  const channels = 2;
  const createEmpty = () => _ctx.createBuffer(channels, sampleRate * duration, sampleRate);

  return {
    ambient: createEmpty(),
    traffic: createEmpty(),
    events: [createEmpty()],
  };
}

/**
 * Generate buffered audio for all five eras.
 * @param ctx — active AudioContext
 * @returns Record<EraId, EraAudioBuffers>
 */
export function generateAllEraBuffers(_ctx: AudioContext): Record<EraId, EraAudioBuffers> {
  const result = {} as Record<EraId, EraAudioBuffers>;
  // Stub placeholder — real implementation iterates SFX_ERA_DATA
  const ids: EraId[] = ['1945', '1965', '1985', '2005', '2025'];
  for (const id of ids) {
    result[id] = generateEraAudioBuffers(_ctx, {
      ambientToneHz: 100,
      trafficProfile: 0.5,
      eventTypes: [],
      musicStyle: 'unknown',
    });
  }
  return result;
}
