import { Era } from '../App'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface PedestriansProps {
  era: Era
  transitionPhase: number
}

// Pedestrian configs for each era
const PEDESTRIAN_CONFIGS: Record<Era, any[]> = {
  '1945': [
    { id: 1, position: [-15, 0, 0], rotation: [0, Math.PI / 2, 0], type: 'businessman' },
    { id: 2, position: [-10, 0, -10], rotation: [0, 0, 0], type: 'woman' },
    { id: 3, position: [5, 0, 5], rotation: [0, -Math.PI / 4, 0], type: 'worker' },
  ],
  '1965': [
    { id: 1, position: [-15, 0, 0], rotation: [0, Math.PI / 2, 0], type: 'mod-dress' },
    { id: 2, position: [-10, 0, -10], rotation: [0, 0, 0], type: 'hippie' },
    { id: 3, position: [5, 0, 5], rotation: [0, -Math.PI / 4, 0], type: 'business' },
  ],
  '1985': [
    { id: 1, position: [-15, 0, 0], rotation: [0, Math.PI / 2, 0], type: 'yuppie' },
    { id: 2, position: [-10, 0, -10], rotation: [0, 0, 0], type: 'business' },
    { id: 3, position: [5, 0, 5], rotation: [0, -Math.PI / 4, 0], type: 'casual' },
    { id: 4, position: [15, 0, -5], rotation: [0, Math.PI, 0], type: 'punk' },
  ],
  '2005': [
    { id: 1, position: [-15, 0, 0], rotation: [0, Math.PI / 2, 0], type: 'business' },
    { id: 2, position: [-10, 0, -10], rotation: [0, 0, 0], type: 'casual' },
    { id: 3, position: [5, 0, 5], rotation: [0, -Math.PI / 4, 0], type: 'athletic' },
  ],
  '2025': [
    { id: 1, position: [-15, 0, 0], rotation: [0, Math.PI / 2, 0], type: 'modern' },
    { id: 2, position: [-10, 0, -10], rotation: [0, 0, 0], type: 'smart' },
    { id: 3, position: [5, 0, 5], rotation: [0, -Math.PI / 4, 0], type: 'casual' },
    { id: 4, position: [15, 0, -5], rotation: [0, Math.PI, 0], type: 'tech' },
  ],
  '2055': [
    { id: 1, position: [-15, 0, 0], rotation: [0, Math.PI / 2, 0], type: 'future' },
    { id: 2, position: [-10, 0, -10], rotation: [0, 0, 0], type: 'cyborg' },
    { id: 3, position: [5, 0, 5], rotation: [0, -Math.PI / 4, 0], type: 'future' },
    { id: 4, position: [15, 0, -5], rotation: [0, Math.PI, 0], type: 'android' },
  ],
}

export function Pedestrians({ era, transitionPhase }: PedestriansProps) {
  const pedestrians = useMemo(() => PEDESTRIAN_CONFIGS[era], [era])

  return (
    <group>
      {pedestrians.map((pedestrian) => (
        <Pedestrian 
          key={pedestrian.id} 
          config={pedestrian} 
          era={era}
        />
      ))}
    </group>
  )
}

function Pedestrian({ config, era }: { config: any, era: Era }) {
  const groupRef = useRef<THREE.Group>(null)
  const timeOffset = useRef(Math.random() * 10)

  // Walking animation
  useFrame((state) => {
    if (groupRef.current) {
      const bob = Math.sin(state.clock.elapsedTime * 2 + timeOffset.current) * 0.05
      groupRef.current.position.y = bob
    }
  })

  return (
    <group 
      ref={groupRef}
      position={config.position as [number, number, number]} 
      rotation={config.rotation as [number, number, number]}
    >
      {config.type === 'businessman' && <Businessman1940s era={era} />}
      {config.type === 'woman' && <Woman1940s era={era} />}
      {config.type === 'worker' && <Worker1940s era={era} />}
      {config.type === 'mod-dress' && <ModDress1960s era={era} />}
      {config.type === 'hippie' && <Hippie1960s era={era} />}
      {config.type === 'business' && <Business1960s era={era} />}
      {config.type === 'yuppie' && <Yuppie1980s era={era} />}
      {config.type === 'punk' && <Punk1980s era={era} />}
      {config.type === 'casual' && <Casual1980s era={era} />}
      {config.type === 'athletic' && <Athletic2000s era={era} />}
      {config.type === 'modern' && <Modern2020s era={era} />}
      {config.type === 'smart' && <Smart2020s era={era} />}
      {config.type === 'tech' && <Tech2020s era={era} />}
      {config.type === 'future' && <Future2020s era={era} />}
      {config.type === 'cyborg' && <Cyborg2050s era={era} />}
      {config.type === 'android' && <Android2050s era={era} />}
    </group>
  )
}

