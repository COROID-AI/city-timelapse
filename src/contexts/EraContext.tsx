import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type Era = 1945 | 1965 | 1985 | 2005 | 2025 | 2055;

interface EraContextType {
  currentEra: Era;
  setEra: (era: Era) => void;
  transitionProgress: number;
}

const EraContext = createContext<EraContextType>({
  currentEra: 1945,
  setEra: () => {},
  transitionProgress: 0,
});

export const useEra = () => useContext(EraContext);

export const EraProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentEra, setCurrentEra] = useState<Era>(1945);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const transitionTimeoutRef = React.useRef<number | null>(null);

  const setEra = useCallback((era: Era) => {
    // Clear any existing transition
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    
    // Start transition animation
    const startTime = Date.now();
    const duration = 2500; // 2.5 seconds
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      setTransitionProgress(progress);
      
      if (progress < 1) {
        transitionTimeoutRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentEra(era);
        setTransitionProgress(0);
        transitionTimeoutRef.current = null;
      }
    };
    
    animate();
  }, []);

  return (
    <EraContext.Provider value={{ currentEra, setEra, transitionProgress }}>
      {children}
    </EraContext.Provider>
  );
};