/**
 * Post-processing whose cost scales with the era/quality.
 *
 * Neon/2055 eras get stronger bloom; smog eras get a subtle vignette + noise;
 * bright daytime eras keep effects minimal. All effects read the eased era so
 * they evolve in lockstep with the rest of the scene.
 */

import { EffectComposer, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { InterpolatedEra } from "../utils/interp";
import { eraState } from "../runtime/eraState";

export function PostFx({
  rt,
}: {
  rt: React.RefObject<{ era: InterpolatedEra; clock: number }>;
}) {
  const bloomRef = useRef<{ intensity: number; luminanceThreshold: number } | null>(null);
  const vignetteRef = useRef<{ darkness: number; offset: number } | null>(null);

  useFrame(() => {
    const e = rt.current.era;
    const ef = eraState.eraFloat;
    // Bloom grows with window/billboard glow (neon + future eras).
    const glow = e.windowGlow + e.billboardEmissive * 0.5;
    // cast-away: postprocessing refs expose mutable props
    const b = bloomRef.current as unknown as {
      intensity: number;
      luminanceThreshold: number;
    } | null;
    if (b) {
      b.intensity = THREE.MathUtils.lerp(0.15, 1.4, Math.min(1, glow));
      b.luminanceThreshold = THREE.MathUtils.lerp(0.8, 0.25, Math.min(1, glow));
    }
    const v = vignetteRef.current as unknown as {
      darkness: number;
      offset: number;
    } | null;
    if (v) {
      // darker/twilight eras vignette harder
      const dark = 1 - e.sun / 1.4;
      v.darkness = THREE.MathUtils.lerp(0.2, 0.9, Math.max(0, dark));
      v.offset = THREE.MathUtils.lerp(0.35, 0.2, Math.max(0, dark));
    }
    void ef;
  });

  return (
    <EffectComposer multisampling={2}>
      <Bloom
        ref={bloomRef as never}
        intensity={0.4}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.3}
        kernelSize={KernelSize.LARGE}
      />
      <Vignette ref={vignetteRef as never} eskil={false} offset={0.3} darkness={0.5} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.25} />
    </EffectComposer>
  );
}
