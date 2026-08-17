import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { EraInfo } from '../eras/types';

const roadWidth = 8;

interface GroundProps {
  era: EraInfo;
  size?: number;
}

export function Ground({ era, size = 120 }: GroundProps) {
  const groundRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (matRef.current && era.groundColor) {
      matRef.current.color.set(era.groundColor);
    }
  });

  return (
    <group>
      {/* Main ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial ref={matRef} color={era.groundColor} roughness={0.9} metalness={0.0} />
      </mesh>

      {/* Roads - intersecting grid */}
      <Road horizontal era={era} />
      <Road horizontal={false} era={era} />

      {/* Sidewalks along roads */}
      <Sidewalks era={era} />

      {/* Crosswalks */}
      <Crosswalks era={era} />
    </group>
  );
}

function Road({ horizontal, era }: { horizontal: boolean; era: EraInfo }) {
  const length = 120;

  return (
    <group rotation={horizontal ? [0, 0, 0] : [0, Math.PI / 2, 0]}>
      {/* Road surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow castShadow>
        <planeGeometry args={[length, roadWidth]} />
        <meshStandardMaterial color={era.roadColor} roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Center line dashes */}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[(i - 10) * 5.5, 0.02, 0]}>
          <planeGeometry args={[3, 0.15]} />
          <meshStandardMaterial color="#ffff00" roughness={0.5} />
        </mesh>
      ))}

      {/* Edge lines */}
      {[roadWidth / 2 - 0.5, -(roadWidth / 2 - 0.5)].map((z, i) => (
        <mesh key={`edge-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, z]}>
          <planeGeometry args={[length, 0.1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Sidewalks({ era }: { era: EraInfo }) {
  const swWidth = 3;
  const roadWidth = 8;
  const halfCity = 40;

  // Four sidewalks around the intersection
  const positions = [
    { x: 0, z: roadWidth / 2 + swWidth / 2 },
    { x: 0, z: -(roadWidth / 2 + swWidth / 2) },
    { x: roadWidth / 2 + swWidth / 2, z: 0, rot: Math.PI / 2 },
    { x: -(roadWidth / 2 + swWidth / 2), z: 0, rot: Math.PI / 2 },
  ];

  return (
    <group>
      {positions.map((p, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, p.rot || 0]}
          position={[p.x, 0.03, p.z]}
          receiveShadow
        >
          <planeGeometry args={[halfCity * 2, swWidth]} />
          <meshStandardMaterial color={era.sidewalkColor} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Crosswalks({ era }: { era: EraInfo }) {
  const stripeCount = 6;
  const stripeW = 0.6;
  const gap = 0.4;

  return (
    <group>
      {/* Horizontal crosswalks */}
      {[-1, 1].map(side =>
        Array.from({ length: stripeCount }).map((_, i) => (
          <mesh
            key={`hc-${side}-${i}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.02, side * (roadWidth / 2 + 0.5) + (i - (stripeCount - 1) / 2) * (stripeW + gap)]}
          >
            <planeGeometry args={[8, stripeW]} />
            <meshStandardMaterial color="#ffffff" roughness={0.6} />
          </mesh>
        ))
      )}
      {/* Vertical crosswalks */}
      {[-1, 1].map(side =>
        Array.from({ length: stripeCount }).map((_, i) => (
          <mesh
            key={`vc-${side}-${i}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[side * (roadWidth / 2 + 0.5) + (i - (stripeCount - 1) / 2) * (stripeW + gap), 0.02, 0]}
          >
            <planeGeometry args={[stripeW, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.6} />
          </mesh>
        ))
      )}
    </group>
  );
}
