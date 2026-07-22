// @ts-nocheck
import React, { useRef, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useGLTF, Text, Billboard } from '@react-three/drei';
import { DoubleSide } from 'three';
import { Era, ERA_COLORS } from '../App';
import { useEraTransition } from '../hooks/useEraTransition';

interface CityBlockProps {
  currentEra: Era;
  eraProgress: number;
  isTransitioning: boolean;
}

export function CityBlock({ currentEra, eraProgress, isTransitioning }: CityBlockProps) {
  return (
    <group>
      {/* Ground / street */}
      <Ground currentEra={currentEra} eraProgress={eraProgress} />

      {/* Sidewalks */}
      <Sidewalks currentEra={currentEra} eraProgress={eraProgress} />

      {/* Buildings - 4 main buildings around the block */}
      <Building
        position={[-15, 0, -15]}
        size={[10, 20, 10]}
        currentEra={currentEra}
        eraProgress={eraProgress}
        buildingType="residential"
      />
      <Building
        position={[15, 0, -15]}
        size={[12, 25, 10]}
        currentEra={currentEra}
        eraProgress={eraProgress}
        buildingType="office"
      />
      <Building
        position={[-15, 0, 15]}
        size={[10, 18, 12]}
        currentEra={currentEra}
        eraProgress={eraProgress}
        buildingType="mixed"
      />
      <Building
        position={[15, 0, 15]}
        size={[14, 30, 12]}
        currentEra={currentEra}
        eraProgress={eraProgress}
        buildingType="skyscraper"
      />

      {/* Street furniture & details */}
      <StreetFurniture currentEra={currentEra} eraProgress={eraProgress} />

      {/* Vehicles */}
      <Vehicles currentEra={currentEra} eraProgress={eraProgress} />

      {/* Pedestrians */}
      <Pedestrians currentEra={currentEra} eraProgress={eraProgress} />

      {/* Street lights */}
      <StreetLights currentEra={currentEra} eraProgress={eraProgress} />

      {/* Trees / greenery */}
      <Trees currentEra={currentEra} eraProgress={eraProgress} />

      {/* Signs & billboards */}
      <SignsAndBillboards currentEra={currentEra} eraProgress={eraProgress} />

      {/* Sky scrap / distant city */}
      <DistantCity currentEra={currentEra} eraProgress={eraProgress} />

      {/* Era label in the center */}
      <EraLabel currentEra={currentEra} />
    </group>
  );
}

// ===== GROUND =====
function Ground({ currentEra, eraProgress }: { currentEra: Era; eraProgress: number }) {
  const groundColor = useMemo(() => {
    const colors: Record<Era, string> = {
      '1945': '#5D4037', // Brown - dirt/rationed
      '1965': '#8D6E63', // Tan - early asphalt
      '1985': '#424242', // Gray - asphalt
      '2005': '#37474F', // Dark gray - modern asphalt
      '2025': '#263238', // Charcoal - smart pavement
      '2055': '#0D1B2A', // Deep blue-black - energy-absorbing
    };
    return colors[currentEra];
  }, [currentEra]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
      <planeGeometry args={[120, 120]} />
      <meshStandardMaterial color={groundColor} />
    </mesh>
  );
}

// ===== SIDEWALKS =====
function Sidewalks({ currentEra, eraProgress }: { currentEra: Era; eraProgress: number }) {
  const sidewalkColor = useMemo(() => {
    const colors: Record<Era, string> = {
      '1945': '#A1887F',
      '1965': '#BCAAA4',
      '1985': '#9E9E9E',
      '2005': '#BDBDBD',
      '2025': '#E0E0E0',
      '2055': '#B2EBF2',
    };
    return colors[currentEra];
  }, [currentEra]);

  const sidewalkWidth = 4;

  return (
    <group>
      {/* Four sidewalk strips around the block */}
      {[[0, -40, 0, [120, 8]], [0, 40, 0, [120, 8]], [0, 0, -40, [8, 120]], [0, 0, 40, [8, 120]]].map(
        ([x, y, z, size], i) => (
          <mesh key={i} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={size as [number, number]} />
            <meshStandardMaterial color={sidewalkColor} />
          </mesh>
        )
      )}
    </group>
  );
}

