import React, { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { EffectComposer, BlendFunction, BloomEffect, HueSaturationEffect, BrightnessContrastEffect } from 'postprocessing'
import { lerpHex } from '../utils/color'

type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

interface PostProcessingProps {
  eraA: Era
  eraB: Era
  blendT: number
}

export function PostProcessing({ eraA, eraB, blendT }: PostProcessingProps) {
  const { gl } = useThree()
  const composerRef = useRef<EffectComposer | null>(null)

  const bloom = useMemo(() => {
    const a = eraA === '2055' ? 1.0 : eraA === '2025' ? 0.7 : eraA === '1985' ? 0.6 : eraA === '2005' ? 0.5 : eraA === '1965' ? 0.4 : 0.2
    const b = eraB === '2055' ? 1.0 : eraB === '2025' ? 0.7 : eraB === '1985' ? 0.6 : eraB === '2005' ? 0.5 : eraB === '1965' ? 0.4 : 0.2
    return a + (b - a) * blendT
  }, [eraA, eraB, blendT])

  const sat = useMemo(() => {
    const a = eraA === '2055' ? 1.25 : eraA === '2025' ? 1.15 : 1.05
    const b = eraB === '2055' ? 1.25 : eraB === '2025' ? 1.15 : 1.05
    return a + (b - a) * blendT
  }, [eraA, eraB, blendT])

  const contrast = useMemo(() => {
    const a = eraA === '1945' ? 1.1 : eraA === '2055' ? 1.35 : 1.25
    const b = eraB === '1945' ? 1.1 : eraB === '2055' ? 1.35 : 1.25
    return a + (b - a) * blendT
  }, [eraA, eraB, blendT])

  useEffect(() => {
    if (!gl) return

    const composer = new EffectComposer(gl)
    composerRef.current = composer

    const bloomEffect = new BloomEffect({
      intensity: bloom,
      luminanceThreshold: 0.2,
      luminanceSmoothing: 0.9,
      blendFunction: BlendFunction.SCREEN,
    })

    const hueSat = new HueSaturationEffect({
      saturation: sat,
      blendFunction: BlendFunction.NORMAL,
    })

    const bc = new BrightnessContrastEffect({
      brightness: 0.0,
      contrast,
    })

    composer.addEffect(bloomEffect)
    composer.addEffect(hueSat)
    composer.addEffect(bc)

    const onResize = () => {
      const w = gl.domElement.clientWidth
      const h = gl.domElement.clientHeight
      composer.setSize(w, h)
    }
    onResize()
    window.addEventListener('resize', onResize)

    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      composer.render()
    }
    animate()

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
      composer.dispose?.()
      composerRef.current = null
    }
  }, [gl])

  useEffect(() => {
    // Update effect strengths without reconstructing.
    const composer = composerRef.current
    if (!composer) return

    for (const e of composer.effects) {
      // BloomEffect
      if ('intensity' in e) {
        ;(e as any).intensity = bloom
      }
      // HueSaturationEffect
      if ('saturation' in e) {
        ;(e as any).saturation = sat
      }
      // BrightnessContrastEffect
      if ('contrast' in e) {
        ;(e as any).contrast = contrast
      }
    }
  }, [bloom, sat, contrast])

  return null
}
