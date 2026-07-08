/**
 * Particle System - Atmospheric effects: steam/smoke for early eras, exhaust fumes for modern, digital effects for future eras
 */

import * as THREE from 'three';
import type { EraId } from './eras';

export interface ParticleConfig {
  count: number;
  color: number;
  size: number;
  speed: number;
}

const PARTICLE_CONFIGS: Record<EraId, ParticleConfig> = {
  '1945': { count: 200, color: 0x8B4513, size: 2, speed: 0.2 },
  '1965': { count: 150, color: 0x708090, size: 1.5, speed: 0.3 },
  '1985': { count: 300, color: 0xFF1493, size: 1, speed: 0.5 },
  '2005': { count: 100, color: 0x808080, size: 1, speed: 0.4 },
  '2025': { count: 80, color: 0x00FF7F, size: 0.8, speed: 0.2 },
  '2055': { count: 500, color: 0x00FFFF, size: 0.5, speed: 0.6 }
};

export class ParticleSystem {
  private particles: THREE.Points;
  private positions!: Float32Array;
  private velocities!: Float32Array;
  private config: ParticleConfig;

  constructor(private scene: THREE.Scene) {
    const geometry = new THREE.BufferGeometry();
    this.particles = new THREE.Points(geometry, this.createMaterial());
    this.config = PARTICLE_CONFIGS['1945'];
    this.scene.add(this.particles);
  }

  private createMaterial(): THREE.PointsMaterial {
    return new THREE.PointsMaterial({
      color: this.config.color,
      size: this.config.size,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
  }

  private initializeParticles(): void {
    this.positions = new Float32Array(this.config.count * 3);
    this.velocities = new Float32Array(this.config.count * 3);
    
    for (let i = 0; i < this.config.count * 3; i += 3) {
      this.positions[i] = (Math.random() - 0.5) * 100;
      this.positions[i + 1] = Math.random() * 50;
      this.positions[i + 2] = (Math.random() - 0.5) * 100;
      
      this.velocities[i] = (Math.random() - 0.5) * this.config.speed;
      this.velocities[i + 1] = (Math.random() - 0.5) * this.config.speed;
      this.velocities[i + 2] = (Math.random() - 0.5) * this.config.speed;
    }
    
    const geometry = this.particles.geometry;
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
  }

  /**
   * Set era-specific particle effects
   */
  setEra(eraId: EraId): void {
    this.config = PARTICLE_CONFIGS[eraId];
    
    // Update material
    const material = this.particles.material as THREE.PointsMaterial;
    material.color.set(this.config.color);
    material.size = this.config.size;
    
    this.initializeParticles();
  }

  /**
   * Update particle positions
   */
  update(): void {
    if (!this.positions) return;
    
    for (let i = 0; i < this.positions.length; i += 3) {
      this.positions[i] += this.velocities[i];
      this.positions[i + 1] += this.velocities[i + 1];
      this.positions[i + 2] += this.velocities[i + 2];
      
      // Boundary wrap
      if (this.positions[i] > 50) this.positions[i] = -50;
      if (this.positions[i] < -50) this.positions[i] = 50;
      if (this.positions[i + 1] > 50) this.positions[i + 1] = 0;
      if (this.positions[i + 1] < 0) this.positions[i + 1] = 50;
      if (this.positions[i + 2] > 50) this.positions[i + 2] = -50;
      if (this.positions[i + 2] < -50) this.positions[i + 2] = 50;
    }
    
    (this.particles.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  /**
   * Dispose of particle system
   */
  dispose(): void {
    this.scene.remove(this.particles);
    this.particles.geometry.dispose();
    (this.particles.material as THREE.PointsMaterial).dispose();
  }
}