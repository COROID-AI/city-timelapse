import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useEra } from '../contexts/EraContext';
import type { EraYear } from '../types';
import type { Group } from 'three';

// ── Pedestrian outfit palette & silhouette per era ──────────
interface PedestrianOutfit {
  bodyColors: number[];
  accentColors: number[];
  silhouette: 'wool-suit' | 'mod' | 'power-suit' | 'casual' | 'techwear' | 'futurist';
  headColor: number;
  shoeColor: number;
}

function hashIndex(index: number, year: EraYear): number {
  // Stable deterministic hash — index-based, no Math.random
  const seed = index * 2654435761 + year;
  return ((seed ^ (seed >>> 16)) >>> 0) / 4294967296;
}

function pickStable<T>(index: number, year: EraYear, options: readonly T[]): T {
  return options[Math.floor(hashIndex(index, year) * options.length) % options.length];
}

function eraOutfit(year: EraYear): PedestrianOutfit {
  switch (year) {
    case 1945:
      return {
        bodyColors: [0x3b4f6b, 0x2d3a4a, 0x5a4a3a, 0x4a3a2a, 0x6b5b4b, 0x3a3a4a],
        accentColors: [0x8b2020, 0x2d4a7b, 0x5a5a5a],
        silhouette: 'wool-suit',
        headColor: 0xc4a882,
        shoeColor: 0x3b2f1f,
      };
    case 1965:
      return {
        bodyColors: [0xcc2233, 0x3366cc, 0x33cc55, 0xffcc00, 0xcc33ff, 0x22cccc],
        accentColors: [0xffffff, 0xff6699, 0x99ffcc],
        silhouette: 'mod',
        headColor: 0xd4a87c,
        shoeColor: 0xffffff,
      };
    case 1985:
      return {
        bodyColors: [0xcc2255, 0x22ccaa, 0xaa22cc, 0x2255cc, 0xcc8822, 0x44dd88],
        accentColors: [0x00ffff, 0xff00ff, 0xffff00, 0xff4400],
        silhouette: 'power-suit',
        headColor: 0xd0a87c,
        shoeColor: 0x222222,
      };
    case 2005:
      return {
        bodyColors: [0x445566, 0x778899, 0x665544, 0x334455, 0x887766, 0x554433],
        accentColors: [0x99aabb, 0xbbccdd, 0xaabb77],
        silhouette: 'casual',
        headColor: 0xc8b08c,
        shoeColor: 0x554433,
      };
    case 2025:
      return {
        bodyColors: [0x3a3a3a, 0x5a5a5a, 0x7a6a5a, 0x2a3a3a, 0x6a5a4a, 0x4a4a5a],
        accentColors: [0x44ddcc, 0xff4400, 0x00ff88, 0x8844ff],
        silhouette: 'techwear',
        headColor: 0xb0a090,
        shoeColor: 0x222222,
      };
    case 2055:
      return {
        bodyColors: [0x4488cc, 0xcc44aa, 0x44ccaa, 0xaa88ff, 0xff8844, 0x44ddff],
        accentColors: [0x00ffff, 0xff00ff, 0x88ff00, 0xffff88],
        silhouette: 'futurist',
        headColor: 0xa0b0c0,
        shoeColor: 0x334455,
      };
  }
}

// ── Era-specific pedestrian config ──────────────────────────
interface PedestrianConfig {
  count: number;
  baseWalkSpeed: number;
  speedVariation: number;
  crowdSeparation: number;
  scale: [number, number, number];
}

function getEraPedestrianConfig(year: EraYear): PedestrianConfig {
  switch (year) {
    case 1945:
      return { count: 12, baseWalkSpeed: 0.6, speedVariation: 0.15, crowdSeparation: 1.2, scale: [0.8, 1.6, 0.8] };
    case 1965:
      return { count: 18, baseWalkSpeed: 0.8, speedVariation: 0.2, crowdSeparation: 1.0, scale: [0.85, 1.7, 0.85] };
    case 1985:
      return { count: 22, baseWalkSpeed: 0.9, speedVariation: 0.25, crowdSeparation: 0.9, scale: [0.85, 1.7, 0.85] };
    case 2005:
      return { count: 25, baseWalkSpeed: 1.0, speedVariation: 0.2, crowdSeparation: 0.85, scale: [0.9, 1.75, 0.9] };
    case 2025:
      return { count: 30, baseWalkSpeed: 1.1, speedVariation: 0.25, crowdSeparation: 0.8, scale: [0.9, 1.75, 0.9] };
    case 2055:
      return { count: 35, baseWalkSpeed: 1.3, speedVariation: 0.3, crowdSeparation: 0.7, scale: [0.95, 1.8, 0.95] };
  }
}

// ── Pedestrian fleet ────────────────────────────────────────
interface PedestrianDefinition {
  index: number;
  year: EraYear;
  position: [number, number, number];
  walkSpeed: number;
  direction: [number, number];
  outfit: PedestrianOutfit;
  scale: [number, number, number];
}

