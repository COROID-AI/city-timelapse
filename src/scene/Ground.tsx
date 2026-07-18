import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { type Mesh } from 'three';
import { createGroundMaterial } from './materials';
import { BLOCK_SIZE } from './layout';
import { useSceneState } from './scene-state';

/**
 * The single large ground plane whose procedural shader paints asphalt, lane
 * markings, crosswalk stripes, and sidewalks. One draw call for the whole
 * surface. Colours are driven from the shared scene state every frame.
 */
export function Ground() {
  const state = useSceneState();

  const ground = useMemo(() => createGroundMaterial(state.asphaltColor.clone(), state.sidewalkColor.clone()), []);
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    ground.uniforms.uAsphalt.value.copy(state.asphaltColor);
    ground.uniforms.uSidewalk.value.copy(state.sidewalkColor);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} material={ground.material} receiveShadow position={[0, -0.02, 0]}>
      <planeGeometry args={[BLOCK_SIZE, BLOCK_SIZE, 1, 1]} />
    </mesh>
  );
}
