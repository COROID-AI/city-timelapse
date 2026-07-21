/**
 * Sky traffic — blimps (early eras) crossfading to drones (later eras).
 *
 * A few instanced emissive orbs travel slowly across the sky; density scales
 * with the era's skyTraffic value. Early eras show large slow blimps; future
 * eras show small fast drones. We blend two pools and crossfade by era.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Geos, scratch } from "./geometry";
import { eraState } from "../runtime/eraState";
import { variantOpacity, lerp } from "../utils/interp";
import type { InterpolatedEra } from "../utils/interp";

const COUNT = 6;

interface Flyer {
  phase: number;
  speed: number;
  alt: number;
  axis: number;
}

const FLYERS: Flyer[] = Array.from({ length: COUNT }, (_, i) => ({
  phase: i * 1.7,
  speed: 0.05 + (i % 3) * 0.02,
  alt: 28 + (i % 4) * 8,
  axis: i % 2 === 0 ? 0 : 1,
}));

export function SkyTraffic({
  rt,
}: {
  rt: React.RefObject<{ era: InterpolatedEra; clock: number }>;
}) {
  const blimpRef = useRef<THREE.InstancedMesh>(null);
  const droneRef = useRef<THREE.InstancedMesh>(null);

  const blimpMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#aa9966",
        roughness: 0.6,
        metalness: 0.1,
        emissive: "#332211",
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0,
      }),
    []
  );
  const droneMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2a3a5a",
        roughness: 0.4,
        metalness: 0.5,
        emissive: "#39e6ff",
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0,
      }),
    []
  );

  useFrame(() => {
    const e = rt.current.era;
    const ef = eraState.eraFloat;
    const clock = rt.current.clock;

    // Eras 0-2 favor blimps; 3-5 favor drones. Crossfade around the boundary.
    const blimpWeight = lerp(variantOpacity(ef, 0), variantOpacity(ef, 2), 0.5) + lerp(variantOpacity(ef, 1), 0, 0.5);
    const droneWeight = lerp(variantOpacity(ef, 4), variantOpacity(ef, 5), 0.5);

    if (blimpRef.current) {
      blimpMat.opacity = blimpWeight * 0.9;
      for (let i = 0; i < COUNT; i++) {
        const f = FLYERS[i]!;
        const t = clock * f.speed + f.phase;
        const u = ((t % 4) + 4) % 4 - 2;
        const lateral = Math.sin(t * 0.3) * 30;
        const pos = f.axis === 0 ? [u * 50, f.alt, lateral] : [lateral, f.alt, u * 50];
        scratch.dummy.position.set(pos[0]!, pos[1]!, pos[2]!);
        scratch.dummy.scale.set(4, 1.6, 2.4);
        scratch.dummy.rotation.set(0, t * 0.1, 0);
        scratch.dummy.updateMatrix();
        blimpRef.current.setMatrixAt(i, scratch.dummy.matrix);
      }
      blimpRef.current.count = Math.round(COUNT * e.skyTraffic);
      blimpRef.current.instanceMatrix.needsUpdate = true;
    }
    if (droneRef.current) {
      droneMat.opacity = droneWeight * 0.95;
      droneMat.emissiveIntensity = 0.8 + Math.sin(clock * 4) * 0.3;
      for (let i = 0; i < COUNT; i++) {
        const f = FLYERS[i]!;
        const t = clock * (f.speed * 3) + f.phase;
        const u = ((t % 4) + 4) % 4 - 2;
        const lateral = Math.sin(t * 0.6) * 25;
        const pos = f.axis === 0 ? [u * 45, f.alt + 4, lateral] : [lateral, f.alt + 4, u * 45];
        scratch.dummy.position.set(pos[0]!, pos[1]!, pos[2]!);
        scratch.dummy.scale.set(0.8, 0.8, 0.8);
        scratch.dummy.rotation.set(0, t, 0);
        scratch.dummy.updateMatrix();
        droneRef.current.setMatrixAt(i, scratch.dummy.matrix);
      }
      droneRef.current.count = Math.round(COUNT * e.skyTraffic);
      droneRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={blimpRef} args={[Geos.sphere(1, 10), blimpMat, COUNT]} />
      <instancedMesh ref={droneRef} args={[Geos.sphere(1, 6), droneMat, COUNT]} />
    </group>
  );
}
