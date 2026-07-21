import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../store/useSceneStore';
import { sampleStreetProp } from '../engine/sceneSampler';

// ---------------------------------------------------------------------------
// Street furniture — lamps, benches, trees. These morph continuously (colour
// + lamp intensity) rather than crossfade, because their silhouettes are
// similar enough across eras. Lamps are instanced for performance.
// ---------------------------------------------------------------------------

// Lamp positions along the sidewalks (deterministic).
const LAMP_POSITIONS: Array<[number, number, number]> = [
  [-22, 0, 8.5], [22, 0, 8.5], [-22, 0, -8.5], [22, 0, -8.5],
  [8.5, 0, -22], [8.5, 0, 22], [-8.5, 0, -22], [-8.5, 0, 22],
  [-35, 0, 8.5], [35, 0, 8.5], [-35, 0, -8.5], [35, 0, -8.5],
];

const BENCH_POSITIONS: Array<[number, number, number, number]> = [
  // [x, y, z, rotY]
  [-15, 0, 8.8, 0], [15, 0, 8.8, 0],
  [-15, 0, -8.8, Math.PI], [15, 0, -8.8, Math.PI],
];

const TREE_POSITIONS: Array<[number, number, number]> = [
  [-12, 0, 8.8], [12, 0, 8.8], [-12, 0, -8.8], [12, 0, -8.8],
  [8.8, 0, -12], [8.8, 0, 12], [-8.8, 0, -12], [-8.8, 0, 12],
];

export function StreetProps() {
  // Shared materials, updated in place per frame.
  const lampPoleMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.6, metalness: 0.7 }),
    [],
  );
  const lampHeadMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fff',
        emissive: '#ffd080',
        emissiveIntensity: 0,
        roughness: 0.3,
      }),
    [],
  );
  const benchMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    [],
  );
  const trunkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#4a3828', roughness: 0.9 }),
    [],
  );
  const foliageMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    [],
  );

  // Collect lamp head refs for per-frame emissive updates
  const lampHeadRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(() => {
    const eraFloat = useSceneStore.getState().eraFloat;
    const sp = sampleStreetProp(eraFloat);

    lampHeadMat.emissive.setRGB(...sp.lampColor);
    lampHeadMat.emissiveIntensity = sp.lampIntensity * 3;
    benchMat.color.setRGB(...sp.benchColor);
    foliageMat.color.setRGB(...sp.treeFoliage);
  });

  return (
    <group>
      {/* Lamps */}
      {LAMP_POSITIONS.map((pos, i) => (
        <group key={`lamp-${i}`} position={pos}>
          {/* Pole */}
          <mesh castShadow material={lampPoleMat} position={[0, 2.5, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 5, 8]} />
          </mesh>
          {/* Arm */}
          <mesh castShadow material={lampPoleMat} position={[0.4, 4.8, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.05, 0.05, 0.8, 6]} />
          </mesh>
          {/* Head / bulb */}
          <mesh
            ref={(el) => { lampHeadRefs.current[i] = el; }}
            castShadow
            material={lampHeadMat}
            position={[0.4, 4.7, 0]}
          >
            <sphereGeometry args={[0.18, 10, 8]} />
          </mesh>
        </group>
      ))}

      {/* Benches */}
      {BENCH_POSITIONS.map((b, i) => (
        <group key={`bench-${i}`} position={[b[0], b[1], b[2]]} rotation-y={b[3]}>
          {/* Seat */}
          <mesh castShadow material={benchMat} position={[0, 0.5, 0]}>
            <boxGeometry args={[1.8, 0.08, 0.5]} />
          </mesh>
          {/* Backrest */}
          <mesh castShadow material={benchMat} position={[0, 0.8, -0.22]}>
            <boxGeometry args={[1.8, 0.5, 0.06]} />
          </mesh>
          {/* Legs */}
          <mesh castShadow material={benchMat} position={[-0.7, 0.25, 0]}>
            <boxGeometry args={[0.08, 0.5, 0.5]} />
          </mesh>
          <mesh castShadow material={benchMat} position={[0.7, 0.25, 0]}>
            <boxGeometry args={[0.08, 0.5, 0.5]} />
          </mesh>
        </group>
      ))}

      {/* Trees */}
      {TREE_POSITIONS.map((pos, i) => (
        <Tree key={`tree-${i}`} position={pos} trunkMat={trunkMat} foliageMat={foliageMat} />
      ))}
    </group>
  );
}

// Tree — foliage opacity scales with treeDensity so sparse/present eras differ.
function Tree({
  position,
  trunkMat,
  foliageMat,
}: {
  position: [number, number, number];
  trunkMat: THREE.Material;
  foliageMat: THREE.Material;
}) {
  const foliageRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const eraFloat = useSceneStore.getState().eraFloat;
    const sp = sampleStreetProp(eraFloat);
    if (foliageRef.current) {
      foliageRef.current.visible = sp.treeDensity > 0.15;
      const s = 0.5 + sp.treeDensity * 0.8;
      foliageRef.current.scale.setScalar(s);
    }
  });

  return (
    <group position={position}>
      {/* Trunk */}
      <mesh castShadow material={trunkMat} position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 2.4, 8]} />
      </mesh>
      {/* Foliage — three overlapping spheres */}
      <group ref={foliageRef} position={[0, 2.8, 0]}>
        <mesh castShadow material={foliageMat} position={[0, 0, 0]}>
          <sphereGeometry args={[1.0, 10, 8]} />
        </mesh>
        <mesh castShadow material={foliageMat} position={[0.5, 0.3, 0.3]}>
          <sphereGeometry args={[0.7, 8, 6]} />
        </mesh>
        <mesh castShadow material={foliageMat} position={[-0.4, 0.2, -0.2]}>
          <sphereGeometry args={[0.8, 8, 6]} />
        </mesh>
      </group>
    </group>
  );
}
