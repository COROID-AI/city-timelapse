/**
 * SfxSystem — generated, license-free ambient beds and cues via the Web Audio
 * API.
 *
 * Each era gets a distinct ambient bed synthesized entirely from oscillators and
 * filtered noise — no external audio assets required:
 *   - A low traffic-hum drone (filtered brown/pink noise bed)
 *   - A crowd-murmur layer (band-passed noise modulated by a slow LFO)
 *   - Era-typical tonal accents (streetcar bell, synth pad, EV chime, etc.)
 *
 * Short cues are triggered on demand:
 *   - `playLightChange()`   — a soft click/chime when the traffic signal changes
 *   - `playTransitionWhoosh()` — a sweep when the era cross-fade begins
 *
 * Audio is **muted by default** to comply with browser autoplay policies. The
 * AudioContext is created lazily on first user gesture (the HUD toggle), then
 * the ambient bed for the current era starts. A `setEra` method cross-fades the
 * ambient bed between eras; a `update` method advances the scheduler.
 */

import {
  DEFAULT_ERA_CONFIG,
  type EraKey,
} from '../eras/eraConfig.js';

/** Master output gain (pre-mute). */
const MASTER_GAIN = 0.5;
/** Cross-fade time for ambient bed swaps, in seconds. */
const BED_FADE_SEC = 1.2;

/** Signature of a synthesized ambient bed node bundle. */
interface AmbientBed {
  /** Master gain node for this bed (used for cross-fade). */
  gain: GainNode;
  /** Stop and disconnect every node in the bed. */
  dispose: () => void;
  /** Per-frame update for modulated beds (drives LFOs, etc.). */
  update?: (deltaMs: number) => void;
}

export interface SfxSystemOptions {
  /** Start muted (default true — respects autoplay policies). */
  startMuted?: boolean;
}

export interface SfxSystem {
  /**
   * Toggle mute on/off. Returns the new muted state. On first unmute this
   * creates/resumes the AudioContext (must be called from a user gesture).
   */
  toggleMute: () => boolean;
  /** Whether audio is currently muted. */
  isMuted: () => boolean;
  /** Whether the AudioContext has been created and is running. */
  isEnabled: () => boolean;
  /**
   * Set the active era and cross-fade the ambient bed. Called by the
   * TransitionManager or timeline handler. Also triggers the transition whoosh.
   */
  setEra: (era: EraKey) => void;
  /** Play the traffic-light-change cue. */
  playLightChange: () => void;
  /** Play the era-transition whoosh cue. */
  playTransitionWhoosh: () => void;
  /** Advance the scheduler. Call every frame from the render loop. */
  update: (deltaMs: number) => void;
  /** Clean up all audio nodes and close the context. */
  dispose: () => void;
}

/**
 * Create the SfxSystem.
 *
 * The AudioContext is created lazily — only when the user first unmutes — to
 * comply with autoplay policies. Until then, all methods are safe no-ops.
 */
