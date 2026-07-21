/**
 * Vehicles — instanced, per-era crossfading variants.
 *
 * Discrete era variant meshes: each era owns an InstancedMesh whose material
 * opacity = variantOpacity(eraFloat, eraIndex). As eraFloat sweeps from one era
 * to the next, the two adjacent variant meshes crossfade (no hard pop) while
 * every instance keeps animating along its lane. Density controls how many
 * instances are visible (the rest are scaled to 0).
 *
 * Shapes differ per era (boxy / muscle / sedan / pod) via per-instance scale
 * and a second emissive InstancedMesh for headlights/taillights.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HALF, ROAD_LANES } from "./layout";
import { Geos, scratch } from "./geometry";
import { ERAS } from "../data/eras";
import { eraState } from "../runtime/eraState";
import { variantOpacity } from "../utils/interp";
import type { InterpolatedEra } from "../utils/interp";

const MAX_PER_ERA = 18; // vehicles per era pool

interface VSpec {
  x: number;
  z: number;
  lane: number;
  phase: number;
  speed: number;
  bodyColor: THREE.Color;
  roofColor: THREE.Color;
  emissive: THREE.Color;
}

function buildSpecs(seed: number): VSpec[] {
  const specs: VSpec[] = [];
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let lane = 0; lane < ROAD_LANES.length; lane++) {
    const count = Math.ceil(MAX_PER_ERA / ROAD_LANES.length);
    for (let i = 0; i < count; i++) {
      const L = ROAD_LANES[lane]!;
      specs.push({
        x: L.axis === "x" ? -HALF + rnd() * (HALF * 2) : L.offset,
        z: L.axis === "z" ? -HALF + rnd() * (HALF * 2) : L.offset,
        lane,
        phase: rnd() * 100,
        speed: (0.6 + rnd() * 0.6) * L.dir,
        bodyColor: new THREE.Color(),
        roofColor: new THREE.Color(),
        emissive: new THREE.Color(),
      });
    }
  }
  return specs;
}

/** Shape silhouette (w,h,d, roofOffsetY, roofH) per era. */
function shapeFor(shape: string): { w: number; h: number; d: number; rY: number; rH: number } {
  switch (shape) {
    case "muscle":
      return { w: 2.0, h: 1.1, d: 4.4, rY: 0.4, rH: 0.7 };
    case "sedan":
      return { w: 2.0, h: 1.0, d: 4.2, rY: 0.45, rH: 0.6 };
    case "pod":
      return { w: 1.8, h: 1.1, d: 3.6, rY: 0.5, rH: 0.5 };
    case "boxy":
    default:
      return { w: 2.0, h: 1.4, d: 3.8, rY: 0.5, rH: 0.9 };
  }
}

export function Vehicles({
  rt,
}: {
  rt: React.RefObject<{ era: InterpolatedEra; clock: number }>;
}) {
  const specs = useMemo(() => buildSpecs(31), []);
  const bodyRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const lightRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  const bodyMats = useMemo(
    () =>
      ERAS.map(
        () =>
          new THREE.MeshStandardMaterial({
            roughness: 0.45,
            metalness: 0.35,
            transparent: true,
            opacity: 0,
          })
      ),
    []
  );
  const lightMats = useMemo(
    () =>
      ERAS.map(
        () =>
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            toneMapped: false,
          })
      ),
    []
  );

  // Precompute per-era colors into specs each frame is expensive; instead set
  // instance colors once per era on mount.
  const colorsInited = useRef(false);

  useFrame(() => {
    const e = rt.current.era;
    const ef = eraState.eraFloat;
    const clock = rt.current.clock;

    // Init instance colors once.
    if (!colorsInited.current) {
      for (let ei = 0; ei < ERAS.length; ei++) {
        const m = bodyRefs.current[ei];
        if (m) {
          const c = new THREE.Color(ERAS[ei]!.vehicles.body);
          for (let i = 0; i < specs.length; i++) m.setColorAt(i, c);
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
        const lm = lightRefs.current[ei];
        if (lm) {
          const c = new THREE.Color(ERAS[ei]!.vehicles.emissive);
          for (let i = 0; i < specs.length; i++) lm.setColorAt(i, c);
          if (lm.instanceColor) lm.instanceColor.needsUpdate = true;
        }
      }
      colorsInited.current = true;
    }

    for (let ei = 0; ei < ERAS.length; ei++) {
      const body = bodyRefs.current[ei];
      const lights = lightRefs.current[ei];
      if (!body || !lights) continue;
      const era = ERAS[ei]!;
      const shape = shapeFor(era.vehicles.shape);
      const scale = era.vehicles.scale;
      // Crossfade opacity between adjacent eased-era samples.
      const op = variantOpacity(ef, ei);
      bodyMats[ei]!.opacity = op;
      lightMats[ei]!.opacity = op * 0.9;
      // Density gates how many vehicles are active this era.
      const active = Math.round(specs.length * era.vehicles.density);
      let visible = 0;
      for (let i = 0; i < specs.length; i++) {
        const sp = specs[i]!;
        const L = ROAD_LANES[sp.lane]!;
        // animate position along the lane
        let x = sp.x;
        let z = sp.z;
        const travel = clock * sp.speed * 8 + sp.phase;
        if (L.axis === "x") {
          x = (((L.offset === L.offset ? travel : travel) % (HALF * 2)) + HALF * 4) % (HALF * 2) - HALF;
        } else {
          z = (((travel) % (HALF * 2)) + HALF * 4) % (HALF * 2) - HALF;
        }
        const rotY = L.axis === "x" ? (L.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : L.dir > 0 ? 0 : Math.PI;
        if (i < active && op > 0.01) {
          scratch.dummy.position.set(x, shape.h * 0.5 + 0.3, z);
          scratch.dummy.rotation.set(0, rotY, 0);
          scratch.dummy.scale.set(shape.w * scale, shape.h * scale, shape.d * scale);
          scratch.dummy.updateMatrix();
          body.setMatrixAt(visible, scratch.dummy.matrix);
          // headlight dot in front
          scratch.dummy.position.set(x + Math.cos(rotY) * 0.0, shape.h * 0.6, z);
          scratch.dummy.scale.set(0.4, 0.25, 0.25);
          scratch.dummy.updateMatrix();
          lights.setMatrixAt(visible, scratch.dummy.matrix);
          visible++;
        } else {
          // hide
          scratch.dummy.scale.set(0, 0, 0);
          scratch.dummy.updateMatrix();
          body.setMatrixAt(visible, scratch.dummy.matrix);
        }
      }
      body.count = Math.min(visible, specs.length);
      lights.count = Math.min(visible, specs.length);
      body.instanceMatrix.needsUpdate = true;
      lights.instanceMatrix.needsUpdate = true;
    }
    void e;
  });

  return (
    <group>
      {ERAS.map((_, ei) => (
        <group key={ei}>
          <instancedMesh
            ref={(el) => {
              bodyRefs.current[ei] = el;
            }}
            args={[Geos.unitBox(), bodyMats[ei]!, specs.length]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={(el) => {
              lightRefs.current[ei] = el;
            }}
            args={[Geos.sphere(1, 6), lightMats[ei]!, specs.length]}
          />
        </group>
      ))}
    </group>
  );
}
