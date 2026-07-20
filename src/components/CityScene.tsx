import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useEra } from '../contexts/EraContext';
import { ERA_CONFIGS } from '../config/eras';
import { Building } from './Building';
import { Vehicle } from './Vehicle';
import { Pedestrian } from './Pedestrian';
import { Storefront } from './Storefront';
import * as THREE from 'three';

export const CityScene: React.FC = () => {
  const { currentEra } = useEra();
  const groupRef = useRef<THREE.Group>(null!);

  // Generate city grid
  const cityLayout = useMemo(() => {
    const buildings = [];
    const vehicles = [];
    const pedestrians = [];
    const storefronts = [];

    // Create a 4x4 grid of buildings with storefronts
    for (let x = -15; x <= 15; x += 10) {
      for (let z = -15; z <= 15; z += 10) {
        const id = `building-${x}-${z}`;
        buildings.push({ id, x, z });
        
        // Storefront on each building
        storefronts.push({ id: `store-${id}`, x, z });
        
        // Vehicles on streets (every other position)
        if ((x + z) % 20 !== 0) {
          vehicles.push({ id: `vehicle-${x}-${z}`, x, z });
        }
        
        // Pedestrians on sidewalks
        pedestrians.push({ id: `ped-${x}-${z}`, x, z });
      }
    }

    return { buildings, vehicles, pedestrians, storefronts };
  }, []);

  // Subtle animation for the scene
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(Date.now() * 0.0001) * 0.01;
    }
  });

  return (
    <>
      {/* Sky - simple gradient using large sphere */}
      <mesh>
        <sphereGeometry args={[500, 32, 32]} />
        <meshBasicMaterial color="#87CEEB" side={2} />
      </mesh>
      
      {/* Sun */}
      <mesh position={[100, 100, 100]}>
        <circleGeometry args={[20, 32]} />
        <meshBasicMaterial color="#FFD700" />
      </mesh>
      
      {/* Ground plane */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.8} />
      </mesh>

      {/* Roads */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 4]} />
        <meshStandardMaterial color="#404040" roughness={0.9} />
      </mesh>

      <group ref={groupRef}>
        {/* Buildings */}
        {cityLayout.buildings.map((b) => (
          <Building key={b.id} {...b} era={currentEra} />
        ))}

        {/* Storefronts */}
        {cityLayout.storefronts.map((s) => (
          <Storefront key={s.id} {...s} era={currentEra} />
        ))}

        {/* Vehicles */}
        {cityLayout.vehicles.map((v) => (
          <Vehicle key={v.id} {...v} era={currentEra} />
        ))}

        {/* Pedestrians */}
        {cityLayout.pedestrians.map((p) => (
          <Pedestrian key={p.id} {...p} era={currentEra} />
        ))}
      </group>
    </>
  );
};