import * as THREE from 'three';

/** Creates a vintage 1945-era vintage_sedan vehicle. Features: rounded fenders, whitewall tires, chrome bumpers, maroon paint. Optimized for real-time rendering: max ~15k tris */
export function createVintageSedan(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.isEraObject = true;
  group.userData.vehicleType = 'vintage_sedan';
  group.userData.era = '1945';

  // Sedan body - maroon paint
  const bodyColor = new THREE.Color(0x8B4513); // Dark maroon
  const bodyGeometry = new THREE.BoxGeometry(4, 1.5, 2);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.3,
    metalness: 0.7,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.75;
  group.add(body);

  // Chrome bumpers - front
  const bumperGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.1);
  const bumperMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xC0C0C0), // Chrome silver
    roughness: 0.1,
    metalness: 0.9,
  });
  const frontBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
  frontBumper.position.set(2, 0.1, 0);
  group.add(frontBumper);

  // Chrome bumpers - rear
  const rearBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
  rearBumper.position.set(-2, 0.1, 0);
  group.add(rearBumper);

  // Whitewall tires
  const tireRadius = 0.8;
  const tireWidth = 0.2;
  const tireGeometry = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 16).rotateX(-Math.PI / 2);
  const tireMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xFFFFFF), // White
    roughness: 0.8,
    metalness: 0.1,
  });

  // Front left tire
  const frontLeftTire = new THREE.Mesh(tireGeometry, tireMaterial);
  frontLeftTire.position.set(1.5, 0.4, 1);
  group.add(frontLeftTire);

  // Front right tire
  const frontRightTire = new THREE.Mesh(tireGeometry, tireMaterial);
  frontRightTire.position.set(1.5, 0.4, -1);
  group.add(frontRightTire);

  // Rear left tire
  const rearLeftTire = new THREE.Mesh(tireGeometry, tireMaterial);
  rearLeftTire.position.set(-1.5, 0.4, 1);
  group.add(rearLeftTire);

  // Rear right tire
  const rearRightTire = new THREE.Mesh(tireGeometry, tireMaterial);
  rearRightTire.position.set(-1.5, 0.4, -1);
  group.add(rearRightTire);

  return group;
}

/** Creates a streetcar/trolley vehicle on tracks. Features: overhead wire connection points, streetcar model. Optimized for real-time rendering: max ~12k tris */
export function createStreetcar(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.isEraObject = true;
  group.userData.vehicleType = 'streetcar';
  group.userData.era = '1945';

  // Streetcar body - forest green paint
  const bodyColor = new THREE.Color(0x2F4F4F); // Forest green
  const bodyGeometry = new THREE.BoxGeometry(6, 2.5, 3);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.4,
    metalness: 0.5,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1.25;
  group.add(body);

  // Overhead wire connection points
  const wireGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
  const wireMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xFFD700), // Gold
    roughness: 0.5,
    metalness: 0.8,
  });

  // Front wire connection
  const frontWire = new THREE.Mesh(wireGeometry, wireMaterial);
  frontWire.position.set(2.5, 2, 1.5);
  group.add(frontWire);

  // Rear wire connection
  const rearWire = new THREE.Mesh(wireGeometry, wireMaterial);
  rearWire.position.set(-2.5, 2, -1.5);
  group.add(rearWire);

  // Window details (lighter color)
  const windowGeometry = new THREE.BoxGeometry(0.5, 1.2, 0.2);
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xFFFFFF),
    transparent: true,
    opacity: 0.6,
  });

  for (let i = 0; i < 4; i++) {
    const window = new THREE.Mesh(windowGeometry, windowMaterial);
    window.position.set(0, 1.2 + i * 0.3, 0);
    group.add(window);
  }

  return group;
}

