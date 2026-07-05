// src/audio/sfx.ts
// Procedural Audio Buffer Generator for era-specific ambient audio

import { EraId, SfxEraData } from '../eras';

/**
 * Interface for era-specific audio buffers
 */
export interface EraAudioBuffers {
  /** Ambient bed loop (looped) */
  ambient: AudioBuffer;
  /** Traffic loop (looped) */
  traffic: AudioBuffer;
  /** One-shot event sounds keyed by event type */
  events: Record<string, AudioBuffer>;
}

/**
 * Create an AudioBuffer from float32 samples using the given AudioContext.
 */
function createBuffer(audioContext: AudioContext, samples: Float32Array): AudioBuffer {
  const buffer = audioContext.createBuffer(1, samples.length, audioContext.sampleRate);

  // copyToChannel expects Float32Array<ArrayBuffer>; some lib.dom typings widen to ArrayBufferLike.
  // Re-wrap to satisfy TS while keeping the same sample values.
  const channelSamples = new Float32Array(samples);
  buffer.copyToChannel(channelSamples, 0);

  return buffer;
}

/**
 * Generate audio buffers for a specific era based on its SFX data
 * @param audioContext The AudioContext to use for buffer creation
 * @param data The SFX era data containing parameters for sound generation
 * @returns EraAudioBuffers containing ambient, traffic, and event buffers
 */
export function generateEraAudioBuffers(
  audioContext: AudioContext,
  data: SfxEraData
): EraAudioBuffers {
  // Generate ambient bed: a low-frequency drone with slight variation
  const ambient = generateAmbientBed(audioContext, data.ambientTone);

  // Generate traffic loop: engine-like rumble with variation based on traffic profile
  const traffic = generateTrafficLoop(audioContext, data.trafficProfile);

  // Generate event one-shots
  const events: Record<string, AudioBuffer> = {};
  for (const eventType of data.eventTypes) {
    events[eventType] = generateEventSound(audioContext, eventType);
  }

  return { ambient, traffic, events };
}

/**
 * Generate ambient bed drone based on base frequency
 */
function generateAmbientBed(audioContext: AudioContext, baseFreq: number): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const duration = 8.0; // 8-second loop
  const length = Math.ceil(sampleRate * duration);
  const buffer = new Float32Array(length);
  // Create a drone with two slightly detuned sine waves for richness
  const freq1 = baseFreq;
  const freq2 = baseFreq * 1.01; // slight detune

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Sine waves with slow amplitude modulation to avoid static
    const amp = 0.15 + 0.05 * Math.sin(2 * Math.PI * 0.3 * t); // slow swell
    const sample = amp * Math.sin(2 * Math.PI * freq1 * t) + amp * Math.sin(2 * Math.PI * freq2 * t);
    // Apply gentle fade-in/out to avoid clicks at loop point
    const fade = Math.min(
      1,
      i / (sampleRate * 0.01), // fade-in 10ms
      (length - i) / (sampleRate * 0.01) // fade-out 10ms
    );
    buffer[i] = sample * fade;
  }

  return createBuffer(audioContext, buffer);
}

/**
 * Generate traffic loop based on profile
 */
function generateTrafficLoop(audioContext: AudioContext, profile: 'light' | 'moderate' | 'heavy' | 'dense'): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const duration = 5.0; // 5-second loop
  const length = Math.ceil(sampleRate * duration);
  const buffer = new Float32Array(length);

  // Base engine rumble frequency based on traffic density
  let baseFreq = 40; // low rumble
  switch (profile) {
    case 'light': baseFreq = 30; break;
    case 'moderate': baseFreq = 40; break;
    case 'heavy': baseFreq = 55; break;
    case 'dense': baseFreq = 70; break;
  }

  // Add some harmonic content and variation
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Engine-like pulse with harmonics
    const engine =
      0.3 * Math.sin(2 * Math.PI * baseFreq * t) +
      0.1 * Math.sin(2 * Math.PI * baseFreq * 2 * t) +
      0.05 * Math.sin(2 * Math.PI * baseFreq * 3 * t);
    // Add some random noise for texture
    const noise = (Math.random() * 2 - 1) * 0.02 * (profile === 'light' ? 0.5 : 1);
    const sample = engine + noise;

    // Apply fade-in/out for seamless loop
    const fade = Math.min(
      1,
      i / (sampleRate * 0.01), // fade-in 10ms
      (length - i) / (sampleRate * 0.01) // fade-out 10ms
    );
    buffer[i] = sample * fade;
  }

  return createBuffer(audioContext, buffer);
}

