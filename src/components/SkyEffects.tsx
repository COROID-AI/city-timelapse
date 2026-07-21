import { useFrame } from '@react-three/fiber'
import { Era } from '@/App'
import * as THREE from 'three'

function getSkyColor(era: Era) {
  switch (era) {
    case '1945':
      return '#87CEEB' // Sky blue - post-war optimism
    case '1965':
      return '#87CEEB' // Same but with different haze
    case '1985':
      return '#A0B0C0' // Hazy urban sky
    case '2005':
      return '#B0C4DE' // Clear contemporary
    case '2025':
      return '#A0D0F0' // Climate conscious blue
    case '2055':
      return '#E0F0FF' // Futuristic bright
    default:
      return '#87CEEB'
  }
}

function getFogColor(era: Era) {
  switch (era) {
    case '1945':
      return '#D2B48C' // Tan - coal/dust
    case '1965':
      return '#C0C0C0' // Gray
    case '1985':
      return '#A9A9A9' // Darker gray - smog
    case '2005':
      return '#B0C4DE' // Light gray
    case '2025':
      return '#D0E0F0' // Cleaner
    case '2055':
      return '#E0F0FF' // Clean future
    default:
      return '#87CEEB'
  }
}

export function SkyEffects({ era }: { era: Era }) {
  useFrame(() => {
    // Subtle cloud animation
  })

  return (
    <>
      <color attach="background" args={[getSkyColor(era)]} />
      <fog attach="fog" args={[getFogColor(era), 30, 200]} />
      
      {/* Simple particle effects for atmosphere */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={100}
            array={new Float32Array(300).map(() => (Math.random() - 0.5) * 100)}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.5} color="#ffffff" transparent opacity={0.3} />
      </points>
    </>
  )
}