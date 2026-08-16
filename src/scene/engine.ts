import * as THREE from 'three';
import { MAX_PIXEL_RATIO } from '../util/perfConfig.js';

// ── Renderer factory with shadows + ACES tone mapping ────────────────

export interface EngineOptions {
  /** Optional maximum device pixel ratio clamp */
  maxPixelRatio?: number;
}

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly clock = new THREE.Clock();

  private onResize?: () => void;
  private _maxPixelRatio: number;

  constructor(canvas: HTMLCanvasElement, options?: EngineOptions) {
    this.scene = new THREE.Scene();
    this._maxPixelRatio = options?.maxPixelRatio ?? MAX_PIXEL_RATIO;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    // Clamp initial pixel ratio using adaptive config
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, this._maxPixelRatio),
    );
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Resize handling
    this.onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this.onResize!);
  }

  /** Update the adaptive pixel ratio clamp (called by perf monitor). */
  setAdaptivePixelRatio(ratio: number): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, ratio));
  }

  /** Call when camera frustum changes so aspect stays correct */
  updateCameraAspect(camera: THREE.PerspectiveCamera): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  get size(): { width: number; height: number } {
    return {
      width: this.renderer.domElement.width,
      height: this.renderer.domElement.height,
    };
  }

  render(): void {
    this.renderer.render(this.scene, (this.scene as any).__camera as THREE.Camera);
  }

  animate(callback: (delta: number) => void): void {
    const tick = () => {
      requestAnimationFrame(tick);
      callback(this.clock.getDelta());
      this.render();
    };
    tick();
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize!);
    this.renderer.dispose();
  }
}
