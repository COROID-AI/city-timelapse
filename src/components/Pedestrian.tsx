import React, { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { EraStyles } from '../lib/eraStyles'

interface PedestrianProps {
  position: [number, number, number]
  rotation: [number, number, number]
  eraStyles: EraStyles
}

export function Pedestrian({ position, rotation, eraStyles }: PedestrianProps) {
  const colors = useMemo(() => ({
    skin: '#FDBCB4',
    clothing: eraStyles.pedestrianColors[Math.floor(Math.random() * eraStyles.pedestrianColors.length)]
  }), [eraStyles])

  const bodyStyle = useMemo(() => {
    switch (eraStyles.architecturalStyle) {
      case 'traditional':
        return (
          <group>
            {/* Head */}
            <mesh position={[0, 1.7, 0]}>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial color={colors.skin} />
            </mesh>
            {/* Body - suit/jacket style */}
            <mesh position={[0, 1, 0]}>
              <boxGeometry args={[0.6, 0.8, 0.4]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
            {/* Arms */}
            <mesh position={[-0.4, 1, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
            <mesh position={[0.4, 1, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
            {/* Legs */}
            <mesh position={[-0.15, 0.4, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color="#000080" />
            </mesh>
            <mesh position={[0.15, 0.4, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color="#000080" />
            </mesh>
          </group>
        )

      case 'modernist':
        return (
          <group>
            {/* Head */}
            <mesh position={[0, 1.7, 0]}>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial color={colors.skin} />
            </mesh>
            {/* Body - simple dress/suit */}
            <mesh position={[0, 1, 0]}>
              <boxGeometry args={[0.6, 0.8, 0.4]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
            {/* Arms */}
            <mesh position={[-0.4, 1, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
            <mesh position={[0.4, 1, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
            {/* Legs - pants/skirt style */}
            <mesh position={[-0.15, 0.4, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color="#4169E1" />
            </mesh>
            <mesh position={[0.15, 0.4, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color="#4169E1" />
            </mesh>
          </group>
        )

      case 'brutalist':
        return (
          <group>
            {/* Head */}
            <mesh position={[0, 1.7, 0]}>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial color={colors.skin} />
            </mesh>
            {/* Body - simple practical clothing */}
            <mesh position={[0, 1, 0]}>
              <boxGeometry args={[0.6, 0.8, 0.4]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
            {/* Arms */}
            <mesh position={[-0.4, 1, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
            <mesh position={[0.4, 1, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
            {/* Legs */}
            <mesh position={[-0.15, 0.4, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color="#808080" />
            </mesh>
            <mesh position={[0.15, 0.4, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color="#808080" />
            </mesh>
          </group>
        )

      case 'postmodern':
        return (
          <group>
            {/* Head */}
            <mesh position={[0, 1.7, 0]}>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial color={colors.skin} />
            </mesh>
            {/* Body - colorful clothing */}
            <mesh position={[0, 1, 0]}>
              <boxGeometry args={[0.6, 0.8, 0.4]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
            {/* Arms */}
            <mesh position={[-0.4, 1, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
            <mesh position={[0.4, 1, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
            {/* Legs */}
            <mesh position={[-0.15, 0.4, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
            <mesh position={[0.15, 0.4, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
          </group>
        )

      case 'contemporary':
        return (
          <group>
            {/* Head */}
            <mesh position={[0, 1.7, 0]}>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial color={colors.skin} />
            </mesh>
            {/* Body - modern casual */}
            <mesh position={[0, 1, 0]}>
              <boxGeometry args={[0.6, 0.8, 0.4]} />
              <meshStandardMaterial color={colors.clothing} />
            </mesh>
            {/* Arms */}
            <mesh position={[-0.4, 1, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6]} />
              <meshStandardMaterial color="#CCCCCC" />
            </mesh>
            <mesh position={[0.4, 1, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6]} />
              <meshStandardMaterial color="#CCCCCC" />
            </mesh>
            {/* Legs - jeans/casual pants */}
            <mesh position={[-0.15, 0.4, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color="#000000" />
            </mesh>
            <mesh position={[0.15, 0.4, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color="#000000" />
            </mesh>
          </group>
        )

      case 'futuristic':
        return (
          <group>
            {/* Head - holographic display */}
            <mesh position={[0, 1.7, 0]}>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial 
                color={colors.skin}
                emissive={colors.clothing}
                emissiveIntensity={0.3}
              />
            </mesh>
            {/* Body - sleek suit with tech */}
            <mesh position={[0, 1, 0]}>
              <boxGeometry args={[0.6, 0.8, 0.4]} />
              <meshStandardMaterial color={colors.clothing} emissive={colors.clothing} emissiveIntensity={0.2} />
            </mesh>
            {/* Arms - tech sleeves */}
            <mesh position={[-0.4, 1, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6]} />
              <meshStandardMaterial color={colors.clothing} emissive={colors.clothing} emissiveIntensity={0.15} />
            </mesh>
            <mesh position={[0.4, 1, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6]} />
              <meshStandardMaterial color={colors.clothing} emissive={colors.clothing} emissiveIntensity={0.15} />
            </mesh>
            {/* Legs - tech pants */}
            <mesh position={[-0.15, 0.4, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color="#00BCD4" emissive="#00BCD4" emissiveIntensity={0.2} />
            </mesh>
            <mesh position={[0.15, 0.4, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color="#00BCD4" emissive="#00BCD4" emissiveIntensity={0.2} />
            </mesh>
            {/* LED accents */}
            <mesh position={[0, 0.3, 0]}>
              <boxGeometry args={[0.1, 0.6, 0.05]} />
              <meshStandardMaterial color="#00BCD4" emissive="#00BCD4" emissiveIntensity={0.5} />
            </mesh>
          </group>
        )
    }
  }, [colors, eraStyles])

  return (
    <group position={position} rotation={rotation}>
      {bodyStyle}
    </group>
  )
}