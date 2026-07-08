/**
 * Core Scene Management - City block layout, ground plane, skybox, and era-aware object containers
 */

import * as THREE from 'three';
import type { EraId } from './eras';
import { AssetSet, type AssetConfig } from './assetBuilder/assetSet';

export class CityScene {
  private scene: THREE.Scene;
  private ground!: THREE.Mesh;
  private skybox!: THREE.Mesh;
  private currentAssetSet: AssetSet | null = null;
  private assetContainer: THREE.Group;
  private particles!: THREE.Points;

  constructor() {
    this.scene = new THREE.Scene();
    this.assetContainer = new THREE.Group();
    this.scene.add(this.assetContainer);
    this.setupGround();
    this.setupSkybox();
    this.setupParticles();
  }

  private setupGround(): void {
    const geometry = new THREE.PlaneGeometry(100, 100);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x363636,
      roughness: 0.9 
    });
    
    this.ground = new THREE.Mesh(geometry, material);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  private setupSkybox(): void {
    const geometry = new THREE.SphereGeometry(200, 32, 32);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x87CEEB,
      side: THREE.BackSide 
    });
    
    this.skybox = new THREE.Mesh(geometry, material);
    this.scene.add(this.skybox);
  }

  private setupParticles(): void {
    const particleCount = 1000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 200;
      positions[i + 1] = Math.random() * 100;
      positions[i + 2] = (Math.random() - 0.5) * 200;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ 
      color: 0xFFFFFF,
      size: 0.5,
      transparent: true,
      opacity: 0.3
    });
    
    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  /**
   * Load assets for a specific era with transition support
   */
  async loadEra(eraId: EraId): Promise<void> {
    // Clean up existing assets
    if (this.currentAssetSet) {
      this.currentAssetSet.dispose();
      this.assetContainer.clear();
    }

    // Create new assets for the era
    const config: AssetConfig = {
      eraId,
      buildingCount: 6,
      vehicleCount: 8,
      pedestrianCount: 12,
      storefrontCount: 6
    };

    this.currentAssetSet = new AssetSet(config).build();
    
    // Add all objects to the scene
    const objects = this.currentAssetSet.getObjects();
    objects.forEach(obj => this.assetContainer.add(obj));
  }

  /**
   * Get the Three.js scene for rendering
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Update skybox color for era transitions
   */
  updateSkybox(eraId: EraId): void {
    const colors: Record<EraId, number> = {
      '1945': 0x87CEEB,   // Clear sky
      '1965': 0x32CD32,   // Lime green (retro future)
      '1985': 0x4169E1,   // Royal blue (neon night)
      '2005': 0x87CEFA,   // Light sky blue
      '2025': 0x90EE90,   // Light green (eco)
      '2055': 0x000080    // Midnight blue (future)
    };
    
    const material = this.skybox.material as THREE.MeshBasicMaterial;
    material.color.set(colors[eraId]);
  }

  /**
   * Update ground color for era transitions
   */
  updateGround(eraId: EraId): void {
    const colors: Record<EraId, number> = {
      '1945': 0x363636,
      '1965': 0x228B22,
      '1985': 0x00008B,
      '2005': 0x2F4F4F,
      '2025': 0x3CB371,
      '2055': 0x008080
    };
    
    const material = this.ground.material as THREE.MeshStandardMaterial;
    material.color.set(colors[eraId]);
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    if (this.currentAssetSet) {
      this.currentAssetSet.dispose();
    }
    
    this.ground.geometry.dispose();
    (this.ground.material as THREE.MeshStandardMaterial).dispose();
    this.skybox.geometry.dispose();
    (this.skybox.material as THREE.MeshBasicMaterial).dispose();
    this.particles.geometry.dispose();
    (this.particles.material as THREE.PointsMaterial).dispose();
  }
}