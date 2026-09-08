// Post-processing pipeline: EffectComposer + RenderPass + UnrealBloomPass
// (neon glow) + AfterimagePass (speed-scaled motion blur) + OutputPass.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CONFIG } from './config.js';

export class PostFX {
  constructor(renderer, scene, camera) {
    const pf = CONFIG.postfx;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      pf.bloomStrength,
      pf.bloomRadius,
      pf.bloomThreshold,
    );
    this.composer.addPass(this.bloom);

    this.afterimage = new AfterimagePass(pf.afterimageMin);
    this.composer.addPass(this.afterimage);

    this.composer.addPass(new OutputPass());

    this.renderer = renderer;
    this.setResolution();
  }

  /** Map car speed (0..1) to motion-blur damp roughly linearly. */
  setSpeedBlur(speed01) {
    const pf = CONFIG.postfx;
    const damp = pf.afterimageMin + (pf.afterimageMax - pf.afterimageMin) * Math.min(1, Math.max(0, speed01));
    if (this.afterimage.uniforms) {
      this.afterimage.uniforms['damp'].value = damp;
    }
  }

  setResolution() {
    const w = innerWidth;
    const h = innerHeight;
    this.composer.setSize(w, h);
    this.composer.setPixelRatio(Math.min(this.renderer.getPixelRatio(), CONFIG.postfx.pixelRatioCap));
  }

  render(dt) {
    void dt;
    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
    this.bloom.dispose();
    this.afterimage.dispose();
  }
}