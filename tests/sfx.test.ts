import { describe, expect, it } from 'vitest';
import { ERA_IDS, SFX_ERA_DATA } from '../src/eras';
import type { EraId } from '../src/eras';
import {
  generateAllEraBuffers,
  generateEraAudioBuffers,
} from '../src/audio/sfx';
import type { EraAudioBuffers } from '../src/audio/sfx';
import { FakeAudioContext, asAudioContext } from './helpers/fakeAudio';

const SR = 16000;

function allBuffers(buffers: EraAudioBuffers): AudioBuffer[] {
  return [buffers.ambient, buffers.traffic, buffers.music, ...buffers.events];
}

function signature(buffers: EraAudioBuffers): string {
  const parts = allBuffers(buffers).map((buffer) => buffer.getChannelData(0));
  let sum = 0;
  for (const data of parts) {
    for (let i = 0; i < data.length; i += 7) sum += Math.abs(data[i]);
  }
  return sum.toFixed(6);
}

describe('generateEraAudioBuffers', () => {
  it.each([...ERA_IDS])('renders finite, non-silent audio for era %s', (id) => {
    const ctx = new FakeAudioContext(SR);
    const buffers = generateEraAudioBuffers(asAudioContext(ctx), SFX_ERA_DATA[id]);

    expect(buffers.events.length).toBeGreaterThanOrEqual(1);

    for (const buffer of allBuffers(buffers)) {
      expect(buffer.sampleRate).toBe(SR);
      expect(buffer.numberOfChannels).toBeGreaterThanOrEqual(1);
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        expect(data.length).toBe(buffer.length);
        for (let i = 0; i < data.length; i++) {
          if (!Number.isFinite(data[i])) {
            throw new Error(`Non-finite sample at channel ${c}, index ${i}`);
          }
        }
      }
      // Non-silent and headroom-guarded.
      let peak = 0;
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
      }
      expect(peak).toBeGreaterThan(0.005);
      expect(peak).toBeLessThanOrEqual(1.0001);
    }

    // Loop layers are long enough to crossfade their seams.
    expect(buffers.ambient.duration).toBeGreaterThan(1);
    expect(buffers.traffic.duration).toBeGreaterThan(1);
    expect(buffers.music.duration).toBeGreaterThan(1);
    // One-shots stay short.
    for (const event of buffers.events) {
      expect(event.duration).toBeLessThan(3);
    }
  });

  it('is deterministic per era (same id → identical synthesis)', () => {
    const a = generateEraAudioBuffers(asAudioContext(new FakeAudioContext(SR)), SFX_ERA_DATA['1985']);
    const b = generateEraAudioBuffers(asAudioContext(new FakeAudioContext(SR)), SFX_ERA_DATA['1985']);
    expect(signature(a)).toBe(signature(b));
    const ambientA = a.ambient.getChannelData(0);
    const ambientB = b.ambient.getChannelData(0);
    expect(ambientA.length).toBe(ambientB.length);
    for (let i = 0; i < ambientA.length; i += 997) {
      expect(ambientA[i]).toBeCloseTo(ambientB[i], 5);
    }
  });

  it('produces a distinct sound world per era', () => {
    const signatures = new Map<EraId, string>();
    for (const id of ERA_IDS) {
      const ctx = new FakeAudioContext(SR);
      signatures.set(id, signature(generateEraAudioBuffers(asAudioContext(ctx), SFX_ERA_DATA[id])));
    }
    expect(new Set(signatures.values()).size).toBe(ERA_IDS.length);
  });

  it('renders every declared event kind exactly once per era', () => {
    for (const id of ERA_IDS) {
      const ctx = new FakeAudioContext(SR);
      const buffers = generateEraAudioBuffers(asAudioContext(ctx), SFX_ERA_DATA[id]);
      expect(buffers.events.length).toBe(SFX_ERA_DATA[id].events.kinds.length);
    }
  });
});

describe('generateAllEraBuffers', () => {
  it('covers every registered era in the registry', () => {
    const ctx = new FakeAudioContext(8000);
    const all = generateAllEraBuffers(asAudioContext(ctx));
    for (const id of ERA_IDS) {
      const buffers = all[id];
      expect(buffers).toBeDefined();
      expect(buffers.events.length).toBe(SFX_ERA_DATA[id].events.kinds.length);
      // Ambient beds are fixed-length loops (~6 s at this sample rate).
      expect(buffers.ambient.duration).toBeCloseTo(6, 1);
    }
    expect(Object.keys(all).sort()).toEqual([...ERA_IDS].sort());
  });

  it('uses createBuffer synthesis only (no external file APIs)', () => {
    const ctx = new FakeAudioContext(8000);
    generateAllEraBuffers(asAudioContext(ctx));
    // Every created source of audio went through ctx.createBuffer.
    expect(ctx.createdGains.length).toBe(0);
    expect(ctx.createdSources.length).toBe(0);
  });
});
