import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { EraData } from './eras';
import * as THREE from 'three';

interface Props {
  era: EraData;
}

const PEDESTRIAN_POSITIONS = [
  { x: -9, z: -5, path: 'sidewalk1' },
  { x: -3, z: -5, path: 'sidewalk1' },
  { x: 5, z: -5, path: 'sidewalk2' },
  { x: 9, z: -5, path: 'sidewalk2' },
  { x: -9, z: 5, path: 'sidewalk3' },
  { x: 9, z: 5, path: 'sidewalk4' },
];

export default function Pedestrians({ era }: Props) {
  return (
    <>
      {PEDESTRIAN_POSITIONS.map((pos, i) => (
        <Pedestrian key={i} position={[pos.x, 0, pos.z]} era={era} index={i} />
      ))}
    </>
  );
}

function Pedestrian({ position, era, index }: {
  position: [number, number, number];
  era: EraData;
  index: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const { walkSpeed, walkOffset } = useMemo(() => ({
    walkSpeed: 0.5 + Math.random() * 0.5,
    walkOffset: Math.random() * Math.PI * 2,
  }), [index]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * walkSpeed + walkOffset;
    // Walk back and forth along sidewalk
    ref.current.position.x = position[0] + Math.sin(t) * 1.5;
    // Leg animation
    const legSwing = Math.sin(t * 4) * 0.3;
    if (ref.current.children[2]) {
      (ref.current.children[2] as THREE.Mesh).rotation.x = legSwing;
    }
    if (ref.current.children[3]) {
      (ref.current.children[3] as THREE.Mesh).rotation.x = -legSwing;
    }
  });

  // Era-specific clothing colors
  const getOutfitColors = () => {
    switch (era.pedestrianStyle) {
      case 'ww2':
        return {
          jacket: [0.35, 0.30, 0.25],
          pants: [0.25, 0.22, 0.20],
          skin: [0.7, 0.6, 0.5],
        };
      case '60s':
        return {
          jacket: [0.6, 0.4, 0.3],
          pants: [0.2, 0.2, 0.3],
          skin: [0.75, 0.65, 0.55],
        };
      case '80s':
        return {
          jacket: [0.8, 0.2, 0.4],
          pants: [0.15, 0.15, 0.2],
          skin: [0.7, 0.55, 0.45],
        };
      case '2000s':
        return {
          jacket: [0.2, 0.25, 0.35],
          pants: [0.15, 0.15, 0.2],
          skin: [0.72, 0.62, 0.52],
        };
      case 'modern':
        return {
          jacket: [0.25, 0.3, 0.4],
          pants: [0.2, 0.2, 0.25],
          skin: [0.7, 0.6, 0.5],
        };
      case 'futuristic':
        return {
          jacket: [0.15, 0.3, 0.4],
          pants: [0.1, 0.15, 0.2],
          skin: [0.6, 0.7, 0.75],
        };
      default:
        return { jacket: [0.3, 0.3, 0.4], pants: [0.2, 0.2, 0.25], skin: [0.7, 0.6, 0.5] };
    }
  };

  const colors = getOutfitColors();

  return (
    <group ref={ref} position={position}>
      {/* Head */}
      <mesh castShadow position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color={new THREE.Color(colors.skin[0], colors.skin[1], colors.skin[2])} roughness={0.7} />
      </mesh>

      {/* Body/jacket */}
      <mesh castShadow position={[0, 1.05, 0]}>
        <boxGeometry args={[0.4, 0.6, 0.25]} />
        <meshStandardMaterial color={new THREE.Color(colors.jacket[0], colors.jacket[1], colors.jacket[2])} roughness={0.8} />
      </mesh>

      {/* Left leg */}
      <mesh castShadow position={[-0.1, 0.55, 0]}>
        <boxGeometry args={[0.15, 0.5, 0.15]} />
        <meshStandardMaterial color={new THREE.Color(colors.pants[0], colors.pants[1], colors.pants[2])} roughness={0.8} />
      </mesh>

      {/* Right leg */}
      <mesh castShadow position={[0.1, 0.55, 0]}>
        <boxGeometry args={[0.15, 0.5, 0.15]} />
        <meshStandardMaterial color={new THREE.Color(colors.pants[0], colors.pants[1], colors.pants[2])} roughness={0.8} />
      </mesh>

      {/* Arms */}
      <mesh castShadow position={[-0.28, 1.05, 0]}>
        <boxGeometry args={[0.1, 0.5, 0.1]} />
        <meshStandardMaterial color={new THREE.Color(colors.jacket[0], colors.jacket[1], colors.jacket[2])} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0.28, 1.05, 0]}>
        <boxGeometry args={[0.1, 0.5, 0.1]} />
        <meshStandardMaterial color={new THREE.Color(colors.jacket[0], colors.jacket[1], colors.jacket[2])} roughness={0.8} />
      </mesh>

      {/* Futuristic visor */}
      {era.pedestrianStyle === 'futuristic' && (
        <mesh position={[0, 1.58, 0.12]}>
          <boxGeometry args={[0.25, 0.05, 0.05]} />
          <meshStandardMaterial color={new THREE.Color(0, 0.8, 1)} emissive={new THREE.Color(0, 0.8, 1)} emissiveIntensity={2} />
        </mesh>
      )}
    </group>
  );
}
