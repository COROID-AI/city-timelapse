/**
 * Procedural era ambience — no external audio assets.
 *
 * Each era's ambient bed is assembled entirely from WebAudio primitives:
 * looped white-noise buffers shaped by biquad filters, and oscillator hums
 * shaped by filters with optional slow vibrato/tremolo LFOs. A registry maps
 * the string tags from `EraDefinition.audioTags` to concrete {@link Voice}
 * descriptors, so an era's sound is derived directly from its data model.
 *
 * The module allocates nodes only through {@link createEraSound}; teardown is
 * the caller's responsibility via {@link EraSoundHandle.dispose}.
 */

/** A looped white-noise layer shaped by a biquad filter. */
export interface NoiseVoice {
  readonly kind: 'noise';
  /** Human-readable layer name, e.g. "radio static". */
  readonly label: string;
  readonly filter: BiquadFilterType;
  /** Cutoff / centre frequency in Hz. */
  readonly frequency: number;
  /** Filter resonance (Q). */
  readonly q: number;
  /** Relative loudness in the era bed (linear gain). */
  readonly gain: number;
  /** Optional amplitude-tremolo depth expressed as a fraction of `gain`. */
  readonly tremolo?: number;
  /** Tremolo LFO rate in Hz. */
  readonly tremoloRate?: number;
}

/** A continuous oscillator hum shaped by a biquad filter. */
interface OscillatorVoice {
  readonly kind: 'oscillator';
  /** Human-readable layer name, e.g. "neon hum". */
  readonly label: string;
  readonly waveform: OscillatorType;
  /** Fundamental frequency in Hz. */
  readonly frequency: number;
  /** Static pitch offset in cents. */
  readonly detune?: number;
  readonly filter: BiquadFilterType;
  /** Filter cutoff in Hz. */
  readonly cutoff: number;
  /** Filter resonance (Q). */
  readonly q?: number;
  /** Relative loudness (linear gain). */
  readonly gain: number;
  /** Optional pitch-vibrato depth in cents. */
  readonly vibratoCents?: number;
  /** Vibrato LFO rate in Hz. */
  readonly vibratoRate?: number;
}

/** A single procedural layer in an era's ambient bed. */
export type Voice = NoiseVoice | OscillatorVoice;

/**
 * A live WebAudio graph for one era's ambience. The {@link output} gain is the
 * bus the mixer crossfades; {@link dispose} tears every source and node down.
 */
export interface EraSoundHandle {
  /** Era output bus — the mixer ramps this gain during a crossfade. */
  readonly output: GainNode;
  /** Stop every source and disconnect every node in the graph. */
  dispose(): void;
}

/**
 * Generates a two-second mono buffer of uniform white noise for looping.
 * Allocated once per era graph and shared by every noise voice in that graph.
 */
function createNoiseBuffer(context: BaseAudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 2);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Builds the node chain for a single {@link NoiseVoice}. */
function buildNoiseVoice(
  context: BaseAudioContext,
  voice: NoiseVoice,
  output: AudioNode,
  noiseBuffer: AudioBuffer,
  sources: AudioScheduledSourceNode[],
  nodes: AudioNode[],
): void {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;

  const filter = context.createBiquadFilter();
  filter.type = voice.filter;
  filter.frequency.value = voice.frequency;
  filter.Q.value = voice.q;

  const gain = context.createGain();
  gain.gain.value = voice.gain;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(output);

  nodes.push(source, filter, gain);
  sources.push(source);

  // Optional slow amplitude tremolo (e.g. crackling radio static).
  if (voice.tremolo !== undefined && voice.tremoloRate !== undefined) {
    const lfo = context.createOscillator();
    lfo.frequency.value = voice.tremoloRate;
    const depth = context.createGain();
    depth.gain.value = voice.tremolo * voice.gain;
    lfo.connect(depth);
    depth.connect(gain.gain);
    lfo.start();
    sources.push(lfo);
    nodes.push(lfo, depth);
  }

  source.start();
}

