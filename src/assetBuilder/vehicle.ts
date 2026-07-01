import * as THREE from 'three';
import type { EraId, VehicleVariant } from '../eras/types';
import { ERAS } from '../eras/data';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);

/** Body colors per era so the vehicle set looks period-appropriate. */
const BODY_COLORS: Record<EraId, string[]> = {
  '1945': ['#6b4a2a', '#3a4a6a', '#2a2a2a', '#7a5a3a'],
  '1965': ['#c0392b', '#e67e22', '#ecf0f1', '#2c3e50'],
  '1985': ['#ff2d95', '#00e5ff', '#ffe600', '#9b59b6'],
  '2005': ['#34495e', '#bdc3c7', '#c0392b', '#16a085'],
  '2025': ['#1abc9c', '#3498db', '#ecf0f1', '#2c3e50'],
};

/**
 * Build a vehicle Group for an era. Cars get a low rounded body; trucks get a
 * cab + cargo box. Wheel children are named so animators can spin them.
 * @returns Group with named children: 'chassis', and 'wheels' (wheel_FL/FR/RL/RR).
 */
export function makeVehicle(era: EraId, variant: VehicleVariant, index = 0): THREE.Group {
  const desc = ERAS[era];
  const group = new THREE.Group();
  group.name = `vehicle:${era}:${variant}:${index}`;

  const colors = BODY_COLORS[era];
  const bodyColor = colors[index % colors.length];
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.5,
    metalness: 0.3,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#1a2030',
    roughness: 0.15,
    metalness: 0.4,
    transparent: true,
    opacity: 0.7,
  });

  if (variant === 'truck') {
    buildTruck(group, bodyMat, glassMat, era);
  } else {
    buildCar(group, bodyMat, glassMat, era);
  }

  void desc;
  group.userData.variant = variant;
  group.userData.era = era;
  return group;
}

function buildCar(
  group: THREE.Group,
  bodyMat: THREE.Material,
  glassMat: THREE.Material,
  era: EraId,
): void {
  const isFuture = era === '2025';
  const length = 4.2;
  const width = 1.9;
  const bodyH = isFuture ? 0.7 : 0.8;

  const chassis = new THREE.Group();
  chassis.name = 'chassis';

  // Lower body
  const body = new THREE.Mesh(boxGeo, bodyMat);
  body.scale.set(width, bodyH, length);
  body.position.y = bodyH / 2 + 0.35;
  chassis.add(body);

  // Cabin
  const cabinLen = length * 0.5;
  const cabin = new THREE.Mesh(boxGeo, glassMat);
  cabin.scale.set(width * 0.92, 0.7, cabinLen);
  cabin.position.set(0, bodyH + 0.35 + 0.35, -length * 0.05);
  chassis.add(cabin);

  group.add(chassis);
  addWheels(group, width, length, 0.45);
}

function buildTruck(
  group: THREE.Group,
  bodyMat: THREE.Material,
  glassMat: THREE.Material,
  era: EraId,
): void {
  void era;
  const length = 7;
  const width = 2.2;

  const chassis = new THREE.Group();
  chassis.name = 'chassis';

  // Cab
  const cab = new THREE.Mesh(boxGeo, bodyMat);
  cab.scale.set(width, 2.2, 2.4);
  cab.position.set(0, 1.5, length / 2 - 1.2);
  chassis.add(cab);

  // Cab windshield
  const wind = new THREE.Mesh(boxGeo, glassMat);
  wind.scale.set(width * 0.8, 0.9, 0.2);
  wind.position.set(0, 1.9, length / 2 - 0.1);
  chassis.add(wind);

  // Cargo box
  const cargo = new THREE.Mesh(boxGeo, bodyMat);
  cargo.scale.set(width, 2.6, length * 0.55);
  cargo.position.set(0, 1.6, -length * 0.12);
  chassis.add(cargo);

  group.add(chassis);
  addWheels(group, width, length, 0.6);
}

function addWheels(
  group: THREE.Group,
  width: number,
  length: number,
  radius: number,
): void {
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.9 });
  const wheels = new THREE.Group();
  wheels.name = 'wheels';

  const halfW = width / 2 + 0.02;
  const halfL = length / 2 - 0.9;
  const positions: Array<[string, number, number]> = [
    ['wheel_FL', -halfW, halfL],
    ['wheel_FR', halfW, halfL],
    ['wheel_RL', -halfW, -halfL],
    ['wheel_RR', halfW, -halfL],
  ];

  for (const [name, x, z] of positions) {
    const wheel = new THREE.Mesh(cylGeo, wheelMat);
    wheel.name = name;
    wheel.rotation.z = Math.PI / 2; // lay cylinder on side along X
    wheel.scale.set(1, 0.4, 1); // radius X stays r, thickness along Y
    wheel.position.set(x, radius, z);
    wheel.castShadow = true;
    wheels.add(wheel);
  }

  group.add(wheels);
}
