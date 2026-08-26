import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEraTimeline } from '../store/eraTimeline';
import { Environment } from './environment';

/**
 * Scene composition root inside the Canvas.
 *
 * Owns the persistent scene graph (the environment block + lighting), drives
 * the shared era transition clock via `useFrame`, and updates the environment
 * each frame from the store so lighting and atmosphere interpolate with the
 * transition. OrbitControls provide free navigation.
 *
 * The environment module is created once and its group is added to the scene;
 * it is disposed on unmount.
 */
export function SceneRoot() {
  const scene = useThree((s) => s.scene);
  const envRef = useRef<Environment | null>(null);

  // Drive the era transition clock once per frame.
  const transitionTick = useEraTimeline((s) => s.transitionTick);

  // Create the environment once and attach its group to the root scene.
  useEffect(() => {
    const env = new Environment();
    envRef.current = env;
    scene.add(env.group);
    return () => {
      scene.remove(env.group);
      env.dispose();
      envRef.current = null;
    };
  }, [scene]);

  // Drive the transition clock and update the environment each frame.
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    transitionTick(dt);

    const env = envRef.current;
    if (env) {
      const { currentEra, targetEra, transitionProgress } =
        useEraTimeline.getState();
      env.update(dt, { currentEra, targetEra, transitionProgress });
      env.applyFog(state.scene, currentEra, targetEra, transitionProgress);
    }
  });

  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.08}
      minDistance={8}
      maxDistance={220}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}