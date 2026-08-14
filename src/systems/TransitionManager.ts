/// <reference types="node" />
/**
 * Era Transition Manager
 *
 * Smooth animated transitions between eras using the Zustand store's
 * transitionProgress state (0→1 over ~1.5s).
 *
 * Features:
 * - Listens for setCurrentEra() calls and manages interpolation
 * - Provides interpolate() function using eased cubic interpolation (easeInOutCubic)
 * - Applies interpolated values to scene properties
 * - Supports interruptible transitions
 * - Exposes useEraTransition() React hook
 * - Integrates with audio mixer
 */

import {
  useEraStore,
  type EraStoreState,
  type EraStoreActions,
} from '../store/eraStore';
import {
  EraId,
  VisualEraData,
  VISUAL_ERA_DATA,
  type VisualEraData as VisualEraDataType,
} from '../eras';
import { useEffect, useCallback, useState } from 'react';

/**
 * easeInOutCubic easing function
 * - t in [0, 1]
 * - Smooth acceleration at start, deceleration at end
 */
const easeInOutCubic = (t: number): number => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/**
 * Interpolate between current and target values using easeInOutCubic
 *
 * @param currentVal Starting value
 * @param targetVal Ending value
 * @param progress 0-1 interpolation progress
 * @returns Eased interpolated value
 */
const interpolate = (
  currentVal: number | string,
  targetVal: number | string,
  progress: number
): number | string => {
  const easedProgress = easeInOutCubic(progress);

  if (typeof currentVal === 'number' && typeof targetVal === 'number') {
    return currentVal + (targetVal - currentVal) * easedProgress;
  }

  if (typeof currentVal === 'string' && typeof targetVal === 'string') {
    // Hex color interpolation (6-digit hex colors like #RRGGBB)
    if (
      currentVal.startsWith('#') &&
      targetVal.startsWith('#') &&
      currentVal.length === 7 &&
      targetVal.length === 7
    ) {
      const from = parseInt(currentVal.slice(1), 16);
      const to = parseInt(targetVal.slice(1), 16);
      const interpolated = Math.round(from + (to - from) * easedProgress);
      return `#${interpolated
        .toString(16)
        .padStart(6, '0')}`;
    }
    return targetVal;
  }

  return targetVal;
};

/**
 * Interpolate a number value with easeInOutCubic
 */
const interpolateNumber = (
  current: number,
  target: number,
  progress: number
): number => {
  return current + (target - current) * easeInOutCubic(progress);
};

/**
 * Interpolate fog density
 */
const interpolateFogDensity = (
  current: number,
  target: number,
  progress: number
): number => {
  return current + (target - current) * easeInOutCubic(progress);
};

/**
 * Interpolate ambient light intensity
 */
const interpolateAmbientIntensity = (
  current: number,
  target: number,
  progress: number
): number => {
  return current + (target - current) * easeInOutCubic(progress);
};

/**
 * Interpolate lighting color temperature
 */
const interpolateLightingColorTemp_single = (
  current: number,
  target: number,
  progress: number
): number => {
  return current + (target - current) * easeInOutCubic(progress);
};

/**
 * Interpolate ambient light color (hex) between two eras
 */
const interpolateAmbientLightColor = (
  currentColor: string,
  targetColor: string,
  progress: number
): string => {
  const easedProgress = easeInOutCubic(progress);
  if (
    currentColor.startsWith('#') &&
    targetColor.startsWith('#') &&
    currentColor.length === 7 &&
    targetColor.length === 7
  ) {
    const from = parseInt(currentColor.slice(1), 16);
    const to = parseInt(targetColor.slice(1), 16);
    const interpolated = Math.round(from + (to - from) * easedProgress);
    return `#${interpolated
      .toString(16)
      .padStart(6, '0')}`;
  }
  return targetColor;
};

/**
 * Interpolate lighting color temperature between two eras
 */
const interpolateLightingColorTemp_between = (
  currentTemp: number,
  targetTemp: number,
  progress: number
): number => {
  return currentTemp + (targetTemp - currentTemp) * easeInOutCubic(progress);
};

/**
 * Map lighting type to color temperature
 * Warm lighting -> lower color temperature (3000K)
 * Cool lighting -> higher color temperature (6500K)
 */
