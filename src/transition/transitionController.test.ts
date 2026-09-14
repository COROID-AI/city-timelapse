import { describe, expect, it } from 'vitest';
import { type EraId } from '../era/types';
import {
  clamp01,
  easeInCubic,
  easeInOutCubic,
  easeLinear,
  easeOutCubic,
  staggerProgress,
  windowProgress,
} from './easing';
import {
  DEFAULT_INCOMING_SCALE,
  DEFAULT_MORPH_DURATION,
  DEFAULT_OUTGOING_SCALE,
  TransitionController,
  type EraContentBundle,
  type EraElement,
} from './transitionController';

/** Records every visual command it receives. */
class StubElement implements EraElement {
  opacity = 1;
  scale = 1;

  setOpacity(factor: number): void {
    this.opacity = factor;
  }

  setScale(factor: number): void {
    this.scale = factor;
  }
}

/** Era content with `elementCount` per-element morph targets. */
class StubBundle implements EraContentBundle {
  readonly group: string;
  readonly elements: StubElement[];
  readonly updates: number[] = [];
  disposeCount = 0;

  constructor(group: string, elementCount = 3) {
    this.group = group;
    this.elements = Array.from({ length: elementCount }, () => new StubElement());
  }

  update(dt: number): void {
    this.updates.push(dt);
  }

  dispose(): void {
    this.disposeCount += 1;
  }
}

/** Era content with no elements, exposing whole-bundle hooks instead. */
class SingleBundle implements EraContentBundle {
  readonly group: string;
  opacity = 1;
  scale = 1;
  disposeCount = 0;

  constructor(group: string) {
    this.group = group;
  }

  setOpacity(factor: number): void {
    this.opacity = factor;
  }

  setScale(factor: number): void {
    this.scale = factor;
  }

  dispose(): void {
    this.disposeCount += 1;
  }
}

