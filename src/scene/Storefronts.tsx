import * as THREE from 'three';
import { useMemo } from 'react';
import type { EraInfo } from '../eras/types';

interface StorefrontsProps {
  era: EraInfo;
  quadrant: number; // 0-3 for each corner
}

export function Storefronts({ era, quadrant }: StorefrontsProps) {
  const storefronts = useMemo(() => generateStorefronts(era, quadrant), [era, quadrant]);

  return (
    <group position={getQuadrantPosition(quadrant)}>
      {storefronts.map((sf, i) => (
        <Storefront key={i} {...sf} era={era} />
      ))}
    </group>
  );
}

function getQuadrantPosition(q: number): [number, number, number] {
  const offset = 20;
  switch (q) {
    case 0: return [offset, 0, offset];
    case 1: return [-offset, 0, offset];
    case 2: return [-offset, 0, -offset];
    case 3: return [offset, 0, -offset];
    default: return [0, 0, 0];
  }
}

function generateStorefronts(era: EraInfo, _q: number) {
  return Array.from({ length: 3 }, (_, i) => ({
    id: `sf-${_q}-${i}`,
    width: 4 + i,
    height: 3 + Math.random(),
    depth: 5,
    xOff: (i - 1) * 6,
    zOff: 0,
  }));
}

function Storefront({ width, height, depth, xOff, zOff, era }: {
  width: number; height: number; depth: number;
  xOff: number; zOff: number; era: EraInfo;
}) {
  return (
    <group position={[xOff, 0, zOff]}>
      {/* Store facade */}
      <mesh castShadow position={[width / 2, height / 2, depth / 2]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#8B7355" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Large display window */}
      <mesh position={[width / 2, 1.2, depth + 0.01]}>
        <planeGeometry args={[width * 0.6, 1.5]} />
        <meshStandardMaterial
          color={era.windowEmissive}
          emissive={era.windowEmissive}
          emissiveIntensity={0.5}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Door */}
      <mesh position={[width / 2, 1, 0]}>
        <boxGeometry args={[1, 2.2, 0.1]} />
        <meshStandardMaterial color="#4a3a2a" roughness={0.6} />
      </mesh>

      {/* Awning */}
      <mesh position={[width / 2, height - 0.3, depth + 0.5]}>
        <boxGeometry args={[width + 0.5, 0.1, 1.5]} />
        <meshStandardMaterial color={era.neonAccent || '#cc3333'} roughness={0.5} />
      </mesh>

      {/* Sign */}
      <mesh position={[width / 2, height + 0.5, depth + 0.01]}>
        <boxGeometry args={[width * 0.8, 0.6, 0.05]} />
        <meshStandardMaterial
          color="#111111"
          emissive={era.neonAccent || '#ffaa00'}
          emissiveIntensity={era.year >= 1965 ? 1.5 : 0.3}
        />
      </mesh>
    </group>
  );
}
