import React, { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export function OrbitRig() {
  const { camera, gl } = useThree()
  const controlsRef = useRef<OrbitControls | null>(null)

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.enablePan = false
    controls.minDistance = 15
    controls.maxDistance = 80
    controls.maxPolarAngle = Math.PI / 2 - 0.08

    controls.target.set(0, 5, 0)
    controlsRef.current = controls

    return () => controls.dispose()
  }, [camera, gl.domElement])

  useFrame(() => {
    controlsRef.current?.update()
  })

  return null
}
