import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EraId } from '../src/eras';
import {
  DEFAULT_CROSSFADE_SECONDS,
  MAX_CROSSFADE_SECONDS,
  MIN_AUDIBLE_GAIN,
  SfxMixer,
  SFX_LAYER_IDS,
} from '../src/audio/mixer';
import type { SfxLayerId } from '../src/audio/mixer';
import type { EraAudioBuffers } from '../src/audio/sfx';
import {
  FakeAudioBuffer,
  FakeAudioContext,
  asAudioBuffer,
  asAudioContext,
} from './helpers/fakeAudio';

/** Per-layer base gains mirrored from mixer internals for assertions. */
const EXPECTED_BASE: Record<SfxLayerId, number> = {
  ambient: 0.9,
  traffic: 0.75,
  events: 1.0,
  music: 0.55,
};

function makeFakeBuffers(sampleRate = 48000): Record<EraId, EraAudioBuffers> {
  const oneSecond = new FakeAudioBuffer(2, sampleRate, sampleRate);
  const halfSecond = new FakeAudioBuffer(2, Math.round(sampleRate * 0.5), sampleRate);
  const make = (): EraAudioBuffers => ({
    ambient: asAudioBuffer(oneSecond),
    traffic: asAudioBuffer(oneSecond),
    events: [asAudioBuffer(halfSecond)],
    music: asAudioBuffer(oneSecond),
  });
  const record: Partial<Record<EraId, EraAudioBuffers>> = {};
  for (const id of ['1945', '1965', '1985', '2005', '2025'] as const) {
    record[id] = make();
  }
  return record as Record<EraId, EraAudioBuffers>;
}

interface Harness {
  ctx: FakeAudioContext;
  mixer: SfxMixer;
  buffers: Record<EraId, EraAudioBuffers>;
  factoryCalls: number;
}

async function startMixer(
  overrides: Partial<Parameters<typeof SfxMixer.prototype.ensureStarted> extends never ? never : object> = {},
): Promise<Harness> {
  void overrides;
  const ctx = new FakeAudioContext();
  let factoryCalls = 0;
  const buffers = makeFakeBuffers();
  const mixer = new SfxMixer({
    buffers,
    contextFactory: () => {
      factoryCalls += 1;
      return asAudioContext(ctx);
    },
  });
  await mixer.handleUserGesture();
  return { ctx, mixer, buffers, factoryCalls };
}

describe('SfxMixer lifecycle & autoplay policy', () => {
  it('defers AudioContext creation until the first user gesture', async () => {
    const ctx = new FakeAudioContext();
    let factoryCalls = 0;
    const mixer = new SfxMixer({
      buffers: makeFakeBuffers(),
      initialEra: '1965',
      contextFactory: () => {
        factoryCalls += 1;
        return asAudioContext(ctx);
      },
    });

    expect(mixer.phase).toBe('idle');
    expect(mixer.isStarted).toBe(false);
    mixer.setEra('1985'); // pre-start: records target only
    expect(factoryCalls).toBe(0);
    expect(mixer.era).toBe('1985');

    await mixer.handleUserGesture();
    expect(factoryCalls).toBe(1);
    expect(ctx.resumeCount).toBeGreaterThanOrEqual(1);
    expect(ctx.state).toBe('running');
    expect(mixer.phase).toBe('running');
    expect(mixer.isStarted).toBe(true);

    // Repeated gestures are no-ops.
    await mixer.handleUserGesture();
    expect(factoryCalls).toBe(1);
  });

  it('builds four layers × two slots plus a master gain and starts three loops', async () => {
    const { ctx, mixer } = await startMixer();

    const master = ctx.masterGain();
    const layerGains = ctx.gainsConnectedTo(master);
    // 4 layers × 2 slots; master itself also exists.
    expect(layerGains).toHaveLength(SFX_LAYER_IDS.length * 2);
    expect(master.gain.setValues().at(-1)?.value).toBeCloseTo(0.8, 5);

    // Active slot gains initialized to base level, inactive to MIN_AUDIBLE_GAIN.
    for (const layerId of SFX_LAYER_IDS) {
      const pair = layerGains.filter((gain) =>
        gain.gain.setValues().some((event) => Math.abs(event.value - EXPECTED_BASE[layerId]) < 1e-9),
      );
      expect(pair).toHaveLength(1);
      const inactive = layerGains.find((gain) =>
        gain.gain.setValues().some((event) => Math.abs(event.value - MIN_AUDIBLE_GAIN) < 1e-12),
      );
      expect(inactive).toBeDefined();
      void layerId;
    }

    // Ambient + traffic + music loops started immediately; events are scheduled.
    const loopSources = ctx.createdSources.filter((source) => source.loop);
    expect(loopSources).toHaveLength(3);
    for (const source of loopSources) {
      expect(source.startCalls[0]?.when).toBe(0);
    }
    void mixer;
  });

  it('starts via attachGestureUnlock on DOM-like gesture targets', async () => {
    const ctx = new FakeAudioContext();
    const target = new EventTarget() as unknown as HTMLElement;
    const mixer = new SfxMixer({
      buffers: makeFakeBuffers(),
      contextFactory: () => asAudioContext(ctx),
    });
    const detach = mixer.attachGestureUnlock(target);
    expect(mixer.phase).toBe('idle');

    target.dispatchEvent(new Event('pointerdown'));
    await vi.waitFor(() => expect(mixer.phase).toBe('running'));

    detach();
    // A second gesture after detach must not re-trigger anything harmful.
    target.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    expect(mixer.phase).toBe('running');

    mixer.dispose();
  });
});

