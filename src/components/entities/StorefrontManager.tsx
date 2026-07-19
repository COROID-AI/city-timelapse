import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import type { TransitionState } from '../../hooks/useEraTransition'

interface StorefrontManagerProps {
  transition: TransitionState
}

// Mom-and-pop shop (1940s)
function MomAndPopShop({ color = '#c08060' }: { color?: string }) {
  return (
    <group>
      {/* Shop front */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[5, 4, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {/* Display windows */}
      {[-1.5, 0, 1.5].map((x, i) => (
        <mesh key={i} position={[x, 1.5, 0.26]}>
          <boxGeometry args={[1, 1.5, 0.1]} />
          <meshStandardMaterial 
            color="#a0c0ff" 
            transparent 
            opacity={0.3}
          />
        </mesh>
      ))}
      {/* Signage */}
      <mesh position={[0, 3.2, 0]}>
        <boxGeometry args={[3, 0.5, 0.1]} />
        <meshStandardMaterial 
          color="#804020" 
          emissive="#402000"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  )
}

// Mall storefront (1970s-2000s)
function MallStorefront({ color = '#8080ff' }: { color?: string }) {
  return (
    <group>
      {/* Large store front */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[8, 4, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Multiple display windows */}
      {[-2.5, -1.2, 0, 1.2, 2.5].map((x, i) => (
        <mesh key={i} position={[x, 1.5, 0.16]}>
          <boxGeometry args={[1.5, 1.5, 0.1]} />
          <meshStandardMaterial 
            color="#ffffff" 
            transparent 
            opacity={0.2}
          />
        </mesh>
      ))}
      {/* Glass doors */}
      <mesh position={[0, 0.8, 0.16]}>
        <boxGeometry args={[2, 1.6, 0.05]} />
        <meshStandardMaterial 
          color="#a0c0ff" 
          transparent 
          opacity={0.4}
          transmission={0.8}
        />
      </mesh>
      {/* Modern signage */}
      <mesh position={[0, 3.2, 0]}>
        <boxGeometry args={[4, 0.6, 0.05]} />
        <meshStandardMaterial 
          color="#ffffff" 
          emissive="#2080ff"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  )
}

// Automated retail (2020s)
function AutomatedStorefront({ color = '#40c080' }: { color?: string }) {
  return (
    <group>
      {/* Futuristic store front */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[6, 3, 0.2]} />
        <meshStandardMaterial 
          color={color} 
          roughness={0.2} 
          metalness={0.8}
        />
      </mesh>
      {/* Touch screen interfaces */}
      {[-2, -1, 0, 1, 2].map((x, i) => (
        <mesh key={i} position={[x, 1, 0.11]}>
          <boxGeometry args={[0.8, 0.5, 0.02]} />
          <meshStandardMaterial 
            color="#40ffff" 
            emissive="#40ffff"
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
      {/* Automated pickup door */}
      <mesh position={[0, 0.5, 0.11]}>
        <boxGeometry args={[2, 0.8, 0.05]} />
        <meshStandardMaterial 
          color="#80ff80" 
          emissive="#40ff40"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  )
}

function Storefront({ 
  position, 
  era, 
  color 
}: { 
  position: [number, number, number]
  era: string
  color: string
}) {
  return (
    <group position={position}>
      {era === 'mom-and-pop' && <MomAndPopShop color={color} />}
      {(era === 'mall' || era === 'automated') && era !== 'mom-and-pop' && (
        era === 'automated' ? <AutomatedStorefront color={color} /> : <MallStorefront color={color} />
      )}
      {era === 'mom-and-pop' && <MomAndPopShop color={color} />}
    </group>
  )
}

export function StorefrontManager({ transition }: StorefrontManagerProps) {
  const storefronts = useMemo(() => {
    const colors = {
      vintage: ['#c08060', '#a06040', '#804020', '#c0a060'],
      modern: ['#8080ff', '#60a0ff', '#80a0ff', '#6080ff'],
      futuristic: ['#40c080', '#40a0ff', '#a040ff', '#40ffa0'],
    }

    const eraColors = 
      transition.storefront === 'mom-and-pop' 
        ? colors.vintage 
        : transition.storefront === 'automated' 
        ? colors.futuristic 
        : colors.modern

    // Place storefronts along the street
    const positions: [number, number, number][] = []
    for (let i = 0; i < 10; i++) {
      positions.push([
        i % 2 === 0 ? -50 + i * 10 : i * 10 - 40,
        0,
        -13.5,
      ])
      positions.push([
        i % 2 === 0 ? -50 + i * 10 : i * 10 - 40,
        0,
        13.5,
      ])
    }

    return positions.map((pos, i) => ({
      position: pos,
      color: eraColors[i % eraColors.length],
    }))
  }, [transition.storefront])

  return (
    <>
      {storefronts.map((storefront, i) => (
        <Storefront
          key={i}
          position={storefront.position}
          era={transition.storefront}
          color={storefront.color}
        />
      ))}
    </>
  )
}