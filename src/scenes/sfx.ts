import type { EraYear, SfxManagerRef } from '../types';

export interface SfxLayer {
  type: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
  frequency: number;
  gain: number;
  lfoRate?: number; // AM modulation for movement/variation
  lfoDepth?: number; // 0–1, fraction of carrier frequency
  filterType?: 'lowpass' | 'bandpass' | 'highpass';
  filterFrequency: number;
  filterQ?: number;
  attackMs?: number;
  releaseMs?: number;
}

export interface EraSfxConfig {
  label: string;
  masterGain: number;
  layers: SfxLayer[];
}

export const eraSfxConfigs: Record<EraYear, EraSfxConfig> = {
  1945: {
    label: 'wartime',
    masterGain: 0.35,
    layers: [
      {
        type: 'sawtooth',
        frequency: 55,
        gain: 0.12,
        filterType: 'lowpass',
        filterFrequency: 200,
        filterQ: 2,
        attackMs: 1200,
        releaseMs: 800,
      },
      {
        type: 'noise',
        frequency: 0,
        gain: 0.06,
        filterType: 'bandpass',
        filterFrequency: 600,
        filterQ: 0.5,
        attackMs: 900,
        releaseMs: 600,
      },
      {
        type: 'sine',
        frequency: 880,
        gain: 0.08,
        filterType: 'lowpass',
        filterFrequency: 1500,
        attackMs: 40,
        releaseMs: 180,
        lfoRate: 2.5,
        lfoDepth: 0.4,
      },
    ],
  },
  1965: {
    label: 'mod',
    masterGain: 0.3,
    layers: [
      {
        type: 'square',
        frequency: 98,
        gain: 0.1,
        filterType: 'lowpass',
        filterFrequency: 350,
        filterQ: 3,
        attackMs: 800,
        releaseMs: 600,
      },
      {
        type: 'sawtooth',
        frequency: 120,
        gain: 0.07,
        filterType: 'bandpass',
        filterFrequency: 400,
        filterQ: 1.5,
        attackMs: 700,
        releaseMs: 500,
      },
      {
        type: 'sine',
        frequency: 440,
        gain: 0.05,
        filterType: 'lowpass',
        filterFrequency: 900,
        attackMs: 30,
        releaseMs: 200,
        lfoRate: 1.8,
        lfoDepth: 0.35,
      },
    ],
  },
  1985: {
    label: 'neon city',
    masterGain: 0.32,
    layers: [
      {
        type: 'sine',
        frequency: 200,
        gain: 0.1,
        filterType: 'lowpass',
        filterFrequency: 800,
        attackMs: 1000,
        releaseMs: 600,
      },
      {
        type: 'noise',
        frequency: 0,
        gain: 0.05,
        filterType: 'bandpass',
        filterFrequency: 2000,
        filterQ: 0.8,
        attackMs: 600,
        releaseMs: 400,
      },
      {
        type: 'sawtooth',
        frequency: 330,
        gain: 0.04,
        filterType: 'highpass',
        filterFrequency: 500,
        attackMs: 1100,
        releaseMs: 700,
        lfoRate: 3.2,
        lfoDepth: 0.2,
      },
      {
        type: 'triangle',
        frequency: 165,
        gain: 0.05,
        filterType: 'lowpass',
        filterFrequency: 400,
        attackMs: 900,
        releaseMs: 500,
        lfoRate: 0.9,
        lfoDepth: 0.15,
      },
    ],
  },
  2005: {
    label: 'urban flow',
    masterGain: 0.34,
    layers: [
      {
        type: 'sawtooth',
        frequency: 80,
        gain: 0.1,
        filterType: 'lowpass',
        filterFrequency: 300,
        filterQ: 2,
        attackMs: 1000,
        releaseMs: 500,
      },
      {
        type: 'noise',
        frequency: 0,
        gain: 0.04,
        filterType: 'bandpass',
        filterFrequency: 1800,
        filterQ: 0.6,
        attackMs: 700,
        releaseMs: 350,
      },
      {
        type: 'sine',
        frequency: 150,
        gain: 0.06,
        filterType: 'lowpass',
        filterFrequency: 500,
        attackMs: 800,
        releaseMs: 400,
      },
    ],
  },
  2025: {
    label: 'EV digital',
    masterGain: 0.28,
    layers: [
      {
        type: 'sine',
        frequency: 100,
        gain: 0.09,
        filterType: 'lowpass',
        filterFrequency: 500,
        attackMs: 1400,
        releaseMs: 600,
      },
      {
        type: 'square',
        frequency: 200,
        gain: 0.025,
        filterType: 'highpass',
        filterFrequency: 1000,
        attackMs: 1500,
        releaseMs: 800,
      },
      {
        type: 'noise',
        frequency: 0,
        gain: 0.02,
        filterType: 'bandpass',
        filterFrequency: 3000,
        filterQ: 2,
        attackMs: 1000,
        releaseMs: 500,
        lfoRate: 5,
        lfoDepth: 0.3,
      },
    ],
  },
  2055: {
    label: 'futuristic',
    masterGain: 0.3,
    layers: [
      {
        type: 'sine',
        frequency: 180,
        gain: 0.08,
        filterType: 'lowpass',
        filterFrequency: 600,
        attackMs: 1200,
        releaseMs: 500,
        lfoRate: 4,
        lfoDepth: 0.5,
      },
      {
        type: 'sawtooth',
        frequency: 220,
        gain: 0.04,
        filterType: 'highpass',
        filterFrequency: 800,
        attackMs: 1300,
        releaseMs: 700,
      },
      {
        type: 'triangle',
        frequency: 120,
        gain: 0.05,
        filterType: 'lowpass',
        filterFrequency: 350,
        attackMs: 1100,
        releaseMs: 600,
        lfoRate: 1.5,
        lfoDepth: 0.25,
      },
      {
        type: 'sine',
        frequency: 660,
        gain: 0.02,
        filterType: 'bandpass',
        filterFrequency: 1200,
        filterQ: 3,
        attackMs: 1400,
        releaseMs: 900,
        lfoRate: 6,
        lfoDepth: 0.4,
      },
    ],
  },
};