describe('SfxMixer setEra crossfades', () => {
  it('schedules bounded exponential ramps on both slots of every layer', async () => {
    const { ctx, mixer } = await startMixer();
    ctx.advance(10);
    mixer.setEra('1985');
    expect(mixer.era).toBe('1985');

    const master = ctx.masterGain();
    const layerGains = ctx.gainsConnectedTo(master);
    const fadeEndBound = 10 + MAX_CROSSFADE_SECONDS + 1e-6;
    const incomingTargets: number[] = [];

    for (const gain of layerGains) {
      const ramps = gain.gain.rampsAfter(10);
      expect(ramps.length).toBeGreaterThan(0);
      for (const ramp of ramps) {
        expect(ramp.op).toBe('exponentialRamp');
        expect(ramp.time).toBeLessThanOrEqual(fadeEndBound);
        expect(ramp.value).toBeGreaterThanOrEqual(MIN_AUDIBLE_GAIN);
        expect(ramp.value).toBeLessThanOrEqual(1.0 + 1e-9);
      }
      const targets = ramps.map((ramp) => ramp.value);
      const hitsBase = Object.values(EXPECTED_BASE).find(
        (base) => targets.some((t) => Math.abs(t - base) < 1e-9),
      );
      if (hitsBase !== undefined) incomingTargets.push(targets[targets.indexOf(hitsBase)]);
      else expect(targets).toContain(MIN_AUDIBLE_GAIN);
    }

    // Exactly one incoming ramp per layer reaches its base level.
    expect(incomingTargets).toHaveLength(SFX_LAYER_IDS.length);
    expect(new Set(incomingTargets).size).toBe(SFX_LAYER_IDS.length);

    // Outgoing loops retire at the end of the fade; new loops start now.
    const retired = ctx.createdSources.filter((source) => source.stopCalls.length > 0);
    expect(retired).toHaveLength(3);
    for (const source of retired) {
      expect(source.stopCalls[0]).toBeCloseTo(fadeEndBound + 0.02, 3);
    }
    const freshLoops = ctx.createdSources.filter(
      (source) => source.loop && source.startCalls[0]?.when === 10,
    );
    expect(freshLoops).toHaveLength(3);
  });

  it('keeps rapid era changes within the ~1.5 s bound via cancelScheduledValues', async () => {
    const { ctx, mixer } = await startMixer();
    ctx.advance(20);
    mixer.setEra('2005');
    mixer.setEra('2025'); // same tick: previous automation must be canceled

    const master = ctx.masterGain();
    const layerGains = ctx.gainsConnectedTo(master);
    let sawCancel = false;
    for (const gain of layerGains) {
      expect(gain.gain.cancels.length).toBeGreaterThanOrEqual(1);
      sawCancel ||= gain.gain.cancels.some((time) => Math.abs(time - 20) < 1e-9);
      for (const ramp of gain.gain.rampsAfter(20)) {
        expect(ramp.time).toBeLessThanOrEqual(20 + MAX_CROSSFADE_SECONDS + 1e-6);
        expect(ramp.value).toBeGreaterThanOrEqual(MIN_AUDIBLE_GAIN);
      }
    }
    expect(sawCancel).toBe(true);
    expect(mixer.era).toBe('2025');
  });

  it('rejects unknown era ids', async () => {
    const { mixer } = await startMixer();
    expect(() => mixer.setEra('1999' as EraId)).toThrow(RangeError);
    expect(() => mixer.setEra('1999' as EraId)).toThrow(/unknown era/i);
  });

  it('clamps configured crossfade windows into [0.05, 1.5]', async () => {
    const buffers = makeFakeBuffers();
    const ctx = new FakeAudioContext();
    const long = new SfxMixer({
      buffers,
      crossfadeSeconds: 30,
      contextFactory: () => asAudioContext(ctx),
    });
    expect(long.crossfadeDuration).toBe(MAX_CROSSFADE_SECONDS);
    expect(DEFAULT_CROSSFADE_SECONDS).toBe(MAX_CROSSFADE_SECONDS);
    const zero = new SfxMixer({ buffers, crossfadeSeconds: 0, contextFactory: () => asAudioContext(ctx) });
    expect(zero.crossfadeDuration).toBeCloseTo(0.05, 6);
    void ctx;
  });
});

