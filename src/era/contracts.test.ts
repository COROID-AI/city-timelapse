import { describe, expect, it } from 'vitest';
import { blendForPosition, easeInOutCubic } from './timeline';
import type { EraBlend } from './timeline';
import {
  ERA_MORPH_STAGES,
  EraMorphDriver,
  createEraTransformRegistry,
  createEraMorphSystem,
  stageIndex,
  stageOffset,
  stageProgress,
} from './contracts';
import type { EraMorphStage, EraTransformRegistry, EraTransformable } from './contracts';

interface RecordedFrame {
  blend: EraBlend;
  stageOffset: number;
  progress: number;
}

interface StubTransformable {
  target: EraTransformable;
  stage: EraMorphStage;
  frames: RecordedFrame[];
}

function createStub(stage: EraMorphStage): StubTransformable {
  const frames: RecordedFrame[] = [];
  const target: EraTransformable = {
    stage,
    applyEraBlend(blend, offset, progress) {
      frames.push({ blend, stageOffset: offset, progress });
    },
  };
  return { target, stage, frames };
}

/** Drive the system until idle, returning every frame produced. */
function driveUntilIdle(
  driver: EraMorphDriver,
  dt: number,
): Array<{ position: number; progress: number }> {
  const frames: Array<{ position: number; progress: number }> = [];
  let guard = 0;
  do {
    const frame = driver.advance(dt);
    frames.push({ position: frame.position, progress: frame.progress });
  } while (driver.isTransitioning && ++guard < 500);
  return frames;
}

describe('era morph stage choreography', () => {
  it('exposes the staged ordering facade -> signage -> fleet -> crowd -> lights -> sound', () => {
    expect([...ERA_MORPH_STAGES]).toEqual([
      'facade',
      'signage',
      'fleet',
      'crowd',
      'lights',
      'sound',
    ]);
    expect(stageIndex('facade')).toBe(0);
    expect(stageIndex('crowd')).toBe(3);
    expect(stageIndex('sound')).toBe(5);
  });

  it('assigns monotonically increasing stage offsets below 1', () => {
    const offsets = ERA_MORPH_STAGES.map((stage) => stageOffset(stage));
    for (let i = 1; i < offsets.length; i += 1) {
      expect(offsets[i]).toBeGreaterThan(offsets[i - 1]);
    }
    expect(stageOffset('facade')).toBe(0);
    expect(stageOffset('crowd')).toBeCloseTo(3 / 6, 10); // crowd is index 3
    expect(offsets[offsets.length - 1]).toBeLessThan(1);
  });

  it('staggers stage progress so facades move before the crowd', () => {
    for (const stage of ERA_MORPH_STAGES) {
      expect(stageProgress(stage, 0)).toBe(0);
      expect(stageProgress(stage, 1)).toBe(1);
    }

    // Early in the transition the facade is already moving; the crowd has not started.
    expect(stageProgress('facade', 0.2)).toBeGreaterThan(0);
    expect(stageProgress('crowd', 0.2)).toBe(0);
    expect(stageProgress('facade', 0.2)).toBeCloseTo(1, 10);

    // The crowd's window opens at 3/6 = 0.5, well after the facade finished
    // (the facade window ends at 1/6).
    expect(stageProgress('crowd', 0.45)).toBe(0);
    expect(stageProgress('crowd', 0.5)).toBe(0);
    expect(stageProgress('crowd', 0.7)).toBeGreaterThan(0);
  });

  it('produces monotonic stage progress for every stage', () => {
    for (const stage of ERA_MORPH_STAGES) {
      let previous = stageProgress(stage, 0);
      for (let i = 1; i <= 100; i += 1) {
        const value = stageProgress(stage, i / 100);
        expect(value).toBeGreaterThanOrEqual(previous - 1e-12);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
        previous = value;
      }
    }
  });

  it('clamps stage progress outside the transition range', () => {
    for (const stage of ERA_MORPH_STAGES) {
      expect(stageProgress(stage, -1)).toBe(0);
      expect(stageProgress(stage, 2)).toBe(1);
      expect(stageProgress(stage, Number.NaN)).toBe(0);
    }
  });
});

