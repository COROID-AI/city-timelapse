import * as THREE from 'three';

/**
 * Renderer wrapper that manages a WebGLRenderer instance with
 * antialias, PCFSoft shadows, ACESFilmic tone mapping, sRGB output,
 * and automatic resize handling.
 */
export class SceneEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private _resizeHandler?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0, 8, 16);
    this.camera.lookAt(0, 0, 0);

    // ── Renderer ────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ── Resize handling ─────────────────────────────────────────
    const onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    this._resizeHandler = onResize;
    window.addEventListener('resize', onResize);
  }

  /** Return the current pixel ratio used by the renderer. */
  get pixelRatio(): number {
    return this.renderer.getPixelRatio();
  }

  /** Set tone-mapping exposure dynamically. */
  set exposure(v: number) {
    this.renderer.toneMappingExposure = v;
  }

  /** Get tone-mapping exposure. */
  get exposure(): number {
    return this.renderer.toneMappingExposure;
  }

  /** Manually render a single frame (useful for testing). */
  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Start the continuous animation loop via a registered tick function. */
  startLoop(tickFn: (dt: number, elapsed: number) => void): void {
    if (this._rafId !== undefined) return;
    const loop = (time: number) => {
      this._rafId = requestAnimationFrame(loop);
      const prev = this._lastTime ?? time;
      this._lastTime = time;
      this._elapsed = (time - this._startTime) / 1000;
      const dt = Math.min((time - prev) / 1000, 0.1);
      tickFn(dt, this._elapsed);
    };
    this._rafId = requestAnimationFrame(loop);
    this._startTime = performance.now();
    this._lastTime = this._startTime;
    this._elapsed = 0;
  }

  private _rafId?: number;
  private _startTime = 0;
  private _lastTime = 0;
  private _elapsed = 0;

  /** Current elapsed wall-clock time in seconds. */
  get elapsed(): number {
    return this._elapsed;
  }

  /** Stop the animation loop. */
  stopLoop(): void {
    if (this._rafId !== undefined) {
      cancelAnimationFrame(this._rafId);
      this._rafId = undefined;
    }
  }

  /** Dispose renderer resources and clean up listeners. */
  dispose(): void {
    this.stopLoop();
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = undefined;
    }
    this.renderer.dispose();
  }
}
