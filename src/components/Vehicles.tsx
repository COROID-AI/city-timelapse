import { Era } from '../App'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface VehiclesProps {
  era: Era
  transitionPhase: number
}

// Vehicle configs for each era
const VEHICLE_CONFIGS: Record<Era, any[]> = {
  '1945': [
    { id: 1, position: [-20, 0, -30], rotation: [0, Math.PI / 2, 0], type: 'sedan' },
    { id: 2, position: [-10, 0, -25], rotation: [0, Math.PI / 2, 0], type: 'coupe' },
  ],
  '1965': [
    { id: 1, position: [-20, 0, -30], rotation: [0, Math.PI / 2, 0], type: 'muscle' },
    { id: 2, position: [-10, 0, -25], rotation: [0, Math.PI / 2, 0], type: 'sedan' },
    { id: 3, position: [-5, 0, -30], rotation: [0, Math.PI / 2, 0], type: 'wagon' },
  ],
  '1985': [
    { id: 1, position: [-20, 0, -30], rotation: [0, Math.PI / 2, 0], type: 'sedan' },
    { id: 2, position: [-10, 0, -25], rotation: [0, Math.PI / 2, 0], type: 'sedan' },
    { id: 3, position: [-5, 0, -30], rotation: [0, Math.PI / 2, 0], type: 'suv' },
    { id: 4, position: [-15, 0, -20], rotation: [0, Math.PI / 2, 0], type: 'truck' },
  ],
  '2005': [
    { id: 1, position: [-20, 0, -30], rotation: [0, Math.PI / 2, 0], type: 'sedan' },
    { id: 2, position: [-10, 0, -25], rotation: [0, Math.PI / 2, 0], type: 'sedan' },
    { id: 3, position: [-5, 0, -30], rotation: [0, Math.PI / 2, 0], type: 'suv' },
    { id: 4, position: [-15, 0, -20], rotation: [0, Math.PI / 2, 0], type: 'truck' },
  ],
  '2025': [
    { id: 1, position: [-20, 0, -30], rotation: [0, Math.PI / 2, 0], type: 'electric-sedan' },
    { id: 2, position: [-10, 0, -25], rotation: [0, Math.PI / 2, 0], type: 'suv' },
    { id: 3, position: [-5, 0, -30], rotation: [0, Math.PI / 2, 0], type: 'electric-suv' },
  ],
  '2055': [
    { id: 1, position: [-20, 0, -30], rotation: [0, Math.PI / 2, 0], type: 'hover-car' },
    { id: 2, position: [-10, 0, -25], rotation: [0, Math.PI / 2, 0], type: 'pod' },
    { id: 3, position: [-5, 0, -30], rotation: [0, Math.PI / 2, 0], type: 'hover-truck' },
  ],
}

const VEHICLE_COLORS: Record<Era, string[]> = {
  '1945': ['#8B4513', '#A0522D', '#CD853F', '#556B2F'],
  '1965': ['#FF0000', '#0000FF', '#FFFFFF', '#000000'],
  '1985': ['#FF0000', '#0000FF', '#FFFF00', '#FFFFFF', '#00FF00'],
  '2005': ['#000000', '#FFFFFF', '#Silver', '#Gray', '#Blue'],
  '2025': ['#2D3748', '#00BFFF', '#FFFFFF', '#E2E8F0', '#4FD1C5'],
  '2055': ['#00FFFF', '#FF00FF', '#FFFF00', '#FFFFFF', '#00FF00'],
}

export function Vehicles({ era, transitionPhase }: VehiclesProps) {
  const vehicles = useMemo(() => VEHICLE_CONFIGS[era], [era])
  const colors = VEHICLE_COLORS[era]

  return (
    <group>
      {vehicles.map((vehicle, i) => (
        <Vehicle 
          key={vehicle.id} 
          config={vehicle} 
          color={colors[i % colors.length]}
          era={era}
        />
      ))}
    </group>
  )
}

