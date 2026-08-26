import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEraTimeline } from '../store/eraTimeline';
import { Environment } from './environment';
import { Buildings } from '../city/buildings';

/**
 * Scene composition root inside the Canvas.
 *
 * Owns the persistent scene graph (the environment block + lighting + the
 * era-morphing building subsystem), drives the shared era transition clock via
 * `useFrame`, and updates the environment and buildings each frame from the
 * store so lighting, atmosphere and the building morph all interpolate with
 * the transition. OrbitControls provide free navigation.
 *
 * The environment and building modules are created once and their groups are
 * added to the scene; they are disposed on unmount.
 */
export function SceneRoot() {
  const scene = useThree((s) => s.scene);
  const envRef = useRef<Environment | null>(null);
  const buildingsRef = useRef<Buildings | null>(null);

  // Drive the era transition clock once per frame.
  const transitionFrame = useEraTimeline((s) => s.transitionTick);

  // Create the environment and building subsystems once and attach their
  // groups to the root scene.
  useEffect(() => {
    const env = new Environment();
    envRef.current = env;
    scene.add(env.group);

    const buildings = new Buildings();
    buildingsRef.current = buildings;
    scene.add(buildings.group);

    return () => {
      scene.remove(env.group);
      env.dispose();
      envRef.current = null;

      scene.remove(buildings.group);
      buildings.dispose();
      buildingsRef.current = null;
    };
  }, [scene]);

  // Drive the transition clock and update the subsystems each frame.
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    transitionFrame(dt);

    const { currentEra, targetEra, transitionProgress } =
      useEraTimeline.getState();

    const env = envRef.current;
    if (env) {
      env.update(dt, { currentEra, targetEra, transitionProgress });
      env.applyFog(state.scene, currentEra, targetEra, transitionProgress);
    }

    const buildings = buildingsRef.current;
    if (buildings) {
      buildings.update(dt);
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