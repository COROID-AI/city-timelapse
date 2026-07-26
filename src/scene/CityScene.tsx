import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Era, ERAS, getEraByYear } from '../eras';
import { PerformanceSettings } from '../performance/PerformanceManager';
import { CityBlock, BuildingParams, VehicleParams, PedestrianParams } from './CityBlock';
import {
  BuildingInstance,
  VehicleInstance,
  PedestrianInstance,
  StreetLight,
  Bench,
  TrashCan,
  PhoneBox,
  DigitalDisplay,
  EVCharger,
} from './components';
import { AudioManager } from '../audio/AudioManager';
import { WebGLContextManager } from '../webgl/WebGLContextManager';

interface CitySceneProps {
  era: Era;
  progress: number;
  performance: PerformanceSettings;
  audioManager: AudioManager;
  webglManager: WebGLContextManager;
  onSceneReady: () => void;
}

export function CityScene({
  era,
  progress,
  performance,
  audioManager,
  webglManager,
  onSceneReady,
}: CitySceneProps) {
  const cityBlockRef = useRef<CityBlock | null>(null);
  const [buildings, setBuildings] = useState<BuildingParams[]>([]);
  const [vehicles, setVehicles] = useState<VehicleParams[]>([]);
  const [pedestrians, setPedestrians] = useState<PedestrianParams[]>([]);
  const [streetDetails, setStreetDetails] = useState<any>(null);
  const sceneReadyRef = useRef(false);

  // Initialize CityBlock
  useEffect(() => {
    const block = new CityBlock({
      era,
      performance,
      onReady: () => {
        if (!sceneReadyRef.current) {
          sceneReadyRef.current = true;
          onSceneReady();
        }
      },
    });
    cityBlockRef.current = block;

    // Generate initial entities
    const buildingCount = performance.maxBuildings;
    const vehicleCount = Math.floor(performance.maxVehicles * era.trafficDensity);
    const pedestrianCount = Math.floor(performance.maxPedestrians * era.pedestrianDensity);

    const newBuildings = Array.from({ length: buildingCount }, (_, i) => block.getBuildingParams(i));
    const newVehicles = Array.from({ length: vehicleCount }, (_, i) => block.getVehicleParams(i));
    const newPedestrians = Array.from({ length: pedestrianCount }, (_, i) => block.getPedestrianParams(i));
    const newStreetDetails = block.getStreetDetails();

    setBuildings(newBuildings);
    setVehicles(newVehicles);
    setPedestrians(newPedestrians);
    setStreetDetails(newStreetDetails);
    block.markReady();
  }, []);

  // Update era on the CityBlock when it changes
  useEffect(() => {
    if (cityBlockRef.current) {
      cityBlockRef.current.updateEra(era);
    }
  }, [era]);

  // Update performance settings
  useEffect(() => {
    if (cityBlockRef.current) {
      cityBlockRef.current.updatePerformance(performance);
    }
  }, [performance]);

  // Play ambient sound based on era
  useEffect(() => {
    if (audioManager.isUnlocked()) {
      audioManager.stopAmbientLoop('city_ambient');
      const loopName = getAmbientSoundForEra(era);
      audioManager.playAmbientLoop(loopName, 0.3);
    }
  }, [era, audioManager]);

  // Generate building positions in a grid
  const buildingPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    const gridSize = Math.ceil(Math.sqrt(buildings.length));
    const spacing = 15;

    for (let i = 0; i < buildings.length; i++) {
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;
      // Create a city block layout with a street in the middle
      let x = (col - gridSize / 2) * spacing;
      let z = (row - gridSize / 2) * spacing;

      // Leave space for the central street
      if (row === Math.floor(gridSize / 2)) {
        x += col > gridSize / 2 ? 5 : -5;
      }
      if (col === Math.floor(gridSize / 2)) {
        z += row > gridSize / 2 ? 5 : -5;
      }

      positions.push([x, 0, z]);
    }
    return positions;
  }, [buildings.length]);

  // Generate vehicle paths along streets
  const vehiclePaths = useMemo(() => {
    const paths: { start: [number, number, number]; end: [number, number, number] }[] = [];
    const gridSize = Math.ceil(Math.sqrt(buildings.length));
    const spacing = 15;
    const roadWidth = 6;

    // Horizontal roads
    for (let row = 0; row <= gridSize; row++) {
      const z = (row - gridSize / 2) * spacing;
      paths.push({
        start: [-(gridSize * spacing) / 2, 0.1, z],
        end: [(gridSize * spacing) / 2, 0.1, z],
      });
    }

    // Vertical roads
    for (let col = 0; col <= gridSize; col++) {
      const x = (col - gridSize / 2) * spacing;
      paths.push({
        start: [x, 0.1, -(gridSize * spacing) / 2],
        end: [x, 0.1, (gridSize * spacing) / 2],
      });
    }

    return paths;
  }, [buildings.length]);

  // Generate pedestrian paths on sidewalks
  const pedestrianPaths = useMemo(() => {
    const paths: { start: [number, number, number]; end: [number, number, number] }[] = [];
    const gridSize = Math.ceil(Math.sqrt(buildings.length));
    const spacing = 15;

    // Sidewalk paths around buildings
    for (let i = 0; i < pedestrians.length; i++) {
      const buildingIdx = i % buildings.length;
      const row = Math.floor(buildingIdx / gridSize);
      const col = buildingIdx % gridSize;
      const x = (col - gridSize / 2) * spacing;
      const z = (row - gridSize / 2) * spacing;

      // Walk around the building
      const side = i % 4;
      const offset = 8;
      let start: [number, number, number];
      let end: [number, number, number];

      switch (side) {
        case 0:
          start = [x - offset, 0.05, z];
          end = [x + offset, 0.05, z];
          break;
        case 1:
          start = [x, 0.05, z - offset];
          end = [x, 0.05, z + offset];
          break;
        case 2:
          start = [x + offset, 0.05, z];
          end = [x - offset, 0.05, z];
          break;
        default:
          start = [x, 0.05, z + offset];
          end = [x, 0.05, z - offset];
          break;
      }

      paths.push({ start, end });
    }

    return paths;
  }, [pedestrians.length, buildings.length]);

  // Street furniture positions
  const streetFurniture = useMemo(() => {
    if (!streetDetails) return { benches: [], trashCans: [], phoneBoxes: [], digitalDisplays: [], evChargers: [], lights: [] };

    const gridSize = Math.ceil(Math.sqrt(buildings.length));
    const spacing = 15;
    const benches: [number, number, number][] = [];
    const trashCans: [number, number, number][] = [];
    const phoneBoxes: [number, number, number][] = [];
    const digitalDisplays: [number, number, number][] = [];
    const evChargers: [number, number, number][] = [];
    const lights: [number, number, number][] = [];

    // Place street furniture along roads
    for (let i = 0; i < gridSize + 1; i++) {
      const offset = (i - gridSize / 2) * spacing;

      // Horizontal road edges
      if (streetDetails.hasBenches && i % 3 === 0) {
        benches.push([offset, 0.2, -(gridSize * spacing) / 2 - 2]);
        benches.push([offset, 0.2, (gridSize * spacing) / 2 + 2]);
      }
      if (streetDetails.hasTrashCans && i % 2 === 0) {
        trashCans.push([offset, 0.2, -(gridSize * spacing) / 2 - 1.5]);
        trashCans.push([offset, 0.2, (gridSize * spacing) / 2 + 1.5]);
      }
      if (streetDetails.hasPhoneBoxes && era.year <= 2005 && i % 5 === 0) {
        phoneBoxes.push([offset, 0.2, -(gridSize * spacing) / 2 - 1]);
      }
      if (streetDetails.hasDigitalDisplays && era.year >= 2025 && i % 4 === 0) {
        digitalDisplays.push([offset, 2.5, (gridSize * spacing) / 2 + 1]);
      }
      if (streetDetails.hasEVChargers && era.year >= 2025 && i % 3 === 0) {
        evChargers.push([offset, 0.2, -(gridSize * spacing) / 2 - 1.5]);
      }

      // Street lights
      lights.push([offset, 0, -(gridSize * spacing) / 2 - 3]);
      lights.push([offset, 0, (gridSize * spacing) / 2 + 3]);
    }

    // Vertical road edges
    for (let i = 0; i < gridSize + 1; i++) {
      const offset = (i - gridSize / 2) * spacing;

      if (streetDetails.hasBenches && i % 3 === 0) {
        benches.push([-(gridSize * spacing) / 2 - 2, 0.2, offset]);
        benches.push([(gridSize * spacing) / 2 + 2, 0.2, offset]);
      }
      if (streetDetails.hasTrashCans && i % 2 === 0) {
        trashCans.push([-(gridSize * spacing) / 2 - 1.5, 0.2, offset]);
        trashCans.push([(gridSize * spacing) / 2 + 1.5, 0.2, offset]);
      }
      if (streetDetails.hasPhoneBoxes && era.year <= 2005 && i % 5 === 0) {
        phoneBoxes.push([-(gridSize * spacing) / 2 - 1, 0.2, offset]);
      }
      if (streetDetails.hasDigitalDisplays && era.year >= 2025 && i % 4 === 0) {
        digitalDisplays.push([-(gridSize * spacing) / 2 - 1, 2.5, offset]);
      }
      if (streetDetails.hasEVChargers && era.year >= 2025 && i % 3 === 0) {
        evChargers.push([-(gridSize * spacing) / 2 - 1.5, 0.2, offset]);
      }

      lights.push([-(gridSize * spacing) / 2 - 3, 0, offset]);
      lights.push([(gridSize * spacing) / 2 + 3, 0, offset]);
    }

    return { benches, trashCans, phoneBoxes, digitalDisplays, evChargers, lights };
  }, [streetDetails, buildings.length, era.year]);

  // Ground plane
  const groundSize = Math.ceil(Math.sqrt(buildings.length)) * 15 + 20;

  return (
    <>
      {/* Environment lighting */}
      <ambientLight intensity={era.ambient + progress * 0.2} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={0.8}
        castShadow={performance.useShadows}
        shadow-mapSize={[performance.shadowMapSize, performance.shadowMapSize]}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color={era.groundColor} roughness={0.8} />
      </mesh>

      {/* Roads */}
      <Roads
        gridSize={Math.ceil(Math.sqrt(buildings.length))}
        spacing={15}
        era={era}
      />

      {/* Buildings */}
      {buildings.map((params, i) => (
        <group key={`building-${i}`} position={buildingPositions[i]}>
          <BuildingInstance params={params} era={era} progress={progress} />
        </group>
      ))}

      {/* Vehicles */}
      {vehicles.map((params, i) => {
        const path = vehiclePaths[i % vehiclePaths.length];
        return (
          <VehicleInstance
            key={`vehicle-${i}`}
            params={params}
            path={path}
            progress={progress}
          />
        );
      })}

      {/* Pedestrians */}
      {pedestrians.map((params, i) => {
        const path = pedestrianPaths[i] || pedestrianPaths[0];
        return (
          <PedestrianInstance
            key={`pedestrian-${i}`}
            params={params}
            path={path}
          />
        );
      })}

      {/* Street furniture */}
      {streetFurniture.lights.map((pos, i) => (
        <StreetLight
          key={`light-${i}`}
          position={pos}
          era={era}
          type={streetFurniture.lights.length > 0 ? streetDetails?.streetLightType || 'led' : 'led'}
        />
      ))}

      {streetFurniture.benches.map((pos, i) => (
        <Bench key={`bench-${i}`} position={pos} />
      ))}

      {streetFurniture.trashCans.map((pos, i) => (
        <TrashCan key={`trash-${i}`} position={pos} />
      ))}

      {streetFurniture.phoneBoxes.map((pos, i) => (
        <PhoneBox key={`phone-${i}`} position={pos} />
      ))}

      {streetFurniture.digitalDisplays.map((pos, i) => (
        <DigitalDisplay key={`display-${i}`} position={pos} era={era} />
      ))}

      {streetFurniture.evChargers.map((pos, i) => (
        <EVCharger key={`ev-${i}`} position={pos} />
      ))}

      {/* Era label display */}
      <Html
        position={[0, groundSize / 2 + 2, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '18px',
          fontWeight: 'bold',
          fontFamily: 'monospace',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}>
          {era.year} — {era.label}
        </div>
      </Html>

      {/* Orbit controls for navigation */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        maxPolarAngle={Math.PI / 2 - 0.1}
        minDistance={10}
        maxDistance={groundSize * 2}
      />
    </>
  );
}

// --- Roads Component ---

function Roads({ gridSize, spacing, era }: { gridSize: number; spacing: number; era: Era }) {
  const roadSize = (gridSize * spacing) / 2 + 10;

  return (
    <group>
      {/* Horizontal road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.005, 0]}>
        <planeGeometry args={[roadSize * 2, roadSize * 2]} />
        <meshStandardMaterial color="#333333" />
      </mesh>

      {/* Road markings */}
      {era.roadMarkings === 'dashed' && (
        <DashedLineMarkings gridSize={gridSize} spacing={spacing} />
      )}
      {era.roadMarkings === 'digital' && (
        <DigitalLineMarkings gridSize={gridSize} spacing={spacing} era={era} />
      )}
    </group>
  );
}

function DashedLineMarkings({ gridSize, spacing }: { gridSize: number; spacing: number }) {
  const marks: [number, number, number, number, number][] = [];
  const roadLength = (gridSize * spacing) / 2 + 10;

  for (let i = -roadLength; i < roadLength; i += 2) {
    marks.push([i, 0.01, 0, 0.8, 0.05]);
  }

  return (
    <group>
      {marks.map((m, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[m[0], m[1], m[2]]}>
          <boxGeometry args={[m[3], 0.01, m[4]]} />
          <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function DigitalLineMarkings({ gridSize, spacing, era }: { gridSize: number; spacing: number; era: Era }) {
  const lineRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (lineRef.current) {
      const mat = lineRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.3 + Math.sin(clock.elapsedTime * 5) * 0.2;
    }
  });

  const roadLength = (gridSize * spacing) / 2 + 10;

  return (
    <mesh ref={lineRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <planeGeometry args={[roadLength * 2, 0.1]} />
      <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} />
    </mesh>
  );
}

function getAmbientSoundForEra(era: Era): string {
  if (era.year <= 1945) return 'city_ambient_1945';
  if (era.year <= 1965) return 'city_ambient_1965';
  if (era.year <= 1985) return 'city_ambient_1985';
  if (era.year <= 2005) return 'city_ambient_2005';
  if (era.year <= 2025) return 'city_ambient_2025';
  return 'city_ambient_2055';
}
