import { useMemo } from 'react';
import { useEra } from '../contexts/EraContext';
import type { EraYear } from '../types';

interface BuildingConfig {
  minHeight: number;
  maxHeight: number;
  minWidth: number;
  maxWidth: number;
  facadeColor: number;
  facadeMetalness: number;
  facadeRoughness: number;
  roofType: 'flat' | 'pitched' | 'domed' | 'modern';
  windowColor: number;
  windowRatio: number;
  material: 'masonry' | 'concrete' | 'glass' | 'composite';
}

const eraBuildings: Record<EraYear, BuildingConfig> = {
  1945: {
    minHeight: 2, maxHeight: 5,
    minWidth: 4, maxWidth: 8,
    facadeColor: 0x8b7d6b, facadeMetalness: 0.05, facadeRoughness: 0.95,
    roofType: 'pitched', windowColor: 0x8fa8c0, windowRatio: 0.35, material: 'masonry',
  },
  1965: {
    minHeight: 3, maxHeight: 8,
    minWidth: 5, maxWidth: 10,
    facadeColor: 0x7a8a7a, facadeMetalness: 0.1, facadeRoughness: 0.85,
    roofType: 'flat', windowColor: 0x8fa8c0, windowRatio: 0.45, material: 'concrete',
  },
  1985: {
    minHeight: 5, maxHeight: 15,
    minWidth: 6, maxWidth: 12,
    facadeColor: 0x9a9aaa, facadeMetalness: 0.35, facadeRoughness: 0.55,
    roofType: 'flat', windowColor: 0x4a6a8a, windowRatio: 0.55, material: 'glass',
  },
  2005: {
    minHeight: 8, maxHeight: 25,
    minWidth: 8, maxWidth: 16,
    facadeColor: 0xb0c0c0, facadeMetalness: 0.55, facadeRoughness: 0.35,
    roofType: 'modern', windowColor: 0x3a5a7a, windowRatio: 0.65, material: 'glass',
  },
  2025: {
    minHeight: 10, maxHeight: 35,
    minWidth: 10, maxWidth: 20,
    facadeColor: 0xc0d0e0, facadeMetalness: 0.65, facadeRoughness: 0.25,
    roofType: 'modern', windowColor: 0x2a4a6a, windowRatio: 0.75, material: 'composite',
  },
  2055: {
    minHeight: 15, maxHeight: 60,
    minWidth: 12, maxWidth: 25,
    facadeColor: 0xd0e0f0, facadeMetalness: 0.8, facadeRoughness: 0.15,
    roofType: 'modern', windowColor: 0x1a3a5a, windowRatio: 0.85, material: 'composite',
  },
};

