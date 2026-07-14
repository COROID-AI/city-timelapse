import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ERAS } from '../config/eras';
import { EraTransition } from './EraTransition';
import { AudioEngine } from '../audio/AudioEngine';
import { Buildings } from '../scene/Buildings';
import { GroundStreet } from '../scene/GroundStreet';
import { SkyEnvironment } from '../scene/SkyEnvironment';
import { Vehicles } from '../scene/Vehicles';
import { StreetProps } from '../scene/StreetProps';
import { Effects } from '../scene/Effects';
import { PostFX } from '../postprocessing/PostFX';
import { Timeline } from '../ui/Timeline';
import { HUD } from '../ui/HUD';
import { LoadingScreen } from '../ui/LoadingScreen';

export class App {
  private container: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private transition!: EraTransition;
  private audio!: AudioEngine;
  private buildings!: Buildings;
  private ground!: GroundStreet;
  private sky!: SkyEnvironment;
  private vehicles!: Vehicles;
  private props!: StreetProps;
  private effects!: Effects;
  private postfx!: PostFX;
  private timeline!: Timeline;
  private hud!: HUD;
  private loading!: LoadingScreen;
  private startTime = 0;
  private lastFrameTime = 0;
  private playing = false;
  private playTimer = 0;
  private readonly playInterval = 3.2;
  private rafId = 0;
  private disposed = false;
  private homeView = new THREE.Vector3(0, 14, 42);

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /** Detect WebGL support. Returns false if unavailable. */
  static isWebGLAvailable(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch {
      return false;
    }
  }

  /** DOM fallback shown when WebGL is unavailable. */
  static renderFallback(container: HTMLElement): void {
    container.innerHTML = `
      <div class="webgl-fallback">
        <div class="fallback-inner">
          <h1>City Era Timelapse</h1>
          <p>Your browser does not support WebGL, which is required for this 3D experience.</p>
          <p>Please try a modern browser such as Chrome, Firefox, Edge, or Safari with hardware acceleration enabled.</p>
          <ul class="fallback-eras">
            <li>1945 — Post-war brick &amp; brownstone</li>
            <li>1960 — Mid-century concrete &amp; chrome</li>
            <li>1980 — Neon boom, glass towers by night</li>
            <li>2000 — Glass canyons, turn of the millennium</li>
            <li>2020 — Contemporary LED &amp; green streets</li>
            <li>2040 — Near-future vertical gardens &amp; drones</li>
            <li>2055 — Mega-city holograms &amp; sky-traffic</li>
          </ul>
        </div>
      </div>`;
  }

