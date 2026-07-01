import type { AudioMixer } from './mixer';

/**
 * One-shot procedural sound effects: a soft "whoosh" for era transitions and a
 * gentle click for UI. All synthesized so the repo stays asset-free.
 */
export class SfxPlayer {
  constructor(private mixer: AudioMixer) {}

  /** Play a filtered-noise whoosh for an era transition. */
  playTransition(): void {
    const ctx = this.mixer.context();
    const bus = this.mixer.sfxBus();
    if (!ctx || !bus) return;

    const now = ctx.currentTime;
    const dur = 0.6;

    // White noise buffer
    const frames = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + dur);
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  /** Short UI click. */
  playClick(): void {
    const ctx = this.mixer.context();
    const bus = this.mixer.sfxBus();
    if (!ctx || !bus) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}