type LayerNodes = {
  oscillator: OscillatorNode | null;
  noiseSource: AudioBufferSourceNode | null;
  lfoOscillator: OscillatorNode | null;
  lfoGain: GainNode | null;
  gainNode: GainNode;
  filterNode: BiquadFilterNode;
};

let activeManager: SfxManagerRef | null = null;

function createNoiseBuffer(audioContext: AudioContext): AudioBuffer {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * 2));
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    channel[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function safeStop(node: OscillatorNode | AudioBufferSourceNode | null): void {
  if (!node) return;
  try {
    node.stop();
  } catch {
    // ignore
  }
}

function setEnvelope(
  gainNode: GainNode,
  audioContext: AudioContext,
  attackMs: number,
  releaseMs: number,
  targetGain: number,
): void {
  const now = audioContext.currentTime;
  const attackSec = Math.max(0.001, attackMs / 1000);
  const releaseSec = Math.max(0.001, releaseMs / 1000);
  void releaseSec;

  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(targetGain, now + attackSec);
}

function createLayer(
  audioContext: AudioContext,
  layer: SfxLayer,
  outputGain: GainNode,
  initialTargetGain: number,
): LayerNodes & { targetGain: number } {
  const gainNode = audioContext.createGain();
  gainNode.gain.value = 0.0001;

  const filterNode = audioContext.createBiquadFilter();
  filterNode.type = layer.filterType ?? 'lowpass';
  filterNode.frequency.value = layer.filterFrequency;
  filterNode.Q.value = layer.filterQ ?? 1;

  filterNode.connect(gainNode);
  gainNode.connect(outputGain);

  let oscillator: OscillatorNode | null = null;
  let noiseSource: AudioBufferSourceNode | null = null;
  let lfoOscillator: OscillatorNode | null = null;
  let lfoGain: GainNode | null = null;

  if (layer.type === 'noise') {
    const buffer = createNoiseBuffer(audioContext);
    noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    noiseSource.connect(filterNode);
    noiseSource.start();
  } else {
    oscillator = audioContext.createOscillator();
    oscillator.type = layer.type;
    oscillator.frequency.value = layer.frequency;

    if (layer.lfoRate && layer.lfoRate > 0) {
      lfoOscillator = audioContext.createOscillator();
      lfoOscillator.frequency.value = layer.lfoRate;

      lfoGain = audioContext.createGain();
      const depth = layer.lfoDepth ?? 0;
      lfoGain.gain.value = layer.frequency * depth * layer.gain;

      lfoOscillator.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      lfoOscillator.start();
    }

    oscillator.connect(filterNode);
    oscillator.start();
  }

  return { oscillator, noiseSource, lfoOscillator, lfoGain, gainNode, filterNode, targetGain: initialTargetGain };
}

export function createSfxManager(): SfxManagerRef {
  const state = {
    audioContext: null as AudioContext | null,
    outputGain: null as GainNode | null,
    activeEra: null as EraYear | null,
    layers: new Map<string, LayerNodes & { targetGain: number; era: EraYear }>(),
    transitionTimer: null as ReturnType<typeof setTimeout> | null,
  };

  function clearLayers(): void {
    if (state.transitionTimer) {
      clearTimeout(state.transitionTimer);
      state.transitionTimer = null;
    }

    state.layers.forEach((entry) => {
      safeStop(entry.oscillator);
      safeStop(entry.noiseSource);
      safeStop(entry.lfoOscillator);
      try {
        entry.lfoGain?.disconnect();
      } catch {
        // ignore
      }
      try {
        entry.filterNode.disconnect();
      } catch {
        // ignore
      }
      try {
        entry.gainNode.disconnect();
      } catch {
        // ignore
      }
    });

    state.layers.clear();
  }

  function start(audioContext: AudioContext, era: EraYear, outputGain: GainNode): void {
    clearLayers();
    state.audioContext = audioContext;
    state.outputGain = outputGain;
    state.activeEra = era;

    const config = eraSfxConfigs[era];
    config.layers.forEach((layer, index) => {
      const key = `${era}-${index}`;
      const targetGain = layer.gain * config.masterGain;
      const nodes = createLayer(audioContext, layer, outputGain, targetGain);
      state.layers.set(key, { ...nodes, era });

      requestAnimationFrame(() => {
        setEnvelope(
          nodes.gainNode,
          audioContext,
          layer.attackMs ?? 800,
          layer.releaseMs ?? 500,
          targetGain,
        );
      });
    });
  }

  function stop(): void {
    clearLayers();
    state.audioContext = null;
    state.outputGain = null;
    state.activeEra = null;
  }

  function transition(audioContext: AudioContext, from: EraYear, to: EraYear, durationSeconds: number): void {
    if (!state.outputGain) {
      start(audioContext, to, audioContext.createGain());
      return;
    }

    // Immediate crossfade: ramp down old layers, ramp up new ones.
    const duration = Math.max(0.05, durationSeconds);
    const now = audioContext.currentTime;

    const fromConfig = eraSfxConfigs[from];
    const toConfig = eraSfxConfigs[to];

    // Fade out existing layers for `from`.
    state.layers.forEach((entry, key) => {
      if (entry.era !== from) return;
      const gainNode = entry.gainNode;
      const currentGain = gainNode.gain.value;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(currentGain, now);
      gainNode.gain.linearRampToValueAtTime(0.0001, now + duration);

      // eslint/TS: fromConfig used only for key matching; keep minimal.
      void key;
      void fromConfig;
    });

    // Start new layers and fade them in.
    const outputGain = state.outputGain;
    toConfig.layers.forEach((layer, index) => {
      const key = `${to}-${index}`;
      const targetGain = layer.gain * toConfig.masterGain;
      const nodes = createLayer(audioContext, layer, outputGain, targetGain);
      state.layers.set(key, { ...nodes, era: to });

      nodes.gainNode.gain.cancelScheduledValues(now);
      nodes.gainNode.gain.setValueAtTime(0.0001, now);
      nodes.gainNode.gain.linearRampToValueAtTime(targetGain, now + duration);
    });

    // Remove old layers after crossfade completes.
    const fadeOutEndMs = Math.ceil(duration * 1000) + 30;
    state.transitionTimer = setTimeout(() => {
      const keysToRemove: string[] = [];
      state.layers.forEach((entry, key) => {
        if (entry.era === from) keysToRemove.push(key);
      });

      keysToRemove.forEach((key) => {
        const entry = state.layers.get(key);
        if (!entry) return;

        safeStop(entry.oscillator);
        safeStop(entry.noiseSource);
        safeStop(entry.lfoOscillator);

        try {
          entry.lfoGain?.disconnect();
        } catch {
          // ignore
        }
        try {
          entry.filterNode.disconnect();
        } catch {
          // ignore
        }
        try {
          entry.gainNode.disconnect();
        } catch {
          // ignore
        }

        state.layers.delete(key);
      });
    }, fadeOutEndMs);
  }

  return { getCurrentContext: () => state.audioContext, start, stop, transition };
}

export function ensureSfxManager(): SfxManagerRef {
  if (!activeManager) {
    activeManager = createSfxManager();
  }
  return activeManager;
}

export function getActiveSfxManager(): SfxManagerRef | null {
  return activeManager;
}

export function resetSfxManager(): void {
  if (activeManager) {
    activeManager.stop();
    activeManager = null;
  }
}
