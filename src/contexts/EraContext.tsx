import { createContext, useContext, useState, ReactNode, useCallback } from 'react'

export type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

interface EraContextType {
  currentEra: Era
  setEra: (era: Era) => void
  transitionProgress: number
}

const EraContext = createContext<EraContextType>({
  currentEra: '1945',
  setEra: () => {},
  transitionProgress: 0,
})

export const useEra = () => useContext(EraContext)

interface EraProviderProps {
  children: ReactNode
}

const eraToValue: Record<Era, number> = {
  '1945': 0,
  '1965': 1,
  '1985': 2,
  '2005': 3,
  '2025': 4,
  '2055': 5,
}

export function EraProvider({ children }: EraProviderProps) {
  const [currentEra, setCurrentEra] = useState<Era>('1945')
  const [transitionProgress, setTransitionProgress] = useState(0)

  const setEra = useCallback((era: Era) => {
    setCurrentEra(era)
    setTransitionProgress(eraToValue[era])
  }, [])

  return (
    <EraContext.Provider value={{ currentEra, setEra, transitionProgress }}>
      {children}
    </EraContext.Provider>
  )
}