function hashCoord(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(a + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

interface BuildingBlock {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  config: BuildingConfig;
}

interface BuildingSystemProps {
  year?: EraYear;
  eraBlendT?: number;
  loEra?: EraYear;
  hiEra?: EraYear;
}

export function BuildingSystem({ year: yearProp, eraBlendT, loEra, hiEra }: BuildingSystemProps) {
  const { year } = useEra();
  const effectiveYear = yearProp ?? year;

  const allYears: EraYear[] = [1945, 1965, 1985, 2005, 2025, 2055];
  const currentIdx = allYears.indexOf(effectiveYear);
  const lo = allYears[Math.max(0, currentIdx)];
  const hi = allYears[Math.min(allYears.length - 1, currentIdx + 1)];
  const t = lo === hi ? 1 : (eraBlendT ?? (effectiveYear - lo) / (hi - lo));

  const loConfig = eraBuildings[lo];
  const hiConfig = eraBuildings[hi];

  const blendedConfig = useMemo(() => {
    if (t <= 0) return loConfig;
    if (t >= 1) return hiConfig;
    return {
      minHeight: loConfig.minHeight + (hiConfig.minHeight - loConfig.minHeight) * t,
      maxHeight: loConfig.maxHeight + (hiConfig.maxHeight - loConfig.maxHeight) * t,
      minWidth: loConfig.minWidth + (hiConfig.minWidth - loConfig.minWidth) * t,
      maxWidth: loConfig.maxWidth + (hiConfig.maxWidth - loConfig.maxWidth) * t,
      facadeColor: lerpColor(loConfig.facadeColor, hiConfig.facadeColor, t),
      facadeMetalness: loConfig.facadeMetalness + (hiConfig.facadeMetalness - loConfig.facadeMetalness) * t,
      facadeRoughness: loConfig.facadeRoughness + (hiConfig.facadeRoughness - loConfig.facadeRoughness) * t,
      roofType: t < 0.5 ? loConfig.roofType : hiConfig.roofType,
      windowColor: lerpColor(loConfig.windowColor, hiConfig.windowColor, t),
      windowRatio: loConfig.windowRatio + (hiConfig.windowRatio - loConfig.windowRatio) * t,
      material: t < 0.5 ? loConfig.material : hiConfig.material,
    };
  }, [t, loConfig, hiConfig]);

  const blocks = useMemo(() => {
    const result: BuildingBlock[] = [];
    const gridSize = 35;
    for (let x = -gridSize; x <= gridSize; x += 6) {
      for (let z = -gridSize; z <= gridSize; z += 6) {
        const h = hashCoord(x, z);
        if (h < 0.25) continue; // 25% open space for streets
        const width = blendedConfig.minWidth + (blendedConfig.maxWidth - blendedConfig.minWidth) * hashCoord(x + 1, z);
        const depth = width * (0.5 + hashCoord(x, z + 1) * 0.5);
        const height = blendedConfig.minHeight + (blendedConfig.maxHeight - blendedConfig.minHeight) * h;
        result.push({ x, z, width, depth, height, config: blendedConfig });
      }
    }
    return result;
  }, [effectiveYear, blendedConfig]);

  return (
    <group name="buildings">
      {blocks.map((block, i) => (
        <group key={`building-${i}`} name={`building-${i}`}>
          <mesh
            position={[block.x, block.height / 2, block.z]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[block.width, block.height, block.depth]} />
            <meshStandardMaterial
              color={block.config.facadeColor}
              metalness={block.config.facadeMetalness}
              roughness={block.config.facadeRoughness}
            />
          </mesh>
          {/* Roof variants */}
          {block.config.roofType === 'pitched' && (
            <mesh position={[block.x, block.height + 0.5, block.z]}>
              <coneGeometry args={[block.width * 0.6, 1.2, 4]} />
              <meshStandardMaterial color={0x555555} roughness={0.9} />
            </mesh>
          )}
          {block.config.roofType === 'domed' && (
            <mesh position={[block.x, block.height + 0.3, block.z]}>
              <sphereGeometry args={[block.width * 0.35, 16, 12]} />
              <meshStandardMaterial color={0x555555} roughness={0.8} />
            </mesh>
          )}
          {block.config.roofType === 'flat' && block.height > 6 && (
            <mesh position={[block.x, block.height + 0.12, block.z]}>
              <boxGeometry args={[block.width * 0.9, 0.25, block.depth * 0.9]} />
              <meshStandardMaterial color={0x444444} roughness={0.7} />
            </mesh>
          )}
          {block.config.roofType === 'modern' && block.height > 8 && (
            <>
              <mesh position={[block.x, block.height + 0.15, block.z]}>
                <boxGeometry args={[block.width * 0.95, 0.3, block.depth * 0.95]} />
                <meshStandardMaterial color={0x333333} roughness={0.6} />
              </mesh>
              <mesh position={[block.x, block.height + 0.3, block.z]}>
                <boxGeometry args={[block.width * 0.3, 1.5, block.depth * 0.3]} />
                <meshStandardMaterial color={0x224466} metalness={0.8} roughness={0.2} />
              </mesh>
            </>
          )}
          {/* Windows */}
          {block.config.windowRatio > 0 && block.height > 2 && block.config.windowRatio > 0.2 && (
            <group>
              {Array.from({ length: Math.max(1, Math.round(block.config.windowRatio * 3)) }, (_, row) => {
                const wy = (row + 0.5) * (block.height / (Math.round(block.config.windowRatio * 3) + 1));
                return (
                  <mesh key={`win-${i}-${row}`} position={[block.x, wy, block.z + block.depth / 2 + 0.01]}>
                    <planeGeometry args={[block.width * 0.85, block.height * block.config.windowRatio * 0.22]} />
                    <meshStandardMaterial
                      color={block.config.windowColor}
                      emissive={block.config.windowColor}
                      emissiveIntensity={0.3}
                      metalness={0.5}
                    />
                  </mesh>
                );
              })}
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

export default BuildingSystem;
