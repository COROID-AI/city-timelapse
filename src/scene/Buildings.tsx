import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, type Mesh } from 'three';
import { BUILDINGS, storiesToHeight } from './layout';
import { createFacadeMaterial } from './materials';
import { STORY_HEIGHT } from '../lib/era-data';
import { useSceneState } from './scene-state';

/**
 * Renders the four corner lots of buildings. Each building is a mounted mesh
 * whose height/colour/window-emissive are interpolated in place every frame
 * from the shared {@link SceneState}. Nothing remounts on era change.
 *
 * Facade materials are created once per building (cached GPU program) and their
 * uniforms are mutated in place — no per-frame allocation.
 */
export function Buildings() {
  const state = useSceneState();

  // Build stable per-building facade materials once.
  const facades = useMemo(
    () =>
      BUILDINGS.map((b) =>
        createFacadeMaterial(
          // base color will be overridden each frame; seed a neutral.
          state.buildingColor.clone(),
          b.seed,
          b.cols,
          0.5,
          0.1,
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Roof props data (stable): for each building, a couple of boxes.
  const roofProps = useMemo(
    () =>
      BUILDINGS.map((b) => {
        const n = 1 + (Math.floor(b.seed) % 3);
        return Array.from({ length: n }, (_, i) => ({
          ox: (i - (n - 1) / 2) * (b.w / (n + 1)),
          oz: ((b.seed * 13 + i * 7) % 5) - 2,
          w: 1.2 + (i % 2) * 0.6,
          d: 1.2 + ((i + 1) % 2) * 0.6,
          h: 0.6 + (b.seed + i) * 0.15,
        }));
      }),
    [],
  );

  const meshes = useRef<(Mesh | null)[]>([]);
  const roofGroups = useRef<(Group | null)[]>([]);

  useFrame((_, delta) => {
    const t = state;
    for (let i = 0; i < BUILDINGS.length; i++) {
      const b = BUILDINGS[i];
      const m = meshes.current[i];
      if (!m) continue;

      // Interpolate height from the interpolated story count.
      const targetStories = b.baseStories + (t.buildingStories - 4);
      const height = storiesToHeight(targetStories);
      m.scale.y = height;
      m.position.set(b.x, 0, b.z);
      m.scale.x = b.w;
      m.scale.z = b.d;

      // Drive facade material uniforms from shared state (in place).
      const fm = facades[i];
      fm.material.color.copy(t.buildingColor);
      fm.material.roughness = t.buildingRoughness;
      fm.material.metalness = t.buildingMetalness;
      fm.uniforms.uWindowColor.value.copy(t.windowColor);
      fm.uniforms.uWindowEmissive.value = t.windowEmissive;
      fm.uniforms.uFloors.value = Math.max(1, Math.round(targetStories));
      fm.uniforms.uNight.value = clamp01((t.windowEmissive - 0.2) / 1.0);
      fm.uniforms.uTime.value += delta;

      // Move roof props to sit on top of the building.
      const rg = roofGroups.current[i];
      if (rg) {
        rg.position.set(b.x, height, b.z);
        rg.visible = height > STORY_HEIGHT * 1.5;
      }
    }
  });

  return (
    <group>
      {BUILDINGS.map((_b, i) => (
        <group key={i}>
          <mesh
            ref={(el) => {
              meshes.current[i] = el;
            }}
            material={facades[i].material}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          <group
            ref={(el) => {
              roofGroups.current[i] = el;
            }}
          >
            {roofProps[i].map((rp, j) => (
              <mesh key={j} position={[rp.ox, rp.h / 2, rp.oz]} castShadow>
                <boxGeometry args={[rp.w, rp.h, rp.d]} />
                <meshStandardMaterial color={0x33373d} roughness={0.7} metalness={0.3} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
