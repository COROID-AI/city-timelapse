import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ERAS } from '../config/eras';
import type { EraWeights } from '../core/EraTransition';
import { blendScalar } from '../core/mathUtils';

// Pre-computed per-era arrays — built once.
const BLOOM_STRENGTHS = ERAS.map(e => e.bloom.strength);
const BLOOM_THRESHOLDS = ERAS.map(e => e.bloom.threshold);
const BLOOM_RADII = ERAS.map(e => e.bloom.radius);
const TONE_EXPOSURES = ERAS.map(e => e.toneExposure);

// EffectComposer with RenderPass + UnrealBloomPass + OutputPass.
// Bloom strength/threshold/radius and tone-mapping exposure interpolate per era.

export class PostFX {
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private renderer: THREE.WebGLRenderer;
  private tmpVec = new THREE.Vector2();

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer = renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    const size = renderer.getSize(this.tmpVec);
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      ERAS[0].bloom.strength,
      ERAS[0].bloom.radius,
      ERAS[0].bloom.threshold,
    );
    this.composer.addPass(this.bloom);

    this.composer.addPass(new OutputPass());
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloom.setSize(width, height);
  }

  render(): void {
    this.composer.render();
  }

  update(weights: EraWeights): void {
    this.bloom.strength = blendScalar(BLOOM_STRENGTHS, weights, 0);
    this.bloom.threshold = blendScalar(BLOOM_THRESHOLDS, weights, 0);
    this.bloom.radius = blendScalar(BLOOM_RADII, weights, 0);
    this.renderer.toneMappingExposure = blendScalar(TONE_EXPOSURES, weights, 0);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
