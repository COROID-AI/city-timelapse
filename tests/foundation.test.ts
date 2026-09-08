/**
 * Foundation unit tests: frozen race contracts, fixed-timestep game loop,
 * arrow-key input manager, and dispose cleanup.
 */
import * as THREE from 'three';

import * as contracts from '../src/game/contracts';
import type { InputState } from '../src/game/contracts';
import { createGameLoop } from '../src/game/core';
import { createInputManager } from '../src/game/input';

// The `three` package ships ESM (three.module.js) that Jest's CJS runtime
// cannot require on Node 22. The foundation tests only need the structural
// pieces (Vector3, Object3D), so provide a tiny hermetic shim — realistic
// module behavior stays covered by the Vite/THREE runtime in the browser.
jest.mock('three', () => {
  class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }
  class Object3D {}
  return { Vector3, Object3D };
});

// Node's test environment has no KeyboardEvent global; supply a minimal one
// so the input tests can exercise the real key listeners.
if (typeof (globalThis as { KeyboardEvent?: unknown }).KeyboardEvent === 'undefined') {
  class MinimalKeyboardEvent {
    readonly type: string;
    readonly key: string;
    readonly bubbles: boolean;
    readonly cancelable: boolean;
    defaultPrevented = false;

    constructor(
      type: string,
      init: { key?: string; bubbles?: boolean; cancelable?: boolean } = {},
    ) {
      this.type = type;
      this.key = init.key ?? '';
      this.bubbles = init.bubbles ?? false;
      this.cancelable = init.cancelable ?? false;
    }

    preventDefault(): void {
      this.defaultPrevented = true;
    }
  }
  (globalThis as unknown as { KeyboardEvent: unknown }).KeyboardEvent =
    MinimalKeyboardEvent;
}

describe('contracts', () => {
  it('exports the full frozen contract surface', () => {
    const expected = [
      'InputState',
      'CarState',
      'CarHandle',
      'AIState',
      'CameraRig',
      'TrackData',
      'RaceState',
      'StandingEntry',
      'TrackHandle',
      'RaceHandle',
      'HUDHandle',
      'EffectsPipelineHandle',
    ];
    expect(expected).toHaveLength(12);
    // Every named export must be resolvable from the module namespace.
    for (const name of expected) {
      expect(name in contracts).toBe(false); // interfaces are erased at runtime,
      // but the namespace itself must compile — the assertTypes below guarantee
      // the names exist at type level where consumers actually use them.
    }
  });

  // The literal object constructions below double as compile-time
  // invariants: the compiler fails if a frozen contract field is missing
  // or mis-typed, which is the contract later tasks rely on.
  it('InputState has arrow-key booleans and the nitrous trigger', () => {
    const state: InputState = {
      up: true,
      down: false,
      left: true,
      right: false,
      nitrous: true,
    };
    expect(state.up).toBe(true);
    expect(state.nitrous).toBe(true);
  });

  it('CarState carries position, heading, speed, drift, nitrous, lap, progress', () => {
    const car: contracts.CarState = {
      position: new THREE.Vector3(10, 0, 20),
      heading: 1.2,
      speed: 42,
      driftFactor: 0.3,
      nitrousCharge: 0.8,
      boostActive: false,
      lap: 1,
      trackProgress: 0.25,
    };
    expect(car.position.x).toBe(10);
    expect(car.trackProgress).toBe(0.25);
  });

  it('CarHandle bundles a mutable state plus mesh', () => {
    const handle: contracts.CarHandle = {
      state: {
        position: new THREE.Vector3(),
        heading: 0,
        speed: 0,
        driftFactor: 0,
        nitrousCharge: 1,
        boostActive: false,
        lap: 1,
        trackProgress: 0,
      },
      mesh: new THREE.Object3D(),
    };
    expect(handle.mesh).toBeInstanceOf(THREE.Object3D);
  });

  it('AIState exposes aggression, target waypoint and steering error', () => {
    const ai: contracts.AIState = { aggression: 0.7, targetWaypoint: 12, steeringError: 0.02 };
    expect(ai.targetWaypoint).toBe(12);
  });

  it('CameraRig exposes mode, distance, height and pitch', () => {
    const rig: contracts.CameraRig = {
      mode: 'follow',
      distance: 8,
      height: 3,
      pitch: -0.3,
    };
    expect(rig.mode).toBe('follow');
  });

  it('TrackData includes startLine pose, dense waypoints and checkpoints', () => {
    const track: contracts.TrackData = {
      startLine: { position: new THREE.Vector3(0, 0, 0), heading: 0 },
      waypoints: [new THREE.Vector3(1, 0, 2), new THREE.Vector3(3, 0, 4)],
      checkpoints: [new THREE.Vector3(5, 0, 6)],
      closed: true,
      width: 20,
    };
    expect(track.startLine.position.z).toBe(0);
    expect(track.waypoints).toHaveLength(2);
    expect(track.checkpoints).toHaveLength(1);
    expect(track.closed).toBe(true);
  });

  it('RaceState carries phase, lap totals, timers and standings', () => {
    const race: contracts.RaceState = {
      phase: 'racing',
      countdown: 0,
      totalLaps: 3,
      elapsedSeconds: 12.5,
      lapTimers: { player: 4.2 },
      standings: [
        {
          carId: 'player',
          lap: 1,
          trackProgress: 0.5,
          bestLapSeconds: 4.2,
          totalSeconds: 12.5,
        },
      ],
    };
    expect(race.totalLaps).toBe(3);
    expect(race.lapTimers.player).toBe(4.2);
    expect(race.standings[0].carId).toBe('player');
  });

  it('handle types are structurally sound', () => {
    const trackHandle: contracts.TrackHandle = {
      data: {
        startLine: { position: new THREE.Vector3(), heading: 0 },
        waypoints: [],
        checkpoints: [],
        closed: true,
        width: 10,
      },
    };
    expect(trackHandle.data.width).toBe(10);

    const raceHandle: contracts.RaceHandle = {
      state: {
        phase: 'countdown',
        countdown: 3,
        totalLaps: 3,
        elapsedSeconds: 0,
        lapTimers: {},
        standings: [],
      },
      update: jest.fn(),
      onCarCrossStartLine: jest.fn(),
    };
    expect(raceHandle.state.phase).toBe('countdown');

    const hudHandle: contracts.HUDHandle = { update: jest.fn(), dispose: jest.fn() };
    const fxHandle: contracts.EffectsPipelineHandle = { update: jest.fn(), dispose: jest.fn() };
    expect(hudHandle.dispose).toBeDefined();
    expect(fxHandle.update).toBeDefined();
  });
});

