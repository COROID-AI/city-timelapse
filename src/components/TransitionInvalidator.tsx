import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { useEraStore } from '../store/eraStore'

// Lives inside the Canvas so it can call invalidate() on each transition frame.
export function TransitionInvalidator() {
  const { invalidate } = useThree()
  const isTransitioning = useEraStore((s) => s.isTransitioning)

  useEffect(() => {
    if (!isTransitioning) return
    let raf = 0
    const tick = () => {
      invalidate()
      raf = requestAnimationFrame(tick)
    }
    invalidate()
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isTransitioning, invalidate])

  return null
}
