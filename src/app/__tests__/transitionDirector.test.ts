/**
 * Unit test suite for TransitionDirector.
 *
 * Verifies that the director synchronizes all 6 subsystems to the same
 * TimelineChannel, supports reduced motion, manages step and scrub operations,
 * fires lifecycle callbacks, and cleans up on disposal.
 */

import { describe, expect, it, vi } from 'vitest';
import type { AudioEngine } from '../../audio/audioEngine';
import type { EraSystem, TimelineChannel } from '../../era/types';
import { createTimelineController } from '../../state/timelineStore';
import {
  createTransitionDirector,
  type WorldSystems,
} from '../transitionDirector';

function createMockSystem(): EraSystem<unknown> & {
  updateCalls: TimelineChannel[];
  lastDt: number;
} {
  const updateCalls: TimelineChannel[] = [];
  let lastDt = 0;

  return {
    updateCalls,
    get lastDt() {
      return lastDt;
    },
    attach: vi.fn(),
    update: (channel: TimelineChannel, dt: number) => {
      updateCalls.push({ ...channel });
      lastDt = dt;
    },
    dispose: vi.fn(),
  };
}

function createMockAudioEngine(): AudioEngine & {
  updateCalls: Array<{ channel: TimelineChannel; dt: number; options?: unknown }>;
} {
  const updateCalls: Array<{ channel: TimelineChannel; dt: number; options?: unknown }> = [];

  return {
    updateCalls,
    context: {} as AudioContext,
    isSuspended: () => false,
    resume: vi.fn().mockResolvedValue(undefined),
    isMuted: () => false,
    setMuted: vi.fn(),
    getVolume: () => 0.8,
    setVolume: vi.fn(),
    getBusVolume: () => 0.8,
    setBusVolume: vi.fn(),
    getChannel: () => ({ fromEra: '1945', toEra: '1945', t: 0 }),
    getEraWeights: () => ({ '1945': 1, '1965': 0, '1985': 0, '2005': 0, '2025': 0 }),
    sfx: {} as any,
    triggerWhoosh: vi.fn(),
    triggerCarPassBy: vi.fn(),
    triggerHorn: vi.fn(),
    attach: vi.fn(),
    update: (channel: TimelineChannel, dt: number, options?: unknown) => {
      updateCalls.push({ channel: { ...channel }, dt, options });
    },
    dispose: vi.fn(),
  };
}

