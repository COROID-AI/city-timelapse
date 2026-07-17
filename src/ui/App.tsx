/**
 * App root: mounts the Canvas with the Scene, wires up:
 *  - WebGL availability detection (sets store.webglError)
 *  - prefers-reduced-motion detection (sets store.reducedMotion)
 *  - audio store subscription
 *  - demand frameloop (continuous only during transitions; idle heartbeat)
 *  - ready state (synchronously in useLayoutEffect — procedural assets need
 *    no loading, so the loader never blocks interaction)
 */
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { Scene } from '../three/Scene'
import { initialCameraPose } from '../three/CameraControls'
import { Timeline } from './Timeline'
import { Hud } from './Hud'
import { Loader, ErrorState } from './Overlays'
import { useCityStore } from '../era/store'
import { connectAudioToStore } from '../era/audio'

/** Returns true if WebGL is available. */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    return !!gl
  } catch {
    return false
  }
}

export default function App() {
  const setWebglError = useCityStore((s) => s.setWebglError)
  const setReducedMotion = useCityStore((s) => s.setReducedMotion)
  const setReady = useCityStore((s) => s.setReady)

  // Synchronous detection — runs before paint so the loader is never shown
  // for the procedural-asset fast path.
  useLayoutEffect(() => {
    if (!hasWebGL()) {
      setWebglError(true)
      return
    }
    setReady(true)
  }, [setWebglError, setReady])

  // Side-effects that don't gate first paint.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    const unsubAudio = connectAudioToStore()
    return () => {
      mq.removeEventListener('change', onChange)
      unsubAudio()
    }
  }, [setReducedMotion])

  return (
    <div className="app-root">
      <div className="canvas-wrap">
        <Canvas
          shadows
          dpr={[1, 2]}
          frameloop="demand"
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
          }}
          onCreated={(state) => {
            initialCameraPose(state.camera as THREE.PerspectiveCamera)
          }}
          camera={{ fov: 50, near: 0.5, far: 600, position: [34, 26, 34] }}
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </div>
      <Timeline />
      <Hud />
      <Loader />
      <ErrorState />
    </div>
  )
}
