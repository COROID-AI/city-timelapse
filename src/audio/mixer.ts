/**
 * Timeline-driven audio mixer for the city timelapse.
 *
 * The mixer owns a single {@link AudioContext} and a small Web Audio graph:
 *
 * ```
 *   ambient source ──┐                            ┌── master gain ── destination
 *   one-shot source ─┼── per-voice gain (ramped) ──┤
 * ```
 *
 * It consumes the procedural SFX catalog in {@link ./sfx} and exposes a
 * timeline subscription API. When the Phase 3 timeline emits an `'eraChange'`
 * event the mixer crossfades the ambient bed to the new era and fires a
 * transition sting; on `'eraTick'` it refreshes the ambient loop without a cut;
 * on `'vehiclePassBy'` / `'footstep'` it triggers the matching one-shot.
 *
 * The timeline emitter contract ({@link TimelineEmitter}) is intentionally
 * minimal and self-contained: it mirrors the DOM `EventEmitter`-style
 * `on`/`off` surface so the mixer can bind to whatever timeline module ships in
 * Phase 3 without a hard import of a file that does not yet exist.
 */

import type { Era } from '../eras/types.js';
import {
  createAmbientLoop,
  createFootstep,
  createTransitionSting,
  createVehiclePassBy,
  isAmbientEvent,
  type SfxEvent,
} from './sfx.js';

/**
 * Minimal timeline event emitter contract the mixer subscribes to. The Phase 3
 * timeline (`src/timeline.ts`) is expected to satisfy this surface; we declare
 * it locally so this module compiles without a hard dependency on that file.
 */
export interface TimelineEmitter {
  /** Register a handler for a named timeline event. Returns an unsubscribe. */
  on(event: 'eraChange', handler: (payload: { era: Era }) => void): () => void;
  on(event: 'eraTick', handler: (payload: { era: Era }) => void): () => void;
  on(event: SfxEvent, handler: (payload: { era: Era }) => void): () => void;
}

/** Crossfade duration between ambient beds when the era changes, in seconds. */
const AMBIENT_CROSSFADE_SECONDS = 1.2;

/** Master output level (linear gain). */
const MASTER_GAIN = 0.8;

/** A live looping ambient voice (source + its own gain node for crossfades). */
interface AmbientVoice {
  readonly era: Era;
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
}

/**
 * Runtime audio mixer. Construct lazily (browser autoplay policies require a
 * user gesture before audio can start) and call {@link AudioMixer.start} once a
 * gesture has occurred.
 */
export class AudioMixer {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  /** Unsubscribe handles returned by the timeline emitter, for teardown. */
  private readonly unsubs: Array<() => void> = [];
  /** Currently audible (or fading-out) ambient voice. */
  private outgoing: AmbientVoice | null = null;
  /** Incoming ambient voice being faded in. */
  private incoming: AmbientVoice | null = null;
  /** Era the mixer currently renders ambience for. */
  private currentEra: Era | null = null;
  /** Whether {@link start} has been called and the context is running. */
  private running = false;

  constructor() {
    const Ctx: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = MASTER_GAIN;
    this.master.connect(this.ctx.destination);
  }

