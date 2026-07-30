import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useEra } from '../contexts/EraContext';
import type { EraYear } from '../types';

// ── Street path definitions ─────────────────────────────
export interface StreetPath {
  name: string;
  points: Array<[number, number, number]>;
  laneCount: number;
  sidewalkWidth: number;
  hasRail: boolean;
  trackWidth: number;
}

export const MAIN_STREETS: StreetPath[] = [
  {
    name: 'Avenue A',
    points: [[-50, 0, -30], [50, 0, -30]],
    laneCount: 2,
    sidewalkWidth: 4,
    hasRail: false,
    trackWidth: 0,
  },
  {
    name: 'Broadway',
    points: [[-30, 0, -50], [-30, 0, 50]],
    laneCount: 2,
    sidewalkWidth: 4,
    hasRail: true,
    trackWidth: 3,
  },
  {
    name: 'Central Blvd',
    points: [[-50, 0, 0], [50, 0, 0]],
    laneCount: 3,
    sidewalkWidth: 5,
    hasRail: false,
    trackWidth: 0,
  },
  {
    name: 'Market St',
    points: [[0, 0, -50], [0, 0, 50]],
    laneCount: 2,
    sidewalkWidth: 4,
    hasRail: true,
    trackWidth: 2.5,
  },
];

// ── Era-specific vehicle fleet definitions ────────────
interface VehicleDefinition {
  type: 'tram' | 'vintageCar' | 'muscleCar' | 'deLorean' | 'suv' | 'bus' | 'ev' | 'autonomousPod' | 'maglev' | 'flyingVehicle';
  color: number;
  scale: [number, number, number];
  speed: number;
  spawnWeight: number;
}

function getEraVehicleFleet(year: EraYear): VehicleDefinition[] {
  switch (year) {
    case 1945:
      return [
        { type: 'tram', color: 0x8b4513, scale: [1, 0.8, 2.5], speed: 0.02, spawnWeight: 4 },
        { type: 'vintageCar', color: 0x2e5a88, scale: [0.8, 0.6, 1.6], speed: 0.03, spawnWeight: 3 },
        { type: 'vintageCar', color: 0x882e2e, scale: [0.8, 0.6, 1.6], speed: 0.035, spawnWeight: 2 },
        { type: 'vintageCar', color: 0x5a882e, scale: [0.8, 0.6, 1.6], speed: 0.03, spawnWeight: 1 },
      ];
    case 1965:
      return [
        { type: 'muscleCar', color: 0xcc3333, scale: [0.9, 0.5, 1.8], speed: 0.045, spawnWeight: 4 },
        { type: 'muscleCar', color: 0x33cc33, scale: [0.9, 0.5, 1.8], speed: 0.04, spawnWeight: 3 },
        { type: 'muscleCar', color: 0x3333cc, scale: [0.9, 0.5, 1.8], speed: 0.042, spawnWeight: 2 },
        { type: 'bus', color: 0xffcc00, scale: [1.2, 1.0, 3.0], speed: 0.015, spawnWeight: 2 },
      ];
    case 1985:
      return [
        { type: 'muscleCar', color: 0xff4444, scale: [0.9, 0.5, 1.8], speed: 0.05, spawnWeight: 3 },
        { type: 'deLorean', color: 0x444444, scale: [0.85, 0.45, 1.7], speed: 0.04, spawnWeight: 3 },
        { type: 'deLorean', color: 0x888888, scale: [0.85, 0.45, 1.7], speed: 0.04, spawnWeight: 2 },
        { type: 'suv', color: 0x555555, scale: [1.0, 0.7, 2.0], speed: 0.035, spawnWeight: 2 },
        { type: 'bus', color: 0x2255aa, scale: [1.3, 1.1, 3.2], speed: 0.018, spawnWeight: 1 },
      ];
    case 2005:
      return [
        { type: 'suv', color: 0x336699, scale: [1.0, 0.7, 2.0], speed: 0.04, spawnWeight: 4 },
        { type: 'suv', color: 0x663399, scale: [1.0, 0.7, 2.0], speed: 0.038, spawnWeight: 3 },
        { type: 'bus', color: 0x0099cc, scale: [1.4, 1.2, 3.5], speed: 0.015, spawnWeight: 2 },
        { type: 'ev', color: 0x88cc88, scale: [0.85, 0.55, 1.7], speed: 0.04, spawnWeight: 3 },
        { type: 'muscleCar', color: 0xddaa33, scale: [0.9, 0.5, 1.8], speed: 0.04, spawnWeight: 1 },
      ];
    case 2025:
      return [
        { type: 'ev', color: 0xddeeff, scale: [0.85, 0.55, 1.7], speed: 0.045, spawnWeight: 4 },
        { type: 'ev', color: 0xaaeeff, scale: [0.85, 0.55, 1.7], speed: 0.042, spawnWeight: 3 },
        { type: 'autonomousPod', color: 0xffffff, scale: [0.8, 0.6, 1.5], speed: 0.05, spawnWeight: 3 },
        { type: 'autonomousPod', color: 0xeeeeff, scale: [0.8, 0.6, 1.5], speed: 0.048, spawnWeight: 2 },
        { type: 'bus', color: 0x22cc66, scale: [1.4, 1.3, 3.5], speed: 0.012, spawnWeight: 1 },
      ];
    case 2055:
      return [
        { type: 'maglev', color: 0x4488ff, scale: [1.2, 0.3, 2.5], speed: 0.06, spawnWeight: 4 },
        { type: 'maglev', color: 0x8844ff, scale: [1.2, 0.3, 2.5], speed: 0.055, spawnWeight: 3 },
        { type: 'flyingVehicle', color: 0xaaaaff, scale: [0.9, 0.4, 1.2], speed: 0.05, spawnWeight: 3 },
        { type: 'flyingVehicle', color: 0xffaaff, scale: [0.9, 0.4, 1.2], speed: 0.048, spawnWeight: 2 },
        { type: 'autonomousPod', color: 0x66ffcc, scale: [0.85, 0.55, 1.5], speed: 0.055, spawnWeight: 2 },
      ];
  }
}

