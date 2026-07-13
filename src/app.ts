import * as THREE from 'three';

import {
  ERA_REGISTRY,
  type EraId,
  type EraSpec,
  type TransitionProgress,
} from './eras';

export interface CityAppOptions {
  mount: HTMLElement;
  initialEra?: EraId;
  onEraChange?: (era: EraSpec, transition: TransitionProgress) => void;
}

interface TransitionState {
  from: EraSpec;
  to: EraSpec;
  startedAt: number;
  duration: number;
  progress: number;
}

/**
 * Rendering and exploration composition root. The city is kept in one scene
 * while era changes interpolate its shared world state in place.
 */
export class CityApp {
  readonly scene = new THREE.Scene();

  private readonly mount: HTMLElement;
  private readonly onEraChange?: CityAppOptions['onEraChange'];
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private viewport?: HTMLElement;
  private resizeObserver?: ResizeObserver;
  private animationFrame = 0;
  private eraIndex: number;
  private transition?: TransitionState;
  private disposed = false;
  private paused = false;
  private reducedMotion = false;
  private readonly city = new THREE.Group();
  private readonly buildings = new THREE.Group();
  private readonly vehicles = new THREE.Group();
  private readonly foliage = new THREE.Group();
  private readonly buildingMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly trimMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly vehicleMaterials: THREE.MeshStandardMaterial[] = [];
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
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    return this.transition !== undefined;
  }

  setEra(id: EraId): void {
    if (this.disposed) return;
    const nextIndex = ERA_REGISTRY.findIndex((era) => era.id === id);
    if (nextIndex < 0 || nextIndex === this.eraIndex && !this.transition) return;
    const from = this.transition ? this.transition.to : this.currentEra;
    const to = ERA_REGISTRY[nextIndex];
    this.eraIndex = nextIndex;
    const duration = this.reducedMotion ? 320 : 1800;
    this.transition = { from, to, startedAt: performance.now(), duration, progress: 0 };
    this.onEraChange?.(to, { from: from.id, to: to.id, progress: 0, isTransitioning: true });
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
      this.viewport = document.createElement('div');
      this.viewport.className = 'scene-viewport';
      this.viewport.setAttribute('aria-label', 'Interactive 3D city block. Drag to look around.');
      this.viewport.tabIndex = 0;
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.shadowMap.enabled = true;
      this.viewport.append(this.renderer.domElement);
      this.mount.replaceChildren(this.viewport);

      this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
      this.scene.add(this.city);
      this.city.add(this.buildings, this.vehicles, this.foliage);
      this.addStarterCity();
      this.applyEraAtmosphere(this.currentEra, 1);
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

  private addStarterCity(): void {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 25), new THREE.MeshStandardMaterial({ color: '#253544', roughness: 0.94 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.city.add(ground);

    const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 24), new THREE.MeshStandardMaterial({ color: '#111b25', roughness: 0.78 }));
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.015;
    this.city.add(road);
    const crossing = new THREE.Mesh(new THREE.PlaneGeometry(6.7, 1.2), new THREE.MeshStandardMaterial({ color: '#aeb3b1', roughness: 0.7 }));
    crossing.rotation.x = -Math.PI / 2;
    crossing.position.set(0, 0.024, 4.2);
    this.city.add(crossing);

    const buildingData = [
      [-6.1, 3.2, -2.3, 5.2, 6.4, 4.2], [-6.2, 2.3, 3.1, 4.5, 4.6, 3.2],
      [5.3, 4.8, -3.3, 4.4, 9.6, 3.5], [5.4, 2.7, 2.4, 4.5, 5.4, 3.7],
    ];
    buildingData.forEach(([x, y, z, width, height, depth], index) => {
      const material = new THREE.MeshStandardMaterial({ color: index % 2 ? '#765869' : '#a06d5d', roughness: 0.68, metalness: 0.08 });
      this.buildingMaterials.push(material);
      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      building.position.set(x, y, z);
      building.castShadow = true;
      building.receiveShadow = true;
      this.buildings.add(building);
      this.addWindows(building, width, height, depth, index);
    });

    [-2.4, 0, 2.4].forEach((x, index) => {
      const storefrontMaterial = new THREE.MeshStandardMaterial({ color: ['#7a5260', '#496b76', '#80634a'][index], roughness: 0.5, metalness: 0.14 });
      this.trimMaterials.push(storefrontMaterial);
      const shop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.8), storefrontMaterial);
      shop.position.set(x, 1.1, 2.2);
      shop.castShadow = true;
      shop.receiveShadow = true;
      this.buildings.add(shop);
      const awning = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.15, 0.35), new THREE.MeshStandardMaterial({ color: '#d4a26e', roughness: 0.5 }));
      awning.position.set(x, 2.1, 0.73);
      this.buildings.add(awning);
    });

    [-4.1, 0.8, 4.1].forEach((x, index) => {
      const carMaterial = new THREE.MeshStandardMaterial({ color: ['#b84f4e', '#3d7789', '#c08c4d'][index], roughness: 0.42, metalness: 0.4 });
      this.vehicleMaterials.push(carMaterial);
      const car = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.55, 2.3), carMaterial);
      car.position.set(x, 0.38, index === 1 ? -4.5 : 4.8);
      car.rotation.y = index === 1 ? Math.PI : 0;
      car.castShadow = true;
      this.vehicles.add(car);
    });

    [-9, -3, 3, 9].forEach((z) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 3.4, 8), new THREE.MeshStandardMaterial({ color: '#8b9498', metalness: 0.75, roughness: 0.3 }));
      pole.position.set(-3.6, 1.7, z);
      this.city.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6), new THREE.MeshStandardMaterial({ color: '#ffe1a6', emissive: '#bf754a', emissiveIntensity: 1.5 }));
      lamp.position.set(-3.6, 3.35, z);
      this.city.add(lamp);
    });

    [-10, -7, 7, 10].forEach((x, index) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.8, 8), new THREE.MeshStandardMaterial({ color: '#60483d', roughness: 0.9 }));
      trunk.position.set(x, 0.9, index % 2 ? 7 : -7);
      this.foliage.add(trunk);
      const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), new THREE.MeshStandardMaterial({ color: '#3d765d', roughness: 0.92 }));
      canopy.position.set(x, 2.3, index % 2 ? 7 : -7);
      canopy.castShadow = true;
      this.foliage.add(canopy);
    });

    const sun = new THREE.DirectionalLight('#ffd2a1', 3.2);
    sun.position.set(-5, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.city.add(sun);
    this.city.add(new THREE.HemisphereLight('#9eb4d3', '#15202d', 1.25));
  }

  private addWindows(building: THREE.Mesh, width: number, height: number, depth: number, seed: number): void {
    const rows = Math.max(2, Math.floor(height / 1.4));
    for (let row = 0; row < rows; row += 1) {
      const window = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(0.75, width / 4), 0.42), new THREE.MeshStandardMaterial({ color: '#9ac1c6', emissive: '#29464e', emissiveIntensity: 0.7, roughness: 0.3 }));
      window.position.set(building.position.x + (seed % 2 ? -0.8 : 0.8), 0.8 + row * 1.25, building.position.z + depth / 2 + 0.012);
      this.city.add(window);
    }
  }

  private applyEraAtmosphere(era: EraSpec, progress: number): void {
    const atmosphere = era.config.atmosphere;
    this.scene.background = new THREE.Color(atmosphere.sky);
    this.scene.fog = new THREE.FogExp2(atmosphere.fog, atmosphere.fogDensity * (0.8 + progress * 0.2));
  }

  private applyTransition(transition: TransitionState, progress: number): void {
    const from = transition.from.config;
    const to = transition.to.config;
    const eased = progress * progress * (3 - 2 * progress);
    const sky = new THREE.Color(from.atmosphere.sky).lerp(new THREE.Color(to.atmosphere.sky), eased);
    this.scene.background = sky;
    this.scene.fog = new THREE.FogExp2(new THREE.Color(from.atmosphere.fog).lerp(new THREE.Color(to.atmosphere.fog), eased), THREE.MathUtils.lerp(from.atmosphere.fogDensity, to.atmosphere.fogDensity, eased));
    this.buildingMaterials.forEach((material, index) => {
      const fromColor = new THREE.Color(index % 2 ? '#765869' : '#a06d5d');
      const toColor = new THREE.Color(to.world.materials[index % to.world.materials.length].includes('glass') ? '#557a89' : '#78906c');
      material.color.copy(fromColor.lerp(toColor, eased));
      material.roughness = THREE.MathUtils.lerp(0.78, 0.32, eased);
    });
    this.vehicleMaterials.forEach((material, index) => {
      material.metalness = THREE.MathUtils.lerp(0.25, 0.8, eased);
      material.roughness = THREE.MathUtils.lerp(0.55, 0.22, eased);
      if (to.world.vehicleProfile.includes('electric')) material.color.set(index === 1 ? '#65c2ca' : '#7b8ce0');
    });
    this.trimMaterials.forEach((material, index) => {
      const targetColor = to.signage.illumination.includes('neon') || to.signage.illumination.includes('holographic')
        ? new THREE.Color('#5fd5e1')
        : new THREE.Color(index % 2 ? '#c08c63' : '#7897a0');
      material.color.lerp(targetColor, eased);
      material.emissive.lerp(targetColor, eased * 0.25);
      material.emissiveIntensity = THREE.MathUtils.lerp(0.15, 1.4, eased);
    });
    this.vehicles.scale.setScalar(THREE.MathUtils.lerp(1, 1.08 + to.world.buildingDensity * 0.2, eased));
    this.foliage.scale.setScalar(THREE.MathUtils.lerp(0.8, 1.25, eased * to.population.density));
    this.buildings.children.forEach((child, index) => {
      if (child instanceof THREE.Mesh) child.scale.y = 1 + eased * (to.world.buildingDensity - 0.56) * (index % 2 ? 0.35 : 0.18);
    });
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
    const message = error instanceof Error ? error.message : 'WebGL could not be initialized.';
    this.mount.replaceChildren();
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
    this.moveCamera(delta);
    if (this.transition) {
      const progress = THREE.MathUtils.clamp((time - this.transition.startedAt) / this.transition.duration, 0, 1);
      this.transition.progress = progress;
      this.applyTransition(this.transition, progress);
      this.onEraChange?.(this.transition.to, { from: this.transition.from.id, to: this.transition.to.id, progress, isTransitioning: progress < 1 });
      if (progress >= 1) this.transition = undefined;
    }
    this.renderer.render(this.scene, this.camera);
  };

  private escapeHtml(value: string): string {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
    return value.replace(/[&<>'"]/g, (character) => entities[character]);
  }
}
