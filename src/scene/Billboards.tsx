import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import type { EraInfo } from '../eras/types';

interface BillboardsProps {
  era: EraInfo;
}

export function Billboards({ era }: BillboardsProps) {
  const billboards = useMemo(() => generateBillboards(era), [era]);

  return (
    <group>
      {billboards.map(b => (
        <Billboard key={b.id} {...b} era={era} />
      ))}
    </group>
  );
}

interface BillboardDef {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
}

function generateBillboards(era: EraInfo): BillboardDef[] {
  const defs: BillboardDef[] = [];

  // Main intersection billboard
  defs.push({
    id: 'bb-main',
    position: [15, 12, 0],
    rotation: [0, -Math.PI / 4, 0],
    size: [6, 4],
  });

  // Secondary billboard
  defs.push({
    id: 'bb-secondary',
    position: [-15, 10, 0],
    rotation: [0, Math.PI / 4, 0],
    size: [5, 3],
  });

  return defs;
}

function Billboard({ id, position, rotation, size, era }: BillboardDef & { era: EraInfo }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (matRef.current && ['1985', '2055'].includes(era.year.toString())) {
      // Flicker effect for neon eras
      matRef.current.opacity = 0.8 + Math.sin(clock.getElapsedTime() * 3 + (id.charCodeAt(2) || 0)) * 0.2;
    }
  });

  const adColors: Record<string, [string, string]> = {
    war_posters: ['#8B4513', '#DAA520'],
    soft_drink: ['#ff0000', '#ffffff'],
    arcade: ['#ff00ff', '#00ffff'],
    smartphone: ['#333333', '#00aaff'],
    sustainability: ['#00ff88', '#ffffff'],
    mars_colony: ['#ff4400', '#00ccff'],
  };

  const [bgColor, accentColor] = adColors[era.billboardContent] || ['#333333', '#ffffff'];

  return (
    <group position={position} rotation={rotation}>
      {/* Frame */}
      <mesh castShadow>
        <boxGeometry args={[size[0] + 0.3, size[1] + 0.3, 0.2]} />
        <meshStandardMaterial color="#333333" roughness={0.5} metalness={0.5} />
      </mesh>

      {/* Ad surface */}
      <mesh position={[0, 0, 0.11]}>
        <planeGeometry args={size} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={era.year >= 1985 ? 1.2 : 0.3}
          transparent
          ref={matRef}
        />
      </mesh>

      {/* Support pole */}
      <mesh position={[0, -size[1] / 2 - 3, 0]}>
        <cylinderGeometry args={[0.15, 0.2, size[1] + 6, 8]} />
        <meshStandardMaterial color="#555555" roughness={0.6} metalness={0.4} />
      </mesh>

      {/* Hologram overlay for 2055 */}
      {era.year === 2055 && (
        <mesh position={[0, 0, 0.2]}>
          <planeGeometry args={[size[0] * 0.9, size[1] * 0.9]} />
          <meshStandardMaterial
            color="#00ffff"
            emissive="#00ffff"
            emissiveIntensity={0.5}
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  );
}
