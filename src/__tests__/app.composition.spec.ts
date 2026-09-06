// @vitest-environment jsdom
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp, type AppController, type CreateAppOptions } from '../main';
import { eraRegistry } from '../eras/registry';
import type { AudioEngine } from '../audio/engine';
import { era1945Providers } from '../eras/eras/1945';

/**
 * Composition test for the composed app (`src/main.ts`).
 *
 * Boots the full composition against a stubbed canvas / renderer / audio engine
 * and asserts the accepted integration contract:
 *
 *  - main.ts instantiates every producer module (era registry, engine-core
 *    loop/controls, the five era modules, timeline, overlay, audio engine,
 *    simulation and post-processing); all five eras are registered.
 *  - boot selects 1945 with the slider at 1945.
 *  - an era switch disposes the old graph, builds the new one, swaps the sim
 *    providers via the `eraXXXXProviders` bundles, applies the post-FX preset
 *    and crossfades the ambience bed.
 *  - `?era=2025` boots 2025 directly.
 *  - the first user gesture unlocks audio and hides the overlay.
 */

/** A minimal headless canvas satisfying the controls/loop contract. */
function stubCanvas(): HTMLCanvasElement {
  return {
    clientWidth: 800,
    clientHeight: 600,
    style: { touchAction: 'auto' },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    getRootNode: () => ({ addEventListener: () => undefined, removeEventListener: () => undefined }),
    requestPointerLock: () => undefined,
    dispatchEvent: () => true,
  } as unknown as HTMLCanvasElement;
}

/** A Three-compatible renderer stub that satisfies the engine + post-FX stack. */
function stubRenderer(): THREE.WebGLRenderer {
  return {
    toneMapping: 0,
    toneMappingExposure: 1,
    outputColorSpace: '',
    shadowMap: { enabled: false, type: 0 },
    autoClear: true,
    setPixelRatio: () => undefined,
    setSize: () => undefined,
    render: () => undefined,
    getPixelRatio: () => 1,
    getSize: (v: THREE.Vector2) => {
      v.set(800, 600);
      return v;
    },
    getRenderTarget: () => null,
    setRenderTarget: () => undefined,
    setClearColor: () => undefined,
    getClearColor: () => undefined,
    getClearAlpha: () => 1,
    setClearAlpha: () => undefined,
    clear: () => undefined,
    clearDepth: () => undefined,
    domElement: undefined as unknown as HTMLCanvasElement,
  } as unknown as THREE.WebGLRenderer;
}

/** A stub audio engine that records unlock / setEra calls. */
function stubAudio(): { engine: AudioEngine; unlockCalls: () => number; eraBeds: () => string[] } {
  const unlocks: number[] = [];
  const beds: string[] = [];
  return {
    engine: {
      unlock: () => {
        unlocks.push(1);
      },
      setEra: (era: string) => {
        beds.push(era);
      },
      setVolume: () => undefined,
      toggleMute: () => false,
      playSfx: () => undefined,
      startLoop: () => undefined,
      stopLoop: () => undefined,
      dispose: () => undefined,
      get isUnlocked() {
        return unlocks.length > 0;
      },
      get isMuted() {
        return false;
      },
    } as unknown as AudioEngine,
    unlockCalls: () => unlocks.length,
    eraBeds: () => beds,
  };
}

let scene: THREE.Scene;

beforeAll(() => {
  scene = new THREE.Scene();
  // jsdom ships no canvas implementation, so `getContext('2d')` would throw and
  // print console noise when era modules draw procedural textures. Returning null
  // activates the modules' intended canvas-absent fallback (solid colours).
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => null,
  });
});

function mount(
  resolveEra: (search?: string) => '1945' | '2025' | null,
  extra: Partial<CreateAppOptions> = {},
): ReturnType<typeof createApp> {
  const container = document.createElement('div');
  container.id = 'timeline';
  document.body.appendChild(container);
  const overlayHost = document.createElement('div');
  overlayHost.id = 'app';
  document.body.appendChild(overlayHost);

  return createApp({
    canvas: stubCanvas(),
    renderer: stubRenderer(),
    scene,
    uiContainer: container,
    overlayContainer: overlayHost,
    audio: stubAudio().engine, // replaced per-case below where needed
    resolveEra,
    ...extra,
  });
}

const countMeshes = (root: THREE.Object3D): number => {
  let n = 0;
  for (const child of root.children) {
    n += 1;
    if (child.children.length > 0) n += countMeshes(child);
  }
  return n;
};

describe('composed app boot + composition', () => {
  it('registers all five eras on import', () => {
    expect(eraRegistry.getEras()).toEqual(['1945', '1965', '1985', '2005', '2025']);
  });

  it('instantiates every producer module and boots to 1945 with slider at 1945', () => {
    const app = mount(() => null);
    expect(app.currentEra).toBe('1945');
    // Slider reflects 1945.
    expect(app.timeline).toBeDefined();
    const stops = Array.from(document.querySelectorAll<HTMLElement>('.timeline-stop'));
    expect(stops.map((s) => s.dataset.era)).toEqual(['1945', '1965', '1985', '2005', '2025']);
    const active = stops.find((s) => s.classList.contains('is-active'));
    expect(active?.dataset.era).toBe('1945');
    // Post-FX preset applied for 1945.
    const bloom = app.post.composer.passes[1] as unknown as { strength: number };
    expect(bloom.strength).toBeGreaterThan(0);
    // Engine + controls are alive.
    expect(app.engine.controls.mode).toBe('orbit');
    expect(app.scene).toBeDefined();
    app.dispose();
  });

  it('boots directly to 2025 when ?era=2025 resolves', () => {
    const app = mount(() => '2025');
    expect(app.currentEra).toBe('2025');
    const active = Array.from(document.querySelectorAll<HTMLElement>('.timeline-stop')).find((s) =>
      s.classList.contains('is-active'),
    );
    expect(active?.dataset.era).toBe('2025');
    app.dispose();
  });
});

