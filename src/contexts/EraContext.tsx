import { createContext, useContext, useState, useMemo } from 'react';
import type { EraContextType, EraYear } from '../types';

const EraContext = createContext<EraContextType | null>(null);

export function EraProvider({ children }: { children: React.ReactNode }) {
  const [year, setYear] = useState<EraYear>(1945);

  const value = useMemo(
    () => ({ year, setYear }),
    [year]
  );

  return <EraContext.Provider value={value}>{children}</EraContext.Provider>;
}

export function useEra() {
  const ctx = useContext(EraContext);
  if (!ctx) {
    throw new Error('useEra must be used within EraProvider');
  }
  return ctx;
}
