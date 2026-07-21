/**
 * Buildings — instanced, era-reactive.
 *
 * Each plot becomes a building whose height, facade color/material, and window
 * emissive glow are driven by the interpolated era. Because height + facade are
 * continuous era properties, they interpolate *directly* (no pop). Window glow
 * emissive is also continuous. Heights ease up/down as the era sweeps.
 *
 * We use a small pool of InstancedMeshes keyed by footprint so repeated draw
 * calls are minimized (performance safeguard).
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLOTS } from "./layout";
import { Geos, scratch } from "./geometry";
import type { InterpolatedEra } from "../utils/interp";
import { clamp, lerp } from "../utils/interp";

const MIN_HEIGHT = 8;

export function Buildings({ rt }: { rt: React.RefObject<{ era: InterpolatedEra; clock: number }> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const topRef = useRef<THREE.InstancedMesh>(null);

  // Per-plot stable seeds + height variation
  const plots = useMemo(() => PLOTS, []);

  const baseMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.82,
        metalness: 0.05,
      }),
    []
  );
  const topMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.4,
        metalness: 0.3,
      }),
    []
  );

  useFrame(() => {
    const mesh = meshRef.current;
    const top = topRef.current;
    if (!mesh || !top) return;
    const e = rt.current.era;
    const hf = e.heightFactor;
    const skyline = e.skylineDensity;

    const baseColor = scratch.color.setHSL(e.buildingHue, e.buildingSat, e.buildingLight);
    const topColor = scratch.color.clone().offsetHSL(0, 0, 0.08);

    for (let i = 0; i < plots.length; i++) {
      const p = plots[i]!;
      // height: combine global factor with per-plot bias and skyline gating
      const tallChance = clamp(p.heightBias * 1.4 - 0.2, 0, 1);
      const skylineBoost = clamp(tallChance * skyline * 1.6, 0, 1);
      const h = Math.max(
        MIN_HEIGHT,
        lerp(MIN_HEIGHT, p.maxHeight, hf * (0.5 + skylineBoost))
      );
      // Body
      scratch.dummy.position.set(p.x, h / 2, p.z);
      scratch.dummy.rotation.set(0, p.rot, 0);
      scratch.dummy.scale.set(p.w, h, p.d);
      scratch.dummy.updateMatrix();
      mesh.setMatrixAt(i, scratch.dummy.matrix);
      mesh.setColorAt(i, baseColor);
      // Roof cap
      scratch.dummy.position.set(p.x, h + 0.4, p.z);
      scratch.dummy.scale.set(p.w * 1.02, 0.8, p.d * 1.02);
      scratch.dummy.updateMatrix();
      top.setMatrixAt(i, scratch.dummy.matrix);
      top.setColorAt(i, topColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    top.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (top.instanceColor) top.instanceColor.needsUpdate = true;

    // Facade material reacts to era: glassy eras get shinier + emissive windows.
    const glassy = e.eraA.buildings.facade === "glass" || e.eraA.buildings.facade === "neo-glass";
    const glassyB = e.eraB.buildings.facade === "glass" || e.eraB.buildings.facade === "neo-glass";
    const glassBlend = lerp(glassy ? 1 : 0, glassyB ? 1 : 0, e.t);
    baseMat.roughness = lerp(0.85, 0.25, glassBlend);
    baseMat.metalness = lerp(0.05, 0.6, glassBlend);
    baseMat.emissive.copy(e.windowColor);
    baseMat.emissiveIntensity = e.windowGlow * 0.5;
  });

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[Geos.unitBox(), baseMat, plots.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh ref={topRef} args={[Geos.unitBox(), topMat, plots.length]} castShadow />
    </group>
  );
}

/** Emissive window strips on building faces — gives the neon/glow read. */
export function WindowStrips({
  rt,
}: {
  rt: React.RefObject<{ era: InterpolatedEra; clock: number }>;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const plots = useMemo(() => PLOTS, []);
  // 4 faces per plot, 2 strips each => predictable count
  const count = plots.length * 4;

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        toneMapped: false,
        transparent: true,
        opacity: 0.9,
      }),
    []
  );

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const e = rt.current.era;
    const hf = e.heightFactor;
    const glow = e.windowGlow;
    mat.color.copy(e.windowColor);
    mat.opacity = clamp(0.15 + glow * 0.8, 0, 1);
    const skyline = e.skylineDensity;
    let idx = 0;
    for (const p of plots) {
      const tallChance = clamp(p.heightBias * 1.4 - 0.2, 0, 1);
      const skylineBoost = clamp(tallChance * skyline * 1.6, 0, 1);
      const h = Math.max(
        MIN_HEIGHT,
        lerp(MIN_HEIGHT, p.maxHeight, hf * (0.5 + skylineBoost))
      );
      const faces: [number, number, number][] = [
        [p.x, h / 2, p.z + p.d / 2 + 0.05],
        [p.x, h / 2, p.z - p.d / 2 - 0.05],
        [p.x + p.w / 2 + 0.05, h / 2, p.z],
        [p.x - p.w / 2 - 0.05, h / 2, p.z],
      ];
      const rots = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
      for (let f = 0; f < 4; f++) {
        const [x, y, z] = faces[f]!;
        scratch.dummy.position.set(x, y, z);
        scratch.dummy.rotation.set(0, rots[f]!, 0);
        scratch.dummy.scale.set(p.w * 0.82, h * 0.86, 1);
        scratch.dummy.updateMatrix();
        mesh.setMatrixAt(idx, scratch.dummy.matrix);
        idx++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    // hide unused (count is exact, but guard)
    mesh.count = Math.min(idx, count);
  });

  return (
    <instancedMesh ref={ref} args={[Geos.quad(), mat, count]} renderOrder={2} />
  );
}
