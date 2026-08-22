/**
 * Unit tests for the post-processing pipeline with a stubbed renderer and
 * fake composer modules injected through the createPostFX options seam.
 *
 * Injection keeps every bootstrap deterministic: no module-mock resolution
 * races, no mock-registry ordering hazards, and the rejected-module promise in
 * the companion fallback test exercises the exact production failure path.
 *
 * Covers: API shape, pipeline composition/order, emissive-only bloom tuning,
 * composer-driven rendering, resize handling (including requests made before
 * the composer finishes loading), permanent degradation on construction or
 * render failure, per-frame WebGL context-loss bypass and recovery, and
 * idempotent disposal.
 */

import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { createPostFX } from '../src/scene/postfx';
import type { ComposerModules } from '../src/scene/postfx';

type AnyMock = ReturnType<typeof vi.fn>;

interface FakePassRecord {
  kind: string;
  dispose: AnyMock;
  scene?: unknown;
  camera?: unknown;
  uniforms?: Record<string, { value: unknown }>;
}

interface FakeComposerRecord {
  passes: FakePassRecord[];
  render: AnyMock;
  setSize: AnyMock;
  dispose: AnyMock;
}

interface RecordedBloom {
  resolution: unknown;
  strength?: number;
  radius?: number;
  threshold?: number;
}

const h = {
  composers: [] as FakeComposerRecord[],
  blooms: [] as RecordedBloom[],
};

const RENDER_PASS_THROW_SCENE = { sentinel: 'renderpass-throws' };

class FakeEffectComposer {
  passes: FakePassRecord[] = [];
  render = vi.fn();
  setSize = vi.fn();
  dispose = vi.fn();
  constructor(_renderer?: unknown) {
    h.composers.push(this);
  }
  addPass(pass: FakePassRecord): void {
    this.passes.push(pass);
  }
}

class FakeRenderPass {
  kind = 'render';
  dispose = vi.fn();
  scene: unknown;
  camera: unknown;
  constructor(scene: unknown, camera: unknown) {
    if (scene === RENDER_PASS_THROW_SCENE) {
      throw new Error('RenderPass construction exploded');
    }
    this.scene = scene;
    this.camera = camera;
  }
}

class FakeUnrealBloomPass {
  kind = 'bloom';
  dispose = vi.fn();
  constructor(resolution: unknown, strength?: number, radius?: number, threshold?: number) {
    h.blooms.push({ resolution, strength, radius, threshold });
  }
}

function cloneUniformValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'x' in value && 'y' in value) {
    const source = value as { x: number; y: number };
    const clone: {
      x: number;
      y: number;
      set(this: { x: number; y: number }, x: number, y: number): void;
    } = {
      x: source.x,
      y: source.y,
      set(this: { x: number; y: number }, x: number, y: number): void {
        this.x = x;
        this.y = y;
      },
    };
    return clone;
  }
  return value;
}

class FakeShaderPass {
  kind: 'antialias' | 'vignette';
  dispose = vi.fn();
  uniforms: Record<string, { value: unknown }>;
  constructor(shader: object) {
    const uniforms =
      (shader as { uniforms?: Record<string, { value: unknown }> }).uniforms ?? {};
    this.uniforms = Object.fromEntries(
      Object.entries(uniforms).map(([name, uniform]) => [
        name,
        { value: cloneUniformValue(uniform.value) },
      ]),
    );
    this.kind = 'resolution' in this.uniforms ? 'antialias' : 'vignette';
  }
}

const FAKE_FXAA_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: {
      value: {
        x: 1 / 1024,
        y: 1 / 512,
        set(this: { x: number; y: number }, x: number, y: number): void {
          this.x = x;
          this.y = y;
        },
      },
    },
  },
  vertexShader: 'void main() {}',
  fragmentShader: 'void main() {}',
};

function createFakeModules(): ComposerModules {
  return {
    EffectComposer: FakeEffectComposer,
    RenderPass: FakeRenderPass,
    UnrealBloomPass: FakeUnrealBloomPass,
    ShaderPass: FakeShaderPass,
    FXAAShader: FAKE_FXAA_SHADER,
  };
}

