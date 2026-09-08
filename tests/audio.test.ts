/**
 * Composition test for the per-era SFX / ambient audio system.
 *
 * Mounts {@link AmbientAudio} against the shared era registry and asserts the
 * integrated WebAudio behaviour:
 * - each of the five eras produces a distinct ambient profile,
 * - changing era stops all previously-running oscillators (fix `920f34e7`),
 * - disposing closes the AudioContext on unmount (fix `8106c2a7`).
 *
 * A lightweight mock stands in for the browser `AudioContext` so the graph can
 * be exercised in the Node test environment.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { ERA_YEARS, getEra } from '../src/scenes/eras';
import { AmbientAudio } from '../src/scenes/audio';
import type {
  AudioContextLike,
  AudioContextFactory,
  GainLike,
  OscillatorLike,
} from '../src/scenes/audio/types';

/** Records every oscillator created and whether it was stopped/started. */
interface TrackedOscillator extends OscillatorLike {
  started: boolean;
  stopped: boolean;
}

/** Mock `AudioContext` implementing the structural contract. */
class MockAudioContext implements AudioContextLike {
  readonly currentTime = 0;
  readonly destination = 'destination';
  closed = false;
  oscillators: TrackedOscillator[] = [];

  createOscillator(): TrackedOscillator {
    const osc: TrackedOscillator = {
      type: 'sine',
      frequency: { value: 0 },
      detune: { value: 0 },
      started: false,
      stopped: false,
      connect: jest.fn(),
      start: jest.fn(() => {
        osc.started = true;
      }),
      stop: jest.fn(() => {
        osc.stopped = true;
      }),
    };
    this.oscillators.push(osc);
    return osc;
  }

  createGain(): GainLike {
    return {
      gain: { value: 0 },
      connect: jest.fn(),
    };
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

/** Build a fresh AmbientAudio bound to a fresh mock context. */
function makeAmbient(): { audio: AmbientAudio; ctx: MockAudioContext } {
  const ctx = new MockAudioContext();
  const factory: AudioContextFactory = () => ctx;
  const audio = new AmbientAudio({ audioContextFactory: factory });
  return { audio, ctx };
}

describe('AmbientAudio per-era profiles', () => {
  it('renders a distinct ambient profile for each of the five eras', () => {
    const { audio } = makeAmbient();
    const profiles = ERA_YEARS.map((year) => audio.getProfile(year));

    // Every era yields a non-empty layer set and a distinct soundbank.
    for (const profile of profiles) {
      expect(profile.year).toBeGreaterThanOrEqual(1945);
      expect(profile.layers.length).toBeGreaterThan(0);
    }
    const soundbankIds = new Set(profiles.map((p) => p.soundbankId));
    expect(soundbankIds.size).toBe(5);
    // Each era renders its own layer configuration (distinct frequencies/gains),
    // so the full per-layer signature differs across all five eras.
    const layerSignatures = new Set(
      profiles.map((p) =>
        p.layers
          .map((l) => `${l.id}:${l.frequency}:${l.gain}`)
          .join('|'),
      ),
    );
    expect(layerSignatures.size).toBe(5);
  });

  it('profiles derive from the shared era registry SfxProfile (read-only)', () => {
    const { audio } = makeAmbient();
    for (const year of ERA_YEARS) {
      const profile = audio.getProfile(year);
      const era = getEra(year);
      expect(profile.soundbankId).toBe(era.sfx.id);
      expect(profile.ambienceLevel).toBe(era.sfx.ambienceLevel);
    }
  });
});

describe('AmbientAudio lifecycle', () => {
  it('starts oscillators on attach for every era', () => {
    for (const year of ERA_YEARS) {
      const { audio, ctx } = makeAmbient();
      audio.attach(year);
      expect(ctx.oscillators.length).toBeGreaterThan(0);
      for (const osc of ctx.oscillators) {
        expect(osc.started).toBe(true);
        expect(osc.stopped).toBe(false);
      }
    }
  });

  it('stops all oscillators on era change (fix 920f34e7)', () => {
    const { audio, ctx } = makeAmbient();
    audio.attach(1945);
    const before = ctx.oscillators.length;
    expect(before).toBeGreaterThan(0);

    audio.update(2025);

    // Every oscillator created before the update (the 1945 bed) was stopped.
    const previous = ctx.oscillators.slice(0, before);
    for (const osc of previous) {
      expect(osc.stopped).toBe(true);
    }
    // A fresh set of oscillators for the new era is now running.
    const running = ctx.oscillators.slice(before);
    expect(running.length).toBeGreaterThan(0);
    for (const osc of running) {
      expect(osc.started).toBe(true);
      expect(osc.stopped).toBe(false);
    }
  });

  it('stops oscillators and closes the AudioContext on dispose (fix 8106c2a7)', async () => {
    const { audio, ctx } = makeAmbient();
    audio.attach(1985);
    expect(ctx.oscillators.length).toBeGreaterThan(0);
    expect(ctx.closed).toBe(false);

    await audio.dispose();

    for (const osc of ctx.oscillators) {
      expect(osc.stopped).toBe(true);
    }
    expect(ctx.closed).toBe(true);
    expect(audio.hasOpenContext).toBe(false);
    expect(audio.runningOscillatorCount).toBe(0);
  });

  it('rejects attach after dispose', async () => {
    const { audio } = makeAmbient();
    audio.attach(1945);
    await audio.dispose();
    expect(() => audio.attach(2005)).toThrow(/disposed/);
  });

  it('rejects unknown era years via the shared registry', () => {
    const { audio } = makeAmbient();
    expect(() => audio.attach(1999)).toThrow(/Unknown era year/);
    expect(() => audio.getProfile(2055)).toThrow(/Unknown era year/);
  });
});