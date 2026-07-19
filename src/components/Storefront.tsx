import React, { useRef, useEffect, useMemo } from 'react'
import { gsap } from 'gsap'

interface StorefrontProps {
  position: [number, number, number]
  era: number
  index: number
}

type StorefrontType = 'shop' | 'cafe' | 'bank' | 'tech' | 'restaurant' | 'greenhouse'

interface StorefrontStyle {
  type: StorefrontType
  awning: boolean
}

export const Storefront: React.FC<StorefrontProps> = ({ position, era, index }) => {
  const groupRef = useRef<any>(null!)
  const storefrontStyle = useMemo(() => getStorefrontStyle(era, index), [era, index])

  // Animate on era change
  useEffect(() => {
    if (groupRef.current) {
      gsap.to(groupRef.current.children[0].scale, {
        x: storefrontStyle.awning ? 1.1 : 1,
        y: 1,
        z: 1,
        duration: 1.5,
        ease: 'power2.inOut',
      })
    }
  }, [era, storefrontStyle])

  return (
    <group ref={groupRef} position={position}>
      {/* Storefront structure */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3, 4, 0.5]} />
        <meshStandardMaterial color="#2F4F4F" />
      </mesh>
      
      {/* Window display */}
      <mesh position={[0, 0, 0.3]}>
        <planeGeometry args={[2.5, 3]} />
        <meshStandardMaterial color={getWindowDisplay(era, storefrontStyle.type)} />
      </mesh>
      
      {/* Sign */}
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[3, 0.5, 0.2]} />
        <meshStandardMaterial 
          color={getSignColor(storefrontStyle.type)} 
          emissive={getSignColor(storefrontStyle.type)}
          emissiveIntensity={era >= 2025 ? 0.5 : 0} 
        />
      </mesh>
      
      {/* Awning */}
      {storefrontStyle.awning && (
        <mesh position={[0, 0.5, 1]}>
          <planeGeometry args={[2.8, 1]} />
          <meshStandardMaterial color="#FF69B4" transparent opacity={0.8} />
        </mesh>
      )}
      
      {/* Futuristic hologram display */}
      {era >= 2055 && (
        <mesh position={[0, -0.5, 1]}>
          <planeGeometry args={[2, 2]} />
          <meshBasicMaterial color="#00FFFF" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  )
}

function getStorefrontStyle(era: number, index: number): StorefrontStyle {
  const types: StorefrontType[] = era <= 1965
    ? ['shop', 'cafe', 'shop']
    : era <= 1985
    ? ['bank', 'shop', 'cafe']
    : era <= 2005
    ? ['tech', 'restaurant', 'shop']
    : era <= 2025
    ? ['greenhouse', 'tech', 'restaurant']
    : ['tech', 'greenhouse', 'tech']

  return {
    type: types[index % types.length],
    awning: era >= 1965 && era <= 2005,
  }
}

function getSignColor(type: StorefrontType): string {
  const colors: Record<StorefrontType, string> = {
    shop: '#FF0000',
    cafe: '#8B4513',
    bank: '#FFD700',
    tech: '#00BFFF',
    restaurant: '#32CD32',
    greenhouse: '#9ACD32',
  }
  return colors[type] ?? '#FFFFFF'
}

function getWindowDisplay(era: number, type: StorefrontType): string {
  if (era >= 2055) {
    return type === 'tech' ? '#00FFFF' : '#9932CC'
  }
  if (era >= 2025) {
    return type === 'greenhouse' ? '#98FB98' : '#FFFFFF'
  }
  if (era >= 2005) {
    return '#FFFFFF'
  }
  return '#F5DEB3'
}