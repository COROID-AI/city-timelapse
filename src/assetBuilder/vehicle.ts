import * as THREE from 'three';
import type { EraId } from '../eras.js';

/**
 * Vehicle configuration for era-specific designs
 */
export interface VehicleConfig {
  position: [number, number, number];
  eraId: EraId;
  vehicleType: 'car' | 'truck' | 'bus' | 'horse-drawn' | 'motorcycle' | 'electric' | 'autonomous';
}

/**
 * Era-specific vehicle styles
 */
const VEHICLE_STYLES: Record<EraId, {
  bodyColors: number[];
  vehicleTypes: VehicleConfig['vehicleType'][];
  wheelCount: [number, number];
  sizeRange: [number, number];
  features: string[];
}> = {
  '1945': {
    bodyColors: [0x2F4F4F, 0x8B4513, 0x8B0000, 0x4682B4],
    vehicleTypes: ['car', 'truck', 'horse-drawn', 'bus'],
    wheelCount: [4, 6],
    sizeRange: [3, 2.5],
    features: ['chrome-details', 'round-headlights', 'metal-bumper', 'cloth-roof']
  },
  '1965': {
    bodyColors: [0xFF69B4, 0x4169E1, 0x32CD32, 0xFFD700, 0xFF4500],
    vehicleTypes: ['car', 'truck', 'bus', 'motorcycle'],
    wheelCount: [4, 4],
    sizeRange: [4, 1.8],
    features: ['tail-fins', 'chrome-grille', 'round-lights', 'whitewall-tires']
  },
  '1985': {
    bodyColors: [0x2F4F4F, 0xC0C0C0, 0x000080, 0x800080],
    vehicleTypes: ['car', 'truck', 'bus', 'motorcycle'],
    wheelCount: [4, 4],
    sizeRange: [4.2, 1.6],
    features: ['boxy-shape', 'square-headlights', 'plastic-bumper', 'reflective-stripes']
  },
  '2005': {
    bodyColors: [0xFFFFFF, 0x000000, 0x8B0000, 0x4682B4, 0x2F4F4F],
    vehicleTypes: ['car', 'truck', 'bus', 'motorcycle'],
    wheelCount: [4, 4],
    sizeRange: [4.3, 1.5],
    features: ['aerodynamic', 'clear-lights', 'body-kit', 'alloy-wheels']
  },
  '2025': {
    bodyColors: [0x00CED1, 0x1E90FF, 0x98FB98, 0xFF69B4, 0xFFFFFF],
    vehicleTypes: ['electric', 'autonomous', 'motorcycle'],
    wheelCount: [4, 4],
    sizeRange: [4, 1.4],
    features: ['smooth-curves', 'LED-strip', 'autonomous-sensors', 'smart-glass', 'wireless-charging']
  }
};

/**
 * Creates a vehicle mesh with era-appropriate design
 */
export function createVehicle(config: VehicleConfig): THREE.Group {
  const group = new THREE.Group();
  const styles = VEHICLE_STYLES[config.eraId];
  const [length, width] = styles.sizeRange;
  const wheelCount = styles.wheelCount[0];

  // Determine vehicle type
  const vehicleType = config.vehicleType || styles.vehicleTypes[Math.floor(Math.random() * styles.vehicleTypes.length)] as VehicleConfig['vehicleType'];

  if (vehicleType === 'horse-drawn') {
    createHorseDrawnVehicle(group, config.eraId, length, width);
  } else if (vehicleType === 'autonomous' || vehicleType === 'electric') {
    createFutureVehicle(group, vehicleType, config.eraId, length, width);
  } else {
    createMotorVehicle(group, vehicleType, config.eraId, length, width, wheelCount, styles);
  }

  // Position the vehicle
  group.position.set(config.position[0], config.position[1], config.position[2]);

  // Store metadata
  group.userData = {
    eraId: config.eraId,
    vehicleType: vehicleType,
    selectable: true
  };

  return group;
}

/**
 * Creates a horse-drawn vehicle (era-appropriate for 1945)
 */
function createHorseDrawnVehicle(group: THREE.Group, eraId: EraId, length: number, width: number): void {
  // Carriage body
  const bodyGeometry = new THREE.BoxGeometry(length, 1.2, width);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.7,
    metalness: 0.3
  });

  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1.5;
  body.castShadow = true;
  group.add(body);

  // Wheels (wooden spoked)
  const wheelGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.4, 8);
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x654321,
    roughness: 0.8
  });

  for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(-length / 2 + 1 + (i % 2) * (length - 2), 0.8, -width / 2 + (i < 2 ? 0.8 : -0.8));
    wheel.castShadow = true;
    group.add(wheel);
  }

  // Horse placeholder (simple geometric shape)
  const horseGeometry = new THREE.BoxGeometry(1, 1.5, 0.8);
  const horseMaterial = new THREE.MeshStandardMaterial({
    color: 0xDEB887,
    roughness: 0.9
  });

  const horse = new THREE.Mesh(horseGeometry, horseMaterial);
  horse.position.set(-length / 2 - 0.5, 1, 0);
  horse.castShadow = true;
  group.add(horse);
}

/**
 * Creates a future vehicle (electric/autonomous)
 */