export function createSfxSystem(options: SfxSystemOptions = {}): SfxSystem {
  const startMuted = options.startMuted ?? true;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = startMuted;
  let currentEra: EraKey = '1945';
  let currentBed: AmbientBed | null = null;

  // Accent scheduling state.
  let schedulerAccumulator = 0;
  let nextAccentMs = 4000 + Math.random() * 6000;

  // -----------------------------------------------------------------
  // Noise buffer cache (brown noise for traffic hum / crowd murmur)
  // -----------------------------------------------------------------
  let brownNoiseBuffer: AudioBuffer | null = null;
  let whiteNoiseBuffer: AudioBuffer | null = null;

  function getBrownNoiseBuffer(c: AudioContext): AudioBuffer {
    if (brownNoiseBuffer) return brownNoiseBuffer;
    const seconds = 4;
    const length = c.sampleRate * seconds;
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Brown noise: integrate white noise with a leak.
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    brownNoiseBuffer = buffer;
    return buffer;
  }

  function getWhiteNoiseBuffer(c: AudioContext): AudioBuffer {
    if (whiteNoiseBuffer) return whiteNoiseBuffer;
    const seconds = 2;
    const length = c.sampleRate * seconds;
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    whiteNoiseBuffer = buffer;
    return buffer;
  }

  // -----------------------------------------------------------------
  // AudioContext lifecycle
  // -----------------------------------------------------------------
  function ensureContext(): boolean {
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
    if (ctx) return true;

    const AudioCtor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return false;

    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_GAIN;
    master.connect(ctx.destination);
    return true;
  }

  // -----------------------------------------------------------------
  // Ambient bed builders — one per era
  // -----------------------------------------------------------------

  /**
   * Traffic-hum bed: brown noise → low-pass filter, the core drone for every
   * era. Era differences come from filter frequency and gain.
   */
  function buildTrafficHum(
    c: AudioContext,
    dest: GainNode,
    filterFreq: number,
    gainValue: number,
  ): { source: AudioBufferSourceNode; filter: BiquadFilterNode } {
    const source = c.createBufferSource();
    source.buffer = getBrownNoiseBuffer(c);
    source.loop = true;

    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 0.5;

    const gain = c.createGain();
    gain.gain.value = gainValue;

    source.connect(filter).connect(gain).connect(dest);
    source.start();
    return { source, filter };
  }

  /**
   * Crowd-murmur bed: band-passed noise with a slow LFO on the gain to simulate
   * the ebb and flow of a crowd.
   */
  function buildCrowdMurmur(
    c: AudioContext,
    dest: GainNode,
    centerFreq: number,
    gainValue: number,
  ): { source: AudioBufferSourceNode; lfo: OscillatorNode; lfoGain: GainNode } {
    const source = c.createBufferSource();
    source.buffer = getWhiteNoiseBuffer(c);
    source.loop = true;

    const bandpass = c.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = centerFreq;
    bandpass.Q.value = 0.8;

    const murmurGain = c.createGain();
    murmurGain.gain.value = gainValue;

    // Slow LFO to modulate crowd intensity.
    const lfo = c.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.15;
    const lfoGain = c.createGain();
    lfoGain.gain.value = gainValue * 0.4;
    lfo.connect(lfoGain).connect(murmurGain.gain);
    lfo.start();

    source.connect(bandpass).connect(murmurGain).connect(dest);
    source.start();
    return { source, lfo, lfoGain };
  }

  /**
   * Build the ambient bed for a specific era. Each era blends traffic hum,
   * crowd murmur, and era-typical tonal elements into a GainNode that can be
   * cross-faded.
   */
  function buildBed(c: AudioContext, era: EraKey): AmbientBed {
    const bedGain = c.createGain();
    bedGain.gain.value = 0;
    bedGain.connect(master!);

    const nodes: AudioNode[] = [bedGain];
    const sources: AudioBufferSourceNode[] = [];
    const oscillators: OscillatorNode[] = [];
    let updateFn: ((deltaMs: number) => void) | undefined;

    // All eras get a traffic hum; the character differs per era.
    const { humFreq, humGain, crowdFreq, crowdGain } = ERA_BED_PARAMS[era];
    const hum = buildTrafficHum(c, bedGain, humFreq, humGain);
    sources.push(hum.source);
    nodes.push(hum.filter);

    const crowd = buildCrowdMurmur(c, bedGain, crowdFreq, crowdGain);
    sources.push(crowd.source);
    oscillators.push(crowd.lfo);
    nodes.push(crowd.lfoGain);

    // Era-specific tonal accents as continuous pads.
    const padSpecs = ERA_PAD_SPECS[era];
    for (const spec of padSpecs) {
      const osc = c.createOscillator();
      osc.type = spec.type;
      osc.frequency.value = spec.freq;

      const padGain = c.createGain();
      padGain.gain.value = spec.gain;

      // Subtle vibrato.
      const vibrato = c.createOscillator();
      vibrato.frequency.value = spec.vibrato;
      const vibratoGain = c.createGain();
      vibratoGain.gain.value = spec.freq * 0.005;
      vibrato.connect(vibratoGain).connect(osc.frequency);
      vibrato.start();

      osc.connect(padGain).connect(bedGain);
      osc.start();

      oscillators.push(osc, vibrato);
    }

    // Fade the bed in.
    const now = c.currentTime;
    bedGain.gain.setValueAtTime(0, now);
    bedGain.gain.linearRampToValueAtTime(1, now + BED_FADE_SEC);

    updateFn = undefined; // LFOs run natively; no per-frame JS needed.

    return {
      gain: bedGain,
      update: updateFn,
      dispose() {
        const t = c.currentTime;
        // Quick fade out then stop.
        bedGain.gain.cancelScheduledValues(t);
        bedGain.gain.setValueAtTime(bedGain.gain.value, t);
        bedGain.gain.linearRampToValueAtTime(0, t + BED_FADE_SEC);
        // Stop sources after the fade completes.
        for (const s of sources) {
          try {
            s.stop(t + BED_FADE_SEC + 0.05);
          } catch {
            /* already stopped */
          }
        }
        for (const o of oscillators) {
          try {
            o.stop(t + BED_FADE_SEC + 0.05);
          } catch {
            /* already stopped */
          }
        }
        // Disconnect after a delay (nodes self-clean once stopped).
        setTimeout(() => {
          for (const n of nodes) {
            try {
              n.disconnect();
            } catch {
              /* already disconnected */
            }
          }
        }, (BED_FADE_SEC + 0.2) * 1000);
      },
    };
  }

  // -----------------------------------------------------------------
  // One-shot cue builders
  // -----------------------------------------------------------------

  /** Traffic-light change cue: a soft two-tone chime. */
  function playLightChange(): void {
    if (!ctx || !master || muted) return;
    const c = ctx;
    const now = c.currentTime;

    const playTone = (freq: number, start: number, dur: number, vol: number): void => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(vol, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(master!);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };

    playTone(880, 0, 0.15, 0.12);
    playTone(1320, 0.08, 0.2, 0.08);
  }

  /** Era-transition whoosh: a frequency sweep through filtered noise. */
  function playTransitionWhoosh(): void {
    if (!ctx || !master || muted) return;
    const c = ctx;
    const now = c.currentTime;
    const dur = 1.0;

    const source = c.createBufferSource();
    source.buffer = getWhiteNoiseBuffer(c);
    source.loop = true;

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2;
    // Sweep from low to high and back.
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(4000, now + dur * 0.5);
    filter.frequency.exponentialRampToValueAtTime(300, now + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + dur * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    source.connect(filter).connect(gain).connect(master!);
    source.start(now);
    source.stop(now + dur + 0.05);
  }

  // -----------------------------------------------------------------
  // Accent scheduling — sprinkle era-typical one-shots over the bed
  // -----------------------------------------------------------------
  function playAccent(era: EraKey): void {
    if (!ctx || !master || muted) return;
    const accents = DEFAULT_ERA_CONFIG[era].sfx.accents;
    if (accents.length === 0) return;
    const accent = accents[Math.floor(Math.random() * accents.length)];
    playAccentByName(accent);
  }

  function playAccentByName(name: string): void {
    if (!ctx || !master) return;
    const c = ctx;
    const now = c.currentTime;

    const tone = (
      freq: number,
      type: OscillatorType,
      dur: number,
      vol: number,
      delay = 0,
    ): void => {
      const osc = c.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(vol, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      osc.connect(gain).connect(master!);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.05);
    };

    switch (name) {
      case 'streetcar_bell':
        tone(1318, 'sine', 0.6, 0.1);
        tone(1976, 'sine', 0.5, 0.06, 0.1);
        break;
      case 'footstep_gravel':
        tone(120, 'square', 0.08, 0.06);
        tone(100, 'square', 0.08, 0.05, 0.25);
        break;
      case 'engine_v8':
        tone(80, 'sawtooth', 0.5, 0.08);
        tone(120, 'sawtooth', 0.4, 0.05, 0.1);
        break;
      case 'radio_pop':
        tone(523, 'square', 0.15, 0.05);
        tone(659, 'square', 0.15, 0.05, 0.15);
        tone(784, 'square', 0.2, 0.05, 0.3);
        break;
      case 'arcade_bleed':
        tone(1047, 'square', 0.1, 0.06);
        tone(1319, 'square', 0.1, 0.06, 0.1);
        tone(1568, 'square', 0.1, 0.06, 0.2);
        break;
      case 'synth_pad':
        tone(220, 'sawtooth', 0.8, 0.04);
        tone(330, 'sawtooth', 0.8, 0.03);
        break;
      case 'ev_chime':
        tone(1760, 'sine', 0.3, 0.05);
        tone(2349, 'sine', 0.25, 0.04, 0.1);
        break;
      case 'hvac_drone':
        tone(60, 'sine', 1.0, 0.04);
        break;
      case 'ev_whir':
        tone(440, 'triangle', 0.4, 0.04);
        tone(880, 'triangle', 0.3, 0.03, 0.05);
        break;
      case 'construction_drill':
        tone(150, 'sawtooth', 0.2, 0.06);
        tone(160, 'sawtooth', 0.2, 0.05, 0.08);
        tone(155, 'sawtooth', 0.2, 0.05, 0.16);
        break;
      case 'drone_buzz':
        tone(300, 'sawtooth', 0.6, 0.05);
        tone(450, 'sawtooth', 0.5, 0.03, 0.1);
        break;
      case 'maglev_whoosh':
        tone(200, 'sine', 0.8, 0.04);
        break;
      default:
        tone(660, 'sine', 0.2, 0.04);
        break;
    }
  }

  // -----------------------------------------------------------------
  // Bed cross-fade
  // -----------------------------------------------------------------
  function swapBed(era: EraKey): void {
    if (!ctx) return;
    const oldBed = currentBed;
    currentBed = buildBed(ctx, era);
    if (oldBed) {
      oldBed.dispose();
    }
  }

  // -----------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------
  function toggleMute(): boolean {
    const wasMuted = muted;
    muted = !muted;

    // On first unmute, create/resume the AudioContext (must be from a gesture).
    if (wasMuted && !ctx) {
      if (!ensureContext()) {
        // AudioContext unavailable — revert.
        muted = true;
        return true;
      }
      // Start the ambient bed for the current era.
      swapBed(currentEra);
    }

    if (master && ctx) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(
        muted ? 0 : MASTER_GAIN,
        now + 0.3,
      );
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
    }

    return muted;
  }

  function isMuted(): boolean {
    return muted;
  }

  function isEnabled(): boolean {
    return ctx !== null && ctx.state === 'running';
  }

  function setEra(era: EraKey): void {
    currentEra = era;
    if (ctx) {
      swapBed(era);
      playTransitionWhoosh();
    }
  }

  function update(deltaMs: number): void {
    if (!ctx || muted) return;
    currentBed?.update?.(deltaMs);

    // Accent scheduler — sprinkle era-typical one-shots at random intervals.
    schedulerAccumulator += deltaMs;
    if (schedulerAccumulator >= nextAccentMs) {
      schedulerAccumulator = 0;
      nextAccentMs = 5000 + Math.random() * 10000;
      playAccent(currentEra);
    }
  }

  function dispose(): void {
    if (currentBed) {
      currentBed.dispose();
      currentBed = null;
    }
    if (ctx) {
      void ctx.close();
      ctx = null;
      master = null;
    }
  }

  return {
    toggleMute,
    isMuted,
    isEnabled,
    setEra,
    playLightChange,
    playTransitionWhoosh,
    update,
    dispose,
  };
}

