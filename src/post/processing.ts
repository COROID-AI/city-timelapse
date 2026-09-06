import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

import type { EraId } from '../types';
import { presetForEra, type EraPostPreset } from './presets';
import { vignetteGrainShader } from './shaders/vignetteGrain';

/**
 * Cinematic post-processing stack.
 *
 * Owns a Three.js {@link EffectComposer} whose pass chain is, in order:
 *
 *   1. {@link RenderPass}  — renders the scene into an off-screen buffer.
 *   2. {@link UnrealBloomPass} — subtle bloom tuned per era.
 *   3. {@link ShaderPass}  — custom vignette + film-grain shader (final pass,
 *      drawn to screen).
 *
 * The module is driven purely through its returned update hook (`tick`), so
 * the engine loop and era modules never touch post-FX internals. Era presets
 * are applied via `setEraPreset` and the quality toggle swaps the bloom
 * resolution / pass set without leaking render targets.
 */

/** The two supported quality levels. */
export type PostQuality = 'low' | 'high';

/** The minimal renderer/scene/camera surface the composer needs from the engine. */
export interface PostEngine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

/** The post-processing controller handed to the integration owner. */
export interface PostProcessing {
  /** Apply the era-tuned bloom / vignette / grain preset for the given era. */
  setEraPreset(era: EraId): void;
  /** Toggle between low and high quality (swaps bloom resolution / pass set). */
  setQuality(quality: PostQuality): void;
  /** Per-frame update: advance grain animation and render the pass chain. */
  tick(delta: number): void;
  /** Release the composer and every pass (call on teardown). */
  dispose(): void;
  /** The underlying composer, exposed for composition tests / introspection. */
  readonly composer: EffectComposer;
}

/** Fallback resolution used when the renderer cannot report its size. */
const DEFAULT_RESOLUTION = { width: 1280, height: 720 };

/** Bloom radius stays constant; only strength/threshold are era-tunable. */
const BLOOM_RADIUS = 0.5;

/** Resolution scale per quality level (bloom is the expensive pass). */
const RESOLUTION_SCALE: Readonly<Record<PostQuality, number>> = {
  high: 1.0,
  low: 0.5,
};

/** Read the renderer's logical size, falling back to a sane default. */
function rendererResolution(renderer: THREE.WebGLRenderer): { width: number; height: number } {
  if (typeof renderer.getSize === 'function') {
    try {
      const size = renderer.getSize(new THREE.Vector2());
      if (size && size.width > 0 && size.height > 0) {
        return { width: Math.round(size.width), height: Math.round(size.height) };
      }
    } catch {
      // Headless stubs may lack a real WebGL size; fall through.
    }
  }
  return DEFAULT_RESOLUTION;
}

/**
 * Create the post-processing stack over an engine. The returned controller
 * owns the {@link EffectComposer} and its pass chain; the engine drives it by
 * calling `tick` from an existing update hook.
 */
export function createPostProcessing({ engine }: { engine: PostEngine }): PostProcessing {
  const { renderer, scene, camera } = engine;

  // Build the ordered pass chain: render -> bloom -> vignette/grain.
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  let quality: PostQuality = 'high';
  let preset: EraPostPreset = presetForEra('1945');

  const vgPass = new ShaderPass(vignetteGrainShader);
  composer.addPass(vgPass);

  let bloomPass: UnrealBloomPass | null = null;

  /** (Re)create the bloom pass at the resolution for the current quality. */
  function rebuildBloom(): void {
    const { width, height } = rendererResolution(renderer);
    const scale = RESOLUTION_SCALE[quality];
    const resolution = new THREE.Vector2(
      Math.max(2, Math.round(width * scale)),
      Math.max(2, Math.round(height * scale)),
    );

    const next = new UnrealBloomPass(resolution, preset.bloomStrength, BLOOM_RADIUS, preset.bloomThreshold);

    if (bloomPass) {
      composer.removePass(bloomPass);
      bloomPass.dispose();
    }
    composer.insertPass(next, 1);
    bloomPass = next;
  }

  /** Apply the active preset to the current bloom + vignette/grain passes. */
  function applyPreset(): void {
    if (!bloomPass) return;
    bloomPass.strength = preset.bloomStrength;
    bloomPass.threshold = preset.bloomThreshold;
    vgPass.uniforms.vignette.value = preset.vignette;
    vgPass.uniforms.grain.value = preset.grain;
  }

  // Initial construction: high quality, default (1945) preset.
  rebuildBloom();
  applyPreset();

  let grainTime = 0.0;

  return {
    composer,
    setEraPreset(era: EraId): void {
      preset = presetForEra(era);
      applyPreset();
    },
    setQuality(next: PostQuality): void {
      if (next === quality) return;
      quality = next;
      // Low quality drops the grain/vignette pass (the most expensive after
      // bloom) and halves the bloom resolution; high restores both.
      vgPass.enabled = next === 'high';
      rebuildBloom();
      applyPreset();
    },
    tick(delta: number): void {
      grainTime += delta;
      vgPass.uniforms.time.value = grainTime;
      composer.render(delta);
    },
    dispose(): void {
      if (bloomPass) bloomPass.dispose();
      vgPass.dispose();
      renderPass.dispose();
      composer.dispose();
    },
  };
}