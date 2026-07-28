/**
 * Procedural audio buffer generator.
 * Generates all era-specific SFX via Web Audio API — no external assets.
 * Synthesizes noise beds, tonal drones, traffic engine sounds, and event one-shots.
 */
import type { EraId, SfxEraData } from '../eras';
import { SFX_ERA_DATA } from '../eras';

export interface EraAudioBuffers {
  /** Ambient drone loop */
  ambient: AudioBuffer;
  /** Traffic/engine loop */
  traffic: AudioBuffer;
  /** Event one-shots (horns, bells, sirens, etc.) */
  events: AudioBuffer[];
}

const SAMPLE_RATE = 44100;
const BUFFER_DURATION = 4.0; // seconds per loop buffer

/** Generate a filtered white noise buffer (ambient bed). */
function generateNoiseBed(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const buffer = ctx.createBuffer(2, SAMPLE_RATE * BUFFER_DURATION, SAMPLE_RATE);
  const length = buffer.length;

  for (let ch = 0; ch < 2; ch++) {
    const channel = buffer.getChannelData(ch);
    const detune = ch === 0 ? -data.ambientDetune : data.ambientDetune;
    for (let i = 0; i < length; i++) {
      // White noise with low-pass filtering (simple exponential smoothing)
      const noise = Math.random() * 2 - 1;
      const t = i / SAMPLE_RATE;
      // Slow amplitude modulation for organic feel
      const mod = 0.8 + 0.2 * Math.sin(t * 0.5 + detune * 0.01);
      // Simple low-pass: blend with previous sample
      const lp = ch === 0 ? 0 : channel[i - 1] || 0;
      channel[i] = (noise * 0.3 + lp * 0.7) * mod * data.ambientVolume * 0.4;
    }
  }

  return buffer;
}

/** Generate a tonal drone buffer (ambient layer). */
function generateTonalDrone(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const buffer = ctx.createBuffer(2, SAMPLE_RATE * BUFFER_DURATION, SAMPLE_RATE);
  const length = buffer.length;

  for (let ch = 0; ch < 2; ch++) {
    const channel = buffer.getChannelData(ch);
    const detune = ch === 0 ? -data.ambientDetune : data.ambientDetune;
    for (let i = 0; i < length; i++) {
      const t = i / SAMPLE_RATE;
      const freq = data.ambientFreq + detune * 0.5;
      // Two oscillators for richness
      const osc1 = Math.sin(t * freq * 2 * Math.PI);
      const osc2 = Math.sin(t * freq * 2 * Math.PI * 1.5 + Math.PI / 4);
      const osc3 = Math.sin(t * freq * 2 * Math.PI * 2.0 + Math.PI / 3);
      channel[i] = (osc1 * 0.5 + osc2 * 0.3 + osc3 * 0.2) * data.ambientVolume * 0.5;
    }
  }

  return buffer;
}

/** Generate a traffic/engine loop buffer. */
function generateTrafficLoop(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const buffer = ctx.createBuffer(2, SAMPLE_RATE * BUFFER_DURATION, SAMPLE_RATE);
  const length = buffer.length;

  for (let ch = 0; ch < 2; ch++) {
    const channel = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / SAMPLE_RATE;
      // Engine idle + rhythmic pulses
      const engine = Math.sin(t * data.trafficFreq * 2 * Math.PI) * 0.6;
      const engine2 = Math.sin(t * data.trafficFreq * 4 * Math.PI) * 0.3;
      // Rhythmic pulsing (traffic passing)
      const pulse = Math.sin(t * data.trafficRate * 2 * Math.PI) * 0.5 + 0.5;
      // Occasional noise burst for engine rumble
      const rumble = (Math.random() * 2 - 1) * 0.3 * Math.pow(Math.sin(t * 0.3), 2);
      channel[i] = (engine + engine2) * pulse * data.trafficVolume * 0.4 + rumble * data.trafficVolume * 0.2;
    }
  }

  return buffer;
}

