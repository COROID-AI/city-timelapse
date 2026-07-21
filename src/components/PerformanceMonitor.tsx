import { useEffect, useState } from 'react'

export function PerformanceMonitor() {
  const [fps, setFps] = useState(0)
  const [show, setShow] = useState(false)

  useEffect(() => {
    let frameCount = 0
    let lastTime = performance.now()
    
    const updateFps = () => {
      frameCount++
      const now = performance.now()
      const delta = now - lastTime
      
      if (delta >= 1000) {
        setFps(Math.round((frameCount * 1000) / delta))
        frameCount = 0
        lastTime = now
      }
      
      requestAnimationFrame(updateFps)
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' && e.ctrlKey) {
        setShow(s => !s)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    requestAnimationFrame(updateFps)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  if (!show) return null

  return (
    <div 
      className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-sm font-mono"
      role="status"
      aria-label={`Performance: ${fps} frames per second`}
    >
      FPS: {fps}
    </div>
  )
}