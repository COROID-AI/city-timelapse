import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { EraData } from './eras';
import * as THREE from 'three';

interface Props {
  era: EraData;
}

export default function Particles({ era }: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 500;

  const positions = useRef(new Float32Array(count * 3));
  const velocities = useRef(new Float32Array(count * 3));
  const colors = useRef(new Float32Array(count * 3));

  // Initialize particles
  for (let i = 0; i < count; i++) {
    positions.current[i * 3] = (Math.random() - 0.5) * 80;
    positions.current[i * 3 + 1] = Math.random() * 40;
    positions.current[i * 3 + 2] = (Math.random() - 0.5) * 80;
    velocities.current[i * 3] = (Math.random() - 0.5) * 0.02;
    velocities.current[i * 3 + 1] = -Math.random() * 0.03 - 0.01;
    velocities.current[i * 3 + 2] = (Math.random() - 0.5) * 0.02;

    // Default color
    colors.current[i * 3] = 1;
    colors.current[i * 3 + 1] = 1;
    colors.current[i * 3 + 2] = 1;
  }

  useFrame(() => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const col = pointsRef.current.geometry.attributes.color.array as Float32Array;

    for (let i = 0; i < count; i++) {
      pos[i * 3] += velocities.current[i * 3];
      pos[i * 3 + 1] += velocities.current[i * 3 + 1];
      pos[i * 3 + 2] += velocities.current[i * 3 + 2];

      // Reset particles that go too low
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3] = (Math.random() - 0.5) * 80;
        pos[i * 3 + 1] = 40;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
      }

      // Color based on particle type
      if (era.particleType === 'aurora') {
        col[i * 3] = 0;
        col[i * 3 + 1] = 0.8 + Math.sin(i * 0.1) * 0.2;
        col[i * 3 + 2] = 0.8;
      } else if (era.particleType === 'data') {
        col[i * 3] = 0.3;
        col[i * 3 + 1] = 0.5;
        col[i * 3 + 2] = 1;
      } else if (era.particleType === 'embers') {
        col[i * 3] = 1;
        col[i * 3 + 1] = 0.4 + Math.sin(i * 0.05) * 0.2;
        col[i * 3 + 2] = 0.2;
      } else {
        col[i * 3] = 1;
        col[i * 3 + 1] = 1;
        col[i * 3 + 2] = 1;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.color.needsUpdate = true;
  });

  if (era.particleType === 'none') return null;

  const color = new THREE.Color(
    era.particleType === 'aurora' ? 0 : era.particleType === 'data' ? 0.3 : era.particleType === 'embers' ? 1 : 1,
    era.particleType === 'aurora' ? 0.8 : era.particleType === 'data' ? 0.5 : era.particleType === 'embers' ? 0.6 : 1,
    era.particleType === 'aurora' ? 0.8 : era.particleType === 'data' ? 1 : era.particleType === 'embers' ? 0.3 : 1,
  );

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions.current}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors.current}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={era.particleType === 'aurora' ? 0.3 : 0.08}
        vertexColors
        transparent
        opacity={era.particleType === 'aurora' ? 0.4 : 0.6}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
