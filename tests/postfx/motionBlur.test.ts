/**
 * Unit tests for the motion-blur post-processing pass.
 *
 * Covers the pure intensity curve (`computeDamp`: scales with speed and
 * peaks during boost) and the pass's dispose contract. The AfterimagePass is
 * mocked so the test never needs a WebGL context or an ESM build step.
 */
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';

import {
  computeDamp,
  createMotionBlurPass,
  defaultMotionBlurOptions,
} from '../../src/postfx/motionBlur';

jest.mock('three/addons/postprocessing/AfterimagePass.js', () => {
  class MockAfterimagePass {
    private _damp: number;
    disposed = false;
    constructor(damp = 0.96) {
      this._damp = damp;
    }
    set damp(v: number) {
      this._damp = v;
    }
    get damp(): number {
      return this._damp;
    }
    dispose(): void {
      this.disposed = true;
    }
  }
  return { AfterimagePass: MockAfterimagePass };
});

describe('computeDamp — speed/boost-scaled motion-blur intensity', () => {
  it('is weakest (highest damp) at idle with no boost', () => {
    const damp = computeDamp(0, 0);
    expect(damp).toBe(defaultMotionBlurOptions.idleDamp);
  });

  it('strengthens the trail as speed rises (lower damp)', () => {
    const atSpeed = computeDamp(defaultMotionBlurOptions.speedMax, 0);
    expect(atSpeed).toBeLessThan(computeDamp(0, 0));
    expect(atSpeed).toBeCloseTo(defaultMotionBlurOptions.speedDamp, 6);
  });

  it('saturates the speed term at or above the speed max', () => {
    expect(computeDamp(999, 0)).toBeCloseTo(defaultMotionBlurOptions.speedDamp, 6);
  });

  it('peaks during boost (damp drops below the speed-only value)', () => {
    const speedOnly = computeDamp(defaultMotionBlurOptions.speedMax, 0);
    const boosted = computeDamp(defaultMotionBlurOptions.speedMax, 1);
    expect(boosted).toBeLessThan(speedOnly);
  });

  it('stays within [0, 1] for strong inputs', () => {
    const damp = computeDamp(999, 1);
    expect(damp).toBeGreaterThanOrEqual(0);
    expect(damp).toBeLessThanOrEqual(1);
  });
});

describe('createMotionBlurPass — afterimage wiring and disposal', () => {
  it('produces an AfterimagePass implementation to add to a composer', () => {
    const { pass } = createMotionBlurPass();
    expect(pass).toBeInstanceOf(AfterimagePass);
  });

  it('scales its damp toward the speed/boost target over frames', () => {
    const blur = createMotionBlurPass();
    const start = blur.getDamp();
    for (let i = 0; i < 60; i++) {
      blur.update(defaultMotionBlurOptions.speedMax, 1, 1 / 60);
    }
    expect(blur.getDamp()).toBeLessThan(start);
    expect(blur.getDamp()).toBeLessThan(defaultMotionBlurOptions.speedDamp);
  });

  it('dispose releases the underlying pass render targets/materials', () => {
    const blur = createMotionBlurPass();
    const icon = blur.pass as unknown as { disposed: boolean };
    blur.dispose();
    expect(icon.disposed).toBe(true);
  });
});