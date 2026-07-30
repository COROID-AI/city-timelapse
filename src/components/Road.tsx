import React, { useMemo } from 'react';
import * as THREE from 'three';

interface RoadProps {
  start: [number, number, number];
  end: [number, number, number];
  width: number;
  color: number;
  era: number;
}

const Road: React.FC<RoadProps> = React.memo(({ start, end, width, color, era }) => {
  const { position, rotation, length } = useMemo(() => {
    const center: [number, number, number] = [
      (start[0] + end[0]) / 2,
      0.01,
      (start[2] + end[2]) / 2,
    ];
    const dx = end[0] - start[0];
    const dz = end[2] - start[2];
    const len = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
    const angle = Math.atan2(dx, dz);
    return { position: center, rotation: [0, -angle, 0] as [number, number, number], length: len };
  }, [start, end]);

  return (
    <group>
      <mesh position={position} rotation={rotation} scale={[width, 1, length]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Dashed center line for modern eras */}
      {era >= 1985 && (
        <mesh position={[position[0], 0.02, position[2]]} rotation={rotation} scale={[1, 1, length * 0.8]} receiveShadow>
          <planeGeometry args={[0.12, 1]} />
          <meshStandardMaterial color={0xffffff} roughness={0.9} emissive={0xffffff} emissiveIntensity={0.15} transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
});

export default Road;
