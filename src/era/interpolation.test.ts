import { describe, it, expect } from 'vitest'
import {
  clamp,
  lerp,
  smoothstep,
  smootherstep,
  remap,
  approach,
  variantAlpha,
} from '../era/math'
import {
  lerpColor,
  lerpPalette,
  sampleEraConfig,
  dominantEras,
  r,
  g,
  b,
} from '../era/interpolation'
import { ERA_COUNT, SCENE_CONFIG } from '../era/config'

describe('math: clamp', () => {
  it('clamps within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })
  it('clamps below min', () => {
    expect(clamp(-3, 0, 10)).toBe(0)
  })
  it('clamps above max', () => {
    expect(clamp(42, 0, 10)).toBe(10)
  })
  it('respects swapped-looking bounds literally', () => {
    expect(clamp(2, 5, 1)).toBe(5)
  })
})

describe('math: lerp', () => {
  it('interpolates at t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10)
  })
  it('interpolates at t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20)
  })
  it('interpolates at t=0.5', () => {
    expect(lerp(10, 20, 0.5)).toBe(15)
  })
  it('extrapolates when unclamped', () => {
    expect(lerp(0, 10, 2)).toBe(20)
  })
})

describe('math: smoothstep', () => {
  it('is 0 before edge0', () => {
    expect(smoothstep(0, 1, -1)).toBe(0)
  })
  it('is 1 after edge1', () => {
    expect(smoothstep(0, 1, 2)).toBe(1)
  })
  it('is 0.5 at midpoint with C1 continuity', () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5)
  })
  it('is monotonic increasing', () => {
    let prev = -Infinity
    for (let i = 0; i <= 20; i++) {
      const v = smoothstep(0, 1, i / 20)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('math: smootherstep', () => {
  it('is 0 before edge0', () => {
    expect(smootherstep(0, 1, -1)).toBe(0)
  })
  it('is 1 after edge1', () => {
    expect(smootherstep(0, 1, 2)).toBe(1)
  })
  it('is flatter near the ends than smoothstep', () => {
    // At t=0.2, smootherstep should be smaller than smoothstep (slower rise).
    expect(smootherstep(0, 1, 0.2)).toBeLessThan(smoothstep(0, 1, 0.2))
  })
})

describe('math: remap', () => {
  it('maps midpoint', () => {
    expect(remap(0.5, 0, 1, 0, 100)).toBe(50)
  })
  it('clamps to output range on overshoot', () => {
    expect(remap(2, 0, 1, 0, 100)).toBe(100)
  })
})

describe('math: approach', () => {
  it('reaches target when already within epsilon', () => {
    const out = approach(10, 10.0001, 6, 0.016)
    expect(out.done).toBe(true)
    expect(out.value).toBe(10.0001)
  })
  it('moves toward target and reports not done', () => {
    const out = approach(0, 10, 6, 0.016)
    expect(out.value).toBeGreaterThan(0)
    expect(out.value).toBeLessThan(10)
    expect(out.done).toBe(false)
  })
  it('converges to target over many steps', () => {
    let value = 0
    let done = false
    for (let i = 0; i < 1000; i++) {
      const res = approach(value, 5, 8, 0.016)
      value = res.value
      done = res.done
      if (done) break
    }
    expect(done).toBe(true)
    expect(value).toBeCloseTo(5, 3)
  })
})

describe('math: variantAlpha', () => {
  it('is 1 at the variant era index', () => {
    expect(variantAlpha(2, 2)).toBe(1)
  })
  it('crossfades to 0 at the neighbouring era', () => {
    expect(variantAlpha(3, 2)).toBe(0)
  })
  it('is ~0.5 at the midpoint between two eras', () => {
    expect(variantAlpha(2.5, 2)).toBeCloseTo(0.5)
  })
  it('clamps to 0 far away', () => {
    expect(variantAlpha(5, 0)).toBe(0)
  })
  it('keeps end-era variants visible on their closed side', () => {
    // 1945 (index 0) stays fully visible below 0 because the rise ramp clamps.
    expect(variantAlpha(0, 0)).toBe(1)
  })
  it('keeps the 2055 (index 5) variant visible on its closed side', () => {
    expect(variantAlpha(5, 5)).toBe(1)
  })
})

describe('interpolation: channel extraction', () => {
  it('extracts r/g/b', () => {
    expect(r(0xff8800)).toBe(255)
    expect(g(0xff8800)).toBe(136)
    expect(b(0xff8800)).toBe(0)
  })
})

describe('interpolation: lerpColor', () => {
  it('returns start at t=0', () => {
    expect(lerpColor(0x000000, 0xffffff, 0)).toBe(0x000000)
  })
  it('returns end at t=1', () => {
    expect(lerpColor(0x000000, 0xffffff, 1)).toBe(0xffffff)
  })
  it('interpolates midpoint grey', () => {
    expect(lerpColor(0x000000, 0xffffff, 0.5)).toBe(0x808080)
  })
  it('interpolates each channel independently', () => {
    const out = lerpColor(0xff0000, 0x00ff00, 0.5)
    expect(r(out)).toBe(128)
    expect(g(out)).toBe(128)
    expect(b(out)).toBe(0)
  })
})

describe('interpolation: lerpPalette', () => {
  it('produces equal-length output', () => {
    const out = lerpPalette([0x000000, 0xffffff], [0xff0000, 0x00ff00], 0.5)
    expect(out).toHaveLength(2)
  })
  it('wraps when source lengths differ', () => {
    const out = lerpPalette([0x000000], [0xff0000, 0x00ff00], 0)
    expect(out).toHaveLength(2)
    expect(out[0]).toBe(0x000000)
  })
})

describe('interpolation: sampleEraConfig', () => {
  it('returns exact era config at integer indices', () => {
    const cfg = sampleEraConfig(2)
    expect(cfg.skyTop).toBe(SCENE_CONFIG[2].skyTop)
    expect(cfg.bloom).toBe(SCENE_CONFIG[2].bloom)
  })
  it('interpolates scalar fields linearly at midpoint', () => {
    const cfg = sampleEraConfig(1.5)
    const expected = (SCENE_CONFIG[1].bloom + SCENE_CONFIG[2].bloom) / 2
    expect(cfg.bloom).toBeCloseTo(expected, 5)
  })
  it('interpolates colour fields component-wise at midpoint', () => {
    const cfg = sampleEraConfig(0.5)
    const expected = lerpColor(
      SCENE_CONFIG[0].sunColor,
      SCENE_CONFIG[1].sunColor,
      0.5,
    )
    expect(cfg.sunColor).toBe(expected)
  })
  it('clamps below 0', () => {
    const cfg = sampleEraConfig(-2)
    expect(cfg.skyTop).toBe(SCENE_CONFIG[0].skyTop)
  })
  it('clamps above max', () => {
    const cfg = sampleEraConfig(99)
    expect(cfg.skyTop).toBe(SCENE_CONFIG[ERA_COUNT - 1].skyTop)
  })
})

describe('interpolation: dominantEras', () => {
  it('returns the floor and ceil eras with weight on lo', () => {
    const d = dominantEras(2.25)
    expect(d.lo).toBe(2)
    expect(d.hi).toBe(3)
    expect(d.weight).toBeCloseTo(0.75)
  })
  it('handles the last era with lo===hi', () => {
    const d = dominantEras(5)
    expect(d.lo).toBe(5)
    expect(d.hi).toBe(5)
    expect(d.weight).toBe(1)
  })
})
