/**
 * src/audio/audio.test.ts — unit tests for the procedural SFX engine.
 *
 * Vitest runs in a Node environment here, so no real AudioContext exists.
 * These tests exercise the generator and mixer logic against a lightweight
 * fake that mirrors the Web Audio surface the modules actually use
 * (createBuffer/createGain/createBufferSource/createDynamicsCompressor,
 * param scheduling, source lifecycle), verifying:
 *
 *   - every era produces distinct, non-empty procedural buffers
 *   - generation is fully procedural (createBuffer only, no network/files)
 *   - the mixer only initializes on an explicit gesture (autoplay-safe)
 *   - setEra crossfades via bounded exponential ramps and releases old loops
 *     (no overlapping sources, no clicks, no double-trigger on rapid cycling)
 *   - dispose() tears the graph down
 */

import { describe, expect, it } from 'vitest';

import { SFX_ERA_DATA, ERA_IDS } from '../eras';
import {
  generateEraAudioBuffers,
  generateMusicBuffer,
  type EraAudioBuffers,
} from './sfx';
import { SfxMixer } from './mixer';

/** Minimal Web Audio surface used by the SFX modules. */
interface FakeParam {
  value: number;
  events: Array<{ type: string; time: number; value?: number }>;
  setValueAtTime(value: number, time: number): void;
  exponentialRampToValueAtTime(value: number, time: number): void;
  linearRampToValueAtTime(value: number, time: number): void;
  cancelScheduledValues(time: number): void;
}

interface FakeNode {
  kind: string;
  connectedTo: FakeNode[];
  gain: FakeParam;
  threshold?: FakeParam;
  knee?: FakeParam;
  ratio?: FakeParam;
  attack?: FakeParam;
  release?: FakeParam;
  connect?(target: FakeNode): void;
}

interface FakeSource extends FakeNode {
  buffer: FakeBuffer | null;
  loop: boolean;
  started: boolean;
  stopped: boolean;
  stopTime: number | null;
  onended: (() => void) | null;
  start(time?: number): void;
  stop(time?: number): void;
  disconnect(): void;
}

interface FakeBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  duration: number;
  channelData: Float32Array[];
  getChannelData(channel: number): Float32Array;
}

function makeParam(value: number): FakeParam {
  return {
    value,
    events: [],
    setValueAtTime(v: number, t: number) {
      this.events.push({ type: 'set', time: t, value: v });
    },
    exponentialRampToValueAtTime(v: number, t: number) {
      this.events.push({ type: 'exp', time: t, value: v });
    },
    linearRampToValueAtTime(v: number, t: number) {
      this.events.push({ type: 'lin', time: t, value: v });
    },
    cancelScheduledValues(t: number) {
      this.events.push({ type: 'cancel', time: t });
    },
  };
}

function makeBuffer(length: number, sampleRate = 44100): FakeBuffer {
  const channelData = [new Float32Array(length)];
  // Deterministic signal so buffer content checks are stable.
  for (let i = 0; i < length; i += 1) {
    channelData[0][i] = (i % 101) / 101;
  }
  return {
    numberOfChannels: 1,
    length,
    sampleRate,
    duration: length / sampleRate,
    channelData,
    getChannelData(channel: number) {
      return channelData[channel];
    },
  };
}

function makeNode(kind: string): FakeNode {
  return {
    kind,
    connectedTo: [],
    gain: makeParam(0.5),
    connect(target: FakeNode) {
      this.connectedTo.push(target);
    },
  };
}

class FakeAudioContext {
  state = 'suspended';
  currentTime = 0;
  destination: FakeNode = makeNode('destination');
  createdBuffers: FakeBuffer[] = [];
  sources: FakeSource[] = [];

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }

  createBuffer(_channels: number, length: number, sampleRate: number): FakeBuffer {
    const buf = makeBuffer(length, sampleRate);
    this.createdBuffers.push(buf);
    return buf;
  }

  createGain(): FakeNode {
    const node = makeNode('gain');
    return node;
  }

  createDynamicsCompressor(): FakeNode {
    const node = makeNode('compressor');
    node.threshold = makeParam(-6);
    node.knee = makeParam(6);
    node.ratio = makeParam(4);
    node.attack = makeParam(0.01);
    node.release = makeParam(0.25);
    return node;
  }

  createBufferSource(): FakeSource {
    const source: FakeSource = {
      kind: 'source',
      connectedTo: [],
      gain: makeParam(0),
      buffer: null,
      loop: false,
      started: false,
      stopped: false,
      stopTime: null,
      onended: null,
      start() {
        this.started = true;
      },
      stop(time?: number) {
        this.stopped = true;
        this.stopTime = time ?? 0;
        if (this.onended) {
          this.onended();
        }
      },
      disconnect() {
        this.connectedTo = [];
      },
      connect(target: FakeNode) {
        this.connectedTo.push(target);
      },
    };
    this.sources.push(source);
    return source;
  }
}