interface StubRenderer {
  renderer: THREE.WebGLRenderer;
  state: { contextLost: boolean };
}

function createStubRenderer(
  initialSize: { width: number; height: number } = { width: 1280, height: 720 },
): StubRenderer {
  const state = { contextLost: false };
  const context = { isContextLost: () => state.contextLost };
  const renderer = {
    render: vi.fn(),
    setSize: vi.fn(),
    getPixelRatio: () => 1,
    getSize: (target: { x: number; y: number }) => {
      target.x = initialSize.width;
      target.y = initialSize.height;
      return target;
    },
    getContext: () => context,
  } as unknown as THREE.WebGLRenderer;
  return { renderer, state };
}

/** Deterministic bootstrap settlement: microtasks always beat this timer. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForBundle(): Promise<FakeComposerRecord> {
  await flushMicrotasks();
  if (h.composers.length !== 1 || h.blooms.length !== 1) {
    throw new Error(`bundle not ready (composers: ${h.composers.length}, blooms: ${h.blooms.length})`);
  }
  return h.composers[0];
}

describe('createPostFX', () => {
  let warnSpy: MockInstance;

  beforeEach(() => {
    h.composers.length = 0;
    h.blooms.length = 0;
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns the render/resize/dispose API shape', () => {
    const { renderer } = createStubRenderer();
    const api = createPostFX(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), {
      modules: createFakeModules(),
    });

    expect(Object.keys(api).sort()).toEqual(['dispose', 'render', 'resize']);
    expect(typeof api.render).toBe('function');
    expect(typeof api.resize).toBe('function');
    expect(typeof api.dispose).toBe('function');

    api.dispose();
  });

  it('builds RenderPass -> bloom -> AA -> vignette tuned for emissive-only bloom', async () => {
    const { renderer } = createStubRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    createPostFX(renderer, scene, camera, { modules: createFakeModules() });
    const composer = await waitForBundle();

    expect(composer.passes.map((pass) => pass.kind)).toEqual([
      'render',
      'bloom',
      'antialias',
      'vignette',
    ]);

    const renderPass = composer.passes[0];
    expect(renderPass.scene).toBe(scene);
    expect(renderPass.camera).toBe(camera);

    expect(h.blooms).toHaveLength(1);
    const bloom = h.blooms[0];
    expect(bloom.strength).toBeCloseTo(0.35, 5);
    expect(bloom.radius).toBeGreaterThan(0);
    expect(bloom.radius).toBeLessThan(1);
    // High threshold: only emissive signage/lamps/neon may bloom.
    expect(bloom.threshold).toBeGreaterThanOrEqual(0.7);
    expect(bloom.resolution).toMatchObject({ x: 1280, y: 720 });
  });

  it('renders through the composer instead of the raw renderer once loaded', async () => {
    const { renderer } = createStubRenderer();
    const api = createPostFX(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), {
      modules: createFakeModules(),
    });
    const composer = await waitForBundle();

    api.render();

    expect(composer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('renders directly while the composer modules are still loading', async () => {
    const { renderer } = createStubRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    let resolveModules!: (modules: ComposerModules) => void;
    const pendingModules = new Promise<ComposerModules>((resolve) => {
      resolveModules = resolve;
    });
    const api = createPostFX(renderer, scene, camera, { modules: pendingModules });

    // Synchronous first frame: no composer exists yet.
    api.render();
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenLastCalledWith(scene, camera);

    resolveModules(createFakeModules());
    await flushMicrotasks();

    const composer = h.composers[0];
    api.render();

    expect(composer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it('forwards resizes to the composer and refreshes the FXAA resolution', async () => {
    const { renderer } = createStubRenderer();
    const api = createPostFX(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), {
      modules: createFakeModules(),
    });
    const composer = await waitForBundle();

    api.resize(800, 600);
    api.resize(0, 600);
    api.resize(Number.NaN, 600);
    api.resize(800, -2);

    expect(composer.setSize).toHaveBeenCalledTimes(1);
    expect(composer.setSize).toHaveBeenCalledWith(800, 600);

    const aaPass = composer.passes.find((pass) => pass.kind === 'antialias');
    expect(aaPass).toBeDefined();
    const resolution = aaPass?.uniforms?.resolution?.value as { x: number; y: number };
    expect(resolution.x).toBeCloseTo(1 / 800, 8);
    expect(resolution.y).toBeCloseTo(1 / 600, 8);
    expect(renderer.setSize).not.toHaveBeenCalled();
  });

  it('applies resizes requested before the composer finished loading', async () => {
    const { renderer } = createStubRenderer();
    const api = createPostFX(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), {
      modules: createFakeModules(),
    });

    api.resize(1024, 768);
    expect(renderer.setSize).toHaveBeenCalledWith(1024, 768, false);

    const composer = await waitForBundle();

    expect(composer.setSize).toHaveBeenCalledWith(1024, 768);
    const aaPass = composer.passes.find((pass) => pass.kind === 'antialias');
    const resolution = aaPass?.uniforms?.resolution?.value as { x: number; y: number };
    expect(resolution.x).toBeCloseTo(1 / 1024, 8);
    expect(resolution.y).toBeCloseTo(1 / 768, 8);
  });

  it('falls back to direct rendering when composer construction throws', async () => {
    const { renderer } = createStubRenderer();
    const sentinelScene = RENDER_PASS_THROW_SCENE as unknown as THREE.Scene;
    const camera = new THREE.PerspectiveCamera();
    const api = createPostFX(renderer, sentinelScene, camera, { modules: createFakeModules() });

    await flushMicrotasks();

    // The half-built composer was rolled back.
    expect(h.composers).toHaveLength(1);
    expect(h.composers[0].dispose).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    api.render();
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenLastCalledWith(sentinelScene, camera);

    api.resize(320, 240);
    expect(renderer.setSize).toHaveBeenCalledWith(320, 240, false);
    expect(h.composers[0].setSize).not.toHaveBeenCalled();
  });

  it('degrades permanently after a composer render failure', async () => {
    const { renderer } = createStubRenderer();
    const api = createPostFX(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), {
      modules: createFakeModules(),
    });
    const composer = await waitForBundle();

    composer.render.mockImplementationOnce(() => {
      throw new Error('framebuffer explosion');
    });

    api.render();
    expect(composer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Subsequent frames skip the broken composer entirely.
    api.render();
    api.render();
    expect(composer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalledTimes(3);

    // Resize likewise stops touching the degraded composer.
    api.resize(500, 400);
    expect(composer.setSize).not.toHaveBeenCalled();
    expect(renderer.setSize).toHaveBeenCalledWith(500, 400, false);
  });

  it('bypasses the composer per-frame while the WebGL context is lost', async () => {
    const { renderer, state } = createStubRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const api = createPostFX(renderer, scene, camera, { modules: createFakeModules() });
    const composer = await waitForBundle();

    state.contextLost = true;
    api.render();
    expect(composer.render).not.toHaveBeenCalled();
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenLastCalledWith(scene, camera);

    // Context restored: the healthy composer takes over again.
    state.contextLost = false;
    api.render();
    expect(composer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it('disposes every resource exactly once and stays inert afterwards', async () => {
    const { renderer } = createStubRenderer();
    const api = createPostFX(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), {
      modules: createFakeModules(),
    });
    const composer = await waitForBundle();

    api.dispose();

    expect(composer.dispose).toHaveBeenCalledTimes(1);
    for (const pass of composer.passes) {
      expect(pass.dispose).toHaveBeenCalledTimes(1);
    }

    api.dispose();
    expect(composer.dispose).toHaveBeenCalledTimes(1);

    api.render();
    api.resize(200, 200);
    expect(composer.render).not.toHaveBeenCalled();
    expect(renderer.render).not.toHaveBeenCalled();
    expect(renderer.setSize).not.toHaveBeenCalled();
  });
});