/**
 * Generate one-shot event sound
 */
function generateEventSound(audioContext: AudioContext, type: 'horn' | 'siren' | 'bell' | 'whistle' | 'chime'): AudioBuffer {
  let duration = 0.5; // default half second
  let frequency = 440;

  switch (type) {
    case 'horn':
      duration = 0.8;
      frequency = 200;
      break;
    case 'siren':
      duration = 1.0;
      // siren effect: frequency modulation
      return createSirenBuffer(audioContext);
    case 'bell':
      duration = 1.5;
      frequency = 800;
      break;
    case 'whistle':
      duration = 0.3;
      frequency = 1200;
      break;
    case 'chime':
      duration = 1.0;
      frequency = 1000;
      break;
  }

  // For non-siren types, generate a simple envelope
  const length = Math.ceil(audioContext.sampleRate * duration);
  const buffer = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / audioContext.sampleRate;
    const progress = t / duration;
    // ADSR envelope: quick attack, decay, sustain, release
    let amp = 0;
    if (progress < 0.1) {
      amp = progress / 0.1; // attack
    } else if (progress < 0.2) {
      amp = 1 - (progress - 0.1) / 0.1 * 0.3; // decay to 0.7
    } else if (progress < 0.8) {
      amp = 0.7; // sustain
    } else {
      amp = 0.7 * (1 - (progress - 0.8) / 0.2); // release
    }

    // Determine if we need sine or sawtooth
    const isSawtooth = type === 'horn';
    const sample = isSawtooth ? (2 * ((t * frequency) % 1) - 1) : Math.sin(2 * Math.PI * frequency * t);

    buffer[i] = sample * amp * 0.3; // overall volume
  }

  return createBuffer(audioContext, buffer);
}

/**
 * Create a siren sound with frequency modulation
 */
function createSirenBuffer(audioContext: AudioContext): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const duration = 1.0; // one second cycle
  const length = Math.ceil(sampleRate * duration);
  const buffer = new Float32Array(length);

  const baseFreq = 300;
  const modFreq = 2; // 2 Hz modulation
  const modDepth = 200;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const freq = baseFreq + modDepth * Math.sin(2 * Math.PI * modFreq * t);
    const sample = Math.sin(2 * Math.PI * freq * t);
    // Attack/release to avoid clicks
    const attack = 0.01;
    const release = 0.1;
    let amp = 1;
    if (t < attack) {
      amp = t / attack;
    } else if (t > duration - release) {
      amp = (duration - t) / release;
    }
    buffer[i] = sample * amp * 0.4;
  }

  return createBuffer(audioContext, buffer);
}

/**
 * Generate audio buffers for all eras
 */
export function generateAllEraBuffers(
  audioContext: AudioContext
): Record<EraId, EraAudioBuffers> {
  const result: Record<EraId, EraAudioBuffers> = {} as Record<EraId, EraAudioBuffers>;
  for (const eraId of ['1945', '1965', '1985', '2005', '2025'] as EraId[]) {
    result[eraId] = generateEraAudioBuffers(audioContext, SFX_ERA_DATA[eraId]);
  }
  return result;
}

// Import SFX_ERA_DATA from eras.ts
import { SFX_ERA_DATA } from '../eras';