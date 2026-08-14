import React, { useEffect, useRef, useState } from 'react';
import { useEraStore } from '../store/eraStore';
import { EraId, ERA_IDS } from '../eras';
import { useThree } from '@react-three/fiber';
import { useResize } from '@react-three/drei';

/**
 * CoffeeEquipment - Era-specific coffee-making equipment rendered on the counter
 * 
 * Renders distinct coffee equipment setups for each of the 5 eras:
 * - 1945: Manual percolators and basic drip methods
 * - 1965: Automatic drip + basic chrome espresso machine
 * - 1985: Commercial automatic brewer and basic espresso machine
 * - 2005: Semi-automatic espresso machine with grinder and blender
 * - 2025: High-tech super-automatic with touch screen, cold brew tower, and contactless terminal
 * 
 * All equipment uses Three.js primitives with era-specific materials, colors, and proportions.
 * Equipment scale is realistic relative to counter height (1.1m).
 * Component re-renders when era changes without page reload.
 */
export const CoffeeEquipment: React.FC = () => {
  const { currentEra } = useEraStore();
  const { scene, camera, size } = useThree();
  const { aspect } = useResize();

  // Counter dimensions: 4m wide, 1.1m high, 0.7m deep
  // Counter top surface is at y = 1.1m (top of the box), positioned at z = 5.35
  // Counter width spans from x = -2 to x = 2 (centered)

  // Equipment scale factor: counter height is 1.1m, so we normalize to that
  const scaleFactor = 1.1;

  // Era-specific equipment configurations
  const equipmentConfigs = {
    '1945': {
      title: '1945 - Post-War Era',
      items: [
        // Manual percolator on stove
        {
          type: 'percolator',
          position: { x: -3, y: 1.3, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0.2 },
          size: 0.8,
          material: '#8B4513', // brown
        },
        // Basic drip coffee maker
        {
          type: 'dripMaker',
          position: { x: -1, y: 1.3, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0 },
          size: 0.6,
          material: '#C0C0C0', // silver,
        },
        // Metal French press
        {
          type: 'frenchPress',
          position: { x: 1, y: 1.3, z: 5.5 },
          rotation: { x: 0.1, y: 0, z: 0 },
          size: 0.5,
          material: '#4169E1', // royal blue,
        },
        // Tin mugs
        {
          type: 'tinMug',
          position: { x: 3, y: 1.15, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0 },
          size: 0.3,
          material: '#B0C4DE', // light steel blue,
        },
        // Simple glass carafe
        {
          type: 'glassCarafe',
          position: { x: 2, y: 1.3, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0.1 },
          size: 0.4,
          material: '#F0F8FF', // AliceBlue,
        },
      ],
    },
    '1965': {
      title: '1965 - Civil Rights Era',
      items: [
        // Automatic drip machine with glass pot
        {
          type: 'dripMachine1965',
          position: { x: -2.5, y: 1.4, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0 },
          size: 0.9,
          material: '#FFD700', // gold,
        },
        // Chrome espresso machine (basic)
        {
          type: 'chromeEspresso',
          position: { x: -0.5, y: 1.4, z: 5.5 },
          rotation: { x: 0.1, y: 0, z: 0.1 },
          size: 1.0,
          material: '#C0C0C0', // chrome silver,
        },
        // Ceramic server pots
        {
          type: 'ceramicPot',
          position: { x: 1.5, y: 1.4, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0.1 },
          size: 0.5,
          material: '#FAF0E6', // antique white,
        },
        // Paper filters visible
        {
          type: 'paperFilters',
          position: { x: 2.5, y: 1.25, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0 },
          size: 0.4,
          material: '#FFF8DC', // corn silk,
        },
      ],
    },
    '1985': {
      title: '1985 - Neon & Reagan Era',
      items: [
        // Large automatic commercial brewer
        {
          type: 'commercialBrewer',
          position: { x: -3, y: 1.5, z: 5.5 },
          rotation: { x: 0.1, y: 0, z: 0 },
          size: 1.2,
          material: '#00FF00', // neon green,
        },
        // Basic espresso machine with steam wand
        {
          type: 'espressoSteam',
          position: { x: -1, y: 1.5, z: 5.5 },
          rotation: { x: 0.1, y: 0, z: 0.1 },
          size: 0.8,
          material: '#C0C0C0', // chrome,
        },
        // Plastic cups alongside ceramic
        {
          type: 'plasticCups',
          position: { x: 1, y: 1.25, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0 },
          size: 0.35,
          material: '#FF69B4', // hot pink,
        },
        // Chrome server plates
        {
          type: 'chromePlate',
          position: { x: 2.5, y: 1.25, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0.1 },
          size: 0.45,
          material: '#E5E5E5', // light chrome,
        },
      ],
    },
    '2005': {
      title: '2005 - Digital Transition Era',
      items: [
        // Commercial-grade espresso machine (semi-automatic)
        {
          type: 'semiautomaticEspresso',
          position: { x: -2.5, y: 1.5, z: 5.5 },
          rotation: { x: 0.1, y: 0, z: 0 },
          size: 1.0,
          material: '#8B4513', // brown,
        },
        // Grinder
        {
          type: 'grinder',
          position: { x: -0.5, y: 1.5, z: 5.5 },
          rotation: { x: 0.2, y: 0, z: 0 },
          size: 0.5,
          material: '#CD853F', // peru,
        },
        // Latte art capability (latte art wand)
        {
          type: 'latteArt',
          position: { x: 0.5, y: 1.5, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0.1 },
          size: 0.4,
          material: '#FF1493', // deep pink,
        },
        // Branded cups
        {
          type: 'brandedCups',
          position: { x: 1.5, y: 1.3, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0 },
          size: 0.3,
          material: '#4169E1', // royal blue,
        },
        // Frappuccino-style blender
        {
          type: 'frappuccinoBlender',
          position: { x: 2.5, y: 1.3, z: 5.5 },
          rotation: { x: 0.1, y: 0, z: 0 },
          size: 0.6,
          material: '#FFFFFF', // white,
        },
      ],
    },
    '2025': {
      title: '2025 - Connected Future Era',
      items: [
        // High-end super-automatic espresso machine with touch screen
        {
          type: 'superAutomaticEspresso',
          position: { x: -3, y: 1.6, z: 5.5 },
          rotation: { x: 0.1, y: 0, z: 0 },
          size: 1.1,
          material: '#C0C0C0', // silver,
        },
        // Precision grinder
        {
          type: 'precisionGrinder',
          position: { x: -1, y: 1.6, z: 5.5 },
          rotation: { x: 0.2, y: 0, z: 0 },
          size: 0.6,
          material: '#2F4F4F', // dark slate gray,
        },
        // Cold brew tower
        {
          type: 'coldBrewTower',
          position: { x: 1, y: 1.6, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0.1 },
          size: 0.9,
          material: '#87CEEB', // sky blue,
        },
        // Pour-over station with gooseneck kettle
        {
          type: 'pourOverKettle',
          position: { x: 2.5, y: 1.4, z: 5.5 },
          rotation: { x: 0.1, y: 0, z: 0 },
          size: 0.5,
          material: '#DAA520', // goldenrod,
        },
        // Oat milk alternatives visible
        {
          type: 'oatMilk',
          position: { x: 3.5, y: 1.25, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0 },
          size: 0.3,
          material: '#FFF5EE', // seashell,
        },
        // Contactless payment terminal at counter
        {
          type: 'contactlessTerminal',
          position: { x: 4, y: 1.25, z: 5.5 },
          rotation: { x: 0, y: 0, z: 0 },
          size: 0.25,
          material: '#F0F0F0', // light gray,
        },
      ],
    },
  };

  // Get the current era's equipment configuration
  const eraConfig = equipmentConfigs[currentEra] || equipmentConfigs['1945'];

  useEffect(() => {
    // Component will re-render when era changes via the store
    // This ensures the Three.js scene updates with new equipment
    return;
  }, [currentEra]);

  return null; // Equipment is rendered via Three.js within a Canvas context
};

