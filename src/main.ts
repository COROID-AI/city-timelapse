import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import type { EraConfig, SceneState } from './types';
import { ERA_LIST } from './config/eras';
import { SkyModule } from './scene/sky';
import { GroundModule } from './scene/ground';
import { BuildingsModule } from './scene/buildings';
import { VehiclesModule } from './scene/vehicles';
import { PedestriansModule } from './scene/pedestrians';
import { PropsModule } from './scene/props';
import { ParticlesModule } from './scene/particles';
import { AudioEngine } from './audio/AudioEngine';
import { TimelineUI } from './ui/timeline';
import { lerpN, smoothstep } from './util/math';
import { easeInOutCubic } from './util/easing';

const TRANSITION_DURATION = 2.4; // seconds per era hop
const AUTO_INTERVAL = 6.0; // seconds per era in auto-play

interface Transition {
  fromIndex: number;
  toIndex: number;
  elapsed: number;
  duration: number;
}

class App {
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private scene!: THREE.Scene;

  private sky!: SkyModule;
  private ground!: GroundModule;
  private buildings!: BuildingsModule;
  private vehicles!: VehiclesModule;
  private peds!: PedestriansModule;
  private props!: PropsModule;
  private particles!: ParticlesModule;

  private audio = new AudioEngine();
  private ui!: TimelineUI;

  private modules: { update: (dt: number, s: SceneState) => void }[] = [];

  private currentIndex = 0;
  private transition: Transition | null = null;
  private autoPlay = false;
  private autoTimer = 0;
  private reducedMotion = false;
  private clock = new THREE.Clock();
  private raf = 0;

  async start(): Promise<void> {
    const container = document.getElementById('scene')!;
    const loader = document.getElementById('loader')!;

    if (!this.hasWebGL2()) {
      loader.classList.add('hidden');
      document.getElementById('fallback')!.classList.remove('hidden');
      return;
    }

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // Scene + camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / container.clientHeight,
      0.5,
      1200
    );
    this.camera.position.set(70, 52, 70);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 25;
    this.controls.maxDistance = 260;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(0, 12, 0);

    // Modules
    this.sky = new SkyModule(this.scene, this.renderer);
    this.ground = new GroundModule();
    this.buildings = new BuildingsModule();
    this.vehicles = new VehiclesModule();
    this.peds = new PedestriansModule();
    this.props = new PropsModule();
    this.particles = new ParticlesModule(!this.reducedMotion);

    this.scene.add(
      this.sky.group,
      this.ground.group,
      this.buildings.group,
      this.vehicles.group,
      this.peds.group,
      this.props.group,
      this.particles.group
    );

    this.modules = [this.sky, this.ground, this.buildings, this.vehicles, this.peds, this.props, this.particles];

    // UI
    this.ui = new TimelineUI({
      onEraSelect: (i) => this.selectEra(i),
      onScrub: (p) => this.scrub(p),
      onScrubEnd: () => this.endScrub(),
      onToggleAudio: () => this.toggleAudio(),
      onToggleAuto: () => this.toggleAuto(),
      onResetView: () => this.resetView(),
      isAudioOn: () => this.audio.isStarted && !this.audio.isMuted,
      isAutoOn: () => this.autoPlay
    });

    // Apply initial era to all modules
    this.applyEra(ERA_LIST[0]);

    // Hide loader
    loader.classList.add('hidden');

    // Resize
    window.addEventListener('resize', this.onResize);

