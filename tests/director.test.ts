// @vitest-environment happy-dom
/**
 * Headless scene-director tests.
 *
 * Every three.js touchpoint is stubbed (`vi.mock('three')`), so the full
 * orchestrator — render loop, lazy ERA_MANIFEST builds, environment profiles,
 * transition choreography, camera, timeline slider and audio hand-off — runs
 * across all five EraIds with no WebGL context and no real GPU work.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { ERA_IDS } from '../src/eras';
import type { EraId } from '../src/eras';
import { SfxMixer } from '../src/audio/mixer';
import { generateAllEraBuffers } from '../src/audio/sfx';
import { createSceneDirector } from '../src/scene/director';
import { MAX_FRAME_DELTA_SECONDS } from '../src/scene/director';
import type { SceneDirector, SceneDirectorMixer, SceneDirectorOptions } from '../src/scene/director';
import { FakeAudioContext, asAudioContext } from './helpers/fakeAudio';

interface StubMaterial {
  opacity: number;
  transparent: boolean;
}

interface StubNode {
  name: string;
  children: StubNode[];
  userData: Record<string, unknown>;
  visible: boolean;
  material?: StubMaterial;
  traverse(callback: (node: StubNode) => void): void;
}

// ---------------------------------------------------------------------------
// Shared mutable test state (safe to reference from vi.mock factories).
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => {
  const log: string[] = [];
  const builderCalls: Record<string, number> = {};
  const materialsByEra: Record<string, StubMaterialLite[]> = {};
  const updates: Record<string, MockLite> = {};
  const renderers: unknown[] = [];
  const cameraHandles: unknown[] = [];
  let timelineOnEraChange: ((id: string) => void) | null = null;
  let timelineHighlighted: string | null = null;

  interface StubMaterialLite {
    opacity: number;
    transparent: boolean;
  }
  interface StubNodeLite {
    name: string;
    children: StubNodeLite[];
    userData: Record<string, unknown>;
    visible: boolean;
    material?: StubMaterialLite;
    traverse(callback: (node: StubNodeLite) => void): void;
  }
  type MockLite = { mock: { calls: unknown[][] }; mockClear(): unknown } & Record<string, unknown>;

  const makeNode = (name: string, extra: Partial<StubNodeLite> = {}): StubNodeLite => {
    const node: StubNodeLite = {
      name,
      children: [],
      userData: {},
      visible: true,
      traverse(callback) {
        callback(this);
        for (const child of this.children) child.traverse(callback);
      },
    };
    return Object.assign(node, extra);
  };

  const api = {
    log,
    builderCalls,
    materialsByEra,
    updates,
    renderers,
    cameraHandles,
    get onEraChange() {
      return timelineOnEraChange;
    },
    get highlighted() {
      return timelineHighlighted;
    },
    setHighlighted(id: string): void {
      timelineHighlighted = id;
    },
    setTimelineSink(sink: (id: string) => void): void {
      timelineOnEraChange = sink;
    },
    emitTimeline(id: string): void {
      timelineOnEraChange?.(id);
    },
    updateMock(id: string): MockLite {
      if (!updates[id]) updates[id] = vi.fn() as unknown as MockLite;
      return updates[id];
    },
    /** One era-group build through (what production resolves to) ERA_MANIFEST. */
    makeEraGroup(id: string): StubNodeLite {
      api.builderCalls[id] = (api.builderCalls[id] ?? 0) + 1;
      const mats: StubMaterialLite[] = [
        { opacity: 1, transparent: false },
        { opacity: 0.6, transparent: true },
      ];
      api.materialsByEra[id] = mats;
      const group = makeNode(`era-${id}`);
      group.children.push(
        makeNode(`${id}-mesh-a`, { material: mats[0] }),
        makeNode(`${id}-mesh-b`, { material: mats[1] }),
      );
      return group;
    },
    reset(): void {
      log.length = 0;
      for (const key of Object.keys(builderCalls)) delete builderCalls[key];
      for (const key of Object.keys(materialsByEra)) delete materialsByEra[key];
      for (const key of Object.keys(updates)) updates[key].mockClear();
      renderers.length = 0;
      cameraHandles.length = 0;
      timelineOnEraChange = null;
      timelineHighlighted = null;
    },
  };
  return api;
});

