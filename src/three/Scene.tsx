/**
 * The full 3D scene: lights, base, categories, post-processing, controls and
 * the single SceneDriver. Owns the shared refs that connect the driver to the
 * lights and post-processing effects.
 */
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { BloomEffect, VignetteEffect } from 'postprocessing'
import { SceneDriver } from './SceneDriver'
import { Lights } from './Lights'
import {
  SkySphere,
  Ground,
  Sidewalks,
  Roads,
  SceneFog,
} from './BaseScene'
import { Buildings } from './Buildings'
import { Vehicles } from './Vehicles'
import { Pedestrians } from './Pedestrians'
import { Signs } from './Signs'
import { StreetProps } from './StreetProps'
import { PostProcessing } from './PostProcessing'
import { CameraControls } from './CameraControls'
import { FrameloopController } from './FrameloopController'

interface SceneRefs {
  sun: RefObject<THREE.DirectionalLight | null>
  ambient: RefObject<THREE.HemisphereLight | null>
  bloom: RefObject<BloomEffect | null>
  vignette: RefObject<VignetteEffect | null>
}

export function Scene() {
  // Mutable ref holders created once; passed to children + driver.
  const sunRef = useRef<THREE.DirectionalLight>(null)
  const ambientRef = useRef<THREE.HemisphereLight>(null)
  const bloomRef = useRef<BloomEffect>(null)
  const vignetteRef = useRef<VignetteEffect>(null)

  const sceneRefs: SceneRefs = {
    sun: sunRef,
    ambient: ambientRef,
    bloom: bloomRef,
    vignette: vignetteRef,
  }

  return (
    <>
      <SceneDriver handles={sceneRefs} />
      <FrameloopController />
      <Lights refs={{ sun: sunRef, ambient: ambientRef }} />
      <SceneFog />
      <SkySphere />
      <Ground />
      <Sidewalks />
      <Roads />
      <Buildings />
      <Vehicles />
      <Pedestrians />
      <Signs />
      <StreetProps />
      <PostProcessing
        refs={{ bloom: bloomRef, vignette: vignetteRef }}
      />
      <CameraControls />
    </>
  )
}
