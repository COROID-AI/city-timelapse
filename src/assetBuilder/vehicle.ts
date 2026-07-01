import * as THREE from 'three';
import { EraVehicleStyle, VehicleVariant } from '../eras/types';

export interface BuiltVehicle {
  group: THREE.Group;
  /** wheels named wheel_FL, wheel_FR, wheel_RL, wheel_RR under a `wheels` group */
  dispose: () => void;
}

/** Build a vehicle group for an era style. Wheels placed for rolling animation. */
export function makeVehicle(style: EraVehicleStyle, variant: VehicleVariant = 'car'): BuiltVehicle {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];

  const isTruck = variant === 'truck';
  const length = isTruck ? 5.2 : 4.2;
  const width = isTruck ? 2.2 : 1.9;
  const bodyH = style.shape === 'ev' ? 1.5 : style.shape === 'vintage' ? 1.8 : 1.2;
  const rideH = style.shape === 'vintage' ? 0.7 : style.shape === 'ev' ? 0.35 : 0.5;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: style.body,
    metalness: style.shape === 'chrome' || style.shape === 'ev' ? 0.85 : 0.4,
    roughness: style.shape === 'chrome' || style.shape === 'ev' ? 0.2 : 0.5,
  });
  disposables.push(bodyMat);

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(width, bodyH, length), bodyMat);
  chassis.position.y = rideH + bodyH / 2;
  chassis.castShadow = true;
  chassis.name = 'chassis';
  group.add(chassis);

  // cabin / roof
  const roofMat = new THREE.MeshStandardMaterial({
    color: style.roof,
    metalness: 0.3,
    roughness: 0.5,
  });
  disposables.push(roofMat);
  const cabinLen = isTruck ? length * 0.35 : length * 0.55;
  const cabinW = width * 0.92;
  const cabinH = style.shape === 'vintage' ? 0.7 : style.shape === 'boxy' ? 0.9 : 0.7;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinW, cabinH, cabinLen), roofMat);
  const cabinZ = isTruck ? -length * 0.25 : 0;
  cabin.position.set(0, rideH + bodyH + cabinH / 2, cabinZ);
  cabin.castShadow = true;
  cabin.name = 'cabin';
  group.add(cabin);

  // trim strip
  const trimMat = new THREE.MeshStandardMaterial({ color: style.trim, metalness: 0.7, roughness: 0.3 });
  disposables.push(trimMat);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.12, length + 0.04), trimMat);
  trim.position.y = rideH + 0.15;
  group.add(trim);

  // headlights (ev gets a light bar)
  const lightMat = new THREE.MeshStandardMaterial({
    color: style.shape === 'ev' ? style.trim : '#fff8d0',
    emissive: style.shape === 'ev' ? style.trim : '#fff8d0',
    emissiveIntensity: 0.8,
    toneMapped: false,
  });
  disposables.push(lightMat);
  if (style.shape === 'ev') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, 0.08), lightMat);
    bar.position.set(0, rideH + bodyH * 0.6, length / 2);
    group.add(bar);
  } else {
    const hlGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1);
    [-1, 1].forEach((sx) => {
      const hl = new THREE.Mesh(hlGeo, lightMat);
      hl.position.set((sx * width) / 2.6, rideH + bodyH * 0.5, length / 2);
      group.add(hl);
    });
  }

  // wheels
  const wheels = new THREE.Group();
  wheels.name = 'wheels';
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
  disposables.push(wheelMat);
  const wheelPositions: Array<[string, number, number, number]> = [
    ['wheel_FL', -width / 2 - 0.05, rideH - 0.1, length / 2 - 0.7],
    ['wheel_FR', width / 2 + 0.05, rideH - 0.1, length / 2 - 0.7],
    ['wheel_RL', -width / 2 - 0.05, rideH - 0.1, -length / 2 + 0.7],
    ['wheel_RR', width / 2 + 0.05, rideH - 0.1, -length / 2 + 0.7],
  ];
  wheelPositions.forEach(([name, x, y, z]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.name = name;
    w.position.set(x, y, z);
    wheels.add(w);
  });
  group.add(wheels);

  return {
    group,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      chassis.geometry.dispose();
      cabin.geometry.dispose();
      trim.geometry.dispose();
      wheelGeo.dispose();
    },
  };
}
