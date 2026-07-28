import type { EraData } from './eras';
import * as THREE from 'three';

interface Props {
  era: EraData;
}

const TREE_POSITIONS: { x: number; z: number; scale: number }[] = [
  { x: -7, z: -12, scale: 1.0 },
  { x: -7, z: 0, scale: 0.9 },
  { x: -7, z: 12, scale: 1.0 },
  { x: 7, z: -12, scale: 1.1 },
  { x: 7, z: 0, scale: 0.8 },
  { x: 7, z: 12, scale: 1.0 },
  { x: -14, z: -14, scale: 0.7 },
  { x: 14, z: -14, scale: 0.8 },
  { x: -14, z: 4, scale: 0.9 },
  { x: 14, z: 4, scale: 0.7 },
];

export default function Trees({ era }: Props) {
  return (
    <>
      {TREE_POSITIONS.map((pos, i) => (
        <Tree key={i} position={[pos.x, 0, pos.z]} scale={pos.scale} era={era} index={i} />
      ))}
    </>
  );
}

function Tree({ position, scale, era, index }: {
  position: [number, number, number];
  scale: number;
  era: EraData;
  index: number;
}) {
  const treeStyle = era.treeStyle;

  // Bark color
  const barkColor = treeStyle === 'bio'
    ? [0.2, 0.3, 0.25]
    : [0.35, 0.25, 0.18];

  // Leaf colors per era
  const getLeafColor = (): [number, number, number] => {
    switch (treeStyle) {
      case 'bare': return [0.2, 0.18, 0.15];
      case 'classic': return [0.25, 0.4, 0.2];
      case 'modern': return [0.3, 0.5, 0.25];
      case 'bio': return [0.2, 0.6, 0.35];
      default: return [0.3, 0.45, 0.25];
    }
  };

  const leafColor = getLeafColor();

  return (
    <group position={position} scale={scale}>
      {/* Trunk */}
      <mesh castShadow position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 3, 8]} />
        <meshStandardMaterial color={new THREE.Color(barkColor[0], barkColor[1], barkColor[2])} roughness={0.9} />
      </mesh>

      {treeStyle === 'bare' ? (
        // Bare tree - winter/ww2 era
        <group>
          {/* Main branches */}
          <mesh castShadow position={[0, 3.2, 0]} rotation={[0, 0, 0.3]}>
            <cylinderGeometry args={[0.04, 0.08, 1.5, 6]} />
            <meshStandardMaterial color={new THREE.Color(barkColor[0], barkColor[1], barkColor[2])} roughness={0.9} />
          </mesh>
          <mesh castShadow position={[-0.3, 3.5, 0]} rotation={[0, 0, -0.4]}>
            <cylinderGeometry args={[0.03, 0.06, 1.2, 6]} />
            <meshStandardMaterial color={new THREE.Color(barkColor[0], barkColor[1], barkColor[2])} roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0.25, 3.0, 0.1]} rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.03, 0.05, 1.0, 6]} />
            <meshStandardMaterial color={new THREE.Color(barkColor[0], barkColor[1], barkColor[2])} roughness={0.9} />
          </mesh>
        </group>
      ) : treeStyle === 'bio' ? (
        // Bioluminescent tree - futuristic
        <group>
          {/* Canopy - glowing */}
          <mesh castShadow position={[0, 4.5, 0]}>
            <sphereGeometry args={[1.5, 12, 10]} />
            <meshStandardMaterial
              color={new THREE.Color(leafColor[0], leafColor[1], leafColor[2])}
              emissive={new THREE.Color(0, 0.6, 0.3)}
              emissiveIntensity={0.5}
              roughness={0.7}
            />
          </mesh>
          {/* Glowing dots */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const r = 0.8 + Math.sin(i * 2.5) * 0.4;
            return (
              <mesh key={i} position={[Math.cos(angle) * r, 4.2 + Math.sin(i * 1.7) * 0.5, Math.sin(angle) * r]}>
                <sphereGeometry args={[0.06, 6, 6]} />
                <meshStandardMaterial color={new THREE.Color(0.2, 1, 0.5)} emissive={new THREE.Color(0.2, 1, 0.5)} emissiveIntensity={3} />
              </mesh>
            );
          })}
        </group>
      ) : (
        // Classic/modern tree
        <group>
          {/* Canopy layers */}
          <mesh castShadow position={[0, 4.2, 0]}>
            <sphereGeometry args={[1.2, 10, 8]} />
            <meshStandardMaterial color={new THREE.Color(leafColor[0], leafColor[1], leafColor[2])} roughness={0.8} />
          </mesh>
          <mesh castShadow position={[-0.3, 3.8, 0.2]}>
            <sphereGeometry args={[0.9, 8, 8]} />
            <meshStandardMaterial color={new THREE.Color(leafColor[0] * 1.1, leafColor[1] * 1.1, leafColor[2] * 1.1)} roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0.3, 3.6, -0.2]}>
            <sphereGeometry args={[0.8, 8, 8]} />
            <meshStandardMaterial color={new THREE.Color(leafColor[0] * 0.9, leafColor[1] * 0.9, leafColor[2] * 0.9)} roughness={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
}