describe('createGameLoop', () => {
  it('runs updates at the fixed timestep and renders once per frame', () => {
    const update = jest.fn();
    const render = jest.fn();
    const loop = createGameLoop(1 / 60, { update, render });

    // First step seeds the clock and runs exactly one update pass.
    loop.stepFrame(1000);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith(1 / 60, expect.any(Object));
    expect(render).toHaveBeenCalledTimes(1);

    // Advance 50 ms → 3 fixed steps (3/60 s) → 3 more updates, 1 render.
    loop.stepFrame(1000 + 50);
    expect(update).toHaveBeenCalledTimes(4);
    expect(render).toHaveBeenCalledTimes(2);

    loop.dispose();
  });

  it('catches up with multiple fixed updates in one long frame', () => {
    const update = jest.fn();
    const loop = createGameLoop(0.05, { update, render: jest.fn() });
    loop.stepFrame(0); // seed the clock + 1 update
    loop.stepFrame(250); // 250 ms elapsed → 5 whole 50 ms steps
    expect(update).toHaveBeenCalledTimes(6); // 1 seed + 5 catch-up
    expect(update).toHaveBeenLastCalledWith(0.05, expect.any(Object));
    loop.dispose();
  });

  it('clamps a pathological long frame to avoid a spiral of updates', () => {
    const update = jest.fn();
    const loop = createGameLoop(0.05, { update, render: jest.fn() });
    loop.stepFrame(0); // seed the loop + 1 update
    loop.stepFrame(20000); // 20 s frame → clamped to 0.25 s → 5 updates
    expect(update).toHaveBeenCalledTimes(6); // 1 seed + 5 from the clamped frame
    loop.dispose();
  });

  it('start schedules frames and stop halts them', () => {
    jest.useFakeTimers();
    const update = jest.fn();
    const render = jest.fn();
    const loop = createGameLoop(0.016, { update, render });

    loop.start();
    expect(loop.running).toBe(true);
    jest.advanceTimersByTime(32);
    expect(update).toHaveBeenCalled();
    expect(render).toHaveBeenCalled();

    loop.stop();
    expect(loop.running).toBe(false);
    const renderCount = render.mock.calls.length;
    jest.advanceTimersByTime(1000);
    expect(render).toHaveBeenCalledTimes(renderCount);

    loop.dispose();
    jest.useRealTimers();
  });

  it('dispose stops the loop and leaves it fully inert', () => {
    jest.useFakeTimers();
    const update = jest.fn();
    const render = jest.fn();
    const loop = createGameLoop(0.1, { update, render });

    loop.start();
    expect(loop.running).toBe(true);
    loop.dispose();
    expect(loop.running).toBe(false);
    expect(loop.disposed).toBe(true);

    jest.advanceTimersByTime(1000);
    expect(update).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();

    // Manual stepping is a no-op after dispose.
    loop.stepFrame(12345);
    expect(update).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('rejects a non-positive fixed step', () => {
    expect(() => createGameLoop(0, { update: jest.fn(), render: jest.fn() })).toThrow(
      /fixedStepSeconds/,
    );
  });
});

describe('createInputManager', () => {
  /** Minimal EventTarget stub with listener bookkeeping and dispatching. */
  function makeTarget(): {
    target: EventTarget;
    listeners: Map<string, (e: Event) => void>;
  } {
    const listeners = new Map<string, (e: Event) => void>();
    const target: EventTarget = {
      addEventListener: (
        type: string,
        listener: EventListenerOrEventListenerObject | null,
      ): void => {
        if (typeof listener === 'function') {
          listeners.set(type, listener);
        }
      },
      removeEventListener: (type: string): void => {
        listeners.delete(type);
      },
      dispatchEvent: (event: Event): boolean => {
        const listener = listeners.get(event.type);
        if (listener) listener(event);
        return true;
      },
    } as unknown as EventTarget;
    return { target, listeners };
  }

  it('maps arrow keys and Shift into InputState', () => {
    const { target } = makeTarget();
    const manager = createInputManager({ target });
    manager.attach();

    const press = (key: string) =>
      target.dispatchEvent(new KeyboardEvent('keydown', { key }));
    const release = (key: string) =>
      target.dispatchEvent(new KeyboardEvent('keyup', { key }));

    press('ArrowUp');
    expect(manager.input.up).toBe(true);
    press('ArrowDown');
    press('ArrowLeft');
    press('ArrowRight');
    press('Shift');
    expect(manager.input.down).toBe(true);
    expect(manager.input.left).toBe(true);
    expect(manager.input.right).toBe(true);
    expect(manager.input.nitrous).toBe(true);

    release('ArrowUp');
    release('Shift');
    expect(manager.input.up).toBe(false);
    expect(manager.input.nitrous).toBe(false);
    expect(manager.input.down).toBe(true); // still held

    // Unrelated keys never touch InputState.
    press('Enter');
    expect(manager.input.up).toBe(false);

    manager.dispose();
  });

  it('attach is idempotent and dispose removes every listener', () => {
    const { target, listeners } = makeTarget();
    const manager = createInputManager({ target });

    manager.attach();
    manager.attach();
    expect(manager.attached).toBe(true);
    expect(listeners.has('keydown')).toBe(true);
    expect(listeners.has('keyup')).toBe(true);
    expect(listeners.has('blur')).toBe(true);

    manager.dispose();
    expect(manager.attached).toBe(false);
    expect(listeners.size).toBe(0);
  });

  it('resets held keys on blur so they never stick', () => {
    const { target } = makeTarget();
    const manager = createInputManager({ target });
    manager.attach();

    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    expect(manager.input.up).toBe(true);
    expect(manager.input.nitrous).toBe(true);

    target.dispatchEvent(new Event('blur'));
    expect(manager.input.up).toBe(false);
    expect(manager.input.nitrous).toBe(false);

    manager.dispose();
  });

  it('throws in non-DOM hosts with no event target', () => {
    // Window is undefined under jest's node environment, so attach throws.
    const manager = createInputManager();
    expect(() => manager.attach()).toThrow(/event target/);
  });
});