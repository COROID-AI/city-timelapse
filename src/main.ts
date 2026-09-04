/**
 * Composition root: owns the WebGLRenderer, camera, OrbitControls, primary
 * scene, animation loop, resize observer and global disposal. No module
 * starts its own renderer or loop.
 */
import WebGL from 'three/addons/capabilities/WebGL.js';
import { Camera, Color, Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EraId, ERA_IDS, eraIndexOf } from './eras';
import { AppState, createInitialState } from './state';
import { TimelineUi } from './ui/timeline';
import { Overlay } from './ui/overlay';
import { CityScene } from './scene/city';
import { SfxMixer } from './audio/mixer';
import './styles.css';

const TRANSITION_SECONDS = 2.0;

export class CityTimelapseApp {
  private readonly renderer: WebGLRenderer;
  private readonly camera: Camera;
  private readonly scene: Scene;
  private readonly controls: OrbitControls;
  private readonly city: CityScene;
  private readonly state: AppState;
  private readonly ui: TimelineUi;
  private readonly overlay: Overlay;
  private readonly canvas: HTMLCanvasElement;
  private readonly resizeObserver: ResizeObserver;
  private readonly audio: AudioEngine;
  private lastFrameTime = 0;
  private disposed = false;

  constructor() {
    if (!WebGL.isWebGL2Available()) {
      const overlay = new Overlay();
      overlay.showFallback('WebGL 2 is not available on this device.');
      throw new Error('WebGL 2 unavailable');
    }
    this.state = createInitialState();
    this.state.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'city-canvas';
    this.canvas.setAttribute('aria-label', '3D city block timelapse scene');
    document.body.appendChild(this.canvas);

    this.overlay = new Overlay();

    this.renderer = new WebGLRenderer();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    this.camera = new Camera();
    this.camera.position.set(0, 14, 34);
    this.camera.rotation.set(-0.42, 0, 0);

    this.scene = new Scene();
    this.scene.background = new Color(0x1a2a3a);

    this.city = new CityScene();
    this.scene.add(this.city.group);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0, 5, 0);
    this.controls.enableZoom = true;

    this.ui = new TimelineUi({
      onEraSelect: (era) => this.selectEra(era),
      onMuteToggle: (muted) => {
        this.state.muted = muted;
        this.audio.setMuted(muted);
      },
      onQualityChange: (quality) => {
        this.state.quality = quality;
        this.applyQuality(quality);
      },
    });
    this.ui.sync(this.state);

    this.audio = new AudioEngine();

    // First user gesture unlocks audio (autoplay policy).
    const unlock = () => {
      if (this.state.audioUnlocked) {
        return;
      }
      this.state.audioUnlocked = true;
      this.audio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(document.body);

    this.lastFrameTime = performance.now() / 1000;
    this.renderer.setAnimationLoop((time) => this.frame(time));
    this.overlay.setEra(this.state.era);
    this.overlay.hideLoading();
  }

  selectEra(era: EraId): void {
    const targetIdx = eraIndexOf(era);
    if (targetIdx < 0) {
      return;
    }
    this.state.era = era;
    const targetFloat = targetIdx;
    const duration = this.state.reducedMotion ? 0.4 : TRANSITION_SECONDS;
    this.state.transitioning = true;
    this.state.transitionSecondsLeft = duration;
    this.state.transitionDuration = duration;
    this.audio.setEra(era);
    this.ui.sync(this.state);
    this.overlay.setEra(era);
  }

  private frame(time: number): void {
    if (this.disposed) {
      return;
    }
    const now = time / 1000;
    const dt = Math.min(0.1, Math.max(0, now - this.lastFrameTime));
    this.lastFrameTime = now;

    // Advance the eased era float toward the discrete target.
    if (this.state.transitioning) {
      this.state.transitionSecondsLeft -= dt;
      if (this.state.transitionSecondsLeft <= 0) {
        this.state.transitionSecondsLeft = 0;
        this.state.transitioning = false;
        this.state.eraFloat = eraIndexOf(this.state.era);
      } else {
        const progress = 1 - this.state.transitionSecondsLeft / this.state.transitionDuration;
        const eased = easeInOutCubic(progress);
        const target = eraIndexOf(this.state.era);
        this.state.eraFloat = lerp(this.state.eraFloat, target, eased);
      }
    }

    this.city.update(dt, this.state);
    this.controls.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private onResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private applyQuality(quality: number): void {
    const ratio = quality === 0 ? Math.min(window.devicePixelRatio || 1, 2) : quality === 1 ? 1.25 : 1;
    this.renderer.setPixelRatio(ratio);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    this.resizeObserver.disconnect();
    this.city.dispose();
    this.audio.dispose();
    this.ui.dispose();
    this.overlay.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}

function easeInOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Audio engine wrapper around SfxMixer with lazy unlock. */
class AudioEngine {
  private mixer: SfxMixer | null = null;
  private unlocked = false;

  unlock(): void {
    if (this.unlocked) {
      return;
    }
    this.unlocked = true;
    if (typeof AudioContext !== 'undefined') {
      const ctx = new AudioContext();
      this.mixer = new SfxMixer(ctx);
      this.mixer.unlock();
    }
  }

  setMuted(muted: boolean): void {
    this.mixer?.setMuted(muted);
  }

  setEra(era: EraId): void {
    this.mixer?.setEra(era);
  }

  dispose(): void {
    this.mixer?.dispose();
    this.mixer = null;
  }
}

// Boot.
try {
  new CityTimelapseApp();
} catch (err) {
  console.error('City timelapse failed to start:', err);
  const overlay = new Overlay();
  overlay.showFallback('Could not start the 3D scene. Please try a WebGL-capable browser.');
}