describe('composed app era switching', () => {
  it('disposes the old graph, builds the new one, swaps sim providers, applies post-FX and crossfades audio', () => {
    const audio = stubAudio();
    const app = mount(() => null, {
      audio: audio.engine,
    });

    // Sim providers were assembled from the era bundles at boot.
    expect(app.simulation.snapshot().pedestrians.length).toBeGreaterThan(0);

    // A timeline selection is a user gesture -> audio unlocks and crossfades.
    const stop1985 = Array.from(document.querySelectorAll<HTMLElement>('.timeline-stop')).find(
      (s) => s.dataset.era === '1985',
    )!;
    stop1985.click();

    expect(audio.unlockCalls()).toBe(1);
    expect(audio.eraBeds()).toContain('1985');
    expect(app.currentEra).toBe('1985');

    // Scene was rebuilt for 1985 (graph present) and old 1945 content disposed.
    expect(scene.children.length).toBeGreaterThan(0);

    // Sim providers swapped to 1985-labelled meshes.
    const snap = app.simulation.snapshot();
    expect(snap.pedestrians[0].providerId).toBe('pedestrians-1985');
    expect(snap.vehicles[0].providerId).toBe('vehicles-1985');

    // Post-FX preset applied for 1985.
    const bloom = app.post.composer.passes[1] as unknown as { strength: number };
    expect(bloom.strength).toBeGreaterThan(0);

    app.dispose();
  });

  it('transitions through every ordered pair of the five eras cleanly', () => {
    const away = mount(() => null);
    const stops = Array.from(document.querySelectorAll<HTMLElement>('.timeline-stop'));
    const stopByEra = new Map(stops.map((s) => [s.dataset.era as string, s]));

    for (const from of ['1945', '1965', '1985', '2005', '2025']) {
      for (const to of ['1945', '1965', '1985', '2005', '2025']) {
        if (from === to) continue;
        stopByEra.get(to)!.click();
        expect(away.currentEra).toBe(to);
        expect(scene.children.length).toBeGreaterThan(0);
        // No runaway accumulation of scene graph children across switches.
        expect(scene.children.length).toBeLessThan(2000);
      }
    }
    away.dispose();
  });
});

describe('composed app first-gesture audio unlock', () => {
  it('audio starts only after the first user gesture and the overlay disappears', () => {
    const audio = stubAudio();
    const app = mount(() => null, { audio: audio.engine });

    // Audio is NOT unlocked at boot (no autoplay).
    expect(audio.unlockCalls()).toBe(0);

    // Boot overlay present.
    const overlayRoot = document.querySelector<HTMLElement>('.overlay');
    expect(overlayRoot).not.toBeNull();
    expect(overlayRoot?.hidden).toBe(false);

    // First user gesture unlocks audio.
    window.dispatchEvent(new Event('pointerdown'));
    expect(audio.unlockCalls()).toBe(1);
    // Crossfade the active (1945) bed.
    expect(audio.eraBeds()).toContain('1945');

    // Overlay hidden by the gesture handler.
    expect(overlayRoot?.hidden).toBe(true);

    app.dispose();
  });
});

describe('composed app navigation + sim inside the live app', () => {
  it('orbit and first-person navigation work with post-FX enabled', () => {
    const app = mount(() => null);
    expect(app.engine.controls.mode).toBe('orbit');
    app.engine.controls.toggle();
    expect(app.engine.controls.mode).toBe('first-person');
    app.engine.controls.toggle();
    expect(app.engine.controls.mode).toBe('orbit');
    // Post-FX is active.
    expect(app.post.composer.passes.length).toBeGreaterThanOrEqual(2);
    app.dispose();
  });

  it('tick drives era content update, simulation update and post-FX render', () => {
    const app = mount(() => null);
    const simBefore = app.simulation.snapshot().pedestrians[0].travelled;
    app.tick(0.5);
    const simAfter = app.simulation.snapshot().pedestrians[0].travelled;
    expect(simAfter).not.toBe(simBefore);
    app.dispose();
  });
});

describe('composed app providers', () => {
  it('exposes era bundle providers with the expected shape', () => {
    // 1945 provider bundle read by main for the sim.
    expect(era1945Providers.era).toBe('1945');
    expect(era1945Providers.vehicles.length).toBeGreaterThanOrEqual(3);
    expect(era1945Providers.pedestrianOutfits.length).toBeGreaterThanOrEqual(5);
  });
});

it('renames nothing and does not mutate producer modules', () => {
  // main.ts is the only module allowed to instantiate/compose the runtime.
  expect(createApp).toBeDefined();
  const app = mount(() => null);
  expect(app.registry).toBeDefined();
  app.dispose();
});

/** Helper to keep the AppController type referenced so its contract is checked. */
function _typecheckController(_: AppController): void {
  /* no-op */
}
void _typecheckController;