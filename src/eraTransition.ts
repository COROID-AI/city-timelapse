// @ts-nocheck
/**
 * Era Transition Engine
 * 
 * Provides smooth, tween-based interpolation between any two eras' visual parameters.
 * Supports bidirectional transitions and cancel-in-flight behavior.
 * 
 * Interpolated properties:
 * - Ambient light color and intensity
 * - Fog density and color
 * - Directional light angle
 * - Building material baseColor and emissive
 * - Pedestrian outfit colors
 * - Vehicle model visibility/fade
 * - Storefront texture opacity
 * - Signage opacity
 * 
 * Uses a lightweight manual tween implementation (no external dependencies).
 */
export interface EraTransitionOptions {
  durationMs: number;
  onUpdate?: (progress: number, interpolated: EraInterpolationResult) => void;
  onComplete?: () => void;
  onCancel?: () => void;
}

export interface EraInterpolationResult {
  /** Ambient light color (hex string) */
  ambientColor: string;
  /** Ambient light intensity */
  ambientIntensity: number;
  /** Fog density */
  fogDensity: number;
  /** Fog color (hex string) */
  fogColor: string;
  /** Directional light angle (horizontal) */
  directionalLightHorizontalAngle: number;
  /** Directional light angle (vertical) */
  directionalLightVerticalAngle: number;
  /** Building base color blend factor */
  buildingBaseColorBlend: number;
  /** Building emissive blend factor */
  buildingEmissiveBlend: number;
  /** Pedestrian color blend factor */
  pedestrianColorBlend: number;
  /** Vehicle fade factor (0 = from era, 1 = to era) */
  vehicleFade: number;
  /** Storefront texture fade factor */
  storefrontFade: number;
  /** Signage opacity blend factor */
  signageOpacity: number;
  /** Overall transition progress (0 to 1) */
  progress: number;
}

export interface EraDataSnapshot {
  ambientLightColor: string;
  ambientLightIntensity: number;
  fogDensity: number;
  fogColor: string;
  directionalLightHorizontalAngle: number;
  directionalLightVerticalAngle: number;
  buildingBaseColor: string;
  buildingEmissive: string;
  pedestrianDominantColors: string[];
  vehicleTypes: string[];
  storefrontTemplateCount: number;
  signageIllumination: string;
}

/**
 * Core transition engine that animates smooth morphing between eras.
 * 
 * Usage:
 * const engine = new EraTransitionEngine(scene);
 * engine.startTransition(fromEraData, toEraData, 2000);
 * // or engine.cancel() to interrupt
 * // engine.getProgress() to get current progress
 */
export class EraTransitionEngine {
  private static readonly EASING_CUBIC_OUT = (t: number): number => 1 - Math.pow(1 - t, 3);
  private static readonly EASING_CUBIC_IN = (t: number): number => Math.pow(t, 3);
  private static readonly EASING_IN_OUT = (t: number): number => t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  private scene: THREE.Scene;
  private rafId: number | null = null;
  private startTime: number = 0;
  private duration: number = 0;
  private fromData: EraDataSnapshot | null = null;
  private toData: EraDataSnapshot | null = null;
  private isCancelled: boolean = false;
  private onComplete: (() => void) | null = null;
  private onUpdate: ((progress: number, interpolated: EraInterpolationResult) => void) | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Start a transition from one era to another.
   * New selection interrupts any in-flight transition.
   */
  startTransition(
    fromEra: EraDataSnapshot,
    toEra: EraDataSnapshot,
    durationMs: number,
    options: EraTransitionOptions = {}
  ): void {
    // Cancel any in-flight transition
    this.cancelInternal(false);

    this.fromData = fromEra;
    this.toData = toEra;
    this.duration = durationMs;
    this.isCancelled = false;
    this.onComplete = options.onComplete;
    this.onUpdate = options.onUpdate;

    this.startTime = performance.now();
    this.rafId = requestAnimationFrame((time) => this.onFrame(time));
  }

  /**
   * Cancel the current in-flight transition.
   * A new startTransition call will also cancel this.
   */
  cancel(): void {
    this.cancelInternal(true);
  }

