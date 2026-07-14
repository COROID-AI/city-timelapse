import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// EffectComposer with bloom. Strength is tweened from the current era's value
// so neon-heavy eras bloom strongly and muted eras stay subtle.
export class PostProcessingManager {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.4, // strength
      0.5, // radius
      0.7  // threshold
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.target = 0.4;
    this.current = 0.4;

    window.addEventListener('resize', () => this.onResize());
  }

  setTarget(strength) {
    this.target = strength;
  }

  onResize() {
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.bloom.setSize(window.innerWidth, window.innerHeight);
  }

  update(dt) {
    // smoothly tween bloom strength toward target
    this.current += (this.target - this.current) * Math.min(1, dt * 2.5);
    this.bloom.strength = this.current;
    this.composer.render();
  }
}
