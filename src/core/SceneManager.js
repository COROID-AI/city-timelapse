import * as THREE from 'three';
import { WORLD } from './constants.js';

// Owns the renderer, scene graph, fog, and the animation loop. Provides hooks
// for updaters (things that tick every frame) so all gameplay code stays decoupled.
export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.updaters = [];
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.pixelRatioCap = Math.min(window.devicePixelRatio, 1.75);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.pixelRatioCap);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();

    window.addEventListener('resize', () => this.onResize());

    this._bound = this.loop.bind(this);
  }

  add(obj) {
    this.scene.add(obj);
  }

  remove(obj) {
    this.scene.remove(obj);
  }

  registerUpdater(fn) {
    this.updaters.push(fn);
  }

  unregisterUpdater(fn) {
    const i = this.updaters.indexOf(fn);
    if (i >= 0) this.updaters.splice(i, 1);
  }

  onResize() {
    this.renderer.setPixelRatio(this.pixelRatioCap);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  start() {
    this.renderer.setAnimationLoop(this._bound);
  }

  loop() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;
    for (let i = 0; i < this.updaters.length; i++) {
      this.updaters[i](dt, this.elapsed);
    }
  }

  get delta() {
    return this.clock.getDelta();
  }
}