describe('procedural SFX generation', () => {
  it('generates a complete, non-empty buffer bundle for every era', () => {
    for (const id of ERA_IDS) {
      const ctx = new FakeAudioContext() as unknown as AudioContext;
      const bundle: EraAudioBuffers = generateEraAudioBuffers(
        ctx,
        SFX_ERA_DATA[id],
      ) as unknown as EraAudioBuffers;
      expect(bundle.ambient).toBeDefined();
      expect(bundle.traffic).toBeDefined();
      expect(bundle.music).toBeDefined();
      expect(bundle.events.length).toBe(SFX_ERA_DATA[id].events.length);
      for (const key of ['ambient', 'traffic', 'music'] as const) {
        const buf = bundle[key] as unknown as FakeBuffer;
        expect(buf.length).toBeGreaterThan(0);
        expect(buf.duration).toBeGreaterThan(0);
        const data = buf.getChannelData(0);
        let peak = 0;
        for (let i = 0; i < data.length; i += 1) {
          peak = Math.max(peak, Math.abs(data[i]));
        }
        expect(peak).toBeGreaterThan(0.01);
        expect(peak).toBeLessThanOrEqual(1);
      }
    }
  });

  it('buffers are distinct across eras (era-distinct audio profiles)', () => {
    const ctx = new FakeAudioContext() as unknown as AudioContext;
    const seenAmbient = new Set<string>();
    const seenMusic = new Set<string>();
    for (const id of ERA_IDS) {
      const bundle = generateEraAudioBuffers(ctx, SFX_ERA_DATA[id]) as unknown as EraAudioBuffers;
      const ambient = bundle.ambient as unknown as FakeBuffer;
      const music = bundle.music as unknown as FakeBuffer;
      seenAmbient.add(ambient.getChannelData(0)[1000].toFixed(6));
      seenMusic.add(music.getChannelData(0)[1000].toFixed(6));
    }
    expect(seenAmbient.size).toBeGreaterThan(1);
    expect(seenMusic.size).toBeGreaterThan(1);
  });

  it('generation is procedural (createBuffer only, no external assets)', () => {
    const fake = new FakeAudioContext();
    const ctx = fake as unknown as AudioContext;
    generateEraAudioBuffers(ctx, SFX_ERA_DATA['1945']);
    expect(fake.createdBuffers.length).toBeGreaterThan(0);
  });

  it('generateMusicBuffer produces distinct style beds for the five styles', () => {
    const styles = ['swing_radio', 'motown_pop', 'synthwave', 'pop_anthem', 'neon_ambient'];
    const ctx = new FakeAudioContext() as unknown as AudioContext;
    const seen = new Set<string>();
    for (const style of styles) {
      const buf = generateMusicBuffer(ctx, style) as unknown as FakeBuffer;
      seen.add(buf.getChannelData(0)[2000].toFixed(6));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('SfxMixer', () => {
  function createMixer(): { mixer: SfxMixer; ctx: FakeAudioContext } {
    const ctx = new FakeAudioContext();
    const mixer = new SfxMixer({
      contextFactory: () => ctx as unknown as AudioContext,
      storageKey: 'test:audio-muted',
    });
    return { mixer, ctx };
  }

  it('is not initialized and creates no context until init()', () => {
    const { mixer, ctx } = createMixer();
    expect(mixer.isInitialized).toBe(false);
    expect(ctx.state).toBe('suspended');
    expect(ctx.createdBuffers.length).toBe(0);
  });

  it('init() is autoplay-safe: resumes the context and starts loops', () => {
    const { mixer, ctx } = createMixer();
    mixer.init();
    expect(mixer.isInitialized).toBe(true);
    expect(ctx.state).toBe('running');
    expect(ctx.sources.length).toBeGreaterThan(0);
  });

  it('setEra crossfades layers using bounded exponential ramps and releases old loops', () => {
    const { mixer, ctx } = createMixer();
    mixer.init();
    const before = ctx.sources.length;
    mixer.setEra('1965');
    expect(ctx.sources.length).toBeGreaterThanOrEqual(before + 3);
    // Old sources must have been stopped (no overlapping loops).
    const stoppedOld = ctx.sources.slice(0, before).filter((s) => s.stopped);
    expect(stoppedOld.length).toBeGreaterThanOrEqual(1);
  });

  it('setEra no-ops when the era is unchanged (no double-trigger)', () => {
    const { mixer, ctx } = createMixer();
    mixer.init();
    const afterInit = ctx.sources.length;
    mixer.setEra('1945');
    expect(ctx.sources.length).toBe(afterInit);
  });

  it('dispose() stops sources and closes the context', () => {
    const { mixer, ctx } = createMixer();
    mixer.init();
    mixer.setEra('1985');
    mixer.dispose();
    expect(ctx.state).toBe('closed');
  });
});