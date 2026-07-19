import { useMemo } from 'react'
import { useEraConfig } from '../../hooks/useEraConfig'
import { EraType } from '../../types/era'

interface StorefrontGroupProps {
  era: EraType
  targetEra?: EraType | null
  transitionProgress?: number
  isTransition?: boolean
}

const STOREFRONT_POSITIONS = [
  [-100, 0, -32], [-60, 0, -32], [-20, 0, -32], [20, 0, -32],
]

export function StorefrontGroup({ era, transitionProgress = 1, isTransition = false }: StorefrontGroupProps) {
  const { config } = useEraConfig(era)

  return (
    <group>
      {STOREFRONT_POSITIONS.map((pos, i) => (
        <Storefront
          key={`storefront-${i}-${isTransition ? 'trans' : 'main'}`}
          position={pos as [number, number, number]}
          type={config.storefrontStyle}
          transitionProgress={transitionProgress}
        />
      ))}
    </group>
  )
}

interface StorefrontProps {
  position: [number, number, number]
  type: string
  transitionProgress: number
}

function Storefront({ position, type, transitionProgress }: StorefrontProps) {
  const signage = useMemo(() => {
    switch (type) {
      case 'traditional':
        return {
          text: 'GENERAL STORE • DRUGS • POST',
          colors: ['#8b4513', '#654321', '#d4af37'],
          material: 'wood',
        }
      case 'neon':
        return {
          text: 'VIDEO • MUSIC • ELECTRONICS',
          colors: ['#ff00ff', '#00ffff', '#ffff00'],
          material: 'metal',
        }
      case 'digital':
        return {
          text: 'CAFE • WIFI • TECH',
          colors: ['#3498db', '#2ecc71', '#e74c3c'],
          material: 'glass',
        }
      case 'led':
        return {
          text: 'ECO CAFE • CO-WORK • DELIVERY',
          colors: ['#00bcd4', '#2196f3', '#009688'],
          material: 'smart',
        }
      case 'smart':
        return {
          text: 'HOLOGRAM • AR • QUANTUM',
          colors: ['#8a2be2', '#00ffff', '#ff00ff'],
          material: 'hologram',
        }
      case 'hologram':
        return {
          text: 'NEURAL • ORGANIC • PURE ENERGY',
          colors: ['#8a2be2', '#00ffff', '#ff00ff'],
          material: 'hologram',
        }
      default:
        return {
          text: 'STORE',
          colors: ['#333'],
          material: 'basic',
        }
    }
  }, [type])

  return (
    <group position={position} scale={[1, transitionProgress, 1]}>
      {/* Storefront window/display */}
      <mesh position={[0, 3, -15.1]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial 
          color={type === 'smart' || type === 'hologram' ? '#1a1a2e' : '#fff'}
          opacity={type === 'hologram' ? 0.5 : 1}
          transparent={type === 'hologram'}
        />
      </mesh>
      
      {/* Signage */}
      <mesh position={[0, 6, -15]}>
        <planeGeometry args={[12, 2]} />
        <meshBasicMaterial 
          color={signage.colors[0]}
          toneMapped={false}
        />
      </mesh>
      
      {/* Era-specific signage details */}
      {type === 'neon' && (
        <NeonSign position={[0, 6, -14.9]} colors={signage.colors} />
      )}
      
      {type === 'hologram' && (
        <HologramSign position={[0, 6, -14.9]} colors={signage.colors} />
      )}
      
      {type === 'traditional' && (
        <TraditionalSign position={[0, 5.5, -14.9]} />
      )}
      
      {/* Display items in window */}
      <WindowDisplay type={type} />
    </group>
  )
}

function NeonSign({ position, colors }: { position: [number, number, number], colors: string[] }) {
  return (
    <group position={position}>
      {colors.map((color, i) => (
        <mesh key={`neon-${i}`} position={[0, -0.4 + i * 0.3, 0]}>
          <boxGeometry args={[8, 0.1, 0.1]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function HologramSign({ position, colors }: { position: [number, number, number], colors: string[] }) {
  return (
    <group position={position}>
      {colors.map((color, i) => (
        <mesh key={`holo-${i}`} position={[0, -0.3 + i * 0.2, 0]}>
          <planeGeometry args={[6, 0.2]} />
          <meshBasicMaterial 
            color={color} 
            opacity={0.6} 
            transparent
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* Animated particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh key={`particle-${i}`} position={[
          (Math.random() - 0.5) * 8,
          -0.5 + Math.random() * 0.5,
          1 + Math.random() * 2
        ]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color={colors[i % colors.length]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function TraditionalSign({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[8, 1, 0.2]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>
      <mesh position={[0, 0.2, 0.15]}>
        <boxGeometry args={[6, 0.5, 0.05]} />
        <meshStandardMaterial color="#d4af37" />
      </mesh>
    </group>
  )
}

function WindowDisplay({ type }: { type: string }) {
  const items = useMemo(() => {
    const itemCount = type === 'hologram' ? 6 : type === 'smart' ? 4 : 3
    return Array.from({ length: itemCount }).map((_, i) => ({
      position: [
        -4 + i * 2.5,
        1 - Math.random() * 2,
        -14.95
      ] as [number, number, number],
      color: type === 'hologram' 
        ? ['#8a2be2', '#00ffff', '#ff00ff', '#ffff00'][Math.floor(Math.random() * 4)]
        : type === 'neon'
        ? ['#ff00ff', '#00ffff', '#ffff00', '#ff69b4'][Math.floor(Math.random() * 4)]
        : ['#fff', '#ff69b4', '#00ff00', '#ffff00'][Math.floor(Math.random() * 4)],
    }))
  }, [type])

  return (
    <group>
      {items.map((item, i) => (
        <mesh key={`display-${i}`} position={item.position}>
          <boxGeometry args={[1, 1, 0.05]} />
          <meshStandardMaterial 
            color={item.color}
          />
        </mesh>
      ))}
    </group>
  )
}