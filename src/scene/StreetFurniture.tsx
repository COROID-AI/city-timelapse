import * as THREE from 'three';
import { useMemo } from 'react';
import type { EraInfo } from '../eras/types';
import { Rng } from '../lib/rng';

interface StreetFurnitureProps {
  era: EraInfo;
}

export function StreetFurniture({ era }: StreetFurnitureProps) {
  const items = useMemo(() => generateStreetFurniture(era), [era]);

  return (
    <group>
      {items.map(item => (
        <StreetItem key={item.id} {...item} era={era} />
      ))}
    </group>
  );
}

interface ItemDef {
  id: string;
  type: 'lamp' | 'bench' | 'trash' | 'hydrant' | 'tree';
  position: [number, number, number];
}

function generateStreetFurniture(era: EraInfo): ItemDef[] {
  const rng = new Rng(Rng.fromString('sf'));
  const items: ItemDef[] = [];
  let id = 0;

  // Trees along sidewalks
  for (let z = -45; z <= 45; z += 12) {
    items.push({
      id: `tree-${id++}`,
      type: 'tree',
      position: [6.5, 0, z],
    });
    items.push({
      id: `tree-${id++}`,
      type: 'tree',
      position: [-6.5, 0, z],
    });
  }

  // Benches
  for (let x = -30; x <= 30; x += 20) {
    if (Math.abs(x) < 10) continue;
    items.push({
      id: `bench-${id++}`,
      type: 'bench',
      position: [x, 0, 6.5],
    });
  }

  // Trash cans
  for (let z = -40; z <= 40; z += 25) {
    items.push({
      id: `trash-${id++}`,
      type: 'trash',
      position: [7, 0, z],
    });
  }

  // Fire hydrants
  items.push({ id: `hydrant-${id++}`, type: 'hydrant', position: [7, 0, -15] });
  items.push({ id: `hydrant-${id++}`, type: 'hydrant', position: [-7, 0, 15] });

  return items;
}

function StreetItem({ type, position, era }: ItemDef & { era: EraInfo }) {
  switch (type) {
    case 'tree': return <Tree position={position} era={era} />;
    case 'bench': return <Bench position={position} />;
    case 'trash': return <TrashCan position={position} />;
    case 'hydrant': return <FireHydrant position={position} />;
    default: return null;
  }
}

function Tree({ position, era }: { position: [number, number, number]; era: EraInfo }) {
  const trunkColor = '#5a3a1a';
  const leafColors: Record<string, string> = {
    elm: '#3a6b2a',
    maple: '#4a7b3a',
    palm: '#2a5a1a',
    oak: '#3a6a2a',
    birch: '#5a8a3a',
    crystal: '#44ccff',
  };
  const leafColor = leafColors[era.treeType] || '#3a6b2a';

  return (
    <group position={position}>
      {/* Trunk */}
      <mesh castShadow position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 3, 8]} />
        <meshStandardMaterial color={trunkColor} roughness={0.9} />
      </mesh>

      {/* Canopy */}
      {era.treeType === 'palm' ? (
        <>
          {[0, 1, 2, 3].map(i => (
            <mesh key={i} position={[0, 3.5 + Math.sin(i) * 0.3, 0]} rotation={[0, i * Math.PI / 2, 0.3]}>
              <boxGeometry args={[0.1, 3, 0.8]} />
              <meshStandardMaterial color={leafColor} roughness={0.8} />
            </mesh>
          ))}
        </>
      ) : era.treeType === 'crystal' ? (
        <mesh castShadow position={[0, 3.5, 0]}>
          <dodecahedronGeometry args={[1.5, 0]} />
          <meshStandardMaterial
            color="#44ccff"
            emissive="#44ccff"
            emissiveIntensity={0.5}
            transparent
            opacity={0.8}
          />
        </mesh>
      ) : (
        <mesh castShadow position={[0, 4, 0]}>
          <sphereGeometry args={[2, 8, 8]} />
          <meshStandardMaterial color={leafColor} roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

function Bench({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Seat */}
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1.5, 0.08, 0.5]} />
        <meshStandardMaterial color="#5a3a1a" roughness={0.8} />
      </mesh>
      {/* Back */}
      <mesh castShadow position={[0, 0.9, -0.2]}>
        <boxGeometry args={[1.5, 0.5, 0.06]} />
        <meshStandardMaterial color="#5a3a1a" roughness={0.8} />
      </mesh>
      {/* Legs */}
      {[-0.6, 0.6].map((x, i) => (
        <mesh key={`leg-${i}`} position={[x, 0.25, 0]} castShadow>
          <boxGeometry args={[0.06, 0.5, 0.4]} />
          <meshStandardMaterial color="#333333" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function TrashCan({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.25, 0.3, 1, 8]} />
        <meshStandardMaterial color="#444444" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.01, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.03, 8]} />
        <meshStandardMaterial color="#555555" roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  );
}

function FireHydrant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.15, 0.18, 0.8, 8]} />
        <meshStandardMaterial color="#cc2222" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#cc2222" roughness={0.5} metalness={0.3} />
      </mesh>
    </group>
  );
}
