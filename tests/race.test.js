import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RaceController } from '../src/game/race.js';
import { CONFIG } from '../src/game/config.js';

function newRace() {
  const race = new RaceController(CONFIG);
  race.registerRacer('player');
  race.registerRacer('ai0');
  return race;
}

// Complete one lap for a racer: pass the half-lap checkpoint then wrap across
// the start line. Returns the racer state.
function completeLap(race, id) {
  race.updateProgress(id, 0.95); // sets the half-lap checkpoint (>= 0.5)
  return race.updateProgress(id, 0.02); // wraps across the line
}

test('registers racers and initializes to zero', () => {
  const race = newRace();
  assert.equal(race.racers.size, 2);
  for (const r of race.racers.values()) {
    assert.equal(r.laps, 0);
    assert.equal(r.progress, 0);
    assert.equal(r.finished, false);
  }
});

test('single lap requires a checkpoint before the line counts', () => {
  const race = newRace();
  // Dance near the start without passing the half-lap checkpoint -> no lap.
  race.updateProgress('player', 0.1);
  race.updateProgress('player', 0.05);
  assert.equal(race.racers.get('player').laps, 0);

  // Reach the half-lap checkpoint, then wrap across the line -> lap 1.
  const res = completeLap(race, 'player');
  assert.equal(res.lapChanged, true);
  assert.equal(race.racers.get('player').laps, 1);
});

test('reverse/cross spam without checkpoint cannot inflate laps', () => {
  const race = newRace();
  // Repeatedly dance near the start line below the half-lap checkpoint.
  for (let i = 0; i < 10; i++) {
    race.updateProgress('player', 0.1);
    race.updateProgress('player', 0.02);
  }
  assert.equal(race.racers.get('player').laps, 0);

  // Reach the checkpoint, but clear it so a wrap does NOT count a lap.
  race.updateProgress('player', 0.95);
  race.racers.get('player').checkpoint = false;
  const res = race.updateProgress('player', 0.02);
  assert.equal(res.lapChanged, false);
  assert.equal(race.racers.get('player').laps, 0);
});

test('finishes exactly at configured lap count (3)', () => {
  const race = newRace();
  const r = race.racers.get('player');
  for (let lap = 1; lap <= 3; lap++) {
    const res = completeLap(race, 'player');
    assert.equal(r.laps, lap);
    if (lap < 3) assert.equal(res.finished, false);
    else assert.equal(res.finished, true);
  }
  assert.equal(r.finished, true);
  // No lap 4.
  completeLap(race, 'player');
  assert.equal(r.laps, 3);
});

test('per-lap splits and total time accumulate via tick', () => {
  const race = newRace();
  for (let i = 0; i < 10; i++) race.tick(0.1); // 1.0s elapsed
  completeLap(race, 'player');
  race.tick(0.5);
  completeLap(race, 'player');
  const r = race.racers.get('player');
  assert.equal(r.lapTimes.length, 2);
  assert.ok(r.totalTime > 0);
  assert.ok(race.totalElapsed >= 1.499);
});

test('standings order: finished first, then laps, then progress', () => {
  const race = newRace();
  // ai0 finishes, player is mid-lap.
  for (let lap = 0; lap < CONFIG.race.laps; lap++) completeLap(race, 'ai0');
  race.updateProgress('player', 0.7);
  const [first, second] = race.standings();
  assert.equal(first.id, 'ai0'); // finished
  assert.equal(second.id, 'player');
});

test('reset clears all racing state', () => {
  const race = newRace();
  completeLap(race, 'player');
  race.updateProgress('player', 0.95);
  race.tick(2);
  race.reset();
  const r = race.racers.get('player');
  assert.equal(r.laps, 0);
  assert.equal(r.progress, 0);
  assert.equal(r.finished, false);
  assert.equal(race.totalElapsed, 0);
  assert.equal(race.completed, false);
});