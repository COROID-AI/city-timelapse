/**
 * Storefront Factory - Creates period-appropriate shop fronts, signage, and window displays
 * Includes neon signs, digital displays, and era-specific brands
 */

import * as THREE from 'three';
import type { EraId } from '../eras';

export interface Storefront {
  mesh: THREE.Mesh;
  eraId: EraId;
}

export interface StorefrontParams {
  position: { x: number; y: number; z: number };
  storeType: number;
}

type StorefrontStyle = {
  primaryColor: number;
  signageColor: number;
  windowColor: number;
  signageStyle: string;
  brand: string;
};

const STOREFRONT_STYLES: Record<EraId, StorefrontStyle[]> = {
  '1945': [
    { primaryColor: 0x8B4513, signageColor: 0xFFFFFF, windowColor: 0x4682B4, signageStyle: 'hand_painted', brand: 'General Store' },
    { primaryColor: 0xCD853F, signageColor: 0x8B0000, windowColor: 0x87CEEB, signageStyle: 'wood_carved', brand: 'Department Mart' },
    { primaryColor: 0xA0522D, signageColor: 0x000080, windowColor: 0x5F9EA0, signageStyle: 'metal_etched', brand: 'Corner Cafe' }
  ],
  '1965': [
    { primaryColor: 0x32CD32, signageColor: 0xFFFFFF, windowColor: 0x00CED1, signageStyle: 'backlit', brand: 'Space Age Apparel' },
    { primaryColor: 0xFF4500, signageColor: 0xFFFF00, windowColor: 0x00FF7F, signageStyle: 'plastic', brand: 'Atomic Kitchen' },
    { primaryColor: 0x1E90FF, signageColor: 0xFF1493, windowColor: 0x40E0D0, signageStyle: 'metallic', brand: 'Jazz Records' }
  ],
  '1985': [
    { primaryColor: 0xFF1493, signageColor: 0x00FFFF, windowColor: 0xFF00FF, signageStyle: 'neon', brand: 'Video Galaxy' },
    { primaryColor: 0x4169E1, signageColor: 0xFFFF00, windowColor: 0x00FFFF, signageStyle: 'neon', brand: 'Synth City' },
    { primaryColor: 0x32CD32, signageColor: 0xFF00FF, windowColor: 0x00FF7F, signageStyle: 'laser', brand: 'Cyber Sports' }
  ],
  '2005': [
    { primaryColor: 0x4682B4, signageColor: 0xFFFFFF, windowColor: 0x87CEFA, signageStyle: 'led', brand: 'Tech World' },
    { primaryColor: 0x2F4F4F, signageColor: 0x00BFFF, windowColor: 0x87CEEB, signageStyle: 'digital', brand: 'Coffee Central' },
    { primaryColor: 0x1E90FF, signageColor: 0xFF69B4, windowColor: 0x00FFFF, signageStyle: 'lcd', brand: 'Mobile Hub' }
  ],
  '2025': [
    { primaryColor: 0x32CD32, signageColor: 0x00FF7F, windowColor: 0x90EE90, signageStyle: 'holographic', brand: 'Eco Market' },
    { primaryColor: 0x00BFFF, signageColor: 0x00FFFF, windowColor: 0x87CEFA, signageStyle: 'smart_glass', brand: 'AutoMart' },
    { primaryColor: 0x90EE90, signageColor: 0x32CD32, windowColor: 0x98FB98, signageStyle: 'adaptive', brand: 'Health Cafe' }
  ],
  '2055': [
    { primaryColor: 0x00FFFF, signageColor: 0xFFFFFF, windowColor: 0xFF00FF, signageStyle: 'force_field', brand: 'Quantum Goods' },
    { primaryColor: 0xFF00FF, signageColor: 0x00FFFF, windowColor: 0x00FF7F, signageStyle: 'projected', brand: 'Holo-Tech' },
    { primaryColor: 0x9932CC, signageColor: 0xFFD700, windowColor: 0xDA70D6, signageStyle: 'ai_generated', brand: 'Neural Cafe' }
  ]
};

export class StorefrontFactory {
  private styles: StorefrontStyle[];

  constructor(private eraId: EraId) {
    this.styles = STOREFRONT_STYLES[eraId];
  }

  create(params: StorefrontParams): Storefront {
    const { position, storeType } = params;
    const style = this.styles[storeType % this.styles.length];
    
    const mesh = this.createStorefrontMesh(style, position);
    
    return { mesh, eraId: this.eraId };
  }

  private createStorefrontMesh(style: StorefrontStyle, position: { x: number; y: number; z: number }): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(12, 8, 3);
    const material = new THREE.MeshStandardMaterial({ 
      color: style.primaryColor,
      roughness: this.eraId === '1945' ? 0.8 : 0.4,
      metalness: this.eraId === '2055' ? 0.9 : 0.6
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y + 4, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Add signage based on era style
    this.addSignage(mesh, style);
    
    return mesh;
  }

  private addSignage(mesh: THREE.Mesh, style: StorefrontStyle): void {
    const signGeometry = new THREE.BoxGeometry(8, 2, 0.2);
    const signMaterial = new THREE.MeshStandardMaterial({ 
      color: style.signageColor,
      emissive: style.signageColor,
      emissiveIntensity: style.signageStyle === 'neon' || style.signageStyle === 'holographic' ? 0.5 : 0
    });
    
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, 5, 1.7);
    mesh.add(sign);
    
    // Add window display area
    if (this.eraId !== '1945') {
      const windowGeometry = new THREE.BoxGeometry(10, 3, 0.1);
      const windowMaterial = new THREE.MeshBasicMaterial({ 
        color: style.windowColor,
        transparent: true,
        opacity: 0.7
      });
      const windowDisplay = new THREE.Mesh(windowGeometry, windowMaterial);
      windowDisplay.position.set(0, 2, 1.65);
      mesh.add(windowDisplay);
    }
  }
}