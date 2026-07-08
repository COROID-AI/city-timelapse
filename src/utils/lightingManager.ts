/**
 * Lighting Manager - Era-appropriate lighting configurations
 * 1945: Warm incandescent, 1965: Fluorescent, 1985: Neon-soaked,
 * 2005: LED modern, 2025: Smart adaptive, 2055: Holographic
 */

import * as THREE from 'three';
import type { EraId } from '../eras';

export class LightingManager {
  private scene: THREE.Scene;
  private ambientLight!: THREE.AmbientLight;
  private directionalLight!: THREE.DirectionalLight;
  private pointLights: THREE.PointLight[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupBaseLights();
  }

  private setupBaseLights(): void {
    // Base ambient light
    this.ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5);
    this.scene.add(this.ambientLight);
    
    // Main directional light (sun)
    this.directionalLight = new THREE.DirectionalLight(0xFFFFFF, 0.8);
    this.directionalLight.position.set(50, 100, 50);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.camera.top = 100;
    this.directionalLight.shadow.camera.bottom = -100;
    this.directionalLight.shadow.camera.left = -100;
    this.directionalLight.shadow.camera.right = 100;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(this.directionalLight);
  }

  /**
   * Apply era-specific lighting
   */
  setEra(eraId: EraId): void {
    switch (eraId) {
      case '1945':
        this.applyIncandescentLighting();
        break;
      case '1965':
        this.applyFluorescentLighting();
        break;
      case '1985':
        this.applyNeonLighting();
        break;
      case '2005':
        this.applyLEDLighting();
        break;
      case '2025':
        this.applySmartLighting();
        break;
      case '2055':
        this.applyHolographicLighting();
        break;
    }
  }

  private applyIncandescentLighting(): void {
    this.ambientLight.color.set(0xFFE5B4);
    this.ambientLight.intensity = 0.4;
    this.directionalLight.color.set(0xFFD700);
    this.directionalLight.intensity = 0.6;
    
    this.clearPointLights();
    
    // Add warm street lamps
    for (let i = 0; i < 4; i++) {
      const lamp = new THREE.PointLight(0xFFA500, 0.8, 30);
      lamp.position.set(-30 + i * 20, 15, 0);
      lamp.castShadow = true;
      this.scene.add(lamp);
      this.pointLights.push(lamp);
    }
  }

  private applyFluorescentLighting(): void {
    this.ambientLight.color.set(0xD3D3D3);
    this.ambientLight.intensity = 0.5;
    this.directionalLight.color.set(0x87CEFA);
    this.directionalLight.intensity = 0.7;
    
    this.clearPointLights();
    
    // Add cooler point lights
    for (let i = 0; i < 4; i++) {
      const lamp = new THREE.PointLight(0x00CED1, 0.6, 25);
      lamp.position.set(-30 + i * 20, 12, 0);
      this.scene.add(lamp);
      this.pointLights.push(lamp);
    }
  }

  private applyNeonLighting(): void {
    this.ambientLight.color.set(0x4B0082);
    this.ambientLight.intensity = 0.3;
    this.directionalLight.color.set(0x9370DB);
    this.directionalLight.intensity = 0.4;
    
    this.clearPointLights();
    
    // Add colorful neon lights
    const colors = [0xFF1493, 0x00CED1, 0x32CD32, 0xFFFF00];
    for (let i = 0; i < 4; i++) {
      const lamp = new THREE.PointLight(colors[i], 1.2, 20);
      lamp.position.set(-30 + i * 20, 10, 0);
      this.scene.add(lamp);
      this.pointLights.push(lamp);
    }
  }

  private applyLEDLighting(): void {
    this.ambientLight.color.set(0xE0E0E0);
    this.ambientLight.intensity = 0.6;
    this.directionalLight.color.set(0x87CEFA);
    this.directionalLight.intensity = 0.8;
    
    this.clearPointLights();
    
    // Add bright white LED lights
    for (let i = 0; i < 6; i++) {
      const lamp = new THREE.PointLight(0xFFFFFF, 0.8, 35);
      lamp.position.set(-40 + i * 16, 8, 0);
      this.scene.add(lamp);
      this.pointLights.push(lamp);
    }
  }

  private applySmartLighting(): void {
    this.ambientLight.color.set(0x90EE90);
    this.ambientLight.intensity = 0.4;
    this.directionalLight.color.set(0x00FF7F);
    this.directionalLight.intensity = 0.7;
    
    this.clearPointLights();
    
    // Add adaptive green-tinted lights
    for (let i = 0; i < 6; i++) {
      const lamp = new THREE.PointLight(0x98FB98, 0.7, 40);
      lamp.position.set(-40 + i * 16, 8, 0);
      lamp.castShadow = true;
      this.scene.add(lamp);
      this.pointLights.push(lamp);
    }
  }

  private applyHolographicLighting(): void {
    this.ambientLight.color.set(0x00FFFF);
    this.ambientLight.intensity = 0.5;
    this.directionalLight.color.set(0xFF00FF);
    this.directionalLight.intensity = 0.6;
    
    this.clearPointLights();
    
    // Add cyan/purple holographic lights
    const colors = [0x00FFFF, 0xFF00FF, 0x00FF7F, 0xFFD700, 0xDA70D6, 0x9932CC];
    for (let i = 0; i < 6; i++) {
      const lamp = new THREE.PointLight(colors[i], 1.0, 50);
      lamp.position.set(-40 + i * 16, 10, 0);
      this.scene.add(lamp);
      this.pointLights.push(lamp);
    }
  }

  private clearPointLights(): void {
    this.pointLights.forEach(light => this.scene.remove(light));
    this.pointLights = [];
  }

  /**
   * Dispose all lights
   */
  dispose(): void {
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.directionalLight);
    this.clearPointLights();
  }
}