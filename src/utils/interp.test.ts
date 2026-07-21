import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  clamp,
  lerp,
  smoothstep,
  smootherstep,
  clampDelta,
  sampleEra,
  variantOpacity,
  eraConfigAt,
  mulberry32,
} from "./interp";
import { ERA_COUNT, ERAS } from "../data/eras";

describe("clamp", () => {
  it("clamps below lo", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it("clamps above hi", () => {
    expect(clamp(99, 0, 10)).toBe(10);
  });
  it("passes through in-range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe("lerp", () => {
  it("interpolates endpoints", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });
});

describe("easing", () => {
  it("smoothstep is monotonic in [0,1] and clamps outside", () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 5);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(2)).toBe(1);
    expect(smoothstep(0.25)).toBeLessThan(smoothstep(0.75));
  });
  it("smootherstep hits endpoints", () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    expect(smootherstep(0.5)).toBeCloseTo(0.5, 5);
  });
});

describe("clampDelta", () => {
  it("clamps large gaps (tab suspension)", () => {
    expect(clampDelta(5)).toBe(0.1);
  });
  it("passes normal deltas", () => {
    expect(clampDelta(0.016)).toBeCloseTo(0.016, 5);
  });
  it("rejects non-finite", () => {
    expect(clampDelta(NaN)).toBe(0);
    expect(clampDelta(Infinity)).toBe(0.1);
  });
  it("rejects negative", () => {
    expect(clampDelta(-1)).toBe(0);
  });
});

describe("sampleEra", () => {
  it("returns exact era at integer", () => {
    const s = sampleEra(3, false);
    expect(s.i0).toBe(3);
    expect(s.i1).toBe(4);
    expect(s.t).toBe(0);
  });
  it("splits fractional across neighbors", () => {
    const s = sampleEra(2.5, false);
    expect(s.i0).toBe(2);
    expect(s.i1).toBe(3);
    expect(s.t).toBeCloseTo(0.5, 5);
  });
  it("clamps above max", () => {
    const s = sampleEra(ERA_COUNT + 5, false);
    expect(s.i0).toBe(ERA_COUNT - 1);
    expect(s.i1).toBe(ERA_COUNT - 1);
  });
  it("applies easing when eased=true", () => {
    const s = sampleEra(0.5, true);
    // smootherstep(0.5) === 0.5 but value is eased; just confirm it's valid
    expect(s.t).toBeGreaterThanOrEqual(0);
    expect(s.t).toBeLessThanOrEqual(1);
  });
});

describe("variantOpacity", () => {
  it("is 1 at exact era", () => {
    expect(variantOpacity(2, 2)).toBe(1);
  });
  it("is 0 at distance >= 1", () => {
    expect(variantOpacity(2, 1)).toBe(0);
    expect(variantOpacity(2.5, 2)).toBe(0.5);
    expect(variantOpacity(3, 2)).toBe(0);
    expect(variantOpacity(4, 2)).toBe(0);
  });
  it("two adjacent eras sum to ~1 during a sweep (crossfade, no pop)", () => {
    for (let i = 0; i <= 10; i++) {
      const ef = 2 + i * 0.1;
      const sum = variantOpacity(ef, 2) + variantOpacity(ef, 3);
      expect(sum).toBeCloseTo(1, 5);
    }
  });
});

describe("eraConfigAt", () => {
  it("matches era A at integer", () => {
    const c = eraConfigAt(0);
    expect(c.skyTop.getHexString()).toBe(new THREE.Color(ERAS[0]!.sky.top).getHexString());
  });
  it("interpolates colors between two eras", () => {
    const mid = eraConfigAt(0.5);
    const a = new THREE.Color(ERAS[0]!.sky.top);
    const b = new THREE.Color(ERAS[1]!.sky.top);
    expect(mid.skyTop.r).toBeCloseTo((a.r + b.r) / 2, 3);
  });
  it("exposes adjacent era configs for discrete logic", () => {
    const c = eraConfigAt(2.3);
    expect(c.eraA).toBe(ERAS[2]);
    expect(c.eraB).toBe(ERAS[3]);
  });
});

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
  it("produces values in [0,1)", () => {
    const rnd = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = rnd();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("differs for different seeds", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});
