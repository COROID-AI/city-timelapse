import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { EraConfig } from '../data/eraData';

interface BuildingProps {
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  colorIndex: number;
  config: EraConfig;
  seed: number;
}

const Building: React.FC<BuildingProps> = React.memo(({ position, width, depth, height, colorIndex, config, seed }) => {
  const groupRef = useRef<Group>(null);

  const color = useMemo(() => {
    const c = config.buildingColors[colorIndex % config.buildingColors.length];
    return new THREE.Color(c[0], c[1], c[2]);
  }, [config, colorIndex]);

  const windows = useMemo(() => {
    const wCount = Math.max(1, Math.floor(width / 2));
    const hCount = Math.max(1, Math.floor(height / 3));
    const windowSize = 0.6;
    const gap = 1.2;
    const offsetX = width / 2 - gap / 2;
    const offsetY = height / 2;
    const z = depth / 2 + 0.01;

    const geo = new THREE.PlaneGeometry(windowSize, windowSize);
    const frameGeo = new THREE.BoxGeometry(0.05, windowSize, windowSize / 2);
    const glassMat = new THREE.MeshStandardMaterial({
      color: config.windowGlassColor,
      emissive: config.windowGlassColor,
      emissiveIntensity: 0.3,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: config.windowFrameColor, roughness: 0.8 });

    const windowMeshes: JSX.Element[] = [];

    // Front face
    for (let r = 0; r < hCount; r++) {
      for (let c = 0; c < wCount; c++) {
        const wx = -offsetX + c * gap;
        const wy = offsetY - r * gap;
        windowMeshes.push(
          <group key={`wf-${r}-${c}`} position={[wx, wy, z]}>
            <mesh geometry={geo} material={glassMat} />
            <mesh geometry={frameGeo} material={frameMat} position={[0, 0, -windowSize / 4]} />
            <mesh geometry={frameGeo} material={frameMat} position={[0, 0, windowSize / 4]} rotation={[0, Math.PI / 2, 0]} />
          </group>
        );
      }
    }

    // Back face (fewer lit windows for 1945 era)
    if (config.year >= 1985) {
      for (let r = 0; r < Math.floor(hCount / 2); r++) {
        for (let c = 0; c < wCount; c++) {
          const wx = -offsetX + c * gap;
          const wy = offsetY - 10 - r * gap;
          const nightEmissive = config.year >= 2005 ? 0.6 : 0.3;
          const nightGlass = new THREE.MeshStandardMaterial({
            color: config.windowGlassColor,
            emissive: config.year >= 2005 ? 0xffcc66 : 0xffaa33,
            emissiveIntensity: nightEmissive,
            roughness: 0.2,
            metalness: 0.1,
            side: THREE.DoubleSide,
          });
          windowMeshes.push(
            <group key={`wb-${r}-${c}`} position={[wx, wy, -z]}>
              <mesh geometry={geo} material={nightGlass} />
            </group>
          );
        }
      }
    }

    return windowMeshes;
  }, [width, height, depth, config]);

  const antenna = useMemo(() => {
    if (height > 12 && seed % 3 === 0) {
      return <mesh position={[0, height + 0.5, 0]} geometry={<cylinderGeometry args={[0.03, 0.03, 2, 6]} />} material={<meshStandardMaterial color={0x888888} />} />;
    }
    return null;
  }, [height, seed]);

  return (
    <group ref={groupRef} position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[Math.max(0.1, width), Math.max(0.1, height), Math.max(0.1, depth)]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.2} emissive={color} emissiveIntensity={0.05} />
      </mesh>
      {windows}
      {antenna}
      {/* Rooftop details for later eras */}
      {config.year >= 2005 && height > 8 && (
        <mesh position={[0, height + 0.01, 0]} geometry={<boxGeometry args={[width * 0.8, 0.1, depth * 0.8]} />}>
          <meshStandardMaterial color={0x334455} roughness={0.5} metalness={0.3} />
        </mesh>
      )}
      {config.year >= 2055 && (
        <mesh position={[0, height + 1.5, 0]} geometry={<cylinderGeometry args={[width * 0.3, width * 0.3, 2, 8]} />}>
          <meshStandardMaterial color={0x4466ff} emissive={0x2244ff} emissiveIntensity={0.4} roughness={0.3} metalness={0.5} />
        </mesh>
      )}
    </group>
  );
});

export default Building;
