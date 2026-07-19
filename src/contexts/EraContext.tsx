import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react'

export type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

interface EraContextType {
  currentEra: Era
  setEra: (era: Era) => void
  transitionProgress: number
  isTransitioning: boolean
}

const EraContext = createContext<EraContextType | null>(null)

const ERA_ORDER: Era[] = ['1945', '1965', '1985', '2005', '2025', '2055']
const TRANSITION_DURATION = 2000

export function EraProvider({ children }: { children: ReactNode }) {
  const [currentEra, setCurrentEra] = useState<Era>('1945')
  const [targetEra, setTargetEra] = useState<Era>('1945')
  const [transitionProgress, setTransitionProgress] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const setEra = useCallback((era: Era) => {
    if (era === currentEra) {
      setTransitionProgress(1)
      setIsTransitioning(false)
      return
    }
    
    setTargetEra(era)
    setIsTransitioning(true)
    setTransitionProgress(0)
    
    const startTime = performance.now()
    
    const animate = (now: number) => {
      const elapsed = now - startTime
      const newProgress = Math.min(1, elapsed / TRANSITION_DURATION)
      setTransitionProgress(newProgress)
      
      if (newProgress < 1) {
        requestAnimationFrame(animate)
      } else {
        setCurrentEra(era)
        setIsTransitioning(false)
      }
    }
    
    requestAnimationFrame(animate)
  }, [currentEra])

  return (
    <EraContext.Provider value={{ currentEra, setEra, transitionProgress, isTransitioning }}>
      {children}
    </EraContext.Provider>
  )
}

export function useEra() {
  const context = useContext(EraContext)
  if (!context) throw new Error('useEra must be used within EraProvider')
  return context
}

export { EraProvider as default, ERA_ORDER, TRANSITION_DURATION }