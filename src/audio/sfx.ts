/**
 * Synthesized Web Audio sound effects for timeline transitions and UI interactions.
 *
 * Fully procedural: transition whoosh, click bursts, and soft success ticks
 * are generated at runtime using oscillators, noise buffers, and biquad filters.
 */

import { clamp } from '../lib/math';
import { createNoiseBuffer } from './ambience';

export interface TransitionWhooshOptions {
  /** Total duration of whoosh effect in seconds (default 1.2s). */
  readonly duration?: number;
  /** Overall intensity multiplier in [0, 2] (default 1.0). */
  readonly intensity?: number;
  /** Optional pre-computed noise buffer for performance. */
  readonly sharedNoiseBuffer?: AudioBuffer;
}

export interface ClickOptions {
  /** Center pitch frequency in Hz (default 1600 Hz). */
  readonly frequency?: number;
  /** Duration of click burst in seconds (default 0.035s / 35ms). */
  readonly duration?: number;
  /** Output volume in [0, 1] (default 0.25). */
  readonly volume?: number;
}

export interface SuccessTickOptions {
  /** Output volume in [0, 1] (default 0.2). */
  readonly volume?: number;
  /** Base pitch frequency in Hz (default 1046.5 Hz - C6). */
  readonly pitch?: number;
}

export interface SfxHandle {
  /** Root output node for this sound effect. */
  readonly node: AudioNode;
  /** Immediately stop and disconnect this sound effect. */
  stop(): void;
}

/**
 * Synthesize a time-travel transition whoosh: a resonant filtered noise sweep
 * combined with a deep sub-frequency surge.
 */
export function playTransitionWhoosh(
  ctx: AudioContext,
  destination: AudioNode,
  options: TransitionWhooshOptions = {},
): SfxHandle {
  const duration = Math.max(0.2, options.duration ?? 1.2);
  const intensity = clamp(options.intensity ?? 1.0, 0, 2);

  const t0 = ctx.currentTime;
  const tPeak = t0 + duration * 0.4;
  const tEnd = t0 + duration;

  const masterSfxGain = ctx.createGain();
  masterSfxGain.gain.setValueAtTime(1.0, t0);
  masterSfxGain.connect(destination);

  const sources: Array<OscillatorNode | AudioBufferSourceNode> = [];
  const nodesToClean: AudioNode[] = [masterSfxGain];

  // 1. Filtered noise sweep
  const noiseBuf = options.sharedNoiseBuffer ?? createNoiseBuffer(ctx, Math.min(duration + 0.5, 4), 77);
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuf;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  if (noiseFilter.Q) {
    noiseFilter.Q.setValueAtTime(2.2, t0);
  }
  noiseFilter.frequency.setValueAtTime(220, t0);
  noiseFilter.frequency.linearRampToValueAtTime(2400, tPeak);
  noiseFilter.frequency.linearRampToValueAtTime(320, tEnd);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t0);
  noiseGain.gain.linearRampToValueAtTime(0.45 * intensity, tPeak);
  noiseGain.gain.linearRampToValueAtTime(0.0001, tEnd);

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterSfxGain);

  noiseSource.start(t0);
  noiseSource.stop(tEnd + 0.05);
  sources.push(noiseSource);
  nodesToClean.push(noiseFilter, noiseGain);

  // 2. Sub-bass resonance sweep for kinetic punch
  const subOsc = ctx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(80, t0);
  subOsc.frequency.linearRampToValueAtTime(160, tPeak);
  subOsc.frequency.linearRampToValueAtTime(45, tEnd);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, t0);
  subGain.gain.linearRampToValueAtTime(0.25 * intensity, tPeak);
  subGain.gain.linearRampToValueAtTime(0.0001, tEnd);

  subOsc.connect(subGain);
  subGain.connect(masterSfxGain);

  subOsc.start(t0);
  subOsc.stop(tEnd + 0.05);
  sources.push(subOsc);
  nodesToClean.push(subGain);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    for (const src of sources) {
      try {
        src.stop();
      } catch {}
      try {
        src.disconnect();
      } catch {}
    }
    for (const n of nodesToClean) {
      try {
        n.disconnect();
      } catch {}
    }
    sources.length = 0;
    nodesToClean.length = 0;
  };

  noiseSource.onended = cleanup;

  return {
    node: masterSfxGain,
    stop: cleanup,
  };
}

/**
 * Synthesize a short, crisp UI click burst with filtered transient and quick decay.
 */
export function playClick(
  ctx: AudioContext,
  destination: AudioNode,
  options: ClickOptions = {},
): SfxHandle {
  const duration = Math.max(0.01, options.duration ?? 0.035);
  const freq = Math.max(100, options.frequency ?? 1600);
  const volume = clamp(options.volume ?? 0.25, 0, 1);

  const t0 = ctx.currentTime;
  const tEnd = t0 + duration;

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(volume, t0);
  clickGain.gain.linearRampToValueAtTime(0.0001, tEnd);
  clickGain.connect(destination);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.linearRampToValueAtTime(freq * 0.35, tEnd);

  osc.connect(clickGain);
  osc.start(t0);
  osc.stop(tEnd + 0.01);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      osc.stop();
    } catch {}
    try {
      osc.disconnect();
    } catch {}
    try {
      clickGain.disconnect();
    } catch {}
  };

  osc.onended = cleanup;

  return {
    node: clickGain,
    stop: cleanup,
  };
}

/**
 * Synthesize a warm, resonant success tick chime (harmonic fifth dual tone).
 */
export function playSuccessTick(
  ctx: AudioContext,
  destination: AudioNode,
  options: SuccessTickOptions = {},
): SfxHandle {
  const volume = clamp(options.volume ?? 0.2, 0, 1);
  const baseFreq = options.pitch ?? 1046.5; // C6
  const fifthFreq = baseFreq * 1.5; // G6

  const duration = 0.14;
  const t0 = ctx.currentTime;
  const tEnd = t0 + duration;

  const tickGain = ctx.createGain();
  tickGain.gain.setValueAtTime(volume, t0);
  tickGain.gain.linearRampToValueAtTime(0.0001, tEnd);
  tickGain.connect(destination);

  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(baseFreq, t0);

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(fifthFreq, t0);

  const subMix = ctx.createGain();
  subMix.gain.setValueAtTime(0.6, t0);

  osc1.connect(tickGain);
  osc2.connect(subMix);
  subMix.connect(tickGain);

  osc1.start(t0);
  osc2.start(t0);
  osc1.stop(tEnd + 0.02);
  osc2.stop(tEnd + 0.02);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      osc1.stop();
      osc2.stop();
    } catch {}
    try {
      osc1.disconnect();
      osc2.disconnect();
      subMix.disconnect();
      tickGain.disconnect();
    } catch {}
  };

  osc1.onended = cleanup;

  return {
    node: tickGain,
    stop: cleanup,
  };
}
