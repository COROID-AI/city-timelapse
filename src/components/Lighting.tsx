import React, { useMemo } from 'react'
import { lerpHex } from '../utils/color'

type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

interface LightingProps {
  eraA: Era
  eraB: Era
  blendT: number
}

export function Lighting({ eraA, eraB, blendT }: LightingProps) {
  const ambientColor = useMemo(() => {
    const ambient: Record<Era, string> = {
      '1945': '#FFF8DC',
      '1965': '#FFE4B5',
      '1985': '#E0FFFF',
      '2005': '#F0F8FF',
      '2025': '#E6E6FA',
      '2055': '#000033',
    }
    return lerpHex(ambient[eraA], ambient[eraB], blendT)
  }, [eraA, eraB, blendT])

  const sunColor = useMemo(() => {
    const sun: Record<Era, string> = {
      '1945': '#FFD700',
      '1965': '#FFA500',
      '1985': '#87CEEB',
      '2005': '#FFFACD',
      '2025': '#F0F8FF',
      '2055': '#00BFFF',
    }
    return lerpHex(sun[eraA], sun[eraB], blendT)
  }, [eraA, eraB, blendT])

  const ambientIntensity = useMemo(() => {
    const ia = eraA === '2055' ? 0.4 : 0.3
    const ib = eraB === '2055' ? 0.4 : 0.3
    return ia + (ib - ia) * blendT
  }, [eraA, eraB, blendT])

  const sunIntensity = useMemo(() => {
    const intensityFor = (era: Era) => {
      if (era === '1945' || era === '1965') return 1.2
      if (era === '1985') return 1.0
      if (era === '2005') return 0.8
      if (era === '2025') return 0.6
      return 0.4
    }
    const ia = intensityFor(eraA)
    const ib = intensityFor(eraB)
    return ia + (ib - ia) * blendT
  }, [eraA, eraB, blendT])

  const groundColor = useMemo(() => {
    const gA = eraA === '1945' ? '#8B4513' : '#333333'
    const gB = eraB === '1945' ? '#8B4513' : '#333333'
    return lerpHex(gA, gB, blendT)
  }, [eraA, eraB, blendT])

  const futureExtra = useMemo(() => {
    const a = eraA === '2055' ? 1 : 0
    const b = eraB === '2055' ? 1 : 0
    return a + (b - a) * blendT
  }, [eraA, eraB, blendT])

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={ambientColor} />

      <directionalLight
        position={[50, 80, 30]}
        intensity={sunIntensity}
        color={sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={100}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />

      <hemisphereLight position={[0, 100, 0]} intensity={0.2} skyColor={sunColor} groundColor={groundColor} />

      {futureExtra > 0.01 && (
        <>
          <directionalLight
            position={[-50, 80, -30]}
            intensity={0.3 * futureExtra}
            color="#4169E1"
          />
          <pointLight position={[0, 100, 0]} intensity={0.3 * futureExtra} color="#00FFFF" distance={200} />
          <pointLight position={[50, 50, 50]} intensity={0.2 * futureExtra} color="#4169E1" distance={100} />
        </>
      )}
    </>
  )
}