/** Builds the node chain for a single {@link OscillatorVoice}. */
function buildOscillatorVoice(
  context: BaseAudioContext,
  voice: OscillatorVoice,
  output: AudioNode,
  sources: AudioScheduledSourceNode[],
  nodes: AudioNode[],
): void {
  const osc = context.createOscillator();
  osc.type = voice.waveform;
  osc.frequency.value = voice.frequency;
  if (voice.detune !== undefined) osc.detune.value = voice.detune;

  const filter = context.createBiquadFilter();
  filter.type = voice.filter;
  filter.frequency.value = voice.cutoff;
  filter.Q.value = voice.q ?? 1;

  const gain = context.createGain();
  gain.gain.value = voice.gain;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(output);

  nodes.push(osc, filter, gain);
  sources.push(osc);

  // Optional slow pitch vibrato (e.g. shimmering bell, electric whine).
  if (voice.vibratoCents !== undefined && voice.vibratoRate !== undefined) {
    const lfo = context.createOscillator();
    lfo.frequency.value = voice.vibratoRate;
    const depth = context.createGain();
    depth.gain.value = voice.vibratoCents;
    lfo.connect(depth);
    depth.connect(osc.detune);
    lfo.start();
    sources.push(lfo);
    nodes.push(lfo, depth);
  }

  osc.start();
}

/**
 * Allocates and starts a complete WebAudio graph for one era's ambience.
 *
 * @param context     Shared audio context (created/owned by the mixer).
 * @param destination Where the era bus feeds — usually the mixer's master gain.
 * @param voices      The era's assembled voice descriptors.
 * @returns A handle exposing the output gain and a full teardown method.
 */
export function createEraSound(
  context: BaseAudioContext,
  destination: AudioNode,
  voices: readonly Voice[],
): EraSoundHandle {
  const output = context.createGain();
  output.connect(destination);

  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [output];
  const noiseBuffer = createNoiseBuffer(context);

  for (const voice of voices) {
    if (voice.kind === 'noise') {
      buildNoiseVoice(context, voice, output, noiseBuffer, sources, nodes);
    } else {
      buildOscillatorVoice(context, voice, output, sources, nodes);
    }
  }

  const dispose = (): void => {
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        /* source already stopped — safe to ignore */
      }
    }
    for (const node of nodes) {
      try {
        node.disconnect();
      } catch {
        /* node already disconnected — safe to ignore */
      }
    }
  };

  return { output, dispose };
}

/**
 * Maps each `EraDefinition.audioTag` string to one or more procedural voices.
 * Frequencies are deliberately spread so the five eras have observably
 * different frequency profiles:
 * - 1945: low-mid rumble + distant high bell (≈174–1175 Hz, noise at 2.6 kHz).
 * - 1965: mains hum dominated (≈60 Hz) + mid engine tones.
 * - 1985: deep synth bass (≈55 Hz) + bright arcade blips up to 1.45 kHz.
 * - 2005: broad mid-band traffic bed (≈140–740 Hz).
 * - 2025: sub drone (≈41 Hz) + stratospheric electric whine (≈1.76 kHz).
 */
