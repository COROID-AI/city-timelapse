// =============================================================================
// City Timelapse — Procedural Audio Buffer Generator
//
// Generates era-specific AudioBuffers entirely in code — no external audio
// files. Each era gets four layers: an ambient noise+drone bed, a traffic
// engine loop, a set of one-shot event buffers, and a musical motif.
//
// All synthesis is sample-by-sample math written into Float32Array channels
// via BaseAudioContext.createBuffer(). The mixer (mixer.ts) plays and
// crossfades these buffers.
// =============================================================================

import { ERA_IDS, SFX_ERA_DATA, type EraId, type SfxEraData, type SfxEventType } from '../eras';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The four procedural audio layers for one era. All buffers are mono
 * (1 channel) and generated from the era's {@link SfxEraData}.
 */
export interface EraAudioBuffers {
  /** Looping ambient bed: filtered noise + tonal drones. */
  readonly ambient: AudioBuffer;
  /** Looping traffic bed: synthesized engine / hooves / hover. */
  readonly traffic: AudioBuffer;
  /** One-shot event buffers (horns, bells, sirens, etc.). */
  readonly events: readonly AudioBuffer[];
  /** Looping musical motif. */
  readonly music: AudioBuffer;
}

// ---------------------------------------------------------------------------
// Noise generators
// ---------------------------------------------------------------------------

/** Uniform white noise, -1..1. */
function generateWhiteNoise(length: number): Float32Array {
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return data;
}

/** Brown noise (low-frequency emphasised) via a leaky integrator. */
function generateBrownNoise(length: number): Float32Array {
  const data = new Float32Array(length);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return data;
}

/** Pink noise (equal energy per octave) via Paul Kellet's algorithm. */
function generatePinkNoise(length: number): Float32Array {
  const data = new Float32Array(length);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016838;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Ambient bed generator
// ---------------------------------------------------------------------------

/** Duration of the ambient loop in seconds. */
const AMBIENT_DURATION_SECONDS = 4;

/**
 * Generates a looping ambient bed: filtered noise (brown / pink / white)
 * layered with tonal drones at the era's base frequencies. A slow amplitude
 * modulation adds subtle movement.
 */
function generateAmbientBuffer(ctx: BaseAudioContext, data: SfxEraData): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(AMBIENT_DURATION_SECONDS * sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const channel = buffer.getChannelData(0);

  // Generate the noise bed based on the era's noise color.
  let noise: Float32Array;
  switch (data.ambient.noiseColor) {
    case 'brown':
      noise = generateBrownNoise(length);
      break;
    case 'pink':
      noise = generatePinkNoise(length);
      break;
    default:
      noise = generateWhiteNoise(length);
      break;
  }

  const tones = data.ambient.baseTones;
  const noiseLevel = data.ambient.noiseLevel;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;

    // Noise bed
    let sample = noise[i] * noiseLevel;

    // Tonal drones with slight detune for warmth
    for (let ti = 0; ti < tones.length; ti++) {
      const tone = tones[ti];
      sample += Math.sin(2 * Math.PI * tone * t) * 0.12;
      sample += Math.sin(2 * Math.PI * tone * 1.003 * t) * 0.04;
    }

    // Slow amplitude modulation for subtle movement
    const am = 1 + 0.08 * Math.sin(2 * Math.PI * 0.15 * t);
    sample *= am;

    channel[i] = sample;
  }

  return buffer;
}

// ---------------------------------------------------------------------------
// Traffic loop generator
// ---------------------------------------------------------------------------

/** Duration of the traffic loop in seconds. */
const TRAFFIC_DURATION_SECONDS = 4;

/**
 * Generates a looping traffic bed whose character depends on the era's
 * engine type:
 *  - horse:      clopping hooves with resonance
 *  - combustion: low-frequency sawtooth rumble + mechanical clatter + pass-bys
 *  - electric:   high-pitched motor whine + tire hiss
 *  - hover:      sub-bass hum + magnetic shimmer
 */