// ── Street geometry multipliers per era ─────────────────
export interface StreetGeometryConfig {
  laneCount: number;
  sidewalkWidth: number;
  hasRail: boolean;
  trackWidth: number;
}

function getEraStreetGeometry(
  year: EraYear
): { laneMultiplier: number; sidewalkMultiplier: number; railWidthMultiplier: number } {
  switch (year) {
    case 1945:
      return { laneMultiplier: 0.8, sidewalkMultiplier: 0.7, railWidthMultiplier: 1.0 };
    case 1965:
      return { laneMultiplier: 1.0, sidewalkMultiplier: 0.9, railWidthMultiplier: 0.8 };
    case 1985:
      return { laneMultiplier: 1.1, sidewalkMultiplier: 1.0, railWidthMultiplier: 0.7 };
    case 2005:
      return { laneMultiplier: 1.2, sidewalkMultiplier: 1.1, railWidthMultiplier: 0.5 };
    case 2025:
      return { laneMultiplier: 1.3, sidewalkMultiplier: 1.2, railWidthMultiplier: 0.3 };
    case 2055:
      return { laneMultiplier: 1.5, sidewalkMultiplier: 1.5, railWidthMultiplier: 0.2 };
  }
}

// ── Vehicle dimensions helper ──────────────────────
function vehicleDimensions(
  type: VehicleDefinition['type'],
  scale: [number, number, number]
): [number, number, number] {
  switch (type) {
    case 'tram':
      return [scale[0], scale[1], scale[2]];
    case 'vintageCar':
      return [scale[0], scale[1], scale[2]];
    case 'muscleCar':
      return [scale[0], scale[1], scale[2]];
    case 'deLorean':
      return [scale[0], scale[1], scale[2]];
    case 'suv':
      return [scale[0], scale[1], scale[2]];
    case 'bus':
      return [scale[0], scale[1], scale[2]];
    case 'ev':
      return [scale[0], scale[1], scale[2]];
    case 'autonomousPod':
      return [scale[0] * 0.5, scale[1] * 0.5, scale[2] * 0.5];
    case 'maglev':
      return [scale[0] * 1.2, scale[1], scale[2] * 0.8];
    case 'flyingVehicle':
      return [scale[0], scale[1], scale[2]];
  }
}

