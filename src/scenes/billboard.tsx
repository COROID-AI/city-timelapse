import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { EraData } from './eras';
import * as THREE from 'three';

interface Props {
  era: EraData;
}

export default function Billboard({ era }: Props) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    // Holographic billboard flicker
    if (era.billboardAdStyle === 'holographic') {
      const flicker = 0.9 + Math.sin(clock.getElapsedTime() * 5) * 0.1;
      const child = ref.current.children[0] as THREE.Mesh;
      if (child && child.material) {
        (child.material as THREE.MeshStandardMaterial).emissiveIntensity = flicker * 2;
      }
    }
  });

  return (
    <group ref={ref} position={[0, 0, -18]}>
      {/* Billboard structure */}
      <group position={[0, 6, 0]}>
        {/* Support posts */}
        <mesh castShadow position={[-3, -2, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 4, 8]} />
          <meshStandardMaterial color={new THREE.Color(0.2, 0.2, 0.22)} roughness={0.7} metalness={0.3} />
        </mesh>
        <mesh castShadow position={[3, -2, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 4, 8]} />
          <meshStandardMaterial color={new THREE.Color(0.2, 0.2, 0.22)} roughness={0.7} metalness={0.3} />
        </mesh>

        {era.billboardAdStyle === 'handpainted' && <BillboardHandpainted />}
        {era.billboardAdStyle === 'neon' && <BillboardNeon />}
        {era.billboardAdStyle === 'digital' && <BillboardDigital />}
        {era.billboardAdStyle === 'holographic' && <BillboardHolographic />}
      </group>
    </group>
  );
}

function BillboardHandpainted() {
  return (
    <group>
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[7, 3.5, 0.2]} />
        <meshStandardMaterial color={new THREE.Color(0.3, 0.25, 0.2)} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.06]}>
        <planeGeometry args={[6.5, 3]} />
        <meshStandardMaterial color={new THREE.Color(0.85, 0.78, 0.65)} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, 0.07]}>
        <planeGeometry args={[5, 0.4]} />
        <meshStandardMaterial color={new THREE.Color(0.15, 0.1, 0.05)} roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.5, 0.07]}>
        <circleGeometry args={[0.8, 16]} />
        <meshStandardMaterial color={new THREE.Color(0.8, 0.3, 0.2)} roughness={0.8} />
      </mesh>
    </group>
  );
}

function BillboardNeon() {
  return (
    <group>
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[7, 3.5, 0.2]} />
        <meshStandardMaterial color={new THREE.Color(0.05, 0.05, 0.08)} roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.06]}>
        <planeGeometry args={[6.5, 3]} />
        <meshStandardMaterial color={new THREE.Color(0.08, 0.05, 0.12)} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.3, 0.07]}>
        <boxGeometry args={[5, 0.25, 0.02]} />
        <meshStandardMaterial color={new THREE.Color(1, 0, 0.4)} emissive={new THREE.Color(1, 0, 0.4)} emissiveIntensity={3} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[6.3, 0.05, 0.02]} />
        <meshStandardMaterial color={new THREE.Color(1, 0.4, 0)} emissive={new THREE.Color(1, 0.4, 0)} emissiveIntensity={2.5} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[0.05, 2.8, 0.02]} />
        <meshStandardMaterial color={new THREE.Color(1, 0.4, 0)} emissive={new THREE.Color(1, 0.4, 0)} emissiveIntensity={2.5} />
      </mesh>
      {[-2.5, -1.25, 0, 1.25, 2.5].map((x, i) => (
        <mesh key={i} position={[x, -0.5, 0.07]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color={new THREE.Color(0, 0.8, 1)} emissive={new THREE.Color(0, 0.8, 1)} emissiveIntensity={2} />
        </mesh>
      ))}
    </group>
  );
}

function BillboardDigital() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const hue = (t * 0.05) % 1;
    const color = new THREE.Color().setHSL(hue, 0.8, 0.5);
    if (ref.current.material) {
      (ref.current.material as THREE.MeshStandardMaterial).color = color;
      (ref.current.material as THREE.MeshStandardMaterial).emissive = color;
    }
  });

  return (
    <group>
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[7, 3.5, 0.15]} />
        <meshStandardMaterial color={new THREE.Color(0.1, 0.1, 0.12)} roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh ref={ref} position={[0, 0, 0.05]}>
        <planeGeometry args={[6.5, 3]} />
        <meshStandardMaterial color={new THREE.Color(0.2, 0.5, 0.8)} emissive={new THREE.Color(0.2, 0.5, 0.8)} emissiveIntensity={1.5} roughness={0.1} metalness={0.5} />
      </mesh>
      {Array.from({ length: 15 }).map((_, i) => (
        <mesh key={i} position={[0, -1.3 + i * 0.2, 0.06]}>
          <planeGeometry args={[6.5, 0.01]} />
          <meshStandardMaterial color={new THREE.Color(0, 0, 0)} transparent opacity={0.15} />
        </mesh>
      ))}
    </group>
  );
}

function BillboardHolographic() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const hue = (t * 0.08) % 1;
    const color = new THREE.Color().setHSL(hue, 0.9, 0.6);
    if (ref.current.material) {
      (ref.current.material as THREE.MeshStandardMaterial).color = color;
      (ref.current.material as THREE.MeshStandardMaterial).emissive = color;
    }
  });

  return (
    <group>
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[0.5, 0.7, 0.3, 8]} />
        <meshStandardMaterial color={new THREE.Color(0.15, 0.2, 0.25)} roughness={0.1} metalness={0.9} />
      </mesh>
      <mesh ref={ref} position={[-0.5, 0, 0]}>
        <planeGeometry args={[2.5, 3]} />
        <meshStandardMaterial
          color={new THREE.Color(0.3, 0.8, 1)}
          emissive={new THREE.Color(0.3, 0.8, 1)}
          emissiveIntensity={2}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0.5, 0, 0]}>
        <planeGeometry args={[2.5, 3]} />
        <meshStandardMaterial
          color={new THREE.Color(0.8, 0.3, 1)}
          emissive={new THREE.Color(0.8, 0.3, 1)}
          emissiveIntensity={2}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, -0.75, 0]}>
        <coneGeometry args={[1.5, 1.5, 4, 1, true]} />
        <meshStandardMaterial color={new THREE.Color(0, 0.5, 0.8)} transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
