import React, { Suspense, useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Html } from '@react-three/drei'
import { EffectComposer, Bloom, ColorCorrection, Vignette } from '@react-three/postprocessing'
import { useUI } from '../context/UIContext'
import { eraConfigs } from '../data/eras'
import { BuildingGroup } from './BuildingGroup'
import { VehicleGroup } from './VehicleGroup'
import { PedestrianGroup } from './PedestrianGroup'
import { StorefrontGroup } from './StorefrontGroup'
import { SkyTransition } from './SkyTransition'
import { LoadingScreen } from './LoadingScreen'
import { ErrorBoundary } from './ErrorBoundary'
import { AmbientAudioManager } from './AmbientAudioManager'

export const CityScene: React.FC = () => {
  const { currentEra, prefersReducedMotion } = useUI()
  const config = eraConfigs[currentEra]

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <Environment preset="city" />

        <ambientLight intensity={config.lighting.intensity * 0.5} color={config.lighting.color} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={config.lighting.intensity}
          color={config.lighting.color}
          castShadow
        />

        <SkyTransition era={currentEra} prefersReducedMotion={prefersReducedMotion} />

        <BuildingGroup era={currentEra} prefersReducedMotion={prefersReducedMotion} />
        <VehicleGroup era={currentEra} prefersReducedMotion={prefersReducedMotion} />
        <StorefrontGroup era={currentEra} prefersReducedMotion={prefersReducedMotion} />
        <PedestrianGroup era={currentEra} prefersReducedMotion={prefersReducedMotion} />

        <OrbitControls
          enablePan={false}
          minPolarAngle={Math.PI * 0.15}
          maxPolarAngle={Math.PI * 0.6}
          minDistance={5}
          maxDistance={20}
          maxAzimuthAngle={Math.PI * 0.5}
          minAzimuthAngle={-Math.PI * 0.5}
          enableDamping
          dampingFactor={0.05}
        />

        <EffectComposer>
          <Bloom
            luminanceThreshold={0.2}
            luminanceSaturation={0.9}
            intensity={0.6}
            mipmapBlur
          />
          <ColorCorrection
            red={config.colorPalette.primary}
            green={config.colorPalette.secondary}
            blue={config.colorPalette.accent}
          />
          <Vignette eskil={false} strength={0.4} />
        </EffectComposer>

        <AmbientAudioManager era={currentEra} />
      </Suspense>
    </ErrorBoundary>
  )
}