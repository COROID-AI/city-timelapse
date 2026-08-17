import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import type { EraInfo } from '../eras/types';
import { Rng } from '../lib/rng';

interface PedestriansProps {
  era: EraInfo;
}

export function Pedestrians({ era }: PedestriansProps) {
  const pedestrians = useMemo(() => generatePedestrians(era), [era]);

  return (
    <group>
      {pedestrians.map(p => (
        <Pedestrian key={p.id} {...p} era={era} />
      ))}
    </group>
  );
}

interface PedDef {
  id: string;
  position: [number, number, number];
  walkPath: number[];
  speed: number;
  outfitColor: string;
  height: number;
}

function generatePedestrians(era: EraInfo) {
  const rng = new Rng(Rng.fromString(`${era.year}-ped`));
  const defs: PedDef[] = [];
  let id = 0;

  for (let i = 0; i < 20; i++) {
    const onSidewalk = rng.bool();
    const side = rng.int(1, 4);
    const posZ = rng.range(-30, 30);
    let x = 0, z = 0;
    if (side === 1) { x = 5.5; z = posZ; }
    else if (side === 2) { x = -5.5; z = posZ; }
    else if (side === 3) { x = posZ; z = 5.5; }
    else { x = posZ; z = -5.5; }

    defs.push({
      id: `ped${id++}`,
      position: [x, 0, z] as [number, number, number],
      walkPath: Array.from({ length: 5 }, () => rng.range(-40, 40)),
      speed: rng.range(0.003, 0.008),
      outfitColor: new Rng(Rng.fromString(`oc${id}`)).pick([
        '#334455', '#556677', '#8899aa', '#445566', '#667788',
        '#aa4444', '#44aa44', '#4444aa', '#aaaa44', '#44aaaa',
      ]),
      height: rng.range(0.8, 1.2),
    });
  }

  return defs;
}

function Pedestrian({ position, speed, outfitColor, height }: {
  position: [number, number, number];
  speed: number;
  outfitColor: string;
  height: number;
  era?: EraInfo;
}) {
  const ref = useRef<THREE.Group>(null);
  const legRef1 = useRef<THREE.Mesh>(null);
  const legRef2 = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * speed * 60;
    const cycle = Math.sin(t * Math.PI * 2);

    // Walking animation
    if (legRef1.current && legRef2.current) {
      legRef1.current.rotation.x = cycle * 0.4;
      legRef2.current.rotation.x = -cycle * 0.4;
    }

    // Slow wander
    const wanderX = Math.sin(clock.getElapsedTime() * 0.1) * 0.01;
    const wanderZ = Math.cos(clock.getElapsedTime() * 0.08) * 0.01;
    ref.current.position.x = position[0] + wanderX;
    ref.current.position.z = position[2] + wanderZ;
  });

  return (
    <group ref={ref} position={position}>
      {/* Body */}
      <mesh castShadow position={[0, 0.8 + height * 0.4, 0]}>
        <boxGeometry args={[0.4, 0.7, 0.25]} />
        <meshStandardMaterial color={outfitColor} roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 1.3 + height * 0.4, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#ddb89a" roughness={0.7} />
      </mesh>
      {/* Left leg */}
      <mesh ref={legRef1} castShadow position={[-0.1, 0.35 + height * 0.15, 0]}>
        <boxGeometry args={[0.15, 0.7, 0.15]} />
        <meshStandardMaterial color="#334455" roughness={0.8} />
      </mesh>
      {/* Right leg */}
      <mesh ref={legRef2} castShadow position={[0.1, 0.35 + height * 0.15, 0]}>
        <boxGeometry args={[0.15, 0.7, 0.15]} />
        <meshStandardMaterial color="#334455" roughness={0.8} />
      </mesh>
      {/* Arms */}
      <mesh castShadow position={[-0.3, 0.9, 0]}>
        <boxGeometry args={[0.1, 0.6, 0.1]} />
        <meshStandardMaterial color={outfitColor} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0.3, 0.9, 0]}>
        <boxGeometry args={[0.1, 0.6, 0.1]} />
        <meshStandardMaterial color={outfitColor} roughness={0.8} />
      </mesh>
    </group>
  );
}
