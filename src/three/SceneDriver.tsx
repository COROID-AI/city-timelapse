/**
 * The single era-progress driver.
 *
 * Each frame it:
 *  1. Advances `frame.progress` toward the store's `selectedEra` (snaps when
 *     reduced-motion is on — deterministic endpoint, never skipped).
 *  2. Samples the continuous config and applies sky/light/fog/ground/post-FX.
 *  3. Mirrors progress into the store (throttled) for the timeline fill + HUD.
 *  4. Keeps the frameloop alive (continuous) only while transitioning.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { BloomEffect, VignetteEffect } from 'postprocessing'
import { sampleEraConfig } from '../era/interpolation'
import { approach } from '../era/math'
import { useCityStore } from '../era/store'
import { groundMat, skyMat } from './factories'
import { frame } from './frameState'

const TRANSITION_SPEED = 2.4 // era-units/sec approach rate
const _v = new THREE.Vector3()

export interface SceneHandles {
  sun: RefObject<THREE.DirectionalLight | null>
  ambient: RefObject<THREE.HemisphereLight | null>
  bloom: RefObject<BloomEffect | null>
  vignette: RefObject<VignetteEffect | null>
}

export function SceneDriver({ handles }: { handles: SceneHandles }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const lastMirror = useRef(-1)
  const lastTrans = useRef(false)

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping
  }, [gl])

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 20) // clamp huge frame gaps
    const st = useCityStore.getState()
    const target = st.selectedEra
    const reduced = st.reducedMotion

    let progress: number
    let transitioning: boolean
    if (reduced) {
      progress = target
      transitioning = false
    } else {
      const res = approach(frame.progress, target, TRANSITION_SPEED, dt)
      progress = res.value
      transitioning = !res.done
    }

    frame.progress = progress
    frame.transitioning = transitioning
    frame.reduced = reduced
    frame.quality = st.quality
    frame.dt = dt
    frame.time = state.clock.elapsedTime

    // --- apply continuous scene config ---
    const cfg = sampleEraConfig(progress)

    // Sky
    ;(skyMat.uniforms.topColor.value as THREE.Color).set(cfg.skyTop)
    ;(skyMat.uniforms.bottomColor.value as THREE.Color).set(cfg.skyBottom)

    // Sun direction (spherical from azimuth/elevation) + colour/intensity
    const el = cfg.sunElevation
    const az = cfg.sunAzimuth
    const sr = 70
    _v.set(
      sr * Math.cos(el) * Math.sin(az),
      sr * Math.sin(el),
      sr * Math.cos(el) * Math.cos(az),
    )
    if (handles.sun.current) {
      handles.sun.current.position.copy(_v)
      handles.sun.current.color.set(cfg.sunColor)
      handles.sun.current.intensity = cfg.sunIntensity
    }
    if (handles.ambient.current) {
      handles.ambient.current.color.set(cfg.ambientColor)
      handles.ambient.current.groundColor.set(cfg.groundColor)
      handles.ambient.current.intensity = cfg.ambientIntensity
    }

    // Fog
    if (scene.fog && (scene.fog as THREE.Fog).isFog) {
      const fog = scene.fog as THREE.Fog
      fog.color.set(cfg.fogColor)
      fog.near = cfg.fogNear
      fog.far = cfg.fogFar
    }

    // Ground + exposure + post FX
    groundMat.color.set(cfg.groundColor)
    gl.toneMappingExposure = cfg.exposure
    if (handles.bloom.current) handles.bloom.current.intensity = cfg.bloom
    if (handles.vignette.current) handles.vignette.current.darkness = cfg.vignette

    // --- mirror to store (throttled) for the UI ---
    if (
      Math.abs(progress - lastMirror.current) > 0.004 ||
      transitioning !== lastTrans.current
    ) {
      lastMirror.current = progress
      lastTrans.current = transitioning
      st.setEraProgress(progress, transitioning)
    }

    // NOTE: No per-frame invalidate() here. The FrameloopController manages
    // all rendering cadence via a single throttled timer so the browser's
    // event loop stays responsive between frames (critical for software
    // renderers and for Playwright interaction).
  })

  return null
}
