import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Era } from '../contexts/EraContext';
import { ERA_CONFIGS } from '../config/eras';
import * as THREE from 'three';

interface BuildingProps {
  id: string;
  x: number;
  z: number;
  era: Era;
}

export const Building: React.FC<BuildingProps> = ({ id, x, z, era }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const config = ERA_CONFIGS[era];
  
  // Animation state
  const [scale, setScale] = React.useState(0.8);
  const [yPos, setYPos] = React.useState(0);

  // Animate building when era changes
  useEffect(() => {
    setScale(0.8);
    setYPos(config.buildingStyle.height / 2 * 0.8);
    
    const startTime = Date.now();
    const duration = 2500;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const newScale = 0.8 + progress * 0.2;
      
      setScale(newScale);
      setYPos(config.buildingStyle.height / 2 * newScale);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    const timeoutId = setTimeout(animate, 0);
    return () => clearTimeout(timeoutId);
  }, [era, config.buildingStyle.height]);

  return (
    <group position={[x, 0, z]}>
      {/* Main building structure */}
      <mesh 
        ref={meshRef}
        scale={[scale, scale, scale]}
        position={[0, yPos, 0]}
      >
        <boxGeometry args={[config.buildingStyle.width, config.buildingStyle.height, config.buildingStyle.depth]} />
        <meshBasicMaterial color={config.buildingStyle.color} />
      </mesh>

      {/* Windows - generated procedurally */}
      {config.buildingStyle.windowStyle !== 'none' && (
        <Windows buildingStyle={config.buildingStyle} era={era} />
      )}

      {/* Era-specific architectural details */}
      {config.buildingStyle.detailLevel === 'high' && (
        <ArchitecturalDetails 
          height={config.buildingStyle.height} 
          width={config.buildingStyle.width} 
          depth={config.buildingStyle.depth}
          era={era}
        />
      )}
    </group>
  );
};

// Windows component
const Windows: React.FC<{ 
  buildingStyle: typeof ERA_CONFIGS[1945]['buildingStyle'];
  era: Era;
}> = ({ buildingStyle, era }) => {
  const windows = useMemo(() => {
    const items = [];
    const rows = Math.floor(buildingStyle.height / 2);
    const cols = Math.floor(buildingStyle.width / 1);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Front face windows
        items.push({
          position: [
            -buildingStyle.width/2 + col * 1.2 + 0.8,
            row * 2.5 + 1.5,
            buildingStyle.depth/2 + 0.1
          ],
        });
        // Back face windows
        items.push({
          position: [
            -buildingStyle.width/2 + col * 1.2 + 0.8,
            row * 2.5 + 1.5,
            -buildingStyle.depth/2 - 0.1
          ],
        });
      }
    }
    
    return items;
  }, [buildingStyle]);

  // Window colors per era
  const windowColor = useMemo(() => {
    switch (era) {
      case 1945: return '#4A90E2';
      case 1965: return '#87CEFA';
      case 1985: return '#2D3748';
      case 2005: return '#87CEFA';
      case 2025: return '#98FB98';
      case 2055: return '#00FFFF';
      default: return '#4A90E2';
    }
  }, [era]);

  return (
    <>
      {windows.map((w, i) => (
        <mesh key={i} position={new THREE.Vector3(...w.position)}>
          <boxGeometry args={[0.5, 0.8, 0.1]} />
          <meshBasicMaterial color={windowColor} />
        </mesh>
      ))}
    </>
  );
};

// Architectural details component
const ArchitecturalDetails: React.FC<{
  height: number;
  width: number;
  depth: number;
  era: Era;
}> = ({ height, width, depth, era }) => {
  if (era === 1945) {
    // Art Deco details - stepped crown
    return (
      <group position={[0, height/2 + 2, 0]}>
        <mesh>
          <boxGeometry args={[width + 1, 2, depth + 1]} />
          <meshBasicMaterial color="#6B5B47" />
        </mesh>
        <mesh position={[0, 2.5, 0]}>
          <boxGeometry args={[width - 1, 1, depth - 1]} />
          <meshBasicMaterial color="#8B7355" />
        </mesh>
      </group>
    );
  }
  
  if (era === 1985) {
    // Brutalist details - raw concrete features
    return (
      <group>
        <mesh position={[0, height + 0.5, 0]}>
          <boxGeometry args={[width + 2, 1, depth + 2]} />
          <meshBasicMaterial color="#4A5568" />
        </mesh>
      </group>
    );
  }
  
  if (era === 2055) {
    // Futuristic - floating platforms
    return (
      <group>
        <mesh position={[0, height + 3, 0]}>
          <boxGeometry args={[width - 2, 0.5, depth - 2]} />
          <meshBasicMaterial color="#00BFFF" />
        </mesh>
        <mesh position={[0, height + 6, 0]}>
          <boxGeometry args={[width - 4, 0.5, depth - 4]} />
          <meshBasicMaterial color="#00FFFF" />
        </mesh>
      </group>
    );
  }
  
  return null;
};