// ── VehicleSystem component ────────────────────────
export function VehicleSystem({ year: yearProp, streetPaths }: { year?: EraYear; streetPaths?: StreetPath[] }) {
  const { year } = useEra();
  const effectiveYear = yearProp ?? year;
  const [, setTick] = useState(0);
  const vehicleRefs = useRef<Map<string, { progress: number; direction: number }>>(new Map());
  const streets = useMemo(() => streetPaths ?? MAIN_STREETS, [streetPaths]);
  const streetGeometryConfig = useMemo(() => getEraStreetGeometry(effectiveYear), [effectiveYear]);
  const fleet = useMemo(() => getEraVehicleFleet(effectiveYear), [effectiveYear]);

  // Advance vehicle progress each frame and trigger re-render for smooth animation
  useFrame((_state, delta) => {
    vehicleRefs.current.forEach((ref) => {
      ref.progress += delta * 0.5 * ref.direction;
      if (ref.progress > 1) {
        ref.progress = 0;
        ref.direction = -1;
      } else if (ref.progress < 0) {
        ref.progress = 1;
        ref.direction = 1;
      }
    });
    setTick((n) => n + 1);
  });

  // Build per-street vehicle placement data
  const vehiclePlacements = useMemo(() => {
    const placements: Array<{
      key: string;
      definition: VehicleDefinition;
      streetIndex: number;
      progress: number;
      direction: number;
      speed: number;
      lateralOffset: number;
    }> = [];

    fleet.forEach((def, defIdx) => {
      const count = Math.round(def.spawnWeight * 2);
      for (let i = 0; i < count; i++) {
        const streetIdx = i % streets.length;
        const street = streets[streetIdx];
        const side = i % 2 === 0 ? -1 : 1;

        const effectiveLaneCount = Math.max(1, Math.round(street.laneCount * streetGeometryConfig.laneMultiplier));
        const effectiveSidewalkWidth = Math.max(0.5, street.sidewalkWidth * streetGeometryConfig.sidewalkMultiplier);
        const roadWidth = effectiveLaneCount * 3 + effectiveSidewalkWidth * 2;
        const laneWidth = roadWidth / effectiveLaneCount;

        const key = `${defIdx}-${i}`;
        const existingRef = vehicleRefs.current.get(key);

        placements.push({
          key,
          definition: def,
          streetIndex: streetIdx,
          progress: existingRef?.progress ?? i / Math.max(1, count),
          direction: existingRef?.direction ?? side,
          speed: def.speed,
          lateralOffset: side * (laneWidth * 0.5),
        });
      }
    });

    return placements;
  }, [fleet, streets, streetGeometryConfig]);

  // Initialize refs for new vehicles
  useMemo(() => {
    vehiclePlacements.forEach((p) => {
      if (!vehicleRefs.current.has(p.key)) {
        vehicleRefs.current.set(p.key, { progress: p.progress, direction: p.direction });
      }
    });
  }, [vehiclePlacements]);

  return (
    <>
      {/* Street geometry: road surface, lane markings, sidewalks, rails */}
      {streets.map((street, streetIdx) => {
        const p0 = street.points[0];
        const p1 = street.points[1];
        const dx = p1[0] - p0[0];
        const dz = p1[2] - p0[2];
        const length = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));

        const effectiveLaneCount = Math.max(1, Math.round(street.laneCount * streetGeometryConfig.laneMultiplier));
        const effectiveSidewalkWidth = Math.max(0.5, street.sidewalkWidth * streetGeometryConfig.sidewalkMultiplier);
        const roadWidth = effectiveLaneCount * 3 + effectiveSidewalkWidth * 2;
        const laneWidth = roadWidth / effectiveLaneCount;

        return (
          <group key={`street-${streetIdx}`} name={`street-${streetIdx}`}>
            {/* Road surface */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[(p0[0] + p1[0]) / 2, 0.02, (p0[2] + p1[2]) / 2]}
              receiveShadow
            >
              <planeGeometry args={[roadWidth, length]} />
              <meshStandardMaterial color={0x333333} metalness={0.1} roughness={0.9} />
            </mesh>

            {/* Lane markings */}
            {Array.from({ length: effectiveLaneCount - 1 }, (_, l) => {
              const markZ = -length / 2 + (l + 1) * laneWidth;
              return (
                <mesh
                  key={`lane-mark-${streetIdx}-${l}`}
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={[(p0[0] + p1[0]) / 2, 0.03, (p0[2] + p1[2]) / 2 + markZ]}
                >
                  <planeGeometry args={[0.15, length * 0.9]} />
                  <meshBasicMaterial color={0xffffff} transparent opacity={0.6} />
                </mesh>
              );
            })}

            {/* Sidewalks */}
            {[-1, 1].map((side, si) => (
              <mesh
                key={`sidewalk-${streetIdx}-${si}`}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[
                  (p0[0] + p1[0]) / 2 - side * (effectiveLaneCount * laneWidth / 2 + effectiveSidewalkWidth / 2),
                  0.03,
                  (p0[2] + p1[2]) / 2,
                ]}
              >
                <planeGeometry args={[effectiveSidewalkWidth, length]} />
                <meshStandardMaterial color={0x888888} metalness={0.05} roughness={0.8} />
              </mesh>
            ))}

            {/* Rails / tracks */}
            {street.hasRail && (
              <>
                {[-1, 1].map((side, si) => {
                  const railColor = effectiveYear === 1945 ? 0x888888 : effectiveYear === 2055 ? 0x4488ff : 0xaaaaaa;
                  const railX = (p0[0] + p1[0]) / 2 - side * (effectiveLaneCount * laneWidth / 2 + effectiveSidewalkWidth * 0.3);
                  return (
                    <mesh
                      key={`rail-${streetIdx}-${si}`}
                      position={[railX, 0.1, (p0[2] + p1[2]) / 2]}
                    >
                      <boxGeometry
                        args={[
                          Math.max(0.01, street.trackWidth * streetGeometryConfig.railWidthMultiplier),
                          0.15,
                          length * 0.95,
                        ]}
                      />
                      <meshStandardMaterial color={railColor} metalness={0.7} roughness={0.3} />
                    </mesh>
                  );
                })}

                {/* Cross ties */}
                {(() => {
                  const tieCount = Math.max(1, Math.round(length * 0.2));
                  const tieGeoArgs: [number, number, number] = [
                    Math.max(0.01, street.trackWidth * 1.1),
                    0.08,
                    0.3,
                  ];
                  return Array.from({ length: tieCount }, (_, t) => {
                    const tieZ = (p0[2] + p1[2]) / 2 - length * 0.45 + (t * length * 0.9) / tieCount;
                    return (
                      <mesh key={`tie-${streetIdx}-${t}`} position={[(p0[0] + p1[0]) / 2, 0.09, tieZ]}>
                        <boxGeometry args={tieGeoArgs} />
                        <meshStandardMaterial color={0x555555} />
                      </mesh>
                    );
                  });
                })()}
              </>
            )}
          </group>
        );
      })}

      {/* Era-specific vehicles moving along street paths */}
      {vehiclePlacements.map((placement) => {
        const street = streets[placement.streetIndex];
        const p0 = street.points[0];
        const p1 = street.points[1];
        const ref = vehicleRefs.current.get(placement.key);
        const progress = ref?.progress ?? placement.progress;
        const t = Math.max(0, Math.min(1, progress));
        const x = p0[0] + (p1[0] - p0[0]) * t;
        const z = p0[2] + (p1[2] - p0[2]) * t;
        const [w, h, d] = vehicleDimensions(placement.definition.type, placement.definition.scale);
        const dx = p1[0] - p0[0];
        const dz = p1[2] - p0[2];
        const rotationY = Math.atan2(dx, dz);

        return (
          <group key={placement.key} name={`vehicle-${placement.key}`}>
            <mesh
              position={[x, h / 2 + placement.definition.scale[1] * 0.25, z]}
              rotation={[0, rotationY, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color={placement.definition.color} metalness={0.3} roughness={0.6} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

export default VehicleSystem;
