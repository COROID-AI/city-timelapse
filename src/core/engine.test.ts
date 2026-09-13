import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraRig } from './cameraRig';
import { SceneEngine, type SceneEngineOptions } from './engine';
import type { CameraView } from './cameraRig';
import { applyAtmosphere, lightStateEquals, type AtmospherePreset } from './lighting';
import type { LightState } from './lighting';
import type { RendererFactoryOptions, SceneRenderer } from './renderer';
import { RenderLoop } from './loop';

/** Deterministic record of every renderer interaction. */
class StubRenderer implements SceneRenderer<string> {
  scene = 'stub-scene';
  sizes: Array<{ width: number; height: number }> = [];
  lightStates: LightState[] = [];
  views: CameraView[] = [];
  renderCount = 0;
  disposed = false;

  resize(width: number, height: number): void {
    this.sizes.push({ width, height });
  }

  applyLighting(state: LightState): void {
    this.lightStates.push(state);
  }

  updateCamera(view: CameraView): void {
    this.views.push(view);
  }

  render(): void {
    this.renderCount += 1;
  }

  dispose(): void {
    this.disposed = true;
  }
}

interface Harness {
  engine: SceneEngine<string>;
  renderer: StubRenderer;
  container: HTMLElement;
  factoryCalls: RendererFactoryOptions[];
}

function makeHarness(overrides: Partial<SceneEngineOptions<string>> = {}): Harness {
  const renderer = new StubRenderer();
  const container = document.createElement('div');
  const factoryCalls: RendererFactoryOptions[] = [];
  const factory = (options: RendererFactoryOptions) => {
    factoryCalls.push(options);
    return renderer;
  };
  const engine = new SceneEngine<string>({ container, factory, ...overrides });
  return { engine, renderer, container, factoryCalls };
}

const PRESET: AtmospherePreset = {
  sky: { top: { r: 0.05, g: 0.1, b: 0.2 }, horizon: { r: 0.7, g: 0.5, b: 0.4 } },
  fog: { color: { r: 0.8, g: 0.8, b: 0.8 }, density: 0.25 },
  sun: { direction: { x: 0.3, y: 0.9, z: 0.1 }, color: { r: 1, g: 0.9, b: 0.7 }, intensity: 2 },
  ambient: { color: { r: 0.4, g: 0.45, b: 0.5 }, intensity: 0.7 },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SceneEngine', () => {
  it('boots with an injectable renderer factory and exposes the scene', () => {
    const { engine, renderer, factoryCalls, container } = makeHarness();
    expect(factoryCalls).toHaveLength(1);
    expect(factoryCalls[0]!.container).toBe(container);
    expect(factoryCalls[0]!.width).toBe(800); // jsdom container reports 0 -> default
    expect(factoryCalls[0]!.height).toBe(600);
    expect(engine.getScene()).toBe(renderer.scene);
    expect(engine.getScene()).toBe('stub-scene');
  });

  it('exposes the required API surface', () => {
    const { engine } = makeHarness();
    expect(typeof engine.getScene).toBe('function');
    expect(typeof engine.getCamera).toBe('function');
    expect(typeof engine.onFrame).toBe('function');
    expect(typeof engine.setAtmosphere).toBe('function');
    expect(typeof engine.start).toBe('function');
    expect(typeof engine.stop).toBe('function');
    expect(typeof engine.step).toBe('function');
    expect(typeof engine.resize).toBe('function');
    expect(typeof engine.dispose).toBe('function');
    expect(engine.getCamera()).toBeInstanceOf(CameraRig);
  });

  it('dispatches frame updates with the fixed timestep and renders once per frame', () => {
    const { engine, renderer } = makeHarness();
    const deltas: number[] = [];
    engine.onFrame((dt) => deltas.push(dt));

    engine.step(1 / 60);
    expect(deltas).toHaveLength(1);
    expect(deltas[0]!).toBeCloseTo(1 / 60, 9);
    expect(renderer.renderCount).toBe(1);

    deltas.length = 0;
    engine.step(3 / 60); // -> three whole fixed steps, one render pass
    expect(deltas).toHaveLength(3);
    expect(deltas[0]!).toBeCloseTo(1 / 60, 9);
    expect(deltas[2]!).toBeCloseTo(1 / 60, 9);
    expect(renderer.renderCount).toBe(2);

    engine.step(0); // sub-step / degenerate frames change nothing
    expect(renderer.renderCount).toBe(2);
  });

  it('onFrame unsubscribe stops delivery', () => {
    const { engine } = makeHarness();
    const calls: number[] = [];
    const unsubscribe = engine.onFrame((dt) => calls.push(dt));
    unsubscribe();
    engine.step(1 / 60);
    expect(calls).toHaveLength(0);
  });

  it('pushes the camera view to the renderer before each render pass', () => {
    const { engine, renderer } = makeHarness();
    engine.step(1 / 60);
    const lastView = renderer.views.at(-1);
    expect(lastView).not.toBeUndefined();
    expect(lastView!.lookAt).toEqual({ x: 0, y: 0, z: 0 });
    expect(lastView!.position).toEqual(engine.getCamera().getView().position);
  });

  it('handles container resizes through the explicit API', () => {
    const { engine, renderer } = makeHarness();
    engine.resize(320, 240);
    expect(renderer.sizes.at(-1)).toEqual({ width: 320, height: 240 });
    expect(engine.getSize()).toEqual({ width: 320, height: 240 });
  });

  it('reacts to window resize events when ResizeObserver is unavailable', () => {
    // Force the window-listener fallback in jsdom.
    vi.stubGlobal('ResizeObserver', undefined);

    const { engine, renderer } = makeHarness();
    engine.resize(500, 400);
    renderer.sizes.length = 0;

    window.dispatchEvent(new Event('resize'));
    // The container reports 0x0 (jsdom), so the engine falls back to the
    // default size — which differs from the explicit 500x400 we set.
    expect(renderer.sizes.at(-1)).toEqual({ width: 800, height: 600 });
    expect(engine.getSize()).toEqual({ width: 800, height: 600 });
  });

  it('setAtmosphere pushes a normalized state and is idempotent', () => {
    const { engine, renderer } = makeHarness();
    expect(renderer.lightStates).toHaveLength(1); // initial neutral state at boot

    engine.setAtmosphere(PRESET);
    const first = renderer.lightStates.at(-1)!;
    expect(lightStateEquals(first, applyAtmosphere(PRESET))).toBe(true);
    expect(engine.getLighting()).toBe(first);

    engine.setAtmosphere(PRESET);
    expect(renderer.lightStates).toHaveLength(3);
    expect(lightStateEquals(renderer.lightStates[1]!, renderer.lightStates[2]!)).toBe(true);

    // null keeps the current state (no reset, no error).
    engine.setAtmosphere(null);
    expect(renderer.lightStates).toHaveLength(4);
    expect(renderer.lightStates[3]).toBe(renderer.lightStates[2]);
  });

  it('start/stop drive the real-time loop lifecycle', () => {
    const { engine } = makeHarness();
    expect(engine.isRunning).toBe(false);
    engine.start();
    expect(engine.isRunning).toBe(true);
    engine.stop();
    expect(engine.isRunning).toBe(false);
    engine.dispose();
  });

  it('dispose releases the renderer, loop and navigation, then every call is inert', () => {
    const target = document.createElement('div');
    const withNavHarness = makeHarness({ navigation: { pointerTarget: target } });
    withNavHarness.engine.start();
    withNavHarness.engine.dispose();
    expect(withNavHarness.renderer.disposed).toBe(true);
    expect(withNavHarness.engine.isRunning).toBe(false);

    const { engine, renderer } = makeHarness();
    engine.start();
    engine.dispose();
    expect(renderer.disposed).toBe(true);
    expect(engine.isRunning).toBe(false);

    const rendersBefore = renderer.renderCount;
    const statesBefore = renderer.lightStates.length;
    engine.step(1 / 60);
    engine.setAtmosphere(PRESET);
    engine.resize(100, 100);
    engine.start();
    expect(renderer.renderCount).toBe(rendersBefore);
    expect(renderer.lightStates).toHaveLength(statesBefore);
  });

  it('wires the built-in navigation controller into the loop', () => {
    const target = document.createElement('div');
    const { engine, renderer } = makeHarness({
      camera: { mode: 'walk', walkSpeed: 8 },
      navigation: { pointerTarget: target },
    });

    const startZ = engine.getCamera().getView().position.z;
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyW' }));
    engine.step(1); // one full second of fixed steps: nav input + damping each step
    const endZ = engine.getCamera().getView().position.z;
    expect(endZ).toBeLessThan(startZ);
    expect(renderer.views.length).toBeGreaterThan(0);
  });
});

