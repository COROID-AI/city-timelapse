import { describe, expect, it } from 'vitest';
import { Color } from 'three';

import { TransformationEngine, applyEraBlend, easeInOutCubic } from '../TransformationEngine';
import type { EraTransformation, TransformationTarget } from '../TransformationEngine';

const DATA_1945: EraTransformation = {
  materialColor: 0x8b4513, // saddle brown
  emissiveColor: 0x111111,
  emissiveIntensity: 0.1,
  fogColor: 0x2f2f2f,
  fogDensity: 0.02,
  visible: true,
};

const DATA_2025: EraTransformation = {
  materialColor: 0x1e90ff, // dodger blue
  emissiveColor: 0x00ffff,
  emissiveIntensity: 1.5,
  fogColor: 0x0a0a20,
  fogDensity: 0.08,
  visible: false,
};

function makeTarget(): TransformationTarget {
  return {
    material: {
      color: new Color(),
      emissive: new Color(),
      emissiveIntensity: 0,
    },
    fog: {
      color: new Color(),
      density: 0,
    },
    visibility: { visible: true },
  };
}

describe('TransformationEngine — reaches target values', () => {
  it('applies the initial era directly before any transition', () => {
    const engine = new TransformationEngine({ duration: 1 });
    const target = makeTarget();
    engine.setEraData('1945', DATA_1945);
    engine.registerTarget(target);

    engine.update(0, '1945');

    expect(target.material?.color.getHex()).toBe(DATA_1945.materialColor);
    expect(target.material?.emissive?.getHex()).toBe(DATA_1945.emissiveColor);
    expect(target.material?.emissiveIntensity).toBeCloseTo(DATA_1945.emissiveIntensity);
    expect(target.fog?.color.getHex()).toBe(DATA_1945.fogColor);
    expect(target.fog?.density).toBeCloseTo(DATA_1945.fogDensity);
    expect(target.visibility?.visible).toBe(true);
  });

  it('blends toward the target era over the duration', () => {
    const engine = new TransformationEngine({ duration: 2 });
    const target = makeTarget();
    engine.setEraData('1945', DATA_1945);
    engine.setEraData('2025', DATA_2025);
    engine.registerTarget(target);

    // Start at 1945, then transition to 2025.
    engine.update(0, '1945');
    engine.update(1 / 60, '2025');

    // After 1 second of a 2s transition, the material color is halfway (eased).
    engine.update(1 - 1 / 60, '2025');
    expect(target.material?.color.getHex()).not.toBe(DATA_1945.materialColor);
    expect(target.material?.color.getHex()).not.toBe(DATA_2025.materialColor);
    expect(target.fog?.density).toBeGreaterThan(DATA_1945.fogDensity);
    expect(target.fog?.density).toBeLessThan(DATA_2025.fogDensity);
  });

  it('reaches the exact target values after the duration elapses', () => {
    const engine = new TransformationEngine({ duration: 1 });
    const target = makeTarget();
    engine.setEraData('1945', DATA_1945);
    engine.setEraData('2025', DATA_2025);
    engine.registerTarget(target);

    engine.update(0, '1945');
    engine.update(1 / 60, '2025');
    // Run the full duration.
    for (let i = 0; i < 60; i += 1) engine.update(1 / 60, '2025');

    expect(target.material?.color.getHex()).toBe(DATA_2025.materialColor);
    expect(target.material?.emissive?.getHex()).toBe(DATA_2025.emissiveColor);
    expect(target.material?.emissiveIntensity).toBeCloseTo(DATA_2025.emissiveIntensity);
    expect(target.fog?.color.getHex()).toBe(DATA_2025.fogColor);
    expect(target.fog?.density).toBeCloseTo(DATA_2025.fogDensity);
    expect(target.visibility?.visible).toBe(false);
  });

  it('visibility flips at the midpoint', () => {
    const engine = new TransformationEngine({ duration: 1 });
    const target = makeTarget();
    engine.setEraData('1945', DATA_1945);
    engine.setEraData('2025', DATA_2025);
    engine.registerTarget(target);

    engine.update(0, '1945');
    engine.update(1 / 60, '2025');
    // Just past the midpoint.
    engine.update(0.6, '2025');
    expect(target.visibility?.visible).toBe(false);
  });
});

describe('TransformationEngine — easing', () => {
  it('easeInOutCubic is smooth at both ends', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    // Derivative near the start is small (smooth onset).
    const h = 1e-4;
    const slopeStart = (easeInOutCubic(h) - easeInOutCubic(0)) / h;
    expect(slopeStart).toBeLessThan(0.01);
  });
});

describe('TransformationEngine — applyEraBlend', () => {
  it('interpolates colors channel-wise', () => {
    const target = makeTarget();
    applyEraBlend(DATA_1945, DATA_2025, 0.5, target);
    const mid = target.material?.color;
    expect(mid).toBeDefined();
    // 0x8b4513 → 0x1e90ff at t=0.5 (eased to 0.5 for easeInOutCubic).
    expect(mid!.r).toBeGreaterThan(0);
    expect(mid!.g).toBeGreaterThan(0);
    expect(mid!.b).toBeGreaterThan(0);
  });

  it('snaps visibility at the midpoint', () => {
    const target = makeTarget();
    applyEraBlend(DATA_1945, DATA_2025, 0.4, target);
    expect(target.visibility?.visible).toBe(true);
    applyEraBlend(DATA_1945, DATA_2025, 0.6, target);
    expect(target.visibility?.visible).toBe(false);
  });
});