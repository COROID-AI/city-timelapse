import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ERA_DATA } from './eras';
import { useStore } from '../state';
import * as THREE from 'three';

interface Props {
  era: any;
}

const BUILDING_POSITIONS = [
  { x: -12, z: -10, w: 5, d: 5 },   // far left
  { x: -5, z: -10, w: 4, d: 6 },    // left-center
  { x: 3, z: -10, w: 6, d: 5 },     // center-right
  { x: 11, z: -10, w: 5, d: 5 },    // far right
  { x: -12, z: 2, w: 4, d: 4 },     // near left
  { x: 11, z: 2, w: 5, d: 4 },      // near right
  { x: -8, z: -16, w: 6, d: 5 },    // back left
  { x: 6, z: -16, w: 5, d: 6 },     // back right
  { x: -15, z: -5, w: 4, d: 5 },    // far left edge
  { x: 15, z: -5, w: 4, d: 5 },     // far right edge
];

export default function Buildings({ era }: Props) {
  return (
    <>
      {BUILDING_POSITIONS.map((pos, i) => (
        <Building key={i} position={[pos.x, 0, pos.z]} width={pos.w} depth={pos.d} era={era} index={i} />
      ))}
    </>
  );
}

function Building({ position, width, depth, era, index }: {
  position: [number, number, number];
  width: number;
  depth: number;
  era: any;
  index: number;
}) {
  const height = useMemo(() => {
    const base = 4 + Math.abs(Math.sin(index * 2.5)) * 6;
    switch (era.buildingStyle) {
      case 'ww2': return base * 0.7;
      case 'midcentury': return base * 0.8;
      case 'neon': return base * 1.0;
      case 'digital': return base * 1.2;
      case 'modern': return base * 1.3;
      case 'futuristic': return base * 1.5 + Math.sin(index) * 2;
      default: return base;
    }
  }, [era.buildingStyle, index]);

  const ref = useRef<THREE.Group>(null);

  useFrame((_state, delta) => {
    if (!ref.current) return;
    // subtle sway for futuristic buildings
    if (era.buildingStyle === 'futuristic') {
      ref.current.rotation.z = Math.sin(performance.now() * 0.0003 + index) * 0.003;
    }
  });

  // Era-specific colors and materials
  const getFacadeColor = () => {
    const colors: Record<string, [number, number, number]> = {
      ww2: [0.55, 0.45, 0.35],
      midcentury: [0.75, 0.70, 0.60],
      neon: [0.30, 0.25, 0.35],
      digital: [0.50, 0.55, 0.60],
      modern: [0.65, 0.70, 0.75],
      futuristic: [0.20, 0.30, 0.45],
    };
    return colors[era.buildingStyle] || [0.5, 0.5, 0.5];
  };

  const getRoofColor = () => {
    const colors: Record<string, [number, number, number]> = {
      ww2: [0.40, 0.35, 0.30],
      midcentury: [0.60, 0.55, 0.50],
      neon: [0.20, 0.15, 0.25],
      digital: [0.40, 0.45, 0.50],
      modern: [0.55, 0.60, 0.65],
      futuristic: [0.15, 0.25, 0.40],
    };
    return colors[era.buildingStyle] || [0.4, 0.4, 0.4];
  };

  const facadeColor = getFacadeColor();
  const roofColor = getRoofColor();

  const isNeon = era.buildingStyle === 'neon' || era.buildingStyle === 'futuristic';

  return (
    <group ref={ref} position={position}>
      {/* Main building body */}
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={new THREE.Color(facadeColor[0], facadeColor[1], facadeColor[2])}
          roughness={era.buildingStyle === 'futuristic' ? 0.2 : 0.7}
          metalness={era.buildingStyle === 'futuristic' ? 0.6 : 0.1}
        />
      </mesh>

      {/* Roof */}
      {era.buildingStyle === 'ww2' ? (
        <mesh castShadow position={[0, height + 0.3, 0]}>
          <boxGeometry args={[width + 0.3, 0.6, depth + 0.3]} />
          <meshStandardMaterial color={new THREE.Color(roofColor[0], roofColor[1], roofColor[2])} roughness={0.9} />
        </mesh>
      ) : era.buildingStyle === 'midcentury' ? (
        <mesh castShadow position={[0, height + 0.15, 0]}>
          <boxGeometry args={[width + 0.5, 0.3, depth + 0.5]} />
          <meshStandardMaterial color={new THREE.Color(roofColor[0], roofColor[1], roofColor[2])} roughness={0.8} />
        </mesh>
      ) : era.buildingStyle === 'futuristic' ? (
        <mesh castShadow position={[0, height + 0.5, 0]}>
          <cylinderGeometry args={[width * 0.2, width * 0.4, 1, 6]} />
          <meshStandardMaterial color={new THREE.Color(0x00ffcc)} emissive={new THREE.Color(0x00ffcc)} emissiveIntensity={0.5} roughness={0.1} metalness={0.8} />
        </mesh>
      ) : (
        <mesh castShadow position={[0, height + 0.15, 0]}>
          <boxGeometry args={[width + 0.3, 0.3, depth + 0.3]} />
          <meshStandardMaterial color={new THREE.Color(roofColor[0], roofColor[1], roofColor[2])} roughness={0.6} metalness={0.3} />
        </mesh>
      )}

      {/* Windows */}
      <Windows count={Math.floor(height / 1.5)} width={width} depth={depth} era={era} />

      {/* Neon accents for neon era */}
      {(era.buildingStyle === 'neon' || era.buildingStyle === 'futuristic') && (
        <>
          <mesh position={[width / 2 + 0.05, height * 0.6, 0]}>
            <boxGeometry args={[0.05, height * 0.8, 0.1]} />
            <meshStandardMaterial
              color={era.buildingStyle === 'neon' ? new THREE.Color(0xff0066) : new THREE.Color(0x00ffcc)}
              emissive={era.buildingStyle === 'neon' ? new THREE.Color(0xff0066) : new THREE.Color(0x00ffcc)}
              emissiveIntensity={2}
            />
          </mesh>
          <mesh position={[-width / 2 - 0.05, height * 0.4, 0]}>
            <boxGeometry args={[0.05, height * 0.5, 0.1]} />
            <meshStandardMaterial
              color={era.buildingStyle === 'neon' ? new THREE.Color(0xff6600) : new THREE.Color(0x7b68ee)}
              emissive={era.buildingStyle === 'neon' ? new THREE.Color(0xff6600) : new THREE.Color(0x7b68ee)}
              emissiveIntensity={2}
            />
          </mesh>
        </>
      )}

      {/* Glass reflection strips for modern/futuristic */}
      {(era.buildingStyle === 'modern' || era.buildingStyle === 'futuristic') && (
        <mesh position={[0, height * 0.5, depth / 2 + 0.01]}>
          <planeGeometry args={[width * 0.9, height * 0.7]} />
          <meshStandardMaterial
            color={new THREE.Color(0x88aacc)}
            roughness={0.05}
            metalness={0.9}
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  );
}

function Windows({ count, width, depth, era }: { count: number; width: number; depth: number; era: any }) {
  const windows: JSX.Element[] = [];
  const rows = Math.min(count, 8);
  const cols = Math.floor(width / 1.2);
  const windowSpacing = width / (cols + 1);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = -width / 2 + windowSpacing * (col + 1);
      const y = 1.5 + row * 1.5;
      const isLit = Math.random() > 0.3;
      const windowColor = era.buildingStyle === 'ww2'
        ? (isLit ? [0.9, 0.8, 0.5] : [0.3, 0.3, 0.3])
        : era.buildingStyle === 'neon'
        ? (isLit ? [0.8, 0.4, 1.0] : [0.1, 0.1, 0.2])
        : era.buildingStyle === 'futuristic'
        ? (isLit ? [0.3, 0.8, 1.0] : [0.1, 0.15, 0.25])
        : era.buildingStyle === 'modern'
        ? (isLit ? [0.9, 0.95, 1.0] : [0.5, 0.55, 0.6])
        : (isLit ? [0.85, 0.85, 0.7] : [0.4, 0.4, 0.35]);

      windows.push(
        <group key={`w-${row}-${col}`} position={[x, y, depth / 2 + 0.02]}>
          <mesh>
            <planeGeometry args={[0.6, 0.9]} />
            <meshStandardMaterial
              color={new THREE.Color(windowColor[0], windowColor[1], windowColor[2])}
              emissive={isLit ? new THREE.Color(windowColor[0], windowColor[1], windowColor[2]) : new THREE.Color(0, 0, 0)}
              emissiveIntensity={isLit ? 0.3 : 0}
              roughness={0.3}
              metalness={era.buildingStyle === 'futuristic' ? 0.5 : 0.1}
            />
          </mesh>
          {/* Window frame */}
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.65, 0.95]} />
            <meshStandardMaterial color={new THREE.Color(0.2, 0.2, 0.2)} roughness={0.8} />
          </mesh>
        </group>
      );
    }
  }

  return <group>{windows}</group>;
}