/** Creates a horse-drawn delivery wagon. Features: horse figure, wagon body, period-appropriate styling. Optimized for real-time rendering: max ~10k tris */
export function createHorseWagon(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.isEraObject = true;
  group.userData.vehicleType = 'horse_wagon';
  group.userData.era = '1945';

  // Horse body
  const horseColor = new THREE.Color(0xCD853F); // Brown
  const horseGeometry = new THREE.BoxGeometry(2, 1, 3);
  const horseMaterial = new THREE.MeshStandardMaterial({
    color: horseColor,
    roughness: 0.7,
    metalness: 0.2,
  });
  const horse = new THREE.Mesh(horseGeometry, horseMaterial);
  horse.position.y = 0.5;
  group.add(horse);

  // Wagon body
  const wagonColor = new THREE.Color(0x8B4513); // Brown
  const wagonGeometry = new THREE.BoxGeometry(3, 1, 2);
  const wagonMaterial = new THREE.MeshStandardMaterial({
    color: wagonColor,
    roughness: 0.7,
    metalness: 0.2,
  });
  const wagon = new THREE.Mesh(wagonGeometry, wagonMaterial);
  wagon.position.y = 0.5;
  group.add(wagon);

  // Wheel
  const wheelRadius = 0.6;
  const wheelWidth = 0.25;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16).rotateX(-Math.PI / 2);
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x000000), // Black
    roughness: 0.5,
    metalness: 0.3,
  });

  // Front left wheel
  const frontLeftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  frontLeftWheel.position.set(0.8, 0.3, 1);
  group.add(frontLeftWheel);

  // Front right wheel
  const frontRightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  frontRightWheel.position.set(0.8, 0.3, -1);
  group.add(frontRightWheel);

  // Rear left wheel
  const rearLeftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  rearLeftWheel.position.set(-0.8, 0.3, 1);
  group.add(rearLeftWheel);

  // Rear right wheel
  const rearRightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  rearRightWheel.position.set(-0.8, 0.3, -1);
  group.add(rearRightWheel);

  return group;
}

/** Creates a fire engine with ladder. Features: fire engine body, ladder, period-appropriate styling, red paint. Optimized for real-time rendering: max ~15k tris */
export function createFireEngine(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.isEraObject = true;
  group.userData.vehicleType = 'fire_engine';
  group.userData.era = '1945';

  // Fire engine body - red paint
  const bodyColor = new THREE.Color(0xFF0000); // Fire engine red
  const bodyGeometry = new THREE.BoxGeometry(5, 2.5, 3);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.3,
    metalness: 0.7,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1.25;
  group.add(body);

  // Ladder - extending upward
  const ladderLength = 6;
  const ladderGeometry = new THREE.BoxGeometry(0.2, ladderLength, 0.2);
  const ladderMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xFFFFFF), // Chrome silver
    roughness: 0.1,
    metalness: 0.9,
  });
  const ladder = new THREE.Mesh(ladderGeometry, ladderMaterial);
  ladder.position.set(2, ladderLength / 2, 0);
  ladder.rotation.x = Math.PI / 2; // Vertical orientation
  group.add(ladder);

  // Wheel
  const wheelRadius = 0.6;
  const wheelWidth = 0.25;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16).rotateX(-Math.PI / 2);
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x000000), // Black
    roughness: 0.5,
    metalness: 0.3,
  });

  // Front left wheel
  const frontLeftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  frontLeftWheel.position.set(1.2, 0.3, 1);
  group.add(frontLeftWheel);

  // Front right wheel
  const frontRightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  frontRightWheel.position.set(1.2, 0.3, -1);
  group.add(frontRightWheel);

  // Rear left wheel
  const rearLeftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  rearLeftWheel.position.set(-1.2, 0.3, 1);
  group.add(rearLeftWheel);

  // Rear right wheel
  const rearRightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  rearRightWheel.position.set(-1.2, 0.3, -1);
  group.add(rearRightWheel);

  // Fire hose detail
  const hoseGeometry = new THREE.TorusGeometry(0.1, 0.02, 16, 32);
  const hoseMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x000000),
    roughness: 0.5,
  });
  const frontHose = new THREE.Mesh(hoseGeometry, hoseMaterial);
  frontHose.position.set(2.5, 0.3, 0);
  group.add(frontHose);

  return group;
}

