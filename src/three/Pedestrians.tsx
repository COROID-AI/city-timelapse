import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../store/useSceneStore';
import { crossfadedPedestrians, makeRng } from '../engine/sceneSampler';
import { eraOpacity, ERA_COUNT } from '../engine/eraSampler';
import type { PedestrianDef } from '../types';

// ---------------------------------------------------------------------------
// Pedestrians walk along the sidewalks. Like vehicles, they crossfade between
// the two bracketing eras because outfits/proportions change too much to morph.
// Bodies are simple capsules; colours tint per-era.
// ---------------------------------------------------------------------------

// Sidewalk paths — two loops around the block perimeter.
// We define a set of waypoints; peds walk linearly between consecutive ones.
const SIDEWALK_PATHS = [
  // Outer loop (clockwise around the block)
  [
    [-30, 8.5],
    [-8.5, 8.5],
    [-8.5, 30],
    [8.5, 30],
    [8.5, 8.5],
    [30, 8.5],
    [30, -8.5],
    [8.5, -8.5],
    [8.5, -30],
    [-8.5, -30],
    [-8.5, -8.5],
    [-30, -8.5],
  ],
];

// Pre-compute total path length + per-segment starts for each path.
function buildPath(points: number[][]) {
  const segs: { from: [number, number]; to: [number, number]; len: number; start: number }[] = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const from = points[i];
    const to = points[(i + 1) % points.length];
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    segs.push({
      from: [from[0], from[1]] as [number, number],
      to: [to[0], to[1]] as [number, number],
      len,
      start: total,
    });
    total += len;
  }
  return { segs, total };
}

const PATHS = /* @__PURE__ */ SIDEWALK_PATHS.map(buildPath);

const PEDS_PER_ERA = 8;

function samplePath(
  path: (typeof PATHS)[number],
  dist: number,
): [number, number, number, number] {
  const d = ((dist % path.total) + path.total) % path.total;
  let seg = path.segs[path.segs.length - 1];
  for (const s of path.segs) {
    if (d >= s.start && d <= s.start + s.len) {
      seg = s;
      break;
    }
  }
  const localT = seg.len > 0 ? (d - seg.start) / seg.len : 0;
  const x = seg.from[0] + (seg.to[0] - seg.from[0]) * localT;
  const z = seg.from[1] + (seg.to[1] - seg.from[1]) * localT;
  const angle = Math.atan2(seg.to[0] - seg.from[0], seg.to[1] - seg.from[1]);
  return [x, 0, z, angle];
}

// ---------------------------------------------------------------------------
// A single pedestrian mesh — capsule body + head, tinted by the def.
// ---------------------------------------------------------------------------
function PedestrianMesh({ def }: { def: PedestrianDef }) {
  return (
    <group scale={def.scale}>
      {/* Legs */}
      <mesh castShadow position={[0, 0.5, 0]}>
        <capsuleGeometry args={[0.16, 0.6, 4, 8]} />
        <meshStandardMaterial color={def.pantsColor} roughness={0.8} />
      </mesh>
      {/* Torso */}
      <mesh castShadow position={[0, 1.25, 0]}>
        <capsuleGeometry args={[0.22, 0.5, 4, 8]} />
        <meshStandardMaterial color={def.shirtColor} roughness={0.7} />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 1.75, 0]}>
        <sphereGeometry args={[0.15, 10, 8]} />
        <meshStandardMaterial color={def.hairColor} roughness={0.6} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// One era's worth of pedestrians.
// ---------------------------------------------------------------------------
function EraPedestrians({ eraIndex }: { eraIndex: number }) {
  const groupRef = useRef<THREE.Group>(null);

  const peds = useMemo(() => {
    const rng = makeRng(70000 + eraIndex * 211);
    const defs = crossfadedPedestrians(eraIndex)[0]?.items ?? [];
    return Array.from({ length: PEDS_PER_ERA }).map(() => {
      const def = defs[Math.floor(rng() * defs.length)] ?? defs[0];
      const speed = 0.8 + rng() * 0.6;
      const startDist = rng() * (PATHS[0]?.total ?? 100);
      const pathIdx = rng() > 0.5 ? 0 : 0;
      return { def, speed, startDist, pathIdx, phase: rng() * Math.PI * 2 };
    });
  }, [eraIndex]);

  useFrame((state, dt) => {
    if (!groupRef.current) return;
    const eraFloat = useSceneStore.getState().eraFloat;
    const myOpacity = eraOpacity(eraFloat, eraIndex);
    groupRef.current.visible = myOpacity > 0.01;
    const time = state.clock.elapsedTime;

    const children = groupRef.current.children;
    for (let i = 0; i < peds.length; i++) {
      const p = peds[i];
      const child = children[i] as THREE.Group | undefined;
      if (!child) continue;
      const dist = (p.startDist + time * p.speed) % (PATHS[p.pathIdx].total);
      const [x, , z, angle] = samplePath(PATHS[p.pathIdx], dist);
      child.position.set(x, 0, z);
      child.rotation.y = angle;
      // Bob up/down slightly to simulate walking
      child.position.y = Math.abs(Math.sin(time * 6 + p.phase)) * 0.06;
    }

    // Apply crossfade opacity
    groupRef.current.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        const mat = mesh.material as THREE.Material;
        mat.transparent = myOpacity < 0.999;
        (mat as THREE.MeshStandardMaterial).opacity = myOpacity;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {peds.map((p, i) => (
        <group key={i}>
          <PedestrianMesh def={p.def} />
        </group>
      ))}
    </group>
  );
}

export function Pedestrians() {
  return (
    <group>
      {Array.from({ length: ERA_COUNT }).map((_, ei) => (
        <EraPedestrians key={ei} eraIndex={ei} />
      ))}
    </group>
  );
}
