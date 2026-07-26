import * as THREE from 'three';

/**
 * PerformanceManager — adaptive quality and LOD management.
 *
 * Addresses finding: "Performance degradation with many instances
 * and post-processing on low-end devices"
 * Strategy:
 *  - Detect device tier (high/medium/low) via hardware concurrency,
 *    device memory, and touch support.
 *  - Dynamically adjust instance counts, LOD distances, post-processing
 *    passes, and texture resolution.
 *  - Monitor FPS and degrade gracefully under sustained low frame rates.
 */
export type DeviceTier = 'high' | 'medium' | 'low';

export interface PerformanceSettings {
  tier: DeviceTier;
  maxBuildings: number;
  maxVehicles: number;
  maxPedestrians: number;
  usePostProcessing: boolean;
  useShadows: boolean;
  shadowMapSize: number;
  textureResolution: number;
  lodLevels: number;
  pixelRatio: number;
  useBloom: boolean;
  useSSAO: boolean;
  useMotionBlur: boolean;
  maxLights: number;
  vehicleLODDistance: number;
  pedestrianLODDistance: number;
}

export class PerformanceManager {
  private settings: PerformanceSettings;
  private fpsHistory: number[] = [];
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private currentFPS: number = 60;
  private degradationLevel: number = 0;
  private onSettingsChanged: (settings: PerformanceSettings) => void;

  constructor(onSettingsChanged: (settings: PerformanceSettings) => void) {
    this.onSettingsChanged = onSettingsChanged;
    this.settings = this.detectDeviceTier();
    this.onSettingsChanged(this.settings);
  }

  private detectDeviceTier(): PerformanceSettings {
    const nav = navigator as any;
    const hardwareConcurrency = nav.hardwareConcurrency || 4;
    const deviceMemory = nav.deviceMemory || 4;
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTouch = 'ontouchstart' in window;
    const isLowEnd = hardwareConcurrency <= 2 || deviceMemory <= 2 || isMobile;

    let tier: DeviceTier;
    if (isLowEnd && isTouch) {
      tier = 'low';
    } else if (isLowEnd || (hardwareConcurrency <= 4 && deviceMemory <= 4)) {
      tier = 'medium';
    } else {
      tier = 'high';
    }

    // Further downgrade on mobile
    if (tier === 'high' && isMobile) {
      tier = 'medium';
    }

    return this.getSettingsForTier(tier);
  }

  private getSettingsForTier(tier: DeviceTier): PerformanceSettings {
    switch (tier) {
      case 'high':
        return {
          tier,
          maxBuildings: 120,
          maxVehicles: 30,
          maxPedestrians: 60,
          usePostProcessing: true,
          useShadows: true,
          shadowMapSize: 2048,
          textureResolution: 1024,
          lodLevels: 3,
          pixelRatio: Math.min(window.devicePixelRatio, 2),
          useBloom: true,
          useSSAO: true,
          useMotionBlur: true,
          maxLights: 8,
          vehicleLODDistance: 80,
          pedestrianLODDistance: 40,
        };
      case 'medium':
        return {
          tier,
          maxBuildings: 80,
          maxVehicles: 20,
          maxPedestrians: 40,
          usePostProcessing: true,
          useShadows: true,
          shadowMapSize: 1024,
          textureResolution: 512,
          lodLevels: 2,
          pixelRatio: Math.min(window.devicePixelRatio, 1.5),
          useBloom: true,
          useSSAO: false,
          useMotionBlur: false,
          maxLights: 4,
          vehicleLODDistance: 60,
          pedestrianLODDistance: 30,
        };
      case 'low':
        return {
          tier,
          maxBuildings: 50,
          maxVehicles: 12,
          maxPedestrians: 20,
          usePostProcessing: false,
          useShadows: false,
          shadowMapSize: 512,
          textureResolution: 256,
          lodLevels: 1,
          pixelRatio: 1,
          useBloom: false,
          useSSAO: false,
          useMotionBlur: false,
          maxLights: 2,
          vehicleLODDistance: 40,
          pedestrianLODDistance: 20,
        };
    }
  }

  /**
   * Call once per frame to monitor performance.
   * If FPS is consistently low, degrade settings.
   */
  update(deltaTime: number): void {
    this.frameCount++;
    const now = performance.now();

    if (this.lastFrameTime > 0) {
      const frameTime = now - this.lastFrameTime;
      const fps = 1000 / frameTime;
      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > 30) {
        this.fpsHistory.shift();
      }
      this.currentFPS = fps;
    }
    this.lastFrameTime = now;

    // Check for sustained low FPS every 60 frames
    if (this.frameCount % 60 === 0 && this.fpsHistory.length >= 30) {
      const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
      this.adjustForPerformance(avgFPS);
    }
  }

  private adjustForPerformance(avgFPS: number): void {
    if (avgFPS < 30 && this.degradationLevel < 3) {
      this.degrade();
    } else if (avgFPS > 50 && this.degradationLevel > 0) {
      this.improve();
    }
  }

  private degrade(): void {
    this.degradationLevel++;
    const newSettings = { ...this.settings };

    newSettings.maxBuildings = Math.floor(newSettings.maxBuildings * 0.7);
    newSettings.maxVehicles = Math.floor(newSettings.maxVehicles * 0.7);
    newSettings.maxPedestrians = Math.floor(newSettings.maxPedestrians * 0.7);
    newSettings.shadowMapSize = Math.floor(newSettings.shadowMapSize / 2);
    newSettings.textureResolution = Math.floor(newSettings.textureResolution / 2);
    newSettings.pixelRatio = Math.min(newSettings.pixelRatio, 1);

    if (this.degradationLevel >= 2) {
      newSettings.usePostProcessing = false;
      newSettings.useBloom = false;
      newSettings.useSSAO = false;
      newSettings.useMotionBlur = false;
    }

    if (this.degradationLevel >= 3) {
      newSettings.useShadows = false;
      newSettings.maxBuildings = Math.floor(newSettings.maxBuildings * 0.5);
    }

    this.settings = newSettings;
    this.onSettingsChanged(newSettings);
    console.log(`[PerformanceManager] Degraded to level ${this.degradationLevel}. FPS: ${this.currentFPS.toFixed(0)}`);
  }

  private improve(): void {
    if (this.degradationLevel <= 0) return;
    this.degradationLevel--;

    // Restore to tier-based settings
    const tierSettings = this.getSettingsForTier(this.settings.tier);
    this.settings = {
      ...tierSettings,
      maxBuildings: Math.floor(tierSettings.maxBuildings * (0.7 + this.degradationLevel * 0.15)),
      maxVehicles: Math.floor(tierSettings.maxVehicles * (0.7 + this.degradationLevel * 0.15)),
      maxPedestrians: Math.floor(tierSettings.maxPedestrians * (0.7 + this.degradationLevel * 0.15)),
    };

    this.onSettingsChanged(this.settings);
    console.log(`[PerformanceManager] Improved to level ${this.degradationLevel}. FPS: ${this.currentFPS.toFixed(0)}`);
  }

  getSettings(): PerformanceSettings {
    return this.settings;
  }

  getCurrentFPS(): number {
    return this.currentFPS;
  }

  getDegradationLevel(): number {
    return this.degradationLevel;
  }

  dispose(): void {
    // No resources to dispose for this manager
  }
}
