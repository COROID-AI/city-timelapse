import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NitrousSystem } from '../src/game/nitrous.js';
import { CONFIG } from '../src/game/config.js';

function newSystem(charge = 0) {
  const s = new NitrousSystem(CONFIG);
  s.charge = charge;
  return s;
}

test('drifting adds nitrous charge up to capacity', () => {
  const s = newSystem();
  // 1 unit of slip for 10 seconds at chargePerSlip 8 => 80 charge.
  s.addSlip(1.0, 10);
  assert.equal(s.charge, 80);
  // Push past capacity -> clamps at 100.
  s.addSlip(1.0, 10);
  assert.equal(s.charge, CONFIG.nitrous.capacity);
  assert.equal(s.fraction, 1);
});

test('drifting while boosting does not charge', () => {
  const s = newSystem(50);
  s.boosting = true;
  s.addSlip(1.0, 10);
  assert.equal(s.charge, 50);
});

test('activation consumes charge over time while boosting', () => {
  const s = newSystem(50);
  const mult = s.update(1.0, true);
  assert.equal(mult, 1); // active
  s.update(1.0, true);
  // 50 - 2 * 45 = -40 -> clamped to 0 and boost stops on exhaustion step.
  assert.equal(s.charge, 0);
});

test('boost blocked when tank is empty or below threshold', () => {
  const s = newSystem(0);
  assert.equal(s.update(1.0, true), 0);
  assert.equal(s.boosting, false);

  const low = newSystem(CONFIG.nitrous.canBoostThreshold - 1);
  assert.equal(low.update(1.0, true), 0);
  assert.equal(low.boosting, false);
});

test('passive hold decays charge when not requested', () => {
  const s = newSystem(40);
  s.update(1.0, false);
  // 40 - 4 = 36 (chargeDecay per second).
  assert.equal(s.charge, 36);
});

test('charge can be re-filled via drift after boost ends', () => {
  const s = newSystem(0);
  s.update(1.0, true); // empty tank: no boost, stays 0
  s.addSlip(1.0, 5);
  assert.equal(s.charge, 40);
  assert.ok(s.charge >= CONFIG.nitrous.canBoostThreshold);
  // Activate with a short step so the tank is not drained dry.
  s.update(0.1, true);
  assert.equal(s.boosting, true);
  assert.ok(s.charge < 40);
});

test('reset clears charge and boost flag', () => {
  const s = newSystem(60);
  s.update(1.0, true);
  s.reset();
  assert.equal(s.charge, 0);
  assert.equal(s.boosting, false);
});