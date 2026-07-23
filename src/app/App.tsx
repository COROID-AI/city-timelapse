import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Sky } from '@react-three/drei'
import * as THREE from 'three'

import { useAppStore } from './store'
import { getEraConfig } from './eras.config'
import type { EraConfig, EraId } from './types'
import { HUD } from '../components/HUD'
import { LoadingScreen } from '../components/LoadingScreen'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { SFXController } from '../components/SFXController'
import { interpolateEraConfig } from '../lib/eraInterpolation'

import { CityBlock } from '../scene/CityBlock'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useReduceMotion } from '../scene/useReduceMotion'

function useAnimatedEraConfig(): { config: EraConfig; eraId: EraId } {
  const targetEraId = useAppStore((s) => s.targetEraId)
  const reduceMotion = useReduceMotion()

  const [fromId, setFromId] = useState<EraId>(targetEraId)
  const [toId, setToId] = useState<EraId>(targetEraId)
  const [t, setT] = useState(1)

  useEffect(() => {
    if (targetEraId === toId) return
    setFromId(toId)
    setToId(targetEraId)
    setT(0)

    if (reduceMotion) {
      setT(1)
      return
    }

    const start = performance.now()
    const dur = 1100
    let raf = 0
    const step = () => {
      const now = performance.now()
      const nextT = Math.min(1, (now - start) / dur)
      setT(nextT)
      if (nextT < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [reduceMotion, targetEraId, toId])

  const from = useMemo(() => getEraConfig(fromId), [fromId])
  const to = useMemo(() => getEraConfig(toId), [toId])

  const config = useMemo(() => interpolateEraConfig(from, to, t), [from, to, t])

  return { config, eraId: t < 0.5 ? fromId : toId }
}

function Atmosphere({ config }: { config: EraConfig }) {
  const { scene } = useThree()

  useEffect(() => {
    scene.fog = new THREE.Fog(config.palette.skyBottom, 10, 60)
  }, [config.palette.skyBottom, scene])

  return (
    <>
      <Sky
        distance={4500}
        sunPosition={[50, 10 + config.ambientIntensity * 5, -60]}
        inclination={0.12}
        azimuth={0.25}
        rayleigh={2 + config.ambientIntensity * 0.25}
        mieCoefficient={0.003 + config.roadWetness * 0.001}
        mieDirectionalG={0.7}
        turbidity={5 + config.roadWetness * 8}
      />
    </>
  )
}

function Lights({ config }: { config: EraConfig }) {
  const neon = config.palette.neon

  return (
    <>
      <ambientLight intensity={0.25 + config.ambientIntensity * 0.6} color={neon} />
      <directionalLight
        intensity={0.9 + config.ambientIntensity * 0.6}
        position={[10, 22, -18]}
        color={config.palette.skyTop}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight intensity={0.4 + config.ambientIntensity * 0.3} position={[-12, 10, 15]} color={config.palette.buildingAccent} />
    </>
  )
}

function AnimatedVehiclesAndProps({ config, eraId }: { config: EraConfig; eraId: EraId }) {
  return (
    <>
      <Lights config={config} />
      <Atmosphere config={config} />
      <CityBlock config={config} eraId={eraId} />
      <EffectComposer>
        <Bloom
          intensity={0.25 + config.windowGlow * 0.35}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
        />
      </EffectComposer>
    </>
  )
}

export default function App() {
  const { config, eraId } = useAnimatedEraConfig()
  const reduceMotion = useReduceMotion()
  // sfxEnabled is consumed by SFXController via its own store subscription.

  // Arm SFX on first interaction.
  const sfxArmedRef = useRef(false)

  return (
    <div className="relative h-full w-full overflow-hidden">
      <ErrorBoundary>
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          camera={{ position: [0, 7.5, 18], fov: 55, near: 0.1, far: 250 }}
          onPointerDown={() => {
            if (sfxArmedRef.current) return
            sfxArmedRef.current = true
            // SFXController will arm itself once mounted and user interacts.
          }}
        >
          <PerspectiveCamera makeDefault position={[0, 7.5, 18]} fov={55} />
          <OrbitControls enableDamping dampingFactor={0.07} rotateSpeed={0.35} />

          <AnimatedVehiclesAndProps config={config} eraId={eraId} />

          {/* SFX is mounted inside the canvas so it can use pointer timing if needed */}
          <SFXController eraConfig={config} eraId={eraId} />
        </Canvas>
      </ErrorBoundary>

      <HUD />
      <LoadingScreen />

      {/* For reducer/motion preferences: */}
      <div className="sr-only" aria-live="polite">
        {reduceMotion ? 'Reduced motion enabled' : 'Cinematic mode enabled'}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-10 flex justify-center">
        {/* spacer */}
      </div>
    </div>
  )
}
