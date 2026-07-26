import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats, Environment, ContactShadows, Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, SMAA } from '@react-three/postprocessing';
import { useThree, useFrame } from '@react-three/fiber';
import { useRef, useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { useTimeline } from '../context/TimelineContext';
import { Ground } from './scene/Ground';
import { BuildingGroup } from './scene/BuildingGroup';
import { VehicleManager } from './scene/VehicleManager';
import { PedestrianManager } from './scene/PedestrianManager';
import { AdManager } from './scene/AdManager';
import { WeatherEffects } from './scene/WeatherEffects';
import { Skybox } from './scene/Skybox';
import { EraLighting } from './scene/EraLighting';
import { lerp } from '../types';

export const CityScene = () => {
  const { currentEra, isTransitioning, transitionProgress, getInterpolatedConfig } = useTimeline();
  const { camera, gl } = useThree();
  const config = useMemo(() => getInterpolatedConfig(transitionProgress), [transitionProgress, getInterpolatedConfig]);

  // Camera height adjusts based on building height
  useFrame(() => {
    const targetHeight = 15 + config.buildingHeight * 0.3;
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetHeight, 0.05);
  });

  return (
    <>
      <color attach="background" args={[config.skyColor]} />

      <Skybox skyColor={config.skyColor} />
      <EraLighting
        ambientColor={config.ambientColor}
        directionalColor={config.directionalColor}
        sunPosition={config.sunPosition}
      />

      <Ground
        groundStyle={config.groundStyle}
        buildingColor={config.buildingColor}
        windowLitColor={config.windowLitColor}
        era={currentEra}
        transitionProgress={transitionProgress}
      />

      <BuildingGroup
        buildingStyle={config.buildingStyle}
        buildingColor={config.buildingColor}
        windowColor={config.windowColor}
        windowLitColor={config.windowLitColor}
        buildingHeight={config.buildingHeight}
        buildingDensity={config.buildingDensity}
        era={currentEra}
        transitionProgress={transitionProgress}
      />

      <VehicleManager
        vehicleType={config.vehicleType}
        vehicleCount={config.vehicleCount}
        hasFlyingCars={config.hasFlyingCars}
        era={currentEra}
        transitionProgress={transitionProgress}
      />

      <PedestrianManager
        pedestrianStyle={config.pedestrianStyle}
        pedestrianCount={config.pedestrianCount}
        era={currentEra}
        transitionProgress={transitionProgress}
      />

      <AdManager
        adStyle={config.adStyle}
        adCount={config.adCount}
        windowLitColor={config.windowLitColor}
        era={currentEra}
        transitionProgress={transitionProgress}
      />

      <WeatherEffects
        hasRain={config.hasRain}
        hasSnow={config.hasSnow}
        transitionProgress={transitionProgress}
      />

      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.4}
        scale={20}
        blur={2}
        far={5}
      />

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        zoomSpeed={0.8}
        rotateSpeed={0.8}
        panSpeed={0.8}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={8}
        maxDistance={80}
      />

      <EffectComposer
        enableNormalPass={false}
        depthBuffer={false}
        stencilBuffer={false}
      >
        <SMAA />
        <Bloom
          mipmapBlur
          intensity={config.hasNeon ? 0.8 : 0.3}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          radius={0.5}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.3} />
        <ChromaticAberration offset={[0.0005, 0.0005]} />
      </EffectComposer>
    </>
  );
};
