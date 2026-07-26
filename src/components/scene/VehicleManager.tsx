import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, memo } from 'react';
import * as THREE from 'three';
import { VehicleType, EraId, lerp } from '../../types';

type VehicleData = {
  id: number;
  position: [number, number, number];
  direction: number;
  speed: number;
  type: VehicleType;
  yOffset: number;
};

const createRng = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000;
    return state / 0x100000000;
  };
};

const generateVehicles = (count: number, era: EraId, vehicleType: VehicleType): VehicleData[] => {
  const vehicles: VehicleData[] = [];
  const rng = createRng(100);

  // Street layout - two main streets crossing
  const streetLength = 50;
  const streetWidth = 8;

  for (let i = 0; i < count; i++) {
    const isVertical = rng() > 0.5;
    const speed = 0.5 + rng() * 2;

    let position: [number, number, number];
    let direction: number;

    if (isVertical) {
      // Vehicles on north-south street
      position = [
        (rng() - 0.5) * streetWidth,
        0,
        -streetLength / 2 + rng() * streetLength,
      ];
      direction = rng() > 0.5 ? 0 : Math.PI;
    } else {
      // Vehicles on east-west street
      position = [
        -streetLength / 2 + rng() * streetLength,
        0,
        (rng() - 0.5) * streetWidth,
      ];
      direction = rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }

    vehicles.push({
      id: i,
      position,
      direction,
      speed,
      type: vehicleType,
      yOffset: 0,
    });
  }

  return vehicles;
};

// Vehicle geometry based on type
const getVehicleGeometry = (type: VehicleType): THREE.BufferGeometry => {
  switch (type) {
    case 'classic':
      // 1940s car - boxy with rounded edges
      return new THREE.BoxGeometry(3.5, 1.2, 1.5);
    case 'muscle':
      // 1960s muscle car - long hood
      return new THREE.BoxGeometry(4.5, 1.3, 1.6);
    case 'compact':
      // 1980s compact - smaller
      return new THREE.BoxGeometry(3.2, 1.2, 1.4);
    case 'modern':
      // 2000s modern - aerodynamic
      return new THREE.BoxGeometry(4, 1.3, 1.6);
    case 'electric':
      // 2020s electric - smooth
      return new THREE.BoxGeometry(4.2, 1.4, 1.7);
    case 'flying':
      // 2050s flying car - with wings
      const group = new THREE.Group();
      const body = new THREE.BoxGeometry(3, 0.8, 1.5);
      return body;
    default:
      return new THREE.BoxGeometry(3.5, 1.2, 1.5);
  }
};

const getVehicleColor = (type: VehicleType): string => {
  const colors: Record<VehicleType, string[]> = {
    classic: ['#8B4513', '#2F4F4F', '#800000', '#1C1C1C'],
    muscle: ['#FF0000', '#0000FF', '#FFFF00', '#FFFFFF'],
    compact: ['#FF6B35', '#4ECDC4', '#FFE66D', '#1A535C'],
    modern: ['#E74C3C', '#3498DB', '#2ECC71', '#9B59B6'],
    electric: ['#00E676', '#FF1744', '#2979FF', '#FFFFFF'],
    flying: ['#7C4DFF', '#00E5FF', '#FF4081', '#FFFFFF'],
  };
  return colors[type][Math.floor(Math.random() * colors[type].length)];
};

const Vehicle = memo(({
  data,
  vehicleType,
  hasFlyingCars,
  transitionProgress,
}: {
  data: VehicleData;
  vehicleType: VehicleType;
  hasFlyingCars: boolean;
  transitionProgress: number;
}) => {
  const meshRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => getVehicleGeometry(vehicleType), [vehicleType]);
  const color = useMemo(() => getVehicleColor(vehicleType), [vehicleType]);

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.3,
      metalness: 0.7,
    });
    return mat;
  }, [color]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Move vehicle forward
    const moveX = Math.sin(data.direction) * data.speed * delta * 60;
    const moveZ = Math.cos(data.direction) * data.speed * delta * 60;

    meshRef.current.position.x += moveX;
    meshRef.current.position.z += moveZ;

    // Flying cars bob up and down
    if (hasFlyingCars) {
      const bob = Math.sin(state.clock.elapsedTime * 2 + data.id) * 0.5;
      meshRef.current.position.y = lerp(0, 3 + data.id * 0.5, transitionProgress) + bob;
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5 + data.id) * 0.1;
    } else {
      meshRef.current.position.y = 0.5;
    }

    // Reset position when vehicle goes off street
    const maxDist = 60;
    if (Math.abs(meshRef.current.position.x) > maxDist || Math.abs(meshRef.current.position.z) > maxDist) {
      meshRef.current.position.set(data.position[0], data.position[1], data.position[2]);
    }
  });

  // Headlights for darker eras
  const headlightPositions: [number, number, number][] = [
    [1.5, 0.3, 0.6],
    [1.5, 0.3, -0.6],
  ];

  return (
    <group ref={meshRef} position={data.position} rotation={[0, data.direction, 0]}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />

      {/* Wheels for ground vehicles */}
      {!hasFlyingCars && (
        <>
          <mesh position={[-1.3, -0.5, 0.7]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.3, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[1.3, -0.5, 0.7]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.3, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[-1.3, -0.5, -0.7]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.3, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[1.3, -0.5, -0.7]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.3, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </>
      )}

      {/* Headlights */}
      {headlightPositions.map((pos, i) => (
        <pointLight
          key={i}
          position={pos}
          color={vehicleType === 'electric' || vehicleType === 'flying' ? '#00E5FF' : '#FFFFAA'}
          intensity={0.5}
          distance={5}
          castShadow
        />
      ))}

      {/* Tail lights */}
      <pointLight
        position={[-1.5, 0.3, 0.6]}
        color="#FF4444"
        intensity={0.3}
        distance={4}
      />
      <pointLight
        position={[-1.5, 0.3, -0.6]}
        color="#FF4444"
        intensity={0.3}
        distance={4}
      />
    </group>
  );
});

export const VehicleManager = ({
  vehicleType,
  vehicleCount,
  hasFlyingCars,
  era,
  transitionProgress,
}: {
  vehicleType: VehicleType;
  vehicleCount: number;
  hasFlyingCars: boolean;
  era: EraId;
  transitionProgress: number;
}) => {
  const vehicles = useMemo(
    () => generateVehicles(vehicleCount, era, vehicleType),
    [vehicleCount, era, vehicleType]
  );

  return (
    <group>
      {vehicles.map((vehicle) => (
        <Vehicle
          key={vehicle.id}
          data={vehicle}
          vehicleType={vehicleType}
          hasFlyingCars={hasFlyingCars}
          transitionProgress={transitionProgress}
        />
      ))}
    </group>
  );
};
