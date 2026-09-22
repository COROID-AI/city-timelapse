/**
 * Era soundscapes — the sound-design layer that makes each year audible.
 *
 * Two kinds of material per era:
 * - {@link TextureLayerSpec}s: continuous, always-running layers built once at
 *   unlock (rumble, hum, murmur) that ride the era's mix bus so they
 *   crossfade automatically with the timeline;
 * - {@link PatternLayerSpec}s: scheduled one-shot gestures (bells, horns,
 *   bleeps, ringtones) whose spawn rate is gated by the era's current weight.
 *
 * On top of that, three persistent beds — traffic, footsteps, chatter — are
 * shared by all eras but re-balanced per era ({@link EraSoundscape.beds} and
 * the bed filter colors), so even the "constant" street follows the time
 * period while the era textures give each decade its signature.
 *
 * All material is synthesized: there are no audio files anywhere in the app.
 * The actual oscillator/noise gesture designs live in {@link playOneShot}.
 */

import type {
  AudioBufferLike,
  NoiseVoiceSpec,
  ToneVoiceSpec,
  VoicePool,
} from './synthesis';
import type { EraYear } from '../era/timeline';

/** The three persistent street beds shared by every era. */
export const BED_LAYER_IDS = ['traffic', 'footsteps', 'chatter'] as const;

/** One persistent bed id. */
export type BedLayerId = (typeof BED_LAYER_IDS)[number];

/** Every synthesized one-shot gesture the director can play. */
export type OneShotVoice =
  // 1945
  | 'streetcar-bell'
  | 'old-horn'
  | 'radio-blip'
  // 1965
  | 'jukebox-fragment'
  | 'muscle-car-pass'
  | 'car-horn'
  // 1985
  | 'arcade-bleep'
  | 'synth-stab'
  // 2005
  | 'cell-ringtone'
  | 'bus-brake'
  // 2025
  | 'scooter-zip'
  | 'ev-chime'
  // shared / hooks / cues
  | 'neon-buzz'
  | 'door'
  | 'footstep'
  | 'whoosh'
  | 'era-chime';

/** What a continuous texture layer is built from. */
export type TextureSource = 'brown-noise' | 'oscillator' | 'white-noise';

/** A slow modulation applied to one parameter of a texture layer. */
export interface TextureLfoSpec {
  /** Modulation depth: Hz for filter/pitch targets, gain for layer-gain. */
  readonly depth: number;
  /** Modulation rate in Hz. */
  readonly rateHz: number;
  /** Which layer parameter the LFO wobbles. */
  readonly target: 'filter-frequency' | 'layer-gain' | 'pitch';
}

/** Continuous era-defining layer (built once, crossfaded by the era bus). */
export interface TextureLayerSpec {
  readonly filterType?: BiquadFilterType;
  /**
   * Base frequency: the color-filter cutoff for noise sources, the oscillator
   * pitch for oscillator sources.
   */
  readonly frequencyHz: number;
  /** Explicit color-filter cutoff for oscillator textures (Hz). */
  readonly filterHz?: number;
  readonly gain: number;
  readonly waveform?: OscillatorType;
  readonly id: string;
  readonly lfo?: TextureLfoSpec;
  readonly q?: number;
  readonly source: TextureSource;
}

/** Scheduled era-defining one-shot layer. */
export interface PatternLayerSpec {
  /** World position of the source, used for distance ducking. */
  readonly position: readonly [number, number];
  readonly gain: number;
  readonly id: string;
  readonly maxIntervalSeconds: number;
  readonly minIntervalSeconds: number;
  readonly voice: OneShotVoice;
}

/** Per-era levels for the three persistent street beds (0..1 trims). */
export interface BedLevels {
  readonly chatter: number;
  readonly footsteps: number;
  readonly traffic: number;
}

/** Complete sound design for one era stop. */
export interface EraSoundscape {
  readonly beds: BedLevels;
  /** Lowpass color of the shared traffic bed in this era (Hz). */
  readonly chatterFilterHz: number;
  readonly patterns: readonly PatternLayerSpec[];
  readonly textures: readonly TextureLayerSpec[];
  /** Lowpass color of the shared traffic bed in this era (Hz). */
  readonly trafficFilterHz: number;
  readonly year: EraYear;
}

/* ------------------------------------------------------------------------- */
/* 1945 — Steel, streetcars & distant radio                                  */
/* ------------------------------------------------------------------------- */