describe('EraTransformable registry', () => {
  it('registers, counts, and unregisters transformables', () => {
    const registry = createEraTransformRegistry();
    const facade = createStub('facade');
    const crowd = createStub('crowd');

    expect(registry.size).toBe(0);

    const unregisterFacade = registry.register(facade.target);
    registry.register(crowd.target);
    expect(registry.size).toBe(2);
    expect(registry.has(facade.target)).toBe(true);
    expect(registry.has(crowd.target)).toBe(true);

    // Duplicate registration is ignored.
    registry.register(facade.target);
    expect(registry.size).toBe(2);

    expect(registry.unregister(crowd.target)).toBe(true);
    expect(registry.unregister(crowd.target)).toBe(false);
    expect(registry.size).toBe(1);
    expect(registry.has(crowd.target)).toBe(false);

    unregisterFacade();
    expect(registry.size).toBe(0);
    expect(registry.has(facade.target)).toBe(false);
  });

  it('keeps members in choreography order regardless of insertion order', () => {
    const registry = createEraTransformRegistry();
    const crowd = createStub('crowd');
    const sound = createStub('sound');
    const facade = createStub('facade');
    const signage = createStub('signage');

    registry.register(crowd.target);
    registry.register(sound.target);
    registry.register(facade.target);
    registry.register(signage.target);

    expect(registry.members.map((member) => member.stage)).toEqual([
      'facade',
      'signage',
      'crowd',
      'sound',
    ]);
  });

  it('dispatches each frame to every member with its own stage offset and progress', () => {
    const registry = createEraTransformRegistry();
    const facade = createStub('facade');
    const crowd = createStub('crowd');
    registry.register(crowd.target);
    registry.register(facade.target);

    const blend: EraBlend = { from: 1985, to: 2005, fraction: 0.4 };
    const dispatched = registry.dispatch(blend, 0.25);

    expect(dispatched).toBe(2);
    expect(facade.frames).toHaveLength(1);
    expect(crowd.frames).toHaveLength(1);
    expect(facade.frames[0].blend).toEqual(blend);
    expect(crowd.frames[0].blend).toEqual(blend);
    expect(facade.frames[0].stageOffset).toBe(0);
    expect(crowd.frames[0].stageOffset).toBeCloseTo(3 / 6, 10);
    expect(facade.frames[0].progress).toBe(stageProgress('facade', 0.25));
    expect(crowd.frames[0].progress).toBe(0);

    // Unregistered members stop receiving frames.
    registry.unregister(crowd.target);
    registry.dispatch(blend, 0.5);
    expect(facade.frames).toHaveLength(2);
    expect(crowd.frames).toHaveLength(1);

    registry.clear();
    expect(registry.size).toBe(0);
    registry.dispatch(blend, 1);
    expect(facade.frames).toHaveLength(2);
  });

  it('works through the EraTransformable contract shape', () => {
    const registry: EraTransformRegistry = createEraTransformRegistry();
    const applied: Array<{ from: number; to: number; fraction: number; offset: number; progress: number }> = [];
    const object: EraTransformable = {
      stage: 'lights',
      applyEraBlend(blend, offset, progress) {
        applied.push({
          from: blend.from,
          to: blend.to,
          fraction: blend.fraction,
          offset,
          progress,
        });
      },
    };
    registry.register(object);
    registry.dispatch({ from: 1945, to: 1965, fraction: 0.75 }, 1);
    expect(applied).toHaveLength(1);
    expect(applied[0].from).toBe(1945);
    expect(applied[0].to).toBe(1965);
    expect(applied[0].fraction).toBe(0.75);
    expect(applied[0].offset).toBeCloseTo(stageOffset('lights'), 10);
    expect(applied[0].progress).toBe(1);
  });
});