function generateTrafficBuffer(ctx: BaseAudioContext, data: SfxEraData): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(TRAFFIC_DURATION_SECONDS * sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const channel = buffer.getChannelData(0);

  const { engineType, density, speed } = data.traffic;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;

    switch (engineType) {
      case 'horse': {
        // Clopping hooves — periodic thumps with body resonance
        const clopInterval = 0.5 / (speed * 2 + 0.2);
        const clopPhase = (t % clopInterval) / clopInterval;
        if (clopPhase < 0.08) {
          const env = Math.exp(-clopPhase * 50);
          sample += env * 0.25 * density;
          sample += env * Math.sin(2 * Math.PI * 150 * t) * 0.15 * density;
          sample += env * Math.sin(2 * Math.PI * 80 * t) * 0.1 * density;
        }
        break;
      }
      case 'combustion': {
        // Engine rumble — sawtooth fundamental + harmonics
        const fundamental = 60 + speed * 40;
        const phase = (fundamental * t) % 1;
        const sawtooth = 2 * phase - 1;
        sample += sawtooth * 0.08 * density;
        sample += Math.sin(2 * Math.PI * fundamental * 2 * t) * 0.03 * density;
        sample += Math.sin(2 * Math.PI * fundamental * 3 * t) * 0.02 * density;
        // Mechanical clatter
        sample += (Math.random() * 2 - 1) * 0.04 * density;
        // Pass-by swells
        const passByPeriod = 3 / (speed + 0.3);
        const passByPhase = (t % passByPeriod) / passByPeriod;
        const passByEnv = Math.sin(Math.PI * passByPhase);
        sample *= 0.5 + 0.5 * passByEnv;
        break;
      }
      case 'electric': {
        // High-pitched electric motor whine
        const fundamental = 150 + speed * 200;
        sample += Math.sin(2 * Math.PI * fundamental * t) * 0.04 * density;
        sample += Math.sin(2 * Math.PI * fundamental * 1.5 * t) * 0.02 * density;
        // Tire hiss
        sample += (Math.random() * 2 - 1) * 0.03 * density;
        // Subtle frequency modulation
        const mod = 1 + 0.1 * Math.sin(2 * Math.PI * 5 * t);
        sample *= mod;
        break;
      }
      case 'hover': {
        // Sub-bass hum
        sample += Math.sin(2 * Math.PI * 35 * t) * 0.06 * density;
        sample += Math.sin(2 * Math.PI * 50 * t) * 0.04 * density;
        // Magnetic shimmer — high frequency with slow modulation
        const shimmerMod = 0.5 + 0.5 * Math.sin(2 * Math.PI * 2 * t);
        sample += Math.sin(2 * Math.PI * 1500 * t) * 0.02 * density * shimmerMod;
        // Very subtle noise
        sample += (Math.random() * 2 - 1) * 0.01 * density;
        break;
      }
      default:
        break;
    }

    channel[i] = sample;
  }

  return buffer;
}

// ---------------------------------------------------------------------------
// Event one-shot generator
// ---------------------------------------------------------------------------

/** Duration (seconds) for each event type. */
const EVENT_DURATIONS: Record<SfxEventType, number> = {
  horn: 0.8,
  bell: 1.5,
  siren: 2.0,
  whinny: 1.2,
  chime: 0.6,
  'drone-beep': 0.3,
  announcement: 1.5,
};

/**
 * Generates a one-shot event buffer for the given event type. Each type has
 * a distinct sonic character: horns are two-tone, bells have decaying
 * harmonics, sirens wail, whinnies are pitched noise, chimes are bright
 * bells, drone-beeps are clean electronic tones, and announcements sound
 * like a PA speaker.
 */
