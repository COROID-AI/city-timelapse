import { useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Era } from '../App';

export interface EraTransitionState {
  eraProgress: number; // 0-1 progress for the current era's transition
  fromEra: Era | null;
  toEra: Era;
}

/**
 * Hook that manages era transitions with smooth progress values.
 * Returns a progress value (0-1) that animates as the era changes.
 */
export function useEraTransition(initialEra: Era) {
  const [currentEra, setCurrentEra] = useState<Era>(initialEra);
  const [targetEra, setTargetEra] = useState<Era>(initialEra);
  const [fromEra, setFromEra] = useState<Era | null>(null);
  const [progress, setProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const transitionDuration = 2000; // 2 seconds

  const transition = (newEra: Era) => {
    if (newEra === currentEra) return;
    setFromEra(currentEra);
    setTargetEra(newEra);
    setIsTransitioning(true);
    startTimeRef.current = 0;
  };

  useFrame(() => {
    if (!isTransitioning) return;

    if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }

    const elapsed = Date.now() - startTimeRef.current;
    const t = Math.min(elapsed / transitionDuration, 1);

    // Ease in-out
    const eased = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;

    setProgress(eased);

    if (t >= 1) {
      setCurrentEra(targetEra);
      setIsTransitioning(false);
      setFromEra(null);
      setProgress(0);
      startTimeRef.current = 0;
    }
  });

  return {
    currentEra,
    targetEra,
    fromEra,
    eraProgress: progress,
    isTransitioning,
    transition,
  };
}

/**
 * Interpolates between two values based on era progress.
 */
export function useInterpolatedValue(
  from: number,
  to: number,
  progress: number
): number {
  return from + (to - from) * progress;
}

/**
 * Interpolates between two colors (as hex strings) based on progress.
 */
export function interpolateColor(
  from: string,
  to: string,
  progress: number
): string {
  const fromRgb = hexToRgb(from);
  const toRgb = hexToRgb(to);
  if (!fromRgb || !toRgb) return to;

  const r = Math.round(fromRgb.r + (toRgb.r - fromRgb.r) * progress);
  const g = Math.round(fromRgb.g + (toRgb.g - fromRgb.g) * progress);
  const b = Math.round(fromRgb.b + (toRgb.b - fromRgb.b) * progress);

  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Maps a value from one range to another.
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

/**
 * Clamps a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