describe('TransitionController', () => {
  it('dissolves/scales out the outgoing bundle while the incoming builds in with stagger', () => {
    const controller = new TransitionController({ duration: 1, reducedMotion: false });
    const outgoing = new StubBundle('buildings-1945', 4);
    const incoming = new StubBundle('buildings-2025', 4);

    controller.play(outgoing, incoming, 2025);

    // Start frame: outgoing fully visible at identity scale, incoming hidden.
    outgoing.elements.forEach((element) => {
      expect(element.opacity).toBe(1);
      expect(element.scale).toBe(1);
    });
    incoming.elements.forEach((element) => {
      expect(element.opacity).toBe(0);
      expect(element.scale).toBeCloseTo(1 - DEFAULT_INCOMING_SCALE, 9);
    });

    // t = 0.2: the outgoing dissolve wave has finished element 0 (slot
    // [0, 0.45] split into 4) and bloomed its scale out; later elements are
    // still visible. The incoming window ([0.3, 1]) has not started.
    controller.update(0.2);
    expect(outgoing.elements[0]!.opacity).toBe(0);
    expect(outgoing.elements[0]!.scale).toBeCloseTo(1 + DEFAULT_OUTGOING_SCALE, 9);
    expect(outgoing.elements[1]!.opacity).toBeGreaterThan(0);
    expect(outgoing.elements[1]!.opacity).toBeLessThan(1);
    expect(outgoing.elements[2]!.opacity).toBe(1);
    incoming.elements.forEach((element) => expect(element.opacity).toBe(0));

    // t = 0.6: leading incoming elements have started building in, strictly
    // ordered by the stagger wave; trailing elements have not moved.
    controller.update(0.4);
    const build = incoming.elements.map((element) => element.opacity);
    expect(build[0]!).toBe(1);
    expect(build[1]!).toBeLessThan(1);
    expect(build[1]!).toBeGreaterThan(build[3]!);
    expect(build[2]!).toBe(0);
    expect(build[3]!).toBe(0);

    // Completion settles on the new era with the incoming content crystallized.
    controller.update(1);
    expect(controller.active).toBe(false);
    expect(controller.settledEra).toBe(2025);
    expect(outgoing.disposeCount).toBe(1);
    expect(incoming.disposeCount).toBe(0);
    incoming.elements.forEach((element) => {
      expect(element.opacity).toBe(1);
      expect(element.scale).toBe(1);
    });
  });

  it('applies the eased curves to windowed progress', () => {
    const controller = new TransitionController({ duration: 1, reducedMotion: false });
    const outgoing = new StubBundle('out', 1);
    const incoming = new StubBundle('in', 1);

    controller.play(outgoing, incoming, 2025);

    // Outgoing window [0, 0.45] with easeInCubic: t = 0.225 -> 50% windowed.
    controller.update(0.225);
    const outEased = easeInCubic(0.5);
    expect(outgoing.elements[0]!.opacity).toBeCloseTo(1 - outEased, 9);
    expect(outgoing.elements[0]!.scale).toBeCloseTo(1 + DEFAULT_OUTGOING_SCALE * outEased, 9);

    // Incoming window [0.3, 1] with easeOutCubic: t = 0.65 -> 50% windowed.
    controller.update(0.425);
    const inEased = easeOutCubic(0.5);
    expect(incoming.elements[0]!.opacity).toBeCloseTo(inEased, 9);
    expect(incoming.elements[0]!.scale).toBeCloseTo(1 - DEFAULT_INCOMING_SCALE + DEFAULT_INCOMING_SCALE * inEased, 9);
  });

  it('drives whole-bundle hooks when no elements are exposed', () => {
    const controller = new TransitionController({ duration: 1, reducedMotion: false });
    const outgoing = new SingleBundle('buildings-1945');
    const incoming = new SingleBundle('buildings-2025');

    controller.play(outgoing, incoming, 2025);
    expect(outgoing.opacity).toBe(1);
    expect(incoming.opacity).toBe(0);

    controller.update(0.5); // t = 0.5
    expect(outgoing.opacity).toBe(0); // outgoing window [0, 0.45] complete
    expect(incoming.opacity).toBeGreaterThan(0);
    expect(incoming.opacity).toBeLessThan(1);

    controller.update(0.6); // t = 1.1 -> settle
    expect(controller.settledEra).toBe(2025);
    expect(incoming.opacity).toBe(1);
    expect(incoming.scale).toBe(1);
    expect(outgoing.disposeCount).toBe(1);
    expect(incoming.disposeCount).toBe(0);
  });

  it('forwards frame deltas to the active content', () => {
    const controller = new TransitionController({ duration: 1, reducedMotion: false });
    const outgoing = new StubBundle('a');
    const incoming = new StubBundle('b');

    controller.play(outgoing, incoming, 1985);
    controller.update(0.25);
    controller.update(0.25);

    expect(outgoing.updates).toEqual([0.25, 0.25]);
    expect(incoming.updates).toEqual([0.25, 0.25]);
  });

  it('emits progress 0..1 and completes exactly once with the settled era', () => {
    const controller = new TransitionController({ duration: 1, reducedMotion: false });
    const progressEvents: number[] = [];
    const completed: EraId[] = [];
    controller.onProgress((progress) => progressEvents.push(progress));
    controller.onComplete((era) => completed.push(era));

    controller.play(new StubBundle('a'), new StubBundle('b'), 2025);
    expect(controller.progress).toBe(0);

    controller.update(0.25);
    controller.update(0.25);
    controller.update(0.5);
    expect(controller.active).toBe(false);

    expect(progressEvents[0]).toBe(0);
    expect(progressEvents.at(-1)).toBe(1);
    for (let i = 1; i < progressEvents.length; i += 1) {
      expect(progressEvents[i]!).toBeGreaterThan(progressEvents[i - 1]!);
    }
    expect(completed).toEqual([2025]);
    expect(controller.progress).toBe(0); // idle after settle
    expect(controller.settledEra).toBe(2025);
  });

  it('retargets mid-flight: superseded content is disposed once and the newest era settles', () => {
    const controller = new TransitionController({ duration: 1, reducedMotion: false });
    const a = new StubBundle('1945', 3);
    const b = new StubBundle('2005', 3);
    const c = new StubBundle('1985', 3);
    const completed: EraId[] = [];
    controller.onComplete((era) => completed.push(era));

    controller.play(a, b, 2005);
    controller.update(0.4); // mid-flight, b is roughly 81% built in

    const b0Before = b.elements[0]!.opacity;
    expect(b0Before).toBeGreaterThan(0);
    expect(b0Before).toBeLessThan(1);

    // Interruption with the previously-targeted bundle handed back as the new
    // outgoing — the natural store-driven wiring pattern.
    controller.play(b, c, 1985);

    expect(a.disposeCount).toBe(1); // superseded outgoing disposed exactly once
    expect(b.disposeCount).toBe(0); // kept, role reassigned to outgoing
    expect(c.disposeCount).toBe(0);

    // Role reassignment does not snap the half-built content back to full
    // visibility: it keeps its exact state, then keeps dissolving.
    expect(b.elements[0]!.opacity).toBeCloseTo(b0Before, 9);
    controller.update(0.1);
    expect(b.elements[0]!.opacity).toBeLessThanOrEqual(b0Before);
    expect(b.elements[0]!.opacity).toBeGreaterThan(0);
    controller.update(0.2); // element 0 finishes its new dissolve slot
    expect(b.elements[0]!.opacity).toBe(0);

    controller.update(2); // run the retargeted morph out
    expect(completed).toEqual([1985]); // exactly one completion, newest era
    expect(controller.settledEra).toBe(1985);
    expect(controller.active).toBe(false);
    expect(b.disposeCount).toBe(1); // outgoing on settle
    expect(c.disposeCount).toBe(0); // incoming retained as settled content
    expect(a.disposeCount).toBe(1); // never double-disposed
    c.elements.forEach((element) => {
      expect(element.opacity).toBe(1);
      expect(element.scale).toBe(1);
    });
  });

  it('interrupting with the same outgoing bundle keeps dissolving it monotonically', () => {
    const controller = new TransitionController({ duration: 1, reducedMotion: false });
    const a = new StubBundle('a', 3);
    const b = new StubBundle('b', 3);
    const c = new StubBundle('c', 3);

    controller.play(a, b, 2005);
    controller.update(0.1); // element 0 of a is part-way dissolved
    const a0 = a.elements[0]!.opacity;
    expect(a0).toBeGreaterThan(0);

    controller.play(a, c, 1965); // same outgoing re-used, incoming superseded
    expect(b.disposeCount).toBe(1);

    controller.update(0.1); // re-subscribed timeline: element 0 holds (no snap back)
    expect(a.elements[0]!.opacity).toBeCloseTo(a0, 9);

    controller.update(0.1); // then its dissolve slot completes
    expect(a.elements[0]!.opacity).toBe(0);

    controller.update(1);
    expect(controller.settledEra).toBe(1965);
    expect(a.disposeCount).toBe(1);
    expect(c.disposeCount).toBe(0);
  });

  it('falls back to a minimal linear crossfade when reduced motion is enabled', () => {
    const controller = new TransitionController({
      duration: 1,
      reducedMotion: true,
      reducedMotionDuration: 0.5,
    });
    const outgoing = new StubBundle('a', 4);
    const incoming = new StubBundle('b', 4);
    const progressEvents: number[] = [];
    const completed: EraId[] = [];
    controller.onProgress((progress) => progressEvents.push(progress));
    controller.onComplete((era) => completed.push(era));

    controller.play(outgoing, incoming, 1965);
    controller.update(0.25); // halfway through the 0.5s crossfade

    // No stagger and no scale movement: every element shares the same factor.
    outgoing.elements.forEach((element) => {
      expect(element.opacity).toBeCloseTo(0.5, 9);
      expect(element.scale).toBe(1);
    });
    incoming.elements.forEach((element) => {
      expect(element.opacity).toBeCloseTo(0.5, 9);
      expect(element.scale).toBe(1);
    });

    controller.update(0.25);
    expect(controller.active).toBe(false);
    expect(controller.settledEra).toBe(1965);
    expect(progressEvents).toEqual([0, 0.5, 1]);
    expect(completed).toEqual([1965]);
    outgoing.elements.forEach((element) => expect(element.opacity).toBe(0));
    incoming.elements.forEach((element) => expect(element.opacity).toBe(1));
    expect(outgoing.disposeCount).toBe(1);
    expect(incoming.disposeCount).toBe(0);
  });

  it('detects reduced motion from the media-query source', () => {
    const reduced = new TransitionController({
      duration: 1,
      reducedMotionDuration: 0.5,
      prefersReducedMotion: () => true,
    });
    const full = new TransitionController({ duration: 1, prefersReducedMotion: () => false });

    reduced.play(new StubBundle('a'), new StubBundle('b'), 1985);
    expect(reduced.reducedMotion).toBe(true);

    full.play(new StubBundle('a'), new StubBundle('b'), 1985);
    expect(full.reducedMotion).toBe(false);
  });

  it('lets an explicit reducedMotion override beat the media query', () => {
    const controller = new TransitionController({
      duration: 1,
      reducedMotion: false,
      prefersReducedMotion: () => true,
    });
    controller.play(new StubBundle('a'), new StubBundle('b'), 2005);
    expect(controller.reducedMotion).toBe(false);
  });

  it('uses the default choreography duration when no options are given', () => {
    const controller = new TransitionController();
    const a = new StubBundle('a');
    const b = new StubBundle('b');

    controller.play(a, b, 1985);
    controller.update(DEFAULT_MORPH_DURATION);
    expect(controller.active).toBe(false);
    expect(controller.settledEra).toBe(1985);
  });

  it('dispose cancels the timeline, disposes held content, clears listeners and stays idempotent', () => {
    const controller = new TransitionController({ duration: 1, reducedMotion: false });
    const a = new StubBundle('a');
    const b = new StubBundle('b');
    const progressEvents: number[] = [];
    const completed: EraId[] = [];
    controller.onProgress((progress) => progressEvents.push(progress));
    controller.onComplete((era) => completed.push(era));

    controller.play(a, b, 2005);
    controller.update(0.3);

    controller.dispose();
    controller.dispose(); // idempotent
    expect(a.disposeCount).toBe(1);
    expect(b.disposeCount).toBe(1);
    expect(controller.active).toBe(false);

    // update after dispose is a safe no-op.
    controller.update(1);
    expect(progressEvents).toEqual([0, 0.3]);
    expect(completed).toEqual([]);
    expect(a.disposeCount).toBe(1);

    // play after dispose is a safe no-op.
    const c = new StubBundle('c');
    controller.play(c, new StubBundle('d'), 2025);
    expect(c.disposeCount).toBe(0);
    expect(controller.active).toBe(false);
    controller.update(1);
    expect(controller.settledEra).toBeNull();
    expect(completed).toEqual([]);
  });

  it('disposes the settled content on dispose after a completed morph', () => {
    const controller = new TransitionController({ duration: 1, reducedMotion: false });
    const a = new StubBundle('a');
    const b = new StubBundle('b');

    controller.play(a, b, 1965);
    controller.update(1);
    expect(controller.settledEra).toBe(1965);
    expect(b.disposeCount).toBe(0); // settled content stays live

    controller.dispose();
    expect(b.disposeCount).toBe(1);
    expect(a.disposeCount).toBe(1);
  });

  it('unsubscribe detaches listeners', () => {
    const controller = new TransitionController({ duration: 1, reducedMotion: false });
    const progressEvents: number[] = [];
    const completed: EraId[] = [];
    const progressOff = controller.onProgress((progress) => progressEvents.push(progress));
    const completeOff = controller.onComplete((era) => completed.push(era));
    progressOff();
    completeOff();

    controller.play(new StubBundle('a'), new StubBundle('b'), 2025);
    controller.update(1);
    expect(progressEvents).toEqual([]);
    expect(completed).toEqual([]);
  });

  it('rejects unknown eras, duplicate bundles and invalid timing options', () => {
    const controller = new TransitionController();
    const a = new StubBundle('a');
    const b = new StubBundle('b');

    expect(() => controller.play(a, b, 2055 as EraId)).toThrow(/unknown era/);
    expect(() => controller.play(a, a, 1965)).toThrow(/distinct bundles/);
    expect(() => new TransitionController({ duration: -1 })).toThrow();
    expect(() =>
      new TransitionController({ outgoing: { start: 0.5, end: 0.2, ease: easeLinear } }),
    ).toThrow(/window/);
    expect(() => new TransitionController({ outgoingScale: 2 })).toThrow(/outgoingScale/);
  });

  it('treats 0 and negative update deltas as no-ops', () => {
    const controller = new TransitionController({ duration: 1, reducedMotion: false });
    const a = new StubBundle('a');
    const b = new StubBundle('b');
    controller.play(a, b, 1985);

    controller.update(0);
    controller.update(-0.5);
    expect(controller.progress).toBe(0);

    controller.update(1);
    expect(controller.active).toBe(false);
    expect(controller.settledEra).toBe(1985);
  });
});

describe('easing helpers', () => {
  it('clamps windowed and staggered progress into [0, 1]', () => {
    expect(windowProgress(2, 0, 1)).toBe(1);
    expect(windowProgress(-1, 0.3, 1)).toBe(0);
    expect(windowProgress(0.5, 0.5, 1)).toBe(0);
    expect(staggerProgress(0, 3, 0, 1, 0)).toBe(0);
    expect(staggerProgress(2, 3, 0, 1, 1)).toBe(1);
    // count = 1 collapses the wave into the plain window progress.
    expect(staggerProgress(0, 1, 0, 1, 0.4)).toBeCloseTo(0.4, 9);
    expect(staggerProgress(0, 3, 0, 1, 0.5)).toBeCloseTo(1, 9); // leader already done
    expect(staggerProgress(2, 3, 0, 1, 0.5)).toBe(0); // trailer not started yet
    expect(staggerProgress(2, 3, 0, 1, 5 / 6)).toBeCloseTo(0.5, 9); // trailer mid-wave
  });

  it('implements the documented curves at reference points', () => {
    expect(easeLinear(0.5)).toBe(0.5);
    expect(easeInCubic(0.5)).toBeCloseTo(0.125, 9);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 9);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 9);
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(1.4)).toBe(1);
  });
});