// ===== BUILDING =====
interface BuildingProps {
  position: [number, number, number];
  size: [number, number, number];
  currentEra: Era;
  eraProgress: number;
  buildingType: 'residential' | 'office' | 'mixed' | 'skyscraper';
}

function Building({ position, size, currentEra, eraProgress, buildingType }: BuildingProps) {
  const [hovered, setHovered] = React.useState(false);
  const meshRef = useRef<THREE.Group>(null!);

  const buildingData = useMemo(() => {
    const data: Record<Era, {
      height: number;
      color: string;
      windows: boolean;
      windowColor: string;
      roofType: 'flat' | 'peak' | 'dome';
      facade: 'brick' | 'glass' | 'concrete' | 'metal';
      details: string[];
    }> = {
      '1945': {
        height: 1,
        color: '#8D6E63',
        windows: true,
        windowColor: '#FFEB3B',
        roofType: 'peak',
        facade: 'brick',
        details: ['chimney', 'fire-escape'],
      },
      '1965': {
        height: 1.2,
        color: '#6D4C41',
        windows: true,
        windowColor: '#FFEB3B',
        roofType: 'flat',
        facade: 'concrete',
        details: ['fire-escape', 'antenna'],
      },
      '1985': {
        height: 1.5,
        color: '#546E7A',
        windows: true,
        windowColor: '#00E676',
        roofType: 'flat',
        facade: 'glass',
        details: ['antenna', 'neon-sign'],
      },
      '2005': {
        height: 2,
        color: '#455A64',
        windows: true,
        windowColor: '#4FC3F7',
        roofType: 'flat',
        facade: 'glass',
        details: ['antenna', 'led-sign', 'solar-panels'],
      },
      '2025': {
        height: 2.5,
        color: '#37474F',
        windows: true,
        windowColor: '#00E676',
        roofType: 'flat',
        facade: 'glass',
        details: ['led-sign', 'solar-panels', 'drones'],
      },
      '2055': {
        height: 3.5,
        color: '#00BCD4',
        windows: true,
        windowColor: '#FF4081',
        roofType: 'dome',
        facade: 'metal',
        details: ['led-sign', 'solar-panels', 'drones', 'hologram'],
      },
    };
    return data;
  }, []);

  const data = buildingData[currentEra];
  const height = size[1] * data.height;

  return (
    <group ref={meshRef} position={position}>
      {/* Main building body */}
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[size[0], height, size[2]]} />
        <meshStandardMaterial
          color={data.color}
          roughness={0.7}
          metalness={0.1}
          emissive={hovered ? data.windowColor : data.color}
          emissiveIntensity={hovered ? 0.3 : 0}
        />
      </mesh>

      {/* Windows */}
      {data.windows && (
        <BuildingWindows
          size={[size[0], height, size[2]]}
          windowColor={data.windowColor}
          era={currentEra}
        />
      )}

      {/* Roof */}
      <BuildingRoof
        size={[size[0], size[2]]}
        height={height}
        roofType={data.roofType}
        era={currentEra}
      />

      {/* Details */}
      {data.details.map((detail, i) => (
        <BuildingDetail
          key={detail}
          detail={detail}
          size={[size[0], height, size[2]]}
          era={currentEra}
        />
      ))}

      {/* Hover label */}
      {hovered && (
        <Billboard
          position={[0, height + 2, 0]}
          follow={true}
          lockX={false}
          lockY={false}
          lockZ={false}
        >
          <Html distanceFactor={10} position={[0, 0, 0]}>
            <div className="era-popup">
              {buildingType} Building
            </div>
          </Html>
        </Billboard>
      )}
    </group>
  );
}

