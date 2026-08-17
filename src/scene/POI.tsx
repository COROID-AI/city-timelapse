import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { EraInfo } from '../eras/types';
import { useStore } from '../state/store';

interface POIProps {
  era: EraInfo;
  position: [number, number, number];
  name: string;
  description: string;
}

export function POI({ era, position, name, description }: POIProps) {
  const ref = useRef<THREE.Group>(null);
  const { hoveredPOI, selectedPOI, setHoveredPOI, setSelectedPOI } = useStore();
  const isHovered = hoveredPOI === name;
  const isSelected = selectedPOI === name;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    // Gentle bob animation
    ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 2) * 0.1;
  });

  return (
    <group
      ref={ref}
      position={position}
      userData={{ id: name, type: 'poi' }}
      onPointerOver={() => setHoveredPOI(name)}
      onPointerOut={() => setHoveredPOI(null)}
      onClick={() => setSelectedPOI(isSelected ? null : name)}
    >
      {/* Marker */}
      <mesh castShadow>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial
          color={isSelected ? '#00ffff' : isHovered ? '#ffff00' : '#ffaa00'}
          emissive={isSelected ? '#00ffff' : isHovered ? '#ffff00' : '#ffaa00'}
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Info label (billboard-style text would go here in production) */}
      <mesh position={[0, 0.8, 0]}>
        <planeGeometry args={[2, 0.5]} />
        <meshStandardMaterial
          color="#000000"
          emissive="#ffffff"
          emissiveIntensity={0.1}
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  );
}
