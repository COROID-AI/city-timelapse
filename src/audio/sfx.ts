/**
 * Procedural SFX Engine for City Time Period Timelapse.
 *
 * Implements 100% synthesized sound effects:
 * - Time-warp transition whoosh triggered on year/era change
 * - Car pass-by with Doppler pitch shift and spatial panning
 * - Continuous crowd murmur layer modulated by era crowd density
 * - Era-specific vehicle horn archetypes (vintage klaxon, classic car horn, electric dual tone, modern beep, gentle EV chime)
 */

import type { AudioEraSpec } from '../era/types';
import { createNoiseBuffer } from './synth';

export interface SfxController {
  /**
   * Triggers the procedural time-warp transition whoosh.
   */
  playTransitionWhoosh(durationSeconds?: number): void;

  /**
   * Triggers a vehicle pass-by sound effect with Doppler pitch and pan sweep.
   */
  playCarPassBy(options?: { direction?: 'left-to-right' | 'right-to-left'; speed?: number }): void;

  /**
   * Plays an era-appropriate horn honk or EV chime.
   */
  playHorn(hornType?: AudioEraSpec['hornType']): void;

  /**
   * Updates the continuous crowd murmur volume based on pedestrian density (0.0 to 1.0).
   */
  setCrowdDensity(density: number): void;

  /**
   * Advances internal modulation and procedural timers.
   */
  update(currentTime: number, deltaSeconds: number): void;

  /**
   * Cleans up all active nodes and audio loops cleanly.
   */
  dispose(): void;
}

/**
 * Creates the procedural SFX controller routing to the provided destination node.
 */