const lightingTypeToColorTemp = (lightingType: string): number => {
  switch (lightingType) {
    case 'warm_glow':
      // Incandescent / Edison warmth
      return 2700;
    case 'neon_tube':
      // Neutral-warm daylight (slightly warm than full daylight)
      return 4200;
    case 'neon_sign':
      // Fluorescent/cool-white tube feel
      return 6500;
    case 'cfl_spiral':
      // Warm industrial under-cabinet feel
      return 3000;
    case 'adaptive_led':
      // Smart LED default neutral white
      return 4000;
    default:
      return 6500;
  }
};

/**
 * Get visual data for an era
 */
const getVisualData = (eraId: EraId): VisualEraDataType => {
  return VISUAL_ERA_DATA[eraId];
};

/**
 * Get wall color for an era
 */
const getWallColor = (eraId: EraId): string => {
  return VISUAL_ERA_DATA[eraId].wallColor;
};

/**
 * Get fog density for an era
 */
const getFogDensity = (eraId: EraId): number => {
  return VISUAL_ERA_DATA[eraId].fogDensity;
};

/**
 * Get ambient light color for an era (hex string)
 */
const getAmbientLightColor = (eraId: EraId): string => {
  return VISUAL_ERA_DATA[eraId].ambientLightColor;
};

/**
 * Get lighting type for an era
 */
const getLightingType = (eraId: EraId): string => {
  return VISUAL_ERA_DATA[eraId].lightingType;
};

/**
 * React hook for era transition state and utilities
 *
 * Exposes the transition progress and interpolated visual properties
 * that components can consume for smooth fade/slide animations.
 *
 * The hook builds on the existing Zustand era store which manages the
 * 1.5-second transition timer via requestAnimationFrame.
 *
 * Interruptible transitions: When a new era is selected mid-transition,
 * the store automatically cancels the existing animation and starts a
 * fresh transition from the current visual state to the new target.
 */
