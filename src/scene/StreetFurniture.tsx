/**
 * Street furniture: lamps, trees, benches — continuous interpolation where
 * possible (lamp color/intensity) plus era-keyed style swaps for the lamp head
 * mesh handled via opacity crossfade on a small variant set.
 *
 * Trees and benches interpolate material color continuously; lamp poles are
 * shared geometry with era-reactive emissive heads.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FURNITURE } from "./layout";
import { Geos, scratch } from "./geometry";
import { ERAS } from "../data/eras";
import { eraState } from "../runtime/eraState";
import { variantOpacity } from "../utils/interp";
import type { InterpolatedEra } from "../utils/interp";

export function StreetFurniture({
  rt,
}: {
  rt: React.RefObject<{ era: InterpolatedEra; clock: number }>;
}) {
  const { lamps, trees, benches } = FURNITURE;

  const lampHeadRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const headMats = useMemo(
    () =>
      ERAS.map(
        () =>
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false })
      ),
    []
  );
  const colorsInited = useRef(false);

  const poleMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#2a2a2e", roughness: 0.6, metalness: 0.5 }),
    []
  );
  const treeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }),
    []
  );
  const benchMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.2 }),
    []
  );

  useFrame(() => {
    const e = rt.current.era;
    const ef = eraState.eraFloat;

    if (!colorsInited.current) {
      for (let ei = 0; ei < ERAS.length; ei++) {
        const m = lampHeadRefs.current[ei];
        if (m) {
          const c = new THREE.Color(ERAS[ei]!.props.lampColor);
          for (let i = 0; i < lamps.length; i++) m.setColorAt(i, c);
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
      }
      colorsInited.current = true;
    }

    // lamp heads crossfade per era
    for (let ei = 0; ei < ERAS.length; ei++) {
      const m = lampHeadRefs.current[ei];
      if (!m) continue;
      const op = variantOpacity(ef, ei);
      headMats[ei]!.opacity = op * (0.5 + e.lampIntensity * 0.7);
      // scale per era style
      const style = ERAS[ei]!.props.lampStyle;
      const headScale = style === "globe" ? 0.6 : style === "smart" ? 0.35 : 0.45;
      for (let i = 0; i < lamps.length; i++) {
        const l = lamps[i]!;
        scratch.dummy.position.set(l.x, 5.2, l.z);
        scratch.dummy.scale.set(headScale, headScale, headScale);
        scratch.dummy.rotation.set(0, 0, 0);
        scratch.dummy.updateMatrix();
        m.setMatrixAt(i, scratch.dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }

    // trees color interpolate (foliage greener in lush eras, bluer in future)
    scratch.color.set(e.eraA.sky.fog).lerp(scratch.color2.set("#3a6a3a"), 0.5);
    treeMat.color.copy(scratch.color);
    // benches track sidewalk tone
    benchMat.color.copy(e.sidewalk).multiplyScalar(0.6);
  });

  return (
    <group>
      {/* Lamp poles (shared) */}
      <instancedMesh
        args={[Geos.cyl(0.08, 0.1, 5.4, 6), poleMat, lamps.length]}
        ref={(el) => {
          if (el)
            for (let i = 0; i < lamps.length; i++) {
              const l = lamps[i]!;
              scratch.dummy.position.set(l.x, 2.7, l.z);
              scratch.dummy.scale.set(1, 1, 1);
              scratch.dummy.rotation.set(0, 0, 0);
              scratch.dummy.updateMatrix();
              el.setMatrixAt(i, scratch.dummy.matrix);
            }
        }}
        castShadow
      />
      {/* Lamp heads — one pool per era, crossfaded */}
      {ERAS.map((_, ei) => (
        <instancedMesh
          key={ei}
          ref={(el) => {
            lampHeadRefs.current[ei] = el;
          }}
          args={[Geos.sphere(1, 8), headMats[ei]!, lamps.length]}
        />
      ))}
      {/* Trees */}
      {trees.map((t, i) => (
        <group key={`t${i}`} position={[t.x, 0, t.z]}>
          <mesh castShadow position={[0, 1, 0]} material={treeMat}>
            <cylinderGeometry args={[0.18, 0.25, 2, 6]} />
          </mesh>
          <mesh castShadow position={[0, 2.6 * t.s, 0]} scale={[t.s, t.s, t.s]} material={treeMat}>
            <sphereGeometry args={[1.1, 8, 8]} />
          </mesh>
        </group>
      ))}
      {/* Benches */}
      {benches.map((b, i) => (
        <mesh
          key={`b${i}`}
          position={[b.x, 0.4, b.z]}
          rotation={[0, b.rot, 0]}
          material={benchMat}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.8, 0.4, 0.6]} />
        </mesh>
      ))}
    </group>
  );
}
