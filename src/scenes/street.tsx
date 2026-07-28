import { useRef } from 'react';
import type { EraData } from './eras';
import * as THREE from 'three';

interface Props {
  era: EraData;
}

export default function Street({ era }: Props) {
  const roadColor = era.roadColor;
  const sidewalkStyle = era.sidewalkStyle;

  // Sidewalk colors per era
  const getSidewalkColor = (): [number, number, number] => {
    switch (sidewalkStyle) {
      case 'dirt': return [0.45, 0.38, 0.30];
      case 'cobblestone': return [0.50, 0.48, 0.45];
      case 'concrete': return [0.70, 0.70, 0.68];
      case 'asphalt': return [0.35, 0.35, 0.37];
      case 'smart': return [0.40, 0.42, 0.45];
      case 'energy': return [0.25, 0.30, 0.35];
      default: return [0.5, 0.5, 0.5];
    }
  };

  const sidewalkColor = getSidewalkColor();

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={new THREE.Color(0.25, 0.25, 0.22)} roughness={0.95} />
      </mesh>

      {/* Main road - center */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 50]} />
        <meshStandardMaterial color={new THREE.Color(roadColor[0], roadColor[1], roadColor[2])} roughness={0.8} />
      </mesh>

      {/* Road markings - center line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[0.15, 50]} />
        <meshStandardMaterial color={new THREE.Color(0.9, 0.85, 0.3)} roughness={0.6} />
      </mesh>

      {/* Crosswalks */}
      {[-10, 0, 10].map((z, i) => (
        <group key={`cross-${i}`}>
          {[-3, -2, -1, 0, 1, 2, 3].map((x, j) => (
            <mesh key={j} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.006, z]} receiveShadow>
              <planeGeometry args={[0.5, 0.15]} />
              <meshStandardMaterial color={new THREE.Color(0.9, 0.9, 0.85)} roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Left sidewalk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-5.5, 0.02, 0]} receiveShadow>
        <planeGeometry args={[4, 50]} />
        <meshStandardMaterial color={new THREE.Color(sidewalkColor[0], sidewalkColor[1], sidewalkColor[2])} roughness={0.85} />
      </mesh>

      {/* Right sidewalk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.5, 0.02, 0]} receiveShadow>
        <planeGeometry args={[4, 50]} />
        <meshStandardMaterial color={new THREE.Color(sidewalkColor[0], sidewalkColor[1], sidewalkColor[2])} roughness={0.85} />
      </mesh>

      {/* Energy strips for futuristic eras */}
      {era.sidewalkStyle === 'energy' && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3.5, 0.03, 0]}>
            <planeGeometry args={[0.05, 50]} />
            <meshStandardMaterial color={new THREE.Color(0, 0.8, 1)} emissive={new THREE.Color(0, 0.8, 1)} emissiveIntensity={1.5} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.5, 0.03, 0]}>
            <planeGeometry args={[0.05, 50]} />
            <meshStandardMaterial color={new THREE.Color(0, 0.8, 1)} emissive={new THREE.Color(0, 0.8, 1)} emissiveIntensity={1.5} />
          </mesh>
        </>
      )}

      {/* Smart road markings */}
      {(era.sidewalkStyle === 'smart' || era.sidewalkStyle === 'energy') && (
        <>
          {/* Lane dividers */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2, 0.005, 0]}>
            <planeGeometry args={[0.1, 50]} />
            <meshStandardMaterial color={new THREE.Color(0, 0.6, 0.8)} emissive={new THREE.Color(0, 0.6, 0.8)} emissiveIntensity={0.5} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2, 0.005, 0]}>
            <planeGeometry args={[0.1, 50]} />
            <meshStandardMaterial color={new THREE.Color(0, 0.6, 0.8)} emissive={new THREE.Color(0, 0.6, 0.8)} emissiveIntensity={0.5} />
          </mesh>
        </>
      )}
    </group>
  );
}
