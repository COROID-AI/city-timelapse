/**
 * Semantic keyboard input tests.
 *
 * createInput/actionForKey are exercised against a fake event target that
 * receives synthetic KeyboardEvents produced inline — no real keyboard, no
 * DOM, no timers.
 */
import { createInput, actionForKey } from '../src/core/input.js';

/** Minimal event target accepting addEventListener/removeEventListener. */
class FakeEventTarget {
  constructor() {
    this.handlers = new Map();
  }
  addEventListener(type, handler) {
    this.handlers.set(type, handler);
  }
  removeEventListener(type, handler) {
    this.handlers.delete(type);
  }
  fire(type, event) {
    const handler = this.handlers.get(type);
    if (handler) handler(event);
  }
}

/** Synthetic KeyboardEvent carrying only what the module needs. */
function keyEvent(code, key) {
  let prevented = false;
  return {
    code,
    key,
    preventDefault() {
      prevented = true;
    },
    get prevented() {
      return prevented;
    },
  };
}

/** Key down + key up for one physical key. */
function press(input, target, code, key) {
  target.fire('keydown', keyEvent(code, key));
  target.fire('keyup', keyEvent(code, key));
}

describe('actionForKey mapping', () => {
  test.each([
    ['ArrowLeft', null, 'left'],
    ['ArrowRight', null, 'right'],
    ['ArrowDown', null, 'down'],
    ['ArrowUp', null, 'jump'],
    ['Space', ' ', 'jump'],
    ['KeyW', 'w', 'jump'],
    ['KeyZ', 'z', 'jump'],
    ['ShiftLeft', 'Shift', 'run'],
    ['ShiftRight', 'Shift', 'run'],
    ['KeyX', 'x', 'run'],
    ['Enter', 'Enter', 'start'],
    ['KeyP', 'p', 'start'],
  ])('code %s -> %s', (code, key, action) => {
    expect(actionForKey({ code, key })).toBe(action);
  });

  test('falls back to KeyboardEvent.key when code is absent', () => {
    expect(actionForKey({ key: 'ArrowLeft' })).toBe('left');
    expect(actionForKey({ key: 'd' })).toBe('right');
    expect(actionForKey({ key: 's' })).toBe('down');
    expect(actionForKey({ key: ' ' })).toBe('jump');
    expect(actionForKey({ key: 'Shift' })).toBe('run');
    expect(actionForKey({ key: 'x' })).toBe('run');
    expect(actionForKey({ key: 'p' })).toBe('start');
  });

  test('returns null for non-game keys', () => {
    expect(actionForKey({ code: 'KeyQ', key: 'q' })).toBeNull();
    expect(actionForKey({ code: 'Digit1', key: '1' })).toBeNull();
    expect(actionForKey({})).toBeNull();
  });
});

describe('createInput edge behavior', () => {
  test('isDown and wasPressed track a jump press until endFrame clears the edge', () => {
    const target = new FakeEventTarget();
    const input = createInput({ target });
    input.attach();

    expect(input.isDown('jump')).toBe(false);
    expect(input.wasPressed('jump')).toBe(false);

    target.fire('keydown', keyEvent('Space', ' '));
    expect(input.isDown('jump')).toBe(true);
    expect(input.wasPressed('jump')).toBe(true);

    input.endFrame();
    expect(input.wasPressed('jump')).toBe(false);
    expect(input.isDown('jump')).toBe(true); // hold persists

    target.fire('keyup', keyEvent('Space', ' '));
    expect(input.isDown('jump')).toBe(false);

    input.detach();
  });

  test('auto-repeat keydown does not re-arm the press edge', () => {
    const target = new FakeEventTarget();
    const input = createInput({ target });
    input.attach();

    const key = keyEvent('Space', ' ');
    target.fire('keydown', key);
    target.fire('keydown', key); // OS key auto-repeat
    expect(input.wasPressed('jump')).toBe(true);

    input.endFrame();
    target.fire('keydown', key);
    expect(input.wasPressed('jump')).toBe(false); // no new edge

    target.fire('keyup', key);
    input.detach();
  });

  test('two keys on one action release independently', () => {
    const target = new FakeEventTarget();
    const input = createInput({ target });
    input.attach();

    target.fire('keydown', keyEvent('KeyW', 'w'));
    target.fire('keydown', keyEvent('KeyZ', 'z'));
    expect(input.isDown('jump')).toBe(true);
    expect(input.wasPressed('jump')).toBe(true);

    input.endFrame();
    target.fire('keyup', keyEvent('KeyW', 'w')); // release only W
    expect(input.isDown('jump')).toBe(true); // Z still held

    target.fire('keyup', keyEvent('KeyZ', 'z'));
    expect(input.isDown('jump')).toBe(false);

    input.detach();
  });

  test('holding while pressing a second key arms the edge only once', () => {
    const target = new FakeEventTarget();
    const input = createInput({ target });
    input.attach();

    target.fire('keydown', keyEvent('KeyW', 'w'));
    target.fire('keydown', keyEvent('KeyZ', 'z'));
    expect(input.wasPressed('jump')).toBe(true); // one edge for the action

    input.endFrame();
    input.detach();
  });

  test('blur clears held state without a matching keyup', () => {
    const target = new FakeEventTarget();
    const input = createInput({ target });
    input.attach();

    target.fire('keydown', keyEvent('ArrowRight', 'ArrowRight'));
    expect(input.isDown('right')).toBe(true);

    target.fire('blur', {});
    expect(input.isDown('right')).toBe(false);

    input.detach();
  });

  test('detach removes keydown/keyup/blur handlers', () => {
    const target = new FakeEventTarget();
    const input = createInput({ target });
    input.attach();
    input.detach();

    target.fire('keydown', keyEvent('KeyD', 'd'));
    expect(input.isDown('right')).toBe(false);
  });

  test('preventDefault is called for game keys on keydown and keyup', () => {
    const target = new FakeEventTarget();
    const input = createInput({ target });
    input.attach();

    const e = keyEvent('ArrowLeft', 'ArrowLeft');
    target.fire('keydown', e);
    expect(e.prevented).toBe(true);

    const up = keyEvent('ArrowLeft', 'ArrowLeft');
    target.fire('keyup', up);
    expect(up.prevented).toBe(true);

    input.detach();
  });

  test('non-game keys neither register state nor call preventDefault', () => {
    const target = new FakeEventTarget();
    const input = createInput({ target });
    input.attach();

    const e = keyEvent('Digit1', '1');
    target.fire('keydown', e);
    expect(input.isDown('start')).toBe(false);
    expect(input.wasPressed('start')).toBe(false);
    expect(e.prevented).toBe(false);

    input.detach();
  });
});