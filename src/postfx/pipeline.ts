/**
 * Post-processing pipeline — city-timelapse.
 *
 * Owns the EffectComposer chain that elevates the scene to a polished,
 * era-appropriate look:
 *
 *   RenderPass -> [SSAO-lite (2025 only)] -> UnrealBloomPass -> EraGrading
 *   (grade + grain + vignette) -> OutputPass (tone mapping + color space)
 *
 * Bloom threshold is tuned per era so lamp/neon/digital light sources glow
 * appropriately (1945 gas lamps subtle -> 1985 neon strong -> 2025 crisp LED).
 * The optional SSAO-lite pass is enabled only for 2025.
 *
 * Lifecycle: `bootstrap(renderer, scene, camera)` (create composer + passes),
 * `setSize(w,h)`, `update(year, morphProgress, delta)` (advance the
 * grade/bloom blend and render), `dispose()`.
 *
 * The scene's render loop calls `update(...)` in place of the raw
 * `renderer.render(...)` call; `EraGrading` (in `grading.ts`) supplies the
 * blend uniforms.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { EraGrading, ERA_GRADES } from './grading';
import type { EraKey } from '../data/eraDefinition';

/** The handle returned by the PostPipeline lifecycle. */
export interface PostPipelineHandle {
  /** The EffectComposer owning the pass chain. */
  readonly composer: EffectComposer;
  /** The era color-grade + grain pass (shared with grading.ts). */
  readonly grading: EraGrading;
  /** Currently displayed era. */
  readonly currentYear: EraKey;
  /**
   * Bootstrap the composer + pass chain. Called once after the renderer is
   * initialised.
   */
  bootstrap(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void;
  /** Resize the composer + all passes to `width`/`height`. */
  setSize(width: number, height: number): void;
  /**
   * Advance the era blend and render the full pipeline.
   * `morphProgress` is the eased morph progress in [0,1]; `deltaSeconds`
   * advances animated grain.
   */
  update(year: EraKey, morphProgress: number, deltaSeconds: number): void;
  /** Dispose the composer + all passes. */
  dispose(): void;
}

/**
 * PostPipeline — builds and drives the EffectComposer chain. The bloom pass
 * and optional SSAO-lite are tuned from the current era grade target so the
 * pipeline follows the morph.
 */
export class PostPipeline implements PostPipelineHandle {
  readonly grading = new EraGrading();
  private _composer!: EffectComposer;
  private renderPass!: RenderPass;
  private bloomPass!: UnrealBloomPass;
  private outputPass!: OutputPass;
  private ssaoPass: SSAOPass | null = null;
  private era: EraKey = 1945;
  private width = 1;
  private height = 1;
  private disposed = false;

  get currentYear(): EraKey {
    return this.era;
  }

  get composer(): EffectComposer {
    if (!this._composer) {
      throw new Error('PostPipeline: composer not bootstrapped yet');
    }
    return this._composer;
  }

  bootstrap(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
  ): void {
    if (this._composer) {
      return;
    }
    const size = renderer.getSize(new THREE.Vector2());
    this.width = size.width;
    this.height = size.height;

    this._composer = new EffectComposer(renderer);
    this._composer.setPixelRatio(
      Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2),
    );
    this._composer.setSize(this.width, this.height);

    this.renderPass = new RenderPass(scene, camera);
    this._composer.addPass(this.renderPass);

    // SSAO-lite (2025 only): enabled/disabled per era below.
    this.ssaoPass = new SSAOPass(scene, camera, this.width, this.height);
    this.ssaoPass.enabled = false;
    this.ssaoPass.kernelRadius = 8;
    this.ssaoPass.minDistance = 0.02;
    this.ssaoPass.maxDistance = 0.12;
    this._composer.addPass(this.ssaoPass);

    // Bloom: strength/radius/threshold tuned per era.
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      ERA_GRADES[this.era].bloomStrength,
      ERA_GRADES[this.era].bloomRadius,
      ERA_GRADES[this.era].bloomThreshold,
    );
    this._composer.addPass(this.bloomPass);

    // Era grade + grain + vignette.
    this._composer.addPass(this.grading.pass);

    // OutputPass applies tone mapping + sRGB color space (matches the raw
    // renderer path so the pipeline output is identical in look).
    this.outputPass = new OutputPass();
    this._composer.addPass(this.outputPass);

    this.grading.bootstrap();
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this._composer) {
      this._composer.setSize(width, height);
      this.bloomPass.setSize(width, height);
      if (this.ssaoPass) {
        this.ssaoPass.setSize(width, height);
      }
    }
    this.grading.setSize(width, height);
  }

  update(year: EraKey, morphProgress: number, deltaSeconds: number): void {
    if (this.disposed) {
      return;
    }
    if (!this._composer) {
      throw new Error('PostPipeline: bootstrap() must be called before update()');
    }
    // Reflect the era immediately (bloom/SSAO tune snaps, grade lerps).
    this.era = year;

    // SSAO-lite only for 2025.
    if (this.ssaoPass) {
      this.ssaoPass.enabled = ERA_GRADES[year].ssao;
    }

    // Bloom follows the era grade target (snaps to the destination era so the
    // glow tracks the crossfade's destination cleanly).
    const grade = ERA_GRADES[year];
    this.bloomPass.strength = grade.bloomStrength;
    this.bloomPass.radius = grade.bloomRadius;
    this.bloomPass.threshold = grade.bloomThreshold;

    // Advance the grade/grain blend and render the chain.
    this.grading.update(year, morphProgress, deltaSeconds);
    this._composer.render();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.grading.dispose();
    if (this._composer) {
      this._composer.dispose();
    }
  }
}