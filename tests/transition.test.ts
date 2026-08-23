/**
 * Tests for the era-transition choreography controller.
 *
 * Verifies the progress state machine (idle→running→complete), cancellation
 * behavior on rapid re-triggering, and the single-transition-at-a-time
 * guarantee. Uses stubbed era groups so no real Three.js scene is required.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TRANSITION_DURATION,
  TransitionController,
} from '../src/scene/transition';
import type { EraGroupLike } from '../src/scene/transition';

// ---------------------------------------------------------------------------
// Stub group infrastructure (structural EraGroupLike with fadeable materials)
// ---------------------------------------------------------------------------

interface FakeMaterial {
  opacity: number;
  transparent: boolean;
}

interface StubGroup extends EraGroupLike {
  readonly label: string;
  readonly material: FakeMaterial[];
}

function makeVector(): { x: number; y: number; z: number; set(x: number, y: number, z: number): void } {
  const v = { x: 1, y: 1, z: 1 };
  return {
    get x() {
      return v.x;
    },
    set x(value: number) {
      v.x = value;
    },
    get y() {
      return v.y;
    },
    set y(value: number) {
      v.y = value;
    },
    get z() {
      return v.z;
    },
    set z(value: number) {
      v.z = value;
    },
    set(x: number, y: number, z: number) {
      v.x = x;
      v.y = y;
      v.z = z;
    },
  };
}

function makeStubGroup(label: string, materialCount = 1): StubGroup {
  const materials: FakeMaterial[] = Array.from({ length: materialCount }, () => ({
    opacity: 1,
    transparent: false,
  }));
  const children: EraGroupLike[] = [];
  const scale = makeVector();
  const group: StubGroup = {
    label,
    parent: null,
    visible: true,
    scale: scale as unknown as StubGroup['scale'],
    children,
    material: materials,
    remove(child: EraGroupLike) {
      const index = children.indexOf(child);
      if (index >= 0) children.splice(index, 1);
      (child as { parent: EraGroupLike | null }).parent = null;
    },
    traverse(callback: (child: EraGroupLike) => void) {
      callback(group);
      for (const child of [...children]) child.traverse(callback);
    },
  };
  return group;
}

/** Attaches `child` beneath `parent`, mirroring `THREE.Object3D.add`. */
function attach(parent: StubGroup, child: StubGroup): void {
  (child as unknown as { parent: StubGroup | null }).parent = parent;
  (parent.children as unknown as StubGroup[]).push(child);
}

/** All material opacities under a group, via traverse (mirrors the fade walk). */
function opacitiesUnder(group: EraGroupLike): number[] {
  const values: number[] = [];
  group.traverse((node) => {
    const holder = node as unknown as { material?: FakeMaterial[] };
    if (holder.material) values.push(...holder.material.map((m) => m.opacity));
  });
  return values;
}

function scalesOf(group: EraGroupLike): number[] {
  const values: number[] = [];
  group.traverse((node) => values.push(node.scale.x));
  return values;
}

/** Feeds `frames` identical deltas into the controller. */
function pump(controller: TransitionController, dt: number, frames: number): void {
  for (let i = 0; i < frames; i += 1) controller.update(dt);
}

/** Runs the active hand-off to completion using 24 sub-frames. */
function runToCompletion(controller: TransitionController, duration = DEFAULT_TRANSITION_DURATION): void {
  pump(controller, duration / 24, 24);
}

describe('TransitionController contract constants', () => {
  it('defaults to the ~1.2s ease-in-out hand-off', () => {
    expect(DEFAULT_TRANSITION_DURATION).toBe(1.2);
  });

  it('rejects invalid durations', () => {
    expect(() => new TransitionController({ duration: 0 })).toThrow(RangeError);
    expect(() => new TransitionController({ duration: -1 })).toThrow(RangeError);
    expect(() => new TransitionController({ duration: Number.NaN })).toThrow(RangeError);
  });
});