function Vehicle({ config, color, era }: { config: any, color: string, era: Era }) {
  const meshRef = useRef<THREE.Group>(null)

  // Animate vehicles
  useFrame((state) => {
    if (meshRef.current && era !== '2055') {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.02
    }
  })

  if (era === '2055') {
    return (
      <group position={config.position as [number, number, number]} rotation={config.rotation as [number, number, number]}>
        {config.type === 'hover-car' && <HoverCar color={color} />}
        {config.type === 'pod' && <PodCar color={color} />}
        {config.type === 'hover-truck' && <HoverTruck color={color} />}
      </group>
    )
  }

  return (
    <group 
      ref={meshRef} 
      position={config.position as [number, number, number]} 
      rotation={config.rotation as [number, number, number]}
    >
      {config.type === 'sedan' && <Sedan color={color} era={era} />}
      {config.type === 'coupe' && <Coupe color={color} era={era} />}
      {config.type === 'muscle' && <MuscleCar color={color} />}
      {config.type === 'wagon' && <Wagon color={color} />}
      {config.type === 'suv' && <SUV color={color} />}
      {config.type === 'truck' && <Truck color={color} />}
      {config.type === 'electric-sedan' && <ElectricSedan color={color} />}
      {config.type === 'electric-suv' && <ElectricSUV color={color} />}
    </group>
  )
}

// 1945 Vehicles
function Sedan({ color, era }: { color: string, era: Era }) {
  return (
    <group>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[2, 0.6, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.7, 0.3, -1]} castShadow>
        <boxGeometry args={[0.6, 0.4, 1.8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.1, 1.2]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.2]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {era === '2025' && (
        <mesh position={[0, 0.5, 0]}>
          <planeGeometry args={[1.8, 0.8]} />
          <meshStandardMaterial color="#87CEEB" emissive="#87CEEB" emissiveIntensity={0.2} />
        </mesh>
      )}
    </group>
  )
}

function Coupe({ color, era }: { color: string, era: Era }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.8, 0.7, 4.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.1, 1.2]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.2]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  )
}

// 1965 Vehicles
function MuscleCar({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.35, -0.5]} castShadow>
        <boxGeometry args={[2, 0.5, 4.5]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.2, 0.5]}>
        <planeGeometry args={[1.5, 0.5]} />
        <meshStandardMaterial color="#FF0000" emissive="#FF0000" />
      </mesh>
      <mesh position={[0, 0.1, 1.2]} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.25]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  )
}

// 1985+ Vehicles
function Wagon({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[2, 0.8, 4.5]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.1, 1.2]} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.25]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  )
}

function SUV({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[2, 1, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.1, 1.2]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 0.3]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  )
}

function Truck({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[2.2, 0.8, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.3, -1.5]} castShadow>
        <boxGeometry args={[2, 0.6, 2]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

// 2025+ Electric Vehicles
function ElectricSedan({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[1.8, 0.5, 4.2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[0, 0.1, 1.2]} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.2]} />
        <meshStandardMaterial color="#4FD1C5" emissive="#4FD1C5" />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <planeGeometry args={[1.5, 0.6]} />
        <meshStandardMaterial color="#87CEEB" emissive="#87CEEB" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

function ElectricSUV({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[2, 1, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[0, 0.1, 1.2]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 0.25]} />
        <meshStandardMaterial color="#4FD1C5" emissive="#4FD1C5" />
      </mesh>
    </group>
  )
}

// 2055 Futuristic Vehicles
function HoverCar({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null)
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 0.2
    }
  })

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[2, 0.4, 3.5]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <planeGeometry args={[3, 1.5]} />
        <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={1} />
      </mesh>
    </group>
  )
}

function PodCar({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null)
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.08 + 0.15
    }
  })

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.8, 2.5, 4, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.5} transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

function HoverTruck({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null)
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.8) * 0.12 + 0.4
    }
  })

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[2.5, 0.6, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <planeGeometry args={[3.5, 1.8]} />
        <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}