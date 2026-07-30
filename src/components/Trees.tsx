import React from 'react';
import * as THREE from 'three';
import { EraConfig } from '../data/eraData';

interface TreesProps {
  config: EraConfig;
}

const Trees: React.FC<TreesProps> = React.memo(({ config }) => {
  const trees = React.useMemo(() => {
    const treeGroup: React.ReactElement[] = [];
    for (let i = 0; i < config.treeCount; i++) {
      const angle = (i / config.treeCount) * Math.PI * 2;
      const radius = 35 + Math.sin(i * 3) * 15;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.7 + Math.random() * 0.6;
      treeGroup.push(
        <group key={`tree-${i}`} position={[x, 0, z]}>
          <group scale={[scale, scale, scale]}>
            {/* Trunk */}
            <mesh position={[0, 0.8, 0]} castShadow>
              <cylinderGeometry args={[0.15, 0.25, 1.8, 6]} />
              <meshStandardMaterial color={0x5a3a1a} roughness={0.9} />
            </mesh>
            {/* Foliage */}
            <mesh position={[0, 2.8, 0]} castShadow>
              <sphereGeometry args={[1.2, 8, 6]} />
              <meshStandardMaterial color={config.treeColor} roughness={0.8} />
            </mesh>
            {/* Second foliage layer for fuller look */}
            <mesh position={[0.3, 3.2, 0.3]} castShadow scale={[0.7, 0.6, 0.7]}>
              <sphereGeometry args={[0.8, 6, 4]} />
              <meshStandardMaterial color={config.treeColor} roughness={0.8} />
            </mesh>
          </group>
        </group>
      );
    }
    return treeGroup;
  }, [config]);

  return <group>{trees}</group>;
});

export default Trees;