const ERA_1945: EraSoundscape = {
  year: 1945,
  beds: { traffic: 0.3, footsteps: 0.5, chatter: 0.42 },
  trafficFilterHz: 320,
  chatterFilterHz: 900,
  textures: [
    {
      id: 'streetcar-rumble',
      source: 'brown-noise',
      filterType: 'lowpass',
      frequencyHz: 160,
      q: 0.8,
      gain: 0.2,
      lfo: { rateHz: 0.07, depth: 60, target: 'filter-frequency' },
    },
    {
      id: 'radio-murmur',
      source: 'white-noise',
      filterType: 'bandpass',
      frequencyHz: 1500,
      q: 8,
      gain: 0.05,
      lfo: { rateHz: 0.25, depth: 400, target: 'filter-frequency' },
    },
  ],
  patterns: [
    { id: 'streetcar-bell', voice: 'streetcar-bell', minIntervalSeconds: 7, maxIntervalSeconds: 12, gain: 0.55, position: [-10, 0] },
    { id: 'old-horn', voice: 'old-horn', minIntervalSeconds: 9, maxIntervalSeconds: 16, gain: 0.5, position: [4, 2] },
    { id: 'radio-blip', voice: 'radio-blip', minIntervalSeconds: 6, maxIntervalSeconds: 11, gain: 0.6, position: [14, 8] },
  ],
};

/* ------------------------------------------------------------------------- */
/* 1965 — Chrome, jukeboxes & muscle cars                                    */
/* ------------------------------------------------------------------------- */

const ERA_1965: EraSoundscape = {
  year: 1965,
  beds: { traffic: 0.42, footsteps: 0.45, chatter: 0.5 },
  trafficFilterHz: 520,
  chatterFilterHz: 1150,
  textures: [
    {
      id: 'cruiser-idle',
      source: 'brown-noise',
      filterType: 'lowpass',
      frequencyHz: 240,
      q: 1,
      gain: 0.16,
      lfo: { rateHz: 0.11, depth: 90, target: 'filter-frequency' },
    },
  ],
  patterns: [
    { id: 'jukebox-fragment', voice: 'jukebox-fragment', minIntervalSeconds: 7, maxIntervalSeconds: 13, gain: 0.5, position: [12, -6] },
    { id: 'muscle-car-pass', voice: 'muscle-car-pass', minIntervalSeconds: 9, maxIntervalSeconds: 17, gain: 0.55, position: [-4, 6] },
    { id: 'cruise-horn', voice: 'car-horn', minIntervalSeconds: 14, maxIntervalSeconds: 24, gain: 0.4, position: [6, 0] },
  ],
};

/* ------------------------------------------------------------------------- */
/* 1985 — Arcades, synth bustle & neon hum                                   */
/* ------------------------------------------------------------------------- */

const ERA_1985: EraSoundscape = {
  year: 1985,
  beds: { traffic: 0.38, footsteps: 0.4, chatter: 0.5 },
  trafficFilterHz: 700,
  chatterFilterHz: 1400,
  textures: [
    {
      id: 'neon-hum',
      source: 'oscillator',
      waveform: 'sawtooth',
      frequencyHz: 60,
      filterType: 'lowpass',
      filterHz: 300,
      q: 2,
      gain: 0.05,
      lfo: { rateHz: 118, depth: 0.015, target: 'layer-gain' },
    },
    {
      id: 'synth-bustle',
      source: 'oscillator',
      waveform: 'square',
      frequencyHz: 110,
      filterType: 'lowpass',
      filterHz: 900,
      q: 2,
      gain: 0.045,
      lfo: { rateHz: 2.2, depth: 0.03, target: 'layer-gain' },
    },
  ],
  patterns: [
    { id: 'arcade-bleep', voice: 'arcade-bleep', minIntervalSeconds: 3.5, maxIntervalSeconds: 7, gain: 0.45, position: [10, -4] },
    { id: 'synth-stab', voice: 'synth-stab', minIntervalSeconds: 8, maxIntervalSeconds: 14, gain: 0.4, position: [-8, 10] },
  ],
};

/* ------------------------------------------------------------------------- */
/* 2005 — Gridlock, cell ringtones & bus brakes                              */
/* ------------------------------------------------------------------------- */