/** Generate a one-shot event buffer (horn, bell, siren, etc.). */
function generateEventBuffer(ctx: AudioContext, eventType: string, data: SfxEraData): AudioBuffer {
  const duration = 0.8; // seconds for one-shot
  const buffer = ctx.createBuffer(2, SAMPLE_RATE * duration, SAMPLE_RATE);
  const length = buffer.length;

  for (let ch = 0; ch < 2; ch++) {
    const channel = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / SAMPLE_RATE;
      const env = 1 - t / duration; // decay envelope
      let sample = 0;

      switch (eventType) {
        case 'horn':
          // Car horn: square wave with frequency glide
          const glide = 1 - t * 0.3;
          sample = (Math.sin(t * data.trafficFreq * glide * 2 * Math.PI) > 0 ? 1 : -1) * env;
          break;
        case 'church_bell':
          // Bell: decaying sine with harmonics
          sample = Math.sin(t * 220 * 2 * Math.PI) * Math.exp(-t * 3) * Math.sin(t * 440 * 2 * Math.PI) * env;
          break;
        case 'steam_whistle':
          // Steam whistle: rising then falling pitch
          const pitch = 1 + Math.sin(t * 3) * 0.2;
          sample = Math.sin(t * 220 * pitch * 2 * Math.PI) * Math.exp(-t * 2) * env;
          break;
        case 'car_horn':
          sample = (Math.sin(t * 440 * 2 * Math.PI) > 0 ? 1 : -1) * Math.exp(-t * 2) * 0.5;
          break;
        case 'jukebox':
          // 50s-style melody snippet
          const melody = Math.floor(t * 8) % 8;
          const notes = [261.6, 293.7, 329.6, 261.6, 392.0, 349.2, 329.6, 293.7];
          sample = Math.sin(t * notes[melody] * 2 * Math.PI) * Math.exp(-t * 3) * env * 0.3;
          break;
        case 'scooter':
          sample = Math.sin(t * 330 * 2 * Math.PI) * Math.exp(-t * 1.5) * env * 0.4;
          break;
        case 'arcade_beep':
          sample = (Math.sin(t * 880 * 2 * Math.PI) > 0 ? 1 : -1) * Math.exp(-t * 4) * 0.3;
          break;
        case 'siren':
          // Siren: frequency sweep
          const sweep = 1 + Math.sin(t * 8) * 0.5;
          sample = Math.sin(t * 440 * sweep * 2 * Math.PI) * Math.exp(-t * 1) * env * 0.4;
          break;
        case 'cell_ring':
          sample = (Math.sin(t * 1000 * 2 * Math.PI) > 0 ? 1 : -1) * Math.exp(-t * 0.5) * 0.3;
          break;
        case 'ufo_landing':
          sample = Math.sin(t * 196 * 2 * Math.PI) * Math.exp(-t * 0.5) * 0.5;
          sample += Math.sin(t * 392 * 2 * Math.PI) * Math.exp(-t * 0.3) * 0.3;
          break;
        case 'holo_beep':
          sample = (Math.sin(t * 880 * 2 * Math.PI) > 0 ? 1 : -1) * Math.exp(-t * 3) * 0.4;
          break;
        case 'drone':
          sample = Math.sin(t * 196 * 2 * Math.PI) * 0.5;
          sample += Math.sin(t * 392 * 2 * Math.PI) * 0.3;
          sample *= Math.exp(-t * 0.5) * env;
          break;
        default:
          sample = Math.random() * 2 - 1;
      }

      channel[i] = sample;
    }
  }

  return buffer;
}

/**
 * Generate all audio buffers for a given era.
 * Combines noise bed + tonal drone into ambient, plus traffic loop and events.
 */
export function generateEraAudioBuffers(ctx: AudioContext, eraId: EraId): EraAudioBuffers {
  const data = SFX_ERA_DATA[eraId];

  // Ambient = noise bed + tonal drone mixed together
  const noiseBed = generateNoiseBed(ctx, data);
  const tonalDrone = generateTonalDrone(ctx, data);

  // Mix noise bed and tonal drone into one ambient buffer
  const ambient = ctx.createBuffer(2, noiseBed.length, SAMPLE_RATE);
  for (let ch = 0; ch < 2; ch++) {
    const out = ambient.getChannelData(ch);
    const noise = noiseBed.getChannelData(ch);
    const drone = tonalDrone.getChannelData(ch);
    for (let i = 0; i < out.length; i++) {
      out[i] = noise[i] + drone[i];
    }
  }

  const traffic = generateTrafficLoop(ctx, data);

  const events: AudioBuffer[] = [];
  for (const eventType of data.events) {
    events.push(generateEventBuffer(ctx, eventType, data));
  }

  return { ambient, traffic, events };
}

/** Generate audio buffers for all eras. */
export function generateAllEraBuffers(ctx: AudioContext): Record<EraId, EraAudioBuffers> {
  const result = {} as Record<EraId, EraAudioBuffers>;
  for (const eraId of ['1945', '1965', '1985', '2005', '2025', '2055'] as const) {
    result[eraId] = generateEraAudioBuffers(ctx, eraId);
  }
  return result;
}
