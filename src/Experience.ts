import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import type { EraConfig, EraId } from './types';
import { ERA_IDS } from './types';
import { eraConfigAt } from './eras';
import { Sky } from './scene/Sky';
import { Ground } from './scene/Ground';
import { Buildings } from './scene/Buildings';
import { Storefronts } from './scene/Storefronts';
import { Vehicles } from './scene/Vehicles';
import { Pedestrians } from './scene/Pedestrians';
import { AudioEngine } from './audio/AudioEngine';

/** Maps an EraId to its index in the 0..5 progress range. */
function eraIndex(id: EraId): number {
  return ERA_IDS.indexOf(id);
}

/**
 * Top-level controller. Owns the renderer, scene, camera, controls, the
 * post-processing composer (with a plain-render fallback), and all scene
 * modules. Drives a single continuous `eraProgress` that every module reads.
 */
export class Experience {
  // Core three
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  // Manual timer (THREE.Clock is deprecated since r183).
  private startTime = 0;
  private lastTime = 0;
  private controls: OrbitControls;

  // Post-processing
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private useComposer = false;

  // Modules
  private sky: Sky;
  private ground: Ground;
  private buildings: Buildings;
  private storefronts: Storefronts;
  private vehicles: Vehicles;
  private pedestrians: Pedestrians;

  // Audio
  audio = new AudioEngine();

  // Era state
  /** Current continuous position in [0,5]. */
  private eraProgress = 0;
  /** Target continuous position we are easing toward. */
  private targetProgress = 0;
  private currentEraId: EraId = '1945';
  private reducedMotion = false;

  // Default camera transform for reset
  private readonly defaultCamPos = new THREE.Vector3(38, 30, 38);
  private readonly defaultCamTarget = new THREE.Vector3(0, 6, 0);

  // Loop / lifecycle
  private rafId = 0;
  private running = false;
  private resizeObserver: ResizeObserver | null = null;
  private onResize = () => this.resize();

  constructor(canvas: HTMLCanvasElement) {
    this.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    // --- Renderer ---
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap is deprecated in three 0.185; PCFShadowMap is the supported soft type.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // --- Scene & fog ---
    this.scene.background = new THREE.Color(0x0a0e18);
    this.scene.fog = new THREE.FogExp2(0x0a0e18, 0.01);

    // --- Camera ---
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.5,
      600,
    );
    this.camera.position.copy(this.defaultCamPos);

    // --- Controls ---
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.copy(this.defaultCamTarget);
    this.controls.minDistance = 12;
    this.controls.maxDistance = 120;
    this.controls.maxPolarAngle = Math.PI * 0.495; // don't go under the ground
    this.controls.minPolarAngle = 0.1;
    this.controls.update();

    // --- Modules ---
    this.sky = new Sky();
    this.ground = new Ground();
    this.buildings = new Buildings();
    this.storefronts = new Storefronts();
    this.vehicles = new Vehicles();
    this.pedestrians = new Pedestrians();

    this.scene.add(this.sky.group);
    this.scene.add(this.ground.group);
    this.scene.add(this.buildings.group);
    this.scene.add(this.storefronts.group);
    this.scene.add(this.vehicles.group);
    this.scene.add(this.pedestrians.group);

    // --- Post-processing (with graceful fallback) ---
    this.initComposer();

