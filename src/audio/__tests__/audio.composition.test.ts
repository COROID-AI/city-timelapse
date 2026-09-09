/**
 * Audio Engine & Timeline Controller Composition Integration Test.
 *
 * Builds the audio engine with a fake AudioContext, attaches era layers,
 * wires with TimelineController, drives full transitions across 1945->2025,
 * asserts whoosh trigger events and era layer crossfades, and disposes cleanly.
 */

import { describe, expect, it, vi } from 'vitest';
import { createTimelineController } from '../../state/timelineStore';
import { createAudioEngine, createFakeAudioContext } from '../audioEngine';

describe('Audio Engine Composition', () => {
  it('integrates with TimelineController across all era transitions with whoosh triggers and crossfades', () => {
    const fakeCtx = createFakeAudioContext();
    const engine = createAudioEngine({
      contextFactory: () => fakeCtx,
      masterVolume: 0.8,
      ambienceVolume: 0.7,
      musicVolume: 0.6,
      sfxVolume: 0.9,
    });

    const whooshSpy = vi.spyOn(engine.sfx, 'playTransitionWhoosh');
    const hornSpy = vi.spyOn(engine.sfx, 'playHorn');

    engine.attach();

    const timeline = createTimelineController({
      initialEra: '1945',
      transitionDuration: 1.0,
    });

    // Wire timeline to audio engine passing transition & scrub flags
    const unsubscribe = timeline.subscribe((channel, state) => {
      engine.update(channel, 0.016, {
        isTransitioning: state.isTransitioning,
        isScrubbing: state.isScrubbing,
      });
    });

    // Initial state: 1945
    let weights = engine.getEraWeights();
    expect(weights['1945']).toBe(1.0);
    expect(weights['1965']).toBe(0.0);
    expect(weights['1985']).toBe(0.0);
    expect(weights['2005']).toBe(0.0);
    expect(weights['2025']).toBe(0.0);
    expect(whooshSpy).not.toHaveBeenCalled();

    // 1. Transition 1945 -> 1965
    timeline.setYear('1965', { duration: 1.0 });
    // Transition has begun -> whoosh should trigger
    expect(whooshSpy).toHaveBeenCalledTimes(1);

    // Step halfway (0.5s)
    timeline.update(0.5);
    weights = engine.getEraWeights();
    expect(weights['1945']).toBeCloseTo(0.5, 3);
    expect(weights['1965']).toBeCloseTo(0.5, 3);
    expect(weights['1985']).toBe(0.0);

    // Step to completion (0.5s)
    timeline.update(0.5);
    weights = engine.getEraWeights();
    expect(weights['1945']).toBe(0.0);
    expect(weights['1965']).toBe(1.0);

    // 2. Transition 1965 -> 1985
    timeline.setYear('1985', { duration: 1.0 });
    expect(whooshSpy).toHaveBeenCalledTimes(2);

    timeline.update(0.5);
    weights = engine.getEraWeights();
    expect(weights['1965']).toBeCloseTo(0.5, 3);
    expect(weights['1985']).toBeCloseTo(0.5, 3);

    timeline.update(0.5);
    weights = engine.getEraWeights();
    expect(weights['1985']).toBe(1.0);
    expect(weights['1965']).toBe(0.0);

    // 3. Transition 1985 -> 2005
    timeline.setYear('2005', { duration: 1.0 });
    expect(whooshSpy).toHaveBeenCalledTimes(3);

    timeline.update(1.0);
    weights = engine.getEraWeights();
    expect(weights['2005']).toBe(1.0);
    expect(weights['1985']).toBe(0.0);

    // 4. Transition 2005 -> 2025
    timeline.setYear('2025', { duration: 1.0 });
    expect(whooshSpy).toHaveBeenCalledTimes(4);

    timeline.update(1.0);
    weights = engine.getEraWeights();
    expect(weights['2025']).toBe(1.0);
    expect(weights['2005']).toBe(0.0);

    // 5. Test horn trigger with era-specific archetypes
    engine.triggerHorn();
    expect(hornSpy).toHaveBeenCalledWith('gentle_ev_chime');

    // 6. Test timeline scrubbing and audio weight tracking
    timeline.startScrub();
    // Scrub to 0.25 (1965)
    timeline.scrubTo(0.25);
    weights = engine.getEraWeights();
    expect(weights['1965']).toBe(1.0);

    // Scrub midway between 1985 and 2005 (around 0.625)
    timeline.scrubTo(0.625);
    weights = engine.getEraWeights();
    expect(weights['1985']).toBeCloseTo(0.5, 3);
    expect(weights['2005']).toBeCloseTo(0.5, 3);

    timeline.endScrub(true);
    weights = engine.getEraWeights();
    expect(weights['2005']).toBe(1.0);

    // 7. Test step navigation (+1 / -1)
    const stepped = timeline.step(-1); // 2005 -> 1985
    expect(stepped).toBe(true);
    expect(whooshSpy).toHaveBeenCalledTimes(5);
    timeline.update(1.0);
    weights = engine.getEraWeights();
    expect(weights['1985']).toBe(1.0);

    // Clean teardown
    unsubscribe();
    timeline.dispose();
    engine.dispose();
  });
});