const ERA_2005: EraSoundscape = {
  year: 2005,
  beds: { traffic: 0.55, footsteps: 0.42, chatter: 0.48 },
  trafficFilterHz: 1000,
  chatterFilterHz: 1600,
  textures: [
    {
      id: 'engine-drone',
      source: 'brown-noise',
      filterType: 'lowpass',
      frequencyHz: 420,
      q: 1,
      gain: 0.18,
      lfo: { rateHz: 0.16, depth: 120, target: 'filter-frequency' },
    },
  ],
  patterns: [
    { id: 'cell-ringtone', voice: 'cell-ringtone', minIntervalSeconds: 9, maxIntervalSeconds: 16, gain: 0.45, position: [8, 4] },
    { id: 'bus-brake', voice: 'bus-brake', minIntervalSeconds: 8, maxIntervalSeconds: 15, gain: 0.5, position: [-12, -2] },
    { id: 'commuter-horn', voice: 'car-horn', minIntervalSeconds: 12, maxIntervalSeconds: 20, gain: 0.4, position: [0, 8] },
  ],
};

/* ------------------------------------------------------------------------- */
/* 2025 — Electric whine, scooter zips & soft modern bustle                  */
/* ------------------------------------------------------------------------- */

const ERA_2025: EraSoundscape = {
  year: 2025,
  beds: { traffic: 0.26, footsteps: 0.35, chatter: 0.4 },
  trafficFilterHz: 1400,
  chatterFilterHz: 1800,
  textures: [
    {
      id: 'ev-whine',
      source: 'oscillator',
      waveform: 'triangle',
      frequencyHz: 1600,
      filterType: 'lowpass',
      filterHz: 4000,
      q: 1,
      gain: 0.018,
      lfo: { rateHz: 0.4, depth: 220, target: 'pitch' },
    },
    {
      id: 'ev-hum',
      source: 'oscillator',
      waveform: 'sine',
      frequencyHz: 90,
      filterType: 'lowpass',
      filterHz: 240,
      q: 1,
      gain: 0.03,
    },
  ],
  patterns: [
    { id: 'scooter-zip', voice: 'scooter-zip', minIntervalSeconds: 6, maxIntervalSeconds: 12, gain: 0.45, position: [6, -8] },
    { id: 'ev-chime', voice: 'ev-chime', minIntervalSeconds: 12, maxIntervalSeconds: 20, gain: 0.4, position: [-6, 4] },
  ],
};

/** All five era soundscapes in timeline order. */
export const ERAS: readonly EraSoundscape[] = [ERA_1945, ERA_1965, ERA_1985, ERA_2005, ERA_2025];

/** Era soundscapes keyed by their timeline stop. */
export const SOUNDSCAPES: Readonly<Record<EraYear, EraSoundscape>> = {
  1945: ERA_1945,
  1965: ERA_1965,
  1985: ERA_1985,
  2005: ERA_2005,
  2025: ERA_2025,
};

/**
 * Fundamental of the transition chime per era: each year change rings a
 * slightly brighter bell, so year transitions are audible even muted-blind.
 */
export const ERA_CHIME_FREQUENCY: Readonly<Record<EraYear, number>> = {
  1945: 704,
  1965: 784,
  1985: 880,
  2005: 988,
  2025: 1175,
};

/** Options for one synthesized one-shot. */
export interface OneShotOptions {
  /** Noise buffer for noise-based voices (whoosh, brakes, pass-bys). */
  readonly noiseBuffer?: AudioBufferLike;
  /** Overall level multiplier applied to the voice's internal mix. */
  readonly gain: number;
  /** Tonal anchor for chime/bell voices. */
  readonly baseFrequencyHz?: number;
  /** Start offset from "now" on the audio clock. */
  readonly whenSeconds?: number;
}

/**
 * Play one synthesized one-shot through the voice pool.
 *
 * Each voice is a small hand-tuned arrangement of oscillator/noise gestures
 * (frequencies, glides, filters, envelopes) expressed with the pool's generic
 * primitives — that keeps `synthesis.ts` free of sound-design knowledge while
 * still guaranteeing every shot is pooled and budgeted. Returns how many pool
 * voices the shot actually claimed (0 when the pool is saturated).
 */
