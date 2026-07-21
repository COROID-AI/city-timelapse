/**
 * Ground & streets — continuous era interpolation.
 *
 * A big asphalt plane with a canvas road texture, plus raised sidewalk slabs
 * around the block. Asphalt color, lane-marking color, wetness (specular) and
 * grime all interpolate directly with the era.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HALF } from "./layout";
import type { InterpolatedEra } from "../utils/interp";
import { buildRoadTexture } from "../utils/textures";

export function Ground({
  rt,
}: {
  rt: React.RefObject<{ era: InterpolatedEra; clock: number }>;
}) {
  const roadTex = useMemo(() => buildRoadTexture({ asphalt: "#333", marking: "#fff", wetness: 0 }), []);
  const roadMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: roadTex,
        roughness: 0.9,
        metalness: 0.0,
      }),
    [roadTex]
  );
  const sidewalkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.95,
        metalness: 0.0,
      }),
    []
  );

  useFrame(() => {
    const e = rt.current.era;
    roadMat.color.copy(e.asphalt);
    roadMat.map!.colorSpace = THREE.SRGBColorSpace;
    // wetness -> lower roughness (shinier reflections) + slight metalness
    roadMat.roughness = THREE.MathUtils.lerp(0.92, 0.25, e.wetness);
    roadMat.metalness = THREE.MathUtils.lerp(0.0, 0.5, e.wetness);
    sidewalkMat.color.copy(e.sidewalk);
    sidewalkMat.roughness = THREE.MathUtils.lerp(0.95, 0.7, e.wetness);
  });

  return (
    <group>
      {/* Road plane (cross avenues + general ground) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={roadMat}>
        <planeGeometry args={[HALF * 2, HALF * 2]} />
      </mesh>
      {/* Sidewalk rings around the central plaza */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} receiveShadow material={sidewalkMat}>
        <ringGeometry args={[14, 18, 48]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow material={sidewalkMat}>
        <planeGeometry args={[HALF * 2, 4]} />
      </mesh>
    </group>
  );
}

/**
 * Subtle animated driving-lane dashes via a separate scrolling texture on thin
 * strips along the avenues. Keeps the road feeling alive.
 */
export function LaneDashes({
  rt,
}: {
  rt: React.RefObject<{ era: InterpolatedEra; clock: number }>;
}) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const e = rt.current.era;
    if (matRef.current) {
      matRef.current.color.copy(e.marking);
      matRef.current.opacity = 0.7;
    }
    if (meshRef.current) {
      // scroll the texture to fake motion via its material offset
      const t = rt.current.clock * 0.6;
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      if (mat.map) {
        mat.map.offset.x = (t % 1);
      }
    }
  });

  return (
    <group>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[2, HALF * 2]} />
        <meshBasicMaterial ref={matRef} color="#ff0" transparent opacity={0.7} toneMapped={false} />
      </mesh>
    </group>
  );
}