describe('morph driver + registry integration (1945 -> 2025)', () => {
  it('delivers a continuous eased blend sequence to every object, with facades before crowd', () => {
    const { core, registry, driver } = createEraMorphSystem();
    expect(core.position).toBe(0);
    expect(core.selectedYear).toBe(1945);

    // Crowd registered first to prove ordering comes from stages, not insertion.
    const crowd = createStub('crowd');
    const facade = createStub('facade');
    registry.register(crowd.target);
    registry.register(facade.target);

    driver.transitionTo(2025);
    expect(driver.isTransitioning).toBe(true);
    expect(registry.members.map((member) => member.stage)).toEqual(['facade', 'crowd']);

    // The starting frame dispatches immediately at progress 0.
    expect(facade.frames).toHaveLength(1);
    expect(crowd.frames).toHaveLength(1);
    expect(facade.frames[0].progress).toBe(0);
    expect(crowd.frames[0].progress).toBe(0);
    expect(facade.frames[0].blend.from).toBe(1945);

    const dt = 0.05;
    const expectedPositions: number[] = [0];
    let elapsed = 0;
    let guard = 0;
    while (driver.isTransitioning && guard < 500) {
      elapsed += dt;
      const before = facade.frames.length;
      driver.advance(dt);
      // Per-frame notification: both objects advanced exactly one frame.
      expect(facade.frames.length).toBe(before + 1);
      expect(crowd.frames.length).toBe(before + 1);
      expectedPositions.push(easeInOutCubic(Math.min(1, elapsed / 1.5)));
      guard += 1;
    }

    expect(elapsed).toBeGreaterThanOrEqual(1);
    expect(elapsed).toBeLessThanOrEqual(2 + dt);
    expect(facade.frames.length).toBe(expectedPositions.length);
    expect(crowd.frames.length).toBe(expectedPositions.length);

    // Every delivered blend matches the eased curve at that tick: continuous,
    // monotone travel instead of a snap from 1945 straight to 2025.
    let previousPosition = expectedPositions[0];
    for (let k = 1; k < expectedPositions.length; k += 1) {
      const expectedPosition = expectedPositions[k];
      const expectedBlend = blendForPosition(expectedPosition);
      const recorded = facade.frames[k].blend;
      expect(recorded.from).toBe(expectedBlend.from);
      expect(recorded.to).toBe(expectedBlend.to);
      expect(recorded.fraction).toBeCloseTo(expectedBlend.fraction, 10);
      expect(crowd.frames[k].blend).toEqual(recorded);
      expect(expectedPosition).toBeGreaterThanOrEqual(previousPosition - 1e-12);
      expect(expectedPosition - previousPosition).toBeLessThan(0.1);
      previousPosition = expectedPosition;
    }

    // Early frames stay near the start (ease-in), far from the 2025 endpoint.
    expect(expectedPositions[1]).toBeLessThan(0.01);
    expect(facade.frames[1].blend.from).toBe(1945);
    expect(facade.frames[1].blend.fraction).toBeLessThan(0.2);

    // Facade starts moving long before the crowd.
    const facadeStart = facade.frames.findIndex((frame) => frame.progress > 0);
    const crowdStart = crowd.frames.findIndex((frame) => frame.progress > 0);
    expect(facadeStart).toBeGreaterThanOrEqual(0);
    expect(crowdStart).toBeGreaterThan(facadeStart);

    const earlyFrame = 5;
    expect(facade.frames[earlyFrame].progress).toBeGreaterThan(0);
    expect(crowd.frames[earlyFrame].progress).toBe(0);

    // Final frame: settled at 2025, every stage fully progressed.
    const finalFacade = facade.frames[facade.frames.length - 1];
    const finalCrowd = crowd.frames[crowd.frames.length - 1];
    expect(finalFacade.blend.from).toBe(2005);
    expect(finalFacade.blend.to).toBe(2025);
    expect(finalFacade.blend.fraction).toBeCloseTo(1, 10);
    expect(finalFacade.progress).toBe(1);
    expect(finalCrowd.progress).toBe(1);
    expect(finalFacade.stageOffset).toBe(0);
    expect(finalCrowd.stageOffset).toBeCloseTo(3 / 6, 10);

    // Idle ticks do not spam registered objects.
    const settledCount = facade.frames.length;
    driver.advance(dt);
    expect(facade.frames).toHaveLength(settledCount);
    expect(crowd.frames).toHaveLength(settledCount);
  });

  it('supports reverse transitions (2025 -> 1965) with continuous frames', () => {
    const { core, registry, driver } = createEraMorphSystem();
    const facade = createStub('facade');
    registry.register(facade.target);

    core.selectYear(2025);
    driver.transitionTo(1965, 1);
    expect(driver.isTransitioning).toBe(true);

    const frames = driveUntilIdle(driver, 0.05);
    expect(frames.length).toBeGreaterThanOrEqual(15);
    for (let i = 1; i < frames.length; i += 1) {
      expect(frames[i].position).toBeLessThanOrEqual(frames[i - 1].position + 1e-12);
      // Max eased slope is 3, so a 1s transition at dt=0.05 steps at most
      // ~0.15 downward per frame — continuous, never a snap.
      expect(frames[i].position - frames[i - 1].position).toBeGreaterThan(-0.16);
    }

    const final = facade.frames[facade.frames.length - 1];
    expect(final.blend.from).toBe(1965);
    expect(final.blend.to).toBe(1985);
    expect(final.blend.fraction).toBeCloseTo(0, 10);
    expect(final.progress).toBe(1);
    expect(core.position).toBeCloseTo(0.25, 10);
    expect(core.selectedYear).toBe(1965);
  });

  it('stops notifying unregistered objects mid-transition', () => {
    const { registry, driver } = createEraMorphSystem();
    const facade = createStub('facade');
    const crowd = createStub('crowd');
    registry.register(facade.target);
    registry.register(crowd.target);

    driver.transitionTo(2025);
    driver.advance(0.5);
    driver.advance(0.5);
    expect(crowd.frames.length).toBeGreaterThan(1);

    registry.unregister(crowd.target);
    const crowdCount = crowd.frames.length;
    const facadeCount = facade.frames.length;
    driveUntilIdle(driver, 0.05);

    expect(crowd.frames.length).toBe(crowdCount);
    expect(facade.frames.length).toBeGreaterThan(facadeCount);
    expect(facade.frames[facade.frames.length - 1].progress).toBe(1);
  });

  it('syncs newly registered objects to the current frame on demand', () => {
    const { core, registry, driver } = createEraMorphSystem();
    core.selectYear(2005);
    const lateFacade = createStub('facade');
    registry.register(lateFacade.target);

    expect(lateFacade.frames).toHaveLength(0);
    const dispatched = driver.sync();
    expect(dispatched).toBe(1);
    expect(lateFacade.frames).toHaveLength(1);
    expect(lateFacade.frames[0].blend.from).toBe(2005);
    expect(lateFacade.frames[0].blend.to).toBe(2025);
    expect(lateFacade.frames[0].blend.fraction).toBeCloseTo(0, 10);
    expect(lateFacade.frames[0].progress).toBe(1); // idle: state fully applied
  });

  it('keeps the driver, core, and registry wired together', () => {
    const system = createEraMorphSystem();
    expect(system.driver.core).toBe(system.core);
    expect(system.driver.registry).toBe(system.registry);
    expect(system.registry.size).toBe(0);
    expect(system.driver.isTransitioning).toBe(false);
    expect(system.driver.transitionTo(1985)).toBe(1985);
    expect(system.core.selectedYear).toBe(1985);
    expect(system.driver.isTransitioning).toBe(true);
    expect(system.core.transitionDurationSeconds).toBeGreaterThanOrEqual(1);
    expect(system.core.transitionDurationSeconds).toBeLessThanOrEqual(2);
    expect(system.driver).toBeInstanceOf(EraMorphDriver);
  });
});
