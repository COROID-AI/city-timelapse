import * as THREE from 'three';
import type { EraId } from '../eras.js';

/**
 * Storefront configuration for era-specific commercial building facades
 */
export interface StorefrontConfig {
  position: [number, number, number];
  eraId: EraId;
  storeType: 'general-store' | 'clothing' | 'electronics' | 'restaurant' | 'cafe' | 'bank' | 'pharmacy' | 'grocery';
}

/**
 * Era-specific storefront styles
 */
const STOREFRONT_STYLES: Record<EraId, {
  facadeColors: number[];
  signColors: number[];
  windowDisplayStyles: string[];
  materials: string[];
  signStyles: string[];
}> = {
  '1945': {
    facadeColors: [0x8B4513, 0xCD853F, 0xA0522D],
    signColors: [0xFFFFFF, 0xFFFF00, 0xFFD700],
    windowDisplayStyles: ['hand-painted', 'glass-cases', 'fabric-drapes'],
    materials: ['brick', 'wood', 'metal'],
    signStyles: ['hand-painted', 'neon-tube', 'backlit-metal']
  },
  '1965': {
    facadeColors: [0xFF69B4, 0x4169E1, 0x32CD32, 0xFFD700],
    signColors: [0xFFFFFF, 0xFF0000, 0x00FF00, 0xFFFF00],
    windowDisplayStyles: ['mannequin-display', 'colorful-fabrics', 'record-covers'],
    materials: ['tile', 'metal', 'plastic'],
    signStyles: ['neon', 'illuminated', 'metal-letter']
  },
  '1985': {
    facadeColors: [0x2F4F4F, 0x708090, 0xC0C0C0, 0x000080],
    signColors: [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00],
    windowDisplayStyles: ['mannequin-display', 'bright-lights', 'glass-showcases'],
    materials: ['glass', 'steel', 'concrete'],
    signStyles: ['backlit', 'reflective', 'digital-display']
  },
  '2005': {
    facadeColors: [0x000000, 0xFFFFFF, 0x808080, 0xFF0000],
    signColors: [0x00FF00, 0x00FFFF, 0xFF00FF, 0xFFFF00],
    windowDisplayStyles: ['LED-lit', 'modern-mannequins', 'interactive'],
    materials: ['glass', 'steel', 'composite'],
    signStyles: ['LED-panel', 'LCD', 'projection']
  },
  '2025': {
    facadeColors: [0x000000, 0x1E90FF, 0x98FB98, 0x00CED1],
    signColors: [0x00CED1, 0x1E90FF, 0x98FB98, 0xFF69B4],
    windowDisplayStyles: ['holographic', 'AR-overlay', 'transparent-display'],
    materials: ['smart-glass', 'carbon-fiber', 'bioluminescent'],
    signStyles: ['hologram', 'OLED', 'nano-pixel']
  }
};

/**
 * Creates a storefront mesh with era-appropriate design
 */
export function createStorefront(config: StorefrontConfig): THREE.Group {
  const group = new THREE.Group();
  const styles = STOREFRONT_STYLES[config.eraId];
  const storeType = config.storeType;

  // Main storefront facade
  const facadeGeometry = new THREE.BoxGeometry(12, 8, 1);
  const facadeMaterial = new THREE.MeshStandardMaterial({
    color: styles.facadeColors[Math.floor(Math.random() * styles.facadeColors.length)],
    roughness: 0.6,
    metalness: 0.4
  });

  const facade = new THREE.Mesh(facadeGeometry, facadeMaterial);
  facade.position.y = 4;
  facade.castShadow = true;
  facade.receiveShadow = true;
  group.add(facade);

  // Add era-specific signage
  addSignage(group, config.eraId, storeType, styles);

  // Add window displays
  addWindowDisplays(group, config.eraId, storeType, styles);

  // Position the storefront
  group.position.set(config.position[0], config.position[1], config.position[2]);

  // Store metadata
  group.userData = {
    eraId: config.eraId,
    storeType: storeType,
    selectable: true
  };

  return group;
}

/**
 * Adds era-specific signage to the storefront
 */
