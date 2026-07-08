/**
 * Building Factory - Creates era-appropriate architectural styles
 * 1945: Art Deco/brick, 1965: Modernist/concrete, 1985: Postmodern/glass,
 * 2005: Contemporary/steel, 2025: Smart glass/green architecture, 2055: Ultra-modern/sustainable
 */

import * as THREE from 'three';
import type { EraId } from '../eras';

export interface Building {
  mesh: THREE.Mesh;
  eraId: EraId;
}

export interface BuildingParams {
  position: { x: number; y: number; z: number };
  height: number;
  buildingType: number;
}

type BuildingStyle = {
  primaryColor: number;
  secondaryColor: number;
  windowColor: number;
  material: string;
  windowStyle: string;
};

const BUILDING_STYLES: Record<EraId, BuildingStyle[]> = {
  '1945': [
    { primaryColor: 0x8B4513, secondaryColor: 0xA0522D, windowColor: 0x4682B4, material: 'brick', windowStyle: 'double_hung' },
    { primaryColor: 0xCD853F, secondaryColor: 0xD2B48C, windowColor: 0x87CEEB, material: 'stone', windowStyle: 'casement' },
    { primaryColor: 0x8B6914, secondaryColor: 0xBC8F8F, windowColor: 0xB0C4DE, material: 'terracotta', windowStyle: 'art_deco' }
  ],
  '1965': [
    { primaryColor: 0x708090, secondaryColor: 0x2F4F4F, windowColor: 0x00CED1, material: 'concrete', windowStyle: 'large_modern' },
    { primaryColor: 0x696969, secondaryColor: 0x778899, windowColor: 0x00FF7F, material: 'breezeblock', windowStyle: 'curtain_wall' },
    { primaryColor: 0x2F4F4F, secondaryColor: 0x008080, windowColor: 0x40E0D0, material: 'glass', windowStyle: 'slab' }
  ],
  '1985': [
    { primaryColor: 0x4682B4, secondaryColor: 0x87CEEB, windowColor: 0xFF1493, material: 'glass', windowStyle: 'neon_framed' },
    { primaryColor: 0x9370DB, secondaryColor: 0xBA55D3, windowColor: 0x00FFFF, material: 'metal', windowStyle: 'geometric' },
    { primaryColor: 0xFF69B4, secondaryColor: 0xFF1493, windowColor: 0xFF00FF, material: 'chrome', windowStyle: 'arched' }
  ],
  '2005': [
    { primaryColor: 0x4682B4, secondaryColor: 0xC0C0C0, windowColor: 0x87CEFA, material: 'steel', windowStyle: 'floor_to_ceiling' },
    { primaryColor: 0x2F4F4F, secondaryColor: 0x708090, windowColor: 0x00BFFF, material: 'aluminum', windowStyle: 'grid' },
    { primaryColor: 0x1E90FF, secondaryColor: 0x87CEEB, windowColor: 0x87CEFA, material: 'glass', windowStyle: 'curtain_wall' }
  ],
  '2025': [
    { primaryColor: 0x32CD32, secondaryColor: 0x90EE90, windowColor: 0x00FF7F, material: 'smart_glass', windowStyle: 'dynamic' },
    { primaryColor: 0x228B22, secondaryColor: 0x3CB371, windowColor: 0x98FB98, material: 'living_wall', windowStyle: 'adaptive' },
    { primaryColor: 0x008080, secondaryColor: 0x20B2AA, windowColor: 0x40E0D0, material: 'composite', windowStyle: 'smart' }
  ],
  '2055': [
    { primaryColor: 0x00FFFF, secondaryColor: 0x40E0D0, windowColor: 0xFF00FF, material: 'carbon_fiber', windowStyle: 'holographic' },
    { primaryColor: 0xFF00FF, secondaryColor: 0xDA70D6, windowColor: 0x00FFFF, material: 'transparent_aluminum', windowStyle: 'force_field' },
    { primaryColor: 0x9932CC, secondaryColor: 0x8A2BE2, windowColor: 0x9370DB, material: 'energy_field', windowStyle: 'projected' }
  ]
};

export class BuildingFactory {
  private styles: BuildingStyle[];

  constructor(private eraId: EraId) {
    this.styles = BUILDING_STYLES[eraId];
  }

  create(params: BuildingParams): Building {
    const { position, height } = params;
    const buildingType = params.buildingType;
    const style = this.styles[buildingType % this.styles.length];
    
    const width = 15 + Math.random() * 5;
    const depth = 12 + Math.random() * 3;
    
    const geometry = new THREE.BoxGeometry(width, height, depth, 2, 4, 2);
    const material = new THREE.MeshStandardMaterial({
      color: style.primaryColor,
      roughness: this.eraId === '1945' ? 0.8 : 0.6,
      metalness: this.getMetalnessForMaterial(style.material)
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y + height / 2, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return { mesh, eraId: this.eraId };
  }

  private getMetalnessForMaterial(material: string): number {
    switch (material) {
      case 'brick':
      case 'stone':
      case 'terracotta':
        return 0.1;
      case 'concrete':
      case 'breezeblock':
        return 0.2;
      case 'glass':
      case 'chrome':
        return 0.8;
      case 'steel':
      case 'aluminum':
        return 0.9;
      case 'smart_glass':
      case 'carbon_fiber':
      case 'transparent_aluminum':
      case 'energy_field':
        return 0.95;
      default:
        return 0.5;
    }
  }
}