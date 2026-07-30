import React from 'react';
import * as THREE from 'three';
import { EraConfig } from '../data/eraData';

interface BillboardProps {
  position: [number, number, number];
  config: EraConfig;
  seed: number;
}

const Billboard: React.FC<BillboardProps> = React.memo(({ position, config, seed }) => {
  const size = 4 + (seed % 3);

  return (
    <group position={position}>
      {/* Pole */}
      <mesh position={[0, size / 2 + 1, 0]}>
        <cylinderGeometry args={[0.1, 0.15, size + 2, 6]} />
        <meshStandardMaterial color={0x444444} roughness={0.7} />
      </mesh>
      {/* Billboard face */}
      <mesh position={[0, size / 2 + 1, 0]}>
        <boxGeometry args={[size, size * 0.6, 0.1]} />
        <meshStandardMaterial
          color={config.billboardColor}
          emissive={config.billboardColor}
          emissiveIntensity={0.5}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      {/* Ad content */}
      <mesh position={[0, size / 2 + 1, 0.06]}>
        <boxGeometry args={[size * 0.8, size * 0.4, 0.02]} />
        <meshStandardMaterial
          color={0xffffff}
          emissive={0xffffff}
          emissiveIntensity={0.2}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
});

export default Billboard;