/** Creates a milk delivery truck with period-appropriate branding area. Features: milk truck body, branding area, period-correct paint. Optimized for real-time rendering: max ~12k tris */
export function createMilkTruck(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.isEraObject = true;
  group.userData.vehicleType = 'milk_truck';
  group.userData.era = '1945';

  // Milk truck body - cream paint
  const bodyColor = new THREE.Color(0xFFFFF0); // Cream
  const bodyGeometry = new THREE.BoxGeometry(5, 2, 3);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.4,
    metalness: 0.5,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1;
  group.add(body);

  // Branding area - red cross/cross motif
  const brandingColor = new THREE.Color(0x8B4513); // Maroon
  const brandingGeometry = new THREE.BoxGeometry(2, 1, 0.5);
  const brandingMaterial = new THREE.MeshStandardMaterial({
    color: brandingColor,
    roughness: 0.6,
    metalness: 0.3,
  });
  const branding = new THREE.Mesh(brandingGeometry, brandingMaterial);
  branding.position.set(0, 1, 1.5);
  group.add(branding);

  // Wheel
  const wheelRadius = 0.5;
  const wheelWidth = 0.2;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16).rotateX(-Math.PI / 2);
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x000000), // Black
    roughness: 0.5,
    metalness: 0.3,
  });

  // Front left wheel
  const frontLeftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  frontLeftWheel.position.set(1, 0.3, 1);
  group.add(frontLeftWheel);

  // Front right wheel
  const frontRightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  frontRightWheel.position.set(1, 0.3, -1);
  group.add(frontRightWheel);

  // Rear left wheel
  const rearLeftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  rearLeftWheel.position.set(-1, 0.3, 1);
  group.add(rearLeftWheel);

  // Rear right wheel
  const rearRightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  rearRightWheel.position.set(-1, 0.3, -1);
  group.add(rearRightWheel);

  // Milk can on rear
  const milkCanGeometry = new THREE.SphereGeometry(0.3, 16, 16);
  const milkCanMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xFFFFFF), // White
    roughness: 0.8,
    metalness: 0.2,
  });
  const milkCan = new THREE.Mesh(milkCanGeometry, milkCanMaterial);
  milkCan.position.set(0, 0.5, 1.8);
  milkCan.scale.set(0.8, 1, 0.8);
  group.add(milkCan);

  return group;
}

/** Creates a bicycle parked at a rack. Features: bicycle model, period design. Optimized for real-time rendering: max ~5k tris */
export function createBicycle(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.isEraObject = true;
  group.userData.vehicleType = 'bicycle';
  group.userData.era = '1945';

  // Bicycle frame
  const bikeColor = new THREE.Color(0x2F4F4F); // Forest green
  const frameGeometry = new THREE.BoxGeometry(1.5, 0.8, 0.3);
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: bikeColor,
    roughness: 0.5,
    metalness: 0.3,
  });
  const frame = new THREE.Mesh(frameGeometry, frameMaterial);
  frame.position.y = 0.4;
  group.add(frame);

  // Wheels
  const wheelRadius = 0.45;
  const wheelWidth = 0.1;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16).rotateX(-Math.PI / 2);
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x000000), // Black
    roughness: 0.5,
    metalness: 0.3,
  });

  // Front wheel
  const frontWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  frontWheel.position.set(0.5, 0.2, 0.4);
  group.add(frontWheel);

  // Rear wheel
  const rearWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  rearWheel.position.set(0.5, 0.2, -0.4);
  group.add(rearWheel);

  // Handlebars
  const handlebarGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.2);
  const handlebarMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x2F4F4F),
    roughness: 0.5,
    metalness: 0.3,
  });
  const handlebar = new THREE.Mesh(handlebarGeometry, handlebarMaterial);
  handlebar.position.set(0.8, 0.6, 0);
  group.add(handlebar);

  return group;
}

