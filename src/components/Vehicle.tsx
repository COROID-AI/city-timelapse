import React, { useRef, useEffect, useMemo } from 'react'
import { gsap } from 'gsap'

interface VehicleProps {
  position: [number, number, number]
  rotation: [number, number, number]
  era: number
  index: number
}

interface VehicleStyle {
  type: 'car' | 'truck' | 'bus' | 'motorcycle' | 'hover'
  color: string
  size: number
  wheelCount: number
}

export const Vehicle: React.FC<VehicleProps> = ({ position, rotation, era, index }) => {
  const groupRef = useRef<any>(null!)
  const vehicleStyle = useMemo(() => getVehicleStyle(era, index), [era, index])

  // Animate on era change
  useEffect(() => {
    if (groupRef.current) {
      gsap.to(groupRef.current.scale, {
        x: vehicleStyle.size,
        y: vehicleStyle.size,
        z: vehicleStyle.size,
        duration: 1.5,
        ease: 'elastic.out',
      })
    }
  }, [era, vehicleStyle])

  // Generate wheels
  const wheels = useMemo(() => {
    const wheelCount = vehicleStyle.wheelCount
    const wheelSize = vehicleStyle.type === 'hover' ? 0.3 : 0.4
    
    return Array.from({ length: wheelCount }).map((_, i) => {
      return (
        <mesh
          key={`wheel-${i}`}
          position={[
            -0.8 + (i % 2) * 1.6,
            0.3,
            -0.6 + Math.floor(i / 2) * 1.2
          ]}
          rotation={vehicleStyle.type === 'hover' ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
        >
          <cylinderGeometry args={[wheelSize, wheelSize, 0.3, 16]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      )
    })
  }, [vehicleStyle])

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Vehicle body */}
      <mesh castShadow receiveShadow>
        {vehicleStyle.type === 'hover' ? (
          <capsuleGeometry args={[1.2, 2.5, 8, 16]} />
        ) : (
          <boxGeometry args={[3, 1, 1.5]} />
        )}
        <meshStandardMaterial color={vehicleStyle.color} />
      </mesh>
      
      {/* Wheels */}
      {wheels}
      
      {/* Details for modern/future vehicles */}
      {vehicleStyle.type === 'hover' && (
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  )
}

function getVehicleStyle(era: number, index: number): VehicleStyle {
  const types = era <= 1965 
    ? ['car', 'truck', 'bus'] as const
    : era <= 2005
    ? ['car', 'truck', 'motorcycle'] as const
    : ['car', 'bus', 'motorcycle'] as const

  const colors = era <= 1965
    ? ['#8B4513', '#A52A2A', '#696969', '#2F4F4F']
    : era <= 2005
    ? ['#FF0000', '#0000FF', '#FFFFFF', '#00FF00', '#FFFF00']
    : ['#FF69B4', '#1E90FF', '#32CD32', '#FF1493']

  const isHover = era >= 2055 && index % 3 === 0

  return {
    type: isHover ? 'hover' : types[index % types.length],
    color: colors[index % colors.length],
    size: isHover ? 0.8 : 1,
    wheelCount: isHover ? 4 : 4,
  }
}