import type { EraId, SfxEraData } from '../eras.js';

/**
 * Era-specific audio buffers container
 */
export interface EraAudioBuffers {
  ambient: AudioBuffer;
  traffic: AudioBuffer;
  events: AudioBuffer[];
  music: AudioBuffer;
}

/**
 * Generates a filtered noise buffer for ambient tones
 */
function generateFilteredNoise(
  ctx: AudioContext,
  duration: number,
  sampleRate: number,
  frequencies: number[]
): AudioBuffer {
  const length = Math.floor(duration * sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < length; i++) {
    const t = i / length;
    const envelope = Math.exp(-t * 1.5);
    
    // Combine multiple frequency components with noise
    let sample = 0;
    for (const freq of frequencies) {
      sample += Math.sin(2 * Math.PI * freq * t) * 0.5;
    }
    sample = (sample + (Math.random() * 2 - 1)) * envelope * 0.2;
    data[i] = sample;
  }
  
  return buffer;
}

/**
 * Generates engine/idle sound for traffic based on profile
 */
function generateTrafficBuffer(
  ctx: AudioContext,
  duration: number,
  sampleRate: number,
  profile: 'horse' | 'light' | 'moderate' | 'heavy' | 'dense'
): AudioBuffer {
  const length = Math.floor(duration * sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  
  const isHorse = profile === 'horse';
  const rpm = isHorse ? 80 : 120 + (['light', 'moderate', 'heavy', 'dense'] as const).indexOf(
    profile as 'light' | 'moderate' | 'heavy' | 'dense'
  ) * 40;
  
  for (let i = 0; i < length; i++) {
    const t = i / length;
    
    let sample: number;
    if (isHorse) {
      // Horse hoof sounds - rhythmic pattern
      const hoofRate = 1.5; // hooves per second
      const cycle = (t * hoofRate) % 1;
      if (cycle < 0.1) {
        sample = (Math.random() * 2 - 1) * (cycle / 0.1) * 0.4;
      } else {
        sample = 0;
      }
      // Add subtle ambient
      sample += (Math.random() * 2 - 1) * 0.05;
    } else {
      // Engine rumble
      sample = Math.sin(2 * Math.PI * rpm * t) * 0.3;
      sample += Math.sin(2 * Math.PI * rpm * 2 * t) * 0.15;
      sample += (Math.random() * 2 - 1) * 0.1 * (1 - t); // Fade noise
    }
    
    data[i] = sample;
  }
  
  return buffer;
}

/**
 * Generates one-shot event sounds
 */
function generateEventBuffer(
  ctx: AudioContext,
  sampleRate: number,
  eventType: string
): AudioBuffer {
  const duration = 1.5;
  const length = Math.floor(duration * sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  
  switch (eventType) {
    case 'horse-hooves':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const envelope = Math.exp(-t * 8);
        data[i] = (Math.random() * 2 - 1) * envelope * 0.5;
      }
      break;
    case 'tram-bell':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const freq = 800 + 200 * Math.sin(2 * Math.PI * 10 * t);
        const envelope = Math.exp(-t * 3);
        data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4;
      }
      break;
    case 'typewriter':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        if (Math.random() < 0.3 * (1 - t)) {
          data[i] = Math.random() * 2 - 1;
        }
      }
      break;
    case 'car-horn':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const envelope = Math.exp(-t * 6);
        const freq = t > 0.3 ? 180 : 160;
        data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.5;
      }
      break;
    case 'radio-music':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 330 * t)) * 0.2;
      }
      break;
    case 'footsteps':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        if (Math.random() < 0.2 * (1 - t)) {
          data[i] = (Math.random() * 2 - 1) * 0.3;
        }
      }
      break;
    case 'synth-music':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 330 * t) + Math.sin(2 * Math.PI * 550 * t)) * 0.15;
      }
      break;
    case 'cassette-tape':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 4) * 0.3;
      }
      break;
    case 'traffic':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * (1 - t) * 0.2;
      }
      break;
    case 'cellphone':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = Math.sin(2 * Math.PI * 1000 * t) * Math.sin(2 * Math.PI * 30 * t) * 0.3 * (1 - t);
      }
      break;
    case 'car-alarm':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const freq = 800 + 200 * Math.sin(2 * Math.PI * 5 * t);
        data[i] = Math.sin(2 * Math.PI * freq * t) * 0.3 * Math.exp(-t * 2);
      }
      break;
    case 'construction':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        if (Math.random() < 0.25 * (1 - t)) {
          data[i] = (Math.random() * 2 - 1) * 0.4;
        }
      }
      break;
    case 'electric-whir':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = Math.sin(2 * Math.PI * 200 * t) * 0.3 * Math.exp(-t * 4);
      }
      break;
    case 'notification':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const freq = t > 0.1 ? 1200 : 800;
        data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 10) * 0.3;
      }
      break;
    case 'drone':
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = Math.sin(2 * Math.PI * 400 * t) * 0.2 * Math.exp(-t * 3);
      }
      break;
    default:
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 0.1 - 0.05;
      }
  }
  
  return buffer;
}

