import React, { useMemo, useRef, useEffect } from 'react';
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
  const groupRef = useRef<THREE.Group>(null);

  const color = useMemo(() => {
    const c = config.buildingColors[colorIndex % config.buildingColors.length] ?? [0.5, 0.5, 0.5];
    return new THREE.Color(c[0], c[1], c[2]);
  }, [config, colorIndex]);

  const windowGeo = useMemo(() => new THREE.PlaneGeometry(0.6, 0.6), []);
  const frameGeo = useMemo(() => new THREE.BoxGeometry(0.05, 0.6, 0.3), []);
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: config.windowGlassColor,
    emissive: config.windowGlassColor,
    emissiveIntensity: 0.3,
    roughness: 0.2,
    metalness: 0.1,
    side: THREE.DoubleSide,
  }), [config.windowGlassColor]);
  const frameMat = useMemo(() => new THREE.MeshStandardMaterial({ color: config.windowFrameColor, roughness: 0.8 }), [config.windowFrameColor]);
  const nightGlassMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: config.windowGlassColor,
    emissive: config.year >= 2005 ? 0xffcc66 : 0xffaa33,
    emissiveIntensity: config.year >= 2005 ? 0.6 : 0.3,
    roughness: 0.2,
    metalness: 0.1,
    side: THREE.DoubleSide,
  }), [config.windowGlassColor, config.year]);

  const antennaGeo = useMemo(() => new THREE.CylinderGeometry(0.03, 0.03, 2, 6), []);
  const antennaMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x888888 }), []);
  const rooftopGeo = useMemo(() => new THREE.BoxGeometry(width * 0.8, 0.1, depth * 0.8), [width, depth]);
  const rooftopMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.5, metalness: 0.3 }), []);
  const topGeo = useMemo(() => new THREE.CylinderGeometry(width * 0.3, width * 0.3, 2, 8), [width]);
  const topMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x4466ff, emissive: 0x2244ff, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.5 }), []);

  const bodyGeo = useMemo(() => new THREE.BoxGeometry(Math.max(0.1, width), Math.max(0.1, height), Math.max(0.1, depth)), [width, height, depth]);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2, emissive: color, emissiveIntensity: 0.05 }), [color]);

  // Dispose all GPU resources when component unmounts or dependencies change
  useEffect(() => {
    return () => {
      [windowGeo, frameGeo, antennaGeo, rooftopGeo, topGeo, bodyGeo].forEach(g => g.dispose());
      [glassMat, frameMat, nightGlassMat, antennaMat, rooftopMat, topMat, bodyMat].forEach(m => m.dispose());
    };
  }, [windowGeo, frameGeo, antennaGeo, rooftopGeo, topGeo, bodyGeo, glassMat, frameMat, nightGlassMat, antennaMat, rooftopMat, topMat, bodyMat]);

  const windows = useMemo(() => {
    const wCount = Math.max(1, Math.floor(width / 2));
    const hCount = Math.max(1, Math.floor(height / 3));
    const gap = 1.2;
    const offsetX = width / 2 - gap / 2;
    const offsetY = height / 2;
    const z = depth / 2 + 0.01;

    const windowMeshes: React.ReactElement[] = [];

    for (let r = 0; r < hCount; r++) {
      for (let c = 0; c < wCount; c++) {
        const wx = -offsetX + c * gap;
        const wy = offsetY - r * gap;
        windowMeshes.push(
          <group key={`wf-${r}-${c}`} position={[wx, wy, z]}>
            <mesh geometry={windowGeo} material={glassMat} />
            <mesh geometry={frameGeo} material={frameMat} position={[0, 0, -0.3]} />
            <mesh geometry={frameGeo} material={frameMat} position={[0, 0, 0.3]} rotation={[0, Math.PI / 2, 0]} />
          </group>
        );
      }
    }

    if (config.year >= 1985) {
      for (let r = 0; r < Math.floor(hCount / 2); r++) {
        for (let c = 0; c < wCount; c++) {
          const wx = -offsetX + c * gap;
          const wy = offsetY - 10 - r * gap;
          windowMeshes.push(
            <group key={`wb-${r}-${c}`} position={[wx, wy, -z]}>
              <mesh geometry={windowGeo} material={nightGlassMat} />
            </group>
          );
        }
      }
    }

    return windowMeshes;
  }, [width, height, depth, config, windowGeo, glassMat, frameGeo, frameMat, nightGlassMat]);

  const antenna = useMemo(() => {
    if (height > 12 && seed % 3 === 0) {
      return <mesh position={[0, height + 0.5, 0]} geometry={antennaGeo} material={antennaMat} />;
    }
    return null;
  }, [height, seed, antennaGeo, antennaMat]);

  return (
    <group ref={groupRef} position={position}>
      <mesh castShadow receiveShadow geometry={bodyGeo} material={bodyMat} />
      {windows}
      {antenna}
      {/* Rooftop details for later eras */}
      {config.year >= 2005 && height > 8 && (
        <mesh position={[0, height + 0.01, 0]} geometry={rooftopGeo} material={rooftopMat} />
      )}
      {config.year >= 2055 && (
        <mesh position={[0, height + 1.5, 0]} geometry={topGeo} material={topMat} />
      )}
    </group>
  );
});

export default Building;
