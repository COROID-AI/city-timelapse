import * as THREE from 'three';
import type { EraId } from './eras.js';

/**
 * Particle types for different effects
 */
export type ParticleType = 'dust' | 'steam' | 'smoke' | 'spark' | 'glow' | 'hologram' | 'none';

/**
 * Era-specific particle configuration
 */
interface EraParticleConfig {
  ambientParticles: ParticleType[];
  intensity: number; // 0-1 scale
}

/**
 * Particle system manager for visual effects
 */
export interface ParticleSystem {
  setEra(eraId: EraId): void;
  update(deltaTime: number): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

/**
 * Particle configuration for each era
 */
const ERA_PARTICLE_CONFIGS: Record<EraId, EraParticleConfig> = {
  '1945': {
    ambientParticles: ['dust'],
    intensity: 0.3
  },
  '1965': {
    ambientParticles: ['dust', 'smoke'],
    intensity: 0.4
  },
  '1985': {
    ambientParticles: ['smoke', 'steam'],
    intensity: 0.5
  },
  '2005': {
    ambientParticles: ['glow', 'spark'],
    intensity: 0.6
  },
  '2025': {
    ambientParticles: ['hologram', 'glow'],
    intensity: 0.7
  }
};

/**
 * Creates an era-aware particle system
 */
export function createParticleSystem(scene: THREE.Scene): ParticleSystem {
  const particles: THREE.Points[] = [];
  let currentEra: EraId | null = null;
  let visible = true;

  // Create particle geometry (will be reused)
  const createParticles = (
    count: number,
    particleType: ParticleType,
    color: number,
    area: THREE.Vector3,
    yRange: [number, number] = [0, 20]
  ): THREE.Points => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const lifetimes = new Float32Array(count);
    
    const colorObj = new THREE.Color(color);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * area.x;
      positions[i * 3 + 1] = Math.random() * (yRange[1] - yRange[0]) + yRange[0];
      positions[i * 3 + 2] = (Math.random() - 0.5) * area.z;
      
      colors[i * 3] = colorObj.r;
      colors[i * 3 + 1] = colorObj.g;
      colors[i * 3 + 2] = colorObj.b;
      
      sizes[i] = Math.random() * 0.5 + 0.3;
      lifetimes[i] = Math.random();
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    
    const material = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    
    const points = new THREE.Points(geometry, material);
    points.userData = { type: particleType, count, originalArea: area.clone() };
    return points;
  };

  // Initialize with default era
  const setupEraParticles = (eraId: EraId) => {
    // Clear existing particles
    particles.forEach(p => {
      scene.remove(p);
      p.geometry.dispose();
      if (Array.isArray(p.material)) {
        p.material.forEach(m => m.dispose());
      } else {
        p.material.dispose();
      }
    });
    particles.length = 0;
    
    const config = ERA_PARTICLE_CONFIGS[eraId];
    
    // Add appropriate particle types
    config.ambientParticles.forEach(particleType => {
      const particleCount = 100 * config.intensity;
      
      switch (particleType) {
        case 'dust':
          particles.push(createParticles(
            particleCount,
            'dust',
            0x8B7355, // Brown dust
            new THREE.Vector3(200, 1, 200),
            [0, 2]
          ));
          break;
        case 'smoke':
          particles.push(createParticles(
            particleCount,
            'smoke',
            0x555555, // Grey smoke
            new THREE.Vector3(100, 50, 100),
            [5, 60]
          ));
          break;
        case 'steam':
          particles.push(createParticles(
            particleCount,
            'steam',
            0xAAAAAA, // Light grey steam
            new THREE.Vector3(80, 40, 80),
            [10, 50]
          ));
          break;
        case 'spark':
          particles.push(createParticles(
            particleCount * 0.5,
            'spark',
            0xFFAA00, // Orange spark
            new THREE.Vector3(60, 10, 60),
            [5, 20]
          ));
          break;
        case 'glow':
          particles.push(createParticles(
            particleCount * 0.7,
            'glow',
            0x4A90D9, // Blue glow
            new THREE.Vector3(120, 30, 120),
            [2, 25]
          ));
          break;
        case 'hologram':
          particles.push(createParticles(
            particleCount * 0.4,
            'hologram',
            0x00CED1, // Cyan hologram
            new THREE.Vector3(100, 60, 100),
            [5, 40]
          ));
          break;
      }
    });
    
    particles.forEach(p => scene.add(p));
    currentEra = eraId;
  };

  return {
    setEra: (eraId: EraId) => {
      if (eraId !== currentEra) {
        setupEraParticles(eraId);
      }
    },
    
    update: (deltaTime: number) => {
      if (!visible) return;
      
      particles.forEach((points, idx) => {
        const positions = points.geometry.attributes.position.array as Float32Array;
        const lifetimeAttr = points.geometry.attributes.lifetime;
        const count = points.userData.count as number;
        
        // Animate particles drifting slowly
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          
          // Slow drift based on particle type
          const driftSpeed = points.userData.type === 'dust' ? 0.01 : 0.02;
          positions[i3] += (Math.random() - 0.5) * driftSpeed;
          positions[i3 + 1] += driftSpeed * 0.5;
          positions[i3 + 2] += (Math.random() - 0.5) * driftSpeed;
          
          // Reset particles that drift too high
          if (positions[i3 + 1] > 60) {
            positions[i3 + 1] = 0;
          }
          
          // Apply bounds
          const area = points.userData.originalArea as THREE.Vector3;
          positions[i3] = Math.max(-area.x / 2, Math.min(area.x / 2, positions[i3]));
          positions[i3 + 2] = Math.max(-area.z / 2, Math.min(area.z / 2, positions[i3 + 2]));
        }
        
        points.geometry.attributes.position.needsUpdate = true;
        
        // Pulsing effect for futuristic eras
        if (currentEra === '2025' || currentEra === '2005') {
          const material = points.material as THREE.PointsMaterial;
          material.opacity = 0.4 + Math.sin(Date.now() * 0.001 + idx) * 0.2;
        }
      });
    },
    
    setVisible: (value: boolean) => {
      visible = value;
      particles.forEach(p => {
        const material = p.material as THREE.PointsMaterial;
        material.opacity = value ? material.opacity : 0;
      });
    },
    
    dispose: () => {
      particles.forEach(p => {
        scene.remove(p);
        p.geometry.dispose();
        if (Array.isArray(p.material)) {
          p.material.forEach(m => m.dispose());
        } else {
          p.material.dispose();
        }
      });
      particles.length = 0;
    }
  };
}