export function playOneShot(pool: VoicePool, voice: OneShotVoice, options: OneShotOptions): number {
  const level = Math.max(0, options.gain);
  const baseWhen = Math.max(0, options.whenSeconds ?? 0);
  const noise = options.noiseBuffer ?? null;
  let fired = 0;

  const tone = (spec: ToneVoiceSpec): void => {
    const when = baseWhen + (spec.whenSeconds ?? 0);
    if (pool.playTone({ ...spec, gain: spec.gain * level, whenSeconds: when })) fired += 1;
  };

  const burst = (spec: Omit<NoiseVoiceSpec, 'buffer'>): void => {
    if (!noise) return;
    const when = baseWhen + (spec.whenSeconds ?? 0);
    if (pool.playNoise({ ...spec, buffer: noise, gain: spec.gain * level, whenSeconds: when })) {
      fired += 1;
    }
  };

  switch (voice) {
    // ----- 1945 -----------------------------------------------------------
    case 'streetcar-bell': {
      const f = options.baseFrequencyHz ?? 820;
      tone({ waveform: 'sine', frequencyHz: f, gain: 0.55, durationSeconds: 0.9, attackSeconds: 0.004, filterHz: 6000, filterType: 'lowpass' });
      tone({ waveform: 'sine', frequencyHz: f * 2.76, gain: 0.18, durationSeconds: 0.55, attackSeconds: 0.003, filterHz: 8000, filterType: 'lowpass', whenSeconds: 0.01 });
      break;
    }
    case 'old-horn': {
      tone({ waveform: 'sawtooth', frequencyHz: 372, glideToHz: 344, gain: 0.5, durationSeconds: 0.5, attackSeconds: 0.03, filterHz: 1300, filterType: 'lowpass', filterQ: 1.5 });
      tone({ waveform: 'triangle', frequencyHz: 466, glideToHz: 430, gain: 0.25, durationSeconds: 0.5, attackSeconds: 0.03, filterHz: 1600, filterType: 'lowpass' });
      break;
    }
    case 'radio-blip': {
      tone({ waveform: 'square', frequencyHz: 520, gain: 0.4, durationSeconds: 0.16, attackSeconds: 0.01, filterHz: 1500, filterType: 'bandpass', filterQ: 3 });
      burst({ gain: 0.3, durationSeconds: 0.14, filterHz: 2600, filterType: 'bandpass', filterQ: 2, attackSeconds: 0.01, whenSeconds: 0.04 });
      break;
    }

    // ----- 1965 -----------------------------------------------------------
    case 'jukebox-fragment': {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      for (let i = 0; i < notes.length; i += 1) {
        tone({ waveform: 'triangle', frequencyHz: notes[i], gain: 0.5, durationSeconds: 0.26, attackSeconds: 0.01, filterHz: 3500, filterType: 'lowpass', whenSeconds: i * 0.1 });
      }
      break;
    }
    case 'muscle-car-pass': {
      burst({ gain: 0.5, durationSeconds: 1.6, filterHz: 260, glideFilterHz: 1100, filterType: 'lowpass', filterQ: 1, attackSeconds: 0.5 });
      tone({ waveform: 'sawtooth', frequencyHz: 68, glideToHz: 52, gain: 0.5, durationSeconds: 1.6, attackSeconds: 0.4, filterHz: 300, filterType: 'lowpass', filterQ: 2 });
      break;
    }
    case 'car-horn': {
      tone({ waveform: 'square', frequencyHz: 523.25, gain: 0.35, durationSeconds: 0.38, attackSeconds: 0.012, filterHz: 2400, filterType: 'lowpass' });
      tone({ waveform: 'square', frequencyHz: 659.25, gain: 0.3, durationSeconds: 0.38, attackSeconds: 0.012, filterHz: 2400, filterType: 'lowpass' });
      break;
    }

    // ----- 1985 -----------------------------------------------------------
    case 'arcade-bleep': {
      const notes = [880, 1174.7, 1567.98];
      for (let i = 0; i < notes.length; i += 1) {
        tone({ waveform: 'square', frequencyHz: notes[i], gain: 0.45, durationSeconds: 0.12, attackSeconds: 0.005, filterHz: 5000, filterType: 'lowpass', whenSeconds: i * 0.08 });
      }
      break;
    }
    case 'synth-stab': {
      tone({ waveform: 'sawtooth', frequencyHz: 220, gain: 0.35, durationSeconds: 0.5, attackSeconds: 0.015, filterHz: 2600, filterType: 'lowpass' });
      tone({ waveform: 'sawtooth', frequencyHz: 331, gain: 0.2, durationSeconds: 0.5, attackSeconds: 0.015, filterHz: 2600, filterType: 'lowpass' });
      break;
    }

    // ----- 2005 -----------------------------------------------------------
    case 'cell-ringtone': {
      const notes = [659.25, 783.99, 987.77, 783.99, 659.25];
      const offsets = [0, 0.11, 0.22, 0.36, 0.47];
      for (let i = 0; i < notes.length; i += 1) {
        tone({ waveform: 'triangle', frequencyHz: notes[i], gain: 0.4, durationSeconds: 0.1, attackSeconds: 0.005, filterHz: 6000, filterType: 'lowpass', whenSeconds: offsets[i] });
      }
      break;
    }
    case 'bus-brake': {
      tone({ waveform: 'sine', frequencyHz: 2100, glideToHz: 850, gain: 0.4, durationSeconds: 0.85, attackSeconds: 0.05, filterHz: 3000, filterType: 'bandpass', filterQ: 4 });
      burst({ gain: 0.35, durationSeconds: 0.85, filterHz: 2700, filterType: 'bandpass', filterQ: 9, attackSeconds: 0.08 });
      break;
    }

    // ----- 2025 -----------------------------------------------------------
    case 'scooter-zip': {
      tone({ waveform: 'sawtooth', frequencyHz: 320, glideToHz: 2400, gain: 0.35, durationSeconds: 0.5, attackSeconds: 0.04, filterHz: 4000, filterType: 'lowpass' });
      burst({ gain: 0.2, durationSeconds: 0.5, filterHz: 3500, filterType: 'bandpass', filterQ: 0.8, attackSeconds: 0.1 });
      break;
    }
    case 'ev-chime': {
      const f = options.baseFrequencyHz ?? 1174.7;
      tone({ waveform: 'sine', frequencyHz: f, gain: 0.35, durationSeconds: 0.7, attackSeconds: 0.005, filterHz: 8000, filterType: 'lowpass' });
      tone({ waveform: 'sine', frequencyHz: f * 1.335, gain: 0.3, durationSeconds: 0.7, attackSeconds: 0.005, filterHz: 8000, filterType: 'lowpass', whenSeconds: 0.13 });
      break;
    }

    // ----- shared / hooks -------------------------------------------------
    case 'neon-buzz': {
      tone({ waveform: 'sawtooth', frequencyHz: 118, glideToHz: 115, gain: 0.4, durationSeconds: 0.5, attackSeconds: 0.02, filterHz: 900, filterType: 'lowpass', filterQ: 2 });
      tone({ waveform: 'sawtooth', frequencyHz: 236, gain: 0.15, durationSeconds: 0.45, attackSeconds: 0.02, filterHz: 1400, filterType: 'lowpass' });
      break;
    }
    case 'door': {
      burst({ gain: 0.4, durationSeconds: 0.3, filterHz: 700, filterType: 'lowpass', filterQ: 1, attackSeconds: 0.008 });
      tone({ waveform: 'sine', frequencyHz: 132, gain: 0.3, durationSeconds: 0.16, attackSeconds: 0.004, filterHz: 400, filterType: 'lowpass' });
      break;
    }
    case 'footstep': {
      burst({ gain: 0.45, durationSeconds: 0.13, filterHz: 1000, filterType: 'bandpass', filterQ: 1.4, attackSeconds: 0.006 });
      break;
    }

    // ----- transition cues ------------------------------------------------
    case 'whoosh': {
      burst({ gain: 0.5, durationSeconds: 1.1, filterHz: 500, glideFilterHz: 2600, filterType: 'bandpass', filterQ: 1.4, attackSeconds: 0.3 });
      break;
    }
    case 'era-chime': {
      const f = options.baseFrequencyHz ?? 880;
      tone({ waveform: 'sine', frequencyHz: f, gain: 0.5, durationSeconds: 1.0, attackSeconds: 0.004, filterHz: 7000, filterType: 'lowpass' });
      tone({ waveform: 'sine', frequencyHz: f * 2.01, gain: 0.16, durationSeconds: 0.6, attackSeconds: 0.003, filterHz: 9000, filterType: 'lowpass', whenSeconds: 0.015 });
      break;
    }
  }

  return fired;
}
