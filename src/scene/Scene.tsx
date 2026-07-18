import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace } from 'three';
import { createSceneState, SceneStateContext } from './scene-state';
import { TransitionController } from './TransitionController';
import { Atmosphere } from './Atmosphere';
import { Ground } from './Ground';
import { Buildings } from './Buildings';
import { StreetProps } from './StreetProps';
import { Traffic } from './Traffic';
import { CameraRig } from './CameraRig';
import { PostFX } from './PostFX';

/**
 * The full 3D scene. One {@link SceneState} is created on mount and shared via
 * context. {@link TransitionController} is the single writer of that state; all
 * other components are readers. The tree never remounts on era changes.
 */
export function Scene({ onReady }: { onReady: () => void }) {
  // Create the single shared mutable scene state once.
  const sceneState = useMemo(() => createSceneState(), []);

  return (
    <Canvas
      shadows
      frameloop="always"
      dpr={[1, 2]}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.outputColorSpace = SRGBColorSpace;
        gl.shadowMap.type = PCFShadowMap;
        // Signal readiness immediately — WebGL initialized successfully.
        onReady();
      }}
      camera={{ fov: 50, near: 0.1, far: 600, position: [34, 26, 34] }}
    >
      <SceneStateContext.Provider value={sceneState}>
        <TransitionController state={sceneState} />
        <Atmosphere />
        <Ground />
        <Buildings />
        <StreetProps />
        <Traffic />
        <CameraRig />
        <PostFX />
      </SceneStateContext.Provider>
    </Canvas>
  );
}
