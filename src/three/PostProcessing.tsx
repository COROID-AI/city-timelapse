/**
 * Post-processing: Bloom + Vignette, both driven by the continuous scene config
 * via the SceneDriver. The wrapper components forward refs to the underlying
 * `postprocessing` effect instances, so the driver writes
 * `bloomRef.current.intensity` / `vignetteRef.current.darkness` directly each
 * frame.
 */
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import type { RefObject } from 'react'
import type { BloomEffect, VignetteEffect } from 'postprocessing'

export interface PostRefs {
  bloom: RefObject<BloomEffect | null>
  vignette: RefObject<VignetteEffect | null>
}

export function PostProcessing({ refs }: { refs: PostRefs }) {
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <Bloom
        ref={refs.bloom as any}
        intensity={0.25}
        luminanceThreshold={0.22}
        luminanceSmoothing={0.4}
        mipmapBlur
        radius={0.72}
      />
      <Vignette ref={refs.vignette as any} darkness={0.45} offset={0.3} />
    </EffectComposer>
  )
}
