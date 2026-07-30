import { useMemo } from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEra } from '../contexts/EraContext';
import type { EraYear } from '../types';

interface PedestrianConfig {
  year: EraYear;
  count: number;
  walkSpeed: number;
  colorRange: [number, number, number][];
  bodyHeight: number;
  headRadius: number;
}

const eraPedestrians: Record<EraYear, PedestrianConfig> = {
  1945: {
    year: 1945,
    count: 12,
    walkSpeed: 1.2,
    colorRange: [
      [0.3, 0.3, 0.3], [0.4, 0.35, 0.3], [0.5, 0.45, 0.35],
      [0.25, 0.25, 0.35], [0.35, 0.3, 0.4],
    ],
    bodyHeight: 1.5,
    headRadius: 0.15,
  },
  1965: {
    year: 1965,
    count: 18,
    walkSpeed: 1.3,
    colorRange: [
      [0.35, 0.35, 0.35], [0.45, 0.4, 0.35], [0.55, 0.5, 0.4],
      [0.3, 0.3, 0.4], [0.4, 0.35, 0.45],
    ],
    bodyHeight: 1.55,
    headRadius: 0.15,
  },
  1985: {
    year: 1985,
    count: 24,
    walkSpeed: 1.4,
    colorRange: [
      [0.4, 0.15, 0.15], [0.15, 0.15, 0.4], [0.15, 0.4, 0.15],
      [0.4, 0.4, 0.15], [0.4, 0.15, 0.4],
    ],
    bodyHeight: 1.6,
    headRadius: 0.15,
  },
  2005: {
    year: 2005,
    count: 30,
    walkSpeed: 1.5,
    colorRange: [
      [0.5, 0.5, 0.5], [0.6, 0.6, 0.6], [0.4, 0.4, 0.45],
      [0.55, 0.55, 0.55], [0.45, 0.45, 0.5],
    ],
    bodyHeight: 1.65,
    headRadius: 0.15,
  },
  2025: {
    year: 2025,
    count: 35,
    walkSpeed: 1.6,
    colorRange: [
      [0.55, 0.55, 0.55], [0.65, 0.65, 0.65], [0.45, 0.45, 0.5],
      [0.6, 0.6, 0.65], [0.5, 0.5, 0.55],
    ],
    bodyHeight: 1.68,
    headRadius: 0.15,
  },
  2055: {
    year: 2055,
    count: 40,
    walkSpeed: 1.8,
    colorRange: [
      [0.7, 0.7, 0.75], [0.8, 0.8, 0.85], [0.6, 0.6, 0.65],
      [0.75, 0.75, 0.8], [0.65, 0.65, 0.7],
    ],
    bodyHeight: 1.7,
    headRadius: 0.15,
  },
};

function hashCoord(x: number, z: number): number {
  const n = Math.sin(x * 73.1 + z * 197.3) * 43758.5453;
  return n - Math.floor(n);
}

interface Pedestrian {
  x: number;
  z: number;
  walkSpeed: number;
  phase: number;
  color: [number, number, number];
  height: number;
  headRadius: number;
}

interface PedestrianSystemProps {
  year?: EraYear;
}

export function PedestrianSystem({ year: yearProp }: PedestrianSystemProps) {
  const { year } = useEra();
  const effectiveYear = yearProp ?? year;

  const config = useMemo(() => eraPedestrians[effectiveYear], [effectiveYear]);

  const pedestrians = useMemo((): Pedestrian[] => {
    return Array.from({ length: config.count }, (_, i) => {
      const angle = hashCoord(i * 7, i * 13) * Math.PI * 2;
      const radius = 5 + hashCoord(i, i + 1) * 25;
      const colorIdx = Math.floor(hashCoord(i + 1, i) * config.colorRange.length);
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        walkSpeed: config.walkSpeed * (0.8 + hashCoord(i + 2, i) * 0.4),
        phase: hashCoord(i + 3, i + 4) * Math.PI * 2,
        color: config.colorRange[colorIdx],
        height: config.bodyHeight,
        headRadius: config.headRadius,
      };
    });
  }, [config]);

  useFrame((_, delta) => {
    // Pedestrian animation is handled via per-frame transforms
    // in the group below; the useFrame hook ensures smooth animation loop
  });

  return (
    <group name="pedestrians">
      {pedestrians.map((p, i) => (
        <Pedestrian key={`ped-${i}`} pedestrian={p} deltaMultiplier={0.5} />
      ))}
    </group>
  );
}

function Pedestrian({ pedestrian: p, deltaMultiplier }: { pedestrian: Pedestrian; deltaMultiplier: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // Simple walk animation: sway body, move feet, bob head
    const t = delta * p.walkSpeed * deltaMultiplier;
    groupRef.current.position.x = p.x + Math.sin(t * 0.7 + p.phase) * 0.04;
    groupRef.current.position.z = p.z + Math.cos(t * 0.7 + p.phase) * 0.04;
    groupRef.current.position.y = Math.abs(Math.sin(t * 3 + p.phase)) * 0.03;
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh castShadow>
        <boxGeometry args={[0.25, p.height * 0.5, 0.15]} />
        <meshStandardMaterial color={p.color} roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, p.height * 0.5 + p.headRadius, 0]} castShadow>
        <sphereGeometry args={[p.headRadius, 8, 8]} />
        <meshStandardMaterial color={p.color} roughness={0.9} />
      </mesh>
    </group>
  );
}

export default PedestrianSystem;