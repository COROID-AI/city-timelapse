import { Vector2, type Camera, type Scene, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export interface PostProcessing {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
}

/**
 * HDR post-processing pipeline: EffectComposer -> RenderPass -> UnrealBloomPass
 * -> OutputPass.
 *
 * The bloom pass is intentionally active from the start (threshold tuned high)
 * so it is unobtrusive on the placeholder scene but ready to make the neon
 * signage of the 2005+ eras glow once those assets arrive in downstream tasks.
 * OutputPass applies ACES tone mapping + sRGB conversion as the final stage,
 * operating on the linear HDR buffer that bloom reads from.
 */
export function createPostProcessing(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
): PostProcessing {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new Vector2(window.innerWidth, window.innerHeight),
    /* strength */ 0.6,
    /* radius */ 0.4,
    /* threshold */ 0.85,
  );
  composer.addPass(bloom);

  // Tone mapping + output color-space conversion as the final pass.
  composer.addPass(new OutputPass());

  return { composer, bloom };
}
