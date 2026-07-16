import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Era, ERA_CONFIGS } from '../stores/types'

interface BuildingProps {
  position: [number, number, number]
  currentEra: Era
  targetEra: Era
  transitionProgress: number
  isTransitioning: boolean
}

export function Building({ position, currentEra, targetEra, transitionProgress, isTransitioning }: BuildingProps) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const config = ERA_CONFIGS[currentEra]

  const interpolatedConfig = useMemo(() => {
    if (!isTransitioning) return config
    
    const target = ERA_CONFIGS[targetEra]
    const t = transitionProgress
    
    return {
      height: THREE.MathUtils.lerp(config.buildingStyle.height, target.buildingStyle.height, t),
      width: THREE.MathUtils.lerp(config.buildingStyle.width, target.buildingStyle.width, t),
      depth: THREE.MathUtils.lerp(config.buildingStyle.depth, target.buildingStyle.depth, t),
      facadeColor: new THREE.Color(config.buildingStyle.facadeColor).getHexString(),
    }
  }, [currentEra, targetEra, transitionProgress, isTransitioning, config])

  useFrame((state) => {
    if (meshRef.current) {
      // Subtle animation for life
      meshRef.current.scale.y = interpolatedConfig.height / 10 + Math.sin(state.clock.elapsedTime * 0.5) * 0.01
    }
  })

  const getWindowPattern = (pattern: string, width: number, height: number) => {
    const windows = []
    const windowSize = 0.8
    const gap = 0.2
    
    switch (pattern) {
      case 'grid':
        const cols = Math.floor(width / 2)
        const rows = Math.floor(height / 2)
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const x = -width / 2 + gap + col * (windowSize + gap) + windowSize / 2
            const y = -height / 2 + gap + row * (windowSize + gap) + windowSize / 2
            const z = width / 2 + 0.01
            windows.push([x, y, z, windowSize, windowSize])
          }
        }
        break
      case 'large_panels':
        const largeCols = Math.floor(width / 4)
        const largeRows = Math.floor(height / 3)
        for (let row = 0; row < largeRows; row++) {
          for (let col = 0; col < largeCols; col++) {
            const x = -width / 2 + gap + col * (windowSize * 2 + gap) + windowSize
            const y = -height / 2 + gap + row * (windowSize * 1.5 + gap) + windowSize * 0.75
            const z = width / 2 + 0.01
            windows.push([x, y, z, windowSize * 2, windowSize * 1.5])
          }
        }
        break
      case 'glass_curtain':
        const glassCols = Math.floor(width / 1.5)
        const glassRows = Math.floor(height / 1.5)
        for (let row = 0; row < glassRows; row++) {
          for (let col = 0; col < glassCols; col++) {
            const x = -width / 2 + gap + col * (windowSize * 0.8 + gap) + windowSize * 0.4
            const y = -height / 2 + gap + row * (windowSize * 0.8 + gap) + windowSize * 0.4
            const z = width / 2 + 0.01
            windows.push([x, y, z, windowSize * 0.8, windowSize * 0.8])
          }
        }
        break
      case 'adaptive_smart':
        const smartCols = Math.floor(width / 1.2)
        const smartRows = Math.floor(height / 1.2)
        for (let row = 0; row < smartRows; row++) {
          for (let col = 0; col < smartCols; col++) {
            const x = -width / 2 + gap + col * (windowSize * 0.6 + gap) + windowSize * 0.3
            const y = -height / 2 + gap + row * (windowSize * 0.6 + gap) + windowSize * 0.3
            const z = width / 2 + 0.01
            windows.push([x, y, z, windowSize * 0.6, windowSize * 0.6])
          }
        }
        break
      default:
        const defCols = Math.floor(width / 2.5)
        const defRows = Math.floor(height / 2.5)
        for (let row = 0; row < defRows; row++) {
          for (let col = 0; col < defCols; col++) {
            const x = -width / 2 + gap + col * (windowSize + gap) + windowSize / 2
            const y = -height / 2 + gap + row * (windowSize + gap) + windowSize / 2
            const z = width / 2 + 0.01
            windows.push([x, y, z, windowSize, windowSize])
          }
        }
    }
    
    return windows
  }

  const windows = useMemo(() => {
    return getWindowPattern(config.buildingStyle.windowPattern, interpolatedConfig.width, interpolatedConfig.height)
  }, [config, interpolatedConfig])

  return (
    <group position={position}>
      {/* Main building */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[interpolatedConfig.width, interpolatedConfig.height, interpolatedConfig.depth]} />
        <meshStandardMaterial 
          color={interpolatedConfig.facadeColor} 
          metalness={0.7} 
          roughness={0.3}
          emissive={new THREE.Color(interpolatedConfig.facadeColor).multiplyScalar(0.1)}
        />
      </mesh>

      {/* Windows */}
      {windows.map((w, i) => {
        const windowColor = currentEra === '1945' ? '#ADD8E6' : 
                          currentEra === '1965' ? '#87CEEB' :
                          currentEra === '1985' ? '#00BFFF' :
                          currentEra === '2005' ? '#1E90FF' :
                          currentEra === '2025' ? '#00FFFF' : '#FFFFFF'
        return (
          <mesh key={`win-${i}`} position={[w[0], w[1], w[2]]}>
            <planeGeometry args={[w[3], w[4]]} />
            <meshBasicMaterial 
              color={windowColor}
              opacity={0.8}
              transparent
              emissive={windowColor}
              emissiveIntensity={0.5}
            />
          </mesh>
        )
      })}

      {/* Roof details */}
      {config.buildingStyle.roofStyle !== 'flat' && (
        <group position={[0, interpolatedConfig.height / 2 + 0.5, 0]}>
          {config.buildingStyle.roofStyle === 'flat_with_ac' && (
            <mesh>
              <boxGeometry args={[2, 0.5, 1]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
          )}
          {config.buildingStyle.roofStyle === 'varied' && (
            <mesh>
              <coneGeometry args={[2, 3, 4]} />
              <meshStandardMaterial color="#CD853F" />
            </mesh>
          )}
          {config.buildingStyle.roofStyle === 'flat_green' && (
            <>
              <mesh position={[-3, 0.3, 0]}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshStandardMaterial color="#228B22" />
              </mesh>
              <mesh position={[3, 0.3, 0]}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshStandardMaterial color="#32CD32" />
              </mesh>
            </>
          )}
          {config.buildingStyle.roofStyle === 'levitating_garden' && (
            <group>
              <mesh position={[0, 1, 0]}>
                <cylinderGeometry args={[3, 3, 0.5]} />
                <meshStandardMaterial color="#FFFFFF" opacity={0.5} transparent />
              </mesh>
              <mesh position={[0, 1.5, 3]}>
                <torusGeometry args={[2, 0.3]} />
                <meshStandardMaterial color="#00FF7F" emissive="#00FF7F" />
              </mesh>
            </group>
          )}
        </group>
      )}
    </group>
  )
}