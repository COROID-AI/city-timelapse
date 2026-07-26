import { createContext, useContext, useState, ReactNode } from 'react';
import { ERA_IDS, EraId, ERA_CONFIGS, EraConfig } from '../types';

interface TimelineContextType {
  currentEra: EraId;
  targetEra: EraId;
  setCurrentEra: (era: EraId) => void;
  isTransitioning: boolean;
  transitionProgress: number;
  allEras: EraId[];
  currentConfig: EraConfig;
  targetConfig: EraConfig;
  getInterpolatedConfig: (t: number) => EraConfig;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

export const useTimeline = () => {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error('useTimeline must be used within TimelineProvider');
  return ctx;
};

export const TimelineProvider = ({ children }: { children: ReactNode }) => {
  const [currentEra, setCurrentEraState] = useState<EraId>('1945');
  const [targetEra, setTargetEraState] = useState<EraId>('1945');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);

  const setCurrentEra = (era: EraId) => {
    if (era === currentEra) return;
    setTargetEraState(era);
    setIsTransitioning(true);
    setTransitionProgress(0);

    // Animate transition progress over 2 seconds
    const startTime = Date.now();
    const duration = 2000;
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      setTransitionProgress(t);
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setCurrentEraState(era);
        setIsTransitioning(false);
        setTransitionProgress(0);
      }
    };
    requestAnimationFrame(animate);
  };

  const currentConfig = ERA_CONFIGS[currentEra];
  const targetConfig = ERA_CONFIGS[targetEra];

  const getInterpolatedConfig = (t: number): EraConfig => {
    const a = currentConfig;
    const b = targetConfig;
    return {
      ...a,
      era: b.era,
      buildingColor: lerpColor(a.buildingColor, b.buildingColor, t),
      windowColor: lerpColor(a.windowColor, b.windowColor, t),
      windowLitColor: lerpColor(a.windowLitColor, b.windowLitColor, t),
      skyColor: lerpColor(a.skyColor, b.skyColor, t),
      fogColor: lerpColor(a.fogColor, b.fogColor, t),
      ambientColor: lerpColor(a.ambientColor, b.ambientColor, t),
      directionalColor: lerpColor(a.directionalColor, b.directionalColor, t),
      sunPosition: lerpVec3(a.sunPosition, b.sunPosition, t),
      buildingDensity: lerp(a.buildingDensity, b.buildingDensity, t),
      buildingHeight: lerp(a.buildingHeight, b.buildingHeight, t),
      vehicleCount: Math.round(lerp(a.vehicleCount, b.vehicleCount, t)),
      pedestrianCount: Math.round(lerp(a.pedestrianCount, b.pedestrianCount, t)),
      adCount: Math.round(lerp(a.adCount, b.adCount, t)),
      hasRain: t > 0.5 ? b.hasRain : a.hasRain,
      hasSnow: t > 0.5 ? b.hasSnow : a.hasSnow,
      hasNeon: t > 0.5 ? b.hasNeon : a.hasNeon,
      hasFlyingCars: t > 0.5 ? b.hasFlyingCars : a.hasFlyingCars,
    };
  };

  // Import lerp helpers
  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  function lerpColor(a: string, b: string, t: number): string {
    const ah = a.replace('#', '');
    const bh = b.replace('#', '');
    const ar = parseInt(ah.substring(0, 2), 16);
    const ag = parseInt(ah.substring(2, 4), 16);
    const ab = parseInt(ah.substring(4, 6), 16);
    const br = parseInt(bh.substring(0, 2), 16);
    const bg = parseInt(bh.substring(2, 4), 16);
    const bb = parseInt(bh.substring(4, 6), 16);
    const rr = Math.round(ar + (br - ar) * t).toString(16).padStart(2, '0');
    const rg = Math.round(ag + (bg - ag) * t).toString(16).padStart(2, '0');
    const rb = Math.round(ab + (bb - ab) * t).toString(16).padStart(2, '0');
    return `#${rr}${rg}${rb}`;
  }
  function lerpVec3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }

  return (
    <TimelineContext.Provider
      value={{
        currentEra,
        targetEra,
        setCurrentEra,
        isTransitioning,
        transitionProgress,
        allEras: ERA_IDS,
        currentConfig,
        targetConfig,
        getInterpolatedConfig,
      }}
    >
      {children}
    </TimelineContext.Provider>
  );
};
