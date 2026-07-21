import React, { useEffect, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'

export function PerformanceMonitor() {
  const { clock } = useThree()
  const [fps, setFps] = useState(0)
  const [frameCount, setFrameCount] = useState(0)
  const [lastTime, setLastTime] = useState(0)

  useFrame(() => {
    setFrameCount(frameCount + 1)
    const time = clock.getElapsedTime()
    if (time - lastTime >= 1) {
      setFps(frameCount)
      setFrameCount(0)
      setLastTime(time)
    }
  })

  return (
    <Html>
      <div 
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          background: 'rgba(0, 0, 0, 0.7)',
          color: '#00d4ff',
          padding: '8px 12px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '12px',
          pointerEvents: 'none',
          zIndex: 1000
        }}
      >
        FPS: {fps}
      </div>
    </Html>
  )
}