describe('state machine idle → running → complete', () => {
  let outgoing: StubGroup;
  let incoming: StubGroup;

  beforeEach(() => {
    outgoing = makeStubGroup('outgoing');
    incoming = makeStubGroup('incoming');
  });

  afterEach(() => {
    // Controllers under this suite are completed or disposed per-test.
  });

  it('starts idle with zero progress', () => {
    const controller = new TransitionController();
    expect(controller.getState()).toBe('idle');
    expect(controller.getProgress()).toBe(0);
  });

  it('enters running at progress 0 when started', () => {
    const controller = new TransitionController();
    controller.start(outgoing, incoming);

    expect(controller.getState()).toBe('running');
    expect(controller.getProgress()).toBe(0);

    controller.dispose();
  });

  it('reaches complete and reports progress 1 after ~duration elapses', () => {
    const controller = new TransitionController();
    const onComplete = vi.fn();
    controller.start(outgoing, incoming, onComplete);

    runToCompletion(controller);

    expect(controller.getState()).toBe('complete');
    expect(controller.getProgress()).toBe(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('fires onComplete exactly once even when updates keep arriving', () => {
    const controller = new TransitionController();
    const onComplete = vi.fn();
    controller.start(outgoing, incoming, onComplete);

    pump(controller, DEFAULT_TRANSITION_DURATION / 24, 48); // double the length

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('progress advances monotonically through (0, 1]', () => {
    const controller = new TransitionController();
    controller.start(outgoing, incoming);

    const samples: number[] = [];
    pump(controller, DEFAULT_TRANSITION_DURATION / 12, 12);
    for (let i = 1; i <= 12; i += 1) {
      void i;
      samples.push(controller.getProgress());
    }

    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
    expect(samples[samples.length - 1]).toBe(1);
  });

  it('returns to running when a fresh start follows a complete hand-off', () => {
    const controller = new TransitionController();
    controller.start(outgoing, incoming);
    runToCompletion(controller);
    expect(controller.getState()).toBe('complete');

    const second = makeStubGroup('second');
    controller.start(incoming, second); // previous survivor becomes the outgoing side

    expect(controller.getState()).toBe('running');

    controller.dispose();
  });
});

describe('outgoing / incoming visual hand-off', () => {
  let scene: StubGroup;
  let outgoing: StubGroup;
  let incoming: StubGroup;

  beforeEach(() => {
    scene = makeStubGroup('scene-root');
    outgoing = makeStubGroup('outgoing', 2);
    incoming = makeStubGroup('incoming', 2);
    attach(scene, outgoing);
  });

  function makeRunningController(): TransitionController {
    const controller = new TransitionController();
    controller.start(outgoing, incoming);
    return controller;
  }

  it('prepares the incoming group small and fully transparent on start', () => {
    const controller = makeRunningController();

    expect(incoming.visible).toBe(true);
    expect(opacitiesUnder(incoming)).toEqual([0, 0]);
    expect(incoming.scale.x).toBeCloseTo(0.5, 5);
    expect(outgoing.visible).toBe(true);
    expect(opacitiesUnder(outgoing)).toEqual([1, 1]);

    controller.dispose();
  });

  it('fades both groups in opposite directions mid-flight', () => {
    const controller = makeRunningController();

    controller.update(DEFAULT_TRANSITION_DURATION / 2);

    const outOpacity = opacitiesUnder(outgoing)[0];
    const inOpacity = opacitiesUnder(incoming)[0];
    expect(outOpacity).toBeGreaterThan(0.25);
    expect(outOpacity).toBeLessThan(0.75);
    expect(inOpacity).toBeCloseTo(1 - outOpacity, 5); // mirrored halves of one morph

    controller.dispose();
  });

  it('rides an ease-in-out curve: slow at the edges, fastest mid-flight', () => {
    const controller = makeRunningController();

    controller.update(DEFAULT_TRANSITION_DURATION * 0.25);
    const quarterIn = opacitiesUnder(incoming)[0];
    controller.dispose();

    const controller2 = new TransitionController();
    controller2.start(outgoing, incoming);
    controller2.update(DEFAULT_TRANSITION_DURATION * 0.5);
    const halfIn = opacitiesUnder(incoming)[0];
    controller2.dispose();

    const controller3 = new TransitionController();
    controller3.start(outgoing, incoming);
    controller3.update(DEFAULT_TRANSITION_DURATION * 0.75);
    const threeQuarterIn = opacitiesUnder(incoming)[0];

    // Symmetry of the cubic ease: f(t) + f(1-t) === 1.
    expect(quarterIn + threeQuarterIn).toBeCloseTo(1, 5);
    // Halfway point sits exactly at the midpoint value…
    expect(halfIn).toBeCloseTo(0.5, 5);
    // …and edges are slower than linear would suggest near the ends.
    expect(quarterIn).toBeLessThan(0.28); // linear would be exactly 0.25 → eased slower? cubic gives ≈0.0625·… < 0.28
    controller3.dispose();
  });

  it('detaches the outgoing group from the scene graph on completion', () => {
    const controller = makeRunningController();
    runToCompletion(controller);

    expect(scene.children.includes(outgoing)).toBe(false);
    expect(outgoing.parent).toBeNull();
    expect(outgoing.visible).toBe(false);
  });

  it('leaves the incoming group fully faded-in at unit scale on completion', () => {
    const controller = makeRunningController();
    runToCompletion(controller);

    expect(incoming.visible).toBe(true);
    expect(opacitiesUnder(incoming)).toEqual([1, 1]);
    for (const s of scalesOf(incoming)) expect(s).toBeCloseTo(1, 5);
  });

  it('scales the incoming group upward and the outgoing downward over time', () => {
    const controller = makeRunningController();

    controller.update(DEFAULT_TRANSITION_DURATION / 2);
    const midIncomingScale = incoming.scale.x;
    const midOutgoingScale = outgoing.scale.x;
    expect(midIncomingScale).toBeGreaterThan(0.5);
    expect(midIncomingScale).toBeLessThan(1);
    expect(midOutgoingScale).toBeLessThan(1);
    expect(midOutgoingScale).toBeGreaterThan(0.4);

    runToCompletion(controller);
    expect(incoming.scale.x).toBeCloseTo(1, 5);
  });
});

describe('cancellation on rapid re-triggering', () => {
  let scene: StubGroup;

  beforeEach(() => {
    scene = makeStubGroup('scene-root');
  });

  it('blends from the current visual state instead of glitching', () => {
    const eraA = makeStubGroup('eraA');
    const eraB = makeStubGroup('eraB');
    attach(scene, eraA);

    const controller = new TransitionController();
    controller.start(eraA, eraB);

    controller.update(DEFAULT_TRANSITION_DURATION * 0.5);
    const bBefore = opacitiesUnder(eraB)[0];
    expect(bBefore).toBeCloseTo(0.5, 5);

    // Slider jumps again while B is only half faded in: C must arrive, and B
    // must keep receding FROM its current look — never snapping to 1 or 0.
    const eraC = makeStubGroup('eraC');
    controller.start(eraB, eraC);

    expect(opacitiesUnder(eraC)[0]).toBe(0); // newcomer starts hidden
    const bRightAfter = opacitiesUnder(eraB)[0];
    expect(bRightAfter).toBeCloseTo(bBefore, 2); // continuity preserved at cancel time

    controller.update(DEFAULT_TRANSITION_DURATION * 0.01);
    const bNext = opacitiesUnder(eraB)[0];
    expect(bNext).toBeLessThan(bRightAfter); // still smoothly receding
    expect(bNext).toBeGreaterThan(0.4); // …but nowhere near a hard cut to zero

    controller.dispose();
  });

  it('never fires the superseded onComplete, fires the newest exactly once', () => {
    const eraA = makeStubGroup('eraA');
    const eraB = makeStubGroup('eraB');
    attach(scene, eraA);

    const firstComplete = vi.fn();
    const secondComplete = vi.fn();
    const controller = new TransitionController();
    controller.start(eraA, eraB, firstComplete);

    controller.update(DEFAULT_TRANSITION_DURATION * 0.5);
    const eraC = makeStubGroup('eraC');
    controller.start(eraB, eraC, secondComplete);

    runToCompletion(controller);

    expect(firstComplete).not.toHaveBeenCalled();
    expect(secondComplete).toHaveBeenCalledTimes(1);
  });

  it('detaches every stale layer when the final hand-off completes', () => {
    const eraA = makeStubGroup('eraA');
    const eraB = makeStubGroup('eraB');
    const eraC = makeStubGroup('eraC');
    attach(scene, eraA);

    const controller = new TransitionController();
    controller.start(eraA, eraB);
    controller.update(DEFAULT_TRANSITION_DURATION * 0.4);
    controller.start(eraB, eraC);

    runToCompletion(controller);

    expect(controller.getState()).toBe('complete');
    for (const stale of [eraA, eraB]) {
      expect(scene.children.includes(stale)).toBe(false);
      expect(stale.parent).toBeNull();
      expect(stale.visible).toBe(false);
    }
    expect(eraC.visible).toBe(true);
    expect(opacitiesUnder(eraC)[0]).toBe(1);
  });

  it('survives several rapid re-triggers within a single frame budget', () => {
    const eras = ['a', 'b', 'c', 'd', 'e'].map((n) => makeStubGroup(`era-${n}`));
    attach(scene, eras[0]);

    const completions = vi.fn();
    const controller = new TransitionController();
    controller.start(null, eras[0]);
    controller.update(DEFAULT_TRANSITION_DURATION * 0.2);

    for (let i = 1; i < eras.length; i += 1) {
      controller.start(eras[i - 1], eras[i], completions);
      controller.update(DEFAULT_TRANSITION_DURATION * 0.05);
    }

    runToCompletion(controller);

    expect(completions).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toBe('complete');
    // Only the final survivor stays attached; every earlier layer is gone.
    expect(scene.children.filter((c) => c !== eras[eras.length - 1])).toEqual([]);
  });
});

describe('single-transition-at-a-time guarantee', () => {
  it('keeps exactly one lifecycle: restart replaces, never duplicates', () => {
    const scene = makeStubGroup('scene');
    const eraA = makeStubGroup('a');
    const eraB = makeStubGroup('b');
    attach(scene, eraA);

    const controller = new TransitionController();
    controller.start(eraA, eraB);
    controller.update(DEFAULT_TRANSITION_DURATION * 0.3);

    const eraC = makeStubGroup('c');
    const firstComplete = vi.fn();
    const secondComplete = vi.fn();
    controller.start(eraB, eraC, secondComplete);

    // The controller is a single state machine: one running hand-off whose
    // progress belongs to the newest pair only.
    expect(controller.getState()).toBe('running');
    expect(controller.getProgress()).toBe(0);

    runToCompletion(controller);

    // One completion total — the superseded hand-off is silent forever.
    expect(firstComplete).not.toHaveBeenCalled();
    expect(secondComplete).toHaveBeenCalledTimes(1);

    // And the scene holds exactly one settled era group afterwards.
    expect(scene.children).toEqual([]);
    controller.dispose();
  });

  it('update() is inert while idle', () => {
    const controller = new TransitionController();
    controller.update(0.5);
    expect(controller.getState()).toBe('idle');
    expect(controller.getProgress()).toBe(0);
  });

  it('update() is inert after completion', () => {
    const controller = new TransitionController();
    const outgoing = makeStubGroup('out');
    const incoming = makeStubGroup('in');
    controller.start(outgoing, incoming);
    runToCompletion(controller);

    controller.update(0.5);

    expect(controller.getState()).toBe('complete');
    expect(controller.getProgress()).toBe(1);
  });

  it('ignores non-positive, non-finite deltas without corrupting progress', () => {
    const controller = new TransitionController();
    const outgoing = makeStubGroup('out');
    const incoming = makeStubGroup('in');
    controller.start(outgoing, incoming);

    controller.update(0);
    controller.update(-0.1);
    controller.update(Number.NaN);
    controller.update(Number.POSITIVE_INFINITY);

    expect(controller.getState()).toBe('running');
    expect(controller.getProgress()).toBe(0);

    controller.dispose();
  });
});

describe('dispose()', () => {
  it('settles a mid-flight hand-off without firing onComplete', () => {
    const scene = makeStubGroup('scene');
    const outgoing = makeStubGroup('out');
    const incoming = makeStubGroup('in');
    attach(scene, outgoing);

    const onComplete = vi.fn();
    const controller = new TransitionController();
    controller.start(outgoing, incoming, onComplete);
    controller.update(DEFAULT_TRANSITION_DURATION * 0.5);

    controller.dispose();

    expect(onComplete).not.toHaveBeenCalled();
    expect(controller.getState()).toBe('idle');
    expect(controller.getProgress()).toBe(0);
    expect(scene.children.includes(outgoing)).toBe(false); // stale layer cleaned
    expect(incoming.visible).toBe(true);
    expect(opacitiesUnder(incoming)[0]).toBe(1); // survivor restored
  });

  it('is idempotent', () => {
    const controller = new TransitionController();
    controller.start(makeStubGroup('o'), makeStubGroup('i'));
    controller.dispose();
    expect(() => controller.dispose()).not.toThrow();
    expect(controller.getState()).toBe('idle');
  });

  it('makes start() throw and update() inert afterwards', () => {
    const controller = new TransitionController();
    controller.start(makeStubGroup('o'), makeStubGroup('i'));
    controller.dispose();

    expect(() => controller.start(makeStubGroup('o2'), makeStubGroup('i2'))).toThrow(
      /dispose/i,
    );
    expect(() => controller.update(0.1)).not.toThrow();
    expect(controller.getProgress()).toBe(0);
  });

  it('restores original material transparency flags it touched', () => {
    const controller = new TransitionController();
    const incoming = makeStubGroup('in');
    controller.start(null, incoming);

    controller.update(DEFAULT_TRANSITION_DURATION * 0.25);
    expect(incoming.material[0].transparent).toBe(true);

    controller.dispose();
    expect(incoming.material[0].transparent).toBe(false); // original flag recovered
  });
});

describe('custom durations', () => {
  it('respects a longer custom duration', () => {
    const controller = new TransitionController({ duration: 2 });
    const onComplete = vi.fn();
    controller.start(makeStubGroup('o'), makeStubGroup('i'), onComplete);

    controller.update(1);
    expect(controller.getState()).toBe('running');
    expect(controller.getProgress()).toBeCloseTo(0.5, 5);
    expect(onComplete).not.toHaveBeenCalled();

    controller.update(1);
    expect(controller.getState()).toBe('complete');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('respects a shorter custom duration', () => {
    const prefersReducedMotion = new TransitionController({ duration: 0.3 });
    const onComplete = vi.fn();
    prefersReducedMotion.start(makeStubGroup('o'), makeStubGroup('i'), onComplete);

    pump(prefersReducedMotion, 0.05, 6);
    expect(prefersReducedMotion.getState()).toBe('complete');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('completes across uneven frame deltas without overshoot', () => {
    const controller = new TransitionController({ duration: 1.2 });
    controller.start(makeStubGroup('o'), makeStubGroup('i'));

    controller.update(1.0); // big hitch-style frame
    controller.update(0.15);
    controller.update(0.05); // lands exactly on the boundary

    expect(controller.getState()).toBe('complete');
    expect(controller.getProgress()).toBe(1);
  });
});
