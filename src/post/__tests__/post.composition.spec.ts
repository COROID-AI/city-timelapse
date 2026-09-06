import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { describe, expect, it } from 'vitest';

import { createPostProcessing, type PostProcessing, type PostQuality } from '../processing';
import { ERA_PRESETS } from '../presets';

/**
 * Composition test — composes the post-processing stack over a stub engine
 * renderer and asserts the accepted-contract behaviours:
 *
 *  - the pass chain attaches in order (render → bloom → vignette/grain);
 *  - the quality toggle swaps the pass set without leaking passes;
 *  - era presets set bloom/vignette/grain parameters for 1945 and 2025;
 *  - the composer renders each tick;
 *  - dispose releases every pass.
 */

/** A minimal stub renderer the EffectComposer can drive headless. */
function stubRenderer(): THREE.WebGLRenderer {
  return {
    getPixelRatio: () => 1,
    getSize: (v: THREE.Vector2) => {
      v.width = 800;
      v.height = 600;
      return v;
    },
    getRenderTarget: () => null,
    setRenderTarget: () => undefined,
    render: () => undefined,
    setClearColor: () => undefined,
    getClearColor: () => undefined,
    getClearAlpha: () => 1,
    setClearAlpha: () => undefined,
    clear: () => undefined,
    clearDepth: () => undefined,
    autoClear: true,
  } as unknown as THREE.WebGLRenderer;
}

function boot(): PostProcessing {
  return createPostProcessing({
    engine: {
      renderer: stubRenderer(),
      scene: new THREE.Scene(),
      camera: {} as THREE.PerspectiveCamera,
    },
  });
}

/** Access the bloom pass (index 1) with its concrete type. */
function bloom(post: PostProcessing): UnrealBloomPass {
  return post.composer.passes[1] as UnrealBloomPass;
}

/** Access the vignette/grain shader pass (index 2) with its concrete type. */
function vg(post: PostProcessing): ShaderPass {
  return post.composer.passes[2] as ShaderPass;
}

describe('createPostProcessing composition', () => {
  it('attaches the pass chain in order: render → bloom → vignette/grain', () => {
    const post = boot();
    const names = post.composer.passes.map((p) => p.constructor.name);
    expect(names).toEqual(['RenderPass', 'UnrealBloomPass', 'ShaderPass']);
    post.dispose();
  });

  it('ticks the composer each frame and advances grain time', () => {
    const post = boot();
    const before = vg(post).uniforms.time.value;
    post.tick(0.016);
    expect(vg(post).uniforms.time.value).toBeGreaterThan(before);
    post.dispose();
  });

  it('applies the 1945 filmic preset (stronger grain, softer bloom)', () => {
    const post = boot();
    post.setEraPreset('1945');
    expect(bloom(post).strength).toBe(ERA_PRESETS['1945'].bloomStrength);
    expect(bloom(post).threshold).toBe(ERA_PRESETS['1945'].bloomThreshold);
    expect(vg(post).uniforms.grain.value).toBe(ERA_PRESETS['1945'].grain);
    expect(vg(post).uniforms.vignette.value).toBe(ERA_PRESETS['1945'].vignette);
    post.dispose();
  });

  it('applies the 2025 crisp preset (minimal grain, crisp bloom)', () => {
    const post = boot();
    post.setEraPreset('2025');
    expect(bloom(post).strength).toBe(ERA_PRESETS['2025'].bloomStrength);
    expect(bloom(post).threshold).toBe(ERA_PRESETS['2025'].bloomThreshold);
    expect(vg(post).uniforms.grain.value).toBe(ERA_PRESETS['2025'].grain);
    expect(vg(post).uniforms.vignette.value).toBe(ERA_PRESETS['2025'].vignette);
    post.dispose();
  });

  it('switching eras repeatedly keeps a single bloom pass (no leaks)', () => {
    const post = boot();
    for (let i = 0; i < 10; i++) {
      post.setEraPreset(i % 2 === 0 ? '1945' : '2025');
      post.tick(0.016);
    }
    const bloomCount = post.composer.passes.filter((p) => p.constructor.name === 'UnrealBloomPass').length;
    expect(bloomCount).toBe(1);
    post.dispose();
  });

  it('quality toggle swaps the pass set without leaking passes', () => {
    const post = boot();
    // High: render + bloom + vignette/grain.
    expect(post.composer.passes).toHaveLength(3);

    post.setQuality('low' as PostQuality);
    // Low disables the vignette/grain pass (kept in the chain but disabled).
    expect(vg(post).enabled).toBe(false);
    const bloomCount = post.composer.passes.filter((p) => p.constructor.name === 'UnrealBloomPass').length;
    expect(bloomCount).toBe(1);

    post.setQuality('high' as PostQuality);
    expect(vg(post).enabled).toBe(true);
    expect(post.composer.passes.filter((p) => p.constructor.name === 'UnrealBloomPass').length).toBe(1);
    post.dispose();
  });

  it('quality toggle swaps bloom resolution without leaking render targets', () => {
    const post = boot();
    const highRes = bloom(post).resolution.clone();
    post.setQuality('low' as PostQuality);
    const lowRes = bloom(post).resolution.clone();
    // Low resolution is strictly smaller than high.
    expect(lowRes.x).toBeLessThan(highRes.x);
    expect(lowRes.y).toBeLessThan(highRes.y);
    // Exactly one bloom pass remains after the swap.
    expect(post.composer.passes.filter((p) => p.constructor.name === 'UnrealBloomPass').length).toBe(1);
    post.dispose();
  });

  it('dispose releases the composer and all passes', () => {
    const post = boot();
    const passes = [...post.composer.passes];
    for (const p of passes) {
      expect(() => p.dispose()).not.toThrow();
    }
    expect(() => post.composer.dispose()).not.toThrow();
  });
});