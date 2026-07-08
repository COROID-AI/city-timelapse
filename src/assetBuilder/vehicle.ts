/**
 * Vehicle Factory - Creates era-specific vehicle models
 * 1945: Classic cars, 1965: Muscle cars/vans, 1985: Sedans/SUVs,
 * 2005: Modern cars/hybrids, 2025: Electric/autonomous vehicles, 2055: Flying vehicles/drones
 */

import * as THREE from 'three';
import type { EraId } from '../eras';

export interface Vehicle {
  mesh: THREE.Mesh;
  eraId: EraId;
}

export interface VehicleParams {
  position: { x: number; y: number; z: number };
  rotation?: number;
}

type VehicleStyle = {
  primaryColor: number;
  secondaryColor: number;
  wheelStyle: string;
  bodyStyle: string;
  hasFlying: boolean;
};

const VEHICLE_STYLES: Record<EraId, VehicleStyle[]> = {
  '1945': [
    { primaryColor: 0x8B0000, secondaryColor: 0xA52A2A, wheelStyle: 'spoke', bodyStyle: 'sedan', hasFlying: false },
    { primaryColor: 0x4682B4, secondaryColor: 0x5F9EA0, wheelStyle: 'steel', bodyStyle: 'coupe', hasFlying: false },
    { primaryColor: 0x8B4513, secondaryColor: 0xA0522D, wheelStyle: 'wooden', bodyStyle: 'truck', hasFlying: false }
  ],
  '1965': [
    { primaryColor: 0xFF4500, secondaryColor: 0xFF6347, wheelStyle: 'mag', bodyStyle: 'mustang', hasFlying: false },
    { primaryColor: 0x32CD32, secondaryColor: 0x228B22, wheelStyle: 'chrome', bodyStyle: 'van', hasFlying: false },
    { primaryColor: 0x1E90FF, secondaryColor: 0x4169E1, wheelStyle: 'wire', bodyStyle: 'beetle', hasFlying: false }
  ],
  '1985': [
    { primaryColor: 0xFF1493, secondaryColor: 0xFF69B4, wheelStyle: ' alloy', bodyStyle: 'sedan', hasFlying: false },
    { primaryColor: 0x32CD32, secondaryColor: 0x00FF7F, wheelStyle: 'spoke', bodyStyle: 'suv', hasFlying: false },
    { primaryColor: 0xFFD700, secondaryColor: 0xFFA500, wheelStyle: 'mesh', bodyStyle: 'hatchback', hasFlying: false }
  ],
  '2005': [
    { primaryColor: 0x4682B4, secondaryColor: 0xC0C0C0, wheelStyle: 'alloy', bodyStyle: 'sedan', hasFlying: false },
    { primaryColor: 0x2F4F4F, secondaryColor: 0x696969, wheelStyle: 'alloy', bodyStyle: 'hybrid', hasFlying: false },
    { primaryColor: 0xFF69B4, secondaryColor: 0xDA70D6, wheelStyle: 'alloy', bodyStyle: 'coupe', hasFlying: false }
  ],
  '2025': [
    { primaryColor: 0x00FF7F, secondaryColor: 0x90EE90, wheelStyle: 'minimal', bodyStyle: 'electric', hasFlying: false },
    { primaryColor: 0x00BFFF, secondaryColor: 0x87CEFA, wheelStyle: 'minimal', bodyStyle: 'autonomous', hasFlying: false },
    { primaryColor: 0x32CD32, secondaryColor: 0x7CFC00, wheelStyle: 'none', bodyStyle: ' pod', hasFlying: false }
  ],
  '2055': [
    { primaryColor: 0x00FFFF, secondaryColor: 0x40E0D0, wheelStyle: 'none', bodyStyle: ' hovercar', hasFlying: true },
    { primaryColor: 0xFF00FF, secondaryColor: 0xDA70D6, wheelStyle: 'none', bodyStyle: ' flying', hasFlying: true },
    { primaryColor: 0xFFD700, secondaryColor: 0xFFA500, wheelStyle: 'none', bodyStyle: ' drone', hasFlying: true }
  ]
};

export class VehicleFactory {
  private styles: VehicleStyle[];

  constructor(private eraId: EraId) {
    this.styles = VEHICLE_STYLES[eraId];
  }

  create(params: VehicleParams): Vehicle {
    const { position, rotation = 0 } = params;
    const vehicleType = Math.floor(Math.random() * this.styles.length);
    const style = this.styles[vehicleType];
    
    const mesh = this.createVehicleMesh(style, position, rotation);
    
    return { mesh, eraId: this.eraId };
  }

  private createVehicleMesh(style: VehicleStyle, position: { x: number; y: number; z: number }, rotation: number): THREE.Mesh {
    let geometry: THREE.BufferGeometry;
    
    if (style.hasFlying) {
      // Flying vehicle or drone
      const size = style.bodyStyle === 'drone' ? 0.5 : 1.0;
      geometry = new THREE.ConeGeometry(size * 2, size * 4, 8);
      geometry.rotateX(Math.PI / 2);
    } else {
      // Ground vehicle
      geometry = new THREE.BoxGeometry(4, 1.5, 8);
    }
    
    const material = new THREE.MeshStandardMaterial({
      color: style.primaryColor,
      metalness: this.eraId === '1945' ? 0.3 : 0.7,
      roughness: this.eraId === '1945' ? 0.7 : 0.3
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y + (style.hasFlying ? 2 : 0.75), position.z);
    mesh.rotation.y = rotation;
    mesh.castShadow = true;
    
    // Add hover effect for flying vehicles
    if (style.hasFlying) {
      const glowGeometry = new THREE.SphereGeometry(1.5, 8, 8);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: style.secondaryColor,
        transparent: true,
        opacity: 0.3
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      mesh.add(glow);
    }
    
    return mesh;
  }
}