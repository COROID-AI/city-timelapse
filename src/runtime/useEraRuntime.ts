/**
 * useEraRuntime — the single per-frame coordination hook.
 *
 * Every frame: clamp delta, advance the eased `eraFloat` toward the target,
 * compute the interpolated era config, and fire SFX exactly once when an era
 * boundary is crossed. Subsystems read `eraConfig` to update their meshes.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useAppStore } from "../state/store";
import { advanceEra, eraState, syncTargetFromStore } from "../runtime/eraState";
import { clampDelta, eraConfigAt, type InterpolatedEra } from "../utils/interp";
import { ERAS } from "../data/eras";
import { audioEngine } from "../audio/AudioEngine";

export interface EraRuntime {
  /** latest interpolated era (updated each frame) */
  era: InterpolatedEra;
  /** seconds since mount (monotonic, delta-clamped accumulation) */
  clock: number;
}

/**
 * Drives the eased eraFloat. Returns a ref to the latest interpolated era so
 * consumer components can read it inside their own useFrame without props.
 */
export function useEraRuntime(): React.RefObject<EraRuntime> {
  const ref = useRef<EraRuntime>({
    era: eraConfigAt(eraState.eraFloat),
    clock: 0,
  });

  // Keep the target in sync whenever the store changes.
  useEffect(() => {
    syncTargetFromStore();
    const unsub = useAppStore.subscribe((s) => {
      eraState.targetEra = s.targetEra;
    });
    return unsub;
  }, []);

  useFrame((_, rawDelta) => {
    const dt = clampDelta(rawDelta);
    ref.current.clock += dt;
    const ef = advanceEra(dt);
    ref.current.era = eraConfigAt(ef);

    // Fire era-change SFX exactly once when we settle on a new integer era
    // (or cross an integer boundary while sweeping).
    const nearest = Math.round(ef);
    const started = useAppStore.getState().audioStarted;
    const enabled = useAppStore.getState().audioEnabled;
    if (
      started &&
      enabled &&
      nearest !== eraState.lastMotifEra &&
      Math.abs(ef - nearest) < 0.06
    ) {
      eraState.lastMotifEra = nearest;
      const clamped = Math.max(0, Math.min(ERAS.length - 1, nearest));
      audioEngine.playEraChange(ERAS[clamped].sfx);
    }
  });

  return ref;
}
