import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AiPacer, AiDriver } from '../src/game/ai.js';
import { Track } from '../src/game/track.js';
import { CarPhysics } from '../src/game/car.js';
import { RaceController } from '../src/game/race.js';
import { CONFIG } from '../src/game/config.js';

test('AiPacer slows down on sharp corners', () => {
  const p = new AiPacer(CONFIG, 1);
  const straight = p.targetSpeed(0, 0);
  const sharp = p.targetSpeed(1.4, 0);
  assert.ok(sharp < straight, 'sharp corner target speed should be lower');
  assert.ok(sharp >= p.cfg.minSpeed);
});

test('AiPacer is faster with higher skill', () => {
  const slow = new AiPacer(CONFIG, 0.8);
  const fast = new AiPacer(CONFIG, 1.2);
  assert.ok(fast.targetSpeed(0, 0) > slow.targetSpeed(0, 0));
});

test('AiPacer rubber-bands on gap sign and magnitude', () => {
  const p = new AiPacer(CONFIG, 1);
  const behind = p.targetSpeed(0, 0.05); // AI behind player -> push harder
  const ahead = p.targetSpeed(0, -0.05); // AI ahead -> ease off
  assert.ok(behind > ahead, 'lagging AI should target higher speed');
  const farBehind = p.targetSpeed(0, 0.1);
  assert.ok(farBehind >= behind);
});

test('AiPacer output stays within sane bounds', () => {
  const p = new AiPacer(CONFIG, 1.5);
  for (const sharp of [0, 0.3, 0.8, 1.5, 3]) {
    for (const gap of [-0.3, 0, 0.3]) {
      const s = p.targetSpeed(sharp, gap);
      assert.ok(s >= p.cfg.minSpeed);
      assert.ok(s <= p.cfg.baseSpeed * 1.25 + 0.001);
    }
  }
});

test('AiDriver steering decisions stay within sane clamp ranges', () => {
  const track = new Track();
  const race = new RaceController(CONFIG);
  const car = new CarPhysics();
  race.registerRacer('player');
  race.registerRacer('ai0');
  const pacer = new AiPacer(CONFIG, 1);
  const driver = new AiDriver(pacer, track, car, race, {
    id: 'ai0',
    lateralOffset: 0,
    routeStartFrac: 0,
  });
  driver.placeAtStart();
  const playerFrac = track.routeFracFor(car.position);
  for (let i = 0; i < 240; i++) {
    const r = driver.update(1 / 60, playerFrac, i);
    assert.ok(r.steerInput >= -1.0001 && r.steerInput <= 1.0001, 'steer clamped');
    assert.ok(r.throttle === 0 || r.throttle === 1);
    assert.ok(r.brake === 0 || r.brake === 1);
  }
});