function generateEventBuffer(ctx: BaseAudioContext, eventType: SfxEventType): AudioBuffer {
  const duration = EVENT_DURATIONS[eventType];
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(duration * sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const channel = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;

    switch (eventType) {
      case 'horn': {
        // Two-tone car horn
        const attack = Math.min(1, t * 30);
        const release = Math.min(1, (duration - t) * 30);
        const env = attack * release;
        sample = env * (Math.sin(2 * Math.PI * 440 * t) * 0.25 + Math.sin(2 * Math.PI * 554 * t) * 0.2);
        break;
      }
      case 'bell': {
        // Streetcar bell — decaying harmonics
        const env = Math.exp(-t * 2.5);
        sample =
          env *
          (Math.sin(2 * Math.PI * 880 * t) * 0.25 +
            Math.sin(2 * Math.PI * 1320 * t) * 0.12 +
            Math.sin(2 * Math.PI * 1760 * t) * 0.08 +
            Math.sin(2 * Math.PI * 2640 * t) * 0.04);
        break;
      }
      case 'siren': {
        // Wailing siren — frequency sweep
        const freq = 700 + 300 * Math.sin(2 * Math.PI * 0.8 * t);
        sample = Math.sin(2 * Math.PI * freq * t) * 0.18;
        sample += Math.sin(2 * Math.PI * freq * 2 * t) * 0.05;
        break;
      }
      case 'whinny': {
        // Horse whinny — pitched squeal with modulation
        const pitch = 400 + 300 * Math.sin(2 * Math.PI * 4 * t);
        const ampEnv = Math.exp(-t * 1.5) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 12 * t));
        sample = ampEnv * (Math.sin(2 * Math.PI * pitch * t) * 0.15 + (Math.random() * 2 - 1) * 0.08);
        break;
      }
      case 'chime': {
        // Bright notification chime
        const env = Math.exp(-t * 6);
        sample = env * (Math.sin(2 * Math.PI * 1318 * t) * 0.25 + Math.sin(2 * Math.PI * 2637 * t) * 0.12);
        break;
      }
      case 'drone-beep': {
        // Electronic beep
        const env = Math.min(1, t * 100) * Math.min(1, (duration - t) * 100);
        sample = env * Math.sin(2 * Math.PI * 1000 * t) * 0.2;
        break;
      }
      case 'announcement': {
        // PA announcement — filtered noise with tone
        const env = Math.min(1, t * 8) * Math.min(1, (duration - t) * 8);
        const tone = Math.sin(2 * Math.PI * 350 * t) * 0.08;
        const speechMod = 0.5 + 0.5 * Math.sin(2 * Math.PI * 8 * t);
        sample = env * ((Math.random() * 2 - 1) * 0.12 * speechMod + tone);
        break;
      }
      default:
        break;
    }

    channel[i] = sample;
  }

  return buffer;
}

// ---------------------------------------------------------------------------
// Music motif generator
// ---------------------------------------------------------------------------

/** Number of bars in the music loop. */
const MUSIC_BARS = 4;
/** Beats per bar. */
const MUSIC_BEATS_PER_BAR = 4;

// Major scale frequency ratios (relative to root).
const MAJOR_SCALE = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2];

// Melodic patterns (scale-degree indices) for each bar.
const MELODY_PATTERNS: readonly (readonly number[])[] = [
  [0, 2, 4, 2, 5, 4, 2, 0],
  [4, 2, 0, 2, 4, 5, 7, 5],
  [0, 4, 2, 4, 0, 2, 4, 2],
  [7, 5, 4, 2, 0, 2, 4, 0],
];

/**
 * Generates a looping musical motif whose character depends on the era's
 * style:
 *  - Brassy swing:       square-wave arpeggios with swing timing
 *  - Rock and roll:      sawtooth melody with strong backbeat bass
 *  - Synth pop:          pulse-wave eighth notes
 *  - Mainstream pop:     clean sine melody + bass
 *  - Ambient pop:        soft sine pads with slow melody
 *  - Ambient electronic: ethereal pads with modulation
 */
