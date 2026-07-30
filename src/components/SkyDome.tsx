import React from 'react';
import * as THREE from 'three';

interface SkyDomeProps {
  color: number;
}

const SkyDome: React.FC<SkyDomeProps> = React.memo(({ color }) => {
  return (
    <mesh position={[0, -5, 0]} scale={[200, 200, 200]}>
      <sphereGeometry args={[100, 64, 32]} />
      <meshBasicMaterial color={color} side={THREE.BackSide} fog={false} />
    </mesh>
  );
});

export default SkyDome;