/**
 * Generates music buffer based on style
 */
function generateMusicBuffer(
  ctx: AudioContext,
  duration: number,
  sampleRate: number,
  style: string
): AudioBuffer {
  const length = Math.floor(duration * sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < length; i++) {
    const t = i / length;
    
    let sample = 0;
    switch (style) {
      case 'big-band':
        sample = (Math.sin(2 * Math.PI * 110 * t) + Math.sin(2 * Math.PI * 220 * t)) * 0.2;
        sample += Math.sin(2 * Math.PI * 110 * 3 * t) * 0.1;
        break;
      case 'rock-roll':
        sample = (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 330 * t)) * 0.15;
        break;
      case 'synth-pop':
        sample = (Math.sin(2 * Math.PI * 165 * t) + Math.sin(2 * Math.PI * 330 * t) + Math.sin(2 * Math.PI * 660 * t)) * 0.1;
        break;
      case 'hip-hop':
        sample = (Math.random() * 2 - 1) * 0.1;
        break;
      case 'electronic':
        sample = (Math.sin(2 * Math.PI * 330 * t) + Math.sin(2 * Math.PI * 660 * t) + Math.sin(2 * Math.PI * 1320 * t)) * 0.1;
        break;
    }
    
    const envelope = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.1 * t);
    data[i] = sample * envelope;
  }
  
  return buffer;
}

/**
 * Generates all audio buffers for a specific era
 */
export function generateEraAudioBuffers(
  ctx: AudioContext,
  eraId: EraId,
  data: SfxEraData
): EraAudioBuffers {
  const sampleRate = ctx.sampleRate;
  
  const ambient = generateFilteredNoise(ctx, 10, sampleRate, data.ambientTones);
  const traffic = generateTrafficBuffer(ctx, 8, sampleRate, data.trafficProfile);
  const events = data.eventTypes.map(type => generateEventBuffer(ctx, sampleRate, type));
  const music = generateMusicBuffer(ctx, 15, sampleRate, data.musicStyle);
  
  return { ambient, traffic, events, music };
}

/**
 * Generates all era audio buffers at once
 */
export async function generateAllEraBuffers(ctx: AudioContext): Promise<Record<EraId, EraAudioBuffers>> {
  const localSfxEraData = (await import('../eras.js')).SFX_ERA_DATA as Record<EraId, SfxEraData>;
  
  const result: Record<EraId, EraAudioBuffers> = {} as Record<EraId, EraAudioBuffers>;
  
  for (const eraId of Object.keys(localSfxEraData) as EraId[]) {
    result[eraId] = generateEraAudioBuffers(ctx, eraId, localSfxEraData[eraId]);
  }
  
  return result;
}