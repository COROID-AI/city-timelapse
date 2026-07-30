import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  eraSfxConfigs,
  createSfxManager,
  ensureSfxManager,
  resetSfxManager,
  getActiveSfxManager,
} from '../scenes/sfx';
import type { EraYear } from '../types';

const ALL_ERAS: EraYear[] = [1945, 1965, 1985, 2005, 2025, 2055];

function createMockAudioContext() {
  const nodes: Array<{
    kind: string;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    gain: {
      value: number;
      cancelScheduledValues: ReturnType<typeof vi.fn>;
      setValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    frequency: { value: number; connect: ReturnType<typeof vi.fn> };
    Q: { value: number };
    buffer: unknown;
    loop: boolean;
    start: ReturnType<typeof vi.fn>;
    type: string;
  }> = [];

  const makeNode = (kind: string) => {
    const node = {
      kind,
      stop: vi.fn(),
      disconnect: vi.fn(),
      connect: vi.fn(),
      gain: {
        value: 0,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      frequency: { value: 0, connect: vi.fn() },
      Q: { value: 0 },
      type: 'sine',
      buffer: null,
      loop: false,
      start: vi.fn(),
    };
    nodes.push(node);
    return node;
  };

  const audioContext = {
    currentTime: 0,
    sampleRate: 44100,
    destination: makeNode('destination'),
    createGain: vi.fn(() => makeNode('gain')),
    createOscillator: vi.fn(() => makeNode('oscillator')),
    createBufferSource: vi.fn(() => makeNode('bufferSource')),
    createBiquadFilter: vi.fn(() => makeNode('filter')),
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(100) })),
    createDynamicsCompressor: vi.fn(() => makeNode('compressor')),
  };

  return { audioContext: audioContext as unknown as AudioContext, nodes, makeNode };
}

describe('eraSfxConfigs', () => {
  it('has a config for every era year', () => {
    ALL_ERAS.forEach((year) => {
      expect(eraSfxConfigs[year]).toBeDefined();
      expect(eraSfxConfigs[year].label).toBeTruthy();
      expect(eraSfxConfigs[year].layers.length).toBeGreaterThan(0);
    });
  });

  it('includes era-specific soundscape labels', () => {
    expect(eraSfxConfigs[1945].label).toBe('wartime');
    expect(eraSfxConfigs[1965].label).toBe('mod');
    expect(eraSfxConfigs[1985].label).toBe('neon city');
    expect(eraSfxConfigs[2005].label).toBe('urban flow');
    expect(eraSfxConfigs[2025].label).toBe('EV digital');
    expect(eraSfxConfigs[2055].label).toBe('futuristic');
  });
});

describe('createSfxManager', () => {
  let manager: ReturnType<typeof createSfxManager>;
  let mock: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = createSfxManager();
    mock = createMockAudioContext();
  });

  afterEach(() => {
    manager.stop();
    vi.useRealTimers();
  });

  it('start() creates oscillator and gain nodes for each layer', () => {
    const outputGain = mock.audioContext.createGain();
    manager.start(mock.audioContext, 1945, outputGain as unknown as GainNode);
    expect(mock.audioContext.createGain).toHaveBeenCalled();
    expect(mock.audioContext.createOscillator).toHaveBeenCalled();
    expect(mock.audioContext.createBiquadFilter).toHaveBeenCalled();
  });

  it('stop() is safe to call after start', () => {
    const outputGain = mock.audioContext.createGain();
    manager.start(mock.audioContext, 1965, outputGain as unknown as GainNode);
    expect(() => manager.stop()).not.toThrow();
  });

  it('transition() schedules crossfade and starts new layers', () => {
    const outputGain = mock.audioContext.createGain();
    manager.start(mock.audioContext, 1945, outputGain as unknown as GainNode);

    manager.transition(mock.audioContext, 1945, 1985, 0.6);
    vi.advanceTimersByTime(600);

    expect(mock.audioContext.createOscillator).toHaveBeenCalled();
  });

  it('creates and resets via ensureSfxManager/resetSfxManager', () => {
    resetSfxManager();
    const m = ensureSfxManager();
    expect(m).not.toBeNull();
    expect(getActiveSfxManager()).toBe(m);
    resetSfxManager();
    expect(getActiveSfxManager()).toBeNull();
  });
});

describe('useSfx cleanup', () => {
  it('stop is idempotent and safe when no layers active', () => {
    const manager = createSfxManager();
    expect(() => manager.stop()).not.toThrow();
  });
});
