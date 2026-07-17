/**
 * Bounded orbit/pan/zoom controls + deterministic reset/focus.
 *
 * Constraints enforced (per acceptance criteria):
 *  - Polar angle is clamped so the camera can never go under the ground.
 *  - min/max distance prevent flying away or clipping into the block.
 *  - Reset/focus restores a known-good deterministic viewpoint, triggered by
 *    the store's `resetNonce` increment.
 *
 * Uses drei's OrbitControls with imperative clamp config and a reset listener.
 */
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useCityStore } from '../era/store'

// Deterministic default camera pose (also the reset target).
const RESET_POS = new THREE.Vector3(34, 26, 34)
const RESET_TARGET = new THREE.Vector3(0, 4, 0)

export function CameraControls() {
  const controlsRef = useRef<any>(null)
  const camera = useThree((s) => s.camera)
  const resetNonce = useCityStore((s) => s.resetNonce)

  // Apply bounded limits whenever the control instance is available.
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    // Clamp polar angle: never below ground (max ~80deg from vertical up) and
    // never fully top-down (keep a pleasing angle).
    c.minPolarAngle = 0.18
    c.maxPolarAngle = Math.PI * 0.49 // strictly above horizon
    c.minDistance = 16
    c.maxDistance = 95
    c.enableDamping = true
    c.dampingFactor = 0.08
    c.target.copy(RESET_TARGET)
    c.update()
  }, [])

  // Deterministic reset/focus on nonce change.
  useEffect(() => {
    if (resetNonce === 0) return
    const c = controlsRef.current
    if (!c) return
    camera.position.copy(RESET_POS)
    c.target.copy(RESET_TARGET)
    c.update()
    const invalidate = useCityStore.getState
    void invalidate
  }, [resetNonce, camera])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan
      panSpeed={0.7}
      rotateSpeed={0.75}
      zoomSpeed={0.8}
      target={RESET_TARGET}
      maxPolarAngle={Math.PI * 0.49}
      minPolarAngle={0.18}
      minDistance={16}
      maxDistance={95}
    />
  )
}

/** Set the initial camera to the deterministic reset pose. */
export function initialCameraPose(cam: THREE.PerspectiveCamera) {
  cam.position.copy(RESET_POS)
  cam.lookAt(RESET_TARGET)
  cam.fov = 50
  cam.near = 0.5
  cam.far = 600
  cam.updateProjectionMatrix()
}