  async init(): Promise<void> {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.loading = new LoadingScreen(this.container);
    this.loading.setProgress(0.05, 'Detecting WebGL…');

    if (!App.isWebGLAvailable()) {
      this.loading.hide();
      App.renderFallback(this.container);
      return;
    }

    await frame();
    this.loading.setProgress(0.15, 'Creating renderer…');

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.classList.add('scene-canvas');

    await frame();
    this.loading.setProgress(0.3, 'Building scene…');

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc8b080);
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);
    this.camera.position.copy(this.homeView);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 120;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minPolarAngle = 0.1;
    this.controls.target.set(0, 6, 0);

    await frame();
    this.loading.setProgress(0.5, 'Constructing buildings…');
    this.transition = new EraTransition(reduceMotion);
    this.buildings = new Buildings(this.scene);

    await frame();
    this.loading.setProgress(0.62, 'Laying streets…');
    this.ground = new GroundStreet(this.scene);

    await frame();
    this.loading.setProgress(0.72, 'Raising the sky…');
    this.sky = new SkyEnvironment(this.scene);

    await frame();
    this.loading.setProgress(0.8, 'Adding traffic…');
    this.vehicles = new Vehicles(this.scene);

    await frame();
    this.loading.setProgress(0.88, 'Placing props…');
    this.props = new StreetProps(this.scene);

    await frame();
    this.loading.setProgress(0.93, 'Atmospheric effects…');
    this.effects = new Effects(this.scene);

    await frame();
    this.loading.setProgress(0.97, 'Post-processing…');
    this.postfx = new PostFX(this.renderer, this.scene, this.camera);

    this.audio = new AudioEngine();

    // Build UI
    this.hud = new HUD(this.container);
    this.timeline = new Timeline(this.container, {
      onEraChange: (i) => this.requestEra(i),
      onScrub: (p) => this.scrub(p),
      onTogglePlay: () => this.togglePlay(),
      onToggleMute: () => this.toggleMute(),
      onResetView: () => this.resetView(),
      isPlaying: () => this.playing,
      isMuted: () => this.audio?.isMuted() ?? true,
    });

    this.bindEvents();
    // Apply initial era immediately so the scene starts correct.
    this.transition.setIndexInstant(0);
    const w0 = this.transition.getWeights();
    this.applyAll(w0, 0, 0);

    this.loading.setProgress(1, 'Ready');
    await frame();
    this.loading.hide();

    this.startTime = performance.now() / 1000;
    this.lastFrameTime = this.startTime;
    this.loop();
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
    // The audio toggle / play / canvas click all qualify as user gestures.
    this.renderer.domElement.addEventListener('pointerdown', this.onGesture);
    this.controls.addEventListener('change', () => {
      // keep camera bounded within a soft box around the block
      this.clampCamera();
    });
  }

  private onGesture = (): void => {
    if (this.audio && !this.audio.isStarted()) {
      this.audio.start();
    }
  };

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.postfx.setSize(w, h);
  };

  private clampCamera(): void {
    const limit = 90;
    const p = this.camera.position;
    p.x = Math.max(-limit, Math.min(limit, p.x));
    p.z = Math.max(-limit, Math.min(limit, p.z));
    p.y = Math.max(2, Math.min(110, p.y));
  }

  private onKey = (e: KeyboardEvent): void => {
    switch (e.key) {
      case 'ArrowLeft':
        this.requestEra(this.transition.getTargetIndex() - 1);
        break;
      case 'ArrowRight':
        this.requestEra(this.transition.getTargetIndex() + 1);
        break;
      case ' ':
        e.preventDefault();
        this.togglePlay();
        this.timeline.refreshButtons();
        break;
      case 'Home':
        this.requestEra(0);
        break;
      case 'End':
        this.requestEra(ERAS.length - 1);
        break;
      case 'r':
      case 'R':
        this.resetView();
        break;
      case 'm':
      case 'M':
        this.toggleMute();
        this.timeline.refreshButtons();
        break;
    }
  };

  private requestEra(index: number): void {
    const i = Math.max(0, Math.min(ERAS.length - 1, index));
    this.transition.requestIndex(i);
    this.timeline.setSliderValue(i);
    this.onGesture();
  }

  private scrub(p: number): void {
    this.transition.requestProgress(p);
    this.onGesture();
  }

  private togglePlay(): void {
    this.playing = !this.playing;
    this.playTimer = 0;
    this.onGesture();
  }

  private toggleMute(): void {
    this.onGesture();
    if (this.audio.isStarted()) {
      this.audio.toggleMute();
    } else {
      this.audio.start();
      this.audio.setMuted(false);
    }
  }

  private resetView(): void {
    this.camera.position.copy(this.homeView);
    this.controls.target.set(0, 6, 0);
    this.controls.update();
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, Math.max(0.001, now - this.lastFrameTime));
    this.lastFrameTime = now;
    const time = now - this.startTime;

    // Auto-advance playback
    if (this.playing) {
      this.playTimer += dt;
      if (this.playTimer >= this.playInterval) {
        this.playTimer = 0;
        const next = this.transition.getTargetIndex() + 1;
        if (next > ERAS.length - 1) {
          this.playing = false;
          this.timeline.refreshButtons();
        } else {
          this.requestEra(next);
          this.timeline.setSliderValue(next);
        }
      }
    }

    const weights = this.transition.update(dt);
    this.applyAll(weights, dt, time);

    // Slider follow during transition
    this.timeline.setSliderValue(this.transition.getProgress());

    this.controls.update();
    this.postfx.render();

    // Update HUD stats occasionally
    if (Math.floor(time * 2) % 2 === 0) {
      const info = this.renderer.info;
      this.hud.setStats(`draws ${info.render.calls} · tris ${info.render.triangles.toLocaleString()}`);
    }
  };

  private applyAll(weights: Float32Array, dt: number, time: number): void {
    this.sky.update(weights, time);
    this.ground.update(weights);
    this.buildings.update(weights);
    this.vehicles.update(weights, dt, time);
    this.props.update(weights, time);
    this.effects.update(weights, dt);
    this.postfx.update(weights);
    this.audio.update(weights);

    // HUD era description
    const idx = this.transition.getTargetIndex();
    this.hud.setInfo(ERAS[idx].description);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    this.renderer?.domElement.removeEventListener('pointerdown', this.onGesture);
    this.controls?.dispose();
    this.buildings?.dispose();
    this.ground?.dispose();
    this.sky?.dispose();
    this.vehicles?.dispose();
    this.props?.dispose();
    this.effects?.dispose();
    this.postfx?.dispose();
    this.audio?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    if (this.renderer?.domElement?.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}

function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
