/**
 * Main application entry point.
 * Owns the WebGLRenderer, camera, OrbitControls, Scene, and animation loop.
 * Composes all scene modules and manages era transitions.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { stateStore } from './state';
import type { AppState } from './state';
import type { EraId } from './eras';
import { SkyModule } from './scenes/sky';
import { BuildingsModule } from './scenes/buildings';
import { VehiclesModule } from './scenes/vehicles';
import { PropsModule } from './scenes/props';
import { BillboardsModule } from './scenes/billboards';
import { SfxMixer } from './audio/mixer';
import { TimelineUI } from './ui/timeline';

export class CityApp {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private controls: OrbitControls;
  private canvas: HTMLCanvasElement;
  private timer: THREE.Timer;

  // Scene modules
  private sky!: SkyModule;
  private buildings!: BuildingsModule;
  private vehicles!: VehiclesModule;
  private props!: PropsModule;
  private billboards!: BillboardsModule;

  // Audio
  private audioCtx: AudioContext | null = null;
  private sfxMixer: SfxMixer | null = null;

  // UI
  private timeline: TimelineUI;

  // State
  private currentState: AppState;
  private isRunning: boolean = false;
  private resizeObserver: ResizeObserver;

  // Performance
  private dpr: number;
  private frameCount: number = 0;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement, loadingEl: HTMLElement) {
    this.canvas = canvas;
    this.currentState = stateStore.getState();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Check WebGL support
    if (!this.checkWebGLSupport()) {
      this.showFallback(loadingEl);
      throw new Error('WebGL not supported');
    }

    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Initialize scene
    this.scene = new THREE.Scene();

    // Initialize camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    this.camera.position.set(30, 20, 30);
    this.camera.lookAt(0, 5, 0);

    // Initialize controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.2;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 150;

    // Initialize clock
    this.timer = new THREE.Timer();

    // Initialize resize observer
    this.resizeObserver = new ResizeObserver(() => {
      this.onResize();
    });
    this.resizeObserver.observe(window.document.body);

    // Initialize audio (deferred until user gesture)
    this.initAudio();

    // Initialize UI
    this.timeline = new TimelineUI(uiRoot, (era: EraId) => {
      stateStore.setEra(era);
    }, this.currentState.era);

    // Subscribe to state changes
    stateStore.subscribe((state) => {
      this.currentState = state;
      this.timeline.update(state.era);
    });

    // Initialize scene modules (before starting animation)
    this.initModules();

    // Hide loading screen
    loadingEl.style.opacity = '0';
    loadingEl.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      loadingEl.style.display = 'none';
    }, 500);

    // Start the app
    this.start();
  }

  private checkWebGLSupport(): boolean {
    try {
      const gl = this.canvas.getContext('webgl2');
      return !!gl;
    } catch {
      return false;
    }
  }

  private showFallback(loadingEl: HTMLElement): void {
    loadingEl.innerHTML = '<p style="color:#ff6b6b">WebGL is not supported by your browser. Please use a modern browser.</p>';
  }

  private initAudio(): void {
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.sfxMixer = new SfxMixer(this.audioCtx, {
        volume: this.currentState.volume,
        muted: this.currentState.muted,
      });

      // Initialize audio on first user gesture
      const initAudio = () => {
        if (this.sfxMixer) {
          this.sfxMixer.init();
          this.sfxMixer.setEra(this.currentState.era);
        }
        document.removeEventListener('click', initAudio);
        document.removeEventListener('keydown', initAudio);
        document.removeEventListener('touchstart', initAudio);
      };

      document.addEventListener('click', initAudio);
      document.addEventListener('keydown', initAudio);
      document.addEventListener('touchstart', initAudio);
    } catch (e) {
      console.warn('Audio not supported:', e);
    }
  }

  private start(): void {
    this.isRunning = true;
    this.timer.connect(document);
    this.animate();
  }

  private animate = (): void => {
    if (!this.isRunning) return;

    this.timer.update();
    const dt = this.timer.getDelta();
    const state = this.currentState;

    // Update state store (advances era transitions)
    stateStore.update(dt);

    // Handle era transitions
    this.updateEraTransition(state);

    // Update scene modules
    this.sky.update(dt, state);
    this.buildings.update(dt, state);
    this.vehicles.update(dt, state);
    this.props.update(dt, state);
    this.billboards.update(dt, state);

    // Update controls
    this.controls.update();

    // Render
    this.renderer.render(this.scene, this.camera);

    // Demand-based rendering: only render when transitioning or moving
    const isTransitioning = state.isTransitioning;
    const isMoving = (this.controls as any).dragging;
    const shouldRender = isTransitioning || isMoving || this.frameCount % 30 === 0;

    if (shouldRender) {
      requestAnimationFrame(this.animate);
    } else {
      // Throttle to ~30fps when idle
      setTimeout(() => requestAnimationFrame(this.animate), 16);
    }

    this.frameCount++;
  };

  /**
   * Initialize all scene modules. Called after constructor setup.
   */
  initModules(): void {
    this.sky = new SkyModule(this.scene);
    this.buildings = new BuildingsModule(this.scene);
    this.vehicles = new VehiclesModule(this.scene);
    this.props = new PropsModule(this.scene);
    this.billboards = new BillboardsModule(this.scene);

    // Set initial era
    this.sky.setEra(this.currentState.era);
    this.buildings.setEra(this.currentState.era);
    this.vehicles.setEra(this.currentState.era);
    this.props.setEra(this.currentState.era);
    this.billboards.setEra(this.currentState.era);
  }

  private onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  /**
   * Handle era transition updates.
   * Called each frame during transitions.
   */
  private updateEraTransition(state: AppState): void {
    if (state.isTransitioning && state.prevEra) {
      const t = state.transition;
      const fromEra = state.prevEra;
      const toEra = state.era;

      this.sky.updateTransition(toEra, t, fromEra);
      this.buildings.updateTransition(toEra, t, fromEra);
      this.vehicles.updateTransition(toEra, t, fromEra);
      this.props.updateTransition(toEra, t, fromEra);
      this.billboards.updateTransition(toEra, t, fromEra);

      // Update audio
      if (this.sfxMixer) {
        this.sfxMixer.setEra(toEra);
      }
    }
  }

  dispose(): void {
    this.isRunning = false;
    this.resizeObserver.disconnect();
    this.sky.dispose();
    this.buildings.dispose();
    this.vehicles.dispose();
    this.props.dispose();
    this.billboards.dispose();
    this.sfxMixer?.dispose();
    this.renderer.dispose();
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui-root') as HTMLElement;
  const loadingEl = document.getElementById('loading') as HTMLElement;

  const app = new CityApp(canvas, uiRoot, loadingEl);

  // Expose for debugging
  (window as any).cityApp = app;
});
