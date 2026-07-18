import React, { useMemo } from 'react'
import * as THREE from 'three'
import { EraStyles } from '../lib/eraStyles'

interface VehicleProps {
  position: [number, number, number]
  rotation: [number, number, number]
  type: 'car' | 'truck' | 'bus'
  eraStyles: EraStyles
}

export function Vehicle({ position, rotation, type, eraStyles }: VehicleProps) {
  const vehicleGeometry = useMemo(() => {
    const mainColor = eraStyles.vehicleColors[Math.floor(Math.random() * eraStyles.vehicleColors.length)]
    const wheelColor = eraStyles.buildingColors[0]
    
    switch (eraStyles.vehicleStyle) {
      case 'vintage':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={type === 'car' ? [4, 2, 8] : type === 'truck' ? [4, 2.5, 12] : [4, 3, 14]} />
              <meshStandardMaterial color={mainColor} />
            </mesh>
            {/* Vintage details - chrome accents */}
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={type === 'car' ? [3.5, 0.3, 7] : [3.5, 0.5, 11]} />
              <meshStandardMaterial color="#C0C0C0" />
            </mesh>
            {/* Wheels */}
            {[-2, 2].map((x, i) => {
              const zOffset = type === 'car' ? [-2.5, 2.5] : type === 'truck' ? [-4.5, 4.5] : [-5.5, 5.5]
              return (
                <group key={i}>
                  <mesh position={[x, -0.5, zOffset[0] as number]}>
                    <cylinderGeometry args={[0.8, 0.8, 0.6, 16]} />
                    <meshStandardMaterial color={wheelColor} />
                  </mesh>
                  <mesh position={[x, -0.5, zOffset[1] as number]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.8, 0.8, 0.6, 16]} />
                    <meshStandardMaterial color={wheelColor} />
                  </mesh>
                </group>
              )
            })}
            {/* Vintage headlights */}
            <mesh position={[0, 0.2, type === 'car' ? 4 : type === 'truck' ? 6 : 7]}>
              <circleGeometry args={[0.3, 16]} />
              <meshStandardMaterial color="#FFFF00" emissive="#FFFF00" emissiveIntensity={0.5} />
            </mesh>
          </group>
        )

      case 'classic':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={type === 'car' ? [4.5, 1.8, 9] : type === 'truck' ? [4.5, 3, 11] : [4.5, 3.5, 14]} />
              <meshStandardMaterial color={mainColor} />
            </mesh>
            <mesh position={[0, 0.6, 0]}>
              <boxGeometry args={type === 'car' ? [4, 0.4, 8] : [4, 0.8, 10]} />
              <meshStandardMaterial color={mainColor} />
            </mesh>
            {/* Chrome bumper */}
            <mesh position={[0, -0.5, -3.5]}>
              <boxGeometry args={[4.2, 0.2, 0.5]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            {/* Wheels */}
            {[-2, 2].map((x, i) => {
              const zOffset = type === 'car' ? [-3, 3] : type === 'truck' ? [-4.5, 4.5] : [-5.5, 5.5]
              return (
                <group key={i}>
                  <mesh position={[x, -0.9, zOffset[0] as number]}>
                    <cylinderGeometry args={[0.9, 0.9, 0.7, 16]} />
                    <meshStandardMaterial color={wheelColor} />
                  </mesh>
                  <mesh position={[x, -0.9, zOffset[1] as number]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.9, 0.9, 0.7, 16]} />
                    <meshStandardMaterial color={wheelColor} />
                  </mesh>
                </group>
              )
            })}
          </group>
        )

      case 'boxy':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={type === 'car' ? [5, 1.5, 10] : type === 'truck' ? [5, 3, 12] : [5, 4, 15]} />
              <meshStandardMaterial color={mainColor} />
            </mesh>
            <mesh position={[0, 0.8, 0]}>
              <boxGeometry args={type === 'car' ? [4.5, 1, 9] : [4.5, 2, 11]} />
              <meshStandardMaterial color={mainColor} />
            </mesh>
            {/* Angular details */}
            <mesh position={[0, 0.5, -3]}>
              <boxGeometry args={[4.8, 0.3, 1]} />
              <meshStandardMaterial color={wheelColor} />
            </mesh>
            {/* Wheels */}
            {[-2.5, 2.5].map((x, i) => {
              const zOffset = type === 'car' ? [-3, 3.5] : type === 'truck' ? [-5, 5] : [-6, 6]
              return (
                <group key={i}>
                  <mesh position={[x, -0.8, zOffset[0] as number]}>
                    <cylinderGeometry args={[1, 1, 0.6, 12]} />
                    <meshStandardMaterial color="#000000" />
                  </mesh>
                  <mesh position={[x, -0.8, zOffset[1] as number]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[1, 1, 0.6, 12]} />
                    <meshStandardMaterial color="#000000" />
                  </mesh>
                </group>
              )
            })}
          </group>
        )

      case 'sleek':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={type === 'car' ? [4.5, 1.2, 11] : type === 'truck' ? [4.8, 2.5, 13] : [5, 3.5, 15]} />
              <meshStandardMaterial color={mainColor} />
            </mesh>
            <mesh position={[0, 0.7, 0]}>
              <boxGeometry args={type === 'car' ? [4, 0.8, 10] : [4.3, 1.8, 12]} />
              <meshStandardMaterial color={mainColor} />
            </mesh>
            {/* Side skirts */}
            <mesh position={[0, -0.2, 0]}>
              <boxGeometry args={[type === 'car' ? 4.2 : 4.5, 0.2, type === 'car' ? 9.5 : 11]} />
              <meshStandardMaterial color={wheelColor} />
            </mesh>
            {/* Wheels */}
            {[-2.2, 2.2].map((x, i) => {
              const zOffset = type === 'car' ? [-4, 4.5] : type === 'truck' ? [-5.5, 5.5] : [-6.5, 6.5]
              return (
                <group key={i}>
                  <mesh position={[x, -0.9, zOffset[0] as number]}>
                    <cylinderGeometry args={[1, 1, 0.5, 16]} />
                    <meshStandardMaterial color={wheelColor} metalness={0.8} roughness={0.2} />
                  </mesh>
                  <mesh position={[x, -0.9, zOffset[1] as number]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[1, 1, 0.5, 16]} />
                    <meshStandardMaterial color={wheelColor} metalness={0.8} roughness={0.2} />
                  </mesh>
                </group>
              )
            })}
          </group>
        )

      case 'electric':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={type === 'car' ? [4.3, 1.3, 10] : type === 'truck' ? [5, 2.8, 12] : [5.2, 3.8, 14]} />
              <meshStandardMaterial color={mainColor} roughness={0.4} metalness={0.6} />
            </mesh>
            {/* Smooth top */}
            <mesh position={[0, 1, 0]}>
              <boxGeometry args={type === 'car' ? [3.8, 0.5, 9] : [4.5, 1.2, 11]} />
              <meshStandardMaterial color={mainColor} roughness={0.3} metalness={0.7} />
            </mesh>
            {/* Charging port */}
            <mesh position={[1.2, 0.2, -4.5]}>
              <circleGeometry args={[0.15, 12]} />
              <meshStandardMaterial color="#00BCD4" emissive="#00BCD4" emissiveIntensity={0.5} />
            </mesh>
            {/* Wheels */}
            {[-2, 2].map((x, i) => {
              const zOffset = type === 'car' ? [-3, 3] : type === 'truck' ? [-5, 5] : [-6, 6]
              return (
                <group key={i}>
                  <mesh position={[x, -0.7, zOffset[0] as number]}>
                    <cylinderGeometry args={[0.9, 0.9, 0.4, 16]} />
                    <meshStandardMaterial color="#333333" metalness={0.9} roughness={0.1} />
                  </mesh>
                  <mesh position={[x, -0.7, zOffset[1] as number]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.9, 0.9, 0.4, 16]} />
                    <meshStandardMaterial color="#333333" metalness={0.9} roughness={0.1} />
                  </mesh>
                </group>
              )
            })}
          </group>
        )

      case 'autonomous':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={type === 'car' ? [4.2, 1.2, 9.5] : type === 'truck' ? [4.8, 2.5, 11.5] : [5, 3.5, 13.5]} />
              <meshStandardMaterial color={mainColor} emissive={mainColor} emissiveIntensity={0.1} />
            </mesh>
            {/* Sensor arrays */}
            <mesh position={[0, 1.2, 0]}>
              <boxGeometry args={[type === 'car' ? 3.5 : 4, 0.3, type === 'car' ? 8 : 10]} />
              <meshStandardMaterial color="#1A1A1A" />
            </mesh>
            {/* LiDAR sensors */}
            <mesh position={[0, 1.8, -3]}>
              <circleGeometry args={[0.4, 16]} />
              <meshStandardMaterial color="#00BCD4" emissive="#00BCD4" emissiveIntensity={0.8} />
            </mesh>
            {/* LED strips */}
            <mesh position={[0, 0.2, -4]}>
              <boxGeometry args={[3.8, 0.1, 0.1]} />
              <meshStandardMaterial color="#00BCD4" emissive="#00BCD4" emissiveIntensity={0.5} />
            </mesh>
            {/* Wheels - sleek design */}
            {[-2, 2].map((x, i) => {
              const zOffset = type === 'car' ? [-2.8, 3] : type === 'truck' ? [-4.2, 4.5] : [-5, 5.2]
              return (
                <group key={i}>
                  <mesh position={[x, -0.6, zOffset[0] as number]}>
                    <cylinderGeometry args={[0.7, 0.7, 0.3, 12]} />
                    <meshStandardMaterial color="#00BCD4" emissive="#00BCD4" emissiveIntensity={0.3} />
                  </mesh>
                  <mesh position={[x, -0.6, zOffset[1] as number]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.7, 0.7, 0.3, 12]} />
                    <meshStandardMaterial color="#00BCD4" emissive="#00BCD4" emissiveIntensity={0.3} />
                  </mesh>
                </group>
              )
            })}
          </group>
        )
    }
  }, [type, eraStyles])

  return (
    <group position={position} rotation={rotation}>
      {vehicleGeometry}
    </group>
  )
}