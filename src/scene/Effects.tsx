import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import type { EraInfo } from '../eras/types';

interface EffectsProps {
  era: EraInfo;
}

export function Effects({ era }: EffectsProps) {
  return (
    <group>
      {/* Fog */}
      <Fog era={era} />

      {/* Special effects per era */}
      {era.specialEffects.includes('neon_flicker') && <NeonFlickers />}
      {era.specialEffects.includes('scanlines') && <Scanlines />}
      {era.specialEffects.includes('green_glow') && <GreenGlow />}
      {era.specialEffects.includes('hologram') && <Holograms />}
      {era.specialEffects.includes('particle_rain') && <ParticleRain />}
      {era.specialEffects.includes('flight_paths') && <FlightPaths />}
    </group>
  );
}

function Fog({ era }: { era: EraInfo }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (matRef.current) {
      matRef.current.opacity = era.fogDensity * 100;
      matRef.current.color.set(era.fogColor);
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[150, 32, 32]} />
      <meshStandardMaterial
        ref={matRef}
        color={era.fogColor}
        transparent
        opacity={era.fogDensity * 100}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function NeonFlickers() {
  const meshRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  useFrame(({ clock }) => {
    for (let i = 0; i < meshRefs.current.length; i++) {
      const mat = meshRefs.current[i];
      if (!mat) continue;
      const flicker = Math.sin(clock.getElapsedTime() * (5 + i * 2)) > 0.7 ? 1 : 0.2;
      mat.emissiveIntensity = flicker * 2;
    }
  });

  return (
    <group>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[Math.sin(i) * 15, 8 + i * 2, Math.cos(i) * 15]}>
          <boxGeometry args={[0.1, 4, 0.1]} />
          <meshStandardMaterial
            color="#ff00ff"
            emissive="#ff00ff"
            emissiveIntensity={2}
            transparent
            opacity={0.8}
            ref={(el) => { meshRefs.current[i] = el; }}
          />
        </mesh>
      ))}
    </group>
  );
}

function Scanlines() {
  return (
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial
        color="#000000"
        transparent
        opacity={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GreenGlow() {
  const meshRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  useFrame(({ clock }) => {
    for (let i = 0; i < meshRefs.current.length; i++) {
      const mat = meshRefs.current[i];
      if (!mat) continue;
      const pulse = 0.5 + Math.sin(clock.getElapsedTime() + i) * 0.3;
      mat.emissiveIntensity = pulse;
    }
  });

  return (
    <group>
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={i} position={[Math.sin(i * 0.7) * 20, 5 + i, Math.cos(i * 0.7) * 20]}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshStandardMaterial
            color="#00ff88"
            emissive="#00ff88"
            emissiveIntensity={1}
            transparent
            opacity={0.6}
            ref={(el) => { meshRefs.current[i] = el; }}
          />
        </mesh>
      ))}
    </group>
  );
}

function Holograms() {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.getElapsedTime() * 0.5;
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 20, 0]}>
        <torusGeometry args={[3, 0.1, 8, 32]} />
        <meshStandardMaterial
          color="#00ffff"
          emissive="#00ffff"
          emissiveIntensity={2}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

function ParticleRain() {
  const points = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 1000; i++) {
      pts.push((Math.random() - 0.5) * 100, Math.random() * 60, (Math.random() - 0.5) * 100);
    }
    return new Float32Array(pts);
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={1000}
          array={points}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.1} color="#00ccff" transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

function FlightPaths() {
  return (
    <group>
      {[...Array(5)].map((_, i) => (
        <FlightPath key={i} index={i} />
      ))}
    </group>
  );
}

function FlightPath({ index }: { index: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = (clock.getElapsedTime() * 0.3 + index * 0.5) % 2;
    groupRef.current.position.x = Math.sin(index) * 30 + t * 20 - 20;
    groupRef.current.position.z = Math.cos(index) * 30;
    groupRef.current.position.y = 15 + index * 5;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial
          color="#00ffff"
          emissive="#00ffff"
          emissiveIntensity={3}
        />
      </mesh>
    </group>
  );
}
