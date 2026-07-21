import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore, ERA_COUNT, ERA_MAX } from './useSceneStore';

// Reset the store before each test for isolation.
beforeEach(() => {
  useSceneStore.setState({
    eraFloat: 0,
    targetEra: 0,
    isTransitioning: false,
    sfxEnabled: false,
    reducedMotion: false,
    cameraResetToken: 0,
    autoRotate: false,
  });
});

describe('useSceneStore — setEra', () => {
  it('sets targetEra and marks transitioning', () => {
    useSceneStore.getState().setEra(3);
    expect(useSceneStore.getState().targetEra).toBe(3);
    expect(useSceneStore.getState().isTransitioning).toBe(true);
  });

  it('clamps to valid era range', () => {
    useSceneStore.getState().setEra(-5);
    expect(useSceneStore.getState().targetEra).toBe(0);
    useSceneStore.getState().setEra(99);
    expect(useSceneStore.getState().targetEra).toBe(ERA_MAX);
  });

  it('snaps instantly when reducedMotion is on', () => {
    useSceneStore.getState().setReducedMotion(true);
    useSceneStore.getState().setEra(4);
    const s = useSceneStore.getState();
    expect(s.targetEra).toBe(4);
    expect(s.eraFloat).toBe(4); // snapped, no animation
    expect(s.isTransitioning).toBe(false);
  });
});

describe('useSceneStore — tick (transition relaxation)', () => {
  it('advances eraFloat toward targetEra over time', () => {
    useSceneStore.getState().setEra(2);
    expect(useSceneStore.getState().eraFloat).toBe(0);
    // tick with a small dt
    useSceneStore.getState().tick(0.5);
    expect(useSceneStore.getState().eraFloat).toBeGreaterThan(0);
    expect(useSceneStore.getState().eraFloat).toBeLessThan(2);
    expect(useSceneStore.getState().isTransitioning).toBe(true);
  });

  it('returns true while transitioning, false when settled', () => {
    useSceneStore.getState().setEra(1);
    const moving = useSceneStore.getState().tick(0.1);
    expect(moving).toBe(true);
    // advance enough to arrive
    useSceneStore.getState().tick(5);
    const done = useSceneStore.getState().tick(0.1);
    expect(done).toBe(false);
    expect(useSceneStore.getState().eraFloat).toBe(1);
    expect(useSceneStore.getState().isTransitioning).toBe(false);
  });

  it('does not overshoot the target', () => {
    useSceneStore.getState().setEra(2);
    // many large ticks
    for (let i = 0; i < 50; i++) useSceneStore.getState().tick(1);
    expect(useSceneStore.getState().eraFloat).toBeLessThanOrEqual(2);
    expect(useSceneStore.getState().eraFloat).toBe(2);
  });

  it('clamps dt to avoid huge jumps on tab refocus', () => {
    useSceneStore.getState().setEra(1);
    // dt far beyond a frame — should be clamped, not overshoot
    useSceneStore.getState().tick(100);
    expect(useSceneStore.getState().eraFloat).toBeLessThanOrEqual(1);
  });

  it('snaps instantly under reducedMotion', () => {
    useSceneStore.getState().setReducedMotion(true);
    useSceneStore.getState().setEra(3);
    const stillMoving = useSceneStore.getState().tick(0.01);
    expect(stillMoving).toBe(false);
    expect(useSceneStore.getState().eraFloat).toBe(3);
  });
});

describe('useSceneStore — SFX toggle', () => {
  it('toggles sfxEnabled', () => {
    expect(useSceneStore.getState().sfxEnabled).toBe(false);
    useSceneStore.getState().toggleSfx();
    expect(useSceneStore.getState().sfxEnabled).toBe(true);
    useSceneStore.getState().toggleSfx();
    expect(useSceneStore.getState().sfxEnabled).toBe(false);
  });

  it('setSfxEnabled sets directly', () => {
    useSceneStore.getState().setSfxEnabled(true);
    expect(useSceneStore.getState().sfxEnabled).toBe(true);
  });
});

describe('useSceneStore — reduced motion', () => {
  it('toggleReducedMotion flips the flag and snaps eraFloat', () => {
    useSceneStore.getState().setEra(2);
    useSceneStore.getState().toggleReducedMotion();
    expect(useSceneStore.getState().reducedMotion).toBe(true);
    expect(useSceneStore.getState().eraFloat).toBe(2); // snapped
  });
});

describe('useSceneStore — camera reset', () => {
  it('increments cameraResetToken', () => {
    const before = useSceneStore.getState().cameraResetToken;
    useSceneStore.getState().resetCamera();
    expect(useSceneStore.getState().cameraResetToken).toBe(before + 1);
  });
});

describe('useSceneStore — stepEra', () => {
  it('steps the target era by a delta', () => {
    useSceneStore.getState().setEra(2);
    useSceneStore.getState().stepEra(1);
    expect(useSceneStore.getState().targetEra).toBe(3);
    useSceneStore.getState().stepEra(-1);
    expect(useSceneStore.getState().targetEra).toBe(2);
  });

  it('clamps at boundaries', () => {
    useSceneStore.getState().setEra(0);
    useSceneStore.getState().stepEra(-1);
    expect(useSceneStore.getState().targetEra).toBe(0);
    useSceneStore.getState().setEra(ERA_MAX);
    useSceneStore.getState().stepEra(1);
    expect(useSceneStore.getState().targetEra).toBe(ERA_MAX);
  });
});

describe('useSceneStore — autoRotate', () => {
  it('setAutoRotate sets the flag', () => {
    useSceneStore.getState().setAutoRotate(true);
    expect(useSceneStore.getState().autoRotate).toBe(true);
  });
});

describe('useSceneStore — constants', () => {
  it('ERA_COUNT is 6', () => expect(ERA_COUNT).toBe(6));
  it('ERA_MAX is 5', () => expect(ERA_MAX).toBe(5));
});
