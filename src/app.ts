import * as THREE from 'three';

import {
  ERA_REGISTRY,
  type EraId,
  type EraSpec,
  type TransitionProgress,
} from './eras';
import { createCityWorld, type CityQualityTier, type CityWorld } from './city-world';

export interface CityAppOptions {
  mount: HTMLElement;
  initialEra?: EraId;
  qualityTier?: CityQualityTier;
  onEraChange?: (era: EraSpec, transition: TransitionProgress) => void;
}


/**
 * Rendering and exploration composition root. The city is kept in one scene
 * while era changes interpolate its shared world state in place.
 */
export class CityApp {
  readonly scene = new THREE.Scene();

  private readonly mount: HTMLElement;
  private readonly onEraChange?: CityAppOptions['onEraChange'];
  private readonly qualityTier: CityQualityTier;
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private viewport?: HTMLElement;
  private cityWorld?: CityWorld;
  private resizeObserver?: ResizeObserver;
  private animationFrame = 0;
  private transitionFrom?: EraId;
  private transitionTarget?: EraId;
  private eraIndex: number;
  private disposed = false;
  private paused = false;
  private keys = new Set<string>();
  private pointerId?: number;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance?: number;
  private pointerX = 0;
  private pointerY = 0;
  private yaw = 0.63;
  private pitch = 0.38;
  private radius = 14.5;
  private target = new THREE.Vector3(0, 1.8, 0);
  private lastFrame = 0;

  constructor(options: CityAppOptions) {
    this.mount = options.mount;
    this.onEraChange = options.onEraChange;
    this.qualityTier = options.qualityTier ?? this.detectQualityTier();
    const requestedEra = options.initialEra ?? ERA_REGISTRY[0].id;
    const requestedIndex = ERA_REGISTRY.findIndex((era) => era.id === requestedEra);
    this.eraIndex = requestedIndex >= 0 ? requestedIndex : 0;
    this.mount.replaceChildren(this.createLoadingState());
    this.initialize();
  }

  get currentEra(): EraSpec {
    return ERA_REGISTRY[this.eraIndex];
  }

  get isTransitioning(): boolean {
    return this.transitionTarget !== undefined;
  }

  get quality(): CityQualityTier { return this.qualityTier; }

