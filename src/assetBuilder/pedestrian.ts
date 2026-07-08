import * as THREE from 'three';
import type { EraId } from '../eras.js';
import type { AssetBuilder, PedestrianConfig as IPedestrianConfig } from './assetSet.js';

/**
 * Pedestrian configuration for era-specific human models
 * Implements BaseAssetConfig with pedestrian-specific properties
 */
export interface PedestrianConfig {
  position: [number, number, number];
  eraId: EraId;
  pedestrianType: 'business' | 'casual' | 'worker' | 'child' | 'elderly';
}

/**
 * Era-specific pedestrian styles
 */
const PEDESTRIAN_STYLES: Record<EraId, {
  clothingColors: number[];
  hatStyles: string[];
  accessoryStyles: string[];
  heightRange: [number, number];
}> = {
  '1945': {
    clothingColors: [0x1E90FF, 0x8B0000, 0x2F4F4F, 0x8B4513, 0x654321],
    hatStyles: ['fedora', 'flat-cap', 'headscarf', 'none'],
    accessoryStyles: ['briefcase', 'newspaper', 'handbag', 'none'],
    heightRange: [1.5, 1.8]
  },
  '1965': {
    clothingColors: [0xFF69B4, 0x32CD32, 0x4169E1, 0xFF4500, 0x9370DB],
    hatStyles: ['newsboy', 'bandana', 'none', 'hair-bow'],
    accessoryStyles: ['radio', 'newspaper', 'none', 'record-player'],
    heightRange: [1.5, 1.8]
  },
  '1985': {
    clothingColors: [0x000080, 0x800080, 0xFFD700, 0x2F4F4F, 0x8B0000],
    hatStyles: ['baseball-cap', 'visor', 'none', 'sweatband'],
    accessoryStyles: ['walkman', 'boombox', 'none', 'jewelry'],
    heightRange: [1.5, 1.9]
  },
  '2005': {
    clothingColors: [0x000000, 0xFFFFFF, 0xFF0000, 0x00FF00, 0x0000FF],
    hatStyles: ['baseball-cap', 'beanie', 'visor', 'none'],
    accessoryStyles: ['cellphone', 'ipod', 'shopping-bag', 'none'],
    heightRange: [1.5, 1.9]
  },
  '2025': {
    clothingColors: [0x00CED1, 0x1E90FF, 0x98FB98, 0xFF69B4, 0xFFFFFF],
    hatStyles: ['smart-cap', 'visor', 'none', 'ar-glasses'],
    accessoryStyles: ['smartphone', 'tablet', 'wearable', 'none'],
    heightRange: [1.5, 1.9]
  }
};

/**
 * Creates a pedestrian mesh with era-appropriate clothing and accessories
 * Implements AssetBuilder<PedestrianConfig>
 */
export const pedestrianBuilder: AssetBuilder<PedestrianConfig> = {
  create(config: PedestrianConfig): THREE.Group {
    return createPedestrian(config);
  },
  getEraId(asset: THREE.Group): EraId | undefined {
    return asset.userData?.eraId;
  },
  getAssetType(): string {
    return 'pedestrian';
  }
};

/**
 * Creates a pedestrian mesh with era-appropriate clothing and accessories
 */
