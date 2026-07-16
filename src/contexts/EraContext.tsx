import { createContext, useContext, useState, ReactNode, useCallback } from 'react'

export type Era = 1945 | 1965 | 1985 | 2005 | 2025 | 2055

interface EraContextValue {
  era: Era
  setEra: (era: Era) => void
  transitionProgress: number
}

const EraContext = createContext<EraContextValue>({
  era: 1945,
  setEra: () => {},
  transitionProgress: 1
})

export const useEra = () => useContext(EraContext)

interface EraProviderProps {
  children: ReactNode
}

export function EraProvider({ children }: EraProviderProps) {
  const [era, setEraState] = useState<Era>(1945)
  const [transitionProgress, setTransitionProgress] = useState(1)

  const setEra = useCallback((newEra: Era) => {
    if (newEra === era) return
    
    setTransitionProgress(0)
    
    const duration = 2000
    const startTime = performance.now()
    
    const animate = (time: number) => {
      const elapsed = time - startTime
      const progress = Math.min(elapsed / duration, 1)
      setTransitionProgress(progress)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setEraState(newEra)
      }
    }
    
    requestAnimationFrame(animate)
  }, [era])

  return (
    <EraContext.Provider value={{ era, setEra, transitionProgress }}>
      {children}
    </EraContext.Provider>
  )
}