function addSignage(
  group: THREE.Group,
  eraId: EraId,
  storeType: StorefrontConfig['storeType'],
  styles: typeof STOREFRONT_STYLES[EraId]
): void {
  const signStyle = styles.signStyles[Math.floor(Math.random() * styles.signStyles.length)];
  const signColor = styles.signColors[Math.floor(Math.random() * styles.signColors.length)];

  if (signStyle === 'hand-painted' || signStyle === 'hand-painted') {
    // 1945-era hand-painted sign
    const signGeometry = new THREE.BoxGeometry(8, 2, 0.2);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: signColor,
      roughness: 0.8
    });

    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, 6.5, 0.51);
    sign.castShadow = true;
    group.add(sign);

    // Add hand-painted lettering effect
    const letterGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.21);
    const letterMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.9
    });

    for (let i = 0; i < 8; i++) {
      const letter = new THREE.Mesh(letterGeometry, letterMaterial);
      letter.position.set(-6 + i, 6.5, 0.62);
      letter.castShadow = true;
      group.add(letter);
    }
  } else if (signStyle === 'neon' || signStyle === 'neon-tube') {
    // 1965-era neon sign
    const signGeometry = new THREE.BoxGeometry(8, 2, 0.3);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: signColor,
      roughness: 0.3,
      metalness: 0.8,
      emissive: signColor,
      emissiveIntensity: 0.5
    });

    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, 6.5, 0.51);
    sign.castShadow = true;
    group.add(sign);
  } else if (signStyle === 'LED-panel' || signStyle === 'digital-display') {
    // 2005-era LED/LCD sign
    const signGeometry = new THREE.BoxGeometry(8, 2, 0.2);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: signColor,
      roughness: 0.2,
      metalness: 0.5,
      emissive: signColor,
      emissiveIntensity: 0.7
    });

    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, 6.5, 0.51);
    sign.castShadow = true;
    group.add(sign);
  } else if (signStyle === 'hologram' || signStyle === 'OLED') {
    // 2025-era holographic sign
    const signGeometry = new THREE.BoxGeometry(8, 2, 0.1);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: signColor,
      roughness: 0.1,
      metalness: 0.9,
      emissive: signColor,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.8
    });

    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, 6.5, 0.51);
    sign.castShadow = true;
    group.add(sign);

    // Add floating holographic elements
    const holoGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const holoMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      emissive: 0xFFFFFF,
      roughness: 0.1,
      transparent: true,
      opacity: 0.6
    });

    for (let i = 0; i < 5; i++) {
      const holo = new THREE.Mesh(holoGeometry, holoMaterial);
      holo.position.set(-6 + i * 3, 7.5, 1);
      holo.castShadow = true;
      group.add(holo);
    }
  }
}

/**
 * Adds era-specific window displays
 */
function addWindowDisplays(
  group: THREE.Group,
  eraId: EraId,
  storeType: StorefrontConfig['storeType'],
  styles: typeof STOREFRONT_STYLES[EraId]
): void {
  const windowDisplayStyle = styles.windowDisplayStyles[Math.floor(Math.random() * styles.windowDisplayStyles.length)];

  // Base window
  const windowGeometry = new THREE.BoxGeometry(10, 4, 0.2);
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x87CEEB,
    roughness: 0.1,
    metalness: 0.5,
    transparent: true,
    opacity: 0.7
  });

  const window = new THREE.Mesh(windowGeometry, windowMaterial);
  window.position.set(0, 2, 0.51);
  window.castShadow = true;
  group.add(window);

  if (windowDisplayStyle === 'hand-painted' || windowDisplayStyle === 'fabric-drapes') {
    // 1945 simple window display
    const displayGeometry = new THREE.BoxGeometry(8, 3, 0.1);
    const displayMaterial = new THREE.MeshStandardMaterial({
      color: 0xDEB887,
      roughness: 0.8
    });

    const display = new THREE.Mesh(displayGeometry, displayMaterial);
    display.position.set(0, 2, 0.62);
    group.add(display);
  } else if (windowDisplayStyle === 'mannequin-display' || windowDisplayStyle === 'colorful-fabrics') {
    // 1965 mannequin display
    const mannequinGeometry = new THREE.CylinderGeometry(0.2, 0.15, 2.5);
    const mannequinMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.6
    });

    for (let i = 0; i < 3; i++) {
      const mannequin = new THREE.Mesh(mannequinGeometry, mannequinMaterial);
      mannequin.position.set(-2 + i * 2, 1.5, 0.62);
      mannequin.castShadow = true;
      group.add(mannequin);
    }
  } else if (windowDisplayStyle === 'LED-lit' || windowDisplayStyle === 'modern-mannequins') {
    // 2005 LED-lit display
    const shelfGeometry = new THREE.BoxGeometry(8, 0.2, 0.1);
    const shelfMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.5,
      emissive: 0xFFFFFF,
      emissiveIntensity: 0.3
    });

    for (let i = 0; i < 4; i++) {
      const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
      shelf.position.set(-2 + i, 0.5 + i * 0.8, 0.62);
      shelf.castShadow = true;
      group.add(shelf);
    }
  } else if (windowDisplayStyle === 'holographic' || windowDisplayStyle === 'AR-overlay') {
    // 2025 holographic display
    const holoDisplayGeometry = new THREE.PlaneGeometry(8, 3);
    const holoMaterial = new THREE.MeshStandardMaterial({
      color: 0x00CED1,
      roughness: 0.1,
      metalness: 0.8,
      emissive: 0x00CED1,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });

    const holoDisplay = new THREE.Mesh(holoDisplayGeometry, holoMaterial);
    holoDisplay.position.set(0, 2, 0.62);
    group.add(holoDisplay);

    // Floating product displays
    const productGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const productMaterial = new THREE.MeshStandardMaterial({
      color: 0x1E90FF,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0x1E90FF,
      emissiveIntensity: 0.5
    });

    for (let i = 0; i < 5; i++) {
      const product = new THREE.Mesh(productGeometry, productMaterial);
      product.position.set(-2.5 + i * 1.25, 2, 0.7);
      product.castShadow = true;
      group.add(product);
    }
  }
}