import { createContext, useContext } from 'react';
import { Color } from 'three';
import { ERAS } from '../lib/era-data';

/**
 * The single mutable container of interpolated scene parameters.
 *
 * One instance is created when the scene mounts and is mutated in place every
 * frame by the {@link TransitionController}. Every other scene component reads
 * from this same object inside its own `useFrame` callback — it never triggers a
 * React re-render, so the tree is never remounted on era changes.
 *
 * All `Color` fields are pre-allocated and copied into; nothing is allocated in
 * the frame loop.
 */
export interface SceneState {
  displayEra: number;
  floor: number;
  ceil: number;
  frac: number;

  // Sky / atmosphere (colors mutated in place)
  topColor: Color;
  horizonColor: Color;
  ambientColor: Color;
  sunColor: Color;
  hemiSkyColor: Color;
  hemiGroundColor: Color;
  buildingColor: Color;
  windowColor: Color;
  asphaltColor: Color;
  sidewalkColor: Color;
  vehicleColor: Color;

  // Scalars (mutated in place)
  fogNear: number;
  fogFar: number;
  ambientIntensity: number;
  sunIntensity: number;
  sunAzimuth: number;
  sunElevation: number;
  hemiIntensity: number;
  exposure: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  buildingStories: number;
  buildingRoughness: number;
  buildingMetalness: number;
  windowEmissive: number;
  streetlightIntensity: number;
  headlightIntensity: number;
}

export function createSceneState(): SceneState {
  const e = ERAS[0];
  return {
    displayEra: 0,
    floor: 0,
    ceil: 0,
    frac: 0,
    topColor: e.topColor.clone(),
    horizonColor: e.horizonColor.clone(),
    ambientColor: e.ambientColor.clone(),
    sunColor: e.sunColor.clone(),
    hemiSkyColor: e.hemiSkyColor.clone(),
    hemiGroundColor: e.hemiGroundColor.clone(),
    buildingColor: e.buildingColor.clone(),
    windowColor: e.windowColor.clone(),
    asphaltColor: e.asphaltColor.clone(),
    sidewalkColor: e.sidewalkColor.clone(),
    vehicleColor: e.vehicleColor.clone(),
    fogNear: e.fogNear,
    fogFar: e.fogFar,
    ambientIntensity: e.ambientIntensity,
    sunIntensity: e.sunIntensity,
    sunAzimuth: e.sunAzimuth,
    sunElevation: e.sunElevation,
    hemiIntensity: e.hemiIntensity,
    exposure: e.exposure,
    bloomStrength: e.bloomStrength,
    bloomRadius: e.bloomRadius,
    bloomThreshold: e.bloomThreshold,
    buildingStories: e.buildingStories,
    buildingRoughness: e.buildingRoughness,
    buildingMetalness: e.buildingMetalness,
    windowEmissive: e.windowEmissive,
    streetlightIntensity: e.streetlightIntensity,
    headlightIntensity: e.headlightIntensity,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Fill `state` with the interpolated parameters for a (possibly fractional)
 * `displayEra`. Deterministic: the same input always yields the same output,
 * and an integer era yields that era's exact values — guaranteeing correct
 * endpoints after interruptions or reduced-motion snaps.
 */
export function updateSceneState(state: SceneState, displayEra: number): void {
  const clamped = Math.max(0, Math.min(ERAS.length - 1, displayEra));
  const floor = Math.floor(clamped);
  const ceil = Math.min(floor + 1, ERAS.length - 1);
  const frac = ceil === floor ? 0 : clamped - floor;

  state.displayEra = clamped;
  state.floor = floor;
  state.ceil = ceil;
  state.frac = frac;

  const a = ERAS[floor];
  const b = ERAS[ceil];

  state.topColor.copy(a.topColor).lerp(b.topColor, frac);
  state.horizonColor.copy(a.horizonColor).lerp(b.horizonColor, frac);
  state.ambientColor.copy(a.ambientColor).lerp(b.ambientColor, frac);
  state.sunColor.copy(a.sunColor).lerp(b.sunColor, frac);
  state.hemiSkyColor.copy(a.hemiSkyColor).lerp(b.hemiSkyColor, frac);
  state.hemiGroundColor.copy(a.hemiGroundColor).lerp(b.hemiGroundColor, frac);
  state.buildingColor.copy(a.buildingColor).lerp(b.buildingColor, frac);
  state.windowColor.copy(a.windowColor).lerp(b.windowColor, frac);
  state.asphaltColor.copy(a.asphaltColor).lerp(b.asphaltColor, frac);
  state.sidewalkColor.copy(a.sidewalkColor).lerp(b.sidewalkColor, frac);
  state.vehicleColor.copy(a.vehicleColor).lerp(b.vehicleColor, frac);

  state.fogNear = lerp(a.fogNear, b.fogNear, frac);
  state.fogFar = lerp(a.fogFar, b.fogFar, frac);
  state.ambientIntensity = lerp(a.ambientIntensity, b.ambientIntensity, frac);
  state.sunIntensity = lerp(a.sunIntensity, b.sunIntensity, frac);
  state.sunAzimuth = lerp(a.sunAzimuth, b.sunAzimuth, frac);
  state.sunElevation = lerp(a.sunElevation, b.sunElevation, frac);
  state.hemiIntensity = lerp(a.hemiIntensity, b.hemiIntensity, frac);
  state.exposure = lerp(a.exposure, b.exposure, frac);
  state.bloomStrength = lerp(a.bloomStrength, b.bloomStrength, frac);
  state.bloomRadius = lerp(a.bloomRadius, b.bloomRadius, frac);
  state.bloomThreshold = lerp(a.bloomThreshold, b.bloomThreshold, frac);
  state.buildingStories = lerp(a.buildingStories, b.buildingStories, frac);
  state.buildingRoughness = lerp(a.buildingRoughness, b.buildingRoughness, frac);
  state.buildingMetalness = lerp(a.buildingMetalness, b.buildingMetalness, frac);
  state.windowEmissive = lerp(a.windowEmissive, b.windowEmissive, frac);
  state.streetlightIntensity = lerp(a.streetlightIntensity, b.streetlightIntensity, frac);
  state.headlightIntensity = lerp(a.headlightIntensity, b.headlightIntensity, frac);
}

export const SceneStateContext = createContext<SceneState | null>(null);

export function useSceneState(): SceneState {
  const state = useContext(SceneStateContext);
  if (!state) throw new Error('useSceneState must be used within SceneStateContext');
  return state;
}
