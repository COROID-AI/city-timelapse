import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import {
  ERA_REGISTRY,
  type EraId,
  type EraSpec,
  type TransitionProgress,
} from './eras';
import { createCityWorld, type CityWorld } from './city-world';

export interface CityAppOptions {
  mount: HTMLElement;
  initialEra?: EraId;
  onEraChange?: (era: EraSpec, transition: TransitionProgress) => void;
}

/**
 * The rendering composition root. Feature builders can add their world to
 * `scene` without owning the renderer, camera, or resize lifecycle.
 */
export class CityApp {
  readonly scene = new THREE.Scene();

  private readonly mount: HTMLElement;
  private readonly onEraChange?: CityAppOptions['onEraChange'];
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private controls?: OrbitControls;
  private cityWorld?: CityWorld;
  private resizeObserver?: ResizeObserver;
  private animationFrame = 0;
  private readonly clock = new THREE.Clock();
  private transitionFrom?: EraId;
  private transitionTarget?: EraId;
  private eraIndex: number;
  private disposed = false;

  constructor(options: CityAppOptions) {
    this.mount = options.mount;
    this.onEraChange = options.onEraChange;
    const requestedEra = options.initialEra ?? ERA_REGISTRY[0].id;
    const requestedIndex = ERA_REGISTRY.findIndex((era) => era.id === requestedEra);
    this.eraIndex = requestedIndex >= 0 ? requestedIndex : 0;

    this.mount.replaceChildren(this.createLoadingState());
    this.initialize();
  }

  get currentEra(): EraSpec {
    return ERA_REGISTRY[this.eraIndex];
  }

  setEra(id: EraId): void {
    const nextIndex = ERA_REGISTRY.findIndex((era) => era.id === id);
    if (nextIndex < 0 || nextIndex === this.eraIndex) {
      return;
    }

    const previousEra = this.currentEra;
    this.eraIndex = nextIndex;
    this.transitionFrom = previousEra.id;
    this.transitionTarget = this.currentEra.id;
    this.cityWorld?.updateEra(this.currentEra);
    this.onEraChange?.(this.currentEra, {
      from: previousEra.id,
      to: this.currentEra.id,
      progress: 0,
      isTransitioning: true,
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('resize', this.resize);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.cityWorld?.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }

      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }

  private initialize(): void {
    try {
      const viewport = document.createElement('div');
      viewport.className = 'scene-viewport';
      viewport.setAttribute('aria-label', 'Interactive 3D city block');

      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.shadowMap.enabled = true;
      viewport.append(this.renderer.domElement);
      this.mount.replaceChildren(viewport);

      this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      this.camera.position.set(9, 6.5, 11);
      this.camera.lookAt(0, 1.3, 0);
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.set(0, 1.4, 0);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.07;
      this.controls.minDistance = 7;
      this.controls.maxDistance = 24;
      this.controls.maxPolarAngle = Math.PI * 0.47;
      this.controls.update();

      this.applyEraAtmosphere();
      this.cityWorld = createCityWorld(this.scene, this.currentEra);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(viewport);
      window.addEventListener('resize', this.resize, { passive: true });
      this.resize();
      this.animate();
    } catch (error) {
      this.showError(error);
    }
  }

  private applyEraAtmosphere(): void {
    const { atmosphere } = this.currentEra.config;
    this.scene.background = new THREE.Color(atmosphere.sky);
    this.scene.fog = new THREE.FogExp2(atmosphere.fog, atmosphere.fogDensity);
  }

  private createLoadingState(): HTMLElement {
    const loading = document.createElement('div');
    loading.className = 'scene-state scene-state--loading';
    loading.innerHTML = '<span class="state-spinner" aria-hidden="true"></span><p>Compiling city systems…</p>';
    return loading;
  }

  private showError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'WebGL could not be initialized.';
    this.mount.replaceChildren();
    const errorState = document.createElement('div');
    errorState.className = 'scene-state scene-state--error';
    errorState.innerHTML = `
      <span class="state-icon" aria-hidden="true">!</span>
      <p class="eyebrow">Renderer unavailable</p>
      <h2>We could not open the city window</h2>
      <p class="state-detail">${this.escapeHtml(message)}</p>
      <p>Try a browser with WebGL enabled, then reload Luna.</p>
    `;
    this.mount.append(errorState);
  }

  private resize = (): void => {
    if (!this.renderer || !this.camera) {
      return;
    }

    const parent = this.renderer.domElement.parentElement;
    const width = Math.max(1, parent?.clientWidth ?? this.mount.clientWidth);
    const height = Math.max(1, parent?.clientHeight ?? this.mount.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private animate = (): void => {
    if (this.disposed || !this.renderer || !this.camera) {
      return;
    }

    this.animationFrame = window.requestAnimationFrame(this.animate);
    this.cityWorld?.update(this.clock.getDelta());
    this.controls?.update();
    this.emitTransitionProgress();
    this.renderer.render(this.scene, this.camera);
  };

  private emitTransitionProgress(): void {
    if (!this.cityWorld || !this.transitionFrom || !this.transitionTarget) {
      return;
    }

    const progress = this.cityWorld.transitionProgress;
    this.onEraChange?.(this.currentEra, {
      from: this.transitionFrom,
      to: this.transitionTarget,
      progress,
      isTransitioning: progress < 1,
    });
    if (progress >= 1) {
      this.transitionFrom = undefined;
      this.transitionTarget = undefined;
    }
  }

  private escapeHtml(value: string): string {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return value.replace(/[&<>'"]/g, (character) => entities[character]);
  }
}