  setEra(id: EraId): void {
    if (this.disposed) return;
    const nextIndex = ERA_REGISTRY.findIndex((era) => era.id === id);
    if (nextIndex < 0 || nextIndex === this.eraIndex) return;
    const previousEra = this.transitionTarget
      ? ERA_REGISTRY.find((era) => era.id === this.transitionTarget) ?? this.currentEra
      : this.currentEra;
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

  resetView(): void {
    this.yaw = 0.63;
    this.pitch = 0.38;
    this.radius = 14.5;
    this.target.set(0, 1.8, 0);
    this.updateCamera();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  togglePaused(): boolean {
    this.paused = !this.paused;
    return this.paused;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.resizeObserver?.disconnect();
    this.viewport?.removeEventListener('pointerdown', this.onPointerDown);
    this.viewport?.removeEventListener('pointermove', this.onPointerMove);
    this.viewport?.removeEventListener('pointerup', this.onPointerUp);
    this.viewport?.removeEventListener('pointercancel', this.onPointerUp);
    this.viewport?.removeEventListener('wheel', this.onWheel);
    this.cityWorld?.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }

  private initialize(): void {
    try {
      if (!('WebGLRenderingContext' in window) || !document.createElement('canvas').getContext('webgl')) {
        throw new Error('WebGL is not supported by this browser.');
      }
      this.viewport = document.createElement('div');
      this.viewport.className = 'scene-viewport';
      this.viewport.setAttribute('aria-label', 'Interactive 3D city block. Drag to look around.');
      this.viewport.tabIndex = 0;
      this.renderer = new THREE.WebGLRenderer({
        antialias: this.qualityTier === 'high',
        // Keep the last frame readable to browser evidence tooling. Without
        // this, WebGL is allowed to discard the back buffer after presenting,
        // so a perfectly rendered scene can be reported as a blank canvas by
        // screenshot/readback checks.
        preserveDrawingBuffer: true,
        powerPreference: this.qualityTier === 'low' ? 'low-power' : 'high-performance',
      });
      const pixelRatio = this.qualityTier === 'high' ? 2 : this.qualityTier === 'balanced' ? 1.5 : 1;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatio));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.shadowMap.enabled = this.qualityTier !== 'low';
      this.viewport.append(this.renderer.domElement);
      this.mount.replaceChildren(this.viewport);

      this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.cityWorld = createCityWorld(this.scene, this.currentEra, { qualityTier: this.qualityTier, reducedMotion });
      this.attachControls();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.viewport);
      window.addEventListener('resize', this.resize, { passive: true });
      this.resize();
      this.updateCamera();
      this.animate();
    } catch (error) {
      this.showError(error);
    }
  }

  private detectQualityTier(): CityQualityTier {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const device = navigator as Navigator & { deviceMemory?: number };
    const memory = device.deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency ?? 8;
    if (reducedMotion || memory <= 2 || cores <= 2) return 'low';
    if (memory <= 4 || cores <= 4) return 'balanced';
    return 'high';
  }

  private attachControls(): void {
    if (!this.viewport) return;
    this.viewport.addEventListener('pointerdown', this.onPointerDown);
    this.viewport.addEventListener('pointermove', this.onPointerMove);
    this.viewport.addEventListener('pointerup', this.onPointerUp);
    this.viewport.addEventListener('pointercancel', this.onPointerUp);
    this.viewport.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.pointerId = event.pointerId;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.viewport?.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId)) return;
    const pointer = this.pointers.get(event.pointerId);
    if (pointer) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }
    if (this.pointers.size >= 2) {
      const [first, second] = [...this.pointers.values()];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (this.pinchDistance !== undefined) this.radius = THREE.MathUtils.clamp(this.radius - (distance - this.pinchDistance) * 0.018, 6.8, 24);
      this.pinchDistance = distance;
      this.updateCamera();
      return;
    }
    const dx = event.clientX - this.pointerX;
    const dy = event.clientY - this.pointerY;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.yaw -= dx * 0.008;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.006, -0.15, 1.12);
    this.updateCamera();
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.delete(event.pointerId);
    this.pinchDistance = undefined;
    const remaining = this.pointers.keys().next().value;
    this.pointerId = typeof remaining === 'number' ? remaining : undefined;
    if (this.pointerId !== undefined) {
      const pointer = this.pointers.get(this.pointerId);
      if (pointer) {
        this.pointerX = pointer.x;
        this.pointerY = pointer.y;
      }
    }
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.radius = THREE.MathUtils.clamp(this.radius + event.deltaY * 0.012, 6.8, 24);
    this.updateCamera();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'q', 'e'].includes(event.key)) {
      this.keys.add(event.key.toLowerCase());
      event.preventDefault();
    }
    if (event.key === 'Home') this.resetView();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.key.toLowerCase());
  };

  private updateCamera(): void {
    if (!this.camera) return;
    const horizontal = Math.cos(this.pitch) * this.radius;
    const y = THREE.MathUtils.clamp(this.target.y + Math.sin(this.pitch) * this.radius, 1.5, 14);
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * horizontal, y, this.target.z + Math.cos(this.yaw) * horizontal);
    this.camera.lookAt(this.target);
  }

  private moveCamera(delta: number): void {
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const movement = new THREE.Vector3();
    if (this.keys.has('w') || this.keys.has('arrowup')) movement.add(forward);
    if (this.keys.has('s') || this.keys.has('arrowdown')) movement.sub(forward);
    if (this.keys.has('d') || this.keys.has('arrowright')) movement.add(right);
    if (this.keys.has('a') || this.keys.has('arrowleft')) movement.sub(right);
    if (movement.lengthSq() > 0) this.target.addScaledVector(movement.normalize(), delta * 5.2);
    if (this.keys.has('q')) this.target.y -= delta * 2;
    if (this.keys.has('e')) this.target.y += delta * 2;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -8, 8);
    this.target.y = THREE.MathUtils.clamp(this.target.y, 1, 5);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -8, 8);
    this.updateCamera();
  }

  private createLoadingState(): HTMLElement {
    const loading = document.createElement('div');
    loading.className = 'scene-state scene-state--loading';
    loading.innerHTML = '<span class="state-spinner" aria-hidden="true"></span><p>Compiling city systems…</p>';
    return loading;
  }

  private showError(error: unknown): void {
    if (this.disposed) return;
    this.disposed = true;
    window.cancelAnimationFrame(this.animationFrame);
    const message = error instanceof Error ? error.message : 'WebGL could not be initialized.';
    this.mount.replaceChildren();
    this.renderer?.dispose();
    this.renderer = undefined;
    const errorState = document.createElement('div');
    errorState.className = 'scene-state scene-state--error';
    errorState.innerHTML = `<span class="state-icon" aria-hidden="true">!</span><p class="eyebrow">Renderer unavailable</p><h2>We could not open the city window</h2><p class="state-detail">${this.escapeHtml(message)}</p><p>Try a browser with WebGL enabled, then reload Luna.</p>`;
    this.mount.append(errorState);
  }

  private resize = (): void => {
    if (!this.renderer || !this.camera || !this.viewport) return;
    const width = Math.max(1, this.viewport.clientWidth);
    const height = Math.max(1, this.viewport.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private animate = (time = performance.now()): void => {
    if (this.disposed || !this.renderer || !this.camera) return;
    this.animationFrame = window.requestAnimationFrame(this.animate);
    const delta = Math.min(0.05, (time - this.lastFrame) / 1000 || 0);
    this.lastFrame = time;
    if (this.paused) return;
    try {
      this.moveCamera(delta);
      this.cityWorld?.update(delta);
      this.emitTransitionProgress();
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      this.showError(error);
    }
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
      this.onEraChange?.(this.currentEra, {
        from: this.currentEra.id,
        to: this.currentEra.id,
        progress: 1,
        isTransitioning: false,
      });
    }
  }

  private escapeHtml(value: string): string {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
    return value.replace(/[&<>'"]/g, (character) => entities[character]);
  }
}
