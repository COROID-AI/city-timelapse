import React from 'react'
import { Html } from '@react-three/drei'

interface LoadingOverlayProps {
  progress: number
  visible: boolean
}

export function LoadingOverlay({ progress, visible }: LoadingOverlayProps) {
  if (!visible) return null

  return (
    <Html center>
      <div className="loading-overlay">
        <div className="loading-text">Loading City Scene...</div>
        <div className="loading-bar">
          <div 
            className="loading-bar-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="loading-text">{Math.round(progress)}%</div>
      </div>
    </Html>
  )
}