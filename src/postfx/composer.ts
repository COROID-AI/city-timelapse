/**
 * EffectComposer wiring for the neon-racer game.
 *
 * Builds a render pipeline that owns the afterimage/velocity-style motion blur
 * trail in one place the integration task can drive every frame. The camera
 * renders the scene into an EffectComposer and the motion-blur pass (from
 * `./motionBlur`) trails it.
 *
 * Lifecycle contract (consumed by integration-polish):
 *   `instantiate(renderer, scene, camera, options)` -> build the composer
 *   `update(speed, boostIntensity, target)`        -> drive the split-screen
 *   `render()`                                      -> run the passes
 *   `dispose()`                                     -> release all render targets
 *
 * The naming/ownership stays here so `src/main.ts` is never touched; the
 * integration task replaces `renderer.render(...)` with composer.render().
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

import { createMotionBlurPass, type MotionBlurPass } from './motionBlur';

/** Options for building the post-FX composer. */
export interface PostFxOptions {
  /** Pixel ratio the composer renders at (defaults to `renderer.getPixelRatio()`). */
  readonly pixelRatio?: number;
  /** Motion-blur damps at zero speed (baseline afterimage fade). */
  readonly motionBlurIdleDamp?: number;
  /** Motion-blur damp at full speed (0..1; lower = stronger trail). */
  readonly motionBlurSpeedDamp?: number;
  /** Speed (units/s) at which the speed-based blur intensity saturates. */
  readonly blurSpeedMax?: number;
}

/** A fully wired, driveable post-processing pipeline. */
export interface PostFxComposer {
  /** The underlying EffectComposer (integration may add extra passes). */
  readonly composer: EffectComposer;
  /** The motion-blur pass wired into the pipeline. */
  readonly motionBlurPass: MotionBlurPass;
  /** Update blur intensity from the player's speed / boost each frame. */
  update(speed: number, boostIntensity: number, dt: number): void;
  /** Update blur from a full CarState snapshot (integration convenience). */
  updateFrom(target: {
    readonly speed: number;
    readonly boost: number;
  }, dt: number): void;
  /** Run the composed passes (call once per rendered frame). */
  render(): void;
  /** Release every render target / pass the composer owns. */
  dispose(): void;
}

/** Build a post-processing pipeline and wire the motion-blur pass. */
export function createPostFxComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  options: PostFxOptions = {},
): PostFxComposer {
  const composer = new EffectComposer(renderer);

  const apply = (options.pixelRatio ?? renderer.getPixelRatio());
  composer.setPixelRatio(apply);

  // Scene passes first, then the motion-blur trail, then output to screen.
  composer.addPass(new RenderPass(scene, camera));
  const motionBlurPass = createMotionBlurPass({
    idleDamp: options.motionBlurIdleDamp,
    speedDamp: options.motionBlurSpeedDamp,
    speedMax: options.blurSpeedMax,
  });
  composer.addPass(motionBlurPass.pass);

  const update = (speed: number, boostIntensity: number, dt: number): void => {
    motionBlurPass.update(speed, boostIntensity, dt);
  };

  const updateFrom = (
    target: { readonly speed: number; readonly boost: number },
    dt: number,
  ): void => {
    motionBlurPass.update(target.speed, target.boost, dt);
  };

  const render = (): void => {
    // Run the composed pipeline for the current frame.
    composer.render();
  };

  const dispose = (): void => {
    composer.dispose();
    motionBlurPass.dispose();
  };

  return { composer, motionBlurPass, update, updateFrom, render, dispose };
}