const VOICE_REGISTRY: Record<string, readonly Voice[]> = {
  // ---- 1945: Post-war recovery ----
  'tram-bell': [
    {
      kind: 'oscillator',
      label: 'distant streetcar bell',
      waveform: 'triangle',
      frequency: 659,
      filter: 'lowpass',
      cutoff: 1800,
      q: 1,
      gain: 0.05,
      vibratoCents: 6,
      vibratoRate: 4,
    },
  ],
  'factory-whistle': [
    {
      kind: 'oscillator',
      label: 'factory whistle',
      waveform: 'sine',
      frequency: 1175,
      filter: 'lowpass',
      cutoff: 3000,
      q: 1,
      gain: 0.012,
    },
  ],
  'radio-static': [
    {
      kind: 'noise',
      label: 'crackling radio static',
      filter: 'bandpass',
      frequency: 2600,
      q: 0.8,
      gain: 0.03,
      tremolo: 0.6,
      tremoloRate: 3,
    },
  ],
  'brass-band': [
    {
      kind: 'oscillator',
      label: 'brassy low hum',
      waveform: 'sawtooth',
      frequency: 174,
      filter: 'lowpass',
      cutoff: 700,
      q: 2,
      gain: 0.04,
    },
  ],

  // ---- 1965: Mid-century optimism ----
  'neon-hum': [
    {
      kind: 'oscillator',
      label: '60 Hz neon mains hum',
      waveform: 'sine',
      frequency: 60,
      filter: 'lowpass',
      cutoff: 220,
      q: 1,
      gain: 0.08,
    },
  ],
  'surf-guitar': [
    {
      kind: 'oscillator',
      label: 'surf-guitar drone',
      waveform: 'sawtooth',
      frequency: 82,
      filter: 'lowpass',
      cutoff: 900,
      q: 1.5,
      gain: 0.035,
    },
  ],
  'scooter-engine': [
    {
      kind: 'oscillator',
      label: 'idle scooter engine',
      waveform: 'square',
      frequency: 98,
      filter: 'lowpass',
      cutoff: 480,
      q: 2,
      gain: 0.04,
      vibratoCents: 10,
      vibratoRate: 7,
    },
  ],
  'jet-flyover': [
    {
      kind: 'noise',
      label: 'distant jet rumble',
      filter: 'lowpass',
      frequency: 280,
      q: 0.7,
      gain: 0.05,
    },
  ],

  // ---- 1985: Boom-era metropolis ----
  'arcade-blips': [
    {
      kind: 'oscillator',
      label: 'arcade bleeps',
      waveform: 'square',
      frequency: 523,
      filter: 'lowpass',
      cutoff: 2000,
      q: 1,
      gain: 0.035,
      vibratoCents: 25,
      vibratoRate: 8,
    },
  ],
  'synth-bass': [
    {
      kind: 'oscillator',
      label: 'deep synth bass',
      waveform: 'sawtooth',
      frequency: 55,
      filter: 'lowpass',
      cutoff: 260,
      q: 4,
      gain: 0.07,
    },
  ],
  'brick-phone-ring': [
    {
      kind: 'oscillator',
      label: 'brick-phone tone',
      waveform: 'square',
      frequency: 1450,
      filter: 'bandpass',
      cutoff: 1450,
      q: 4,
      gain: 0.015,
    },
  ],
  'saxophone': [
    {
      kind: 'oscillator',
      label: 'saxophone pad',
      waveform: 'sawtooth',
      frequency: 233,
      filter: 'lowpass',
      cutoff: 1100,
      q: 1,
      gain: 0.03,
    },
  ],

  // ---- 2005: Globalised millennium ----
  'ringtone-polyphonic': [
    {
      kind: 'oscillator',
      label: 'polyphonic ringtone',
      waveform: 'square',
      frequency: 740,
      filter: 'lowpass',
      cutoff: 2200,
      q: 1,
      gain: 0.025,
    },
  ],
  'hybrid-engine': [
    {
      kind: 'noise',
      label: 'hybrid engine whir',
      filter: 'bandpass',
      frequency: 140,
      q: 1.5,
      gain: 0.06,
      tremolo: 0.4,
      tremoloRate: 2,
    },
  ],
  'ringback-tone': [
    {
      kind: 'oscillator',
      label: 'ringback tone',
      waveform: 'sine',
      frequency: 440,
      filter: 'lowpass',
      cutoff: 1500,
      q: 1,
      gain: 0.012,
    },
  ],
  'pop-punk': [
    {
      kind: 'oscillator',
      label: 'pop-punk guitar pad',
      waveform: 'sawtooth',
      frequency: 164,
      filter: 'lowpass',
      cutoff: 1300,
      q: 1.2,
      gain: 0.04,
    },
  ],

  // ---- 2025: Sensor-driven present ----
  'drone-buzz': [
    {
      kind: 'oscillator',
      label: 'sub-bass drone',
      waveform: 'sawtooth',
      frequency: 41,
      filter: 'lowpass',
      cutoff: 200,
      q: 4,
      gain: 0.06,
      vibratoCents: 4,
      vibratoRate: 0.3,
    },
  ],
  'ev-motor-whine': [
    {
      kind: 'oscillator',
      label: 'EV motor whine',
      waveform: 'sine',
      frequency: 1760,
      filter: 'lowpass',
      cutoff: 4000,
      q: 1,
      gain: 0.03,
      vibratoCents: 18,
      vibratoRate: 6,
    },
  ],
  'notification-chime': [
    {
      kind: 'oscillator',
      label: 'notification chime',
      waveform: 'triangle',
      frequency: 1318,
      filter: 'lowpass',
      cutoff: 3000,
      q: 1,
      gain: 0.02,
    },
  ],
  'lo-fi-beat': [
    {
      kind: 'noise',
      label: 'muffled lo-fi bed',
      filter: 'lowpass',
      frequency: 420,
      q: 0.6,
      gain: 0.04,
    },
  ],
} satisfies Record<string, readonly Voice[]>;

/**
 * Assembles an era's voice list from its `audioTags`. Unknown tags are
 * silently skipped so the dataset can grow without breaking the mixer.
 */
export function buildEraVoices(tags: readonly string[]): readonly Voice[] {
  const voices: Voice[] = [];
  for (const tag of tags) {
    const mapped = VOICE_REGISTRY[tag];
    if (mapped) voices.push(...mapped);
  }
  return voices;
}