// ---------------------------------------------------------------------------
// Module mocks (stubbed three.js + subsystem seams).
// ---------------------------------------------------------------------------

vi.mock('three', () => {
  class StubObject3D {
    readonly children: unknown[] = [];
    readonly userData: Record<string, unknown> = {};
    visible = true;
    readonly position = { set: (): void => {}, copy: (): void => {} };

    add(...objects: unknown[]): void {
      this.children.push(...objects);
    }

    traverse(callback: (node: unknown) => void): void {
      const walk = (node: unknown): void => {
        callback(node);
        const children = (node as { children?: unknown[] }).children ?? [];
        for (const child of children) walk(child);
      };
      walk(this);
    }
  }

  class StubScene extends StubObject3D {
    background: unknown = null;
    fog: unknown = null;
  }

  class StubGroup extends StubObject3D {}

  class StubLight extends StubObject3D {
    constructor(_color?: unknown, _intensity?: unknown) {
      super();
    }
  }
  class AmbientLight extends StubLight {}
  class DirectionalLight extends StubLight {}
  class HemisphereLight extends StubLight {}

  class PerspectiveCamera {
    aspect = 1;
    updateProjectionMatrix(): void {}
  }

  class StubWebGLRenderer {
    readonly domElement: HTMLElement = document.createElement('canvas');
    loop: ((time?: number) => void) | null = null;
    renders = 0;
    disposed = false;
    loopRegistrations = 0;
    readonly sizes: Array<{ width: number; height: number; updateStyle: boolean }> = [];

    constructor(_parameters?: unknown) {
      h.renderers.push(this);
    }

    setPixelRatio(_ratio: number): void {}

    setSize(width: number, height: number, updateStyle?: boolean): void {
      this.sizes.push({ width, height, updateStyle: updateStyle === true });
    }

    setAnimationLoop(callback: ((time?: number) => void) | null): void {
      if (callback) this.loopRegistrations += 1;
      this.loop = callback ?? null;
    }

    render(): void {
      this.renders += 1;
    }

    dispose(): void {
      this.disposed = true;
    }
  }

  return {
    Scene: StubScene,
    Group: StubGroup,
    AmbientLight,
    DirectionalLight,
    HemisphereLight,
    PerspectiveCamera,
    WebGLRenderer: StubWebGLRenderer,
  };
});

vi.mock('../src/eras/1945', () => ({
  buildEra1945: () => h.makeEraGroup('1945'),
  update: h.updateMock('1945'),
}));
vi.mock('../src/eras/1965', () => ({
  buildEra1965: () => h.makeEraGroup('1965'),
  update: h.updateMock('1965'),
}));
vi.mock('../src/eras/1985', () => ({
  buildEra1985: () => h.makeEraGroup('1985'),
  update: h.updateMock('1985'),
}));
vi.mock('../src/eras/2005', () => ({
  buildEra2005: () => h.makeEraGroup('2005'),
  update: h.updateMock('2005'),
}));
vi.mock('../src/eras/2025', () => ({
  buildEra2025: () => h.makeEraGroup('2025'),
  update: h.updateMock('2025'),
}));

vi.mock('../src/environment/profiles', () => ({
  ENVIRONMENT_PROFILES: Object.fromEntries(
    ['1945', '1965', '1985', '2005', '2025'].map((id) => [id, { id }]),
  ),
  applyEnvironmentProfile: (_scene: unknown, profile: { id: string }): void => {
    h.log.push(`env:${profile.id}`);
  },
}));

