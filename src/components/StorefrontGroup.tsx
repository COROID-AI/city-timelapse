import React, { useMemo } from 'react'
import { useTransition, a } from '@react-spring/three'
import { Era } from '../context/UIContext'
import { eraConfigs } from '../data/eras'
import * as THREE from 'three'

interface StorefrontProps {
  position: [number, number, number]
  era: Era
  prefersReducedMotion: boolean
}

const Storefront: React.FC<StorefrontProps> = ({ position, era, prefersReducedMotion }) => {
  const config = eraConfigs[era]

  const { opacity, emissiveIntensity } = useTransition(() => ({
    opacity: prefersReducedMotion ? 1 : [0.8, 1, 0.8],
    emissiveIntensity: era === 2055 || era === 1985 ? 0.5 : 0,
    from: { opacity: 1, emissiveIntensity: 0 },
    config: { duration: 2500 },
    loop: !prefersReducedMotion && (era === 2055 || era === 1985),
  }))

  const signageTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 64
    const ctx = canvas.getContext('2d')!

    // Style based on era
    const styles = {
      1945: { bg: '#8B4513', fg: '#F5DEB3', text: 'GENERAL STORE' },
      1965: { bg: '#4A90E2', fg: '#FFFFFF', text: 'DINER' },
      1985: { bg: '#FF2D95', fg: '#FFFFFF', text: 'ARCADE' },
      2005: { bg: '#3498DB', fg: '#FFFFFF', text: 'MALL' },
      2025: { bg: '#27AE60', fg: '#FFFFFF', text: 'ECO SHOP' },
      2055: { bg: '#9B59B6', fg: '#00FFFF', text: 'NEURAL' },
    }

    const style = styles[era as 1945]

    ctx.fillStyle = style.bg
    ctx.fillRect(0, 0, 128, 64)
    ctx.fillStyle = style.fg
    ctx.font = 'bold 16px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(style.text, 64, 35)

    return new THREE.CanvasTexture(canvas)
  }, [era])

  const windowTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!

    const bg = era === 2055 ? '#00FFFF' : era === 1985 ? '#FF2D95' : '#ADD8E6'
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, 64, 64)

    // Draw window patterns
    for (let i = 10; i < 54; i += 12) {
      ctx.fillStyle = '#FFFFFF44'
      ctx.fillRect(i, 10, 8, 8)
      ctx.fillRect(i, 10, 8, 8)
    }

    return new THREE.CanvasTexture(canvas)
  }, [era])

  return (
    <a.group position={position}>
      {/* Building base */}
      <mesh position={[0, era === 2055 ? 2.5 : 2, 0]} castShadow>
        <boxGeometry args={[2.5, era === 2055 ? 5 : 4, 0.5]} />
        <meshStandardMaterial color={config.buildingMaterial} />
      </mesh>

      {/* Signage */}
      <a.mesh position={[0, 1.5, 0.3]}>
        <planeGeometry args={[2, 0.8]} />
        <a.meshStandardMaterial
          map={signageTexture}
          transparent
          opacity={opacity}
            emissiveIntensity={emissiveIntensity}
          emissive={era === 2055 || era === 1985 ? '#FFFFFF' : '#000000'}
        />
      </a.mesh>

      {/* Windows */}
      <mesh position={[0, 0, 0.3]}>
        <planeGeometry args={[2, 2]} />
        <meshStandardMaterial map={windowTexture} transparent />
      </mesh>
    </a.group>
  )
}

interface StorefrontGroupProps {
  era: Era
  prefersReducedMotion: boolean
}

export const StorefrontGroup: React.FC<StorefrontGroupProps> = ({ era, prefersReducedMotion }) => {
  const storefronts = useMemo(() => {
    const positions: [number, number, number][] = []
    for (let x = -6; x <= 6; x += 3) {
      positions.push([x, 0, 8])
    }
    return positions
  }, [])

  return (
    <group>
      {storefronts.map((pos, i) => (
        <Storefront
          key={`${era}-storefront-${i}`}
          position={pos}
          era={era}
          prefersReducedMotion={prefersReducedMotion}
        />
      ))}
    </group>
  )
}