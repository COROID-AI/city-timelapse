import { useEra, Era } from '../contexts/EraContext'
import { useMemo } from 'react'

interface StorefrontProps {
  position: [number, number, number]
  era: Era
}

function Storefront({ position, era }: StorefrontProps) {
  const getStorefrontStyle = () => {
    switch (era) {
      case '1945':
        return {
          color: '#8B4513',
          signColor: '#4a2a1a',
          signText: 'GENERAL STORE',
          windowStyle: 'small',
        }
      case '1965':
        return {
          color: '#C0C0C0',
          signColor: '#4682B4',
          signText: 'MODERN MART',
          windowStyle: 'large',
        }
      case '1985':
        return {
          color: '#2F4F4F',
          signColor: '#FFD700',
          signText: 'MALL',
          windowStyle: 'striped',
        }
      case '2005':
        return {
          color: '#DCDCDC',
          signColor: '#FF4500',
          signText: 'SUPERMARKET',
          windowStyle: 'floor-to-ceiling',
        }
      case '2025':
        return {
          color: '#F0F8FF',
          signColor: '#1E90FF',
          signText: 'ECO SHOP',
          windowStyle: 'smart',
        }
      case '2055':
        return {
          color: '#C0DFFF',
          signColor: '#FF69B4',
          signText: 'NEO MARKET',
          windowStyle: 'holographic',
        }
    }
  }

  const style = getStorefrontStyle()

  return (
    <group position={position}>
      {/* Shop front structure */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[20, 20, 2]} />
        <meshStandardMaterial color={style.color} />
      </mesh>

      {/* Signage */}
      <mesh position={[0, 6, 1.1]} castShadow>
        <boxGeometry args={[15, 3, 0.2]} />
        <meshStandardMaterial
          color={style.signColor}
          emissive={style.signColor}
          emissiveIntensity={era === '2055' ? 1 : era === '2025' ? 0.5 : 0.2}
        />
      </mesh>

      {/* Windows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[i * 4 - 8, 2, 1.1]} castShadow receiveShadow>
          <boxGeometry args={[3, 3, 0.1]} />
          <meshStandardMaterial
            color="#87CEFA"
            opacity={style.windowStyle === 'holographic' ? 0.5 : 0.8}
            transparent
          />
        </mesh>
      ))}

      {/* Display items in window */}
      {style.windowStyle !== 'holographic' && (
        <mesh position={[0, -3, 1.2]} castShadow>
          <boxGeometry args={[18, 2, 0.1]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
      )}

      {/* Holographic display (2055) */}
      {style.windowStyle === 'holographic' && (
        <group position={[0, -3, 1.2]}>
          <mesh>
            <planeGeometry args={[18, 2]} />
            <meshBasicMaterial color="#00FFFF" transparent opacity={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.1]}>
            <ringGeometry args={[9, 9.5, 16]} />
            <meshBasicMaterial color="#FF69B4" transparent opacity={0.5} />
          </mesh>
        </group>
      )}
    </group>
  )
}

export function Storefronts() {
  const { currentEra } = useEra()

  const storefronts = useMemo(() => [
    { position: [-30, 0, 0] },
    { position: [0, 0, -50] },
    { position: [30, 0, 0] },
  ], [currentEra])

  return (
    <group>
      {storefronts.map((storefront, index) => (
        <Storefront
          key={index}
          position={[storefront.position[0], 10, storefront.position[2]]}
          era={currentEra}
        />
      ))}
    </group>
  )
}