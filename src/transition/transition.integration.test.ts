import { describe, expect, it } from 'vitest';
import type { CameraView } from '../core/cameraRig';
import { SceneEngine } from '../core/engine';
import type { LightState } from '../core/lighting';
import type { RendererFactoryOptions, SceneRenderer } from '../core/renderer';
import { EraStore } from '../era/state';
import { ERA_YEARS, type EraId } from '../era/types';
import { TransitionController, type EraContentBundle, type EraElement } from './transitionController';

/** Minimal headless renderer so the real SceneEngine runs under jsdom. */
class StubRenderer implements SceneRenderer<string> {
  readonly scene = 'stub-scene';

  resize(_width: number, _height: number): void {}
  applyLighting(_state: LightState): void {}
  updateCamera(_view: CameraView): void {}
  render(): void {}
  dispose(): void {}
}

/** One driven element of the stub era content. */
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

/** Stub era content bundle produced per timeline stop. */
class StubBundle implements EraContentBundle {
  readonly group: string;
  readonly elements: StubElement[];
  updateCount = 0;
  disposeCount = 0;

  constructor(group: string, elementCount = 3) {
    this.group = group;
    this.elements = Array.from({ length: elementCount }, () => new StubElement());
  }

  update(_dt: number): void {
    this.updateCount += 1;
  }

  dispose(): void {
    this.disposeCount += 1;
  }
}

interface EraWiring {
  store: EraStore;
  engine: SceneEngine<string>;
  controller: TransitionController;
  bundles: Map<EraId, StubBundle>;
  progressEvents: number[];
  completedEras: EraId[];
  visible(): StubBundle;
  dispose(): void;
}

/**
 * The composition pattern scene-integration will use: a store subscriber
 * reacts to genuine era requests by handing the content registry's current
 * visible bundle back as outgoing, and the engine loop steers the
 * controller's update(dt). The controller's progress is mirrored back into
 * the store so the store's transition state tracks the morph through
 * completion.
 */
function createWiring(): EraWiring {
  const store = new EraStore();
  const engine = new SceneEngine<string>({
    container: document.createElement('div'),
    factory: (options: RendererFactoryOptions) => {
      void options;
      return new StubRenderer();
    },
    width: 320,
    height: 240,
  });
  const controller = new TransitionController({ duration: 1.2, reducedMotion: false });

  const bundles = new Map<EraId, StubBundle>();
  for (const era of ERA_YEARS) {
    bundles.set(era, new StubBundle(`era-${era}`, 3));
  }

  const progressEvents: number[] = [];
  const completedEras: EraId[] = [];
  controller.onProgress((progress) => progressEvents.push(progress));
  controller.onComplete((era) => {
    completedEras.push(era);
    // Settle the store so the UI/audio wiring sees the finished state.
    store.setTransitionProgress(1);
  });
  // Keep the store's transition progress mirrored while a morph is running.
  controller.onProgress((progress) => {
    if (store.transition !== null) {
      store.setTransitionProgress(progress);
    }
  });

  let visibleBundle: StubBundle = bundles.get(store.current)!;
  let requestedEra: EraId = store.current;

  const unsubscribeFrame = engine.onFrame((deltaSeconds) => controller.update(deltaSeconds));
  const unsubscribeStore = store.subscribe((snapshot) => {
    const transition = snapshot.transition;
    if (transition === null || snapshot.current === requestedEra) {
      return; // settle or progress-mirror notification — not a new request
    }
    requestedEra = snapshot.current;
    const incoming = bundles.get(snapshot.current)!;
    controller.play(visibleBundle, incoming, snapshot.current);
    visibleBundle = incoming;
  });

  return {
    store,
    engine,
    controller,
    bundles,
    progressEvents,
    completedEras,
    visible: () => visibleBundle,
    dispose: () => {
      unsubscribeFrame();
      unsubscribeStore();
    },
  };
}

/**
 * Drive the engine's fixed-step loop for `seconds` of simulation. The loop
 * clamps any single `step()` call, so time is advanced in small 1/60 s
 * frames exactly like a real render loop.
 */
function runSeconds(engine: SceneEngine<string>, seconds: number, stepSeconds = 1 / 60): void {
  const frames = Math.max(1, Math.ceil(seconds / stepSeconds));
  for (let i = 0; i < frames; i += 1) {
    engine.step(stepSeconds);
  }
}