function createFutureVehicle(group: THREE.Group, vehicleType: VehicleConfig['vehicleType'], eraId: EraId, length: number, width: number): void {
  const bodyGeometry = new THREE.BoxGeometry(length, 1.2, width);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x00CED1,
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x00CED1,
    emissiveIntensity: 0.2
  });

  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.9;
  body.castShadow = true;
  group.add(body);

  // Add LED strip
  const ledGeometry = new THREE.BoxGeometry(length * 0.8, 0.1, 0.1);
  const ledMaterial = new THREE.MeshStandardMaterial({
    color: 0x00CED1,
    emissive: 0x00CED1,
    roughness: 0.1
  });

  const ledStrip = new THREE.Mesh(ledGeometry, ledMaterial);
  ledStrip.position.set(0, 1.3, width / 2 + 0.05);
  group.add(ledStrip);

  // Wheels (futuristic design)
  const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 6);
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x1E90FF,
    roughness: 0.3,
    metalness: 0.9
  });

  for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(
      -length / 3 + (i % 2) * (length / 3 * 2),
      0.6,
      -width / 2 + 0.6
    );
    wheel.castShadow = true;
    group.add(wheel);
  }

  // Add autonomous sensors (small domes on roof)
  if (vehicleType === 'autonomous') {
    const sensorGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const sensorMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.1,
      metalness: 0.9
    });

    for (let s = 0; s < 4; s++) {
      const sensor = new THREE.Mesh(sensorGeometry, sensorMaterial);
      sensor.position.set(
        -length / 4 + s * (length / 6),
        1.8,
        0
      );
      group.add(sensor);
    }
  }
}

/**
 * Creates a motor vehicle (cars, trucks, buses, motorcycles)
 */
function createMotorVehicle(
  group: THREE.Group,
  vehicleType: VehicleConfig['vehicleType'],
  eraId: EraId,
  length: number,
  width: number,
  wheelCount: number,
  styles: typeof VEHICLE_STYLES[EraId]
): void {
  const bodyGeometry = new THREE.BoxGeometry(length, 1, width);
  let bodyColor = styles.bodyColors[Math.floor(Math.random() * styles.bodyColors.length)];

  // Adjust dimensions for motorcycles
  if (vehicleType === 'motorcycle') {
    bodyGeometry.scale(width * 2, 0.6, width * 0.5);
  }

  // Adjust for trucks and buses
  if (vehicleType === 'truck' || vehicleType === 'bus') {
    bodyGeometry.scale(length * 1.5, 1.2, width);
    bodyColor = 0x2F4F4F; // More muted colors for commercial vehicles
  }

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.4,
    metalness: 0.6
  });

  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = vehicleType === 'motorcycle' ? 0.6 : 0.8;
  body.castShadow = true;
  group.add(body);

  // Add era-specific features
  if (styles.features.includes('tail-fins') && eraId === '1965') {
    addTailFins(group, length, width);
  }

  if (styles.features.includes('chrome-details')) {
    addChromeDetails(group, length, width);
  }

  // Wheels
  const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12);
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: styles.features.includes('whitewall-tires') ? 0xFFFFFF : 0x111111,
    roughness: 0.8
  });

  const wheelY = vehicleType === 'motorcycle' ? 0.4 : 0.3;
  const wheelPositions: number[][] = vehicleType === 'motorcycle'
    ? [[-length / 4, wheelY, 0], [length / 4, wheelY, 0]]
    : [
        [-length / 2 + 1, wheelY, -width / 2 + 0.8],
        [-length / 2 + 1, wheelY, width / 2 - 0.8],
        [length / 2 - 1, wheelY, -width / 2 + 0.8],
        [length / 2 - 1, wheelY, width / 2 - 0.8]
      ];

  wheelPositions.forEach((pos) => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(pos[0], pos[1], pos[2]);
    wheel.castShadow = true;
    group.add(wheel);
  });
}

/**
 * Adds tail fins for 1965 era vehicles
 */
function addTailFins(group: THREE.Group, length: number, width: number): void {
  const finGeometry = new THREE.BoxGeometry(0.2, 0.8, width);
  const finMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFD700,
    roughness: 0.3,
    metalness: 0.7
  });

  const leftFin = new THREE.Mesh(finGeometry, finMaterial);
  leftFin.position.set(-length / 2 + 0.5, 1.3, 0);
  group.add(leftFin);

  const rightFin = new THREE.Mesh(finGeometry, finMaterial);
  rightFin.position.set(length / 2 - 0.5, 1.3, 0);
  group.add(rightFin);
}

/**
 * Adds chrome details for classic vehicles
 */
function addChromeDetails(group: THREE.Group, length: number, width: number): void {
  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xC0C0C0,
    roughness: 0.2,
    metalness: 0.9
  });

  // Grille
  const grilleGeometry = new THREE.BoxGeometry(0.2, 0.4, 0.1);
  const grille = new THREE.Mesh(grilleGeometry, chromeMaterial);
  grille.position.set(-length / 2 - 0.1, 0.8, 0);
  group.add(grille);

  // Bumper
  const bumperGeometry = new THREE.BoxGeometry(0.3, 0.1, width * 0.8);
  const bumper = new THREE.Mesh(bumperGeometry, chromeMaterial);
  bumper.position.set(-length / 2 - 0.2, 0.3, 0);
  group.add(bumper);
}