describe('SfxMixer event scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires one-shot event sources through the live events slot', async () => {
    const { ctx, mixer, buffers } = await startMixer();
    try {
      const before = ctx.createdSources.length;
      await vi.advanceTimersByTimeAsync(30000);
      const oneShots = ctx.createdSources.slice(before);
      expect(oneShots.length).toBeGreaterThan(0);
      const validBuffers = new Set<AudioBuffer>(buffers['1945'].events);
      for (const source of oneShots) {
        expect(source.loop).toBe(false);
        expect(source.buffer).not.toBeNull();
        expect(validBuffers.has(asAudioBuffer(source.buffer as FakeAudioBuffer))).toBe(true);
      }
    } finally {
      mixer.dispose();
    }
  });
});

describe('SfxMixer dispose', () => {
  it('stops voices, disconnects the graph and closes the context once', async () => {
    const { ctx, mixer } = await startMixer();
    const master = ctx.masterGain();
    const layerGains = ctx.gainsConnectedTo(master);
    expect(layerGains).toHaveLength(SFX_LAYER_IDS.length * 2);

    mixer.dispose();

    expect(mixer.phase).toBe('disposed');
    expect(ctx.closeCount).toBe(1);
    expect(ctx.state).toBe('closed');
    expect(ctx.createdSources.filter((source) => source.stopCalls.length > 0).length).toBe(3);

    expect(master.connections).toHaveLength(0);
    for (const gain of layerGains) {
      expect(gain.connections).toHaveLength(0);
    }
  });

  it('is idempotent and neutralizes later calls', async () => {
    const { mixer } = await startMixer();
    mixer.dispose();
    expect(() => mixer.dispose()).not.toThrow();
    mixer.setEra('2025'); // ignored, not thrown
    expect(mixer.era).toBe('1945');
    await expect(mixer.ensureStarted()).rejects.toThrow(/disposed/);
  });

  it('validates buffer coverage up front', () => {
    const partial = makeFakeBuffers();
    delete (partial as Partial<Record<EraId, unknown>>)['2025'];
    expect(
      () =>
        new SfxMixer({
          buffers: partial as Record<EraId, EraAudioBuffers>,
          contextFactory: () => asAudioContext(new FakeAudioContext()),
        }),
    ).toThrow(/2025/);
  });
});
