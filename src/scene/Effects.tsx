import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  Vignette,
  ToneMapping,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type { BloomEffect } from 'postprocessing';
import { useEraTimeline } from '../store/eraTimeline';
import { useSettings } from '../store/settings';

/**
 * Per-era bloom tuning.
 *
 * Neon-heavy / digitally-lit eras (1985 neon, 2005 digital, 2025 LED) bloom
 * much harder than the warm, dim eras of the mid-century, so the glow reads as
 * coming from the scene's own signage and screens.
 */
interface EraBloomProfile {
  intensity: number;
}

const BLOOM_PROFILE: Record<string, EraBloomProfile> = {
  '1945': { intensity: 0.45 },
  '1965': { intensity: 0.8 },
  '1985': { intensity: 1.4 },
  '2005': { intensity: 1.05 },
  '2025': { intensity: 1.5 },
};

/** Linear interpolation. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp a normalized progress into 0..1. */
function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Smoothstep easing, matched to the shared era transition easing. */
function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Postprocessing chain: bloom + vignette + tone mapping.
 *
 * The bloom intensity live-updates every frame from the shared era store's
 * current/target eras and transition progress, so the glow smoothly interpolates
 * with the same eased transition that drives the rest of the scene. When the
 * user disables postprocessing (low-end toggle), the whole compositor is
 * unmounted so no effect passes run at all.
 */
export function Effects() {
  const bloomRef = useRef<BloomEffect | null>(null);
  const enabled = useSettings((s) => s.postprocessingEnabled);

  // Scale bloom with the era transition every frame.
  useFrame(() => {
    const bloom = bloomRef.current;
    if (!bloom) return;

    const { currentEra, targetEra, transitionProgress } =
      useEraTimeline.getState();

    const from = BLOOM_PROFILE[currentEra] ?? BLOOM_PROFILE['1945'];
    const to = BLOOM_PROFILE[targetEra] ?? BLOOM_PROFILE['1945'];
    const t = easeInOut(clamp01(transitionProgress));

    bloom.intensity = lerp(from.intensity, to.intensity, t);
  });

  // Keep the effect list mounted only while enabled.
  if (!enabled) return null;

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloomRef}
        mipmapBlur
        intensity={0.5}
        luminanceThreshold={0.7}
        luminanceSmoothing={0.2}
        radius={0.8}
        levels={7}
      />
      <Vignette eskil={false} offset={0.28} darkness={0.62} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}