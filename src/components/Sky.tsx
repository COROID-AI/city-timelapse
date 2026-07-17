import { useMemo } from 'react'
import type { Era } from '../types/era'

interface SkyProps {
  era: Era
}

export function Sky({ era }: SkyProps) {

  // Era-specific sky colors
  const skyColors = useMemo(() => {
    switch (era) {
      case '1945':
        return {
          top: '#87CEEB',
          middle: '#B3E5FC',
          bottom: '#E3F2FD',
        }
      case '1965':
        return {
          top: '#4FC3F7',
          middle: '#81D4FA',
          bottom: '#B3E5FC',
        }
      case '1985':
        return {
          top: '#3949AB',
          middle: '#5C6BC0',
          bottom: '#9FA8DA',
        }
      case '2005':
        return {
          top: '#29B6F6',
          middle: '#4FC3F7',
          bottom: '#81D4FA',
        }
      case '2025':
        return {
          top: '#2196F3',
          middle: '#4DD0E1',
          bottom: '#80DEEA',
        }
      case '2055':
        return {
          top: '#283593',
          middle: '#3949AB',
          bottom: '#5C6BC0',
        }
      default:
        return {
          top: '#87CEEB',
          middle: '#B3E5FC',
          bottom: '#E3F2FD',
        }
    }
  }, [era])

  return (
    <>
      {/* Sky gradient using large spheres */}
      <mesh position={[0, -50, 0]}>
        <sphereGeometry args={[200, 32, 32]} />
        <meshBasicMaterial
          side={2} // BackSide
          color={skyColors.top}
        />
      </mesh>

      {/* Sun/Moon based on era */}
      {era !== '2055' ? (
        <mesh position={[50, 40, -50]}>
          <circleGeometry args={[8, 32]} />
          <meshBasicMaterial
            color={era === '1985' ? '#FFD54F' : '#FFEB3B'}
            transparent
            opacity={era === '1985' ? 0.8 : 1}
          />
        </mesh>
      ) : (
        // Futuristic sky object
        <mesh position={[50, 60, -80]}>
          <sphereGeometry args={[12, 32, 32]} />
          <meshStandardMaterial
            color="#00E5FF"
            emissive="#00E5FF"
            emissiveIntensity={0.5}
          />
        </mesh>
      )}
    </>
  )
}