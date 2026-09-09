/**
 * Procedural WebAudio Synthesis Engine.
 *
 * Implements 100% synthesized procedural sound generation (no binary audio files):
 * - Multi-colored noise generators (white, pink, brown)
 * - Subtractive / FM synth voices with ADSR envelopes
 * - Procedural drum generators (kick, snare, hihat, brush)
 * - Music loop schedulers driven by AudioEraSpec and tempo
 * - Continuous era ambience soundscape generators (neon buzz, radio chatter, arcade blips, traffic hum, EV whir, bird chirps)
 */

import type { AudioEraSpec } from '../era/types';
import type { EraId } from '../era/years';
import { ERA_SOUNDSCAPES, type EraSoundscapePreset, type MusicTrackSpec, type NoteEvent } from './audioEraData';

/**
 * Converts a standard MIDI note number (e.g., 60 = Middle C) to frequency in Hertz.
 */
export function midiToFreq(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Creates a procedural noise AudioBuffer with colored noise characteristics.
 * - white: uniform flat spectrum
 * - pink: 1/f spectrum (Paul Kellet filter)
 * - brown: 1/f^2 spectrum (integrated white noise)
 */
export function createNoiseBuffer(
  ctx: BaseAudioContext,
  type: 'white' | 'pink' | 'brown' = 'white',
  durationSeconds = 2.0,
): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const bufferSize = Math.max(128, Math.floor(sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else if (type === 'pink') {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  } else if (type === 'brown') {
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
  }

  return buffer;
}

/**
 * Triggers a synthesized single note on an AudioParam with an ADSR envelope.
 */
export function triggerSynthNote(
  ctx: BaseAudioContext,
  destination: AudioNode,
  track: MusicTrackSpec,
  note: NoteEvent,
  startTime: number,
  beatDurationSeconds: number,
): void {
  try {
    const freq = midiToFreq(note.pitch);
    const noteDuration = note.duration * beatDurationSeconds;

    const osc = ctx.createOscillator();
    osc.type = track.waveform;
    osc.frequency.setValueAtTime(freq, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);

    // Apply filter if specified
    let filter: BiquadFilterNode | null = null;
    if (track.filterCutoff && track.filterCutoff > 0) {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(track.filterCutoff, startTime);
    }

    // ADSR calculation
    const attack = Math.min(track.attack, noteDuration * 0.5);
    const decay = track.decay;
    const peakGain = Math.max(0.001, note.velocity * 0.35);
    const sustainGain = peakGain * track.sustain;
    const attackEnd = startTime + attack;
    const decayEnd = attackEnd + decay;
    const noteEnd = startTime + noteDuration;
    const releaseEnd = noteEnd + track.release;

    // Linear / Exponential envelope scheduling
    gain.gain.linearRampToValueAtTime(peakGain, attackEnd);
    if (decayEnd < noteEnd) {
      gain.gain.linearRampToValueAtTime(sustainGain, decayEnd);
      gain.gain.setValueAtTime(sustainGain, noteEnd);
    } else {
      gain.gain.setValueAtTime(sustainGain, noteEnd);
    }
    gain.gain.linearRampToValueAtTime(0.0001, releaseEnd);

    // Node routing
    if (filter) {
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(destination);

    osc.start(startTime);
    osc.stop(releaseEnd + 0.05);
  } catch {
    // Gracefully handle any node scheduling constraints in non-standard audio contexts
  }
}

/**
 * Controller for an individual era's procedural music loop.
 */
export interface EraMusicPlayer {
  readonly eraId: EraId;
  readonly spec: AudioEraSpec;
  readonly gainNode: GainNode;
  update(channelWeight: number, currentTime: number): void;
  dispose(): void;
}

/**
 * Creates a procedural era music player that schedules notes ahead in time.
 */
export function createEraMusicPlayer(
  ctx: AudioContext,
  eraId: EraId,
  destination: AudioNode,
): EraMusicPlayer {
  const preset: EraSoundscapePreset = ERA_SOUNDSCAPES[eraId];
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);

  // Era filter node
  const eraFilter = ctx.createBiquadFilter();
  eraFilter.type = 'bandpass';
  eraFilter.frequency.setValueAtTime((preset.filter.lowCutHz + preset.filter.highCutHz) / 2, ctx.currentTime);
  eraFilter.Q.setValueAtTime(preset.filter.q, ctx.currentTime);

  masterGain.connect(eraFilter);
  eraFilter.connect(destination);

  const secondsPerBeat = 60 / preset.spec.bpm;
  const loopDurationSeconds = preset.loopLengthBeats * secondsPerBeat;

  let nextLoopStartTime = ctx.currentTime;
  let currentWeight = 0;
  let disposed = false;

  function scheduleLoop(startTime: number): void {
    if (disposed) return;
    for (const track of preset.musicTracks) {
      for (const note of track.notes) {
        const noteStartTime = startTime + note.beat * secondsPerBeat;
        // Schedule if starting reasonably close in the future
        if (noteStartTime >= ctx.currentTime - 0.1) {
          triggerSynthNote(ctx, masterGain, track, note, noteStartTime, secondsPerBeat);
        }
      }
    }
  }

  return {
    eraId,
    spec: preset.spec,
    gainNode: masterGain,

    update(weight: number, currentTime: number): void {
      if (disposed) return;
      currentWeight = Math.max(0, Math.min(1, weight));

      // Smooth gain ramp for crossfade
      try {
        const targetGain = currentWeight > 0.001 ? currentWeight : 0.0001;
        masterGain.gain.setTargetAtTime(targetGain, currentTime, 0.05);
      } catch {
        masterGain.gain.value = currentWeight > 0.001 ? currentWeight : 0.0001;
      }

      // Schedule music notes ahead if this era is audible
      if (currentWeight > 0.01) {
        while (nextLoopStartTime < currentTime + 1.5) {
          scheduleLoop(nextLoopStartTime);
          nextLoopStartTime += loopDurationSeconds;
        }
      } else {
        // Keep nextLoopStartTime synchronized so when crossfaded in, it starts on beat
        if (nextLoopStartTime < currentTime) {
          const elapsed = currentTime - nextLoopStartTime;
          const skippedLoops = Math.floor(elapsed / loopDurationSeconds) + 1;
          nextLoopStartTime += skippedLoops * loopDurationSeconds;
        }
      }
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
        masterGain.disconnect();
        eraFilter.disconnect();
      } catch {
        // Safe disposal
      }
    },
  };
}

/**
 * Controller for an individual era's continuous procedural ambience textures.
 */
export interface EraAmbiencePlayer {
  readonly eraId: EraId;
  readonly gainNode: GainNode;
  update(channelWeight: number, currentTime: number): void;
  dispose(): void;
}

/**
 * Creates the procedural ambience layer player for an era.
 */
export function createEraAmbiencePlayer(
  ctx: AudioContext,
  eraId: EraId,
  destination: AudioNode,
): EraAmbiencePlayer {
  const preset: EraSoundscapePreset = ERA_SOUNDSCAPES[eraId];
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  masterGain.connect(destination);

  const activeNodes: { stop?: () => void; disconnect: () => void }[] = [];
  let nextProceduralEventTime = ctx.currentTime + Math.random() * 0.5;
  let disposed = false;

  // Set up noise and continuous texture layers
  try {
    for (const layer of preset.ambienceLayers) {
      if (layer.type === 'noise' || layer.type === 'texture' || layer.type === 'drone') {
        const noiseBuf = createNoiseBuffer(ctx, layer.noiseType || 'pink', 3.0);
        const source = ctx.createBufferSource();
        source.buffer = noiseBuf;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = layer.filterType || 'bandpass';
        filter.frequency.setValueAtTime(layer.filterFreq || 800, ctx.currentTime);
        filter.Q.setValueAtTime(layer.filterQ || 1.0, ctx.currentTime);

        const layerGain = ctx.createGain();
        layerGain.gain.setValueAtTime(layer.baseVolume * 0.5, ctx.currentTime);

        // Low frequency oscillation / modulation for texture realism
        if (layer.modulationHz && layer.modulationHz > 0) {
          try {
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(layer.modulationHz, ctx.currentTime);
            const lfoGain = ctx.createGain();
            lfoGain.gain.setValueAtTime(layer.baseVolume * 0.2, ctx.currentTime);
            lfo.connect(lfoGain);
            lfoGain.connect(layerGain.gain);
            lfo.start();
            activeNodes.push(lfo);
          } catch {
            // LFO fallback
          }
        }

        source.connect(filter);
        filter.connect(layerGain);
        layerGain.connect(masterGain);

        source.start();
        activeNodes.push(source, filter, layerGain);
      }
    }
  } catch {
    // Non-standard context safety
  }

  // Era-specific procedural sound burst triggers (arcade blips, bird chirps, radio chatter bursts)
  function triggerEraProceduralEvent(time: number): void {
    if (disposed) return;
    try {
      if (eraId === '1985') {
        // Arcade blip: quick 8-bit FM arpeggio
        const blipFreqs = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6
        const chosenFreq = blipFreqs[Math.floor(Math.random() * blipFreqs.length)];
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(chosenFreq, time);
        osc.frequency.exponentialRampToValueAtTime(chosenFreq * 1.5, time + 0.08);

        const blipGain = ctx.createGain();
        blipGain.gain.setValueAtTime(0.12, time);
        blipGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);

        osc.connect(blipGain);
        blipGain.connect(masterGain);
        osc.start(time);
        osc.stop(time + 0.12);
      } else if (eraId === '2025') {
        // Bird chirp: high frequency sweep
        const baseFreq = 2400 + Math.random() * 800;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, time);
        osc.frequency.linearRampToValueAtTime(baseFreq + 1200, time + 0.04);
        osc.frequency.exponentialRampToValueAtTime(baseFreq - 300, time + 0.12);

        const chirpGain = ctx.createGain();
        chirpGain.gain.setValueAtTime(0.08, time);
        chirpGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);

        osc.connect(chirpGain);
        chirpGain.connect(masterGain);
        osc.start(time);
        osc.stop(time + 0.15);
      } else if (eraId === '1945') {
        // Radio chatter grain burst
        const chatterBuf = createNoiseBuffer(ctx, 'pink', 0.2);
        const chatterSrc = ctx.createBufferSource();
        chatterSrc.buffer = chatterBuf;
        const chatterFilter = ctx.createBiquadFilter();
        chatterFilter.type = 'bandpass';
        chatterFilter.frequency.setValueAtTime(1400 + Math.random() * 600, time);
        chatterFilter.Q.setValueAtTime(4.0, time);

        const chatterGain = ctx.createGain();
        chatterGain.gain.setValueAtTime(0.1, time);
        chatterGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

        chatterSrc.connect(chatterFilter);
        chatterFilter.connect(chatterGain);
        chatterGain.connect(masterGain);
        chatterSrc.start(time);
        chatterSrc.stop(time + 0.2);
      }
    } catch {
      // Procedural event safety
    }
  }

  return {
    eraId,
    gainNode: masterGain,

    update(weight: number, currentTime: number): void {
      if (disposed) return;
      const safeWeight = Math.max(0, Math.min(1, weight));

      try {
        const targetGain = safeWeight > 0.001 ? safeWeight : 0.0001;
        masterGain.gain.setTargetAtTime(targetGain, currentTime, 0.05);
      } catch {
        masterGain.gain.value = safeWeight > 0.001 ? safeWeight : 0.0001;
      }

      // Schedule occasional procedural bursts if era is audible
      if (safeWeight > 0.1 && currentTime >= nextProceduralEventTime) {
        triggerEraProceduralEvent(currentTime);
        // Interval between events (0.8s to 2.5s)
        nextProceduralEventTime = currentTime + 0.8 + Math.random() * 1.7;
      }
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
        for (const node of activeNodes) {
          if (typeof node.stop === 'function') {
            node.stop();
          }
          if (typeof node.disconnect === 'function') {
            node.disconnect();
          }
        }
        masterGain.disconnect();
      } catch {
        // Safe disposal
      }
    },
  };
}
