// Lightweight domain state for the timelapse, decoupled from Three objects.
// main.ts owns the single instance and passes it to scene modules.

import type { EraId } from './eras';
import { getEraSpec } from './eras';

export interface AppState {
  era: EraId;
  /** Continuous timeline position in [0, eraCount-1], used by modules. */
  eraFloat: number;
  /** True while an era transition is animating. */
  transitioning: boolean;
  /** Audio enabled (after first user gesture) and sound not muted. */
  audioEnabled: boolean;
  /** True when prefers-reduced-motion is active (shorter transitions). */
  reducedMotion: boolean;
  /** DPR clamp sent from the renderer (used by canvas-sized textures). */
  pixelRatio: number;
}

export interface HUDState {
  era: EraId;
  description: string;
  audioEnabled: boolean;
  muted: boolean;
}

export const INITIAL_ERA: EraId = '1945';

export function createInitialState(): AppState {
  return {
    era: INITIAL_ERA,
    eraFloat: 0,
    transitioning: false,
    audioEnabled: false,
    reducedMotion: false,
    pixelRatio: 1,
  };
}

export function createHUDState(audioEnabled = false): HUDState {
  const spec = getEraSpec(INITIAL_ERA);
  return {
    era: INITIAL_ERA,
    description: spec.description,
    audioEnabled,
    muted: false,
  };
}