// ===== BUILDING WINDOWS =====
function BuildingWindows({
  size,
  windowColor,
  era,
}: {
  size: [number, number, number];
  windowColor: string;
  era: Era;
}) {
  const [width, height, depth] = size;
  const windowRows = Math.floor(height / 1.5);
  const windowCols = Math.floor(width / 1.5);
  const windowSize = 0.4;

  const windowEmissive = useMemo(() => {
    const lit: Record<Era, number> = {
      '1945': 0.3,
      '1965': 0.4,
      '1985': 0.6,
      '2005': 0.7,
      '2025': 0.8,
      '2055': 1.0,
    };
    return lit[era];
  }, [era]);

  const windows = [];
  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < windowCols; col++) {
      const x = -width / 2 + 1 + col * 1.5;
      const y = height * 0.3 + row * 1.5;
      const z = depth / 2 + 0.01;
      const isLit = Math.random() > 0.3;
      windows.push(
        <mesh key={`${row}-${col}`} position={[x, y, z]}>
          <planeGeometry args={[windowSize, windowSize]} />
          <meshStandardMaterial
            color={isLit ? windowColor : '#111'}
            opacity={isLit ? 0.9 : 0.3}
            transparent
            emissive={isLit ? windowColor : '#000'}
            emissiveIntensity={isLit ? windowEmissive : 0}
            depthWrite={false}
          />
        </mesh>
      );
    }
  }

  return <group>{windows}</group>;
}