  /**
   * Resume the context (must be called from a user gesture) and begin playing
   * the ambient bed for the given era.
   */
  async start(era: Era): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.running = true;
    this.currentEra = era;
    this.fadeInAmbient(era, 0);
  }

  /**
   * Subscribe to a timeline emitter. The mixer reacts to `'eraChange'`,
   * `'eraTick'`, `'vehiclePassBy'` and `'footstep'`. Returns an unsubscribe
   * that also detaches all handlers.
   */
  subscribe(timeline: TimelineEmitter): () => void {
    const onEraChange = (payload: { era: Era }): void => {
      this.handleEraChange(payload.era);
    };
    const onEraTick = (payload: { era: Era }): void => {
      this.handleEraTick(payload.era);
    };
    const onVehicle = (payload: { era: Era }): void => {
      this.triggerOneShot('vehiclePassBy', payload.era);
    };
    const onFootstep = (payload: { era: Era }): void => {
      this.triggerOneShot('footstep', payload.era);
    };

    this.unsubs.push(timeline.on('eraChange', onEraChange));
    this.unsubs.push(timeline.on('eraTick', onEraTick));
    this.unsubs.push(timeline.on('vehiclePassBy', onVehicle));
    this.unsubs.push(timeline.on('footstep', onFootstep));

    return () => this.unsubscribe();
  }

  /** Detach all timeline handlers. */
  unsubscribe(): void {
    while (this.unsubs.length > 0) {
      const off = this.unsubs.pop();
      off?.();
    }
  }

  /**
   * Crossfade the ambient bed to a new era and fire a transition sting.
 * Called on `'eraChange'`.
   */
  handleEraChange(era: Era): void {
    this.currentEra = era;
    this.fadeInAmbient(era, AMBIENT_CROSSFADE_SECONDS);
    this.triggerOneShot('eraChange', era);
  }

  /**
   * Refresh the ambient loop for the current era without a hard cut. Called on
   * `'eraTick'`. If the era matches the playing bed we simply re-render a fresh
   * loop of the same era and crossfade into it; if the era differs we treat the
   * tick as a soft era change.
   */
  handleEraTick(era: Era): void {
    if (this.currentEra !== era) {
      this.handleEraChange(era);
      return;
    }
    this.fadeInAmbient(era, AMBIENT_CROSSFADE_SECONDS * 0.5);
  }

  /**
   * Trigger a one-shot cue (transition sting, vehicle pass-by, footstep) for the
   * given era. One-shots are scheduled against the timeline's audio clock so
   * they survive tempo drift, and auto-stop when their buffer ends.
   */
  triggerOneShot(event: SfxEvent, era: Era): void {
    if (!this.running) return;
    if (isAmbientEvent(event)) {
      // Ambient events are handled by the crossfade path, not as one-shots.
      return;
    }
    const buffer = this.renderOneShot(event, era);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    source.connect(gain);
    gain.connect(this.master);
    const startAt = this.ctx.currentTime + 0.02;
    source.start(startAt);
    // Auto-release the nodes when the buffer finishes.
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  }

  /** Render a one-shot buffer for the given event/era from the SFX catalog. */
  private renderOneShot(event: SfxEvent, era: Era): AudioBuffer | null {
    switch (event) {
      case 'eraChange':
        return createTransitionSting(this.ctx, era);
      case 'vehiclePassBy':
        return createVehiclePassBy(this.ctx, era);
      case 'footstep':
        return createFootstep(this.ctx, era);
      default:
        return null;
    }
  }

  /**
   * Crossfade to a freshly rendered ambient loop for `era` over `seconds`.
   * The previously incoming voice (if any) becomes the outgoing voice and is
   * faded out; the old outgoing voice (if any) is hard-stopped.
   */
  private fadeInAmbient(era: Era, seconds: number): void {
    if (!this.running) return;
    const buffer = createAmbientLoop(this.ctx, era);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    source.connect(gain);
    gain.connect(this.master);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + Math.max(0.05, seconds));
    source.start(now + 0.02);

    const nextIncoming: AmbientVoice = { era, source, gain };
    this.crossfadeOutgoing(this.incoming, seconds);
    // The previous incoming is now the outgoing voice; the previous outgoing
    // (if any) was already faded out by the prior crossfade — stop it hard.
    if (this.outgoing) {
      this.stopVoice(this.outgoing);
    }
    this.outgoing = this.incoming;
    this.incoming = nextIncoming;
  }

  /** Fade a voice out over `seconds` and then stop it. */
  private crossfadeOutgoing(
    voice: AmbientVoice | null,
    seconds: number,
  ): void {
    if (!voice) return;
    const now = this.ctx.currentTime;
    const fade = Math.max(0.05, seconds);
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + fade);
    const stopAt = now + fade + 0.05;
    voice.source.stop(stopAt);
    voice.source.onended = () => {
      voice.source.disconnect();
      voice.gain.disconnect();
    };
  }

  /** Immediately stop and disconnect a voice. */
  private stopVoice(voice: AmbientVoice): void {
    try {
      voice.source.onended = null;
      voice.source.stop();
    } catch {
      // Source may have already ended; ignore.
    }
    voice.source.disconnect();
    voice.gain.disconnect();
  }

  /** Tear down the whole graph, stop all voices, and close the context. */
  dispose(): void {
    this.unsubscribe();
    if (this.outgoing) this.stopVoice(this.outgoing);
    if (this.incoming) this.stopVoice(this.incoming);
    this.outgoing = null;
    this.incoming = null;
    this.master.disconnect();
    this.running = false;
    void this.ctx.close();
  }
}
