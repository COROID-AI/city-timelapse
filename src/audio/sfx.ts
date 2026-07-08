/**
 * Procedural Audio Buffer Generator for Era-Specific Sound Effects
 * Generates AudioBuffers programmatically using Web Audio API
 */

import type { EraId, SfxEraData } from '../eras';
import { SFX_ERA_DATA } from '../eras';

export interface EraAudioBuffers {
  ambient: AudioBuffer;
  traffic: AudioBuffer;
  events: AudioBuffer[];
}

/**
 * Generate tonal drone (sine wave harmonics for ambient tone)
 */
function createDroneBuffer(ctx: AudioContext, freq: number, duration: number, resonance: number): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    // Multiple harmonics for rich drone
    for (let i = 0; i < bufferSize; i++) {
      const t = i / ctx.sampleRate;
      const fundamental = Math.sin(2 * Math.PI * freq * t) * 0.3;
      const harmonic2 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.15 * resonance;
      const harmonic3 = Math.sin(2 * Math.PI * freq * 3 * t) * 0.1 * resonance;
      data[i] = fundamental + harmonic2 + harmonic3;
    }
  }
  
  return buffer;
}

/**
 * Generate engine/idle sound (looping traffic sound)
 */
function createEngineBuffer(ctx: AudioContext, carType: string, duration: number): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
  
  // Different base frequencies for different vehicle types
  const baseFreq = carType === 'electric' || carType === 'autonomous' ? 80 :
                   carType === 'flying' || carType === 'drone' ? 120 : 40;
  
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / ctx.sampleRate;
      // Engine rumble with slight variation
      const rumble = Math.sin(2 * Math.PI * baseFreq * t) * 0.1;
      const variation = Math.sin(2 * Math.PI * (baseFreq * 1.5) * t) * 0.05;
      data[i] = rumble + variation;
    }
  }
  
  return buffer;
}

/**
 * Generate one-shot event sounds (horns, bells, sirens)
 */
function createEventBuffer(ctx: AudioContext, eventType: string, duration: number): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    
    switch (eventType) {
      case 'streetcar_bell':
        for (let i = 0; i < bufferSize; i++) {
          const t = i / ctx.sampleRate;
          data[i] = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 3) * 0.3;
        }
        break;
      case 'car_horn':
        for (let i = 0; i < bufferSize; i++) {
          const t = i / ctx.sampleRate;
          data[i] = Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t * 2) * 0.4;
        }
        break;
      case 'neon_hum':
        for (let i = 0; i < bufferSize; i++) {
          const t = i / ctx.sampleRate;
          data[i] = Math.sin(2 * Math.PI * 60 * t) * 0.1;
        }
        break;
      case 'electric_whirr':
        for (let i = 0; i < bufferSize; i++) {
          const t = i / ctx.sampleRate;
          const freq = 2000 + Math.sin(2 * Math.PI * 10 * t) * 200;
          data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 5) * 0.2;
        }
        break;
      case 'flying':
        for (let i = 0; i < bufferSize; i++) {
          const t = i / ctx.sampleRate;
          data[i] = Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 4) * 0.25;
        }
        break;
      case 'antigrav_hum':
        for (let i = 0; i < bufferSize; i++) {
          const t = i / ctx.sampleRate;
          const f = 440 * (1 + Math.sin(2 * Math.PI * 0.5 * t) * 0.3);
          data[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 2) * 0.2;
        }
        break;
      default:
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
    }
  }
  
  return buffer;
}

/**
 * Generate all audio buffers for a specific era
 */
export function generateEraAudioBuffers(ctx: AudioContext, data: SfxEraData): EraAudioBuffers {
  const ambient = createDroneBuffer(ctx, data.ambientTones.baseFreq, 10, data.ambientTones.resonance);
  const traffic = createEngineBuffer(ctx, data.trafficProfile.carTypes[0], 5);
  const events = data.eventTypes.map(eventType => 
    createEventBuffer(ctx, eventType, 2)
  );
  
  return { ambient, traffic, events };
}

/**
 * Generate all era audio buffers
 */
export function generateAllEraBuffers(ctx: AudioContext): Record<EraId, EraAudioBuffers> {
  const buffers: Record<string, EraAudioBuffers> = {};
  
  for (const eraId of Object.keys(SFX_ERA_DATA) as EraId[]) {
    buffers[eraId] = generateEraAudioBuffers(ctx, SFX_ERA_DATA[eraId]);
  }
  
  return buffers as Record<EraId, EraAudioBuffers>;
}