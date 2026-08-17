import * as THREE from 'three';
import { useMemo } from 'react';
import type { EraInfo } from '../eras/types';

interface WindowsProps {
  era: EraInfo;
  position?: [number, number, number];
  scale?: [number, number, number];
}

export function Windows({ era, position = [0, 0, 0], scale = [10, 15, 6] }: WindowsProps) {
  const windowGrid = useMemo(() => generateWindowGrid(scale), [scale]);

  return (
    <group position={position}>
      {windowGrid.map((win, i) => (
        <Window key={i} {...win} era={era} />
      ))}
    </group>
  );
}

interface WindowDef {
  x: number; y: number; z: number; rotY: number; lit: boolean;
}

function generateWindowGrid(scale: [number, number, number]): WindowDef[] {
  const windows: WindowDef[] = [];
  const floors = Math.floor(scale[1] / 2.5);
  const colsX = Math.max(1, Math.floor(scale[0] / 2));
  const colsZ = Math.max(1, Math.floor(scale[2] / 2));

  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < colsX; c++) {
      for (let face = 0; face < 4; face++) {
        const xOff = (c - (colsX - 1) / 2) * 2;
        const yOff = f * 2.5 + 1.5;
        const seed = `${scale.join(',')}-${f}-${c}-${face}`;
        const hash = hashCode(seed);
        const lit = (hash & 0x3) !== 0; // ~75% lit
        const isSide = face >= 2;

        windows.push({
          x: isSide ? (face === 2 ? scale[0] / 2 + 0.02 : -scale[0] / 2 - 0.02) : xOff,
          y: yOff,
          z: isSide ? (c - (colsX - 1) / 2) * 2 : (face === 0 ? scale[2] / 2 + 0.02 : -scale[2] / 2 - 0.02),
          rotY: isSide ? Math.PI / 2 : 0,
          lit,
        });
      }
    }
  }

  return windows.slice(0, 300); // cap for performance
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function Window({ x, y, z, rotY, lit, era }: WindowDef & { era: EraInfo }) {
  if (!lit) {
    return (
      <mesh position={[x, y, z]} rotation={[0, rotY, 0]}>
        <planeGeometry args={[1.2, 1.5]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
      </mesh>
    );
  }

  return (
    <mesh position={[x, y, z]} rotation={[0, rotY, 0]}>
      <planeGeometry args={[1.2, 1.5]} />
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
