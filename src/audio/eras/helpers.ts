/**
 * Small procedural synthesis helpers shared across every era layer.
 *
 * These build WebAudio oscillators / noise buffers from scratch so each era
 * can be fully synthesized with no audio files and no runtime downloads. All
 * helpers are pure graph construction — they do not start or stop anything
 * themselves, which keeps click-free gain automation in one place.
 *
 * The API used here is the modern Web Audio API surfaced by the DOM type
 * definitions: `AudioContext.createOscillator()` / `createGain()` /
 * `createBufferSource()` / `createBiquadFilter()` return nodes whose
 * parameters are `AudioParam` objects, and schedulable sources extend
 * `AudioScheduledSourceNode`.
 */
import type { AmbientHandle, SfxTrigger } from './types';

/** A noise buffer (1s of white noise) reused by every noise-based source. */
let sharedNoise: AudioBuffer | null = null;

/** Lazily build (and memoize) a 1-second white-noise buffer. */
export function getNoiseBuffer(ctx: AudioContext, seconds = 1): AudioBuffer {
  if (sharedNoise !== null && sharedNoise.sampleRate === ctx.sampleRate) {
    return sharedNoise;
  }
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), Math.round(ctx.sampleRate));
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  sharedNoise = buffer;
  return buffer;
}

/** A detuned oscillator pair summed into a single output node. */
export interface DetunedPair {
  /** Summing gain node; connect this into the graph. */
  node: AudioNode;
  /** The two oscillator sources that must be started/stopped. */
  sources: AudioScheduledSourceNode[];
}

/** Build two oscillators detuned by `detuneHz` (opposite directions). */
export function detunedPair(
  ctx: AudioContext,
  freq: number,
  detuneHz = 0.6,
  type: OscillatorType = 'sawtooth',
  gain = 1,
): DetunedPair {
  const makeOsc = (f: number): OscillatorNode => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    return o;
  };
  const a = makeOsc(freq + detuneHz);
  const b = makeOsc(freq - detuneHz);
  const aGain = ctx.createGain();
  aGain.gain.value = gain;
  const bGain = ctx.createGain();
  bGain.gain.value = gain;
  const sum = ctx.createGain();
  sum.gain.value = 1;
  a.connect(aGain);
  b.connect(bGain);
  aGain.connect(sum);
  bGain.connect(sum);
  return { node: sum, sources: [a, b] };
}

/** A band-passed noise source plus its buffer-source node. */
export interface NoiseBed {
  /** Output gain node; connect this into the graph. */
  node: AudioNode;
  /** The looping buffer source that must be started/stopped. */
  source: AudioScheduledSourceNode;
}

/** Build a band-passed noise source (wind, traffic, bus-hiss, chatter). */
export function noiseBed(
  ctx: AudioContext,
  freq: number,
  q = 0.8,
  gain = 1,
): NoiseBed {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  return { node: g, source: src };
}

/** A tiny envelope that ramps a `GainNode` in/out to avoid clicks. */
export function fadeTo(gain: GainNode, target: number, seconds: number, ctx: AudioContext): void {
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(target, now + seconds);
}

/**
 * Schedule an amplitude envelope (attack / release) on a GainNode and
 * schedule the sources to stop after the release completes. The standard
 * click-free pattern for one-shot SFX.
 */
export function scheduleEnvelope(
  ctx: AudioContext,
  gain: GainNode,
  sources: AudioScheduledSourceNode[],
  attack = 0.01,
  sustain = 0.3,
  release = 0.15,
): void {
  const now = ctx.currentTime;
  const start = now + 0.02;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, start + attack);
  gain.gain.setValueAtTime(1, start + attack + sustain);
  gain.gain.linearRampToValueAtTime(0, start + attack + sustain + release);
  for (const s of sources) {
    s.start(start);
    s.stop(start + attack + sustain + release + 0.05);
  }
}

/**
 * Build a self-contained one-shot SFX trigger. Each `play` call constructs a
 * fresh oscillator/noise graph and envelopes it, so overlapping triggers of
 * the same cue never share mutable state and never click.
 */
export function makeSfx(
  _ctx: AudioContext,
  opts: {
    kind: string;
    weight: number;
    freq: number;
    detuneHz?: number;
    type?: OscillatorType;
    oscGain?: number;
    noiseGain?: number;
    noiseFreq?: number;
    noiseQ?: number;
    attack?: number;
    sustain?: number;
    release?: number;
    baseGain?: number;
  },
): SfxTrigger {
  return {
    kind: opts.kind,
    weight: opts.weight,
    play: (c: AudioContext, out: AudioNode) => {
      const pair = detunedPair(c, opts.freq, opts.detuneHz ?? 0.8, opts.type ?? 'sawtooth', opts.oscGain ?? 0.4);
      const mix = c.createGain();
      mix.gain.value = opts.baseGain ?? 0.5;
      pair.node.connect(mix);
      const sources: AudioScheduledSourceNode[] = [...pair.sources];

      if (opts.noiseGain && opts.noiseGain > 0) {
        const bed = noiseBed(c, opts.noiseFreq ?? 800, opts.noiseQ ?? 1.2, opts.noiseGain);
        bed.node.connect(mix);
        sources.push(bed.source);
      }

      const env = c.createGain();
      mix.connect(env);
      env.connect(out);
      scheduleEnvelope(
        c,
        env,
        sources,
        opts.attack ?? 0.01,
        opts.sustain ?? 0.3,
        opts.release ?? 0.15,
      );
    },
  };
}

/** Aggregate helper to dispose a list of handles. */
export function disposeAll(handles: AmbientHandle[]): void {
  for (const h of handles) {
    h.dispose();
  }
}