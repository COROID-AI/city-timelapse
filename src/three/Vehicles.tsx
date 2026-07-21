import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../store/useSceneStore';
import { crossfadedVehicles, makeRng } from '../engine/sceneSampler';
import { eraOpacity } from '../engine/eraSampler';
import type { VehicleDef } from '../types';

// ---------------------------------------------------------------------------
// Vehicles drive along the two roads. Because silhouettes change too much to
// morph (a 1945 sedan ≠ a 2055 pod), we render the bracketing eras together
// and crossfade their opacity. Within an era, vehicles loop along the road.
// ---------------------------------------------------------------------------

// Lane definitions: two directions per road, offset from centre.
const LANES = [
  // East-bound (along +X) at z = +2.5
  { axis: 'x' as const, dir: 1, offset: 2.5, length: 140 },
  // West-bound (along -X) at z = -2.5
  { axis: 'x' as const, dir: -1, offset: -2.5, length: 140 },
  // North-bound (along -Z) at x = +2.5
  { axis: 'z' as const, dir: -1, offset: 2.5, length: 140 },
  // South-bound (along +Z) at x = -2.5
  { axis: 'z' as const, dir: 1, offset: -2.5, length: 140 },
];

// Deterministic per-lane vehicle positions so the scene is stable.
const VEHICLES_PER_LANE = 4;
const LANE_HALF = 70;

function vehiclePositions() {
  const rng = makeRng(99173);
  return LANES.map((lane) => {
    const arr: number[] = [];
    for (let i = 0; i < VEHICLES_PER_LANE; i++) {
      arr.push((rng() - 0.5) * lane.length);
    }
    return arr;
  });
}

const POSITIONS = /* @__PURE__ */ vehiclePositions();

// ---------------------------------------------------------------------------
// Procedural vehicle shape — built from primitives, scaled per archetype.
// ---------------------------------------------------------------------------
function VehicleMesh({ def }: { def: VehicleDef }) {
  // Build the geometry group once; it's cheap (a few boxes).
  // The material is tinted per-era by the parent via material.color.
  return (
    <group scale={def.scale}>
      {/* Body */}
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[3.8, 0.9, 1.7]} />
        <meshStandardMaterial color={def.bodyColor} roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Cabin / roof — shape varies by archetype */}
      <mesh castShadow position={[def.shape === 'pod' ? 0 : -0.2, 1.2, 0]}>
        <boxGeometry
          args={[
            def.shape === 'classic' ? 2.4 : def.shape === 'muscle' ? 2.6 : def.shape === 'pod' ? 3.6 : 2.8,
            0.7,
            1.5,
          ]}
        />
        <meshStandardMaterial
          color={def.roofColor}
          roughness={def.shape === 'pod' ? 0.1 : 0.3}
          metalness={def.shape === 'pod' || def.shape === 'ev' ? 0.7 : 0.3}
          transparent={def.shape === 'pod'}
          opacity={def.shape === 'pod' ? 0.7 : 1}
        />
      </mesh>
      {/* Wheels — 4 */}
      {[
        [1.3, 0.3, 0.85],
        [1.3, 0.3, -0.85],
        [-1.3, 0.3, 0.85],
        [-1.3, 0.3, -0.85],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.35, 0.35, 0.3, 10]} />
          <meshStandardMaterial color="#111" roughness={0.8} />
        </mesh>
      ))}
      {/* Headlights — emissive for night eras */}
      <mesh position={[1.95, 0.6, 0.55]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshBasicMaterial color="#fff8e0" />
      </mesh>
      <mesh position={[1.95, 0.6, -0.55]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshBasicMaterial color="#fff8e0" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// One lane of traffic for a specific era.
// ---------------------------------------------------------------------------
function EraTraffic({ eraIndex }: { eraIndex: number }) {
  const groupRef = useRef<THREE.Group>(null);

  // Pre-compute vehicle definitions for this era (stable, once).
  const vehicles = useMemo(() => {
    const rng = makeRng(40000 + eraIndex * 137);
    const defs = crossfadedVehicles(eraIndex)[0]?.items ?? [];
    return LANES.map((lane, li) =>
      POSITIONS[li].map((startX) => {
        const vdef = defs[Math.floor(rng() * defs.length)] ?? defs[0];
        return { startX, lane, def: vdef };
      }),
    );
  }, [eraIndex]);

  // Mutable per-vehicle positions stored numerically — no per-frame string
  // allocation. Initialised once from startX values.
  const positions = useRef<number[]>([]);
  if (positions.current.length === 0) {
    const arr: number[] = [];
    for (const lane of vehicles) for (const v of lane) arr.push(v.startX);
    positions.current = arr;
  }

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    const eraFloat = useSceneStore.getState().eraFloat;
    // Only update when this era has meaningful opacity.
    const myOpacity = eraOpacity(eraFloat, eraIndex);
    groupRef.current.visible = myOpacity > 0.01;

    const children = groupRef.current.children;
    const pos = positions.current;
    let ci = 0;
    let pi = 0;
    for (let li = 0; li < vehicles.length; li++) {
      for (let vi = 0; vi < vehicles[li].length; vi++) {
        const v = vehicles[li][vi];
        const child = children[ci] as THREE.Group | undefined;
        ci++;
        if (!child) {
          pi++;
          continue;
        }
        const speed = v.def.speed * v.lane.dir;
        // Advance position numerically (no string conversion)
        let p = pos[pi] + speed * dt;
        // Wrap around
        if (v.lane.dir > 0 && p > LANE_HALF) p = -LANE_HALF;
        if (v.lane.dir < 0 && p < -LANE_HALF) p = LANE_HALF;
        pos[pi] = p;
        pi++;

        if (v.lane.axis === 'x') {
          child.position.set(p, 0, v.lane.offset);
          child.rotation.y = v.lane.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        } else {
          child.position.set(v.lane.offset, 0, p);
          child.rotation.y = v.lane.dir > 0 ? 0 : Math.PI;
        }
      }
    }
    // Apply opacity to all child materials
    groupRef.current.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        const mat = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            m.transparent = myOpacity < 0.999;
            (m as THREE.MeshStandardMaterial).opacity = myOpacity;
          });
        } else {
          mat.transparent = myOpacity < 0.999;
          (mat as THREE.MeshStandardMaterial).opacity = myOpacity;
        }
      }
    });
  });

  return (
    <group ref={groupRef}>
      {vehicles.map((lane, li) =>
        lane.map((v, vi) => (
          <group key={`${li}-${vi}`}>
            <VehicleMesh def={v.def} />
          </group>
        )),
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// All six eras of traffic, only two visible at a time (crossfaded).
// ---------------------------------------------------------------------------
import { ERA_COUNT } from '../engine/eraSampler';

export function Vehicles() {
  return (
    <group>
      {Array.from({ length: ERA_COUNT }).map((_, ei) => (
        <EraTraffic key={ei} eraIndex={ei} />
      ))}
    </group>
  );
}