function getEraPedestrianFleet(year: EraYear): PedestrianDefinition[] {
  const config = getEraPedestrianConfig(year);
  const outfit = eraOutfit(year);
  const fleet: PedestrianDefinition[] = [];

  for (let i = 0; i < config.count; i++) {
    const angle = hashIndex(i * 7 + 3, year) * Math.PI * 2;
    const radius = 3 + hashIndex(i * 13 + 7, year) * 25;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = 0;

    const speed = config.baseWalkSpeed + hashIndex(i * 11 + 5, year) * config.speedVariation;
    const dirAngle = hashIndex(i * 17 + 9, year) * Math.PI * 2;

    fleet.push({
      index: i,
      year,
      position: [x, y, z],
      walkSpeed: Math.max(0.1, speed),
      direction: [Math.cos(dirAngle), Math.sin(dirAngle)],
      outfit,
      scale: config.scale,
    });
  }

  return fleet;
}

// ── PedestrianBody component ────────────────────────────────
function PedestrianBody({ pedestrian }: { pedestrian: PedestrianDefinition }) {
  const bodyRef = useRef<Group>(null);
  const [phase] = useState(() => hashIndex(pedestrian.index * 3 + 1, pedestrian.year) * Math.PI * 2);

  useFrame((_state, delta) => {
    const ref = bodyRef.current;
    if (!ref) return;

    // Walk cycle: gentle sinusoidal bob + rotation toward direction
    ref.position.x = pedestrian.position[0];
    ref.position.z = pedestrian.position[2];
    ref.position.y = pedestrian.scale[2] * 0.4;

    const t = performance.now() * 0.001;
    const walkBob = Math.sin(t * pedestrian.walkSpeed * 3 + phase) * 0.03;
    ref.position.y += walkBob;

    // Face direction of travel
    const targetY = Math.atan2(pedestrian.direction[0], pedestrian.direction[1]);
    let currentY = ref.rotation.y;
    let diff = targetY - currentY;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ref.rotation.y = currentY + diff * 0.02;
  });

  const s = pedestrian.scale[0];
  const h = pedestrian.scale[1];

  return (
    <group ref={bodyRef} name={`pedestrian-${pedestrian.index}`}>
      {/* Body torso */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[s * 0.45, h * 0.35, s * 0.25]} />
        <meshStandardMaterial color={pedestrian.outfit.bodyColors[pedestrian.index % pedestrian.outfit.bodyColors.length]} metalness={0.1} roughness={0.8} />
      </mesh>

      {/* Head */}
      <mesh position={[0, h * 0.18, 0]} castShadow receiveShadow>
        <sphereGeometry args={[s * 0.12, 12, 12]} />
        <meshStandardMaterial color={pedestrian.outfit.headColor} metalness={0.05} roughness={0.9} />
      </mesh>

      {/* Hat for wartime era */}
      {pedestrian.year === 1945 && (
        <mesh position={[0, h * 0.32, 0]} castShadow>
          <cylinderGeometry args={[s * 0.14, s * 0.18, s * 0.06, 12]} />
          <meshStandardMaterial color={0x2a2a2a} metalness={0.1} roughness={0.7} />
        </mesh>
      )}

      {/* Mod hat for 1965 */}
      {pedestrian.year === 1965 && (
        <mesh position={[0, h * 0.33, 0]} castShadow>
          <sphereGeometry args={[s * 0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 3]} />
          <meshStandardMaterial color={pedestrian.outfit.accentColors[pedestrian.index % pedestrian.outfit.accentColors.length]} metalness={0.05} roughness={0.8} />
        </mesh>
      )}

      {/* Power suit shoulder pads for 1985 */}
      {pedestrian.year === 1985 && (
        <>
          <mesh position={[-s * 0.32, h * 0.28, 0]} castShadow>
            <boxGeometry args={[s * 0.12, h * 0.04, s * 0.22]} />
            <meshStandardMaterial color={pedestrian.outfit.bodyColors[pedestrian.index % pedestrian.outfit.bodyColors.length]} metalness={0.05} roughness={0.7} />
          </mesh>
          <mesh position={[s * 0.32, h * 0.28, 0]} castShadow>
            <boxGeometry args={[s * 0.12, h * 0.04, s * 0.22]} />
            <meshStandardMaterial color={pedestrian.outfit.bodyColors[pedestrian.index % pedestrian.outfit.bodyColors.length]} metalness={0.05} roughness={0.7} />
          </mesh>
        </>
      )}

      {/* Techwear hood for 2025 */}
      {pedestrian.year === 2025 && (
        <mesh position={[0, h * 0.26, -s * 0.05]} castShadow>
          <sphereGeometry args={[s * 0.14, 12, 8]} />
          <meshStandardMaterial color={pedestrian.outfit.accentColors[pedestrian.index % pedestrian.outfit.accentColors.length]} metalness={0.2} roughness={0.6} />
        </mesh>
      )}

      {/* Futurist head piece for 2055 */}
      {pedestrian.year === 2055 && (
        <mesh position={[0, h * 0.25, 0]} castShadow>
          <icosahedronGeometry args={[s * 0.1, 0]} />
          <meshStandardMaterial color={pedestrian.outfit.accentColors[pedestrian.index % pedestrian.outfit.accentColors.length]} metalness={0.4} roughness={0.3} />
        </mesh>
      )}

      {/* Left arm */}
      <mesh position={[-s * 0.3, h * 0.05, 0]} castShadow>
        <boxGeometry args={[s * 0.1, h * 0.25, s * 0.1]} />
        <meshStandardMaterial color={pedestrian.outfit.bodyColors[pedestrian.index % pedestrian.outfit.bodyColors.length]} metalness={0.05} roughness={0.85} />
      </mesh>

      {/* Right arm */}
      <mesh position={[s * 0.3, h * 0.05, 0]} castShadow>
        <boxGeometry args={[s * 0.1, h * 0.25, s * 0.1]} />
        <meshStandardMaterial color={pedestrian.outfit.bodyColors[pedestrian.index % pedestrian.outfit.bodyColors.length]} metalness={0.05} roughness={0.85} />
      </mesh>

      {/* Left leg */}
      <mesh position={[-s * 0.12, -h * 0.2, 0]} castShadow>
        <boxGeometry args={[s * 0.1, h * 0.35, s * 0.12]} />
        <meshStandardMaterial color={pedestrian.outfit.bodyColors[pedestrian.index % pedestrian.outfit.bodyColors.length]} metalness={0.05} roughness={0.85} />
      </mesh>

      {/* Right leg */}
      <mesh position={[s * 0.12, -h * 0.2, 0]} castShadow>
        <boxGeometry args={[s * 0.1, h * 0.35, s * 0.12]} />
        <meshStandardMaterial color={pedestrian.outfit.bodyColors[pedestrian.index % pedestrian.outfit.bodyColors.length]} metalness={0.05} roughness={0.85} />
      </mesh>

      {/* Shoes */}
      <mesh position={[-s * 0.12, -h * 0.38, s * 0.04]} castShadow>
        <boxGeometry args={[s * 0.12, s * 0.06, s * 0.16]} />
        <meshStandardMaterial color={pedestrian.outfit.shoeColor} metalness={0.1} roughness={0.7} />
      </mesh>
      <mesh position={[s * 0.12, -h * 0.38, s * 0.04]} castShadow>
        <boxGeometry args={[s * 0.12, s * 0.06, s * 0.16]} />
        <meshStandardMaterial color={pedestrian.outfit.shoeColor} metalness={0.1} roughness={0.7} />
      </mesh>

      {/* Accent detail — scarf for 1945 */}
      {pedestrian.year === 1945 && (
        <mesh position={[0, h * 0.08, s * 0.14]} castShadow>
          <boxGeometry args={[s * 0.3, h * 0.03, s * 0.06]} />
          <meshStandardMaterial color={pedestrian.outfit.accentColors[pedestrian.index % pedestrian.outfit.accentColors.length]} metalness={0.05} roughness={0.8} />
        </mesh>
      )}

      {/* Reflective accents for 2025 */}
      {pedestrian.year === 2025 && (
        <>
          <mesh position={[0, h * 0.15, s * 0.14]}>
            <sphereGeometry args={[s * 0.03, 8, 8]} />
            <meshStandardMaterial color={0x00ffcc} emissive={0x00ffcc} emissiveIntensity={0.5} metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, h * 0.05, s * 0.14]}>
            <sphereGeometry args={[s * 0.03, 8, 8]} />
            <meshStandardMaterial color={0x00ffcc} emissive={0x00ffcc} emissiveIntensity={0.5} metalness={0.9} roughness={0.1} />
          </mesh>
        </>
      )}

      {/* Chromatic glow for 2055 */}
      {pedestrian.year === 2055 && (
        <>
          <pointLight
            color={pedestrian.outfit.accentColors[pedestrian.index % pedestrian.outfit.accentColors.length]}
            intensity={0.2}
            distance={2}
            position={[0, h * 0.1, 0]}
          />
        </>
      )}
    </group>
  );
}

// ── PedestrianSystem component ──────────────────────────────
export function PedestrianSystem() {
  const { year } = useEra();
  const [tick, setTick] = useState(0);

  const config = useMemo(() => getEraPedestrianConfig(year), [year]);
  const fleet = useMemo(() => getEraPedestrianFleet(year), [year]);

  // Advance pedestrian positions each frame
  useFrame((_state, delta) => {
    // Update is handled per-body via useFrame inside PedestrianBody
    setTick((n) => n + 1);
  });

  return (
    <group name="pedestrians">
      {fleet.map((p) => (
        <PedestrianBody key={`ped-${p.index}`} pedestrian={p} />
      ))}
    </group>
  );
}

export default PedestrianSystem;
