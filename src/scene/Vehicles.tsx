import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import type { EraInfo } from '../eras/types';
import { Rng } from '../lib/rng';

interface VehiclesProps {
  era: EraInfo;
}

export function Vehicles({ era }: VehiclesProps) {
  const vehicles = useMemo(() => generateVehicles(era), [era]);

  return (
    <group>
      {vehicles.map(v => (
        <Vehicle key={v.id} {...v} />
      ))}
    </group>
  );
}

interface VehicleDef {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  direction: number;
}

function generateVehicles(era: EraInfo) {
  const rng = new Rng(Rng.fromString(era.year.toString()));
  const vehicles = [];
  let id = 0;

  // Cars on roads
  for (let i = 0; i < 12; i++) {
    const horizontal = rng.bool();
    const lane = rng.range(-3, 3);
    const pos = horizontal
      ? [rng.range(-50, 50), 0.4, lane]
      : [lane, 0.4, rng.range(-50, 50)];
    const rot = horizontal ? 0 : Math.PI / 2;
    vehicles.push({
      id: `v${id++}`,
      position: pos as [number, number, number],
      rotation: [0, rot, 0] as [number, number, number],
      scale: [rng.range(2, 4), 1, rng.range(1, 2)] as [number, number, number],
      color: new Rng(Rng.fromString(`vc${id}`)).pick(['#cc3333', '#3333cc', '#cccc33', '#33cc33', '#ffffff', '#333333']),
      direction: horizontal ? (rng.bool() ? 1 : -1) : (rng.bool() ? 1 : -1),
    });
  }

  return vehicles;
}

function Vehicle({ position, rotation, scale, color, direction }: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  direction: number;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const speed = 0.02 * direction;
    const t = clock.getElapsedTime() * speed;
    // Simple loop movement
    const maxRange = 60;
    const currentDir = rotation[1];
    if (Math.abs(currentDir) < 0.1 || Math.abs(Math.PI - currentDir) < 0.1) {
      ref.current.position.x = ((t * 20 + position[0]) % (maxRange * 2)) - maxRange;
    } else {
      ref.current.position.z = ((t * 20 + position[2]) % (maxRange * 2)) - maxRange;
    }
  });

  return (
    <group ref={ref} position={position} rotation={rotation}>
      {/* Car body */}
      <mesh castShadow position={[0, 0.3, 0]}>
        <boxGeometry args={scale} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Roof/cabin */}
      <mesh position={[0, 0.8, -0.2]} castShadow>
        <boxGeometry args={[scale[0] * 0.6, 0.6, scale[2] * 0.5]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Windshield */}
      <mesh position={[0, 0.8, scale[2] / 2 * direction - 0.1]}>
        <planeGeometry args={[scale[0] * 0.55, 0.5]} />
        <meshStandardMaterial color="#88bbdd" transparent opacity={0.6} roughness={0.1} />
      </mesh>
      {/* Headlights */}
      {[0.3, -0.3].map((zOff, i) => (
        <mesh key={`hl-${i}`} position={[direction * scale[0] / 2, 0.2, zOff]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#ffffaa" emissive="#ffffaa" emissiveIntensity={2} />
        </mesh>
      ))}
      {/* Tail lights */}
      {[0.3, -0.3].map((zOff, i) => (
        <mesh key={`tl-${i}`} position={[-direction * scale[0] / 2, 0.2, zOff]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={1.5} />
        </mesh>
      ))}
    </group>
  );
}
