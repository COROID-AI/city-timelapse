import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { EraData } from './eras';
import * as THREE from 'three';

interface Props {
  era: EraData;
}

const LAMP_POSITIONS = [
  { x: -4, z: -15 },
  { x: -4, z: -5 },
  { x: -4, z: 5 },
  { x: -4, z: 15 },
  { x: 4, z: -15 },
  { x: 4, z: -5 },
  { x: 4, z: 5 },
  { x: 4, z: 15 },
];

export default function StreetLamps({ era }: Props) {
  return (
    <>
      {LAMP_POSITIONS.map((pos, i) => (
        <StreetLamp key={i} position={[pos.x, 0, pos.z]} era={era} index={i} />
      ))}
    </>
  );
}

function StreetLamp({ position, era, index }: {
  position: [number, number, number];
  era: EraData;
  index: number;
}) {
  const lightRef = useRef<THREE.PointLight>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!glowRef.current) return;
    // Subtle flicker for gas lamps
    if (era.streetLampStyle === 'gas') {
      const flicker = 0.9 + Math.sin(clock.getElapsedTime() * 10 + index * 3) * 0.1;
      (glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = flicker * 3;
    }
    // Pulse for holographic
    if (era.streetLampStyle === 'holographic') {
      const pulse = 1.5 + Math.sin(clock.getElapsedTime() * 2 + index) * 0.5;
      (glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
    }
  });

  const lampHeight = 5;

  // Era-specific lamp styles
  if (era.streetLampStyle === 'gas') {
    return (
      <group position={position}>
        {/* Post - ornate */}
        <mesh castShadow position={[0, lampHeight / 2, 0]}>
          <cylinderGeometry args={[0.06, 0.08, lampHeight, 8]} />
          <meshStandardMaterial color={new THREE.Color(0.15, 0.12, 0.1)} roughness={0.7} metalness={0.3} />
        </mesh>
        {/* Decorative base */}
        <mesh castShadow position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.2, 0.25, 0.3, 8]} />
          <meshStandardMaterial color={new THREE.Color(0.12, 0.1, 0.08)} roughness={0.8} metalness={0.2} />
        </mesh>
        {/* Lamp head */}
        <mesh castShadow position={[0, lampHeight + 0.1, 0]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshStandardMaterial color={new THREE.Color(0.9, 0.7, 0.3)} roughness={0.3} />
        </mesh>
        {/* Glass cover */}
        <mesh position={[0, lampHeight + 0.1, 0]}>
          <sphereGeometry args={[0.22, 8, 8]} />
          <meshStandardMaterial color={new THREE.Color(1, 0.85, 0.5)} transparent opacity={0.4} roughness={0.1} />
        </mesh>
        {/* Glow */}
        <mesh ref={glowRef} position={[0, lampHeight + 0.1, 0]}>
          <sphereGeometry args={[0.35, 8, 8]} />
          <meshStandardMaterial color={new THREE.Color(1, 0.75, 0.3)} emissive={new THREE.Color(1, 0.75, 0.3)} emissiveIntensity={3} transparent opacity={0.5} />
        </mesh>
        {/* Point light */}
        <pointLight ref={lightRef} position={[0, lampHeight + 0.1, 0]} color={new THREE.Color(1, 0.8, 0.4)} intensity={2} distance={12} decay={2} />
      </group>
    );
  }

  if (era.streetLampStyle === 'holographic') {
    return (
      <group position={position}>
        {/* Sleek post */}
        <mesh castShadow position={[0, lampHeight / 2, 0]}>
          <cylinderGeometry args={[0.04, 0.06, lampHeight, 8]} />
          <meshStandardMaterial color={new THREE.Color(0.2, 0.3, 0.4)} roughness={0.1} metalness={0.9} />
        </mesh>
        {/* Energy ring */}
        <mesh position={[0, lampHeight + 0.3, 0]}>
          <torusGeometry args={[0.3, 0.03, 8, 24]} />
          <meshStandardMaterial color={new THREE.Color(0, 0.8, 1)} emissive={new THREE.Color(0, 0.8, 1)} emissiveIntensity={2} />
        </mesh>
        {/* Light core */}
        <mesh ref={glowRef} position={[0, lampHeight + 0.3, 0]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color={new THREE.Color(0.5, 0.8, 1)} emissive={new THREE.Color(0.5, 0.8, 1)} emissiveIntensity={3} transparent opacity={0.7} />
        </mesh>
        <pointLight ref={lightRef} position={[0, lampHeight + 0.3, 0]} color={new THREE.Color(0.3, 0.7, 1)} intensity={3} distance={15} decay={2} />
      </group>
    );
  }

  // Default modern/standard lamp
  const lampColors: Record<string, [number, number, number]> = {
    incandescent: [0.9, 0.8, 0.5],
    fluorescent: [0.8, 0.85, 0.9],
    led: [0.95, 0.95, 1.0],
    smart: [0.7, 0.8, 0.9],
  };

  const lightColor = lampColors[era.streetLampStyle] || [0.9, 0.9, 0.95];
  const lampColor: [number, number, number] = era.streetLampStyle === 'fluorescent'
    ? [0.4, 0.42, 0.45]
    : era.streetLampStyle === 'smart'
    ? [0.35, 0.38, 0.42]
    : [0.25, 0.25, 0.28];

  return (
    <group position={position}>
      {/* Post */}
      <mesh castShadow position={[0, lampHeight / 2, 0]}>
        <cylinderGeometry args={[0.04, 0.05, lampHeight, 8]} />
        <meshStandardMaterial color={new THREE.Color(lampColor[0], lampColor[1], lampColor[2])} roughness={0.6} metalness={0.4} />
      </mesh>
      {/* Lamp housing */}
      <mesh castShadow position={[0, lampHeight + 0.15, 0]}>
        <boxGeometry args={[0.3, 0.15, 0.15]} />
        <meshStandardMaterial color={new THREE.Color(lampColor[0], lampColor[1], lampColor[2])} roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Light panel */}
      <mesh ref={glowRef} position={[0, lampHeight + 0.05, 0]}>
        <planeGeometry args={[0.28, 0.13]} />
        <meshStandardMaterial color={new THREE.Color(lightColor[0], lightColor[1], lightColor[2])} emissive={new THREE.Color(lightColor[0], lightColor[1], lightColor[2])} emissiveIntensity={2} />
      </mesh>
      {/* Base */}
      <mesh castShadow position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.15, 0.18, 0.2, 8]} />
        <meshStandardMaterial color={new THREE.Color(lampColor[0], lampColor[1], lampColor[2])} roughness={0.7} metalness={0.3} />
      </mesh>
      <pointLight ref={lightRef} position={[0, lampHeight + 0.05, 0]} color={new THREE.Color(lightColor[0], lightColor[1], lightColor[2])} intensity={1.5} distance={10} decay={2} />
    </group>
  );
}
