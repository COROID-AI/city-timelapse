import { describe, expect, it } from 'vitest';
import {
  clamp,
  easeInOut,
  hexToRgb,
  lerpColor,
  lerpColorInt,
  lerpNumber,
  lerpVector3,
  normalize,
  rgbToHex,
  rgbToHexInt,
} from '../transition';

describe('easeInOut', () => {
  it('returns 0 for t <= 0 and 1 for t >= 1', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(-0.5)).toBe(0);
    expect(easeInOut(-100)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(1.5)).toBe(1);
    expect(easeInOut(100)).toBe(1);
  });

  it('is symmetric around t = 0.5', () => {
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(0.25)).toBeCloseTo(1 - easeInOut(0.75), 6);
    expect(easeInOut(0.1)).toBeCloseTo(1 - easeInOut(0.9), 6);
  });

  it('accelerates in first half and decelerates in second half (cubic)', () => {
    // at t=0.25, 4 * (0.25)^3 = 0.0625
    expect(easeInOut(0.25)).toBeCloseTo(0.0625, 6);
    // at t=0.75, 1 - 0.0625 = 0.9375
    expect(easeInOut(0.75)).toBeCloseTo(0.9375, 6);
  });

  it('is monotonically increasing', () => {
    const samples = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1.0];
    for (let i = 1; i < samples.length; i++) {
      expect(easeInOut(samples[i])).toBeGreaterThanOrEqual(easeInOut(samples[i - 1]));
    }
  });
});

describe('lerpNumber', () => {
  it('interpolates numbers accurately with default clamping', () => {
    expect(lerpNumber(10, 20, 0)).toBe(10);
    expect(lerpNumber(10, 20, 0.5)).toBe(15);
    expect(lerpNumber(10, 20, 1)).toBe(20);
    expect(lerpNumber(10, 20, -1)).toBe(10); // clamped
    expect(lerpNumber(10, 20, 2)).toBe(20); // clamped
  });

  it('handles unclamped interpolation when clamp = false', () => {
    expect(lerpNumber(10, 20, 1.5, false)).toBe(25);
    expect(lerpNumber(10, 20, -0.5, false)).toBe(5);
  });

  it('handles identical start and end values', () => {
    expect(lerpNumber(42, 42, 0.5)).toBe(42);
    expect(lerpNumber(0, 0, 0.7)).toBe(0);
  });

  it('handles negative numbers', () => {
    expect(lerpNumber(-10, 10, 0.5)).toBe(0);
    expect(lerpNumber(-50, -10, 0.5)).toBe(-30);
  });

  it('handles NaN/Infinity inputs gracefully', () => {
    expect(lerpNumber(NaN, 10, 0.5)).toBe(0);
    expect(lerpNumber(10, Infinity, 0.5)).toBe(0);
    expect(lerpNumber(10, 20, NaN)).toBe(10);
  });
});

describe('clamp and normalize', () => {
  it('clamps values correctly', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(NaN, 0, 10)).toBe(0);
  });

  it('normalizes values to [0, 1]', () => {
    expect(normalize(50, 0, 100)).toBe(0.5);
    expect(normalize(0, 0, 100)).toBe(0);
    expect(normalize(100, 0, 100)).toBe(1);
    expect(normalize(-20, 0, 100)).toBe(0);
    expect(normalize(150, 0, 100)).toBe(1);
    expect(normalize(50, 50, 50)).toBe(0); // min === max
  });
});

describe('hexToRgb, rgbToHex and rgbToHexInt', () => {
  it('parses standard 6-digit hex strings', () => {
    expect(hexToRgb('#ff8800')).toEqual({ r: 255, g: 136, b: 0 });
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('parses 3-digit shorthand hex strings', () => {
    expect(hexToRgb('#f80')).toEqual({ r: 255, g: 136, b: 0 });
    expect(hexToRgb('0f0')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('parses numeric hex literals', () => {
    expect(hexToRgb(0xff8800)).toEqual({ r: 255, g: 136, b: 0 });
    expect(hexToRgb(0x00ff00)).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb(0x000000)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('handles invalid hex input by falling back to black', () => {
    expect(hexToRgb('not-a-color')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb(null as unknown as string)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('formats RGB to hex string and integer correctly', () => {
    expect(rgbToHex({ r: 255, g: 136, b: 0 })).toBe('#ff8800');
    expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00ff00');
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');

    expect(rgbToHexInt({ r: 255, g: 136, b: 0 })).toBe(0xff8800);
    expect(rgbToHexInt({ r: 0, g: 255, b: 0 })).toBe(0x00ff00);
  });
});

describe('lerpColor and lerpColorInt', () => {
  it('interpolates colors between 0.0, 0.5, 1.0', () => {
    const red = '#ff0000';
    const blue = '#0000ff';

    expect(lerpColor(red, blue, 0)).toBe('#ff0000');
    expect(lerpColor(red, blue, 1)).toBe('#0000ff');
    expect(lerpColor(red, blue, 0.5)).toBe('#800080');
  });

  it('clamps t to [0, 1]', () => {
    const white = '#ffffff';
    const black = '#000000';

    expect(lerpColor(white, black, -0.5)).toBe('#ffffff');
    expect(lerpColor(white, black, 1.5)).toBe('#000000');
  });

  it('interpolates numeric color representations', () => {
    const white = 0xffffff;
    const black = 0x000000;

    expect(lerpColorInt(white, black, 0)).toBe(0xffffff);
    expect(lerpColorInt(white, black, 1)).toBe(0x000000);
    expect(lerpColorInt(white, black, 0.5)).toBe(0x808080);
  });

  it('interpolates identical colors to the same color', () => {
    expect(lerpColor('#3b82f6', '#3b82f6', 0.5)).toBe('#3b82f6');
  });
});

describe('lerpVector3', () => {
  it('interpolates 3D vector coordinates linearly', () => {
    const vA = [0, 10, 20] as const;
    const vB = [10, 20, 40] as const;

    expect(lerpVector3(vA, vB, 0)).toEqual([0, 10, 20]);
    expect(lerpVector3(vA, vB, 0.5)).toEqual([5, 15, 30]);
    expect(lerpVector3(vA, vB, 1)).toEqual([10, 20, 40]);
  });

  it('clamps t in vector interpolation', () => {
    const vA = [0, 0, 0] as const;
    const vB = [10, 10, 10] as const;

    expect(lerpVector3(vA, vB, -1)).toEqual([0, 0, 0]);
    expect(lerpVector3(vA, vB, 2)).toEqual([10, 10, 10]);
  });
});
