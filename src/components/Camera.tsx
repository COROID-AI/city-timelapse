import { useEra } from '../contexts/EraContext'
import { useThree, useFrame } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import * as THREE from 'three'

export function Camera() {
  const { currentEra } = useEra()
  const { camera } = useThree()
  const targetPosition = useRef(new THREE.Vector3(0, 50, 100))

  // Adjust camera based on era
  useEffect(() => {
    switch (currentEra) {
      case '1945':
        targetPosition.current.set(0, 40, 120)
        break
      case '1965':
        targetPosition.current.set(0, 50, 100)
        break
      case '1985':
        targetPosition.current.set(0, 60, 130)
        break
      case '2005':
        targetPosition.current.set(0, 55, 110)
        break
      case '2025':
        targetPosition.current.set(0, 45, 90)
        break
      case '2055':
        targetPosition.current.set(0, 80, 150)
        break
    }
  }, [currentEra])

  useFrame(() => {
    // Smooth camera following
    camera.position.lerp(targetPosition.current, 0.05)
    camera.lookAt(0, 20, 0)
  })

  return null
}