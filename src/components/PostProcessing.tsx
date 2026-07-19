import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { ERA_CONFIGS } from '../types/era'
import type { Era } from '../types/era'
import * as THREE from 'three'

interface PostProcessingProps {
  era: Era
}

export function PostProcessing({ era }: PostProcessingProps) {
  const { gl, scene } = useThree()

  // Simple post-processing effect - we'll apply bloom-like effects through emissive materials
  // and add color grading via scene background
  useEffect(() => {
    // Configure renderer for better quality
    gl.setClearColor(new THREE.Color(0.1, 0.1, 0.1))
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.outputColorSpace = THREE.SRGBColorSpace
  }, [gl])

  return null
}