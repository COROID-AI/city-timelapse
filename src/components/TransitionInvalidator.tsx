import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { useEraStore } from '../store/eraStore'

// Lives inside the Canvas so it can call invalidate() on each transition frame.
export function TransitionInvalidator() {
  const { invalidate } = useThree()
  const isTransitioning = useEraStore((s) => s.isTransitioning)
  const progress = useEraStore((s) => s.progress)

  useEffect(() => {
    if (!isTransitioning) return
    const id = setInterval(() => invalidate(), 16)
    invalidate()
    return () => clearInterval(id)
  }, [isTransitioning, invalidate, progress])

  return null
}
