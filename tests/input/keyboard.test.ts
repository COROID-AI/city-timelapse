/**
 * Unit tests for the keyboard -> InputState adapter.
 *
 * Uses a lightweight fake `Window` so the tests run under node with no real
 * DOM. Covers arrow-key mapping, held-key de-duplication, blur release, and
 * the attach / dispose lifecycle (no listener leaks).
 */

import {
  attachKeyboardInput,
  BOOST_HINT,
  type KeyboardInput,
} from '../../src/input/keyboard';

/** Minimal stand-in for the parts of `Window` our adapter touches. */
interface FakeTarget {
  listeners: Record<string, Array<{ event: string; fn: (e: Partial<KeyboardEvent>) => void }>>;
  addEventListener: (event: string, fn: (e: Partial<KeyboardEvent>) => void) => void;
  removeEventListener: (event: string, fn: (e: Partial<KeyboardEvent>) => void) => void;
  fire: (event: string, e: Partial<KeyboardEvent>) => void;
}

function makeTarget(): FakeTarget {
  const listeners: FakeTarget['listeners'] = {};
  const target: FakeTarget = {
    listeners,
    addEventListener(event, fn) {
      (listeners[event] ??= []).push({ event, fn });
    },
    removeEventListener(event, fn) {
      const list = listeners[event] ?? [];
      const idx = list.findIndex((l) => l.fn === fn);
      if (idx >= 0) list.splice(idx, 1);
    },
    fire(event, e) {
      for (const l of listeners[event] ?? []) l.fn(e);
    },
  };
  return target;
}

/** Fire a keydown then keyup for the given key code. */
function tap(target: FakeTarget, code: string): void {
  target.fire('keydown', { code, key: code, preventDefault() {} });
  target.fire('keyup', { code, key: code, preventDefault() {} });
}

describe('attachKeyboardInput — arrow-key mapping', () => {
  it('maps ArrowUp to throttle +1', () => {
    const target = makeTarget();
    const kb = attachKeyboardInput(target as unknown as Window);
    target.fire('keydown', { code: 'ArrowUp', key: 'ArrowUp', preventDefault() {} });
    expect(kb.input().throttle).toBe(1);
    target.fire('keyup', { code: 'ArrowUp', key: 'ArrowUp', preventDefault() {} });
    kb.dispose();
  });

  it('maps ArrowDown to throttle -1 and brake', () => {
    const target = makeTarget();
    const kb = attachKeyboardInput(target as unknown as Window);
    target.fire('keydown', { code: 'ArrowDown', key: 'ArrowDown', preventDefault() {} });
    const input = kb.input();
    expect(input.throttle).toBe(-1);
    expect(input.brake).toBe(true);
    kb.dispose();
  });

  it('maps ArrowLeft / ArrowRight to steer -1 / +1', () => {
    const target = makeTarget();
    const kb = attachKeyboardInput(target as unknown as Window);
    target.fire('keydown', { code: 'ArrowLeft', key: 'ArrowLeft', preventDefault() {} });
    expect(kb.input().steer).toBe(-1);
    target.fire('keyup', { code: 'ArrowLeft', key: 'ArrowLeft', preventDefault() {} });
    target.fire('keydown', { code: 'ArrowRight', key: 'ArrowRight', preventDefault() {} });
    expect(kb.input().steer).toBe(1);
    kb.dispose();
  });

  it('maps Space to the nitrous boost trigger', () => {
    const target = makeTarget();
    const kb = attachKeyboardInput(target as unknown as Window);
    target.fire('keydown', { code: 'Space', key: ' ', preventDefault() {} });
    expect(kb.input().nitrous).toBe(true);
    kb.dispose();
  });

  it('maps Shift to the nitrous boost trigger (documented alternative)', () => {
    const target = makeTarget();
    const kb = attachKeyboardInput(target as unknown as Window);
    target.fire('keydown', { code: 'ShiftLeft', key: 'Shift', preventDefault() {} });
    expect(kb.input().nitrous).toBe(true);
    kb.dispose();
  });
});

describe('held-key lifecycle', () => {
  it('releases the key on keyup', () => {
    const target = makeTarget();
    const kb = attachKeyboardInput(target as unknown as Window);
    target.fire('keydown', { code: 'ArrowUp', key: 'ArrowUp', preventDefault() {} });
    expect(kb.input().throttle).toBe(1);
    target.fire('keyup', { code: 'ArrowUp', key: 'ArrowUp', preventDefault() {} });
    expect(kb.input().throttle).toBe(0);
    kb.dispose();
  });

  it('releases all keys on window blur (no stuck keys)', () => {
    const target = makeTarget();
    const kb = attachKeyboardInput(target as unknown as Window);
    target.fire('keydown', { code: 'ArrowUp', key: 'ArrowUp', preventDefault() {} });
    target.fire('keydown', { code: 'ArrowRight', key: 'ArrowRight', preventDefault() {} });
    expect(kb.input().throttle).toBe(1);
    expect(kb.input().steer).toBe(1);
    target.fire('blur', {});
    expect(kb.input().throttle).toBe(0);
    expect(kb.input().steer).toBe(0);
    kb.dispose();
  });

  it('ignores unrelated keys', () => {
    const target = makeTarget();
    const kb = attachKeyboardInput(target as unknown as Window);
    tap(target, 'KeyQ');
    const input = kb.input();
    expect(input.throttle).toBe(0);
    expect(input.steer).toBe(0);
    expect(input.nitrous).toBe(false);
    kb.dispose();
  });
});

describe('attach / dispose lifecycle — no leaks', () => {
  it('registers keydown/keyup/blur listeners and removes them on dispose', () => {
    const target = makeTarget();
    const kb = attachKeyboardInput(target as unknown as Window);
    expect(target.listeners.keydown?.length ?? 0).toBe(1);
    expect(target.listeners.keyup?.length ?? 0).toBe(1);
    expect(target.listeners.blur?.length ?? 0).toBe(1);

    kb.dispose();
    expect(target.listeners.keydown?.length ?? 0).toBe(0);
    expect(target.listeners.keyup?.length ?? 0).toBe(0);
    expect(target.listeners.blur?.length ?? 0).toBe(0);
  });

  it('is inert after dispose', () => {
    const target = makeTarget();
    const kb = attachKeyboardInput(target as unknown as Window);
    kb.dispose();
    target.fire('keydown', { code: 'ArrowUp', key: 'ArrowUp', preventDefault() {} });
    expect(kb.input().throttle).toBe(0);
  });
});

describe('BOOST_HINT', () => {
  it('records the Space boost choice for the HUD', () => {
    expect(BOOST_HINT).toBe('Space to boost');
  });
});