export function createPedestrian(config: PedestrianConfig): THREE.Group {
  const group = new THREE.Group();
  const styles = PEDESTRIAN_STYLES[config.eraId];
  const height = styles.heightRange[0] + Math.random() * (styles.heightRange[1] - styles.heightRange[0]);

  // Body
  const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, height * 0.4);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: styles.clothingColors[Math.floor(Math.random() * styles.clothingColors.length)],
    roughness: 0.8,
    metalness: 0.2
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = height * 0.2;
  body.castShadow = true;
  group.add(body);

  // Head
  const headGeometry = new THREE.SphereGeometry(0.3, 12, 12);
  const skinColor = 0xF5DEB3;
  const headMaterial = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.7,
    metalness: 0.1
  });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = height * 0.6;
  head.castShadow = true;
  group.add(head);

  // Legs
  const legGeometry = new THREE.CylinderGeometry(0.1, 0.1, height * 0.4);
  const legMaterial = new THREE.MeshStandardMaterial({
    color: 0x2F4F4F,
    roughness: 0.9
  });

  const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
  leftLeg.position.set(-0.15, height * 0.05, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
  rightLeg.position.set(0.15, height * 0.05, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Arms
  const armGeometry = new THREE.CylinderGeometry(0.08, 0.08, height * 0.3);
  const armMaterial = new THREE.MeshStandardMaterial({
    color: styles.clothingColors[Math.floor(Math.random() * styles.clothingColors.length)],
    roughness: 0.8
  });

  const leftArm = new THREE.Mesh(armGeometry, armMaterial);
  leftArm.position.set(-0.4, height * 0.3, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeometry, armMaterial);
  rightArm.position.set(0.4, height * 0.3, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // Add era-specific accessories
  addAccessories(group, config.eraId, styles, height);

  // Position the pedestrian
  group.position.set(config.position[0], config.position[1], config.position[2]);

  // Store metadata
  group.userData = {
    eraId: config.eraId,
    pedestrianType: config.pedestrianType,
    selectable: true
  };

  return group;
}

/**
 * Adds era-specific accessories (hats, devices, bags)
 */
function addAccessories(
  group: THREE.Group,
  eraId: EraId,
  styles: typeof PEDESTRIAN_STYLES[EraId],
  height: number
): void {
  // Hat
  const hatStyle = styles.hatStyles[Math.floor(Math.random() * styles.hatStyles.length)];
  if (hatStyle === 'fedora') {
    const hatGeometry = new THREE.CylinderGeometry(0.32, 0.35, 0.2);
    const hatMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.7
    });
    const hat = new THREE.Mesh(hatGeometry, hatMaterial);
    hat.position.y = height * 0.75;
    hat.castShadow = true;
    group.add(hat);
  } else if (hatStyle === 'flat-cap') {
    const hatGeometry = new THREE.CylinderGeometry(0.31, 0.31, 0.15);
    const hatMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFD700,
      roughness: 0.6
    });
    const hat = new THREE.Mesh(hatGeometry, hatMaterial);
    hat.position.y = height * 0.68;
    hat.castShadow = true;
    group.add(hat);
  } else if (hatStyle === 'newsboy') {
    const hatGeometry = new THREE.CylinderGeometry(0.33, 0.33, 0.25);
    const hatMaterial = new THREE.MeshStandardMaterial({
      color: 0x32CD32,
      roughness: 0.6
    });
    const hat = new THREE.Mesh(hatGeometry, hatMaterial);
    hat.position.y = height * 0.72;
    hat.castShadow = true;
    group.add(hat);
  } else if (hatStyle === 'baseball-cap') {
    const hatGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.25);
    const hatMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF0000,
      roughness: 0.5
    });
    const hat = new THREE.Mesh(hatGeometry, hatMaterial);
    hat.position.set(0, height * 0.65, 0.2);
    hat.castShadow = true;
    group.add(hat);
  }

  // Accessories
  const accessoryStyle = styles.accessoryStyles[Math.floor(Math.random() * styles.accessoryStyles.length)];
  if (accessoryStyle === 'briefcase' || accessoryStyle === 'handbag') {
    const bagGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.3);
    const bagMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.6
    });
    const bag = new THREE.Mesh(bagGeometry, bagMaterial);
    bag.position.set(0.35, height * 0.25, 0);
    bag.castShadow = true;
    group.add(bag);
  } else if (accessoryStyle === 'cellphone' || accessoryStyle === 'tablet') {
    const deviceGeometry = new THREE.BoxGeometry(0.3, 0.03, 0.2);
    const deviceMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.3,
      metalness: 0.5
    });
    const device = new THREE.Mesh(deviceGeometry, deviceMaterial);
    device.position.set(0.35, height * 0.35, 0);
    device.castShadow = true;
    group.add(device);
  } else if (accessoryStyle === 'smartphone') {
    const phoneGeometry = new THREE.BoxGeometry(0.25, 0.02, 0.15);
    const phoneMaterial = new THREE.MeshStandardMaterial({
      color: 0xC0C0C0,
      roughness: 0.2,
      metalness: 0.8
    });
    const phone = new THREE.Mesh(phoneGeometry, phoneMaterial);
    phone.position.set(0.35, height * 0.35, 0);
    phone.castShadow = true;
    group.add(phone);
  } else if (accessoryStyle === 'walkman') {
    const walkmanGeometry = new THREE.BoxGeometry(0.25, 0.05, 0.05);
    const walkmanMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFD700,
      roughness: 0.4
    });
    const walkman = new THREE.Mesh(walkmanGeometry, walkmanMaterial);
    walkman.position.set(0.35, height * 0.35, 0);
    walkman.castShadow = true;
    group.add(walkman);
  } else if (accessoryStyle === 'shopping-bag') {
    const bagGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const bagMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF69B4,
      roughness: 0.5
    });
    const bag = new THREE.Mesh(bagGeometry, bagMaterial);
    bag.position.set(0.35, height * 0.25, 0);
    bag.castShadow = true;
    group.add(bag);
  }
}