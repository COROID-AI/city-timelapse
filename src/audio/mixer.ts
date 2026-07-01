import { ERAS } from '../eras/data';
import type { EraId } from '../eras/types';

/**
 * Procedural ambient audio mixer. Each era gets a layered drone whose carrier
 * frequencies and timbre shift by decade, so the soundscape crossfades on era
 * change. All audio is synthesized with oscillators + filters (no asset files).
 */
export class AudioMixer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private layers: AudioNode[] = [];
  private muted = false;
  private started = false;

  /** Lazily create the AudioContext (must happen after a user gesture). */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error('AudioContext unavailable');
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0;
      this.ambientGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.master);
    }
    return this.ctx;
  }

  /** Resume the context after an earlier user interaction (autoplay policy). */
  async resume(): Promise<void> {
    try {
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended') await ctx.resume();
      if (!this.started) {
        this.started = true;
      }
    } catch {
      /* audio is best-effort */
    }
  }

  /**
   * Crossfade the ambient drone to the target era over `duration` ms.
   * Disposes previous oscillators cleanly.
   */
  setEra(era: EraId, duration = 800): void {
    if (!this.started || !this.ctx || !this.ambientGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const t = duration / 1000;

    // Fade out old layers then stop them.
    const oldLayers = this.layers;
    this.layers = [];
    for (const node of oldLayers) {
      if (node instanceof GainNode) {
        node.gain.cancelScheduledValues(now);
        node.gain.setValueAtTime(node.gain.value, now);
        node.gain.linearRampToValueAtTime(0, now + t);
      }
      const stopAt = now + t + 0.05;
      if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
        try {
          (node as OscillatorNode).stop(stopAt);
        } catch {
          /* already stopped */
        }
      }
      try {
        node.disconnect(stopAt as unknown as number);
      } catch {
        /* noop */
      }
    }

    const desc = ERAS[era];
    const baseFreq = 110 - (desc.year - 1945) * 0.5;
    const gain = this.ambientGain;

    const newLayers = this.buildDrone(baseFreq);
    for (const node of newLayers) {
      this.layers.push(node);
      if (node instanceof GainNode) {
        node.gain.setValueAtTime(0, now);
        node.gain.linearRampToValueAtTime(0.5, now + t);
      }
    }

    // Overall ambient gain always ends audible.
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(this.muted ? 0 : 0.8, now + t);
  }

  /** Build a layered drone (carrier + detuned partial + slow LFO). */
  private buildDrone(baseFreq: number): AudioNode[] {
    const ctx = this.ctx!;
    const out: AudioNode[] = [];
    const partials = [1, 1.5, 2.01];

    for (let i = 0; i < partials.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = baseFreq * partials[i];

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600 + i * 200;

      const g = ctx.createGain();
      g.gain.value = 0.5 / partials.length;

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.ambientGain!);
      osc.start();
      out.push(osc, filter, g);
    }

    // Slow amplitude LFO for movement.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain);
    if (this.ambientGain) lfoGain.connect(this.ambientGain.gain);
    lfo.start();
    out.push(lfo, lfoGain);

    return out;
  }

  /** Toggle mute; ramps master gain smoothly. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.9, now + 0.25);
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** The SFX bus for one-shot sounds (used by SfxPlayer). */
  sfxBus(): GainNode | null {
    if (!this.sfxGain) this.ensureContext();
    return this.sfxGain;
  }

  context(): AudioContext | null {
    return this.ctx;
  }

  dispose(): void {
    for (const node of this.layers) {
      try {
        node.disconnect();
      } catch {
        /* noop */
      }
    }
    this.layers = [];
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
