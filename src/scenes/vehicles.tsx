import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { EraData } from './eras';
import * as THREE from 'three';

interface Props {
  era: EraData;
}

const VEHICLE_POSITIONS = [
  { x: -2, z: -2, rotY: 0, lane: 'road1' },
  { x: 1, z: 3, rotY: Math.PI, lane: 'road2' },
  { x: 5, z: -2, rotY: 0, lane: 'road1' },
  { x: -6, z: 3, rotY: Math.PI, lane: 'road2' },
];

export default function Vehicles({ era }: Props) {
  const vehicles = VEHICLE_POSITIONS.slice(0, era.hasFlying ? 5 : 4);

  return (
    <>
      {vehicles.map((pos, i) => (
        <Vehicle key={i} position={[pos.x, 0.3, pos.z]} rotation={[0, pos.rotY, 0]} era={era} index={i} />
      ))}
    </>
  );
}

function Vehicle({ position, rotation, era, index }: {
  position: [number, number, number];
  rotation: [number, number, number];
  era: EraData;
  index: number;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    // Gentle idle bob
    ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 2 + index) * 0.02;
  });

  const isFlying = era.hasFlying && index === 4;

  if (era.hasMilitaryVehicles && index === 0) {
    return (
      <group ref={ref} position={position} rotation={rotation}>
        {/* Military truck body */}
        <mesh castShadow position={[0, 0.4, 0]}>
          <boxGeometry args={[2.5, 0.8, 1.2]} />
          <meshStandardMaterial color={new THREE.Color(0.35, 0.38, 0.25)} roughness={0.8} />
        </mesh>
        {/* Cab */}
        <mesh castShadow position={[0.8, 0.8, 0]}>
          <boxGeometry args={[1.0, 0.7, 1.1]} />
          <meshStandardMaterial color={new THREE.Color(0.30, 0.33, 0.22)} roughness={0.8} />
        </mesh>
        {/* Wheels */}
        {[[-0.7, -0.3, 0.65], [-0.7, -0.3, -0.65], [0.7, -0.3, 0.65], [0.7, -0.3, -0.65]].map(([x, y, z], wi) => (
          <mesh key={wi} castShadow position={[x as number, y as number, z as number]}>
            <cylinderGeometry args={[0.25, 0.25, 0.15, 12]} />
            <meshStandardMaterial color={new THREE.Color(0.15, 0.15, 0.15)} roughness={0.9} />
          </mesh>
        ))}
        {/* Headlights */}
        <mesh position={[1.26, 0.4, 0.4]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color={new THREE.Color(1, 0.9, 0.5)} emissive={new THREE.Color(1, 0.9, 0.5)} emissiveIntensity={1} />
        </mesh>
        <mesh position={[1.26, 0.4, -0.4]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color={new THREE.Color(1, 0.9, 0.5)} emissive={new THREE.Color(1, 0.9, 0.5)} emissiveIntensity={1} />
        </mesh>
      </group>
    );
  }

  if (era.hasClassicCars && index === 1) {
    return (
      <group ref={ref} position={position} rotation={rotation}>
        {/* Classic car body */}
        <mesh castShadow position={[0, 0.35, 0]}>
          <boxGeometry args={[4.0, 0.6, 1.6]} />
          <meshStandardMaterial color={new THREE.Color(0.7, 0.2, 0.2)} roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Roof/cabin */}
        <mesh castShadow position={[-0.2, 0.7, 0]}>
          <boxGeometry args={[2.0, 0.5, 1.4]} />
          <meshStandardMaterial color={new THREE.Color(0.65, 0.18, 0.18)} roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Chrome bumpers */}
        <mesh position={[2.01, 0.3, 0]}>
          <boxGeometry args={[0.05, 0.3, 1.6]} />
          <meshStandardMaterial color={new THREE.Color(0.8, 0.8, 0.85)} roughness={0.1} metalness={0.9} />
        </mesh>
        <mesh position={[-2.01, 0.3, 0]}>
          <boxGeometry args={[0.05, 0.3, 1.6]} />
          <meshStandardMaterial color={new THREE.Color(0.8, 0.8, 0.85)} roughness={0.1} metalness={0.9} />
        </mesh>
        {/* Wheels */}
        {[[-1.3, -0.15, 0.85], [-1.3, -0.15, -0.85], [1.3, -0.15, 0.85], [1.3, -0.15, -0.85]].map(([x, y, z], wi) => (
          <mesh key={wi} castShadow position={[x as number, y as number, z as number]}>
            <cylinderGeometry args={[0.28, 0.28, 0.15, 12]} />
            <meshStandardMaterial color={new THREE.Color(0.12, 0.12, 0.12)} roughness={0.9} />
          </mesh>
        ))}
        {/* Whitewall tires */}
        {[[-1.3, -0.15, 0.85], [-1.3, -0.15, -0.85], [1.3, -0.15, 0.85], [1.3, -0.15, -0.85]].map(([x, y, z], wi) => (
          <mesh key={`w-${wi}`} position={[x as number, y as number, z as number]}>
            <torusGeometry args={[0.22, 0.04, 6, 16]} />
            <meshStandardMaterial color={new THREE.Color(0.85, 0.85, 0.85)} roughness={0.6} />
          </mesh>
        ))}
      </group>
    );
  }

  if (era.hasModernSedan && index === 2) {
    return (
      <group ref={ref} position={position} rotation={rotation}>
        {/* Modern sedan body */}
        <mesh castShadow position={[0, 0.3, 0]}>
          <boxGeometry args={[4.5, 0.5, 1.8]} />
          <meshStandardMaterial color={new THREE.Color(0.2, 0.25, 0.35)} roughness={0.3} metalness={0.5} />
        </mesh>
        {/* Sloped roof */}
        <mesh castShadow position={[-0.3, 0.65, 0]}>
          <boxGeometry args={[2.2, 0.4, 1.6]} />
          <meshStandardMaterial color={new THREE.Color(0.18, 0.23, 0.33)} roughness={0.3} metalness={0.5} />
        </mesh>
        {/* Wheels */}
        {[[-1.4, -0.1, 0.95], [-1.4, -0.1, -0.95], [1.4, -0.1, 0.95], [1.4, -0.1, -0.95]].map(([x, y, z], wi) => (
          <mesh key={wi} castShadow position={[x as number, y as number, z as number]}>
            <cylinderGeometry args={[0.3, 0.3, 0.15, 16]} />
            <meshStandardMaterial color={new THREE.Color(0.1, 0.1, 0.1)} roughness={0.8} />
          </mesh>
        ))}
        {/* LED headlights */}
        <mesh position={[2.26, 0.35, 0.55]}>
          <boxGeometry args={[0.05, 0.15, 0.3]} />
          <meshStandardMaterial color={new THREE.Color(1, 1, 1)} emissive={new THREE.Color(0.9, 0.95, 1)} emissiveIntensity={1.5} />
        </mesh>
        <mesh position={[2.26, 0.35, -0.55]}>
          <boxGeometry args={[0.05, 0.15, 0.3]} />
          <meshStandardMaterial color={new THREE.Color(1, 1, 1)} emissive={new THREE.Color(0.9, 0.95, 1)} emissiveIntensity={1.5} />
        </mesh>
        {/* Tail lights */}
        <mesh position={[-2.26, 0.35, 0.6]}>
          <boxGeometry args={[0.05, 0.12, 0.25]} />
          <meshStandardMaterial color={new THREE.Color(1, 0.1, 0.1)} emissive={new THREE.Color(1, 0.1, 0.1)} emissiveIntensity={1} />
        </mesh>
        <mesh position={[-2.26, 0.35, -0.6]}>
          <boxGeometry args={[0.05, 0.12, 0.25]} />
          <meshStandardMaterial color={new THREE.Color(1, 0.1, 0.1)} emissive={new THREE.Color(1, 0.1, 0.1)} emissiveIntensity={1} />
        </mesh>
      </group>
    );
  }

  if (era.hasElectricVehicles && index === 3) {
    return (
      <group ref={ref} position={position} rotation={rotation}>
        {/* EV body - sleek */}
        <mesh castShadow position={[0, 0.25, 0]}>
          <boxGeometry args={[4.2, 0.4, 1.7]} />
          <meshStandardMaterial color={new THREE.Color(0.1, 0.5, 0.4)} roughness={0.15} metalness={0.7} />
        </mesh>
        {/* Glass roof */}
        <mesh castShadow position={[-0.2, 0.55, 0]}>
          <boxGeometry args={[2.0, 0.15, 1.5]} />
          <meshStandardMaterial color={new THREE.Color(0.3, 0.4, 0.5)} roughness={0.05} metalness={0.8} transparent opacity={0.5} />
        </mesh>
        {/* Wheels */}
        {[[-1.3, -0.05, 0.9], [-1.3, -0.05, -0.9], [1.3, -0.05, 0.9], [1.3, -0.05, -0.9]].map(([x, y, z], wi) => (
          <mesh key={wi} castShadow position={[x as number, y as number, z as number]}>
            <cylinderGeometry args={[0.25, 0.25, 0.12, 16]} />
            <meshStandardMaterial color={new THREE.Color(0.1, 0.1, 0.1)} roughness={0.7} />
          </mesh>
        ))}
        {/* Blue LED strip */}
        <mesh position={[2.11, 0.25, 0]}>
          <boxGeometry args={[0.02, 0.05, 1.6]} />
          <meshStandardMaterial color={new THREE.Color(0, 0.8, 1)} emissive={new THREE.Color(0, 0.8, 1)} emissiveIntensity={2} />
        </mesh>
      </group>
    );
  }

  if (isFlying) {
    return (
      <group ref={ref} position={[position[0], 8, position[2]]} rotation={rotation}>
        {/* Flying pod body */}
        <mesh castShadow position={[0, 0, 0]}>
          <sphereGeometry args={[1.2, 16, 12]} />
          <meshStandardMaterial color={new THREE.Color(0.8, 0.9, 1.0)} roughness={0.05} metalness={0.9} />
        </mesh>
        {/* Glow ring */}
        <mesh position={[0, 0, 0]}>
          <torusGeometry args={[1.4, 0.08, 8, 32]} />
          <meshStandardMaterial color={new THREE.Color(0, 0.8, 1)} emissive={new THREE.Color(0, 0.8, 1)} emissiveIntensity={3} />
        </mesh>
        {/* Windows */}
        <mesh position={[0, 0.3, 0.8]}>
          <planeGeometry args={[1.0, 0.5]} />
          <meshStandardMaterial color={new THREE.Color(0.4, 0.7, 1)} roughness={0.0} metalness={0.9} emissive={new THREE.Color(0.2, 0.4, 0.6)} emissiveIntensity={0.5} />
        </mesh>
      </group>
    );
  }

  // Default modern car
  return (
    <group ref={ref} position={position} rotation={rotation}>
      <mesh castShadow position={[0, 0.3, 0]}>
        <boxGeometry args={[4.0, 0.5, 1.6]} />
        <meshStandardMaterial color={new THREE.Color(0.3, 0.3, 0.35)} roughness={0.4} metalness={0.4} />
      </mesh>
      {[[-1.2, -0.1, 0.85], [-1.2, -0.1, -0.85], [1.2, -0.1, 0.85], [1.2, -0.1, -0.85]].map(([x, y, z], wi) => (
        <mesh key={wi} castShadow position={[x as number, y as number, z as number]}>
          <cylinderGeometry args={[0.25, 0.25, 0.12, 12]} />
          <meshStandardMaterial color={new THREE.Color(0.15, 0.15, 0.15)} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