// ===== BUILDING ROOF =====
function BuildingRoof({
  size,
  height,
  roofType,
  era,
}: {
  size: [number, number];
  height: number;
  roofType: 'flat' | 'peak' | 'dome';
  era: Era;
}) {
  const [width, depth] = size;

  if (roofType === 'flat') {
    return (
      <mesh position={[0, height, 0]} receiveShadow>
        <boxGeometry args={[width, 0.3, depth]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    );
  }

  if (roofType === 'peak') {
    return (
      <mesh position={[0, height + 1, 0]} receiveShadow>
        <coneGeometry args={[width / 2, 2, 4]} />
        <meshStandardMaterial color="#5D4037" />
      </mesh>
    );
  }

  // Dome
  return (
    <mesh position={[0, height + 1, 0]} receiveShadow>
      <sphereGeometry args={[width / 2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#00BCD4" metalness={0.8} />
    </mesh>
  );
}

// ===== BUILDING DETAILS =====
function BuildingDetail({
  detail,
  size,
  era,
}: {
  detail: string;
  size: [number, number, number];
  era: Era;
}) {
  const [width, height, depth] = size;

  switch (detail) {
    case 'chimney':
      return (
        <mesh position={[-width / 3, height + 0.5, -depth / 3]} castShadow>
          <boxGeometry args={[0.5, 1, 0.5]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      );

    case 'fire-escape':
      return (
        <group position={[width / 2 - 0.2, height * 0.4, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.1, height * 0.5, 0.1]} />
            <meshStandardMaterial color="#555" metalness={0.8} />
          </mesh>
          <mesh position={[0, height * 0.25, 0]} castShadow>
            <boxGeometry args={[1, 0.1, 0.1]} />
            <meshStandardMaterial color="#555" metalness={0.8} />
          </mesh>
        </group>
      );

    case 'antenna':
      return (
        <group position={[0, height + 0.5, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.05, 0.05, 3, 8]} />
            <meshStandardMaterial color="#999" metalness={0.9} />
          </mesh>
          {Array.from({ length: 3 }).map((_, i) => (
            <mesh key={i} position={[0, 1.5 - i * 0.5, 0]} castShadow>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
            </mesh>
          ))}
        </group>
      );

    case 'neon-sign':
      return (
        <mesh position={[0, height * 0.7, depth / 2 + 0.1]}>
          <planeGeometry args={[3, 1]} />
          <meshStandardMaterial color="#FF0080" emissive="#FF0080" emissiveIntensity={0.8} />
        </mesh>
      );

    case 'led-sign':
      return (
        <mesh position={[0, height * 0.7, depth / 2 + 0.1]}>
          <planeGeometry args={[4, 1.5]} />
          <meshStandardMaterial
            color="#00FF00"
            emissive="#00FF00"
            emissiveIntensity={0.6}
            roughness={0.2}
          />
        </mesh>
      );

    case 'solar-panels':
      return (
        <group position={[0, height + 0.3, 0]}>
          <mesh castShadow>
            <boxGeometry args={[2, 0.1, 1]} />
            <meshStandardMaterial color="#111" metalness={0.9} />
          </mesh>
          <mesh position={[2.1, 0, 0]} castShadow>
            <boxGeometry args={[2, 0.1, 1]} />
            <meshStandardMaterial color="#111" metalness={0.9} />
          </mesh>
        </group>
      );

    case 'drones':
      return (
        <group position={[0, height + 3, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.1, 8]} />
            <meshStandardMaterial color="#FF4081" metalness={0.5} />
          </mesh>
          {Array.from({ length: 4 }).map((_, i) => {
            const angle = (i / 4) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.05, 0.05, 0.3, 8]} />
                  <meshStandardMaterial color="#333" />
                </mesh>
                <mesh position={[0, 0, 0]}>
                  <sphereGeometry args={[0.05, 8, 8]} />
                  <meshStandardMaterial color="#00FF00" emissive="#00FF00" emissiveIntensity={0.5} />
                </mesh>
              </group>
            );
          })}
        </group>
      );

    case 'hologram':
      return (
        <group position={[0, height + 5, 0]}>
          <mesh>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial
              color="#FF4081"
              emissive="#FF4081"
              emissiveIntensity={0.8}
              roughness={0}
              metalness={0}
              transparent
              opacity={0.6}
            />
          </mesh>
        </group>
      );

    default:
      return null;
  }
}

// ===== STREET FURNITURE =====
function StreetFurniture({ currentEra, eraProgress }: { currentEra: Era; eraProgress: number }) {
  const benchCount = 4;
  const benchPositions: [number, number, number][] = [
    [-8, 0, -5],
    [8, 0, -5],
    [-8, 0, 5],
    [8, 0, 5],
  ];

  const benchColor = useMemo(() => {
    const colors: Record<Era, string> = {
      '1945': '#5D4037',
      '1965': '#6D4C41',
      '1985': '#424242',
      '2005': '#37474F',
      '2025': '#263238',
      '2055': '#0D1B2A',
    };
    return colors[currentEra];
  }, [currentEra]);

  return (
    <group>
      {benchPositions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
            <boxGeometry args={[3, 0.5, 0.5]} />
            <meshStandardMaterial color={benchColor} />
          </mesh>
          <mesh castShadow position={[-1.4, 0.25, 0]}>
            <boxGeometry args={[0.1, 0.5, 0.1]} />
            <meshStandardMaterial color={benchColor} />
          </mesh>
          <mesh castShadow position={[1.4, 0.25, 0]}>
            <boxGeometry args={[0.1, 0.5, 0.1]} />
            <meshStandardMaterial color={benchColor} />
          </mesh>
        </group>
      ))}

      {/* Trash cans */}
      {[[5, 0, -8], [-5, 0, 8]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.8, 8]} />
          <meshStandardMaterial
            color={currentEra === '2055' ? '#00BCD4' : '#555'}
            metalness={currentEra === '2055' ? 0.5 : 0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

// ===== VEHICLES =====
function Vehicles({ currentEra, eraProgress }: { currentEra: Era; eraProgress: number }) {
  const vehicleCount = 6;
  const vehiclePositions: [number, number, number][] = [
    [-25, 0, -10],
    [-10, 0, -25],
    [10, 0, -25],
    [25, 0, -10],
    [25, 0, 10],
    [10, 0, 25],
  ];

  return (
    <group>
      {vehiclePositions.map((pos, i) => (
        <Vehicle key={i} position={pos} era={currentEra} vehicleIndex={i} />
      ))}
    </group>
  );
}

function Vehicle({ position, era, vehicleIndex }: { position: [number, number, number]; era: Era; vehicleIndex: number }) {
  const vehicleData = useMemo(() => {
    const data: Record<Era, {
      type: 'car' | 'truck' | 'bus' | 'hover' | 'flying';
      color: string;
      size: [number, number, number];
      detail: string;
    }> = {
      '1945': { type: 'car', color: '#8B0000', size: [3, 1.5, 1.5], detail: 'vintage' },
      '1965': { type: 'car', color: '#0000FF', size: [4, 1.5, 1.8], detail: 'classic' },
      '1985': { type: 'car', color: '#FF0000', size: [4, 1.5, 1.8], detail: 'muscle' },
      '2005': { type: 'car', color: '#00FF00', size: [4.5, 1.5, 1.8], detail: 'modern' },
      '2025': { type: 'car', color: '#00BFFF', size: [4.5, 1.5, 1.8], detail: 'electric' },
      '2055': { type: 'hover', color: '#FF4081', size: [4.5, 1, 1.8], detail: 'futuristic' },
    };
    return data;
  }, []);

  const data = vehicleData[era];
  const [width, height, depth] = data.size;

  return (
    <group position={[position[0], height / 2 + 0.01, position[2]]}>
      {/* Main body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={data.color} metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Wheels */}
      {data.type !== 'hover' && (
        <group>
          {[[-(width / 2 - 0.5), -height / 2 - 0.2, depth / 2 - 0.3],
            [-(width / 2 - 0.5), -height / 2 - 0.2, -depth / 2 + 0.3],
            [width / 2 - 0.5, -height / 2 - 0.2, depth / 2 - 0.3],
            [width / 2 - 0.5, -height / 2 - 0.2, -depth / 2 + 0.3]].map((w, i) => (
            <mesh key={i} position={w as [number, number, number]} castShadow>
              <cylinderGeometry args={[0.3, 0.3, 0.3, 16]} rotation={[0, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#111" />
            </mesh>
          ))}
        </group>
      )}

      {/* Hover effect for 2055 */}
      {data.type === 'hover' && (
        <mesh position={[0, -height / 2 - 0.1, 0]}>
          <cylinderGeometry args={[width / 2 + 0.5, width / 2 + 0.5, 0.1, 16]} />
          <meshStandardMaterial
            color={data.color}
            emissive={data.color}
            emissiveIntensity={0.5}
            transparent
            opacity={0.4}
          />
        </mesh>
      )}

      {/* Windshield */}
      <mesh position={[0, height * 0.2, depth / 2 + 0.01]} castShadow>
        <boxGeometry args={[width * 0.6, height * 0.4, 0.05]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

// ===== PEDESTRIANS =====
function Pedestrians({ currentEra, eraProgress }: { currentEra: Era; eraProgress: number }) {
  const pedestrianCount = 8;
  const [pedestrians, setPedestrians] = React.useState<
    { position: [number, number, number]; direction: number; speed: number }[]
  >([]);

  React.useEffect(() => {
    const newPeds = [];
    for (let i = 0; i < pedestrianCount; i++) {
      newPeds.push({
        position: [
          (Math.random() - 0.5) * 30,
          0,
          (Math.random() - 0.5) * 30,
        ] as [number, number, number],
        direction: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
      });
    }
    setPedestrians(newPeds);
  }, [currentEra]);

  return (
    <group>
      {pedestrians.map((ped, i) => (
        <Pedestrian
          key={`${currentEra}-${i}`}
          position={ped.position}
          direction={ped.direction}
          speed={ped.speed}
          era={currentEra}
          index={i}
        />
      ))}
    </group>
  );
}

function Pedestrian({
  position,
  direction,
  speed,
  era,
  index,
}: {
  position: [number, number, number];
  direction: number;
  speed: number;
  era: Era;
  index: number;
}) {
  const meshRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime * speed + index * 10;
    meshRef.current.position.x = position[0] + Math.cos(t * 0.3 + direction) * 3;
    meshRef.current.position.z = position[2] + Math.sin(t * 0.2 + direction) * 3;
    meshRef.current.rotation.y = Math.sin(t * 0.3 + direction) * 0.3;
  });

  const outfitColor = useMemo(() => {
    const colors: Record<Era, string> = {
      '1945': '#2C1810', // Dark - wartime clothing
      '1965': '#FF6B35', // Orange - 60s fashion
      '1985': '#4ECDC4', // Teal - 80s neon
      '2005': '#45B7D1', // Blue - casual
      '2025': '#96CEB4', // Mint - modern athleisure
      '2055': '#FF4081', // Pink - futuristic
    };
    return colors[era];
  }, [era]);

  return (
    <group ref={meshRef} position={position}>
      {/* Body */}
      <mesh castShadow position={[0, 0.8, 0]}>
        <boxGeometry args={[0.4, 0.8, 0.2]} />
        <meshStandardMaterial color={outfitColor} />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#F9D9B7" />
      </mesh>
      {/* Arms */}
      <mesh castShadow position={[-0.3, 0.7, 0]}>
        <boxGeometry args={[0.1, 0.6, 0.1]} />
        <meshStandardMaterial color={outfitColor} />
      </mesh>
      <mesh castShadow position={[0.3, 0.7, 0]}>
        <boxGeometry args={[0.1, 0.6, 0.1]} />
        <meshStandardMaterial color={outfitColor} />
      </mesh>
      {/* Legs */}
      <mesh castShadow position={[-0.1, 0.3, 0]}>
        <boxGeometry args={[0.25, 0.6, 0.2]} />
        <meshStandardMaterial color={outfitColor === '#2C1810' ? '#1a0d05' : '#333'} />
      </mesh>
      <mesh castShadow position={[0.1, 0.3, 0]}>
        <boxGeometry args={[0.25, 0.6, 0.2]} />
        <meshStandardMaterial color={outfitColor === '#2C1810' ? '#1a0d05' : '#333'} />
      </mesh>
    </group>
  );
}

// ===== STREET LIGHTS =====
function StreetLights({ currentEra, eraProgress }: { currentEra: Era; eraProgress: number }) {
  const lightPositions: [number, number, number][] = [
    [-20, 0, -20],
    [20, 0, -20],
    [-20, 0, 20],
    [20, 0, 20],
  ];

  const poleHeight = useMemo(() => {
    const heights: Record<Era, number> = {
      '1945': 5,
      '1965': 6,
      '1985': 7,
      '2005': 8,
      '2025': 9,
      '2055': 10,
    };
    return heights[currentEra];
  }, [currentEra]);

  const lightColor = useMemo(() => {
    const colors: Record<Era, string> = {
      '1945': '#FFEB3B', // Yellow - incandescent
      '1965': '#FFEB3B',
      '1985': '#00FF00', // Green - sodium vapor
      '2005': '#FFF', // White LED
      '2025': '#4FC3F7', // Cool white
      '2055': '#00BCD4', // Cyan - smart LED
    };
    return colors[currentEra];
  }, [currentEra]);

  return (
    <group>
      {lightPositions.map((pos, i) => (
        <group key={i} position={pos}>
          {/* Pole */}
          <mesh castShadow receiveShadow position={[0, poleHeight / 2, 0]}>
            <cylinderGeometry args={[0.1, 0.1, poleHeight, 8]} />
            <meshStandardMaterial color="#555" metalness={0.5} />
          </mesh>
          {/* Light fixture */}
          <mesh castShadow position={[0, poleHeight - 0.5, 0]}>
            <boxGeometry args={[0.5, 0.3, 0.5]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          {/* Light glow */}
          <pointLight
            position={[0, poleHeight - 0.5, 0]}
            color={lightColor}
            intensity={currentEra === '2055' ? 2 : 1}
            distance={15}
            decay={2}
          />
          <mesh position={[0, poleHeight - 0.7, 0]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshBasicMaterial
              color={lightColor}
              transparent
              opacity={0.3}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ===== TREES =====
function Trees({ currentEra, eraProgress }: { currentEra: Era; eraProgress: number }) {
  const treePositions: [number, number, number][] = [
    [-30, 0, -5],
    [30, 0, 5],
    [-5, 0, -30],
    [5, 0, 30],
    [-25, 0, 25],
    [25, 0, -25],
  ];

  return (
    <group>
      {treePositions.map((pos, i) => (
        <Tree key={i} position={pos} era={currentEra} />
      ))}
    </group>
  );
}

function Tree({ position, era }: { position: [number, number, number]; era: Era }) {
  const trunkHeight = 2;
  const trunkRadius = 0.3;

  const foliageColor = useMemo(() => {
    const colors: Record<Era, string> = {
      '1945': '#2E7D32',
      '1965': '#388E3C',
      '1985': '#4CAF50',
      '2005': '#66BB6A',
      '2025': '#81C784',
      '2055': '#4DB6AC',
    };
    return colors[era];
  }, [era]);

  const trunkColor = '#8D6E63';

  return (
    <group position={position}>
      {/* Trunk */}
      <mesh castShadow receiveShadow position={[0, trunkHeight / 2, 0]}>
        <cylinderGeometry args={[trunkRadius, trunkRadius + 0.1, trunkHeight, 8]} />
        <meshStandardMaterial color={trunkColor} />
      </mesh>
      {/* Foliage - multiple layers */}
      {[0, 1.5, 3].map((y, i) => (
        <mesh key={i} castShadow position={[0, trunkHeight + y, 0]}>
          <sphereGeometry args={[1.5 - y * 0.3, 16, 16]} />
          <meshStandardMaterial color={foliageColor} />
        </mesh>
      ))}
    </group>
  );
}

// ===== SIGNS & BILLBOARDS =====
function SignsAndBillboards({ currentEra, eraProgress }: { currentEra: Era; eraProgress: number }) {
  const signData = useMemo(() => {
    const data: Record<Era, { text: string; color: string; size: [number, number] }> = {
      '1945': { text: 'GOODS', color: '#8B0000', size: [2, 1] },
      '1965': { text: 'COFFEE', color: '#673AB7', size: [3, 1.5] },
      '1985': { text: 'VIDEO', color: '#FF0000', size: [4, 2] },
      '2005': { text: 'CAFE', color: '#4CAF50', size: [4, 2] },
      '2025': { text: 'SMART', color: '#00BCD4', size: [5, 2.5] },
      '2055': { text: 'NEON', color: '#FF4081', size: [6, 3] },
    };
    return data;
  }, [currentEra]);

  const data = signData[currentEra];

  return (
    <group>
      {/* Storefront signs */}
      {[[15, 3, -15], [-15, 3, 15], [15, 4, 15]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <mesh castShadow position={[0, 0, 0.1]}>
            <planeGeometry args={data.size} />
            <meshStandardMaterial
              color={data.color}
              emissive={data.color}
              emissiveIntensity={currentEra === '2055' ? 0.8 : 0.3}
            />
          </mesh>
        </group>
      ))}

      {/* Billboard */}
      <group position={[0, 15, -35]}>
        <mesh castShadow position={[0, 0, 0.1]}>
          <planeGeometry args={[10, 5]} />
          <meshStandardMaterial
            color={data.color}
            emissive={data.color}
            emissiveIntensity={currentEra === '2055' ? 1 : 0.5}
            transparent
            opacity={0.9}
          />
        </mesh>
        <mesh position={[0, 0, -0.1]}>
          <planeGeometry args={[10, 5]} />
          <meshStandardMaterial
            color={data.color}
            emissive={data.color}
            emissiveIntensity={0.2}
            side={DoubleSide}
            transparent
            opacity={0.5}
          />
        </mesh>
      </group>
    </group>
  );
}

// ===== DISTANT CITY =====
function DistantCity({ currentEra, eraProgress }: { currentEra: Era; eraProgress: number }) {
  const buildingCount = 20;
  const buildings = useMemo(() => {
    return Array.from({ length: buildingCount }).map((_, i) => ({
      position: [
        (Math.random() - 0.5) * 200,
        0,
        -50 - Math.random() * 50,
      ] as [number, number, number],
      height: 5 + Math.random() * 30,
      width: 3 + Math.random() * 8,
      depth: 3 + Math.random() * 8,
    }));
  }, []);

  const buildingColor = useMemo(() => {
    const colors: Record<Era, string> = {
      '1945': '#8D6E63',
      '1965': '#6D4C41',
      '1985': '#546E7A',
      '2005': '#455A64',
      '2025': '#37474F',
      '2055': '#00BCD4',
    };
    return colors[currentEra];
  }, [currentEra]);

  return (
    <group>
      {buildings.map((b, i) => (
        <mesh key={i} position={[b.position[0], b.height / 2, b.position[2]]} receiveShadow>
          <boxGeometry args={[b.width, b.height, b.depth]} />
          <meshStandardMaterial color={buildingColor} />
        </mesh>
      ))}
    </group>
  );
}

// ===== ERA LABEL =====
function EraLabel({ currentEra }: { currentEra: Era }) {
  return (
    <Html
      position={[0, 25, 0]}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      distanceFactor={20}
    >
      <div className="era-label">
        {currentEra}
      </div>
    </Html>
  );
}
