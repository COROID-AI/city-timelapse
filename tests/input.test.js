import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardState, controlsFromState } from '../src/game/input.js';

function evt(code) {
  return { code, repeat: false, preventDefault() {} };
}

test('arrow keys map to throttle/brake/steer', () => {
  const kb = new KeyboardState();
  kb.handleKeyDown(evt('ArrowUp'));
  kb.handleKeyDown(evt('ArrowRight'));
  assert.equal(kb.state.throttle, true);
  assert.equal(kb.state.right, true);
  const c = controlsFromState(kb.state);
  assert.equal(c.throttle, true);
  assert.equal(c.steer, 1);

  kb.handleKeyDown(evt('ArrowLeft'));
  assert.equal(controlsFromState(kb.state).steer, 0); // right - left = 0

  kb.handleKeyUp(evt('ArrowRight'));
  assert.equal(controlsFromState(kb.state).steer, -1);
});

test('Space maps to handbrake', () => {
  const kb = new KeyboardState();
  kb.handleKeyDown(evt(' '));
  assert.equal(kb.state.handbrake, true);
  kb.handleKeyUp(evt(' '));
  assert.equal(kb.state.handbrake, false);
});

test('Shift/KeyX both map to nitrous', () => {
  const kb = new KeyboardState();
  kb.handleKeyDown(evt('Shift'));
  assert.equal(kb.state.nitro, true);
  kb.handleKeyUp(evt('Shift'));
  assert.equal(kb.state.nitro, false);
  kb.handleKeyDown(evt('KeyX'));
  assert.equal(kb.state.nitro, true);
});

test('key release clears the mapped state', () => {
  const kb = new KeyboardState();
  kb.handleKeyDown(evt('ArrowUp'));
  kb.handleKeyUp(evt('ArrowUp'));
  assert.equal(kb.state.throttle, false);
});

test('repeated keydown is idempotent', () => {
  const kb = new KeyboardState();
  kb.handleKeyDown(evt('ArrowUp'));
  kb.handleKeyDown(evt('ArrowUp'));
  kb.handleKeyDown(evt({ ...evt('ArrowUp'), repeat: true }));
  assert.equal(kb.state.throttle, true);
});

test('unmapped keys are ignored', () => {
  const kb = new KeyboardState();
  kb.handleKeyDown(evt('KeyQ'));
  assert.deepEqual(kb.state, {
    throttle: false,
    brake: false,
    left: false,
    right: false,
    handbrake: false,
    nitro: false,
  });
});

test('game keys call preventDefault; non-game keys do not', () => {
  let count = 0;
  const kb = new KeyboardState();
  const myEvt = { code: 'ArrowUp', repeat: false, preventDefault: () => count++ };
  kb.handleKeyDown(myEvt);
  assert.equal(count, 1);
  kb.handleKeyDown({ code: 'KeyQ', repeat: false, preventDefault: () => count++ });
  assert.equal(count, 1);
});