import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useEra } from '../contexts/EraContext';
import type { EraYear } from '../types';

/**
 * Duration for crossfades/morphs when the era slider changes.
 * Acceptance criteria: 1.5–2s.
 */
export const ERA_TRANSITION_DURATION_SECONDS = 1.7;

export type EraTransitionState = {
  fromYear: EraYear;
  toYear: EraYear;
  /** 0..1 linear in time */
  progress: number;
  /** eased 0..1 (recommended for opacity/scale) */
  easedProgress: number;
  isTransitioning: boolean;
};

const EraTransitionContext = createContext<EraTransitionState | null>(null);

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function EraTransitionProvider({ children }: { children: React.ReactNode }) {
  const { year } = useEra();

  const committedYearRef = useRef<EraYear>(year);

  const [state, setState] = useState<EraTransitionState>(() => ({
    fromYear: year,
    toYear: year,
    progress: 1,
    easedProgress: 1,
    isTransitioning: false,
  }));

  // Start a new transition whenever the committed era year changes.
  useEffect(() => {
    if (year === committedYearRef.current) return;

    setState({
      fromYear: committedYearRef.current,
      toYear: year,
      progress: 0,
      easedProgress: 0,
      isTransitioning: true,
    });
  }, [year]);

  useFrame((_r3f, delta) => {
    setState((s) => {
      if (!s.isTransitioning) return s;

      const nextProgress = Math.min(1, s.progress + delta / ERA_TRANSITION_DURATION_SECONDS);
      const nextEased = easeInOutCubic(nextProgress);

      if (nextProgress >= 1) {
        committedYearRef.current = s.toYear;
        return {
          fromYear: s.toYear,
          toYear: s.toYear,
          progress: 1,
          easedProgress: 1,
          isTransitioning: false,
        };
      }

      return {
        ...s,
        progress: nextProgress,
        easedProgress: nextEased,
      };
    });
  });

  return React.createElement(EraTransitionContext.Provider, { value: state }, children);
}

export function useEraTransition(): EraTransitionState {
  const ctx = useContext(EraTransitionContext);
  if (!ctx) throw new Error('useEraTransition must be used within EraTransitionProvider');
  return ctx;
}

// ── Shared interpolation helpers for fog/background ────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return (r << 16) | (g << 8) | bl;
}

function getEraConfig(year: EraYear) {
  switch (year) {
    case 1945:
      return { fogColor: 0x3a3a3a, fogNear: 20, fogFar: 80, background: 0x2a2a2a };
    case 1965:
      return { fogColor: 0x5a6a5a, fogNear: 20, fogFar: 100, background: 0x4a5a4a };
    case 1985:
      return { fogColor: 0x6a7a8a, fogNear: 20, fogFar: 120, background: 0x5a6a7a };
    case 2005:
      return { fogColor: 0x8a9aaa, fogNear: 20, fogFar: 140, background: 0x7a8a9a };
    case 2025:
      return { fogColor: 0xaabbcc, fogNear: 20, fogFar: 160, background: 0x9aabbc };
    case 2055:
      return { fogColor: 0xccddee, fogNear: 20, fogFar: 200, background: 0xbbcdde };
  }
}

export type EraBlendForScene = {
  fogColor: number;
  fogNear: number;
  fogFar: number;
  background: number;
  /** same as easedProgress, stored for downstream convenience */
  t: number;
  lo: EraYear;
  hi: EraYear;
};

/**
 * Blend fog/background between two discrete era years.
 *
 * `t` should typically be the shared `easedProgress` from EraTransitionProvider.
 */
export function interpolateEraData(from: EraYear, to: EraYear, t: number): EraBlendForScene {
  if (from === to) {
    const cfg = getEraConfig(from);
    return { ...cfg, t: 1, lo: from, hi: to };
  }

  const loCfg = getEraConfig(from);
  const hiCfg = getEraConfig(to);

  return {
    fogColor: lerpColor(loCfg.fogColor, hiCfg.fogColor, t),
    fogNear: lerp(loCfg.fogNear, hiCfg.fogNear, t),
    fogFar: lerp(loCfg.fogFar, hiCfg.fogFar, t),
    background: lerpColor(loCfg.background, hiCfg.background, t),
    t,
    lo: from,
    hi: to,
  };
}

/**
 * Convenience hook: derive an EraBlendForScene for use by background/fog.
 */
export function useEraBlendForScene() {
  const { fromYear, toYear, easedProgress } = useEraTransition();
  return useMemo(() => interpolateEraData(fromYear, toYear, easedProgress), [fromYear, toYear, easedProgress]);
}
