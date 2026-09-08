import { describe, expect, it, vi } from 'vitest';
import { create, act } from 'react-test-renderer';
import { createElement } from 'react';

import { useEraStore } from '../../state/eraStore.js';
import { CityScene } from '../CityScene.js';
import type {
  AudioContextLike,
  AudioContextFactory,
  GainLike,
  OscillatorLike,
} from '../audio/types.js';

/**
 * Consolidated regression suite for the four reviewed fixes, run as part of
 * the `test` gate (vitest). It mounts the FULL composed CityScene (Buildings,
 * Vehicles, Storefronts, Pedestrians, Atmosphere, AmbientAudio + NavigationRig
 * + TimelineSlider) against a single shared interpolated era and asserts the
 * fixes hold at integration level across all five eras:
 *
 *  - 920f34e7  oscillators stop on era change
 *  - 8106c2a7  AudioContext closes on unmount
 *  - fd2f3e0c  pedestrian walkSpeed/walkOffset stay in useMemo([index])
 *  - fc38c708  era interpolation stays typed
 */

/** The five canonical era years. */
const YEARS: readonly number[] = [1945, 1965, 1985, 2005, 2025];

/** Tracked oscillator standing in for the browser WebAudio node. */
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
      connect: vi.fn(),
      start: vi.fn(() => {
        osc.started = true;
      }),
      stop: vi.fn(() => {
        osc.stopped = true;
      }),
    };
    this.oscillators.push(osc);
    return osc;
  }

  createGain(): GainLike {
    return { gain: { value: 0 }, connect: vi.fn() };
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

/** Mount the full composed scene and return its live handles. */
function mountScene(): {
  store: ReturnType<typeof useEraStore>;
  ctx: MockAudioContext;
  unmount: () => void;
} {
  const store = useEraStore(1945);
  const ctx = new MockAudioContext();
  const factory: AudioContextFactory = () => ctx;
  let renderer: ReturnType<typeof create> | undefined;
  act(() => {
    renderer = create(
      createElement(CityScene, { store, audioContextFactory: factory }),
    );
  });
  if (renderer === undefined) {
    throw new Error('renderer not created');
  }
  return {
    store,
    ctx,
    unmount: () => act(() => renderer!.unmount()),
  };
}

describe('reviewed-fix regression (integration, mounted CityScene)', () => {
  it('920f34e7: oscillators stop on era change', () => {
    const { store, ctx } = mountScene();
    expect(ctx.oscillators.length).toBeGreaterThan(0);

    const before = ctx.oscillators.length;
    act(() => store.select(2025));
    // Previously-running bed stopped; a fresh 2025 set is now running.
    const prior = ctx.oscillators.slice(0, before);
    expect(prior.every((o) => o.stopped)).toBe(true);
    expect(ctx.oscillators.slice(before).length).toBeGreaterThan(0);
  });

  it('8106c2a7: AudioContext closes on unmount', () => {
    const { ctx, unmount } = mountScene();
    expect(ctx.closed).toBe(false);

    unmount();
    expect(ctx.closed).toBe(true);
    expect(ctx.oscillators.every((o) => o.stopped)).toBe(true);
  });

  it('fd2f3e0c: pedestrian randomness stays inside useMemo([index])', () => {
    // Pedestrian walkSpeed/walkOffset are computed via useMemo([index]); no
    // Math.random runs in the render body. Spy to prove it.
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => 0.5);
    try {
      const { store } = mountScene();
      for (const year of YEARS) {
        act(() => store.select(year));
      }
      // Deterministic seeding means zero render-time randomness.
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('fc38c708: era interpolation stays typed across all five eras', () => {
    const { store } = mountScene();
    for (const year of YEARS) {
      act(() => store.select(year));
      // The scene routes a typed, numeric interpolated era year.
      expect(typeof store.current.year).toBe('number');
      expect(store.current.year).toBe(year);
    }
  });
});