    // --- Resize handling ---
    window.addEventListener('resize', this.onResize);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    // Apply the initial era immediately so the first frame is correct.
    this.eraProgress = 0;
    this.targetProgress = 0;
    this.applyEra(this.getConfig(), 0, 0);
  }

  // --------------------------------------------------------------------
  // Post-processing
  // --------------------------------------------------------------------

  private initComposer(): void {
    try {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));

      this.bloom = new UnrealBloomPass(
        new THREE.Vector2(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2)),
        0.9, // strength
        0.6, // radius
        0.2, // threshold
      );
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      this.useComposer = true;
    } catch (err) {
      // Graceful degradation: fall back to a plain render loop.
      console.warn('EffectComposer init failed; using plain render fallback.', err);
      this.composer = null;
      this.bloom = null;
      this.useComposer = false;
    }
  }

  // --------------------------------------------------------------------
  // Era control
  // --------------------------------------------------------------------

  /** Jump to an era. Animates unless prefers-reduced-motion is set. */
  goToEra(id: EraId): void {
    this.currentEraId = id;
    this.targetProgress = eraIndex(id);
    if (this.reducedMotion) {
      // Skip interpolation but still apply the exact target era fully.
      this.eraProgress = this.targetProgress;
    }
  }

  /** Continuous slider value in [0,5]. */
  setSliderProgress(value: number): void {
    this.targetProgress = THREE.MathUtils.clamp(value, 0, 5);
    if (this.reducedMotion) {
      this.eraProgress = this.targetProgress;
    }
  }

  getCurrentEraId(): EraId {
    return this.currentEraId;
  }

  /** Get the blended config at the current progress. */
  private getConfig(): EraConfig {
    return eraConfigAt(this.eraProgress);
  }

  // --------------------------------------------------------------------
  // Camera reset
  // --------------------------------------------------------------------

  resetCamera(): void {
    if (this.reducedMotion) {
      this.camera.position.copy(this.defaultCamPos);
      this.controls.target.copy(this.defaultCamTarget);
      this.controls.update();
      return;
    }
    // Smooth reset over ~0.8s via internal tween flags
    this.resetting = true;
    this.resetT = 0;
    this.resetFromPos.copy(this.camera.position);
    this.resetFromTarget.copy(this.controls.target);
  }

  private resetting = false;
  private resetT = 0;
  private resetFromPos = new THREE.Vector3();
  private resetFromTarget = new THREE.Vector3();

  // --------------------------------------------------------------------
  // Loop
  // --------------------------------------------------------------------

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.loop();
  }

  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    const time = (now - this.startTime) / 1000;

    // Ease eraProgress toward target (unless reduced-motion, already snapped)
    if (!this.reducedMotion) {
      const ease = 1 - Math.pow(0.001, dt); // ~1-2s to settle
      this.eraProgress = lerp(this.eraProgress, this.targetProgress, ease);
      if (Math.abs(this.eraProgress - this.targetProgress) < 0.001) {
        this.eraProgress = this.targetProgress;
      }
    }

    const cfg = this.getConfig();

    // Camera reset tween
    if (this.resetting) {
      this.resetT += dt / 0.8;
      const t = THREE.MathUtils.clamp(this.resetT, 0, 1);
      const e = t * t * (3 - 2 * t); // smoothstep
      this.camera.position.lerpVectors(this.resetFromPos, this.defaultCamPos, e);
      this.controls.target.lerpVectors(
        this.resetFromTarget,
        this.defaultCamTarget,
        e,
      );
      if (t >= 1) this.resetting = false;
    }

    this.applyEra(cfg, time, dt);

    this.controls.update();

    // Render via composer if available, else plain render (never bypass bloom).
    if (this.useComposer && this.composer) {
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  };

  /** Apply a blended config to all scene modules. */
  private applyEra(cfg: EraConfig, time: number, dt: number): void {
    this.sky.update(cfg, time);
    this.sky.applyFog(this.scene, cfg);
    this.ground.update(cfg);
    this.buildings.update(cfg, this.eraProgress);
    this.storefronts.update(cfg, time);
    this.vehicles.update(cfg, dt, time);
    this.pedestrians.update(cfg, dt, time);

    // Adapt bloom strength to neon / holographic intensity
    if (this.bloom) {
      const neonBoost =
        cfg.storefrontNeon * 0.7 + cfg.storefrontHologram * 0.5 + cfg.neonIntensity * 0.4;
      this.bloom.strength = 0.35 + neonBoost * 0.9;
      this.bloom.threshold = THREE.MathUtils.lerp(0.6, 0.15, neonBoost);
    }

    // Tone-mapping exposure dips slightly at night (1985)
    const dayness = THREE.MathUtils.clamp(cfg.sunIntensity / 1.4, 0.3, 1);
    this.renderer.toneMappingExposure = 0.85 + dayness * 0.35;
  }

  // --------------------------------------------------------------------
  // Resize
  // --------------------------------------------------------------------

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(w, h);
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);
  }

  // --------------------------------------------------------------------
  // Diagnostics / disposal
  // --------------------------------------------------------------------

  /** Renderer info for leak diagnostics. */
  getRendererInfo(): { memory: THREE.WebGLRenderer['info']['memory']; programs: number } {
    return {
      memory: this.renderer.info.memory,
      programs: this.renderer.info.programs?.length ?? 0,
    };
  }

  /** Fully tear down: stop loop, remove listeners, dispose all GPU resources. */
  dispose(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;

    window.removeEventListener('resize', this.onResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.controls.dispose();
    this.audio.dispose();

    this.sky.dispose();
    this.ground.dispose();
    this.buildings.dispose();
    this.storefronts.dispose();
    this.vehicles.dispose();
    this.pedestrians.dispose();

    this.composer?.dispose();
    this.renderer.dispose();
    this.scene.traverse((o) => {
      const any = o as unknown as { geometry?: THREE.BufferGeometry; material?: unknown };
      if (any.geometry) any.geometry.dispose();
    });
  }
}

/** Local lerp to avoid an extra import. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// end of file
