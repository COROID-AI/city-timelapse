import React from 'react';
import * as THREE from 'three';
import { EraConfig } from '../data/eraData';

interface PedestrianProps {
  position: [number, number, number];
  colorIndex: number;
  config: EraConfig;
}

const Pedestrian: React.FC<PedestrianProps> = React.memo(({ position, colorIndex, config }) => {
  const color = React.useMemo(() => {
    const colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xffaa44, 0x44ffaa];
    return colors[colorIndex % colors.length];
  }, [colorIndex]);

  const heightFactor = config.year >= 2025 ? 1.2 : config.year >= 1985 ? 1.1 : 1.0;

  return (
    <group position={position}>
      {/* Body */}
      <mesh position={[0, 0.8 * heightFactor, 0]} castShadow>
        <sphereGeometry args={[0.25, 8, 6]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.4 * heightFactor, 0]} castShadow>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshStandardMaterial color={0xddccaa} roughness={0.7} />
      </mesh>
      {/* Umbrella for post-2005 */}
      {config.year >= 2005 && (
        <mesh position={[0, 2.0 * heightFactor, 0]} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.4, 0.6, 12]} />
          <meshStandardMaterial color={0xcccccc} roughness={0.3} metalness={0.2} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
});

export default Pedestrian;