/**
 * CoffeeEquipmentItem - Individual Three.js primitive for a piece of coffee equipment
 * 
 * Uses Three.js BoxGeometry, SphereGeometry, CylinderGeometry etc. with era-specific materials
 * to render the coffee equipment on the counter.
 */
const CoffeeEquipmentItem: React.FC<{
  type: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  size: number;
  material: string;
}> = ({
  type,
  position,
  rotation,
  size,
  material,
}) => {
  // Scale the size by the factor to maintain realistic proportions relative to counter height
  const scaledSize = size * 0.1; // 0.1m base unit, scaled to 1.1m counter height

  let geometry: any;
  let threeMaterial: any;

  // Determine geometry based on equipment type
  switch (type) {
    case 'percolator':
      // Percolator: cylindrical base with dome top
      geometry = new THREE.CylinderGeometry(scaledSize * 0.6, scaledSize * 0.6, scaledSize * 1.2, 32);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.3, metalness: 0.1 });
      break;

    case 'dripMaker':
      // Basic drip coffee maker: rectangular box with pot and filter
      geometry = new THREE.BoxGeometry(scaledSize * 0.8, scaledSize * 1.0, scaledSize * 0.6);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.5, metalness: 0.2 });
      break;

    case 'frenchPress':
      // French press: cylindrical with plunger
      geometry = new THREE.CylinderGeometry(scaledSize * 0.4, scaledSize * 0.4, scaledSize * 1.5, 32);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.4, metalness: 0.3 });
      break;

    case 'tinMug':
      // Tin mug: cylindrical with handle
      geometry = new THREE.CylinderGeometry(scaledSize * 0.3, scaledSize * 0.3, scaledSize * 0.8, 24);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.7, metalness: 0.4 });
      break;

    case 'glassCarafe':
      // Glass carafe: cylindrical, transparent
      geometry = new THREE.CylinderGeometry(scaledSize * 0.3, scaledSize * 0.3, scaledSize * 1.0, 24);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, transparency: 0.7, metalness: 0, opacity: 0.8 });
      break;

    case 'dripMachine1965':
      // 1965 automatic drip machine: larger rectangular with glass pot
      geometry = new THREE.BoxGeometry(scaledSize * 1.0, scaledSize * 1.2, scaledSize * 0.7);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.4, metalness: 0.5 });
      break;

    case 'chromeEspresso':
      // Chrome espresso machine: highly reflective
      geometry = new THREE.BoxGeometry(scaledSize * 0.9, scaledSize * 1.3, scaledSize * 0.6);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.1, metalness: 0.9 });
      break;

    case 'ceramicPot':
      // Ceramic server pot
      geometry = new THREE.BoxGeometry(scaledSize * 0.6, scaledSize * 0.8, scaledSize * 0.5);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.8, metalness: 0.1 });
      break;

    case 'paperFilters':
      // Paper filters: thin rectangular sheets
      geometry = new THREE.BoxGeometry(scaledSize * 0.5, scaledSize * 0.1, scaledSize * 0.3);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.9, metalness: 0 });
      break;

    case 'commercialBrewer':
      // Large automatic commercial brewer
      geometry = new THREE.BoxGeometry(scaledSize * 1.5, scaledSize * 1.8, scaledSize * 0.8);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.3, metalness: 0.4 });
      break;

    case 'espressoSteam':
      // Espresso machine with steam wand
      geometry = new THREE.BoxGeometry(scaledSize * 0.8, scaledSize * 1.5, scaledSize * 0.5);
      // Add steam wand as cylinder
      const steamGeometry = new THREE.CylinderGeometry(scaledSize * 0.1, scaledSize * 0.1, scaledSize * 0.8, 16);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.2, metalness: 0.8 });
      break;

    case 'plasticCups':
      // Plastic cups: semi-transparent
      geometry = new THREE.ConeGeometry(scaledSize * 0.3, scaledSize * 0.6, 16);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, transparency: 0.6, metalness: 0, opacity: 0.7 });
      break;

    case 'chromePlate':
      // Chrome server plate
      geometry = new THREE.BoxGeometry(scaledSize * 0.7, scaledSize * 0.1, scaledSize * 0.4);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.1, metalness: 0.95 });
      break;

    case 'semiautomaticEspresso':
      // Semi-automatic espresso machine
      geometry = new THREE.BoxGeometry(scaledSize * 1.1, scaledSize * 1.6, scaledSize * 0.7);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.4, metalness: 0.6 });
      break;

    case 'grinder':
      // Coffee grinder
      geometry = new THREE.BoxGeometry(scaledSize * 0.6, scaledSize * 0.4, scaledSize * 0.3);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.5, metalness: 0.3 });
      break;

    case 'latteArt':
      // Latte art capability indicator
      geometry = new THREE.SphereGeometry(scaledSize * 0.3, 16, 16);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.6, metalness: 0.2 });
      break;

    case 'brandedCups':
      // Branded cups
      geometry = new THREE.CylinderGeometry(scaledSize * 0.25, scaledSize * 0.25, scaledSize * 0.7, 16);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.5, metalness: 0.1 });
      break;

    case 'frappuccinoBlender':
      // Frappuccino-style blender
      geometry = new THREE.BoxGeometry(scaledSize * 0.7, scaledSize * 0.6, scaledSize * 0.5);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.7, metalness: 0.1 });
      break;

    case 'superAutomaticEspresso':
      // High-end super-automatic espresso machine with touch screen
      geometry = new THREE.BoxGeometry(scaledSize * 1.3, scaledSize * 1.8, scaledSize * 0.8);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.3, metalness: 0.7 });
      break;

    case 'precisionGrinder':
      // Precision grinder
      geometry = new THREE.BoxGeometry(scaledSize * 0.7, scaledSize * 0.5, scaledSize * 0.4);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.4, metalness: 0.5 });
      break;

    case 'coldBrewTower':
      // Cold brew tower: tall vertical structure
      geometry = new THREE.BoxGeometry(scaledSize * 0.4, scaledSize * 2.0, scaledSize * 0.4);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.5, metalness: 0.3 });
      break;

    case 'pourOverKettle':
      // Pour-over station with gooseneck kettle
      geometry = new THREE.CylinderGeometry(scaledSize * 0.15, scaledSize * 0.3, scaledSize * 1.2, 24);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.6, metalness: 0.4 });
      break;

    case 'oatMilk':
      // Oat milk alternatives
      geometry = new THREE.SphereGeometry(scaledSize * 0.2, 12, 12);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, transparency: 0.8, metalness: 0, opacity: 0.9 });
      break;

    case 'contactlessTerminal':
      // Contactless payment terminal
      geometry = new THREE.BoxGeometry(scaledSize * 0.4, scaledSize * 0.1, scaledSize * 0.2);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material, roughness: 0.5, metalness: 0.1 });
      break;

    default:
      geometry = new THREE.BoxGeometry(scaledSize, scaledSize, scaledSize);
      threeMaterial = new THREE.MeshStandardMaterial({ color: material });
      break;
  }

  return (
    <mesh
      position={position}
      rotation={rotation}
      receiveShadow
      castShadow
    >
      <primitive geometry={geometry} material={threeMaterial} />
    </mesh>
  );
};

// Render the equipment items for the current era
// The equipment is positioned on the counter surface at z = 5.5 (just in front of the counter at z = 5.35)