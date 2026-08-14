import React, { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { useEraTransition } from './TransitionManager'

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

/**
 * Approximate black-body kelvin -> rgb conversion.
 * Returns a THREE.Color usable for light.color.
 */
const kelvinToRGB = (kelvin: number): THREE.Color => {
  // Clamp to a reasonable range for our lighting use.
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100

  let r: number
  let g: number
  let b: number

  // Red
  if (t <= 66) {
    r = 255
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592)
  }

  // Green
  if (t <= 66) {
    g = 99.4708025861 * Math.log(t) - 161.1195681661
  } else {
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  }

  // Blue
  if (t >= 66) {
    b = 255
  } else if (t <= 19) {
    b = 0
  } else {
    b = 138.5177312231 * Math.log(t - 10) - 305.0447927307
  }

  const toByte = (x: number) => Math.max(0, Math.min(255, x))
  const color = new THREE.Color(
    `rgb(${toByte(r)}, ${toByte(g)}, ${toByte(b)})`
  )
  return color
}

export const AtmosphereSystem: React.FC = () => {
  const { scene } = useThree()

  const {
    fogDensity,
    ambientLightColor,
    lightingColorTemp,
    transitionProgress,
    isTransitioning,
  } = useEraTransition()

  const fogColor = useMemo(() => new THREE.Color(ambientLightColor), [ambientLightColor])

  // Update fog density via Three.js scene.fog.
  useEffect(() => {
    const density = Math.max(0.0001, fogDensity)

    const anyScene = scene as THREE.Scene

    if (!(anyScene.fog instanceof THREE.FogExp2)) {
      anyScene.fog = new THREE.FogExp2(fogColor, density)
      return
    }

    const fog = anyScene.fog as THREE.FogExp2
    fog.density = density
    fog.color.copy(fogColor)
  }, [scene, fogDensity, fogColor])

  // Window (daylight) color from color temperature.
  const windowKelvinColor = useMemo(
    () => kelvinToRGB(lightingColorTemp),
    [lightingColorTemp]
  )

  // Smoothly scale intensities based on interpolated values so transitions feel holistic.
  const windowIntensity =
    0.25 +
    (clamp01((lightingColorTemp - 2700) / (6500 - 2700)) * 0.6)

  const fluorescentAccentFactor = clamp01(
    (lightingColorTemp - 5000) / 1500
  )

  // Crisp 2025 should feel clearer -> slightly stronger green "plant" accents.
  const plantAccentFactor = clamp01((0.12 - fogDensity) / 0.1)

  // If we want to avoid jarring jumps at exact era boundaries,
  // gently bias accent intensity during transitions.
  const easedAccentBoost = isTransitioning
    ? 0.7 + 0.3 * transitionProgress
    : 1

  return (
    <>
      {/* Ambient light (interpolated via TransitionManager) */}
      <ambientLight intensity={0.6} color={ambientLightColor} />

      {/* General directional fill (also temperature-tinted via Kelvin->RGB) */}
      <directionalLight
        intensity={0.45}
        color={windowKelvinColor.getHex()}
        position={[10, 10, 10]}
      />

      {/* Window light (two point lights to imply daylight coming through windows) */}
      <pointLight
        intensity={windowIntensity}
        color={windowKelvinColor.getHex()}
        position={[-4, 2.7, 0.1]}
        distance={20}
      />
      <pointLight
        intensity={windowIntensity}
        color={windowKelvinColor.getHex()}
        position={[4, 2.7, 0.1]}
        distance={20}
      />

      {/* 1985 fluorescent / neon ambiance accent lights */}
      <pointLight
        intensity={0.18 * fluorescentAccentFactor * easedAccentBoost}
        color={0xff00ff}
        position={[0, 3.1, 0]}
        distance={12}
      />
      <pointLight
        intensity={0.14 * fluorescentAccentFactor * easedAccentBoost}
        color={0x00ffff}
        position={[0, 3.1, 0]}
        distance={12}
      />
      {/* Disco-ball style specular kicker (white) */}
      <pointLight
        intensity={0.55 * fluorescentAccentFactor * easedAccentBoost}
        color={0xffffff}
        position={[0, 3.05, 0]}
        distance={8}
      />

      {/* 2025 subtle green plant accents (very low intensity) */}
      <pointLight
        intensity={0.08 * plantAccentFactor}
        color={0x66ff66}
        position={[2, 0.5, 4.5]}
        distance={10}
      />
    </>
  )
}