export const useEraTransition = (): EraTransitionHookReturn => {
  const store = useEraStore<EraStoreState, EraStoreActions>();

  const {
    currentEra,
    targetEra,
    isTransitioning,
    transitionProgress,
    transitionDuration,
    onTransitionComplete,
    setTransitionDuration,
    resetTransition,
  } = store;

  // Interpolated visual properties state
  const [wallColor, setWallColor] = useState<string>('#ffffff');
  const [fogDensity, setFogDensity] = useState<number>(0.0);
  const [ambientLightColor, setAmbientLightColor] = useState<string>('#ffffff');
  const [lightingColorTemp, setLightingColorTemp] = useState<number>(6500);

  // Current and target era visual data
  const currentEraData = currentEra
    ? VISUAL_ERA_DATA[currentEra]
    : null;
  const targetEraData = targetEra ? VISUAL_ERA_DATA[targetEra] : null;

  // Update interpolated properties based on transition progress
  useEffect(() => {
    const updateInterpolatedProps = () => {
      if (!currentEraData && !targetEraData) {
        // No era data available
        return;
      }

      if (!isTransitioning || !targetEraData) {
        // Not transitioning - just use current era data
        if (currentEraData) {
          setWallColor(getWallColor(currentEra));
          setFogDensity(getFogDensity(currentEra));
          const currentTemp = lightingTypeToColorTemp(
            getLightingType(currentEra)
          );
          const targetTemp = targetEraData.lightingType
            ? lightingTypeToColorTemp(getLightingType(targetEra))
            : currentTemp;
          setLightingColorTemp(
            interpolateLightingColorTemp_single(currentTemp, targetTemp, 0)
          );
          setAmbientLightColor(getAmbientLightColor(currentEra));
        }
        return;
      }

      // Interpolate between current and target era data
      const progress = transitionProgress;

      // Wall color interpolation
      const interpolatedColor = interpolate(
        currentEraData.wallColor,
        targetEraData.wallColor,
        progress
      );
      // Cast to string since interpolate() returns number|string but
      // we're passing string arguments, so the result will be a hex color string
      setWallColor(interpolatedColor as string);

      // Fog density interpolation
      const interpolatedFog = interpolateFogDensity(
        currentEraData.fogDensity,
        targetEraData.fogDensity,
        progress
      );
      setFogDensity(interpolatedFog);

      // Ambient light color interpolation
      const interpolatedAmbientColor = interpolateAmbientLightColor(
        currentEraData.ambientLightColor,
        targetEraData.ambientLightColor,
        progress
      );
      setAmbientLightColor(interpolatedAmbientColor);

      // Lighting color temperature interpolation
      const currentTemp = lightingTypeToColorTemp(
        getLightingType(currentEra)
      );
      const targetTemp = lightingTypeToColorTemp(
        getLightingType(targetEra)
      );
      const interpolatedColorTemp = interpolateLightingColorTemp_between(
        currentTemp,
        targetTemp,
        progress
      );
      setLightingColorTemp(interpolatedColorTemp);
    };

    updateInterpolatedProps();
  }, [
    transitionProgress,
    isTransitioning,
    currentEra,
    targetEra,
    currentEraData,
    targetEraData,
  ]);

  // Handle era selection with interruptible transition
  const handleEraSelect = useCallback(
    (eraId: EraId) => {
      if (currentEra === eraId) return;

      // Trigger SfxMixer.setEra() synchronously with visual transition start
      // This ensures audio-visual synchronization per the audio implementation plan
      try {
        // Import here to avoid circular dependencies; SfxMixer defined in audio implementation plan
        // @ts-ignore - SfxMixer may not be fully typed yet, will be integrated in audio plan
        const { SfxMixer } = require('../audio/sfxMixer');
        SfxMixer.setEra(eraId);
      } catch (e) {
        // SfxMixer not yet available - will be integrated in later phase
        // This is expected during initial implementation; the integration point exists
        console.debug('SfxMixer not yet available for era transition audio sync');
      }

      // The store's setCurrentEra will:
      // 1. Cancel any existing RAf animation
      // 2. Set targetEra, isTransitioning=true, transitionProgress=0
      // 3. Start a new 1.5s transition timer
      // This is already interruptible by design
      store.setCurrentEra(eraId);
    },
    [store, currentEra]
  );

  // Expose interrupt transition function
  const interruptTransition = useCallback(
    (newEraId: EraId) => {
      if (currentEra === newEraId) return;
      // Reset and start fresh transition from current visual state
      resetTransition();
      store.setCurrentEra(newEraId);
    },
    [currentEra, resetTransition]
  );

  // Set up effect to listen for transition completion
  useEffect(() => {
    if (onTransitionComplete) {
      return onTransitionComplete;
    }
  }, [onTransitionComplete]);

  return {
    // Core transition state
    transitionProgress,
    isTransitioning,
    currentEra,
    targetEra,
    transitionDuration,

    // Interpolated visual properties
    wallColor,
    fogDensity,
    ambientLightColor,
    lightingColorTemp,

    // Utility functions
    interpolate,
    interpolateNumber,
    interpolateFogDensity,
    interpolateAmbientIntensity,
    interpolateLightingColorTemp: interpolateLightingColorTemp_single,
    getWallColor,
    getFogDensity,
    getAmbientLightColor,
    getLightingType,
    getLightingColorTemp: lightingTypeToColorTemp,

    // Action handlers
    handleEraSelect,
    interruptTransition,
    resetTransition: resetTransition,

    // Callbacks
    onTransitionComplete: onTransitionComplete || null,
  };
};

/**
 * Return type for the useEraTransition hook
 */
export interface EraTransitionHookReturn {
  // Core transition state
  transitionProgress: number;
  isTransitioning: boolean;
  currentEra: EraId | null;
  targetEra: EraId | null;
  transitionDuration: number;

  // Interpolated visual properties
  wallColor: string;
  fogDensity: number;
  ambientLightColor: string;
  lightingColorTemp: number;

  // Utility functions
  interpolate: typeof interpolate;
  interpolateNumber: typeof interpolateNumber;
  interpolateFogDensity: typeof interpolateFogDensity;
  interpolateAmbientIntensity: typeof interpolateAmbientIntensity;
  interpolateLightingColorTemp: typeof interpolateLightingColorTemp_single;
  getWallColor: (eraId: EraId) => string;
  getFogDensity: (eraId: EraId) => number;
  getAmbientLightColor: (eraId: EraId) => string;
  getLightingType: (eraId: EraId) => string;
  getLightingColorTemp: (eraId: EraId) => number;

  // Action handlers
  handleEraSelect: (eraId: EraId) => void;
  interruptTransition: (newEraId: EraId) => void;
  resetTransition: () => void;

  // Callbacks
  onTransitionComplete: ((era: EraId) => void) | null;
}