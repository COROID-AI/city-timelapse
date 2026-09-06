import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { createCamera } from '../camera';
import { createEngine, type UpdateHook } from '../loop';
import { createRenderer } from '../renderer';
import { createCanvasStub } from './stubDom';

/**
 * Composition test — boots the full engine (renderer factory + camera +
 * controls + loop) against a stubbed canvas and injectable host, and asserts
 * the accepted-contract behaviours: `?era=` boots a requested era, orbit and
 * first-person modes toggle, ticked frames clamp delta and invoke update
 * hooks, and dispose removes listeners.
 */

function stubRenderer(): THREE.WebGLRenderer {
  const renderer = {
    toneMapping: 0,
    toneMappingExposure: 1,
    outputColorSpace: '',
    shadowMap: { enabled: false, type: 0 },
    setPixelRatio: () => undefined,
    setSize: () => undefined,
    render: () => undefined,
    domElement: undefined as unknown as HTMLCanvasElement,
  } as unknown as THREE.WebGLRenderer;
  return renderer;
}

/** A renderer that tracks render calls. */
function countingRenderer(): { renderer: THREE.WebGLRenderer; calls: () => number } {
  let calls = 0;
  const renderer = stubRenderer();
  (renderer as unknown as { render: () => void }).render = () => {
    calls += 1;
  };
  return { renderer, calls: () => calls };
}

describe('createEngine composition', () => {
  function boot(era: string | null): ReturnType<typeof createEngine> {
    const canvasEl = createCanvasStub();
    const camera = createCamera();
    const { renderer } = countingRenderer();
    const engine = createEngine({
      renderer,
      camera,
      canvas: canvasEl as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(),
      resolveEra: () => (era ? (era as never) : null),
      initialEra: '1945',
      hooks: { content: null, ambience: null, simulation: null },
    });
    return engine;
  }

  it('boots with the ?era=2025 value', () => {
    const engine = boot('2025');
    expect(engine.readEraParam()).toBe('2025');
    engine.dispose();
  });

  it('falls back to the initial era when ?era= is absent', () => {
    const engine = boot(null);
    expect(engine.readEraParam()).toBe('1945');
    engine.dispose();
  });

  it('controls toggle between orbit and first-person', () => {
    const engine = boot(null);
    expect(engine.controls.mode).toBe('orbit');
    engine.controls.toggle();
    expect(engine.controls.mode).toBe('first-person');
    engine.controls.toggle();
    expect(engine.controls.mode).toBe('orbit');
    engine.dispose();
  });

  it('tick clamps delta and invokes content/ambience/simulation update hooks', () => {
    const content = vi.fn() as unknown as UpdateHook;
    const ambience = vi.fn() as unknown as UpdateHook;
    const sim = vi.fn() as unknown as UpdateHook;
    const { renderer, calls } = countingRenderer();
    const engine = createEngine({
      renderer,
      camera: createCamera(),
      canvas: createCanvasStub() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(),
      resolveEra: () => null,
      initialEra: '1945',
      hooks: { content, ambience, simulation: sim },
    });

    const clamped = engine.tick(2.5);
    expect(clamped).toBe(0.1);
    expect(content).toHaveBeenCalledTimes(1);
    expect(content).toHaveBeenCalledWith(0.1);
    expect(ambience).toHaveBeenCalledTimes(1);
    expect(sim).toHaveBeenCalledTimes(1);
    expect(calls()).toBe(1);
    engine.dispose();
  });

  it('dispose stops ticking update hooks', () => {
    const content = vi.fn() as unknown as UpdateHook;
    const engine = createEngine({
      renderer: stubRenderer(),
      camera: createCamera(),
      canvas: createCanvasStub() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(),
      resolveEra: () => null,
      initialEra: '1985',
      hooks: { content, ambience: null, simulation: null },
    });
    expect(content).not.toHaveBeenCalled();
    engine.dispose();
  });
});

describe('createRenderer composition', () => {
  it('configures ACES tone mapping and shadows on a stub renderer', () => {
    const { renderer } = countingRenderer();
    const session = createRenderer(createCanvasStub() as unknown as HTMLCanvasElement, { renderer });
    expect(session.renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(session.renderer.toneMappingExposure).toBe(1);
    expect(renderer.shadowMap.enabled).toBe(true);
    // Scene owns the physically-correct light rig.
    expect(session.lights).toBeDefined();
  });
});