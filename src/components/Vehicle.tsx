import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Era } from '../contexts/EraContext';
import * as THREE from 'three';

interface VehicleProps {
  id: string;
  x: number;
  z: number;
  era: Era;
}

export const Vehicle: React.FC<VehicleProps> = ({ id, x, z, era }) => {
  // Get vehicle type based on era
  const vehicleType = era === 1945 ? 'sedan_1940s' :
                    era === 1965 ? 'muscle_car' :
                    era === 1985 ? 'suv_1980s' :
                    era === 2005 ? 'sedan_2000s' :
                    era === 2025 ? 'ev_sedan' : 'flying_car';

  // Animation state for entrance
  const [entranceProgress, setEntranceProgress] = useState(0);
  const [currentX, setCurrentX] = useState(0);

  // Animate vehicle entrance
  useEffect(() => {
    setEntranceProgress(0);
    setCurrentX(x + (era === 2055 ? -5 : -15));
    
    const startTime = Date.now();
    const duration = 2000;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      setEntranceProgress(progress);
      setCurrentX(x - (15 * (1 - progress)));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    const timeoutId = setTimeout(animate, 0);
    return () => clearTimeout(timeoutId);
  }, [era, x]);

  // Position for flying vehicles
  const yPos = era === 2055 ? 3 - (1 - entranceProgress) * 3 : 0.5;

  return (
    <group position={[currentX, yPos, z]}>
      {vehicleType === 'sedan_1940s' && <Sedan1940s />}
      {vehicleType === 'muscle_car' && <MuscleCar />}
      {vehicleType === 'suv_1980s' && <SUV1980s />}
      {vehicleType === 'sedan_2000s' && <Sedan2000s />}
      {vehicleType === 'ev_sedan' && <ElectricSedan />}
      {vehicleType === 'flying_car' && <FlyingCar />}
    </group>
  );
};

// 1940s Sedan - Classic car with round shapes
const Sedan1940s: React.FC = () => (
  <group>
    <mesh>
      <boxGeometry args={[2, 0.6, 4]} />
      <meshBasicMaterial color="#8B4513" />
    </mesh>
    {/* Hood */}
    <mesh position={[0, 0.6, 0.5]}>
      <boxGeometry args={[1.8, 0.3, 1]} />
      <meshBasicMaterial color="#654321" />
    </mesh>
    {/* Wheels */}
    <mesh position={[0.8, -0.2, 0.8]}>
      <cylinderGeometry args={[0.3, 0.3, 0.3, 16]} />
      <meshBasicMaterial color="#333" />
    </mesh>
    <mesh position={[-0.8, -0.2, 0.8]}>
      <cylinderGeometry args={[0.3, 0.3, 0.3, 16]} />
      <meshBasicMaterial color="#333" />
    </mesh>
    <mesh position={[0.8, -0.2, -0.8]}>
      <cylinderGeometry args={[0.3, 0.3, 0.3, 16]} />
      <meshBasicMaterial color="#333" />
    </mesh>
    <mesh position={[-0.8, -0.2, -0.8]}>
      <cylinderGeometry args={[0.3, 0.3, 0.3, 16]} />
      <meshBasicMaterial color="#333" />
    </mesh>
  </group>
);

// 1960s Muscle Car - Aggressive, sporty
const MuscleCar: React.FC = () => (
  <group>
    <mesh>
      <boxGeometry args={[2.2, 0.5, 4.5]} />
      <meshBasicMaterial color="#FF4500" />
    </mesh>
    {/* Stripe */}
    <mesh position={[0, 0.3, 0]} rotation={[0, Math.PI/2, 0]}>
      <boxGeometry args={[0.1, 0.3, 4]} />
      <meshBasicMaterial color="#FFFF00" />
    </mesh>
    {/* Wheels */}
    {[-0.9, 0.9].map((x, i) => (
      <React.Fragment key={i}>
        <mesh position={[x, -0.25, 1]}>
          <cylinderGeometry args={[0.35, 0.35, 0.4, 16]} />
          <meshBasicMaterial color="#222" />
        </mesh>
        <mesh position={[x, -0.25, -1]}>
          <cylinderGeometry args={[0.35, 0.35, 0.4, 16]} />
          <meshBasicMaterial color="#222" />
        </mesh>
      </React.Fragment>
    ))}
  </group>
);

