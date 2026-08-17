import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { EraInfo } from '../eras/types';

interface LightingProps {
  era: EraInfo;
}

export function Lighting({ era }: LightingProps) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);

  useFrame(() => {
    if (sunRef.current) {
      sunRef.current.intensity = era.sunIntensity;
      sunRef.current.color.set(era.sunColor);
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = era.ambientIntensity;
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = era.ambientIntensity * 0.5;
    }
  });

  return (
    <group>
      {/* Main directional sun */}
      <directionalLight
        ref={sunRef}
        position={[20, 30, 10]}
        intensity={era.sunIntensity}
        color={era.sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />

      {/* Ambient fill */}
      <ambientLight ref={ambientRef} intensity={era.ambientIntensity} color="#ffffff" />

      {/* Hemisphere for sky/ground bounce */}
      <hemisphereLight
        ref={hemiRef}
        color={era.skyTop}
        groundColor={era.groundColor}
        intensity={era.ambientIntensity * 0.5}
      />

      {/* Street lights */}
      <StreetLights era={era} />
    </group>
  );
}

function StreetLights({ era }: { era: EraInfo }) {
  const positions: [number, number, number][] = [];
  const spacing = 15;
  const roadEdge = 5.5;

  for (let z = -50; z <= 50; z += spacing) {
    positions.push([roadEdge + 1.5, 0, z]);
    positions.push([-roadEdge - 1.5, 0, z]);
  }
  for (let x = -50; x <= 50; x += spacing) {
    positions.push([x, 0, roadEdge + 1.5]);
    positions.push([x, 0, -roadEdge - 1.5]);
  }

  return (
    <group>
      {positions.map((pos, i) => (
        <StreetLight key={i} position={pos} color={era.streetLightColor} />
      ))}
    </group>
  );
}

function StreetLight({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      {/* Pole */}
      <mesh position={[0, 2.5, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 5, 8]} />
        <meshStandardMaterial color="#444444" roughness={0.6} metalness={0.5} />
      </mesh>
      {/* Lamp head */}
      <mesh position={[0, 5, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial
          color="#000000"
          emissive={color}
          emissiveIntensity={2}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Point light */}
      <pointLight position={[0, 4.8, 0]} color={color} intensity={0.5} distance={12} decay={2} />
    </group>
  );
}
