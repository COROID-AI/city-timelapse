/**
 * Pedestrians — instanced, per-era crossfading variants.
 *
 * Same crossfade model as Vehicles: each era owns a pool of instanced figures
 * whose opacity = variantOpacity(eraFloat, eraIndex). A figure is a small
 * capsule-like stack (legs + torso + head) approximated with two boxes plus a
 * sphere; we animate a subtle bob so the street feels populated. Outfit colors
 * and silhouettes differ per era (broad vs slim, hats/visors/bags).
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildPedestrianSpots } from "./layout";
import { Geos, scratch } from "./geometry";
import { ERAS } from "../data/eras";
import { eraState } from "../runtime/eraState";
import { variantOpacity } from "../utils/interp";
import type { InterpolatedEra } from "../utils/interp";

const SPOTS = buildPedestrianSpots(60);

interface Fig {
  baseX: number;
  baseZ: number;
  phase: number;
  radius: number;
  speed: number;
}

const FIGS: Fig[] = SPOTS.map((s) => ({
  baseX: s.x,
  baseZ: s.z,
  phase: s.phase,
  radius: 1.5 + (Math.abs(Math.sin(s.phase)) * 1.5),
  speed: 0.4 + (Math.abs(Math.cos(s.phase)) * 0.5),
}));

export function Pedestrians({
  rt,
}: {
  rt: React.RefObject<{ era: InterpolatedEra; clock: number }>;
}) {
  const bodyRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const headRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  const torsoMats = useMemo(
    () =>
      ERAS.map(
        () =>
          new THREE.MeshStandardMaterial({
            roughness: 0.8,
            metalness: 0.0,
            transparent: true,
            opacity: 0,
          })
      ),
    []
  );
  const headMats = useMemo(
    () =>
      ERAS.map(
        () =>
          new THREE.MeshStandardMaterial({
            roughness: 0.7,
            metalness: 0.0,
            transparent: true,
            opacity: 0,
          })
      ),
    []
  );

  const colorsInited = useRef(false);

  // silhouette scale per era shape
  function silFor(shape: string): { w: number; h: number } {
    switch (shape) {
      case "broad":
        return { w: 0.95, h: 1.0 };
      case "slim":
        return { w: 0.7, h: 0.92 };
      default:
        return { w: 0.82, h: 0.96 };
    }
  }

  useFrame(() => {
    const ef = eraState.eraFloat;
    const clock = rt.current.clock;
    void rt.current.era;

    if (!colorsInited.current) {
      for (let ei = 0; ei < ERAS.length; ei++) {
        const m = bodyRefs.current[ei];
        if (m) {
          const c = new THREE.Color(ERAS[ei]!.pedestrians.torso);
          for (let i = 0; i < FIGS.length; i++) m.setColorAt(i, c);
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
        const hm = headRefs.current[ei];
        if (hm) {
          const c = new THREE.Color(ERAS[ei]!.pedestrians.hair);
          for (let i = 0; i < FIGS.length; i++) hm.setColorAt(i, c);
          if (hm.instanceColor) hm.instanceColor.needsUpdate = true;
        }
      }
      colorsInited.current = true;
    }

    for (let ei = 0; ei < ERAS.length; ei++) {
      const body = bodyRefs.current[ei];
      const head = headRefs.current[ei];
      if (!body || !head) continue;
      const era = ERAS[ei]!;
      const op = variantOpacity(ef, ei);
      torsoMats[ei]!.opacity = op;
      headMats[ei]!.opacity = op;
      const sil = silFor(era.pedestrians.shape);
      const active = Math.round(FIGS.length * era.pedestrians.density);
      let visible = 0;
      for (let i = 0; i < FIGS.length; i++) {
        const f = FIGS[i]!;
        if (i < active && op > 0.01) {
          const ang = clock * f.speed + f.phase;
          const x = f.baseX + Math.cos(ang) * f.radius;
          const z = f.baseZ + Math.sin(ang) * f.radius;
          const bob = Math.abs(Math.sin(ang * 2)) * 0.12;
          // torso
          scratch.dummy.position.set(x, 0.9 + bob, z);
          scratch.dummy.rotation.set(0, -ang, 0);
          scratch.dummy.scale.set(sil.w, sil.h * 1.4, sil.w * 0.6);
          scratch.dummy.updateMatrix();
          body.setMatrixAt(visible, scratch.dummy.matrix);
          // head
          scratch.dummy.position.set(x, 1.75 + bob, z);
          scratch.dummy.scale.set(0.32, 0.42, 0.32);
          scratch.dummy.updateMatrix();
          head.setMatrixAt(visible, scratch.dummy.matrix);
          visible++;
        } else {
          scratch.dummy.scale.set(0, 0, 0);
          scratch.dummy.updateMatrix();
          body.setMatrixAt(visible, scratch.dummy.matrix);
        }
      }
      body.count = Math.min(visible, FIGS.length);
      head.count = Math.min(visible, FIGS.length);
      body.instanceMatrix.needsUpdate = true;
      head.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {ERAS.map((_, ei) => (
        <group key={ei}>
          <instancedMesh
            ref={(el) => {
              bodyRefs.current[ei] = el;
            }}
            args={[Geos.unitBox(), torsoMats[ei]!, FIGS.length]}
            castShadow
          />
          <instancedMesh
            ref={(el) => {
              headRefs.current[ei] = el;
            }}
            args={[Geos.sphere(1, 6), headMats[ei]!, FIGS.length]}
            castShadow
          />
        </group>
      ))}
    </group>
  );
}
