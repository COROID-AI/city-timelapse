import React, { useState, useEffect } from 'react'
import { useProgress } from '@react-three/drei'

export const LoadingScreen: React.FC = () => {
  const { progress } = useProgress()
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    if (progress === 100) {
      const timer = setTimeout(() => setFadeOut(true), 500)
      return () => clearTimeout(timer)
    }
  }, [progress])

  return (
    <div className={`loading-screen ${fadeOut ? 'fade-out' : ''}`}>
      <div className="loading-text">Loading City Timelapse</div>
      <div className="loading-percentage">{Math.round(progress)}%</div>
      <div className="loading-progress">
        <div className="loading-bar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}