import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../store/useSceneStore';
import { sampleGround } from '../engine/sceneSampler';
import { getAsphaltTexture, getSidewalkTexture } from '../engine/textures';

// Module-scope shared textures (created once).
const asphaltTex = /* @__PURE__ */ getAsphaltTexture();
const sidewalkTex = /* @__PURE__ */ getSidewalkTexture();

export function Ground() {
  // Shared material instances, updated in place per frame (no allocation).
  const roadMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: (() => {
          const t = asphaltTex.clone();
          t.repeat.set(8, 2);
          return t;
        })(),
        roughness: 0.85,
        metalness: 0.0,
      }),
    [],
  );
  const sidewalkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: (() => {
          const t = sidewalkTex.clone();
          t.repeat.set(4, 4);
          return t;
        })(),
        roughness: 0.9,
        metalness: 0.0,
      }),
    [],
  );
  const grassMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0.0 }),
    [],
  );

  useFrame(() => {
    const eraFloat = useSceneStore.getState().eraFloat;
    const g = sampleGround(eraFloat);
    roadMat.color.setRGB(...g.roadColor);
    roadMat.metalness = g.wetness * 0.4;
    roadMat.roughness = THREE.MathUtils.lerp(0.85, 0.3, g.wetness);
    sidewalkMat.color.setRGB(...g.sidewalkColor);
    grassMat.color.setRGB(...g.grassColor);
  });

  // Road layout: a cross of two roads meeting at origin.
  // Each road is 10 m wide; sidewalks are 3 m wide on each side.
  const ROAD_W = 10;
  const SIDEWALK_W = 3;
  const EXTENT = 70;

  return (
    <group>
      {/* Grass / dirt base */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow material={grassMat}>
        <planeGeometry args={[EXTENT * 2, EXTENT * 2]} />
      </mesh>

      {/* East-west road */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow material={roadMat}>
        <planeGeometry args={[EXTENT * 2, ROAD_W]} />
      </mesh>
      {/* North-south road */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} receiveShadow material={roadMat}>
        <planeGeometry args={[ROAD_W, EXTENT * 2]} />
      </mesh>

      {/* Sidewalks — four strips bordering the roads */}
      {[
        { pos: [0, 0.02, ROAD_W / 2 + SIDEWALK_W / 2] as [number, number, number], size: [EXTENT * 2, SIDEWALK_W] as [number, number] },
        { pos: [0, 0.02, -(ROAD_W / 2 + SIDEWALK_W / 2)] as [number, number, number], size: [EXTENT * 2, SIDEWALK_W] as [number, number] },
        { pos: [ROAD_W / 2 + SIDEWALK_W / 2, 0.02, 0] as [number, number, number], size: [SIDEWALK_W, EXTENT * 2] as [number, number] },
        { pos: [-(ROAD_W / 2 + SIDEWALK_W / 2), 0.02, 0] as [number, number, number], size: [SIDEWALK_W, EXTENT * 2] as [number, number] },
      ].map((s, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={s.pos} receiveShadow material={sidewalkMat}>
          <planeGeometry args={s.size} />
        </mesh>
      ))}

      {/* Road markings — crosswalk stripes at the intersection */}
      <group position={[0, 0.03, 0]}>
        {/* Zebra crossing on east side */}
        {[-1, 1].map((dir) => (
          <group key={`ew-${dir}`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <mesh
                key={i}
                rotation-x={-Math.PI / 2}
                position={[dir * (ROAD_W / 2 + 1.5), 0, -2 + i * 1]}
              >
                <planeGeometry args={[0.8, 0.5]} />
                <meshStandardMaterial color="white" roughness={0.6} />
              </mesh>
            ))}
          </group>
        ))}
        {[-1, 1].map((dir) => (
          <group key={`ns-${dir}`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <mesh
                key={i}
                rotation-x={-Math.PI / 2}
                position={[-2 + i * 1, 0, dir * (ROAD_W / 2 + 1.5)]}
              >
                <planeGeometry args={[0.5, 0.8]} />
                <meshStandardMaterial color="white" roughness={0.6} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}
