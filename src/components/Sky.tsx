import React, { useMemo } from 'react'
import { lerpHex } from '../utils/color'

type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

interface SkyProps {
  eraA: Era
  eraB: Era
  blendT: number
}

export function Sky({ eraA, eraB, blendT }: SkyProps) {
  const skyColor = useMemo(() => {
    const sky: Record<Era, string> = {
      '1945': '#87CEEB',
      '1965': '#4682B4',
      '1985': '#1E90FF',
      '2005': '#6495ED',
      '2025': '#87CEEB',
      '2055': '#000033',
    }
    return lerpHex(sky[eraA], sky[eraB], blendT)
  }, [eraA, eraB, blendT])

  const fogColor = useMemo(() => {
    const fog: Record<Era, string> = {
      '1945': '#F5DEB3',
      '1965': '#E0FFFF',
      '1985': '#000080',
      '2005': '#2F4F4F',
      '2025': '#1E90FF',
      '2055': '#000011',
    }
    return lerpHex(fog[eraA], fog[eraB], blendT)
  }, [eraA, eraB, blendT])

  const starsIntensity = useMemo(() => {
    const iA = eraA === '2055' ? 1 : 0
    const iB = eraB === '2055' ? 1 : 0
    return iA + (iB - iA) * blendT
  }, [eraA, eraB, blendT])

  return (
    <>
      <color attach="background" args={[skyColor]} />
      <fog attach="fog" args={[fogColor, 50, 200]} />
      {starsIntensity > 0.02 && <Stars count={Math.floor(1200 * starsIntensity + 20)} />}
    </>
  )
}

function Stars({ count }: { count: number }) {
  const positions = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200
      positions[i * 3 + 1] = Math.random() * 100 + 20
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200
    }
    return positions
  }, [count])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.5} sizeAttenuation={true} color="#00FFFF" opacity={0.85} transparent />
    </points>
  )
}
