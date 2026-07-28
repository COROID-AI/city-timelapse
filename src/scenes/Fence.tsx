import type { EraData } from './eras';
import * as THREE from 'three';

interface Props {
  era: EraData;
}

const FENCE_POSITIONS: { x: number; z: number; rotY: number; length: number }[] = [
  { x: -14.5, z: -8, rotY: 0, length: 12 },
  { x: -14.5, z: 0, rotY: 0, length: 12 },
  { x: 14.5, z: -8, rotY: 0, length: 12 },
  { x: 14.5, z: 0, rotY: 0, length: 12 },
];

export default function Fences({ era }: Props) {
  return (
    <>
      {FENCE_POSITIONS.map((pos, i) => (
        <Fence key={i} position={[pos.x, 0, pos.z]} rotation={[0, pos.rotY, 0]} length={pos.length} era={era} index={i} />
      ))}
    </>
  );
}

function Fence({ position, rotation, length, era, index }: {
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
  era: EraData;
  index: number;
}) {
  const fenceColor = era.fenceStyle === 'wooden'
    ? [0.35, 0.28, 0.2]
    : era.fenceStyle === 'iron'
    ? [0.15, 0.15, 0.18]
    : era.fenceStyle === 'steel'
    ? [0.3, 0.32, 0.35]
    : era.fenceStyle === 'energy'
    ? [0.1, 0.2, 0.3]
    : [0.2, 0.2, 0.25];

  const postCount = Math.floor(length / 1.5);

  return (
    <group position={position} rotation={rotation}>
      {/* Posts */}
      {Array.from({ length: postCount }).map((_, i) => {
        const x = -length / 2 + i * (length / (postCount - 1 || 1));
        return (
          <mesh key={i} castShadow position={[x, 0.75, 0]}>
            <boxGeometry args={[0.08, 1.5, 0.08]} />
            <meshStandardMaterial color={new THREE.Color(fenceColor[0], fenceColor[1], fenceColor[2])} roughness={0.8} />
          </mesh>
        );
      })}
      {/* Rails */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[length, 0.06, 0.06]} />
        <meshStandardMaterial color={new THREE.Color(fenceColor[0], fenceColor[1], fenceColor[2])} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[length, 0.06, 0.06]} />
        <meshStandardMaterial color={new THREE.Color(fenceColor[0], fenceColor[1], fenceColor[2])} roughness={0.8} />
      </mesh>
      {/* Energy fence glow */}
      {era.fenceStyle === 'energy' && (
        <mesh position={[0, 0.75, 0]}>
          <boxGeometry args={[length, 0.02, 0.1]} />
          <meshStandardMaterial color={new THREE.Color(0, 0.8, 1)} emissive={new THREE.Color(0, 0.8, 1)} emissiveIntensity={2} transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
