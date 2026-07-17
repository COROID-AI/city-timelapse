import type { Era } from '../types/era'

interface StorefrontProps {
  position: [number, number, number]
  era: Era
}

export function Storefront({ position, era }: StorefrontProps) {
  // Storefront details based on era
  const signStyle = era === '1945' || era === '1965' ? 'neon' : era === '2005' || era === '2025' ? 'digital' : 'hologram'
  const awningColor = ['#00E5FF', '#FF00E5', '#7C4DFF', '#18FFFF'][Math.floor(Math.random() * 4)]

  return (
    <group position={position}>
      {/* Shop front */}
      <mesh position={[0, 2, 0.1]}>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* Sign - using shopName as the visible identifier */}
      {signStyle === 'neon' && (
        <group position={[0, 3.2, 0.1]}>
          <mesh>
            <boxGeometry args={[3, 0.5, 0.1]} />
            <meshStandardMaterial
              color={awningColor}
              emissive={awningColor}
              emissiveIntensity={0.5}
            />
          </mesh>
        </group>
      )}

      {signStyle === 'digital' && (
        <group position={[0, 3.2, 0.1]}>
          <mesh>
            <boxGeometry args={[3, 0.5, 0.1]} />
            <meshStandardMaterial
              color="#fff"
              emissive="#00E5FF"
              emissiveIntensity={0.7}
            />
          </mesh>
        </group>
      )}

      {signStyle === 'hologram' && (
        <group position={[0, 3.2, 0]}>
          <mesh>
            <cylinderGeometry args={[0, 1.5, 2, 8]} />
            <meshStandardMaterial
              color={awningColor}
              emissive={awningColor}
              emissiveIntensity={0.8}
              transparent
              opacity={0.6}
            />
          </mesh>
          <mesh position={[0, 1, 0]}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial
              color={awningColor}
              emissive={awningColor}
              emissiveIntensity={1}
            />
          </mesh>
        </group>
      )}

      {/* Awning */}
      <mesh position={[0, 1.4, 1.1]}>
        <planeGeometry args={[4.2, 1.5]} />
        <meshStandardMaterial
          color={awningColor}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Window display */}
      <mesh position={[0, 1.8, 0.11]}>
        <planeGeometry args={[3.5, 2.5]} />
        <meshStandardMaterial
          color="#888"
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  )
}