import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Era } from '../App'

interface StorefrontsProps {
  era: Era
}

export const Storefronts: React.FC<StorefrontsProps> = ({ era }) => {
  const storefronts = useMemo(() => {
    const items: JSX.Element[] = []

    for (let i = 0; i < 6; i++) {
      const x = -80 + i * 18
      const z = -5

      items.push(
        <Storefront
          key={i}
          position={[x, 0, z]}
          era={era}
          type={['shop', 'cafe', 'bank', 'dept', 'fashion', 'tech'][i]}
        />
      )
    }

    return items
  }, [era])

  return <group>{storefronts}</group>
}

interface StorefrontProps {
  position: [number, number, number]
  era: Era
  type: string
}

const Storefront: React.FC<StorefrontProps> = ({ position, era, type }) => {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(Date.now() * 0.001) * 0.01
    }
  })

  const style = useMemo(() => {
    return {
      1945: {
        facade: '#8b7355',
        sign: '#4169e1',
        awning: '#8b4513',
        neon: false,
        holo: false,
        width: 8,
        height: 6,
      },
      1965: {
        facade: '#a9a9a9',
        sign: '#4169e1',
        awning: '#ffffff',
        neon: false,
        holo: false,
        width: 8,
        height: 7,
      },
      1985: {
        facade: '#202020',
        sign: '#ff69b4',
        awning: '#ff00ff',
        neon: true,
        holo: false,
        width: 8,
        height: 8,
      },
      2005: {
        facade: '#4682b4',
        sign: '#32cd32',
        awning: '#ffffff',
        neon: false,
        holo: false,
        width: 8,
        height: 9,
      },
      2025: {
        facade: '#5f9ea0',
        sign: '#00ffff',
        awning: '#ffffff',
        neon: false,
        holo: true,
        width: 8,
        height: 10,
      },
      2055: {
        facade: '#0a0a2a',
        sign: '#00ffff',
        awning: '#00ffff',
        neon: true,
        holo: true,
        width: 8,
        height: 12,
      },
    }[era]
  }, [era])

  const signText = useMemo(() => {
    const signs: Record<string, string> = {
      shop: 'GENERAL STORE',
      cafe: 'CAFE',
      bank: 'BANK',
      dept: 'DEPARTMENT',
      fashion: 'FASHION',
      tech: 'TECH',
    }
    return signs[type] || 'STORE'
  }, [type])

  return (
    <group ref={groupRef} position={position}>
      {/* Main facade */}
      <mesh position={[0, style.height / 2, 0.1]}>
        <boxGeometry args={[style.width, style.height, 0.2]} />
        <meshStandardMaterial color={style.facade} />
      </mesh>

      {/* Window display */}
      <mesh position={[-style.width / 4, 3, 0.2]}>
        <boxGeometry args={[3, 2, 0.1]} />
        <meshStandardMaterial
          color="#87ceeb"
          emissive={era === 2055 ? '#00ffff' : '#000000'}
          emissiveIntensity={era === 2055 ? 0.5 : era === 1985 ? 0.3 : 0}
        />
      </mesh>

      <mesh position={[style.width / 4, 3, 0.2]}>
        <boxGeometry args={[3, 2, 0.1]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive={era === 2055 ? '#00ffff' : '#000000'}
          emissiveIntensity={era === 2055 ? 0.5 : era === 1985 ? 0.3 : 0}
        />
      </mesh>

      {/* Awning */}
      <mesh position={[0, style.height - 2, 0]}>
        <boxGeometry args={[style.width, 0.5, 0.5]} />
        <meshStandardMaterial
          color={style.awning}
          emissive={style.neon ? style.awning : '#000000'}
          emissiveIntensity={style.neon ? 0.5 : 0}
        />
      </mesh>

      {/* Sign */}
      <mesh position={[0, style.height - 1, 0.2]}>
        <boxGeometry args={[6, 1.5, 0.1]} />
        <meshStandardMaterial
          color={style.sign}
          emissive={style.neon || style.holo ? style.sign : '#000000'}
          emissiveIntensity={style.holo ? 0.8 : style.neon ? 0.5 : 0}
        />
      </mesh>

      {/* Door */}
      <mesh position={[0, 1.5, 0.3]}>
        <boxGeometry args={[2, 3, 0.1]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  )
}