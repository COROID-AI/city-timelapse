import React, { useMemo } from 'react'
import { Backdrop } from '@react-three/drei'
import { Era } from '../contexts/EraContext'
import { Color } from 'three'

interface SkyProps {
  currentEra: Era
  transitionProgress: number
}

const eraSkyColors: Record<Era, string> = {
  '1945': '#87CEEB',
  '1965': '#FFD700',
  '1985': '#FFA500',
  '2005': '#4169E1',
  '2025': '#1E90FF',
  '2055': '#9370DB',
}

export function Sky({ currentEra, transitionProgress }: SkyProps) {
  const skyColor = useMemo(() => {
    return new Color(eraSkyColors[currentEra])
  }, [currentEra])

  return (
    <>
      <color attach="background" args={[skyColor]} />
      <fog attach="fog" args={[skyColor.getHex(), 20, 50]} />
      <ambientLight intensity={0.4} />
    </>
  )
}