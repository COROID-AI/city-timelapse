/**
 * Shared type contract for the per-era audio layers.
 *
 * Each era exposes an `EraAudioLayer` describing its continuous ambient bed
 * (built once and kept alive for click-free crossfades) plus a weighted pool
 * of one-shot SFX that the `AudioManager` schedules at random intervals.
 *
 * Everything is synthesized procedurally via WebAudio oscillators / noise
 * buffers — no bundled or downloaded audio files, so there is no asset
 * licensing risk and nothing to load at runtime.
 */
import type { EraKey } from '../../data/eraDefinition';

/** A continuous ambient bed wired into the graph. */
export interface AmbientHandle {
  /**
   * Set the bed's own level (0..1). The manager additionally crossfades the
   * per-era gain node the bed is connected to, so this is a secondary control
   * for balancing sub-layers if ever needed.
   */
  setGain(level: number): void;
  /** Stop every source and disconnect the bed from the graph. */
  dispose(): void;
  /** Approximate number of live audio source nodes (diagnostics). */
  readonly sourceCount: number;
}

/** A one-shot SFX definition with a weighted random trigger. */
export interface SfxTrigger {
  /** Human-readable cue id, e.g. "carHorn", "churchBell". */
  kind: string;
  /** Relative frequency weight used by the random scheduler. */
  weight: number;
  /** Build, start and schedule cleanup of a one-shot into `out`. */
  play(ctx: AudioContext, out: AudioNode): void;
}

/** Full audio layer for one era: continuous bed + one-shot SFX pool. */
export interface EraAudioLayer {
  /** The year this layer describes. */
  year: EraKey;
  /** Build the continuous ambient bed, connected to `out`. */
  createAmbient(ctx: AudioContext, out: AudioNode): AmbientHandle;
  /** The one-shot SFX pool for this era. */
  sfx: SfxTrigger[];
}