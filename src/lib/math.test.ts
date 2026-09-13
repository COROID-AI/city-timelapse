import { describe, expect, it } from 'vitest';
import { clamp, degreesToRadians, distance2, lerp, mapRange, smoothstep } from './math';

describe('lerp', () => {
  it('interpolates between endpoints', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(20, 30, -1)).toBe(10);
  });
});

describe('clamp', () => {
  it('clamps values into [min, max]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe('mapRange', () => {
  it('maps one range onto another', () => {
    expect(mapRange(0, 0, 100, 0, 1)).toBe(0);
    expect(mapRange(50, 0, 100, 0, 1)).toBeCloseTo(0.5);
    expect(mapRange(100, 0, 100, 0, 1)).toBe(1);
    expect(mapRange(25, 0, 100, -10, 10)).toBe(-5);
  });
});

describe('smoothstep', () => {
  it('fades with a smooth S-curve and clamps its input', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5);
    expect(smoothstep(0.25)).toBeLessThan(0.25);
    expect(smoothstep(0.75)).toBeGreaterThan(0.75);
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(2)).toBe(1);
  });
});

describe('distance2', () => {
  it('computes Euclidean distance between two points', () => {
    expect(distance2(0, 0, 3, 4)).toBe(5);
    expect(distance2(1, 1, 1, 1)).toBe(0);
  });
});

describe('degreesToRadians', () => {
  it('converts degrees to radians', () => {
    expect(degreesToRadians(0)).toBe(0);
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
    expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2);
  });
});