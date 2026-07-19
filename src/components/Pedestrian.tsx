import React, { useRef, useEffect, useMemo } from 'react'
import { gsap } from 'gsap'

interface PedestrianProps {
  position: [number, number, number]
  rotation: [number, number, number]
  era: number
  index: number
}

type OutfitType = 'formal' | 'casual' | 'vintage' | 'modern' | 'futuristic'

interface PedestrianStyle {
  outfit: OutfitType
  color: string
  height: number
}

export const Pedestrian: React.FC<PedestrianProps> = ({ position, rotation, era, index }) => {
  const groupRef = useRef<any>(null!)
  const pedestrianStyle = useMemo(() => getPedestrianStyle(era, index), [era, index])

  // Animate on era change
  useEffect(() => {
    if (groupRef.current) {
      gsap.to(groupRef.current.scale, {
        y: pedestrianStyle.height,
        duration: 1.5,
        ease: 'back.out',
      })
    }
  }, [era, pedestrianStyle])

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Head */}
      <mesh position={[0, 1.6 * pedestrianStyle.height, 0]}>
        <sphereGeometry args={[0.25 * pedestrianStyle.height, 16, 16]} />
        <meshStandardMaterial color="#FDBCB4" />
      </mesh>
      
      {/* Body */}
      <mesh position={[0, 1.1 * pedestrianStyle.height, 0]}>
        <boxGeometry args={[0.5 * pedestrianStyle.height, 0.8 * pedestrianStyle.height, 0.3 * pedestrianStyle.height]} />
        <meshStandardMaterial color={pedestrianStyle.color} />
      </mesh>
      
      {/* Arms */}
      <mesh position={[0.35 * pedestrianStyle.height, 1.1 * pedestrianStyle.height, 0]}>
        <cylinderGeometry args={[0.08 * pedestrianStyle.height, 0.08 * pedestrianStyle.height, 0.6 * pedestrianStyle.height]} />
        <meshStandardMaterial color={pedestrianStyle.color} />
      </mesh>
      <mesh position={[-0.35 * pedestrianStyle.height, 1.1 * pedestrianStyle.height, 0]}>
        <cylinderGeometry args={[0.08 * pedestrianStyle.height, 0.08 * pedestrianStyle.height, 0.6 * pedestrianStyle.height]} />
        <meshStandardMaterial color={pedestrianStyle.color} />
      </mesh>
      
      {/* Legs */}
      <mesh position={[0.15 * pedestrianStyle.height, 0.4 * pedestrianStyle.height, 0]}>
        <cylinderGeometry args={[0.1 * pedestrianStyle.height, 0.1 * pedestrianStyle.height, 0.8 * pedestrianStyle.height]} />
        <meshStandardMaterial color="#2F4F4F" />
      </mesh>
      <mesh position={[-0.15 * pedestrianStyle.height, 0.4 * pedestrianStyle.height, 0]}>
        <cylinderGeometry args={[0.1 * pedestrianStyle.height, 0.1 * pedestrianStyle.height, 0.8 * pedestrianStyle.height]} />
        <meshStandardMaterial color="#2F4F4F" />
      </mesh>
      
      {/* Era-specific accessories */}
      {era >= 2005 && (
        <mesh position={[0, 1.1 * pedestrianStyle.height, 0.2 * pedestrianStyle.height]}>
          <boxGeometry args={[0.3 * pedestrianStyle.height, 0.1 * pedestrianStyle.height, 0.5 * pedestrianStyle.height]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
      )}
      
      {era >= 2055 && (
        <mesh position={[0, 1.7 * pedestrianStyle.height, 0]}>
          <ringGeometry args={[0.3 * pedestrianStyle.height, 0.35 * pedestrianStyle.height, 16]} />
          <meshBasicMaterial color="#00FFFF" />
        </mesh>
      )}
    </group>
  )
}

function getPedestrianStyle(era: number, index: number): PedestrianStyle {
  const colors: string[] = era <= 1945
    ? ['#2F4F4F', '#8B4513', '#696969']
    : era <= 1985
    ? ['#4169E1', '#DC143C', '#228B22', '#8B4513']
    : era <= 2025
    ? ['#FF69B4', '#1E90FF', '#32CD32', '#FFD700']
    : ['#9932CC', '#00CED1', '#FF1493', '#00BFFF']

  const outfitTypes: OutfitType[] = era <= 1945
    ? ['formal', 'formal', 'vintage']
    : era <= 1985
    ? ['casual', 'formal', 'casual']
    : era <= 2025
    ? ['modern', 'casual', 'modern']
    : ['futuristic', 'futuristic', 'futuristic']

  return {
    outfit: outfitTypes[index % outfitTypes.length],
    color: colors[index % colors.length],
    height: 1,
  }
}