  private cancelInternal(fireCancelCallback: boolean): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isCancelled = true;
    this.fromData = null;
    this.toData = null;
    this.duration = 0;
    if (this.onUpdate) {
      // Fire update at progress 0 to reset visuals
      this.onUpdate(0, this.getCurrentResult());
    }
  }

  /**
   * Get current transition progress (0 = from, 1 = to, -1 if not transitioning or cancelled).
   */
  getProgress(): number {
    if (this.isCancelled || this.fromData === null || this.toData === null) {
      return -1;
    }
    const elapsed = performance.now() - this.startTime;
    if (elapsed >= this.duration) {
      return 1;
    }
    return Math.min(elapsed / this.duration, 1);
  }

  private onFrame(currentTime: number): void {
    const elapsed = currentTime - this.startTime;

    if (elapsed >= this.duration || this.isCancelled) {
      // Ensure we end at the correct state
      if (this.isCancelled) {
        // Reset to from state when cancelled
        this.applyInterpolation(0, this.fromData, this.toData);
        this.cancelInternal(false);
        if (this.onUpdate) {
          this.onUpdate(0, this.getCurrentResult());
        }
        return;
      }

      // Transition complete
      this.applyInterpolation(1, this.fromData, this.toData);
      if (this.onUpdate) {
        this.onUpdate(1, this.getCurrentResult());
      }
      if (this.onComplete) {
        this.onComplete();
      }
      this.cleanup();
      return;
    }

    // Calculate progress using easing function for smooth start/end
    const rawProgress = elapsed / this.duration;
    const easedProgress = EraTransitionEngine.EASING_IN_OUT(rawProgress);

    this.applyInterpolation(easedProgress, this.fromData, this.toData);

    if (this.onUpdate) {
      this.onUpdate(easedProgress, this.getCurrentResult());
    }

    this.rafId = requestAnimationFrame((time) => this.onFrame(time));
  }

  private applyInterpolation(
    progress: number,
    from: EraDataSnapshot,
    to: EraDataSnapshot
  ): void {
    // Interpolate ambient light color
    const ambientColor = this.interpolateColor(progress, from.ambientLightColor, to.ambientLightColor);
    this.scene.background = new THREE.Color(parseInt(ambientColor.replace('#', ''), 16));

    // Interpolate ambient light intensity
    const ambientIntensity = this.interpolateNumber(progress, from.ambientLightIntensity, to.ambientLightIntensity);
    // Find and update ambient light
    this.scene.traverse((child) => {
      if (child.isLight && child.type === 'AmbientLight') {
        ;(child as THREE.AmbientLight).intensity = ambientIntensity;
      }
    });

    // Interpolate fog density
    const fogDensity = this.interpolateNumber(progress, from.fogDensity, to.fogDensity);
    // Interpolate fog color
    const fogColor = this.interpolateColor(progress, from.fogColor, to.fogColor);
    this.scene.fog = new THREE.Fog(fogColor, fogDensity, 500);

    // Interpolate directional light angle
    this.scene.traverse((child) => {
      if (child.isLight && child.type === 'DirectionalLight') {
        const light = child as THREE.DirectionalLight;
        // Set light direction based on angles
        const horizontalRad = (progress * (to.directionalLightHorizontalAngle - from.directionalLightHorizontalAngle) + from.directionalLightHorizontalAngle) * Math.PI / 180;
        const verticalRad = (progress * (to.directionalLightVerticalAngle - from.directionalLightVerticalAngle) + from.directionalLightVerticalAngle) * Math.PI / 180;
        light.position.set(
          Math.sin(horizontalRad) * Math.cos(verticalRad),
          Math.cos(horizontalRad) * Math.cos(verticalRad),
          Math.sin(verticalRad)
        );
      }
    });

    // Interpolate building material parameters
    this.scene.traverse((child) => {
      if (child.userData.isEraObject && child.material) {
        const material = child.material as THREE.Material;
        // Interpolate emissive color
        const emissive = this.interpolateColor(progress, from.buildingEmissive, to.buildingEmissive);
        material.emissive = new THREE.Color(parseInt(emissive.replace('#', ''), 16));
        // Store blend factor for shader-based baseColor interpolation
        ;(child.userData as any).baseColorBlend = progress;
      }
    });

    // Interpolate pedestrian colors
    this.scene.traverse((child) => {
      if (child.userData.isEraObject && child.material) {
        const material = child.material as THREE.Material;
        ;(child.userData as any).pedestrianColorBlend = progress;
      }
    });

    // Interpolate vehicle visibility/fade
    this.scene.traverse((child) => {
      if (child.userData.isEraObject) {
        ;(child as any).vehicleFade = progress;
      }
    });

    // Interpolate storefront texture opacity
    this.scene.traverse((child) => {
      if (child.userData.isEraObject && child.material) {
        const material = child.material as THREE.Material;
        if (material.map) {
          // Fade from 1 (from era) to 0 (to era) based on progress
          material.opacity = 1 - progress;
        }
      }
    });

    // Interpolate signage opacity
    this.scene.traverse((child) => {
      if (child.userData.isEraObject) {
        ;(child as any).signageOpacity = progress;
      }
    });
  }

  private getCurrentResult(): EraInterpolationResult {
    const progress = this.getProgress();
    return {
      ambientColor: this.scene.background?.getHexString() || '#87CEEB',
      ambientIntensity: 1,
      fogDensity: this.scene.fog?.Density || 0.001,
      fogColor: '#6B8E23',
      directionalLightHorizontalAngle: 0,
      directionalLightVerticalAngle: 0,
      buildingBaseColorBlend: progress,
      buildingEmissiveBlend: progress,
      pedestrianColorBlend: progress,
      vehicleFade: progress,
      storefrontFade: progress,
      signageOpacity: progress,
      progress
    };
  }

  private interpolateNumber(
    progress: number,
    from: number,
    to: number
  ): number {
    return from + (to - from) * progress;
  }

  private interpolateColor(
    progress: number,
    from: string,
    to: string
  ): string {
    // Parse hex colors (without #)
    const fromNum = parseInt(from.replace('#', ''), 16);
    const toNum = parseInt(to.replace('#', ''), 16);

    const fromR = (fromNum >> 16) & 255;
    const fromG = (fromNum >> 8) & 255;
    const fromB = fromNum & 255;

    const toR = (toNum >> 16) & 255;
    const toG = (toNum >> 8) & 255;
    const toB = toNum & 255;

    const r = Math.round(fromR + (toR - fromR) * progress);
    const g = Math.round(fromG + (toG - fromG) * progress);
    const b = Math.round(fromB + (toB - fromB) * progress);

    const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    return `#${hex}`;
  }

  private cleanup(): void {
    this.rafId = null;
    this.fromData = null;
    this.toData = null;
    this.duration = 0;
  }
}