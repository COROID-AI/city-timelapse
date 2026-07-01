/**
 * Ambient audio mixer for the city timelapse.
 *
 * Owns a single {@link AudioContext} and one procedural sound graph per era
 * (see `./sfx`). All era buses feed a master gain whose value is held at 0
 * until {@link Mixer.play} is invoked from a user gesture, satisfying browser
 * autoplay policy. Switching eras crossfades the per-era buses over ~1 s while
 * the master stays untouched.
 */
import { ERA_YEARS, ERAS } from '../eras/data';
import type { Year } from '../eras/types';
import { buildEraVoices, createEraSound, type EraSoundHandle } from './sfx';

/** Master output level reached after {@link Mixer.play} fades in. */
const DEFAULT_MASTER_VOLUME = 0.6;
/** Crossfade duration, clamped into the 800–1500 ms acceptance window. */
const DEFAULT_CROSSFADE_MS = 1000;
const MIN_CROSSFADE_MS = 800;
const MAX_CROSSFADE_MS = 1500;

/** Constructor options for {@link Mixer}. */
export interface MixerOptions {
  /** Target master level (0–1) after fade-in. Defaults to 0.6. */
  readonly masterVolume?: number;
  /** Per-era crossfade duration in ms, clamped to 800–1500. */
  readonly crossfadeMs?: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Procedural, era-aware ambient audio engine.
 *
 * Construct at any time (the context starts suspended and silent); call
 * {@link play} from within a `click`/`keydown` handler to unlock audio, then
 * drive {@link setEra} from the timeline.
 */
export class Mixer {
  private readonly context: AudioContext;
  private readonly master: GainNode;
  private readonly voices: Map<Year, EraSoundHandle> = new Map();
  private readonly crossfadeMs: number;
  private masterVolume: number;
  private current: Year;
  private playing = false;
  private disposed = false;

  constructor(options: MixerOptions = {}) {
    this.crossfadeMs = clamp(
      options.crossfadeMs ?? DEFAULT_CROSSFADE_MS,
      MIN_CROSSFADE_MS,
      MAX_CROSSFADE_MS,
    );
    this.masterVolume = options.masterVolume ?? DEFAULT_MASTER_VOLUME;

    // Created suspended until a user gesture resumes it.
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0; // silent until play()
    this.master.connect(this.context.destination);

    this.current = ERA_YEARS[0];
    for (const year of ERA_YEARS) {
      const handle = createEraSound(
        this.context,
        this.master,
        buildEraVoices(ERAS[year].audioTags),
      );
      // Only the starting era is audible; the rest wait silently at 0.
      handle.output.gain.value = year === this.current ? 1 : 0;
      this.voices.set(year, handle);
    }
  }

  /** The era whose bus is currently (or crossfading toward) full gain. */
  get currentEra(): Year {
    return this.current;
  }

  /** Whether the master bus is faded in. */
  get isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Resumes the AudioContext (call from a user gesture) and fades the master
   * bus up to the configured volume. Safe to call repeatedly.
   */
  play(): void {
    this.ensureActive();
    void this.context.resume();
    this.rampTo(this.master.gain, this.masterVolume);
    this.playing = true;
  }

  /** Fades the master bus to silence. Sources keep running for instant resume. */
  stop(): void {
    this.ensureActive();
    this.rampTo(this.master.gain, 0);
    this.playing = false;
  }

  /**
   * Crossfades from the current era's bus to the target era's bus over the
   * configured duration. A no-op when the era is already active.
   */
  setEra(year: Year): void {
    this.ensureActive();
    if (year === this.current) return;

    const previous = this.voices.get(this.current);
    const next = this.voices.get(year);

    if (previous) this.rampTo(previous.output.gain, 0);
    if (next) this.rampTo(next.output.gain, 1);

    this.current = year;
  }

  /** Updates the target master volume, applying it immediately if playing. */
  setMasterVolume(volume: number): void {
    this.ensureActive();
    this.masterVolume = clamp(volume, 0, 1);
    if (this.playing) this.rampTo(this.master.gain, this.masterVolume);
  }

  /**
   * Stops every source, disconnects every node, and closes the AudioContext.
   * The mixer is unusable afterwards.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0, now);

    for (const handle of this.voices.values()) handle.dispose();
    this.voices.clear();

    this.master.disconnect();
    void this.context.close();
  }

  /** Linearly ramps an AudioParam to `target` over the crossfade duration. */
  private rampTo(param: AudioParam, target: number): void {
    const now = this.context.currentTime;
    param.cancelScheduledValues(now);
    // Capture the current (possibly mid-ramp) value as the ramp start point.
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + this.crossfadeMs / 1000);
  }

  /** Throws if the mixer has been disposed. */
  private ensureActive(): void {
    if (this.disposed) throw new Error('Mixer has been disposed.');
  }
}
