import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import type { TransitionState } from '../../hooks/useEraTransition'

interface AdvertisementManagerProps {
  transition: TransitionState
}

// Vintage signage (1940s-50s)
function VintageSignage() {
  const adText = ['CAFÉ', 'DRUG STORE', 'BARBER', 'NEWS']
  
  return (
    <group>
      {adText.map((text, i) => (
        <mesh key={i} position={[0, 2 - i * 1, 0]}>
          <boxGeometry args={[3, 0.5, 0.2]} />
          <meshStandardMaterial 
            color="#c06020" 
            roughness={0.5}
            emissive="#804010"
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}
      {/* Bulbs around sign */}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh 
          key={i} 
          position={[
            Math.cos((i / 20) * Math.PI * 2) * 1.5,
            2.5,
            Math.sin((i / 20) * Math.PI * 2) * 1.5
          ]}
        >
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial 
            color="#ffff80" 
            emissive="#ffff80"
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
    </group>
  )
}

// Neon signage (1960s-80s)
function NeonSignage() {
  return (
    <group>
      {/* Neon tubes */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[3, 0.2, 0.1]} />
        <meshStandardMaterial 
          color="#ff4080" 
          emissive="#ff4080"
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[2, 0.2, 0.1]} />
        <meshStandardMaterial 
          color="#40ff80" 
          emissive="#40ff80"
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      {/* Neon glow effect */}
      <mesh position={[0, 1.75, 0]} scale={[3.2, 0.6, 0.3]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial 
          color="#ff4080" 
          transparent 
          opacity={0.2}
          blending={2}
        />
      </mesh>
    </group>
  )
}

// LED billboard (2000s)
function LEDSignage() {
  const ads = ['BRAND', 'TECH', 'FOOD', 'SHOP']
  
  return (
    <group>
      {/* Billboard structure */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[4, 2, 0.2]} />
        <meshStandardMaterial color="#222222" roughness={0.6} />
      </mesh>
      {/* LED panels */}
      {ads.map((_, i) => (
        <mesh key={i} position={[0, 1 - i * 0.7 + 0.7, 0.11]}>
          <boxGeometry args={[3.5, 0.5, 0.02]} />
          <meshStandardMaterial 
            color="#4080ff" 
            emissive="#4080ff"
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
    </group>
  )
}

// Holographic display (2050s)
function HolographicSignage() {
  return (
    <group>
      {/* Hologram projector */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.2, 0.3, 0.2, 16]} />
        <meshStandardMaterial 
          color="#40ffff" 
          roughness={0.1}
          metalness={0.9}
          emissive="#40ffff"
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* Holographic display */}
      <group position={[0, 2, 0]}>
        {/* 3D holographic panels */}
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh 
            key={i} 
            position={[
              Math.cos((i / 6) * Math.PI * 2) * 0.5,
              0.5,
              Math.sin((i / 6) * Math.PI * 2) * 0.5
            ]}
            rotation={[0, (i / 6) * Math.PI * 2, 0]}
          >
            <planeGeometry args={[1, 0.5]} />
            <meshBasicMaterial 
              color="#40ffff" 
              transparent 
              opacity={0.4}
              blending={2}
            />
          </mesh>
        ))}
      </group>
      
      {/* Particle effect */}
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh 
          key={i} 
          position={[
            (Math.random() - 0.5) * 2,
            0.5 + Math.random() * 2,
            (Math.random() - 0.5) * 2
          ]}
        >
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial 
            color="#40ffff" 
            transparent 
            opacity={0.6}
          />
        </mesh>
      ))}
    </group>
  )
}

function Advertisement({ 
  position, 
  era 
}: { 
  position: [number, number, number]
  era: string
}) {
  const meshRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (meshRef.current) {
      // Rotation for holograms, flicker for neon
      if (era === 'holographic') {
        meshRef.current.rotation.y = state.clock.elapsedTime * 0.5
      } else if (era === 'neon') {
        meshRef.current.children[0].scale.setScalar(
          1 + Math.sin(state.clock.elapsedTime * 10) * 0.02
        )
      }
    }
  })

  const getAd = () => {
    switch (era) {
      case 'vintage-signage':
        return <VintageSignage />
      case 'neon':
        return <NeonSignage />
      case 'led':
        return <LEDSignage />
      case 'holographic':
        return <HolographicSignage />
      default:
        return <LEDSignage />
    }
  }

  return (
    <group ref={meshRef} position={position}>
      {getAd()}
    </group>
  )
}

export function AdvertisementManager({ transition }: AdvertisementManagerProps) {
  const advertisements = useMemo(() => {
    // Place advertisements on buildings
    const positions: [number, number, number][] = []
    for (let i = 0; i < 8; i++) {
      positions.push([
        -60 + i * 20,
        15,
        -45,
      ])
      positions.push([
        -60 + i * 20,
        15,
        45,
      ])
    }

    return positions.map((pos) => ({ position: pos }))
  }, [])

  return (
    <>
      {advertisements.map((ad, i) => (
        <Advertisement
          key={i}
          position={ad.position}
          era={transition.advertisement}
        />
      ))}
    </>
  )
}