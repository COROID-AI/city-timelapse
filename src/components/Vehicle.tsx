import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Era, ERA_CONFIGS } from '../stores/types'

interface VehicleProps {
  position: [number, number, number]
  currentEra: Era
  targetEra: Era
  transitionProgress: number
  isTransitioning: boolean
}

export function Vehicle({ position, currentEra, targetEra, transitionProgress, isTransitioning }: VehicleProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const wheelsRef = useRef<THREE.Mesh[]>([] as THREE.Mesh[])
  const config = ERA_CONFIGS[currentEra]

  const vehicleStyle = useMemo(() => {
    if (!isTransitioning) return config.vehicleStyle.type

    const target = ERA_CONFIGS[targetEra]
    const t = transitionProgress
    
    // Return interpolated style
    return {
      type: currentEra, // Use current era type during transition
      color: new THREE.Color(config.vehicleStyle.color).lerp(
        new THREE.Color(target.vehicleStyle.color),
        t
      ).getHexString()
    }
  }, [currentEra, targetEra, transitionProgress, isTransitioning, config])

  useFrame((state) => {
    if (groupRef.current) {
      // Move vehicles along street
      groupRef.current.position.x += config.vehicleStyle.speed
      if (groupRef.current.position.x > 60) {
        groupRef.current.position.x = -60
      }
      
      // Rotate wheels
      wheelsRef.current.forEach(wheel => {
        wheel.rotation.x += state.clock.delta * 5
      })
    }
  })

  const getVehicleGeometry = (type: string) => {
    switch (type) {
      case 'vintage':
        return { bodyShape: 'box', bodySize: [3, 0.6, 1.5] as [number, number, number], color: '#4A90E2' }
      case 'muscle_car':
        return { bodyShape: 'box', bodySize: [4.5, 0.8, 2] as [number, number, number], color: '#FF4500' }
      case 'sedan':
        return { bodyShape: 'box', bodySize: [4, 0.7, 1.8] as [number, number, number], color: '#32CD32' }
      case 'suv':
        return { bodyShape: 'box', bodySize: [4.5, 1, 2.2] as [number, number, number], color: '#4169E1' }
      case 'ev':
        return { bodyShape: 'rounded', bodySize: [4, 0.8, 1.8] as [number, number, number], color: '#00FF7F' }
      case 'autonomous_pod':
        return { bodyShape: 'pod', bodySize: [3, 1.2, 3] as [number, number, number], color: '#FF00FF' }
      default:
        return { bodyShape: 'box', bodySize: [3, 0.6, 1.5] as [number, number, number], color: '#4A90E2' }
    }
  }

  const vehicleGeometry = getVehicleGeometry(config.vehicleStyle.type)

  const Wheel = ({ position }: { position: [number, number, number] }) => {
    wheelsRef.current.push(null!)
    return (
      <mesh 
        position={position} 
        rotation={[Math.PI / 2, 0, 0]}
        ref={el => { if (el) wheelsRef.current[wheelsRef.current.length - 1] = el }}
      >
        <cylinderGeometry args={[0.3, 0.3, 0.3, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    )
  }

  return (
    <group ref={groupRef} position={position} rotation={[0, Math.PI / 2, 0]}>
      {config.vehicleStyle.type === 'autonomous_pod' ? (
        // Futuristic pod design
        <>
          <mesh castShadow>
            <capsuleGeometry args={[1, 1.5, 8, 16]} />
            <meshStandardMaterial 
              color={vehicleGeometry.color} 
              metalness={0.9} 
              roughness={0.1}
              emissive={vehicleGeometry.color}
              emissiveIntensity={0.3}
            />
          </mesh>
          <mesh position={[0, 0.8, 0]}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial 
              color="#FFFFFF" 
              opacity={0.5} 
              transparent
              emissive="#00FFFF"
            />
          </mesh>
          <Wheel position={[-0.8, 0.2, 0]} />
          <Wheel position={[0.8, 0.2, 0]} />
        </>
      ) : (
        // Traditional vehicle design
        <>
          <mesh castShadow>
            <boxGeometry args={vehicleGeometry.bodySize} />
            <meshStandardMaterial 
              color={vehicleGeometry.color}
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
          <Wheel position={[-0.9, 0.2, -0.6]} />
          <Wheel position={[0.9, 0.2, -0.6]} />
          <Wheel position={[-0.9, 0.2, 0.6]} />
          <Wheel position={[0.9, 0.2, 0.6]} />
        </>
      )}
    </group>
  )
}