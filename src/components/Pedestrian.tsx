import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Era } from '../contexts/EraContext';
import * as THREE from 'three';

interface PedestrianProps {
  id: string;
  x: number;
  z: number;
  era: Era;
}

export const Pedestrian: React.FC<PedestrianProps> = ({ id, x, z, era }) => {
  const groupRef = useRef<THREE.Group>(null!);
  
  // Random offset for natural positioning
  const offset = React.useMemo(() => {
    const parts = id.split('-');
    return parseInt(parts[2] || '0') + parseInt(parts[3] || '0');
  }, [id]);
  
  // Walking animation
  useFrame((state) => {
    if (groupRef.current && era !== 2055) {
      const time = state.clock.elapsedTime;
      // Subtle walking animation - slight bobbing
      groupRef.current.position.y = 1.6 + Math.sin(time * 3 + offset) * 0.05;
      // Arm swing
      const armSwing = Math.sin(time * 3 + offset) * 0.2;
      groupRef.current.rotation.x = armSwing;
    }
  });

  // Era-appropriate clothing
  const clothingStyle = era === 1945 ? 'vintage' :
                       era === 1965 ? 'casual' :
                       era === 1985 ? 'casual' :
                       era === 2005 ? 'modern' :
                       era === 2025 ? 'modern' : 'future';

  return (
    <group ref={groupRef} position={[x + 1, 0, z + 1]}>
      {clothingStyle === 'vintage' && <VintagePedestrian />}
      {clothingStyle === 'casual' && <CasualPedestrian />}
      {clothingStyle === 'modern' && <ModernPedestrian />}
      {clothingStyle === 'future' && <FuturePedestrian />}
    </group>
  );
};

// 1940s Vintage - formal wear
const VintagePedestrian: React.FC = () => (
  <group>
    {/* Body */}
    <mesh position={[0, 1.6, 0]}>
      <cylinderGeometry args={[0.3, 0.3, 1.2, 16]} />
      <meshBasicMaterial color="#4682B4" />
    </mesh>
    {/* Head */}
    <mesh position={[0, 2.3, 0]}>
      <sphereGeometry args={[0.25, 16, 16]} />
      <meshBasicMaterial color="#DEB887" />
    </mesh>
    {/* Hat */}
    <mesh position={[0, 2.55, 0]}>
      <cylinderGeometry args={[0.35, 0.35, 0.1, 16]} />
      <meshBasicMaterial color="#8B4513" />
    </mesh>
    {/* Arms */}
    <mesh position={[0.4, 1.6, 0]} rotation={[0, 0, Math.PI/2]}>
      <cylinderGeometry args={[0.1, 0.1, 0.6, 8]} />
      <meshBasicMaterial color="#4682B4" />
    </mesh>
    {/* Legs */}
    <mesh position={[0.15, 0.8, 0]}>
      <cylinderGeometry args={[0.12, 0.12, 0.8, 8]} />
      <meshBasicMaterial color="#000080" />
    </mesh>
    <mesh position={[-0.15, 0.8, 0]}>
      <cylinderGeometry args={[0.12, 0.12, 0.8, 8]} />
      <meshBasicMaterial color="#000080" />
    </mesh>
  </group>
);