/** Creates all 1945-era vehicles at the specified positions. */
export function create1945Vehicles(positions: {
  vintage_sedan?: THREE.Vector3,
  streetcar?: THREE.Vector3,
  horse_wagon?: THREE.Vector3,
  fire_engine?: THREE.Vector3,
  milk_truck?: THREE.Vector3,
  bicycle?: THREE.Vector3,
}): Record<string, THREE.Group> {
  const vehicles: Record<string, THREE.Group> = {};

  if (positions.vintage_sedan) {
    vehicles.vintage_sedan = createVintageSedan(positions.vintage_sedan);
  }
  if (positions.streetcar) {
    vehicles.streetcar = createStreetcar(positions.streetcar);
  }
  if (positions.horse_wagon) {
    vehicles.horse_wagon = createHorseWagon(positions.horse_wagon);
  }
  if (positions.fire_engine) {
    vehicles.fire_engine = createFireEngine(positions.fire_engine);
  }
  if (positions.milk_truck) {
    vehicles.milk_truck = createMilkTruck(positions.milk_truck);
  }
  if (positions.bicycle) {
    vehicles.bicycle = createBicycle(positions.bicycle);
  }

  return vehicles;
}

/** Simple path-following animation for vehicles. Updates vehicle position along a predefined path. */
export function animateVehiclePath(
  vehicle: THREE.Group,
  path: THREE.Vector3[],
  speed: number = 1,
  currentProgress: number = 0
): number {
  if (path.length === 0) return currentProgress;

  const totalPathLength = path.reduce((acc, waypoint, i) => {
    if (i === 0) return 0;
    const prev = path[i - 1];
    return acc + Math.sqrt(
      Math.pow(waypoint.x - prev.x, 2) +
      Math.pow(waypoint.y - prev.y, 2) +
      Math.pow(waypoint.z - prev.z, 2)
    );
  }, 0);

  if (totalPathLength === 0) return currentProgress;

  const progressIncrement = (speed * 0.016) / totalPathLength; // Assuming ~60fps
  const newProgress = Math.min(currentProgress + progressIncrement, 1);

  if (newProgress >= 1) {
    // Complete the path and loop
    vehicle.position.copy(path[path.length - 1]);
    return 0;
  }

  // Calculate position along the path
  const targetIndex = newProgress * (path.length - 1);
  const lowerIndex = Math.floor(targetIndex);
  const upperIndex = Math.ceil(targetIndex);
  const interpolate = targetIndex - lowerIndex;

  const startPos = path[lowerIndex];
  const endPos = path[upperIndex] || startPos;

  const newX = startPos.x + (endPos.x - startPos.x) * interpolate;
  const newY = startPos.y + (endPos.y - startPos.y) * interpolate;
  const newZ = startPos.z + (endPos.z - startPos.z) * interpolate;

  vehicle.position.set(newX, newY, newZ);

  return newProgress;
}

// Path definitions for different vehicle types
export const VINTAGE_SEDAN_PATH: THREE.Vector3[] = [
  new THREE.Vector3(-40, 0, -30),
  new THREE.Vector3(-30, 0, -30),
  new THREE.Vector3(-20, 0, -30),
  new THREE.Vector3(-10, 0, -30),
  new THREE.Vector3(0, 0, -30),
  new THREE.Vector3(10, 0, -30),
];

export const STREETCAR_PATH: THREE.Vector3[] = [
  new THREE.Vector3(-35, 0, -35),
  new THREE.Vector3(-25, 0, -35),
  new THREE.Vector3(-15, 0, -35),
  new THREE.Vector3(-5, 0, -35),
  new THREE.Vector3(5, 0, -35),
];

export const HORSE_WAGON_PATH: THREE.Vector3[] = [
  new THREE.Vector3(-30, 0, -25),
  new THREE.Vector3(-20, 0, -25),
  new THREE.Vector3(-10, 0, -25),
  new THREE.Vector3(0, 0, -25),
];

export const FIRE_ENGINE_PATH: THREE.Vector3[] = [
  new THREE.Vector3(-25, 0, -20),
  new THREE.Vector3(-15, 0, -20),
  new THREE.Vector3(-5, 0, -20),
];

export const MILK_TRUCK_PATH: THREE.Vector3[] = [
  new THREE.Vector3(-35, 0, -20),
  new THREE.Vector3(-25, 0, -20),
  new THREE.Vector3(-15, 0, -20),
  new THREE.Vector3(-5, 0, -20),
];

export const BICYCLE_PATH: THREE.Vector3[] = [
  new THREE.Vector3(-40, 0, -35),
  new THREE.Vector3(-35, 0, -35),
  new THREE.Vector3(-30, 0, -35),
];