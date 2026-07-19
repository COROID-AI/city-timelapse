import React from 'react'
import { useThree } from '@react-three/fiber'
import { Vector3 } from 'three'

export function CameraControls() {
  const { camera } = useThree()

  const resetCamera = () => {
    const targetPosition = new Vector3(0, 5, 15)
    
    // Smooth camera reset with animation
    const startPosition = camera.position.clone()
    const startTime = performance.now()
    const duration = 1000

    const animate = (now: number) => {
      const elapsed = now - startTime
      const alpha = Math.min(1, elapsed / duration)
      
      camera.position.lerpVectors(startPosition, targetPosition, alpha)
      
      if (alpha < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    requestAnimationFrame(animate)
  }

  return (
    <div className="absolute bottom-4 right-4 z-10 pointer-events-auto">
      <button
        onClick={resetCamera}
        className="px-4 py-2 bg-slate-800/90 backdrop-blur-md text-white rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors"
        aria-label="Reset camera position"
      >
        Reset View
      </button>
    </div>
  )
}