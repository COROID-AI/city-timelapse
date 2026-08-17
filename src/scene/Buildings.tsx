import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { EraInfo } from '../eras/types';
import { Rng } from '../lib/rng';

interface BuildingProps {
  era: EraInfo;
  position: [number, number, number];
  scale: [number, number, number];
  id: string;
}

export function Building({ era, position, scale, id }: BuildingProps) {
  const meshRef = useRef<THREE.Group>(null);
  const baseColors = era.buildingBaseColors;
  const mainColor = new Rng(Rng.fromString(id)).pick(baseColors);

  return (
    <group ref={meshRef} position={position} userData={{ id, type: 'building' }}>
      {/* Main structure */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={scale} />
        <meshStandardMaterial color={mainColor} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Roof detail */}
      {scale[1] > 10 && (
        <mesh position={[0, scale[1] / 2 + 0.5, 0]} castShadow>
          <boxGeometry args={[scale[0] * 0.6, 1, scale[2] * 0.6]} />
          <meshStandardMaterial color={new Rng(Rng.fromString(id + '-roof')).pick(baseColors)} roughness={0.8} />
        </mesh>
      )}

      {/* Windows */}
      <Windows scale={scale} era={era} seed={id} />

      {/* Neon accent for eras that have it */}
      {era.neonAccent && (
        <mesh position={[0, scale[1] * 0.9, scale[2] / 2 + 0.01]}>
          <boxGeometry args={[scale[0] * 0.8, 0.3, 0.05]} />
          <meshStandardMaterial
            color="#000000"
            emissive={era.neonAccent}
            emissiveIntensity={1.5}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      {/* Entrance canopy for ground floor */}
      {scale[1] < 15 && (
        <mesh position={[0, 2, scale[2] / 2 + 0.5]}>
          <boxGeometry args={[scale[0] * 0.6, 0.1, 2]} />
          <meshStandardMaterial color="#333333" roughness={0.5} metalness={0.3} />
        </mesh>
      )}
    </group>
  );
}

function Windows({ scale, era, seed }: { scale: [number, number, number]; era: EraInfo; seed: string }) {
  const windows = useMemo(() => {
    const results: { x: number; y: number; z: number; w: number; h: number }[] = [];
    const rng = new Rng(Rng.fromString(seed));
    const floors = Math.floor(scale[1] / 2.5);
    const colsX = Math.max(1, Math.floor(scale[0] / 2));
    const colsZ = Math.max(1, Math.floor(scale[2] / 2));

    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < colsX; c++) {
        for (let face = 0; face < 4; face++) {
          const xOff = (c - (colsX - 1) / 2) * 2;
          const yOff = f * 2.5 + 1.5;
          const zOff = ((face % 2 === 0 ? 0 : 0) + (face >= 2 ? 0 : 0));

          // Front/back faces
          if (face < 2) {
            results.push({
              x: xOff,
              y: yOff,
              z: face === 0 ? scale[2] / 2 + 0.02 : -scale[2] / 2 - 0.02,
              w: 1.2,
              h: 1.5,
            });
          }
          // Side faces
          else {
            results.push({
              x: face === 2 ? scale[0] / 2 + 0.02 : -scale[0] / 2 - 0.02,
              y: yOff,
              z: (c - (colsX - 1) / 2) * 2,
              w: 1.2,
              h: 1.5,
            });
          }
        }
      }
    }
    return results;
  }, [seed, scale]);

  return (
    <group>
      {windows.slice(0, 200).map((win, i) => (
        <Window key={i} {...win} era={era} rngSeed={`${seed}-w${i}`} />
      ))}
    </group>
  );
}

function Window({ x, y, z, w, h, era, rngSeed }: {
  x: number; y: number; z: number; w: number; h: number;
  era: EraInfo; rngSeed: string;
}) {
  const lit = useMemo(() => new Rng(Rng.fromString(rngSeed)).bool(0.6), [rngSeed]);

  if (!lit) return null;

  const isSide = Math.abs(z) < 1;

  return (
    <mesh position={[x, y, z]} rotation={isSide ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial
        color={era.windowEmissive}
        emissive={era.windowEmissive}
        emissiveIntensity={0.8}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}