vi.mock('../src/controls/camera', () => ({
  createOrbitCamera: () => {
    const handle = {
      controls: { enabled: true },
      camera: {
        aspect: 1,
        updateProjectionMatrix: (): void => {},
      },
      update: vi.fn(),
      setEnabled: vi.fn(),
      dispose: vi.fn(),
    };
    h.cameraHandles.push(handle);
    return handle;
  },
}));

vi.mock('../src/ui/timeline', () => ({
  createTimelineSlider: (
    _container: HTMLElement,
    onEraChange: (id: string) => void,
  ) => {
    h.setTimelineSink(onEraChange);
    const root = document.createElement('section');
    root.dataset.testid = 'era-timeline';
    return {
      root,
      getEra: (): string | null => h.highlighted,
      setEra: (id: string): void => {
        h.setHighlighted(id);
        h.log.push(`timeline:${id}`);
      },
      dispose: vi.fn(),
    };
  },
}));

vi.mock('../src/audio/sfx', () => ({
  generateAllEraBuffers: vi.fn(() => {
    h.log.push('audio:buffers');
    const layer = () => ({
      ambient: { duration: 2, getChannelData: () => new Float32Array(96) },
      traffic: { duration: 2, getChannelData: () => new Float32Array(96) },
      events: [],
      music: { duration: 2, getChannelData: () => new Float32Array(96) },
    });
    return Object.fromEntries(
      ['1945', '1965', '1985', '2005', '2025'].map((id) => [id, layer()]),
    );
  }),
}));

// ---------------------------------------------------------------------------
// Harness.
// ---------------------------------------------------------------------------

interface StubRendererState {
  loop: ((time?: number) => void) | null;
  renders: number;
  disposed: boolean;
  loopRegistrations: number;
}

interface OrbitHandleState {
  update: Mock;
  setEnabled: Mock;
  dispose: Mock;
}

function lastRenderer(): StubRendererState {
  const renderer = h.renderers.at(-1);
  if (!renderer) throw new Error('No stub WebGLRenderer was constructed.');
  return renderer as StubRendererState;
}

function lastOrbitHandle(): OrbitHandleState {
  const handle = h.cameraHandles.at(-1);
  if (!handle) throw new Error('createOrbitCamera was never called.');
  return handle as OrbitHandleState;
}

function stubMixer(): SceneDirectorMixer & {
  setEra: Mock;
  handleUserGesture: Mock;
  dispose: Mock;
} {
  const mixer = {
    setEra: vi.fn((id: EraId): void => {
      h.log.push(`mixer:${String(id)}`);
    }),
    handleUserGesture: vi.fn(async (): Promise<void> => {}),
    dispose: vi.fn(),
  };
  return mixer as unknown as SceneDirectorMixer & {
    setEra: Mock;
    handleUserGesture: Mock;
    dispose: Mock;
  };
}

const liveDirectors: SceneDirector[] = [];

let container!: HTMLElement;

interface Harness {
  director: SceneDirector;
  rendererState: StubRendererState;
  orbit: OrbitHandleState;
  step(ms?: number): void;
}

function boot(options: SceneDirectorOptions = {}): Harness {
  const director = createSceneDirector(container, {
    ...options,
    onTransitionStart: (from, to) => {
      h.log.push(`transition:${from}->${to}`);
      options.onTransitionStart?.(from, to);
    },
  });
  liveDirectors.push(director);
  director.start();

  const rendererState = lastRenderer();
  let clock = 1000;
  const step = (ms = 1000 / 60): void => {
    clock += ms;
    rendererState.loop?.(clock);
  };
  return { director, rendererState, orbit: lastOrbitHandle(), step };
}

function settle(harness: Pick<Harness, 'director' | 'step'>): void {
  for (let i = 0; i < 600 && harness.director.isTransitioning(); i += 1) {
    harness.step();
  }
  expect(harness.director.isTransitioning()).toBe(false);
}

function findEraGroup(director: SceneDirector, id: EraId): StubNode | undefined {
  const scene = director.scene as unknown as { children: StubNode[] };
  return scene.children.find((child) => child.name === `era-${id}`);
}

