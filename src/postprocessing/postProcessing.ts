import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Optional post-processing pipeline for the City Time Period Timelapse.
 *
 * Provides:
 *  - ACES filmic tone mapping (applied by {@link OutputPass} using the
 *    renderer's `toneMapping` setting) for a cinematic, high-end look.
 *  - A subtle {@link UnrealBloomPass} so the neon / LED / emissive signage
 *    (1985 neon, 2025 OLED billboards, street lamps) glows without washing
 *    out the scene.
 *
 * The pipeline is fully optional/configurable so low-end devices can disable
 * it and fall back to a plain `renderer.render(...)` call. It is wired through
 * {@link createCityScene} via the `postProcessing` option.
 */
export interface PostProcessingOptions {
  /** Whether post-processing is active (default true). */
  enabled?: boolean;
  /** Bloom strength 0..1 — keep subtle (default 0.32). */
  bloomStrength?: number;
  /** Bloom radius in pixels (default 0.65). */
  bloomRadius?: number;
  /** Luminance threshold above which pixels bloom (default 0.85). */
  bloomThreshold?: number;
  /** Tone-mapping exposure (default 1.0). */
  exposure?: number;
}

export class PostProcessing {
  readonly composer: EffectComposer;
  private readonly enabled: boolean;
  private readonly bloomPass: UnrealBloomPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    options: PostProcessingOptions = {},
  ) {
    this.enabled = options.enabled ?? true;

    const width = renderer.domElement.width;
    const height = renderer.domElement.height;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      options.bloomStrength ?? 0.32,
      options.bloomRadius ?? 0.65,
      options.bloomThreshold ?? 0.85,
    );
    this.composer.addPass(this.bloomPass);

    // Applies renderer tone mapping + sRGB output conversion.
    this.composer.addPass(new OutputPass());
  }

  /** Render the scene through the post-processing chain (or skip if disabled). */
  render(): void {
    if (this.enabled) {
      this.composer.render();
    }
  }

  /** Resize the internal render targets to match the new viewport. */
  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  /** Release GPU resources owned by the composer and its passes. */
  dispose(): void {
    this.composer.dispose();
  }
}