// 1980s SUV - Boxy, larger
const SUV1980s: React.FC = () => (
  <group>
    <mesh>
      <boxGeometry args={[2.4, 0.8, 4.8]} />
      <meshBasicMaterial color="#4682B4" />
    </mesh>
    {/* Roof rack */}
    <mesh position={[0, 0.9, 0]}>
      <boxGeometry args={[2, 0.1, 3.5]} />
      <meshBasicMaterial color="#333" />
    </mesh>
    {/* Wheels */}
    {[-1, 1].map((x, i) => (
      <React.Fragment key={i}>
        <mesh position={[x, -0.3, 1.2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.5, 16]} />
          <meshBasicMaterial color="#111" />
        </mesh>
        <mesh position={[x, -0.3, -1.2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.5, 16]} />
          <meshBasicMaterial color="#111" />
        </mesh>
      </React.Fragment>
    ))}
  </group>
);

// 2000s Sedan - Sleek, modern
const Sedan2000s: React.FC = () => (
  <group>
    <mesh>
      <boxGeometry args={[2, 0.5, 4.2]} />
      <meshBasicMaterial color="#2F4F4F" />
    </mesh>
    {/* Windows */}
    <mesh position={[0, 0.7, 0]}>
      <boxGeometry args={[1.8, 0.3, 3.8]} />
      <meshBasicMaterial color="#87CEEB" />
    </mesh>
    {/* Wheels */}
    {[-0.75, 0.75].map((x, i) => (
      <React.Fragment key={i}>
        <mesh position={[x, -0.25, 1]}>
          <cylinderGeometry args={[0.35, 0.35, 0.4, 16]} />
          <meshBasicMaterial color="#444" />
        </mesh>
        <mesh position={[x, -0.25, -1]}>
          <cylinderGeometry args={[0.35, 0.35, 0.4, 16]} />
          <meshBasicMaterial color="#444" />
        </mesh>
      </React.Fragment>
    ))}
  </group>
);

// EV Sedan - Smooth, aerodynamic
const ElectricSedan: React.FC = () => (
  <group>
    <mesh>
      <boxGeometry args={[2, 0.4, 4]} />
      <meshBasicMaterial color="#FFFFFF" />
    </mesh>
    {/* Charging port */}
    <mesh position={[1.1, 0, 0]}>
      <boxGeometry args={[0.05, 0.2, 0.2]} />
      <meshBasicMaterial color="#00FF00" />
    </mesh>
    {/* Wheels - sleek */}
    {[-0.7, 0.7].map((x, i) => (
      <React.Fragment key={i}>
        <mesh position={[x, -0.2, 0.9]}>
          <cylinderGeometry args={[0.32, 0.32, 0.3, 16]} />
          <meshBasicMaterial color="#222" />
        </mesh>
        <mesh position={[x, -0.2, -0.9]}>
          <cylinderGeometry args={[0.32, 0.32, 0.3, 16]} />
          <meshBasicMaterial color="#222" />
        </mesh>
      </React.Fragment>
    ))}
  </group>
);

// Flying Car - 2055
const FlyingCar: React.FC = () => (
  <group>
    <mesh>
      <boxGeometry args={[2, 0.3, 2]} />
      <meshBasicMaterial color="#00BFFF" />
    </mesh>
    {/* Hover effects */}
    <mesh position={[0, -0.1, 0]}>
      <ringGeometry args={[0.8, 1.5, 16]} />
      <meshBasicMaterial color="#00FFFF" transparent opacity={0.3} />
    </mesh>
    <mesh position={[0, -0.3, 0]} rotation={[0, 0, Math.PI/2]}>
      <ringGeometry args={[0.5, 1.2, 16]} />
      <meshBasicMaterial color="#00FFFF" transparent opacity={0.2} />
    </mesh>
  </group>
);