// -----------------------------------------------------------------------
// Static per-era synthesis parameters (not in eraConfig because they are
// audio-engine implementation details, not user-editable scene config).
// -----------------------------------------------------------------------

/** Traffic-hum and crowd-murmur parameters per era. */
const ERA_BED_PARAMS: Record<
  EraKey,
  { humFreq: number; humGain: number; crowdFreq: number; crowdGain: number }
> = {
  '1945': { humFreq: 180, humGain: 0.18, crowdFreq: 500, crowdGain: 0.06 },
  '1965': { humFreq: 220, humGain: 0.22, crowdFreq: 600, crowdGain: 0.08 },
  '1985': { humFreq: 200, humGain: 0.16, crowdFreq: 450, crowdGain: 0.05 },
  '2005': { humFreq: 150, humGain: 0.20, crowdFreq: 700, crowdGain: 0.07 },
  '2025': { humFreq: 120, humGain: 0.16, crowdFreq: 800, crowdGain: 0.05 },
  '2055': { humFreq: 100, humGain: 0.12, crowdFreq: 300, crowdGain: 0.04 },
};

/** Continuous tonal pad specifications per era (added on top of the noise bed). */
interface PadSpec {
  type: OscillatorType;
  freq: number;
  gain: number;
  vibrato: number;
}