describe('TransitionController integration', () => {
  it('swaps era content end to end when an era is selected on the store', () => {
    const wiring = createWiring();
    const initial = wiring.bundles.get(1945)!;
    const next = wiring.bundles.get(2005)!;

    wiring.store.requestEra(2005);

    // The store request immediately opened a morph: planned era bundle is
    // hidden, the previous content is still fully visible at identity scale.
    expect(wiring.controller.active).toBe(true);
    expect(wiring.controller.targetEra).toBe(2005);
    expect(next.elements[0]!.opacity).toBe(0);
    expect(next.elements[0]!.scale).toBeLessThan(1);
    expect(initial.elements[0]!.opacity).toBe(1);
    expect(initial.elements[0]!.scale).toBe(1);

    runSeconds(wiring.engine, 1.5); // drive the whole 1.2s choreography via the engine loop

    expect(wiring.controller.active).toBe(false);
    expect(wiring.controller.settledEra).toBe(2005);

    // Progress ran 0 -> 1 monotonically and completion carried the era.
    expect(wiring.progressEvents[0]).toBe(0);
    expect(wiring.progressEvents.at(-1)).toBe(1);
    for (let i = 1; i < wiring.progressEvents.length; i += 1) {
      expect(wiring.progressEvents[i]!).toBeGreaterThan(wiring.progressEvents[i - 1]!);
    }
    expect(wiring.completedEras).toEqual([2005]);

    // The store settled on the requested era with the transition cleared,
    // and its progress was mirrored along the way.
    expect(wiring.store.current).toBe(2005);
    expect(wiring.store.transition).toBeNull();

    // Content: old bundle dissolved + disposed exactly once, new bundle is
    // fully shown, updated and retained as the visible content.
    expect(initial.disposeCount).toBe(1);
    expect(next.disposeCount).toBe(0);
    expect(next.updateCount).toBeGreaterThan(0);
    next.elements.forEach((element) => {
      expect(element.opacity).toBe(1);
      expect(element.scale).toBe(1);
    });
    expect(wiring.visible()).toBe(next);
  });

  it('retargets cleanly when the slider moves again mid-flight', () => {
    const wiring = createWiring();
    const first = wiring.bundles.get(1945)!;
    const second = wiring.bundles.get(2005)!;
    const third = wiring.bundles.get(1965)!;

    wiring.store.requestEra(2005);
    runSeconds(wiring.engine, 0.5); // half of the 1.2s morph
    expect(wiring.controller.active).toBe(true);

    wiring.store.requestEra(1965); // interruption: 2005 is now unwanted

    // The original outgoing is superseded and disposed exactly once; the
    // half-built 2005 content is reassigned as outgoing, 1965 builds in.
    expect(first.disposeCount).toBe(1);
    expect(second.disposeCount).toBe(0);
    expect(third.disposeCount).toBe(0);

    const secondOpacityBefore = second.elements[0]!.opacity;
    expect(secondOpacityBefore).toBeGreaterThan(0);
    runSeconds(wiring.engine, 1.5); // run the retargeted 1.2s morph out

    // Settled on the newest requested era with exactly one completion.
    expect(wiring.completedEras).toEqual([1965]);
    expect(wiring.controller.settledEra).toBe(1965);
    expect(wiring.controller.active).toBe(false);
    expect(wiring.progressEvents.at(-1)).toBe(1);

    expect(wiring.store.current).toBe(1965);
    expect(wiring.store.transition).toBeNull();

    // No orphaned content: the demodeled 2005 bundle was disposed on settle,
    // 1965 stays live as the visible era content.
    expect(first.disposeCount).toBe(1);
    expect(second.disposeCount).toBe(1);
    expect(third.disposeCount).toBe(0);
    expect(second.elements[0]!.opacity).toBe(0);
    third.elements.forEach((element) => {
      expect(element.opacity).toBe(1);
      expect(element.scale).toBe(1);
    });
    expect(wiring.visible()).toBe(third);
  });

  it('tears down without leaks: unsubscribes, disposes content, further calls inert', () => {
    const wiring = createWiring();
    wiring.store.requestEra(2005);
    wiring.engine.step(1); // mid-morph (1 of 1.2 s)

    wiring.dispose(); // detach frame + store subscriptions
    wiring.controller.dispose();
    wiring.engine.dispose();

    // Every participating bundle is disposed exactly once; untouched eras are
    // left alone.
    expect(wiring.bundles.get(1945)!.disposeCount).toBe(1);
    expect(wiring.bundles.get(2005)!.disposeCount).toBe(1);
    expect(wiring.bundles.get(1965)!.disposeCount).toBe(0);

    // Further stepping and controller calls are inert and never throw.
    wiring.engine.step(1);
    wiring.controller.update(1);
    wiring.controller.play(wiring.bundles.get(1965)!, wiring.bundles.get(1985)!, 1985);
    expect(wiring.controller.active).toBe(false);
    expect(wiring.bundles.get(1965)!.disposeCount).toBe(0);
    expect(wiring.bundles.get(1985)!.disposeCount).toBe(0);
  });
});