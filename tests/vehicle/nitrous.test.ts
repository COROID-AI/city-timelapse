/**
 * Unit tests for the nitrous charge / discharge system.
 *
 * Covers accumulation from sustained drifting (up to max capacity), boost
 * consumption, speed multiplier, and exhaust flame intensity exposure.
 */

import {
  accumulateNitrous,
  consumeNitrous,
  createNitrous,
  defaultNitrous,
  stepNitrous,
} from '../../src/vehicle/nitrous';

describe('accumulateNitrous — drifting charges the canister', () => {
  it('starts empty and not ready', () => {
    const n = createNitrous();
    expect(n.charge).toBe(0);
    expect(n.ready).toBe(false);
    expect(n.boosting).toBe(false);
  });

  it('gains charge proportional to slide over time', () => {
    const n = createNitrous();
    const charged = accumulateNitrous(n, 1, 1, defaultNitrous);
    expect(charged.charge).toBeCloseTo(defaultNitrous.chargeRate);
  });

  it('never charges when not drifting (slide 0)', () => {
    const n = createNitrous();
    const charged = accumulateNitrous(n, 0, 1, defaultNitrous);
    expect(charged.charge).toBe(0);
  });

  it('caps at max capacity', () => {
    let n = createNitrous();
    for (let i = 0; i < 200; i++) {
      n = accumulateNitrous(n, 1, 1 / 60, defaultNitrous);
    }
    expect(n.charge).toBeLessThanOrEqual(defaultNitrous.capacity);
    expect(n.charge).toBeCloseTo(defaultNitrous.capacity, 6);
  });

  it('becomes ready at the boost requirement', () => {
    const full = accumulateNitrous(
      createNitrous(),
      1,
      10,
      defaultNitrous,
    );
    expect(full.charge).toBeGreaterThanOrEqual(defaultNitrous.boostRequirement);
    expect(full.ready).toBe(true);
  });
});

describe('consumeNitrous — boost discharge', () => {
  it('does nothing when the trigger is not held', () => {
    const n = { ...createNitrous(), charge: defaultNitrous.capacity };
    const out = consumeNitrous(n, false, 1 / 60, defaultNitrous);
    expect(out.boosting).toBe(false);
    expect(out.boostMultiplier).toBe(1);
  });

  it('starts a boost when the trigger is held with charge', () => {
    const n = { ...createNitrous(), charge: defaultNitrous.capacity };
    const out = consumeNitrous(n, true, 1 / 60, defaultNitrous);
    expect(out.boosting).toBe(true);
    expect(out.boostMultiplier).toBe(defaultNitrous.boostMultiplier);
    expect(out.boostMultiplier).toBeGreaterThan(1);
  });

  it('drains charge while boosting', () => {
    let n = { ...createNitrous(), charge: defaultNitrous.capacity };
    const before = n.charge;
    for (let i = 0; i < 10; i++) {
      n = consumeNitrous(n, true, 1 / 60, defaultNitrous);
    }
    expect(n.charge).toBeLessThan(before);
  });

  it('exposes exhaust flame intensity while boosting', () => {
    const n = { ...createNitrous(), charge: defaultNitrous.capacity };
    const out = consumeNitrous(n, true, 1 / 60, defaultNitrous);
    expect(out.exhaustFlame).toBeGreaterThan(0);
    expect(out.exhaustFlame).toBeLessThanOrEqual(1);
  });

  it('stops boosting once charge is spent', () => {
    let n = { ...createNitrous(), charge: 0.001 };
    n = consumeNitrous(n, true, 1, defaultNitrous);
    expect(n.boosting).toBe(false);
    expect(n.boostMultiplier).toBe(1);
  });

  it('fades the flame when the trigger is released', () => {
    const n = { ...createNitrous(), charge: defaultNitrous.capacity };
    const boosting = consumeNitrous(n, true, 1 / 60, defaultNitrous);
    expect(boosting.exhaustFlame).toBeGreaterThan(0);
    const released = consumeNitrous(boosting, false, 1 / 60, defaultNitrous);
    expect(released.exhaustFlame).toBeLessThan(boosting.exhaustFlame);
  });
});

describe('stepNitrous — full frame cycle', () => {
  it('charges from slide then consumes on trigger in one call', () => {
    let n = createNitrous();
    // Drift hard for a couple seconds to fill the canister.
    for (let i = 0; i < 120; i++) {
      n = stepNitrous(n, { slide: 1, boost: false }, 1 / 60, defaultNitrous);
    }
    expect(n.charge).toBeGreaterThanOrEqual(defaultNitrous.boostRequirement);
    expect(n.ready).toBe(true);

    // Now hold the trigger.
    n = stepNitrous(n, { slide: 0, boost: true }, 1 / 60, defaultNitrous);
    expect(n.boosting).toBe(true);
    expect(n.boostMultiplier).toBeGreaterThan(1);
  });
});