const ERA_PAD_SPECS: Record<EraKey, PadSpec[]> = {
  // 1945: warm low hum, subtle
  '1945': [
    { type: 'sine', freq: 55, gain: 0.04, vibrato: 0.3 },
  ],
  // 1965: optimistic major-third pad
  '1965': [
    { type: 'triangle', freq: 110, gain: 0.035, vibrato: 0.4 },
    { type: 'triangle', freq: 165, gain: 0.025, vibrato: 0.4 },
  ],
  // 1985: synth pad — root + fifth
  '1985': [
    { type: 'sawtooth', freq: 98, gain: 0.03, vibrato: 0.5 },
    { type: 'sawtooth', freq: 147, gain: 0.02, vibrato: 0.5 },
  ],
  // 2005: clean digital pad
  '2005': [
    { type: 'sine', freq: 130, gain: 0.025, vibrato: 0.2 },
  ],
  // 2025: subtle smart-city tone
  '2025': [
    { type: 'sine', freq: 196, gain: 0.02, vibrato: 0.15 },
  ],
  // 2055: ambient data hum — low + shimmer
  '2055': [
    { type: 'sine', freq: 65, gain: 0.04, vibrato: 0.1 },
    { type: 'triangle', freq: 523, gain: 0.015, vibrato: 0.6 },
  ],
};
