import { EffectComposer, Bloom, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import type { Era } from '../types/era'
import { ERA_CONFIGS } from '../types/era'

interface PostProcessingProps {
  era: Era
}

export function PostProcessing({ era }: PostProcessingProps) {
  const config = ERA_CONFIGS[era]

  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.2}
        luminanceSmoothing={0.9}
        height={300}
        intensity={config.postProcessing.bloom}
      />
      <Noise
        blendFunction={BlendFunction.ADD}
        opacity={0.02}
      />
    </EffectComposer>
  )
}