    // Start loop
    this.renderer.setAnimationLoop(this.tick);
  }

  private state(): SceneState {
    if (this.transition) {
      const raw = this.transition.elapsed / this.transition.duration;
      return {
        progress: Math.min(1, raw),
        fromIndex: this.transition.fromIndex,
        toIndex: this.transition.toIndex,
        current: ERA_LIST[this.transition.toIndex].id,
        time: this.clock.elapsedTime
      };
    }
    return {
      progress: 0,
      fromIndex: this.currentIndex,
      toIndex: this.currentIndex,
      current: ERA_LIST[this.currentIndex].id,
      time: this.clock.elapsedTime
    };
  }

  private tick = (): void => {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const s = this.state();

    // Advance transition
    if (this.transition) {
      this.transition.elapsed += dt;
      if (this.transition.elapsed >= this.transition.duration) {
        this.currentIndex = this.transition.toIndex;
        this.transition = null;
        this.ui.setEra(this.currentIndex, ERA_LIST[this.currentIndex]);
      } else {
        // Update year/label text during transition
        const t = this.transition.elapsed / this.transition.duration;
        const yr = Math.round(lerpN(ERA_LIST[this.transition.fromIndex].year, ERA_LIST[this.transition.toIndex].year, t));
        this.ui.setYearLabel(yr, ERA_LIST[this.transition.toIndex].name, ERA_LIST[this.transition.toIndex].tagline);
        this.ui.setProgress(this.transition.toIndex / (ERA_LIST.length - 1) * smoothstep(t));
        this.audio.crossfade(ERA_LIST[this.transition.fromIndex], ERA_LIST[this.transition.toIndex], t);
      }
    }

    // Auto-play
    if (this.autoPlay && !this.transition && !this.scrubbing) {
      this.autoTimer += dt;
      if (this.autoTimer >= AUTO_INTERVAL) {
        this.autoTimer = 0;
        const next = (this.currentIndex + 1) % ERA_LIST.length;
        this.selectEra(next);
      }
    }

    this.controls.update();
    for (const m of this.modules) m.update(dt, s);
    this.renderer.render(this.scene, this.camera);
  };

  private applyEra(config: EraConfig): void {
    this.sky.setEra(config);
    this.ground.setEra(config);
    this.buildings.setEra(config);
    this.vehicles.setEra(config);
    this.peds.setEra(config);
    this.props.setEra(config);
    this.particles.setEra(config);
    this.audio.setEra(config);
  }

  private selectEra(index: number): void {
    if (index === this.currentIndex && !this.transition) return;
    const from = this.transition ? this.transition.toIndex : this.currentIndex;
    // Resume audio on first user interaction
    if (!this.audio.isStarted) this.audio.init();
    this.audio.playWhoosh();
    this.transition = {
      fromIndex: from,
      toIndex: index,
      elapsed: 0,
      duration: this.reducedMotion ? 0.5 : TRANSITION_DURATION
    };
  }

  /** During a scrub, set the from/to + progress directly. */
  private scrubbing = false;
  private scrub(value: number): void {
    this.scrubbing = true;
    this.autoPlay = false;
    this.ui.refreshHud();
    const segCount = ERA_LIST.length - 1;
    const scaled = value * segCount;
    const fromIndex = Math.floor(scaled);
    const toIndex = Math.min(fromIndex + 1, segCount);
    const progress = scaled - fromIndex;
    this.transition = {
      fromIndex,
      toIndex,
      elapsed: progress * 1000,
      duration: 1000
    };
    const yr = Math.round(lerpN(ERA_LIST[fromIndex].year, ERA_LIST[toIndex].year, progress));
    this.ui.setYearLabel(yr, ERA_LIST[toIndex].name, ERA_LIST[toIndex].tagline);
    this.currentIndex = progress < 0.5 ? fromIndex : toIndex;
  }

  private endScrub(): void {
    this.scrubbing = false;
    // Snap to nearest era
    if (this.transition) {
      const mid = (this.transition.fromIndex + this.transition.toIndex) / 2;
      const v = this.transition.toIndex / (ERA_LIST.length - 1);
      const nearest = Math.round(v * (ERA_LIST.length - 1));
      void mid;
      this.selectEra(nearest);
    }
  }

  private toggleAudio(): void {
    if (!this.audio.isStarted) {
      this.audio.init();
    } else {
      this.audio.setMuted(!this.audio.isMuted);
    }
    this.ui.refreshHud();
  }

  private toggleAuto(): void {
    this.autoPlay = !this.autoPlay;
    this.autoTimer = 0;
    this.ui.refreshHud();
  }

  private resetView(): void {
    const startPos = this.camera.position.clone();
    const endPos = new THREE.Vector3(70, 52, 70);
    const startTarget = this.controls.target.clone();
    const endTarget = new THREE.Vector3(0, 12, 0);
    const dur = this.reducedMotion ? 0.2 : 1.0;
    let t = 0;
    const tick = () => {
      t += 1 / 60;
      const e = easeInOutCubic(Math.min(1, t / dur));
      this.camera.position.lerpVectors(startPos, endPos, e);
      this.controls.target.lerpVectors(startTarget, endTarget, e);
      if (t < dur) requestAnimationFrame(tick);
    };
    tick();
  }

  private onResize = (): void => {
    const container = document.getElementById('scene')!;
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  private hasWebGL2(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!canvas.getContext('webgl2');
    } catch {
      return false;
    }
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.sky.dispose();
    this.ground.dispose();
    this.buildings.dispose();
    this.vehicles.dispose();
    this.peds.dispose();
    this.props.dispose();
    this.particles.dispose();
    this.renderer.dispose();
  }
}

const app = new App();
void app.start();

// Expose for debugging / teardown tests
(window as unknown as { __cityApp?: App }).__cityApp = app;