describe('RenderLoop', () => {
  it('accumulates frame deltas into whole fixed steps', () => {
    const loop = new RenderLoop({ fixedStepSeconds: 0.1 });
    const deltas: number[] = [];
    let renders = 0;
    loop.addUpdate((dt) => deltas.push(dt));
    loop.onRender(() => {
      renders += 1;
    });

    loop.step(0.25); // two whole 0.1 steps, leftover 0.05, one render
    expect(deltas).toEqual([0.1, 0.1]);
    expect(renders).toBe(1);

    loop.step(0.05); // leftover completes a step
    expect(deltas).toEqual([0.1, 0.1, 0.1]);
    expect(renders).toBe(2);
  });

  it('clamps huge frame gaps so the loop never bursts', () => {
    const loop = new RenderLoop({ fixedStepSeconds: 0.1, maxStepSeconds: 0.1 });
    const deltas: number[] = [];
    loop.addUpdate((dt) => deltas.push(dt));

    loop.step(1000);
    expect(deltas).toHaveLength(1); // 0.1s clamp -> exactly one step
  });

  it('real-time start/stop uses the injected clock', () => {
    vi.useFakeTimers();
    try {
      let now = 0;
      const loop = new RenderLoop({ fixedStepSeconds: 0.1, clock: () => now });
      const deltas: number[] = [];
      loop.addUpdate((dt) => deltas.push(dt));

      loop.start();
      expect(loop.isRunning).toBe(true);
      now = 100;
      vi.advanceTimersByTime(1); // first scheduled frame fires far in the future of its clock
      expect(deltas).toHaveLength(1); // 100ms / 100ms step = one whole step
      loop.stop();
      expect(loop.isRunning).toBe(false);
      loop.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('dispose stops the loop and drops callbacks', () => {
    const loop = new RenderLoop();
    let called = 0;
    loop.addUpdate(() => {
      called += 1;
    });
    loop.dispose();
    loop.step(1);
    expect(called).toBe(0);
    expect(loop.isRunning).toBe(false);
  });
});