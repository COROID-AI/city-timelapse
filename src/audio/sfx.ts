import { SFX_ERA_DATA, type EraId, type SfxEraData } from '../eras';

/** Procedurally generated layers for one timeline era. */
export interface EraAudioBuffers {
  ambient: AudioBuffer;
  traffic: AudioBuffer;
  events: AudioBuffer[];
}

const LOOP_SECONDS = 4;

function createBuffer(context: BaseAudioContext, seconds = LOOP_SECONDS): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  return context.createBuffer(1, length, context.sampleRate);
}

function clampSample(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function fillAmbient(buffer: AudioBuffer, data: SfxEraData): void {
  const samples = buffer.getChannelData(0);
  const rate = buffer.sampleRate;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / rate;
    let harmonicTone = 0;
    data.ambientHarmonics.forEach((harmonic, harmonicIndex) => {
      harmonicTone += Math.sin(2 * Math.PI * data.ambientTone * harmonic * time) / (harmonicIndex + 1);
    });
    const noise = (Math.random() * 2 - 1) * data.ambientNoise;
    const lowPassAmount = Math.min(1, data.ambientFilter / rate * 8);
    const previous = index > 0 ? samples[index - 1] : 0;
    const filteredNoise = previous + (noise - previous) * lowPassAmount;
    const fade = Math.min(1, time * 8, (LOOP_SECONDS - time) * 8);
    samples[index] = clampSample((harmonicTone * 0.08 + filteredNoise * 0.12) * fade);
  }
}

function fillTraffic(buffer: AudioBuffer, data: SfxEraData): void {
  const samples = buffer.getChannelData(0);
  const rate = buffer.sampleRate;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / rate;
    const enginePulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.34 * time);
    const engine = Math.sin(2 * Math.PI * (data.trafficPitch + enginePulse * 13) * time);
    const roadNoise = (Math.random() * 2 - 1) * 0.08;
    samples[index] = clampSample((engine * 0.16 + roadNoise) * data.trafficProfile);
  }
}

function fillEvent(buffer: AudioBuffer, frequency: number, eventIndex: number): void {
  const samples = buffer.getChannelData(0);
  const rate = buffer.sampleRate;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / rate;
    const envelope = Math.exp(-time * (4.4 + eventIndex * 0.45));
    const chirp = Math.sin(2 * Math.PI * frequency * (1 + time * 0.25) * time);
    samples[index] = chirp * envelope * 0.42;
  }
}

/** Build ambient, traffic, and era-specific one-shot buffers without files. */
export function generateEraAudioBuffers(context: BaseAudioContext, data: SfxEraData): EraAudioBuffers {
  const ambient = createBuffer(context);
  fillAmbient(ambient, data);
  const traffic = createBuffer(context);
  fillTraffic(traffic, data);
  const events = data.eventTypes.map((_, index) => {
    const event = createBuffer(context, 1.25);
    fillEvent(event, data.ambientTone * (1.45 + index * 0.32), index);
    return event;
  });
  return { ambient, traffic, events };
}

/** Generate all six profiles explicitly so a new era cannot be omitted silently. */
export function generateAllEraBuffers(
  context: BaseAudioContext,
  dataByEra: Record<EraId, SfxEraData> = SFX_ERA_DATA,
): Record<EraId, EraAudioBuffers> {
  return {
    '1945': generateEraAudioBuffers(context, dataByEra['1945']),
    '1965': generateEraAudioBuffers(context, dataByEra['1965']),
    '1985': generateEraAudioBuffers(context, dataByEra['1985']),
    '2005': generateEraAudioBuffers(context, dataByEra['2005']),
    '2025': generateEraAudioBuffers(context, dataByEra['2025']),
    '2055': generateEraAudioBuffers(context, dataByEra['2055']),
  };
}
