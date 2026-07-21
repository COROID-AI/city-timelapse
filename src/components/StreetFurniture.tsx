import { useMemo } from 'react'
import { Era } from '@/App'
import * as THREE from 'three'

function getFurnitureStyle(era: Era) {
  switch (era) {
    case '1945':
      return {
        lamppost: '#8B4513', // Dark brown
        bench: '#8B7355', // Wood
        trash: '#696969', // Metal
        sign: '#FFD700' // Gold
      }
    case '1965':
      return {
        lamppost: '#708090', // Slate gray
        bench: '#556B2F', // Dark olive
        trash: '#808080', // Gray metal
        sign: '#FF4500' // Orange red
      }
    case '1985':
      return {
        lamppost: '#A9A9A9', // Dark gray
        bench: '#4682B4', // Steel blue
        trash: '#C0C0C0', // Silver
        sign: '#00BFFF' // Deep sky blue
      }
    case '2005':
      return {
        lamppost: '#C0C0C0', // Silver
        bench: '#778899', // Light slate
        trash: '#D3D3D3', // Light gray
        sign: '#32CD32' // Lime green
      }
    case '2025':
      return {
        lamppost: '#E0E0E0', // White silver
        bench: '#B0C4DE', // Light steel blue
        trash: '#F5F5F5', // White smoke
        sign: '#FF69B4' // Hot pink
      }
    case '2055':
      return {
        lamppost: '#00FFFF', // Cyan
        bench: '#8A2BE2', // Blue violet
        trash: '#9400D3', // Dark violet
        sign: '#FF1493' // Deep pink
      }
  }
}

function Lamppost({ position, era, targetEra, transitionProgress }: {
  position: [number, number, number]
  era: Era
  targetEra: Era
  transitionProgress: number
}) {
  const style = getFurnitureStyle(era)
  const targetStyle = getFurnitureStyle(targetEra)
  
  const color = useMemo(() => 
    new THREE.Color().lerpColors(new THREE.Color(style.lamppost), new THREE.Color(targetStyle.lamppost), transitionProgress),
  [style, targetStyle, transitionProgress])

  return (
    <group position={position}>
      {/* Pole */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.1, 0.08, 6, 8]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.5} />
      </mesh>
      
      {/* Light fixture */}
      <mesh position={[0, 3.2, 0]} castShadow>
        <boxGeometry args={[0.5, 0.3, 0.5]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Light source */}
      <pointLight position={[0, 3.5, 0]} color={era === '2055' ? '#00FFFF' : '#FFF8DC'} intensity={1} distance={15} decay={2} />
    </group>
  )
}

function Bench({ position, era, targetEra, transitionProgress }: {
  position: [number, number, number]
  era: Era
  targetEra: Era
  transitionProgress: number
}) {
  const style = getFurnitureStyle(era)
  const targetStyle = getFurnitureStyle(targetEra)
  
  const color = useMemo(() => 
    new THREE.Color().lerpColors(new THREE.Color(style.bench), new THREE.Color(targetStyle.bench), transitionProgress),
  [style, targetStyle, transitionProgress])

  return (
    <group position={position}>
      {/* Seat */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2, 0.1, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      
      {/* Backrest */}
      <mesh position={[0, 0.5, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.5, 0.1]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      
      {/* Legs */}
      {[-0.8, 0.8].map((x, i) => (
        <mesh key={i} position={[x, -0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.1, 0.5, 0.1]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      ))}
    </group>
  )
}

function TrashCan({ position, era, targetEra, transitionProgress }: {
  position: [number, number, number]
  era: Era
  targetEra: Era
  transitionProgress: number
}) {
  const style = getFurnitureStyle(era)
  const targetStyle = getFurnitureStyle(targetEra)
  
  const color = useMemo(() => 
    new THREE.Color().lerpColors(new THREE.Color(style.trash), new THREE.Color(targetStyle.trash), transitionProgress),
  [style, targetStyle, transitionProgress])

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.25, 1, 16]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.35, 0.3, 0.1, 16]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  )
}

function StreetSign({ position, era, targetEra, transitionProgress }: {
  position: [number, number, number]
  era: Era
  targetEra: Era
  transitionProgress: number
}) {
  const style = getFurnitureStyle(era)
  const targetStyle = getFurnitureStyle(targetEra)
  
  const color = useMemo(() => 
    new THREE.Color().lerpColors(new THREE.Color(style.sign), new THREE.Color(targetStyle.sign), transitionProgress),
  [style, targetStyle, transitionProgress])

  return (
    <group position={position}>
      {/* Pole */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.05, 0.05, 4, 8]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      
      {/* Sign panel */}
      <mesh position={[0, 2.2, 0]} castShadow>
        <boxGeometry args={[1, 0.6, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={era === '2055' ? 0.5 : 0} />
      </mesh>
    </group>
  )
}

function generateFurniture() {
  const furniture: Array<{type: string, position: [number, number, number]}> = []
  
  // Lampposts along streets
  for (let i = -3; i <= 3; i++) {
    furniture.push({ type: 'lamppost', position: [i * 15, 0, -25] })
    furniture.push({ type: 'lamppost', position: [i * 15, 0, 25] })
    furniture.push({ type: 'lamppost', position: [-25, 0, i * 15] })
    furniture.push({ type: 'lamppost', position: [25, 0, i * 15] })
  }
  
  // Benches in park
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    furniture.push({ 
      type: 'bench', 
      position: [Math.cos(angle) * 15, 0, Math.sin(angle) * 15] 
    })
  }
  
  // Trash cans
  for (let i = 0; i < 12; i++) {
    furniture.push({ 
      type: 'trash', 
      position: [(Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60] 
    })
  }
  
  // Street signs
  furniture.push({ type: 'sign', position: [-30, 0, -30] })
  furniture.push({ type: 'sign', position: [30, 0, -30] })
  furniture.push({ type: 'sign', position: [-30, 0, 30] })
  furniture.push({ type: 'sign', position: [30, 0, 30] })

  return furniture
}

export function StreetFurniture({ 
  era, 
  targetEra, 
  transitionProgress 
}: {
  era: Era
  targetEra: Era
  transitionProgress: number
}) {
  const furniture = useMemo(() => generateFurniture(), [])

  return (
    <group>
      {furniture.map((item, i) => {
        const commonProps = { 
          position: item.position, 
          era, 
          targetEra, 
          transitionProgress 
        }
        
        switch (item.type) {
          case 'lamppost':
            return <Lamppost key={i} {...commonProps} />
          case 'bench':
            return <Bench key={i} {...commonProps} />
          case 'trash':
            return <TrashCan key={i} {...commonProps} />
          case 'sign':
            return <StreetSign key={i} {...commonProps} />
          default:
            return null
        }
      })}
    </group>
  )
}