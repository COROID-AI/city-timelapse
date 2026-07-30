import React, { useMemo } from 'react';
import * as THREE from 'three';
import { EraConfig } from '../data/eraData';

interface VehicleProps {
  position: [number, number, number];
  rotation: number;
  colorIndex: number;
  config: EraConfig;
}

const Vehicle: React.FC<VehicleProps> = React.memo(({ position, rotation, colorIndex, config }) => {
  const groupRef = React.useRef<THREE.Group>(null);

  const vehicleColor = useMemo(() => {
    const c = [config.vehicleColor, 0xffffff, 0x334466, 0xcc3333, 0x336633, 0x993399];
    return c[colorIndex % c.length];
  }, [config.vehicleColor, colorIndex]);

  const isHover = config.vehicleType === 'hover';
  const isAuto = config.vehicleType === 'auto';

  const mesh = useMemo(() => {
    if (isHover) {
      return (
        <group>
          {/* Hover base */}
          <mesh castShadow>
            <boxGeometry args={[2, 0.3, 1]} />
            <meshStandardMaterial color={vehicleColor} emissive={vehicleColor} emissiveIntensity={0.3} metalness={0.5} roughness={0.3} />
          </mesh>
          {/* Hover glow */}
          <mesh position={[0, -0.5, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 0.3, 16]} />
            <meshStandardMaterial color={0x4488ff} emissive={0x2266ff} emissiveIntensity={0.6} transparent opacity={0.7} />
          </mesh>
          {/* Antenna/light */}
          <mesh position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color={0xffffff} emissive={0x66ccff} emissiveIntensity={1.0} />
          </mesh>
        </group>
      );
    }

    return (
      <group>
        {/* Body */}
        <mesh castShadow>
          <boxGeometry args={[1.6, 0.6, 0.9]} />
          <meshStandardMaterial color={vehicleColor} roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Cabin / roof */}
        <mesh position={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[1.2, 0.5, 0.8]} />
          <meshStandardMaterial color={vehicleColor} roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Wheels */}
        {[0.7, -0.7].map((z, i) => (
          <mesh key={`wheel-l-${i}`} position={[0.65, 0.15, z]}>
            <cylinderGeometry args={[0.15, 0.15, 0.12, 8]} />
            <meshStandardMaterial color={0x222222} roughness={0.8} />
          </mesh>
        ))}
        {[0.7, -0.7].map((z, i) => (
          <mesh key={`wheel-r-${i}`} position={[-0.65, 0.15, z]}>
            <cylinderGeometry args={[0.15, 0.15, 0.12, 8]} />
            <meshStandardMaterial color={0x222222} roughness={0.8} />
          </mesh>
        ))}
        {/* Headlights */}
        {config.year >= 2005 && (
          <>
            <mesh position={[0.82, 0.3, 0.3]}>
              <sphereGeometry args={[0.08, 6, 6]} />
              <meshStandardMaterial color={0xffff88} emissive={0xffffaa} emissiveIntensity={1.5} />
            </mesh>
            <mesh position={[0.82, 0.3, -0.3]}>
              <sphereGeometry args={[0.08, 6, 6]} />
              <meshStandardMaterial color={0xffffaa} emissive={0xffffcc} emissiveIntensity={1.5} />
            </mesh>
          </>
        )}
      </group>
    );
  }, [isHover, isAuto, vehicleColor, config.year]);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
      {mesh}
    </group>
  );
});

export default Vehicle;
