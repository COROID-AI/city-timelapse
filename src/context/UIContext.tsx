import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react'

export type Era = 1945 | 1965 | 1985 | 2005 | 2025 | 2055

interface UIContextType {
  currentEra: Era
  setEra: (era: Era) => void
  prefersReducedMotion: boolean
}

const UIContext = createContext<UIContextType | undefined>(undefined)

export const UIProvider: React.FC<{
  children: ReactNode
  prefersReducedMotion: boolean
}> = ({ children, prefersReducedMotion }) => {
  const [currentEra, setCurrentEra] = useState<Era>(1945)

  const setEra = useCallback((era: Era) => {
    setCurrentEra(era)
  }, [])

  return (
    <UIContext.Provider value={{ currentEra, setEra, prefersReducedMotion }}>
      {children}
    </UIContext.Provider>
  )
}

export const useUI = () => {
  const context = useContext(UIContext)
  if (!context) {
    throw new Error('useUI must be used within UIProvider')
  }
  return context
}