// 1960s Casual
const CasualPedestrian: React.FC = () => (
  <group>
    {/* Body */}
    <mesh position={[0, 1.5, 0]}>
      <cylinderGeometry args={[0.3, 0.3, 1, 16]} />
      <meshBasicMaterial color="#FF6347" />
    </mesh>
    {/* Head */}
    <mesh position={[0, 2.1, 0]}>
      <sphereGeometry args={[0.25, 16, 16]} />
      <meshBasicMaterial color="#DAA520" />
    </mesh>
    {/* Hair */}
    <mesh position={[0, 2.25, 0]}>
      <sphereGeometry args={[0.26, 12, 12]} />
      <meshBasicMaterial color="#8B4513" />
    </mesh>
    {/* Arms */}
    <mesh position={[0.4, 1.5, 0]} rotation={[0, 0, Math.PI/2]}>
      <cylinderGeometry args={[0.09, 0.09, 0.5, 8]} />
      <meshBasicMaterial color="#FF6347" />
    </mesh>
    {/* Legs */}
    <mesh position={[0.15, 0.7, 0]}>
      <cylinderGeometry args={[0.1, 0.1, 0.7, 8]} />
      <meshBasicMaterial color="#0000CD" />
    </mesh>
    <mesh position={[-0.15, 0.7, 0]}>
      <cylinderGeometry args={[0.1, 0.1, 0.7, 8]} />
      <meshBasicMaterial color="#0000CD" />
    </mesh>
  </group>
);

// 2000s Modern
const ModernPedestrian: React.FC = () => (
  <group>
    {/* Body */}
    <mesh position={[0, 1.5, 0]}>
      <cylinderGeometry args={[0.3, 0.3, 1, 16]} />
      <meshBasicMaterial color="#228B22" />
    </mesh>
    {/* Head */}
    <mesh position={[0, 2.1, 0]}>
      <sphereGeometry args={[0.25, 16, 16]} />
      <meshBasicMaterial color="#F5DEB3" />
    </mesh>
    {/* Arms */}
    <mesh position={[0.4, 1.5, 0]} rotation={[0, 0, Math.PI/2]}>
      <cylinderGeometry args={[0.09, 0.09, 0.5, 8]} />
      <meshBasicMaterial color="#228B22" />
    </mesh>
    {/* Legs */}
    <mesh position={[0.15, 0.7, 0]}>
      <cylinderGeometry args={[0.1, 0.1, 0.7, 8]} />
      <meshBasicMaterial color="#8B4513" />
    </mesh>
    <mesh position={[-0.15, 0.7, 0]}>
      <cylinderGeometry args={[0.1, 0.1, 0.7, 8]} />
      <meshBasicMaterial color="#8B4513" />
    </mesh>
    {/* Smartphone - 2025 */}
    <mesh position={[0.5, 1.7, 0]}>
      <boxGeometry args={[0.1, 0.2, 0.05]} />
      <meshBasicMaterial color="#000" />
    </mesh>
  </group>
);

// 2055 Future - Futuristic clothing
const FuturePedestrian: React.FC = () => (
  <group>
    {/* Holographic body */}
    <mesh position={[0, 1.5, 0]}>
      <cylinderGeometry args={[0.3, 0.3, 1, 16]} />
      <meshBasicMaterial color="#00BFFF" />
    </mesh>
    {/* Head - with AR glasses effect */}
    <mesh position={[0, 2.1, 0]}>
      <sphereGeometry args={[0.25, 16, 16]} />
      <meshBasicMaterial color="#7FFFD4" />
    </mesh>
    {/* AR glasses */}
    <mesh position={[0, 2.15, 0.15]}>
      <boxGeometry args={[0.25, 0.05, 0.02]} />
      <meshBasicMaterial color="#00FFFF" />
    </mesh>
    {/* Arms - holographic */}
    <mesh position={[0.4, 1.5, 0]} rotation={[0, 0, Math.PI/2]}>
      <cylinderGeometry args={[0.09, 0.09, 0.5, 8]} />
      <meshBasicMaterial color="#87CEFA" />
    </mesh>
    {/* Legs - tech pants */}
    <mesh position={[0.15, 0.7, 0]}>
      <cylinderGeometry args={[0.1, 0.1, 0.7, 8]} />
      <meshBasicMaterial color="#1E90FF" />
    </mesh>
    <mesh position={[-0.15, 0.7, 0]}>
      <cylinderGeometry args={[0.1, 0.1, 0.7, 8]} />
      <meshBasicMaterial color="#1E90FF" />
    </mesh>
  </group>
);