function tickSnapshot(): Record<EraId, number> {
  const snapshot = {} as Record<EraId, number>;
  for (const id of ERA_IDS) snapshot[id] = h.updates[id]?.mock.calls.length ?? 0;
  return snapshot;
}

function tickDelta(
  before: Record<EraId, number>,
  after: Record<EraId, number>,
): Record<EraId, number> {
  const delta = {} as Record<EraId, number>;
  for (const id of ERA_IDS) delta[id] = after[id] - before[id];
  return delta;
}

function expectRestoredBaselines(...ids: EraId[]): void {
  for (const id of ids) {
    const mats = h.materialsByEra[id];
    expect(mats[0]).toEqual({ opacity: 1, transparent: false });
    expect(mats[1]).toEqual({ opacity: 0.6, transparent: true });
  }
}

beforeEach(() => {
  h.reset();
  vi.mocked(generateAllEraBuffers).mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  for (const director of liveDirectors.splice(0)) director.dispose();
  container.remove();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------

describe('createSceneDirector', () => {
  it('bootstraps the foundation scene with only the initial era built', () => {
    const mixer = stubMixer();
    const { director } = boot({ mixer });

    expect(director.getEra()).toBe('1945');
    expect(director.isTransitioning()).toBe(false);
    expect(container.querySelector('canvas')).not.toBeNull();
    expect(container.querySelector('[data-testid="era-timeline"]')).not.toBeNull();

    // Bootstrap applies the 1945 environment and syncs the slider highlight.
    expect(h.log).toEqual(['env:1945', 'timeline:1945']);

    // Lazy building: exactly one ERA_MANIFEST builder has run so far.
    expect(h.builderCalls).toEqual({ '1945': 1 });
    expect(findEraGroup(director, '1945')?.visible).toBe(true);

    // Audio is not touched before any user gesture; injected mixer is adopted.
    expect(mixer.setEra).not.toHaveBeenCalled();
    expect(director.getMixer()).toBe(mixer);
    expect(vi.mocked(generateAllEraBuffers)).not.toHaveBeenCalled();
  });

  it('hands off through all five eras in fixed order, lazily building each once', () => {
    const mixer = stubMixer();
    const { director, step } = boot({ mixer });

    const visits: EraId[] = ['1965', '1985', '2005', '2025', '1945'];
    let previous: EraId = '1945';

    for (const target of visits) {
      h.log.length = 0;
      director.setEra(target);

      // Fixed four-step hand-off: mixer → environment → choreography → slider.
      expect(h.log).toEqual([
        `mixer:${target}`,
        `env:${target}`,
        `transition:${previous}->${target}`,
        `timeline:${target}`,
      ]);
      expect(director.isTransitioning()).toBe(true);

      const beforeTicks = tickSnapshot();
      settle({ director, step });
      const delta = tickDelta(beforeTicks, tickSnapshot());

      // Both sides animate during the hand-off; nobody else does.
      expect(delta[previous]).toBeGreaterThan(0);
      expect(delta[target]).toBeGreaterThan(0);
      for (const id of ERA_IDS) {
        if (id !== previous && id !== target) expect(delta[id]).toBe(0);
      }

      // Deterministic endpoint: exactly the target group remains visible
      // (eras not yet visited don't exist in the scene — lazily built).
      expect(findEraGroup(director, target)?.visible).toBe(true);
      for (const id of ERA_IDS) {
        if (id !== target) {
          expect(findEraGroup(director, id)?.visible ?? false).toBe(false);
        }
      }

      // Crossfaded materials restored byte-exact on both sides.
      expectRestoredBaselines(previous, target);
      previous = target;
    }

    expect(mixer.setEra.mock.calls.map((call) => call[0])).toEqual(visits);

    // Every era instantiated exactly once through ERA_MANIFEST despite revisits.
    expect(h.builderCalls).toEqual({
      '1945': 1,
      '1965': 1,
      '1985': 1,
      '2005': 1,
      '2025': 1,
    });

    // Idle frames after the tour tick only the active era (1945 again).
    for (const id of ERA_IDS) h.updates[id]?.mockClear();
    step();
    step();
    const activeTickers = ERA_IDS.filter(
      (id) => (h.updates[id]?.mock.calls.length ?? 0) > 0,
    );
    expect(activeTickers).toEqual([director.getEra()]);
  });

  it('ignores same-era selections without touching any subsystem', () => {
    const mixer = stubMixer();
    const { director } = boot({ mixer });

    h.log.length = 0;
    director.setEra('1945');

    expect(h.log).toEqual([]);
    expect(director.isTransitioning()).toBe(false);
    expect(mixer.setEra).not.toHaveBeenCalled();
    expect(Object.keys(h.builderCalls)).toEqual(['1945']);
  });

  it('throws RangeError on an unknown era id and keeps state intact', () => {
    const mixer = stubMixer();
    const { director } = boot({ mixer });

    h.log.length = 0;
    expect(() => director.setEra('2055' as EraId)).toThrow(RangeError);

    expect(director.getEra()).toBe('1945');
    expect(h.log).toEqual([]);
    expect(mixer.setEra).not.toHaveBeenCalled();
  });

  it('retargets mid-transition deterministically without rebuilding groups', () => {
    const { director, step } = boot({ mixer: stubMixer() });

    director.setEra('1965');
    step();
    step();

    // Incoming group is genuinely mid-fade (opacity moved off its baseline).
    const incomingFaded = h.materialsByEra['1965'][1];
    expect(incomingFaded.transparent).toBe(true);
    expect(incomingFaded.opacity).not.toBe(0.6);

    director.setEra('1985');
    expect(director.getEra()).toBe('1985');
    expect(director.isTransitioning()).toBe(true);

    settle({ director, step });

    expect(findEraGroup(director, '1985')?.visible).toBe(true);
    expect(findEraGroup(director, '1965')?.visible).toBe(false);
    expect(findEraGroup(director, '1945')?.visible).toBe(false);

    // Every touched group ends at its pristine captured baseline.
    expectRestoredBaselines('1945', '1965', '1985');

    // Retargeting reused cached groups — no duplicate manifest builds.
    expect(h.builderCalls['1965']).toBe(1);
    expect(h.builderCalls['1985']).toBe(1);
  });

  it('clamps pathological frame deltas for era update ticks', () => {
    const { step } = boot({ mixer: stubMixer() });

    step(); // prime the internal clock
    h.updates['1945']?.mockClear();
    step(60_000); // tab-switch-sized jump

    const calls = h.updates['1945']?.mock.calls ?? [];
    expect(calls.length).toBe(1);
    const dt = calls[0][0] as number;
    expect(dt).toBeGreaterThan(0);
    expect(dt).toBeLessThanOrEqual(MAX_FRAME_DELTA_SECONDS);
  });

  it('start/stop drive and pause the render loop idempotently', () => {
    const { director, rendererState, orbit, step } = boot({ mixer: stubMixer() });

    const rendersAtBoot = rendererState.renders;
    step();
    expect(rendererState.renders).toBe(rendersAtBoot + 1);
    expect(orbit.update).toHaveBeenCalled();

    director.stop();
    expect(rendererState.loop).toBeNull();
    const frozenRenders = rendererState.renders;
    step();
    expect(rendererState.renders).toBe(frozenRenders);

    director.stop();
    expect(rendererState.loop).toBeNull();

    director.start();
    expect(rendererState.loopRegistrations).toBe(2);
    director.start();
    expect(rendererState.loopRegistrations).toBe(2);
    step();
    expect(rendererState.renders).toBe(frozenRenders + 1);
  });

  it('disposes every subsystem, releases DOM nodes, and is idempotent', () => {
    const mixer = stubMixer();
    const { director, rendererState, orbit, step } = boot({ mixer });

    director.setEra('1965');
    settle({ director, step });

    director.dispose();

    expect(rendererState.disposed).toBe(true);
    expect(rendererState.loop).toBeNull();
    expect(orbit.dispose).toHaveBeenCalledTimes(1);
    expect(mixer.dispose).toHaveBeenCalledTimes(1);
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('[data-testid="era-timeline"]')).toBeNull();

    director.dispose();
    expect(orbit.dispose).toHaveBeenCalledTimes(1);
    expect(mixer.dispose).toHaveBeenCalledTimes(1);

    h.log.length = 0;
    director.setEra('1985');
    expect(h.log).toEqual([]);
    expect(director.getEra()).toBe('1965');
  });

  it('feeds timeline slider interactions back through the same hand-off', () => {
    const { director, step } = boot({ mixer: stubMixer() });

    h.log.length = 0;
    h.emitTimeline('2005');

    expect(h.log).toEqual([
      'mixer:2005',
      'env:2005',
      'transition:1945->2005',
      'timeline:2005',
    ]);
    expect(director.getEra()).toBe('2005');

    settle({ director, step });
    expect(findEraGroup(director, '2005')?.visible).toBe(true);
    expect(findEraGroup(director, '1945')?.visible).toBe(false);
  });

  it('creates the foundation SfxMixer on first user gesture with the pending era', async () => {
    const fakeCtx = new FakeAudioContext();
    const { director, step } = boot({ contextFactory: () => asAudioContext(fakeCtx) });

    // No AudioContext, buffers or mixer exist before a gesture.
    expect(director.getMixer()).toBeNull();
    expect(vi.mocked(generateAllEraBuffers)).not.toHaveBeenCalled();

    director.setEra('1985'); // requested while audio is still gesture-locked
    settle({ director, step });

    document.dispatchEvent(new Event('pointerdown'));

    await vi.waitFor(() => expect(director.getMixer()).toBeInstanceOf(SfxMixer));
    expect(vi.mocked(generateAllEraBuffers)).toHaveBeenCalledTimes(1);
    // Deferred selection became the freshly created mixer's initial era.
    expect((director.getMixer() as unknown as { era: EraId }).era).toBe('1985');

    director.setEra('2025');
    expect((director.getMixer() as unknown as { era: EraId }).era).toBe('2025');

    // Gesture unlock is one-shot: a second gesture must not rebuild audio.
    document.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    expect(vi.mocked(generateAllEraBuffers)).toHaveBeenCalledTimes(1);

    director.dispose();
    await vi.waitFor(() => expect(fakeCtx.closeCount).toBe(1));
  });

  it('honors custom transition lengths and prefers-reduced-motion shortening', () => {
    const fast = boot({ mixer: stubMixer(), transitionSeconds: 0.05 });
    fast.director.setEra('1965');
    let frames = 0;
    while (fast.director.isTransitioning() && frames < 50) {
      fast.step();
      frames += 1;
    }
    expect(frames).toBeLessThanOrEqual(4);
    expect(fast.director.isTransitioning()).toBe(false);

    const matchMediaMock = vi.fn().mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: (): void => {},
      removeEventListener: (): void => {},
      addListener: (): void => {},
      removeListener: (): void => {},
      dispatchEvent: (): boolean => false,
    });
    vi.stubGlobal('matchMedia', matchMediaMock);
    try {
      const reduced = boot({ mixer: stubMixer() }); // defaults → 0.4 s crossfade
      reduced.director.setEra('1985');
      frames = 0;
      while (reduced.director.isTransitioning() && frames < 120) {
        reduced.step();
        frames += 1;
      }
      expect(matchMediaMock).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
      expect(frames).toBeGreaterThan(0);
      expect(frames).toBeLessThanOrEqual(Math.ceil(0.4 * 60) + 1); // 0.4 s @ 60 Hz
      expect(reduced.director.isTransitioning()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
