import type { EraId } from '../types';
import { makeNoiseBuffer } from './ambience';

/**
 * Procedural one-shot and looping sound effects.
 *
 * Every SFX is synthesized at runtime from `AudioContext` primitives — no
 * binary audio assets. One-shots (footsteps, pass-bys, horns, whooshes) route
 * through the SFX bus; loops (rain, wind) are continuous beds the engine can
 * start and stop.
 */

/** Union of all supported one-shot / loop SFX names. */
export type SfxName =
  | 'footstep'
  | 'vehiclePassBy'
  | 'horn'
  | 'transitionWhoosh'
  | 'rain'
  | 'wind';

/** A looped SFX bed (rain / wind) with a master gain for volume control. */
export interface SfxLoop {
  /** Master gain for the loop; ramp to 0 to silence. */
  gain: GainNode;
  /** Ramp the loop to a target level over `seconds`. */
  setLevel(level: number, seconds?: number): void;
  /** Stop all sources and disconnect the loop. */
  dispose(): void;
}

/** Named loop beds currently exposed by the engine (rain / wind). */
export type LoopName = 'rain' | 'wind';

/** Build a continuous procedural rain loop. */
export function buildRainLoop(ctx: BaseAudioContext): SfxLoop {
  const master = ctx.createGain();
  master.gain.value = 0;

  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 'white');
  src.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 800;
  const g = ctx.createGain();
  g.gain.value = 0.5;
  src.connect(hp);
  hp.connect(g);
  g.connect(master);
  src.start();

  return {
    gain: master,
    setLevel(level, seconds = 0.05) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(level, ctx.currentTime, seconds);
    },
    dispose() {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
      master.disconnect();
    },
  };
}

/** Build a continuous procedural wind loop. */
export function buildWindLoop(ctx: BaseAudioContext): SfxLoop {
  const master = ctx.createGain();
  master.gain.value = 0;

  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 'pink');
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 400;
  const g = ctx.createGain();
  g.gain.value = 0.6;
  src.connect(lp);
  lp.connect(g);
  g.connect(master);
  src.start();

  return {
    gain: master,
    setLevel(level, seconds = 0.05) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(level, ctx.currentTime, seconds);
    },
    dispose() {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
      master.disconnect();
    },
  };
}

/**
 * Play a one-shot SFX into the SFX bus. `era` selects era-appropriate horn
 * tuning; other one-shots are era-independent.
 */
export function playOneShot(
  ctx: BaseAudioContext,
  name: SfxName,
  out: AudioNode,
  era?: EraId,
): void {
  const now = ctx.currentTime;
  switch (name) {
    case 'footstep': {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 120;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.4, now + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(env);
      env.connect(out);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    }
    case 'vehiclePassBy': {
      // Doppler-ish pitch sweep + filtered noise rolling past.
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.linearRampToValueAtTime(220, now + 0.5);
      osc.frequency.linearRampToValueAtTime(90, now + 1.0);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.linearRampToValueAtTime(3000, now + 0.5);
      filter.frequency.linearRampToValueAtTime(400, now + 1.0);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.35, now + 0.5);
      env.gain.linearRampToValueAtTime(0, now + 1.2);
      osc.connect(filter);
      filter.connect(env);
      env.connect(out);
      osc.start(now);
      osc.stop(now + 1.25);
      break;
    }
    case 'horn': {
      const base = era === '1945' || era === '1965' ? 330 : 392;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = base;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.3, now + 0.02);
      env.gain.setValueAtTime(0.3, now + 0.4);
      env.gain.linearRampToValueAtTime(0, now + 0.55);
      osc.connect(env);
      env.connect(out);
      osc.start(now);
      osc.stop(now + 0.6);
      break;
    }
    case 'transitionWhoosh': {
      const src = ctx.createBufferSource();
      src.buffer = makeNoiseBuffer(ctx, 'pink', 1.5);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.5;
      bp.frequency.setValueAtTime(200, now);
      bp.frequency.exponentialRampToValueAtTime(4000, now + 0.6);
      bp.frequency.exponentialRampToValueAtTime(200, now + 1.2);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.4, now + 0.4);
      env.gain.linearRampToValueAtTime(0, now + 1.2);
      src.connect(bp);
      bp.connect(env);
      env.connect(out);
      src.start(now);
      src.stop(now + 1.25);
      break;
    }
    case 'rain':
    case 'wind':
      // These are loops, handled by the engine via buildXLoop; the one-shot
      // path is a no-op safety net.
      break;
  }
}