export function createSfxController(
  ctx: AudioContext,
  destination: AudioNode,
): SfxController {
  const sfxBus = ctx.createGain();
  sfxBus.gain.setValueAtTime(1.0, ctx.currentTime);
  sfxBus.connect(destination);

  let disposed = false;

  // ---------------------------------------------------------------------------
  // Continuous Crowd Murmur Sub-Graph
  // ---------------------------------------------------------------------------
  const crowdGain = ctx.createGain();
  crowdGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  crowdGain.connect(sfxBus);

  const crowdNoise = createNoiseBuffer(ctx, 'pink', 3.0);
  const crowdSource = ctx.createBufferSource();
  crowdSource.buffer = crowdNoise;
  crowdSource.loop = true;

  // Multi-band formant filters for vocal murmur simulation (~350Hz, 850Hz, 2400Hz)
  const formant1 = ctx.createBiquadFilter();
  formant1.type = 'bandpass';
  formant1.frequency.setValueAtTime(350, ctx.currentTime);
  formant1.Q.setValueAtTime(3.0, ctx.currentTime);

  const formant2 = ctx.createBiquadFilter();
  formant2.type = 'bandpass';
  formant2.frequency.setValueAtTime(850, ctx.currentTime);
  formant2.Q.setValueAtTime(2.5, ctx.currentTime);

  const formantGain = ctx.createGain();
  formantGain.gain.setValueAtTime(0.5, ctx.currentTime);

  try {
    crowdSource.connect(formant1);
    crowdSource.connect(formant2);
    formant1.connect(formantGain);
    formant2.connect(formantGain);
    formantGain.connect(crowdGain);
    crowdSource.start();
  } catch {
    // Fallback for mock contexts
  }

  // ---------------------------------------------------------------------------
  // SFX Trigger Methods
  // ---------------------------------------------------------------------------

  function playTransitionWhoosh(durationSeconds = 1.2): void {
    if (disposed) return;
    try {
      const now = ctx.currentTime;
      const dur = Math.max(0.3, durationSeconds);

      // 1. Noise whoosh layer with sweeping bandpass filter
      const noiseBuf = createNoiseBuffer(ctx, 'pink', Math.min(dur + 0.5, 4.0));
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;

      const sweepFilter = ctx.createBiquadFilter();
      sweepFilter.type = 'bandpass';
      sweepFilter.Q.setValueAtTime(2.5, now);
      sweepFilter.frequency.setValueAtTime(180, now);
      sweepFilter.frequency.exponentialRampToValueAtTime(3200, now + dur * 0.45);
      sweepFilter.frequency.exponentialRampToValueAtTime(350, now + dur);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(0.7, now + dur * 0.4);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      noiseSrc.connect(sweepFilter);
      sweepFilter.connect(noiseGain);
      noiseGain.connect(sfxBus);

      noiseSrc.start(now);
      noiseSrc.stop(now + dur + 0.1);

      // 2. Tonal FM warp riser / downer sweep
      const carrier = ctx.createOscillator();
      carrier.type = 'sawtooth';
      carrier.frequency.setValueAtTime(110, now); // A2
      carrier.frequency.exponentialRampToValueAtTime(880, now + dur * 0.45);
      carrier.frequency.exponentialRampToValueAtTime(165, now + dur);

      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.setValueAtTime(12, now);
      mod.frequency.linearRampToValueAtTime(45, now + dur * 0.45);
      mod.frequency.linearRampToValueAtTime(8, now + dur);

      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(60, now);
      modGain.gain.linearRampToValueAtTime(250, now + dur * 0.45);
      modGain.gain.linearRampToValueAtTime(20, now + dur);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      const carrierGain = ctx.createGain();
      carrierGain.gain.setValueAtTime(0.0001, now);
      carrierGain.gain.linearRampToValueAtTime(0.4, now + dur * 0.45);
      carrierGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      const toneFilter = ctx.createBiquadFilter();
      toneFilter.type = 'lowpass';
      toneFilter.frequency.setValueAtTime(2200, now);

      carrier.connect(toneFilter);
      toneFilter.connect(carrierGain);
      carrierGain.connect(sfxBus);

      mod.start(now);
      carrier.start(now);
      mod.stop(now + dur + 0.1);
      carrier.stop(now + dur + 0.1);
    } catch {
      // Non-standard context safety
    }
  }

  function playCarPassBy(options: { direction?: 'left-to-right' | 'right-to-left'; speed?: number } = {}): void {
    if (disposed) return;
    try {
      const now = ctx.currentTime;
      const speed = Math.max(0.4, options.speed ?? 1.0);
      const dur = 1.6 / speed;
      const direction = options.direction ?? 'left-to-right';

      // Engine rumble + tire hiss
      const engineBuf = createNoiseBuffer(ctx, 'brown', dur + 0.5);
      const engineSrc = ctx.createBufferSource();
      engineSrc.buffer = engineBuf;

      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      // Doppler frequency shift: starts high, drops quickly around center
      engineFilter.frequency.setValueAtTime(650 * speed, now);
      engineFilter.frequency.exponentialRampToValueAtTime(220 * speed, now + dur);

      const passGain = ctx.createGain();
      passGain.gain.setValueAtTime(0.0001, now);
      passGain.gain.linearRampToValueAtTime(0.45, now + dur * 0.45);
      passGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      // Stereo panner if supported
      let panner: StereoPannerNode | null = null;
      if (typeof ctx.createStereoPanner === 'function') {
        try {
          panner = ctx.createStereoPanner();
          const startPan = direction === 'left-to-right' ? -0.85 : 0.85;
          const endPan = direction === 'left-to-right' ? 0.85 : -0.85;
          panner.pan.setValueAtTime(startPan, now);
          panner.pan.linearRampToValueAtTime(endPan, now + dur);
        } catch {
          panner = null;
        }
      }

      engineSrc.connect(engineFilter);
      engineFilter.connect(passGain);

      if (panner) {
        passGain.connect(panner);
        panner.connect(sfxBus);
      } else {
        passGain.connect(sfxBus);
      }

      engineSrc.start(now);
      engineSrc.stop(now + dur + 0.1);
    } catch {
      // Non-standard context safety
    }
  }

  function playHorn(hornType: AudioEraSpec['hornType'] = 'classic_car_horn'): void {
    if (disposed) return;
    try {
      const now = ctx.currentTime;

      if (hornType === 'vintage_klaxon') {
        // 1945: Vibrato buzzing dual tone (~380Hz / 460Hz)
        const dur = 0.55;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(380, now);
        osc2.frequency.setValueAtTime(460, now);

        // Klaxon pitch dip
        osc1.frequency.linearRampToValueAtTime(360, now + dur);
        osc2.frequency.linearRampToValueAtTime(435, now + dur);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.04);
        gain.gain.setValueAtTime(0.3, now + dur - 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(sfxBus);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + dur + 0.05);
        osc2.stop(now + dur + 0.05);
      } else if (hornType === 'gentle_ev_chime') {
        // 2025: Soft FM harmonic chime (~880Hz / 1320Hz)
        const dur = 0.8;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(880, now);
        osc2.frequency.setValueAtTime(1320, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(sfxBus);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + dur + 0.05);
        osc2.stop(now + dur + 0.05);
      } else if (hornType === 'electric_dual_tone') {
        // 1985: Electronic dual tone (~440Hz / 554Hz)
        const dur = 0.4;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'square';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(554.37, now);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(sfxBus);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + dur + 0.05);
        osc2.stop(now + dur + 0.05);
      } else if (hornType === 'modern_beep') {
        // 2005: Crisp modern beep (~500Hz / 620Hz)
        const dur = 0.3;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'triangle';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(520, now);
        osc2.frequency.setValueAtTime(650, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(sfxBus);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + dur + 0.05);
        osc2.stop(now + dur + 0.05);
      } else {
        // 1965 / default: Classic brassy car horn (~400Hz / 500Hz)
        const dur = 0.45;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(415, now);
        osc2.frequency.setValueAtTime(495, now);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(sfxBus);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + dur + 0.05);
        osc2.stop(now + dur + 0.05);
      }
    } catch {
      // Non-standard context safety
    }
  }

  return {
    playTransitionWhoosh,
    playCarPassBy,
    playHorn,

    setCrowdDensity(density: number): void {
      if (disposed) return;
      const clamped = Math.max(0, Math.min(1, density));
      const targetGain = clamped * 0.25;
      try {
        crowdGain.gain.setTargetAtTime(targetGain > 0.001 ? targetGain : 0.0001, ctx.currentTime, 0.1);
      } catch {
        crowdGain.gain.value = targetGain > 0.001 ? targetGain : 0.0001;
      }
    },

    update(_currentTime: number, _deltaSeconds: number): void {
      // SFX timers / modulation if needed
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        crowdGain.gain.setValueAtTime(0.0001, ctx.currentTime);
        crowdSource.stop();
        crowdSource.disconnect();
        sfxBus.disconnect();
      } catch {
        // Safe disposal
      }
    },
  };
}