describe('TransitionDirector', () => {
  it('instantiates with initial era state and exposes timeline properties', () => {
    const controller = createTimelineController({ initialEra: '1945' });
    const mockBuildings = createMockSystem();
    const mockSignage = createMockSystem();
    const mockVehicles = createMockSystem();
    const mockPedestrians = createMockSystem();
    const mockAtmosphere = createMockSystem();
    const mockAudio = createMockAudioEngine();

    const systems: WorldSystems = {
      buildings: mockBuildings,
      signage: mockSignage,
      vehicles: mockVehicles,
      pedestrians: mockPedestrians,
      atmosphere: mockAtmosphere,
    };

    const director = createTransitionDirector(controller, systems, mockAudio, {
      duration: 1.4,
    });

    expect(director.getCurrentEra()).toBe('1945');
    expect(director.getChannel()).toEqual({ fromEra: '1945', toEra: '1945', t: 0 });
    expect(director.isTransitioning()).toBe(false);
    expect(director.isScrubbing()).toBe(false);
    expect(director.getGlobalProgress()).toBe(0);
    expect(director.getDuration()).toBe(1.4);
    expect(director.isReducedMotion()).toBe(false);
  });

  it('drives synchronized updates across all 5 world systems and audio on each frame', () => {
    const controller = createTimelineController({ initialEra: '1945', transitionDuration: 1.0 });
    const mockBuildings = createMockSystem();
    const mockSignage = createMockSystem();
    const mockVehicles = createMockSystem();
    const mockPedestrians = createMockSystem();
    const mockAtmosphere = createMockSystem();
    const mockAudio = createMockAudioEngine();

    const systems: WorldSystems = {
      buildings: mockBuildings,
      signage: mockSignage,
      vehicles: mockVehicles,
      pedestrians: mockPedestrians,
      atmosphere: mockAtmosphere,
    };

    const onStart = vi.fn();
    const onEnd = vi.fn();

    const director = createTransitionDirector(controller, systems, mockAudio, {
      duration: 1.0,
      onTransitionStart: onStart,
      onTransitionEnd: onEnd,
    });

    // Start transition to 1965
    director.transitionTo('1965');
    expect(director.isTransitioning()).toBe(true);

    // Advance 0.5s (halfway)
    director.update(0.5);

    expect(mockBuildings.updateCalls).toHaveLength(1);
    expect(mockSignage.updateCalls).toHaveLength(1);
    expect(mockVehicles.updateCalls).toHaveLength(1);
    expect(mockPedestrians.updateCalls).toHaveLength(1);
    expect(mockAtmosphere.updateCalls).toHaveLength(1);
    expect(mockAudio.updateCalls).toHaveLength(1);

    // All systems must have received the exact same channel values
    const bChan = mockBuildings.updateCalls[0];
    const sChan = mockSignage.updateCalls[0];
    const vChan = mockVehicles.updateCalls[0];
    const pChan = mockPedestrians.updateCalls[0];
    const aChan = mockAtmosphere.updateCalls[0];
    const audChan = mockAudio.updateCalls[0].channel;

    expect(bChan.fromEra).toBe('1945');
    expect(bChan.toEra).toBe('1965');
    expect(bChan.t).toBeCloseTo(0.5, 2);

    expect(sChan).toEqual(bChan);
    expect(vChan).toEqual(bChan);
    expect(pChan).toEqual(bChan);
    expect(aChan).toEqual(bChan);
    expect(audChan).toEqual(bChan);

    // Advance to finish transition
    director.update(0.6);
    expect(director.isTransitioning()).toBe(false);
    expect(director.getCurrentEra()).toBe('1965');
    expect(onEnd).toHaveBeenCalledWith('1965');
  });

  it('supports reduced motion mode with immediate jumps', () => {
    const controller = createTimelineController({ initialEra: '1945' });
    const mockBuildings = createMockSystem();
    const mockSignage = createMockSystem();
    const mockVehicles = createMockSystem();
    const mockPedestrians = createMockSystem();
    const mockAtmosphere = createMockSystem();

    const systems: WorldSystems = {
      buildings: mockBuildings,
      signage: mockSignage,
      vehicles: mockVehicles,
      pedestrians: mockPedestrians,
      atmosphere: mockAtmosphere,
    };

    const director = createTransitionDirector(controller, systems, null, {
      reducedMotion: true,
    });

    expect(director.isReducedMotion()).toBe(true);

    director.transitionTo('1985');
    // In reduced motion, transition finishes immediately
    expect(director.getCurrentEra()).toBe('1985');
    expect(director.isTransitioning()).toBe(false);
    expect(director.getChannel()).toEqual({ fromEra: '1985', toEra: '1985', t: 0 });

    // Dynamic reduced motion toggle
    director.setReducedMotion(false);
    expect(director.isReducedMotion()).toBe(false);
    director.transitionTo('2025');
    expect(director.isTransitioning()).toBe(true);
  });

  it('supports step and scrub operations', () => {
    const controller = createTimelineController({ initialEra: '1945' });
    const mockBuildings = createMockSystem();
    const mockSignage = createMockSystem();
    const mockVehicles = createMockSystem();
    const mockPedestrians = createMockSystem();
    const mockAtmosphere = createMockSystem();

    const systems: WorldSystems = {
      buildings: mockBuildings,
      signage: mockSignage,
      vehicles: mockVehicles,
      pedestrians: mockPedestrians,
      atmosphere: mockAtmosphere,
    };

    const director = createTransitionDirector(controller, systems, null);

    // Step forward
    const stepped = director.step(1);
    expect(stepped).toBe(true);
    expect(director.isTransitioning()).toBe(true);

    // Scrub directly (0.625 is midway between 1985 and 2005)
    director.scrubTo(0.625);
    expect(director.getChannel().fromEra).toBe('1985');
    expect(director.getChannel().toEra).toBe('2005');
    expect(director.getChannel().t).toBeCloseTo(0.5, 2);

    // Change duration
    director.setDuration(2.0);
    expect(director.getDuration()).toBe(2.0);

    // Teardown
    director.dispose();
    expect(() => director.dispose()).not.toThrow();
  });
});
