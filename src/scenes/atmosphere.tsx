import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { EraData } from './eras/types.js';

/**
 * Per-era atmosphere, lighting & sky (1945–2025).
 *
 * Single owner of the scene's lighting, sky exposure, haze, dust, contrast
 * and colour saturation. Consumes the era registry read-only:
 *
 *  - **Sky & lighting** derive from `EraData.atmosphere` (profileId, skyTint,
 *    sunGlow, lightWarmth, skyExposure) so each era renders an authentic
 *    light: 1945 golden haze, 1965 mid-century pastel, 1985 electric dusk,
 *    2005 crisp clean, 2025 LED-clean high.
 *  - **Air quality** (haze/dust), **contrast**, **saturation** and
 *    **shadow softness** scale with the era profile so the whole block
 *    transforms continuously during transitions.
 *
 * The `Atmosphere` React component mounts a single `<atmosphere-display>`
 * node carrying every era-derived value as data attributes so any renderer
 * (React Three Fiber, a headless test harness) can read them without a DOM.
 * The pure helpers (`resolveAtmosphere`, `resolveLighting`) let lifecycle and
 * headless consumers assert per-era behaviour without mounting the component.
 */

/** The resolved, era-derived atmosphere values for one frame. */
export interface AtmosphereState {
  profileId: string;
  skyTint: { r: number; g: number; b: number };
  sunGlow: number;
  lightWarmth: number;
  skyExposure: number;
  haze: number;
  dust: number;
  contrast: number;
  saturation: number;
  shadowSoftness: number;
}

/** Resolve the atmosphere state from an era profile (possibly interpolated). */
export function resolveAtmosphere(era: EraData): AtmosphereState {
  const a = era.atmosphere;
  return {
    profileId: a.profileId,
    skyTint: { ...a.skyTint },
    sunGlow: a.sunGlow,
    lightWarmth: a.lightWarmth,
    skyExposure: a.skyExposure,
    haze: a.haze,
    dust: a.dust,
    contrast: a.contrast,
    saturation: a.saturation,
    shadowSoftness: a.shadowSoftness,
  };
}

/** The lighting key derived from the era's profile (sky + sun + warmth). */
export function resolveLighting(era: EraData): {
  sky: { r: number; g: number; b: number };
  sun: number;
  warmth: number;
} {
  const a = era.atmosphere;
  return {
    sky: { ...a.skyTint },
    sun: a.sunGlow,
    warmth: a.lightWarmth,
  };
}

/**
 * The React component for the atmosphere display.
 *
 * `era` is the exact (possibly interpolated) profile for the current timeline
 * step; all values recompute whenever it changes, so the sky and light
 * interpolate continuously during transitions.
 */
export function Atmosphere({ era }: { era: EraData }): ReactNode {
  const state = useMemo(() => resolveAtmosphere(era), [era]);
  return (
    <atmosphere-display
      profileId={state.profileId}
      skyR={state.skyTint.r}
      skyG={state.skyTint.g}
      skyB={state.skyTint.b}
      sunGlow={state.sunGlow}
      lightWarmth={state.lightWarmth}
      skyExposure={state.skyExposure}
      haze={state.haze}
      dust={state.dust}
      contrast={state.contrast}
      saturation={state.saturation}
      shadowSoftness={state.shadowSoftness}
    />
  );
}

/* Minimal intrinsic element declarations so the module compiles under the
   react-jsx transform regardless of the app's component library. Mounting
   (tests) reads these as data attributes via react-dom/server. */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'atmosphere-display': {
        profileId?: string;
        skyR?: number;
        skyG?: number;
        skyB?: number;
        sunGlow?: number;
        lightWarmth?: number;
        skyExposure?: number;
        haze?: number;
        dust?: number;
        contrast?: number;
        saturation?: number;
        shadowSoftness?: number;
      };
    }
  }
}