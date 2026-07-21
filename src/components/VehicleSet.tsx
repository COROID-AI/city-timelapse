import { useMemo } from 'react'
import { Era } from '@/App'
import * as THREE from 'three'

interface VehicleData {
  position: [number, number, number]
  rotation: [number, number, number]
  speed: number
  era: Era
}

function getVehicleStyle(era: Era) {
  switch (era) {
    case '1945':
      return {
        color: '#8B4513', // Brown
        modelType: 'sedan',
        details: 'chrome trim'
      }
    case '1965':
      return {
        color: '#4A5D23', // Olive green
        modelType: 'muscle',
        details: 'bold lines'
      }
    case '1985':
      return {
        color: '#2C3E50', // Dark blue
        modelType: 'suv',
        details: 'plastic trim'
      }
    case '2005':
      return {
        color: '#34495E', // Charcoal
        modelType: 'sedan',
        details: 'modern styling'
      }
    case '2025':
      return {
        color: '#7F8C8D', // Silver
        modelType: 'electric',
        details: 'sleek design'
      }
    case '2055':
      return {
        color: '#00FFFF', // Futuristic cyan
        modelType: 'hover',
        details: 'advanced tech'
      }
  }
}

function generateVehicles(): VehicleData[] {
  const vehicles: VehicleData[] = []
  
  // Generate vehicles on roads
  for (let i = 0; i < 15; i++) {
    const lane = Math.floor(Math.random() * 8) - 4
    const z = Math.random() * 80 - 40
    const speed = 0.5 + Math.random() * 2
    
    vehicles.push({
      position: [lane * 3, 1, z],
      rotation: [0, Math.random() * Math.PI, 0],
      speed,
      era: '1945' // Default, will be overridden
    })
  }
  
  return vehicles
}

function Vehicle({ 
  position, 
  speed, 
  era, 
  targetEra
}: {
  position: [number, number, number]
  speed: number
  era: Era
  targetEra: Era
}) {
  const style = getVehicleStyle(era)

  // Wheel rotation animation
  const wheelRotation = useMemo(() => Date.now() * 0.002 * speed, [])

  return (
    <group position={[position[0], position[1], position[2] + Math.sin(Date.now() * 0.001 * speed) * 0.1]}>
      {/* Main vehicle body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2, 0.8, 4]} />
        <meshStandardMaterial 
          color={style.color}
          metalness={era === '2055' ? 0.9 : 0.3}
          roughness={era === '2055' ? 0.1 : 0.7}
        />
      </mesh>
      
      {/* Wheels */}
      <group rotation={[wheelRotation, 0, 0]} position={[-1.2, -0.4, 1.2]}>
        <mesh>
          <cylinderGeometry args={[0.5, 0.5, 0.3]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>
      <group rotation={[wheelRotation, 0, 0]} position={[1.2, -0.4, 1.2]}>
        <mesh>
          <cylinderGeometry args={[0.5, 0.5, 0.3]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>
      <group rotation={[wheelRotation, 0, 0]} position={[-1.2, -0.4, -1.2]}>
        <mesh>
          <cylinderGeometry args={[0.5, 0.5, 0.3]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>
      <group rotation={[wheelRotation, 0, 0]} position={[1.2, -0.4, -1.2]}>
        <mesh>
          <cylinderGeometry args={[0.5, 0.5, 0.3]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>

      {/* Details based on era */}
      {era === '1945' && (
        <mesh position={[0, 0.2, 2]}>
          <boxGeometry args={[0.8, 0.1, 0.2]} />
          <meshStandardMaterial color="#FFD700" /> {/* Chrome */}
        </mesh>
      )}
      
      {era === '1965' && (
        <mesh position={[0, 0.2, 2]}>
          <boxGeometry args={[0.8, 0.1, 0.2]} />
          <meshStandardMaterial color="#FF0000" /> {/* Red striping */}
        </mesh>
      )}
      
      {era === '2055' && (
        <group position={[0, 0.5, 2]}>
          <mesh>
            <boxGeometry args={[0.5, 0.1, 0.1]} />
            <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, 0.1, 0.1]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.5} />
          </mesh>
        </group>
      )}
    </group>
  )
}

export function VehicleSet({ 
  era, 
  targetEra
}: {
  era: Era
  targetEra: Era
  transitionProgress: number
}) {
  const vehicles = useMemo(() => generateVehicles(), [])

  return (
    <group>
      {vehicles.map((vehicle, i) => (
        <Vehicle
          key={i}
          position={vehicle.position}
          speed={vehicle.speed}
          era={era}
          targetEra={targetEra}
        />
      ))}
    </group>
  )
}