import { useMemo, useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { Era } from '../eras';
import { BuildingParams, VehicleParams, PedestrianParams } from './CityBlock';

// --- Building Component ---

interface BuildingInstanceProps {
  params: BuildingParams;
  era: Era;
  progress: number;
}

export function BuildingInstance({ params, era, progress }: BuildingInstanceProps) {
  const meshRef = useRef<THREE.Group>(null);
  const windowMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Animate window lighting based on era transition
  const windowEmissive = useMemo(() => {
    // Use era ranges so intermediate interpolated years still look stable.
    const y = params.era;
    const baseIntensity = y <= 1945 ? 0.3 : y <= 1965 ? 0.5 : 0.8;
    return new THREE.Color(params.windowColor).multiplyScalar(baseIntensity * (0.5 + progress * 0.5));
  }, [params.windowColor, params.era, progress]);

  // Building geometry
  const buildingGeometry = useMemo(() => {
    return new THREE.BoxGeometry(params.width, params.height, params.depth);
  }, [params.width, params.height, params.depth]);

  // Window geometry
  const windowGeometry = useMemo(() => {
    const w = 0.5;
    const h = 0.7;
    return new THREE.PlaneGeometry(w, h);
  }, []);

  return (
    <group ref={meshRef}>
      {/* Main building body */}
      <mesh geometry={buildingGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={params.facadeColor}
          roughness={era.buildingStyle === 'glass' ? 0.1 : 0.8}
          metalness={era.buildingStyle === 'glass' ? 0.7 : 0.1}
        />
      </mesh>

      {/* Windows */}
      <Instances
        geometry={windowGeometry}
        limit={params.windowCount * params.windowRows}
      >
        <meshStandardMaterial ref={windowMaterialRef} color={windowEmissive} emissive={windowEmissive} emissiveIntensity={0.9} transparent opacity={0.9} />
        {Array.from({ length: params.windowCount }).map((_, i) => {
          const row = Math.floor(i / 4);
          const col = i % 4;
          for (let r = 0; r < params.windowRows; r++) {
            if (r === 0 || r === 1) continue; // Skip ground floor
            const x = (col / 4 - 0.375) * params.width;
            const y = r * 2.5;
            const z = (row / Math.max(1, Math.floor(params.windowCount / 4)) - 0.5) * params.depth + 0.05;
            return (
              <Instance
                key={`${i}-${r}`}
                position={[x, y, z]}
                rotation={[0, params.depth > 0 ? (row % 2 === 0 ? Math.PI : 0) : 0, 0]}
              />
            );
          }
          return null;
        })}
      </Instances>

      {/* Fire escape (1945-1965 era) */}
      {params.hasFireEscape && (
        <FireEscape height={params.height} width={params.width} />
      )}

      {/* Antenna (1985+) */}
      {params.hasAntenna && (
        <Antenna height={params.height} />
      )}

      {/* Roof garden (2005+) */}
      {params.hasRoofGarden && (
        <RoofGarden
          seed={params.seed}
          height={params.height}
          width={params.width}
          depth={params.depth}
        />
      )}

      {/* LED strips (2025+) */}
      {params.hasLedStrips && (
        <LedStrips height={params.height} width={params.width} depth={params.depth} era={era} />
      )}

      {/* Hologram (2055+) */}
      {params.hasHologram && (
        <Hologram height={params.height} />
      )}
    </group>
  );
}

// --- Building Detail Components ---

function FireEscape({ height, width }: { height: number; width: number }) {
  const segments = Math.floor(height / 3);
  return (
    <group position={[width / 2 + 0.1, height / 2, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.05, 0.05, height, 6]} />
        <meshStandardMaterial color="#888888" metalness={0.8} />
      </mesh>
      {Array.from({ length: segments }).map((_, i) => (
        <mesh
          key={i}
          position={[0, -height / 2 + i * 3, 0]}
          castShadow
        >
          <boxGeometry args={[0.03, 0.03, width + 0.2]} />
          <meshStandardMaterial color="#888888" metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Antenna({ height }: { height: number }) {
  return (
    <group position={[0, height + 1, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.03, 0.03, 3, 8]} />
        <meshStandardMaterial color="#cccccc" metalness={0.9} />
      </mesh>
      {Array.from({ length: 3 }).map((_, i) => (
        <mesh
          key={i}
          position={[0, -0.5 - i * 0.3, 0]}
          castShadow
        >
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function RoofGarden({
  seed,
  height,
  width,
  depth,
}: {
  seed: number;
  height: number;
  width: number;
  depth: number;
}) {
  // Deterministic plant positions (stable across re-renders/transitions)
  const plants = useMemo(() => {
    const count = 20;
    const arr: { x: number; z: number }[] = [];
    for (let i = 0; i < count; i++) {
      const r1 = seededRandom(seed + i * 1013);
      const r2 = seededRandom(seed + i * 1319);
      arr.push({
        x: (r1 - 0.5) * width * 0.7,
        z: (r2 - 0.5) * depth * 0.7,
      });
    }
    return arr;
  }, [seed, width, depth]);

  return (
    <group position={[0, height + 0.1, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[width * 0.8, 0.3, depth * 0.8]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
      {plants.map((p, i) => (
        <mesh key={i} position={[p.x, 0.2, p.z]} castShadow>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color="#1b5e20" />
        </mesh>
      ))}
    </group>
  );
}

function seededRandom(seed: number): number {
  // Simple deterministic hash -> [0,1)
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function LedStrips({ height, width, depth, era }: { height: number; width: number; depth: number; era: Era }) {
  const ledColor = new THREE.Color(era.color);
  return (
    <group>
      <mesh position={[0, height + 0.05, depth / 2 + 0.01]}>
        <boxGeometry args={[width, 0.05, 0.02]} />
        <meshStandardMaterial color={ledColor} emissive={ledColor} emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[width / 2 + 0.01, height + 0.05, 0]}>
        <boxGeometry args={[0.02, 0.05, depth]} />
        <meshStandardMaterial color={ledColor} emissive={ledColor} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function Hologram({ height }: { height: number }) {
  const hologramRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (hologramRef.current) {
      hologramRef.current.scale.y = 0.5 + Math.sin(clock.elapsedTime * 2) * 0.1;
      const mat = hologramRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + Math.sin(clock.elapsedTime * 3) * 0.1;
    }
  });

  return (
    <mesh ref={hologramRef} position={[0, height + 5, 0]}>
      <torusGeometry args={[2, 0.3, 16, 100]} />
      <meshBasicMaterial
        color="#bb86fc"
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// --- Vehicle Component ---

interface VehicleInstanceProps {
  params: VehicleParams;
  path: { start: [number, number, number]; end: [number, number, number] };
  progress: number;
}

export function VehicleInstance({ params, path, progress }: VehicleInstanceProps) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);

  const startRef = useRef(new THREE.Vector3());
  const endRef = useRef(new THREE.Vector3());
  const dirRef = useRef(new THREE.Vector3());
  const tmpPosRef = useRef(new THREE.Vector3());
  const lookAtRef = useRef(new THREE.Vector3());

  useEffect(() => {
    startRef.current.set(path.start[0], path.start[1], path.start[2]);
    endRef.current.set(path.end[0], path.end[1], path.end[2]);
  }, [path.start, path.end]);

  useFrame((state, delta) => {
    elapsed.current += delta * params.speed * 0.05;
    const t = elapsed.current % 1;

    const start = startRef.current;
    const end = endRef.current;
    tmpPosRef.current.lerpVectors(start, end, t);

    if (groupRef.current) {
      groupRef.current.position.copy(tmpPosRef.current);

      // Face direction of travel
      dirRef.current.subVectors(end, start).normalize();
      lookAtRef.current.copy(groupRef.current.position).add(dirRef.current);
      groupRef.current.lookAt(lookAtRef.current);
    }
  });

  const vehicleColor = new THREE.Color(params.color);

  const renderVehicle = () => {
    switch (params.type) {
      case 'motorcycle':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={[params.length, params.height * 0.6, params.width]} />
              <meshStandardMaterial color={vehicleColor} metalness={0.8} />
            </mesh>
            <mesh position={[params.length * 0.3, params.height * 0.3, 0]} castShadow>
              <sphereGeometry args={[0.3, 16, 16]} />
              <meshStandardMaterial color={vehicleColor} metalness={0.8} />
            </mesh>
          </group>
        );
      case 'hover':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={[params.length, params.height, params.width]} />
              <meshStandardMaterial color={vehicleColor} emissive={vehicleColor} emissiveIntensity={0.3} />
            </mesh>
            <mesh position={[0, -0.5, 0]}>
              <cylinderGeometry args={[params.width * 0.8, params.width * 0.8, 0.1, 32]} />
              <meshStandardMaterial color={vehicleColor} emissive={vehicleColor} emissiveIntensity={0.5} transparent opacity={0.5} />
            </mesh>
          </group>
        );
      case 'bus':
        return (
          <mesh castShadow>
            <boxGeometry args={[params.length, params.height, params.width]} />
            <meshStandardMaterial color={vehicleColor} />
          </mesh>
        );
      case 'truck':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={[params.length * 0.6, params.height, params.width]} />
              <meshStandardMaterial color={vehicleColor} />
            </mesh>
            <mesh position={[-params.length * 0.2, 0, 0]} castShadow>
              <boxGeometry args={[params.length * 0.4, params.height * 0.8, params.width]} />
              <meshStandardMaterial color={vehicleColor} />
            </mesh>
          </group>
        );
      case 'autonomous':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={[params.length, params.height, params.width]} />
              <meshStandardMaterial color={vehicleColor} metalness={0.5} />
            </mesh>
            <mesh position={[0, params.height * 0.3, params.length * 0.4]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.8} />
            </mesh>
          </group>
        );
      default:
        return (
          <mesh castShadow>
            <boxGeometry args={[params.length, params.height, params.width]} />
            <meshStandardMaterial color={vehicleColor} metalness={0.6} />
          </mesh>
        );
    }
  };

  return <group ref={groupRef}>{renderVehicle()}</group>;
}

// --- Pedestrian Component ---

interface PedestrianInstanceProps {
  params: PedestrianParams;
  path: { start: [number, number, number]; end: [number, number, number] };
}

export function PedestrianInstance({ params, path }: PedestrianInstanceProps) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);

  const startRef = useRef(new THREE.Vector3());
  const endRef = useRef(new THREE.Vector3());
  const tmpPosRef = useRef(new THREE.Vector3());

  useEffect(() => {
    startRef.current.set(path.start[0], path.start[1], path.start[2]);
    endRef.current.set(path.end[0], path.end[1], path.end[2]);
  }, [path.start, path.end]);

  useFrame((state, delta) => {
    elapsed.current += delta * params.walkSpeed * 0.3;
    const t = elapsed.current % 1;
    if (groupRef.current) {
      tmpPosRef.current.lerpVectors(startRef.current, endRef.current, t);
      groupRef.current.position.copy(tmpPosRef.current);
      // Gentle bobbing animation
      groupRef.current.position.y += Math.sin(t * Math.PI * 2) * 0.05;
    }
  });

  const outfitColor = getOutfitColor(params.outfit);

  return (
    <group ref={groupRef}>
      {/* Head */}
      <mesh castShadow position={[0, params.height - 0.1, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>
      {/* Body */}
      <mesh castShadow position={[0, params.height - 0.4, 0]}>
        <boxGeometry args={[0.25, 0.4, 0.12]} />
        <meshStandardMaterial color={outfitColor} />
      </mesh>
      {/* Arms */}
      <mesh castShadow position={[-0.18, params.height - 0.35, 0]}>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color={outfitColor} />
      </mesh>
      <mesh castShadow position={[0.18, params.height - 0.35, 0]}>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color={outfitColor} />
      </mesh>
      {/* Legs */}
      <mesh castShadow position={[-0.07, params.height - 0.7, 0]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#1a237e" />
      </mesh>
      <mesh castShadow position={[0.07, params.height - 0.7, 0]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#1a237e" />
      </mesh>
    </group>
  );
}

function getOutfitColor(outfit: string): string {
  const colors: Record<string, string> = {
    suit: '#1a237e',
    dress: '#e91e63',
    overalls: '#4e342e',
    coat: '#37474f',
    hat: '#3e2723',
    minidress: '#ff5722',
    turtleneck: '#263238',
    bellbottoms: '#0d47a1',
    mod: '#673ab7',
    business: '#0d47a1',
    jeans: '#1565c0',
    jacket: '#37474f',
    aerobics: '#ff1744',
    casual: '#455a64',
    hoodie: '#212121',
    'business-casual': '#283593',
    'smart-casual': '#37474f',
    'tech-wear': '#212121',
    holographic: '#bb86fc',
    neon: '#00ff00',
    adaptive: '#03dac6',
  };
  return colors[outfit] || '#333333';
}

// --- Street Light Component ---

interface StreetLightProps {
  position: [number, number, number];
  era: Era;
  type: 'gas' | 'sodium' | 'led' | 'smart';
}

export function StreetLight({ position, era, type }: StreetLightProps) {
  const lightColor =
    type === 'gas' ? '#ffd54f' : type === 'sodium' ? '#ffab00' : type === 'led' ? '#bbdefb' : '#03dac6';
  const lightIntensity = type === 'gas' ? 0.5 : type === 'sodium' ? 0.8 : type === 'led' ? 1.0 : 1.2;

  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.3, 8]} />
        <meshStandardMaterial color="#666666" metalness={0.8} />
      </mesh>
      <mesh position={[0, 4, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 8, 8]} />
        <meshStandardMaterial color="#444444" metalness={0.7} />
      </mesh>
      <mesh position={[0, 8, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={lightColor} emissive={lightColor} emissiveIntensity={lightIntensity} />
      </mesh>
      <pointLight
        position={[0, 8, 0]}
        color={lightColor}
        intensity={lightIntensity}
        distance={20}
        decay={2}
      />
    </group>
  );
}

// --- Street Furniture ---

export function Bench({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2, 0.4, 0.4]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[2, 0.05, 0.1]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      <mesh position={[-0.8, 0.6, 0]} castShadow>
        <boxGeometry args={[0.05, 0.6, 0.05]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      <mesh position={[0.8, 0.6, 0]} castShadow>
        <boxGeometry args={[0.05, 0.6, 0.05]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
    </group>
  );
}

export function TrashCan({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.8, 16]} />
        <meshStandardMaterial color="#424242" metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <ringGeometry args={[0.18, 0.25, 16]} />
        <meshStandardMaterial color="#424242" metalness={0.3} />
      </mesh>
    </group>
  );
}

export function PhoneBox({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.8, 2.2, 0.4]} />
        <meshStandardMaterial color="#0d47a1" />
      </mesh>
      <mesh position={[0, 0, 0.21]}>
        <boxGeometry args={[0.7, 2.1, 0.02]} />
        <meshStandardMaterial color="#00e676" emissive="#00e676" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 1.1, 0.21]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#00e676" emissive="#00e676" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

export function DigitalDisplay({ position, era }: { position: [number, number, number]; era: Era }) {
  const displayRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (displayRef.current && displayRef.current.material) {
      const mat = displayRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 2) * 0.2;
    }
  });

  const displayColor = era.year >= 2055 ? '#bb86fc' : '#03dac6';

  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[1.5, 1, 0.2]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      <mesh ref={displayRef} position={[0, 0, 0.11]}>
        <boxGeometry args={[1.3, 0.8, 0.02]} />
        <meshStandardMaterial color={displayColor} emissive={displayColor} emissiveIntensity={0.5} />
      </mesh>
      <pointLight position={[0, 0, 0.3]} color={displayColor} intensity={0.8} distance={5} />
    </group>
  );
}

export function EVCharger({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.4, 1.2, 0.3]} />
        <meshStandardMaterial color="#424242" metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.7, 0.16]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#00e676" emissive="#00e676" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}