function generateMusicBuffer(ctx: BaseAudioContext, data: SfxEraData): AudioBuffer {
  const root = data.music.rootNote;
  const bpm = data.music.tempoBpm;
  const beatDuration = 60 / bpm;
  const notesPerBar = MELODY_PATTERNS[0].length;
  const noteDuration = (beatDuration * MUSIC_BEATS_PER_BAR) / notesPerBar;
  const duration = MUSIC_BARS * MUSIC_BEATS_PER_BAR * beatDuration;
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(duration * sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const channel = buffer.getChannelData(0);

  const style = data.music.style.toLowerCase();
  const isAmbient = style.includes('ambient');
  const isSwing = style.includes('swing') || style.includes('brassy');
  const isRock = style.includes('rock');
  const isSynth = style.includes('synth');
  const isElectronic = style.includes('electronic');
  const bassVolume = isAmbient ? 0.04 : 0.1;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;

    // --- Melody ---
    const barIndex = Math.floor(t / (MUSIC_BEATS_PER_BAR * beatDuration)) % MUSIC_BARS;
    const pattern = MELODY_PATTERNS[barIndex];
    const noteIndex = Math.floor(t / noteDuration) % notesPerBar;
    const notePhase = (t % noteDuration) / noteDuration;
    const scaleDegree = pattern[noteIndex];
    const noteFreq = root * MAJOR_SCALE[scaleDegree];

    // Swing: delay odd notes
    const swingDelay = isSwing && noteIndex % 2 === 1 ? noteDuration * 0.15 : 0;
    const melodyT = t - swingDelay;

    // Envelope: pluck for rhythmic styles, smooth for ambient
    const melodyEnv = isAmbient
      ? Math.min(1, notePhase * 5) * Math.min(1, (1 - notePhase) * 5)
      : Math.exp(-notePhase * 4) * Math.min(1, notePhase * 30);

    // Waveform selection
    let wave: number;
    if (isSwing) {
      wave = Math.sign(Math.sin(2 * Math.PI * noteFreq * melodyT)); // square
    } else if (isRock) {
      wave = 2 * ((noteFreq * melodyT) % 1) - 1; // sawtooth
    } else if (isSynth) {
      wave = Math.sin(2 * Math.PI * noteFreq * melodyT) > 0.3 ? 1 : -1; // pulse
    } else {
      wave = Math.sin(2 * Math.PI * noteFreq * t); // sine
    }

    let sample = wave * melodyEnv * 0.12;

    // --- Bass line (root note, lower octave, on beats 1 and 3) ---
    const beatInBar = Math.floor(t / beatDuration) % MUSIC_BEATS_PER_BAR;
    const beatPhase = (t % beatDuration) / beatDuration;
    if (beatInBar === 0 || beatInBar === 2) {
      const bassFreq = root / 2;
      const bassEnv = Math.exp(-beatPhase * 2) * Math.min(1, beatPhase * 20);
      const bassWave = isRock ? 2 * ((bassFreq * t) % 1) - 1 : Math.sin(2 * Math.PI * bassFreq * t);
      sample += bassWave * bassEnv * bassVolume;
    }

    // --- Pad (ambient styles only) ---
    if (isAmbient) {
      const padEnv = 0.5 + 0.3 * Math.sin(2 * Math.PI * (1 / duration) * t);
      sample +=
        (Math.sin(2 * Math.PI * root * t) * 0.03 +
          Math.sin(2 * Math.PI * root * 1.5 * t) * 0.02 +
          Math.sin(2 * Math.PI * root * 2 * t) * 0.01) *
        padEnv;
    }

    // --- Ethereal modulation (ambient electronic only) ---
    if (isElectronic) {
      const lfo = Math.sin(2 * Math.PI * 0.5 * t);
      sample *= 1 + 0.1 * lfo;
    }

    channel[i] = sample;
  }

  return buffer;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates all four audio layers for a single era from its {@link SfxEraData}.
 *
 * @param ctx  Any AudioContext (or OfflineAudioContext) — used for sampleRate
 *             and createBuffer only; no nodes are created.
 * @param data The era's sound parameters from {@link SFX_ERA_DATA}.
 * @returns    {@link EraAudioBuffers} with ambient, traffic, events[], music.
 */
export function generateEraAudioBuffers(ctx: BaseAudioContext, data: SfxEraData): EraAudioBuffers {
  return {
    ambient: generateAmbientBuffer(ctx, data),
    traffic: generateTrafficBuffer(ctx, data),
    events: data.events.map((eventType) => generateEventBuffer(ctx, eventType)),
    music: generateMusicBuffer(ctx, data),
  };
}

/**
 * Generates {@link EraAudioBuffers} for every era in the timeline.
 *
 * @param ctx Any AudioContext (or OfflineAudioContext).
 * @returns   A record keyed by {@link EraId}.
 */
export function generateAllEraBuffers(ctx: BaseAudioContext): Record<EraId, EraAudioBuffers> {
  const result = {} as Record<EraId, EraAudioBuffers>;
  for (const eraId of ERA_IDS) {
    result[eraId] = generateEraAudioBuffers(ctx, SFX_ERA_DATA[eraId]);
  }
  return result;
}
