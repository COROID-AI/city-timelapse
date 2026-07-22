// @ts-nocheck
import React, { useMemo } from 'react';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { Era } from '../App';

interface PostProcessingProps {
  currentEra?: Era;
}

export function PostProcessing({ currentEra = '1945' }: PostProcessingProps) {
  const bloomSettings = useMemo(() => {
    const settings: Record<Era, { strength: number; radius: number; threshold: number }> = {
      '1945': { strength: 0.3, radius: 0.5, threshold: 0.9 },
      '1965': { strength: 0.5, radius: 0.6, threshold: 0.8 },
      '1985': { strength: 0.8, radius: 0.7, threshold: 0.7 },
      '2005': { strength: 0.6, radius: 0.6, threshold: 0.75 },
      '2025': { strength: 0.7, radius: 0.65, threshold: 0.7 },
      '2055': { strength: 1.2, radius: 0.8, threshold: 0.6 },
    };
    return settings[currentEra];
  }, [currentEra]);

  const chromaticSettings = useMemo(() => {
    const settings: Record<Era, number> = {
      '1945': 0.001,
      '1965': 0.002,
      '1985': 0.005,
      '2005': 0.003,
      '2025': 0.002,
      '2055': 0.01,
    };
    return settings[currentEra];
  }, [currentEra]);

  const vignetteSettings = useMemo(() => {
    const settings: Record<Era, { offset: number; darkness: number }> = {
      '1945': { offset: 0.1, darkness: 0.3 },
      '1965': { offset: 0.1, darkness: 0.2 },
      '1985': { offset: 0.1, darkness: 0.2 },
      '2005': { offset: 0.1, darkness: 0.1 },
      '2025': { offset: 0.1, darkness: 0.1 },
      '2055': { offset: 0.1, darkness: 0.4 },
    };
    return settings[currentEra];
  }, [currentEra]);

  return (
    <EffectComposer disableNormalPass>
      <Bloom
        intensity={bloomSettings.strength}
        radius={bloomSettings.radius}
        threshold={bloomSettings.threshold}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.1}
        mipmapBlur
      />
      <Vignette
        offset={vignetteSettings.offset}
        darkness={vignetteSettings.darkness}
      />
      <ChromaticAberration
        offset={[chromaticSettings, chromaticSettings]}
        radialOnly
      />
    </EffectComposer>
  );
}