// 1940s clothing styles
function Businessman1940s({ era }: { era: Era }) {
  return (
    <group>
      {/* Head */}
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      {/* Body - Suit */}
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[0.8, 1.2, 0.5]} />
        <meshStandardMaterial color="#000080" />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.2, 0.5, 0]}>
        <boxGeometry args={[0.3, 0.8, 0.4]} />
        <meshStandardMaterial color="#000033" />
      </mesh>
      <mesh position={[0.2, 0.5, 0]}>
        <boxGeometry args={[0.3, 0.8, 0.4]} />
        <meshStandardMaterial color="#000033" />
      </mesh>
    </group>
  )
}

function Woman1940s({ era }: { era: Era }) {
  return (
    <group>
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#654321" />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[0.7, 1, 0.4]} />
        <meshStandardMaterial color="#8B0000" />
      </mesh>
      <mesh position={[0, 0.9, 0.5]}>
        <planeGeometry args={[0.6, 0.8]} />
        <meshStandardMaterial color="#FFFFFF" opacity={0.7} transparent />
      </mesh>
    </group>
  )
}

function Worker1940s({ era }: { era: Era }) {
  return (
    <group>
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.8, 1.1, 0.5]} />
        <meshStandardMaterial color="#362317" />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.4, 0.6, 0.6]} />
        <meshStandardMaterial color="#FFD700" />
      </mesh>
    </group>
  )
}

// 1960s styles
function ModDress1960s({ era }: { era: Era }) {
  return (
    <group>
      <mesh position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[0.7, 0.9, 0.4]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <planeGeometry args={[0.6, 1.2]} />
        <meshStandardMaterial color="#FF69B4" opacity={0.5} transparent />
      </mesh>
    </group>
  )
}

function Hippie1960s({ era }: { era: Era }) {
  return (
    <group>
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.19, 16, 16]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[0.8, 1, 0.4]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.6]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
    </group>
  )
}

function Business1960s({ era }: { era: Era }) {
  return (
    <group>
      <Businessman1940s era={era} />
    </group>
  )
}

// 1980s styles
function Yuppie1980s({ era }: { era: Era }) {
  return (
    <group>
      <mesh position={[0, 1.63, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[0.75, 1, 0.4]} />
        <meshStandardMaterial color="#0000FF" />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.4, 0.6, 0.5]} />
        <meshStandardMaterial color="#000080" />
      </mesh>
    </group>
  )
}

function Punk1980s({ era }: { era: Era }) {
  return (
    <group>
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#FF0000" />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[0.7, 0.9, 0.4]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
    </group>
  )
}

function Casual1980s({ era }: { era: Era }) {
  return (
    <group>
      <mesh position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[0.75, 1, 0.45]} />
        <meshStandardMaterial color="#FF4500" />
      </mesh>
    </group>
  )
}

// 2000s styles
function Athletic2000s({ era }: { era: Era }) {
  return (
    <group>
      <mesh position={[0, 1.7, 0]}>
        <sphereGeometry args={[0.19, 16, 16]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[0.8, 1, 0.4]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.8]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
    </group>
  )
}

// 2020s styles
function Modern2020s({ era }: { era: Era }) {
  return (
    <group>
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[0.75, 1, 0.45]} />
        <meshStandardMaterial color="#2D3748" />
      </mesh>
    </group>
  )
}

function Smart2020s({ era }: { era: Era }) {
  return (
    <group>
      <mesh position={[0, 1.63, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[0.7, 0.9, 0.4]} />
        <meshStandardMaterial color="#4A5568" />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshStandardMaterial color="#4FD1C5" emissive="#4FD1C5" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

function Tech2020s({ era }: { era: Era }) {
  return (
    <group>
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[0.75, 1, 0.45]} />
        <meshStandardMaterial color="#4FD1C5" emissive="#4FD1C5" emissiveIntensity={0.2} />
      </mesh>
    </group>
  )
}

// 2050s futuristic styles
function Future2020s({ era }: { era: Era }) {
  return (
    <group>
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[0.7, 1, 0.4]} />
        <meshStandardMaterial color="#00BFFF" emissive="#00BFFF" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

function Cyborg2050s({ era }: { era: Era }) {
  return (
    <group>
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0, 1.65, 0.2]}>
        <boxGeometry args={[0.15, 0.05, 0.1]} />
        <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[0.75, 1, 0.45]} />
        <meshStandardMaterial color="#2D3748" />
      </mesh>
    </group>
  )
}

function Android2050s({ era }: { era: Era }) {
  return (
    <group>
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[0.7, 1.1, 0.45]} />
        <meshStandardMaterial color="#E2E8F0" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  )
}