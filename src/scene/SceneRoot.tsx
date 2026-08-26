import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEraTimeline } from '../store/eraTimeline';
import { Environment } from './environment';
import { Buildings } from '../city/buildings';
import { Vehicles } from './vehicles';
import { Storefronts } from '../city/storefronts';
import { Pedestrians } from './pedestrians';
import { AudioSfx } from '../audio/AudioSfx';
import { Effects } from './Effects';

/**
 * Scene composition root inside the Canvas.
 *
 * Owns the persistent scene graph (the environment block + lighting + the
 * era-morphing building subsystem + era-reactive vehicle traffic), drives the
 * shared era transition clock via `useFrame`, and updates the environment,
 * buildings and vehicles each frame from the store so lighting, atmosphere,
 * the building morph and the vehicle fleet all interpolate / swap with the
 * transition. OrbitControls provide free navigation.
 *
 * The environment, building and vehicle modules are created once and their
 * groups are added to the scene; they are disposed on unmount.
 */
export function SceneRoot() {
  const scene = useThree((s) => s.scene);
  const envRef = useRef<Environment | null>(null);
  const buildingsRef = useRef<Buildings | null>(null);
  const vehiclesRef = useRef<Vehicles | null>(null);
  const storefrontsRef = useRef<Storefronts | null>(null);
  const pedestriansRef = useRef<Pedestrians | null>(null);

  // Drive the era transition clock once per frame.
  const transitionFrame = useEraTimeline((s) => s.transitionTick);

  // Create the environment, building and vehicle subsystems once and attach
  // their groups to the root scene.
  useEffect(() => {
    const env = new Environment();
    const vehicles = new Vehicles();
    const pedestrians = new Pedestrians();
    envRef.current = env;
    vehiclesRef.current = vehicles;
    pedestriansRef.current = pedestrians;
    scene.add(env.group);
    scene.add(vehicles.group);
    scene.add(pedestrians.group);

    const buildings = new Buildings();
    buildingsRef.current = buildings;
    scene.add(buildings.group);

    const storefronts = new Storefronts();
    storefrontsRef.current = storefronts;
    scene.add(storefronts.group);

    return () => {
      scene.remove(env.group);
      scene.remove(vehicles.group);
      scene.remove(pedestrians.group);
      env.dispose();
      vehicles.dispose();
      pedestrians.dispose();
      envRef.current = null;
      vehiclesRef.current = null;
      pedestriansRef.current = null;

      scene.remove(buildings.group);
      buildings.dispose();
      buildingsRef.current = null;

      scene.remove(storefronts.group);
      storefronts.dispose();
      storefrontsRef.current = null;
    };
  }, [scene]);

  // Drive the transition clock and update the subsystems each frame.
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    transitionFrame(dt);

    const { currentEra, targetEra, transitionProgress } =
      useEraTimeline.getState();
    const appState = { currentEra, targetEra, transitionProgress };

    const env = envRef.current;
    if (env) {
      env.update(dt, appState);
      env.applyFog(state.scene, currentEra, targetEra, transitionProgress);
    }

    const vehicles = vehiclesRef.current;
    if (vehicles) {
      vehicles.update(dt, appState);
    }

    const pedestrians = pedestriansRef.current;
    if (pedestrians) {
      pedestrians.update(dt, appState);
    }

    const buildings = buildingsRef.current;
    if (buildings) {
      buildings.update(dt);
    }

    const storefronts = storefrontsRef.current;
    if (storefronts) {
      storefronts.update(dt);
    }
  });

  return (
    <>
      <AudioSfx />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={220}
        maxPolarAngle={Math.PI / 2.05}
      />
      <Effects />
    </>
  );
}