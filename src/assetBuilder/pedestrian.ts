/**
 * Pedestrian Factory - Creates era-appropriate pedestrian outfits and accessories
 * 1945: Formal wear, 1965: Mod fashion, 1985: Bold colors,
 * 2005: Casual jeans, 2025: Tech wear, 2055: Futuristic apparel
 */

import * as THREE from 'three';
import type { EraId } from '../eras';

export interface Pedestrian {
  mesh: THREE.Mesh;
  eraId: EraId;
}

export interface PedestrianParams {
  position: { x: number; y: number; z: number };
}

type PedestrianStyle = {
  topColor: number;
  bottomColor: number;
  accessoryColor: number;
  accessoryType: string;
};

const PEDESTRIAN_STYLES: Record<EraId, PedestrianStyle[]> = {
  '1945': [
    { topColor: 0x2F4F4F, bottomColor: 0x000080, accessoryColor: 0x8B4513, accessoryType: 'hat' },
    { topColor: 0x8B0000, bottomColor: 0x8B4513, accessoryColor: 0x000000, accessoryType: 'gloves' },
    { topColor: 0x000080, bottomColor: 0x2F4F4F, accessoryColor: 0xFFFFFF, accessoryType: 'bag' }
  ],
  '1965': [
    { topColor: 0xFF69B4, bottomColor: 0x4169E1, accessoryColor: 0xFFD700, accessoryType: 'glasses' },
    { topColor: 0x32CD32, bottomColor: 0x006400, accessoryColor: 0xFF4500, accessoryType: 'scarf' },
    { topColor: 0xFF4500, bottomColor: 0x8B4513, accessoryColor: 0x4169E1, accessoryType: 'boots' }
  ],
  '1985': [
    { topColor: 0xFF1493, bottomColor: 0xFF69B4, accessoryColor: 0x00FF7F, accessoryType: 'headband' },
    { topColor: 0x4169E1, bottomColor: 0x1E90FF, accessoryColor: 0xFFD700, accessoryType: 'leg_warmers' },
    { topColor: 0x32CD32, bottomColor: 0xADFF2F, accessoryColor: 0xFF4500, accessoryType: 'arm_band' }
  ],
  '2005': [
    { topColor: 0x8B4513, bottomColor: 0x000080, accessoryColor: 0x000000, accessoryType: 'belt' },
    { topColor: 0x000080, bottomColor: 0x8B4513, accessoryColor: 0x4682B4, accessoryType: 'wallet' },
    { topColor: 0x4682B4, bottomColor: 0x2F4F4F, accessoryColor: 0x808080, accessoryType: 'phone' }
  ],
  '2025': [
    { topColor: 0x00BFFF, bottomColor: 0x32CD32, accessoryColor: 0xFF69B4, accessoryType: 'smartwatch' },
    { topColor: 0x90EE90, bottomColor: 0x2F4F4F, accessoryColor: 0x00FFFF, accessoryType: 'vr_glasses' },
    { topColor: 0x32CD32, bottomColor: 0x006400, accessoryColor: 0xFFD700, accessoryType: 'fitness_tracker' }
  ],
  '2055': [
    { topColor: 0x00FFFF, bottomColor: 0x000080, accessoryColor: 0xFF00FF, accessoryType: 'holographic_jewelry' },
    { topColor: 0xFF00FF, bottomColor: 0x9932CC, accessoryColor: 0x00FFFF, accessoryType: 'neural_implant' },
    { topColor: 0x9932CC, bottomColor: 0x00FFFF, accessoryColor: 0xFF00FF, accessoryType: 'exoskeleton' }
  ]
};

export class PedestrianFactory {
  private styles: PedestrianStyle[];

  constructor(private eraId: EraId) {
    this.styles = PEDESTRIAN_STYLES[eraId];
  }

  create(params: PedestrianParams): Pedestrian {
    const { position } = params;
    const style = this.styles[Math.floor(Math.random() * this.styles.length)];
    
    const mesh = this.createPedestrianMesh(style, position);
    
    return { mesh, eraId: this.eraId };
  }

  private createPedestrianMesh(style: PedestrianStyle, position: { x: number; y: number; z: number }): THREE.Mesh {
    // Body (simple cylinder for performance)
    const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8);
    const headGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: style.topColor });
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xF5DEB3 }); // Skin tone
    
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.6;
    
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.5;
    
    const group = new THREE.Group();
    group.add(body);
    group.add(head);
    group.position.set(position.x, position.y, position.z);
    
    // Add accessory based on era
    this.addAccessory(group, style.accessoryType, style.accessoryColor);
    
    return group as unknown as THREE.Mesh;
  }

  private addAccessory(group: THREE.Group, accessoryType: string, color: number): void {
    const accessoryGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const accessoryMaterial = new THREE.MeshStandardMaterial({ color });
    const accessory = new THREE.Mesh(accessoryGeometry, accessoryMaterial);
    
    switch (accessoryType) {
      case 'hat':
        accessory.scale.set(0.6, 0.3, 0.6);
        accessory.position.y = 1.85;
        break;
      case 'glasses':
      case 'vr_glasses':
        accessory.scale.set(0.4, 0.1, 0.1);
        accessory.position.set(0, 1.45, 0.25);
        break;
      case 'holographic_jewelry':
        accessory.scale.set(0.2, 0.2, 0.2);
        accessory.position.set(0, 1.4, 0.3);
        break;
      default:
        accessory.scale.set(0.2, 0.3, 0.1);
        accessory.position.set(0, 1.2, 0.3);
    }
    
    group.add(accessory);
  }
}