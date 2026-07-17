import { useRef, useCallback } from 'react'

export function useEraTransition(
  onProgress: (progress: number) => void
) {
  const animationRef = useRef<number | null>(null)

  const startTransition = useCallback(
    (callback: () => void) => {
      const duration = 1500 // ms
      const startTime = performance.now()

      const animate = (time: number) => {
        const elapsed = time - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        onProgress(progress)

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          animationRef.current = null
          onProgress(0) // Reset for next transition
        }
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      
      animationRef.current = requestAnimationFrame(animate)
      
      // Execute callback after transition completes
      setTimeout(callback, duration)
    },
    [onProgress]
  )

  return { startTransition }
}