import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, PerspectiveCamera } from '@react-three/drei'
import { Fog, Vector3 } from 'three'
import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing'
import { useEraTransition } from '../era/useEraTransition'
import { Buildings } from '../scene/Buildings'
import { Ground } from '../scene/Ground'
import { Vehicles } from '../scene/Vehicles'
import { Pedestrians } from '../scene/Pedestrians'
import { Storefronts } from '../scene/Storefronts'
import { Sky } from '../scene/Sky'
import { SFX } from '../scene/SFX'

/**
 * Main city scene orchestrator.
 * - Driven by useEraTransition for smooth, deterministic era transitions
 * - All geometry is procedural (no external assets)
 * - Post-processing for bloom and anti-aliasing
 * - Camera controls for navigation
 */
export function CityScene() {
  const { theme, progress, targetYear } = useEraTransition()

  const targetPos = useMemo(() => new Vector3(0, 18, 30), [])

  useFrame((state) => {
    if (progress < 1) {
      const t = Math.sin(progress * Math.PI)
      targetPos.x = Math.sin(state.clock.elapsedTime * 0.15) * 4 * t
      targetPos.z = 30 + Math.cos(state.clock.elapsedTime * 0.1) * 3 * t
      state.camera.position.lerp(targetPos, 0.03)
      state.camera.lookAt(0, 8, 0)
    }
  })

  const fog = useMemo(() => new Fog(theme.skyBottom, 50, 120), [theme.skyBottom])

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 18, 30]} fov={45} near={0.1} far={400} />
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={10}
        maxDistance={80}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minPolarAngle={0.1}
        target={[0, 8, 0]}
      />

      <Sky theme={theme} />

      <primitive object={fog} attach="fog" />

      <ambientLight intensity={theme.ambient} color={theme.skyTop.clone().multiplyScalar(0.3)} />
      <directionalLight
        position={[30, 80, 20]}
        intensity={2.2}
        color={theme.sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={10}
        shadow-camera-far={150}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-bias={-0.001}
      />

      <Ground theme={theme} />
      <Buildings theme={theme} count={48} />
      <Vehicles theme={theme} />
      <Pedestrians theme={theme} />
      <Storefronts theme={theme} />
      <SFX />

      <Environment
        preset="city"
        resolution={256}
        ground={false}
        background={false}
      />

      <EffectComposer multisampling={4}>
        <SMAA />
        <Bloom
          intensity={theme.year >= 1985 ? 0.35 : 0.15}
          kernelSize={256}
          luminanceThreshold={0.85}
          luminanceSmoothing={0.025}
          mipmapBlur
        />
      </EffectComposer>

      {progress < 1 && (
        <TransitionOverlay progress={progress} fromYear={targetYear === 1945 ? 1945 : targetYear - 20} toYear={targetYear} />
      )}
    </>
  )
}

function TransitionOverlay({ progress, fromYear, toYear }: { progress: number; fromYear: number; toYear: number }) {
  const t = Math.sin(progress * Math.PI)
  const opacity = 0.15 * t

  return (
    <html style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 10 }}>
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity,
          color: 'rgba(255,255,255,0.9)',
          fontSize: '28px',
          fontWeight: 600,
          textAlign: 'center',
          textShadow: '0 0 30px rgba(100,180,255,0.8)',
          pointerEvents: 'none',
        }}
      >
        <div>TRANSITIONING</div>
        <div style={{ fontSize: '14px', opacity: 0.7, marginTop: '8px' }}>
          {fromYear} → {toYear}
        </div>
      </div>
    </html>
  )
}