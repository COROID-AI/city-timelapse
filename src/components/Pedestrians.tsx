import { useMemo } from 'react'
import { Era } from '@/App'
import * as THREE from 'three'

function getPedestrianStyle(era: Era) {
  switch (era) {
    case '1945':
      return { body: '#8B4513', head: '#FFDAB9', height: 1.7, speed: 0.02 }
    case '1965':
      return { body: '#556B2F', head: '#FFDAB9', height: 1.75, speed: 0.025 }
    case '1985':
      return { body: '#2C3E50', head: '#FFDAB9', height: 1.8, speed: 0.03 }
    case '2005':
      return { body: '#34495E', head: '#FFDAB9', height: 1.8, speed: 0.03 }
    case '2025':
      return { body: '#7F8C8D', head: '#FFDAB9', height: 1.8, speed: 0.035 }
    case '2055':
      return { body: '#00FFFF', head: '#FFDAB9', height: 1.85, speed: 0.04 }
  }
}

function Pedestrian({ position, era, targetEra, transitionProgress }: {
  position: [number, number, number]
  era: Era
  targetEra: Era
  transitionProgress: number
}) {
  const style = getPedestrianStyle(era)
  const targetStyle = getPedestrianStyle(targetEra)
  
  const bodyColor = useMemo(() => 
    new THREE.Color().lerpColors(new THREE.Color(style.body), new THREE.Color(targetStyle.body), transitionProgress),
  [style, targetStyle, transitionProgress])
  
  const height = THREE.MathUtils.lerp(style.height, targetStyle.height, transitionProgress)
  const speed = THREE.MathUtils.lerp(style.speed, targetStyle.speed, transitionProgress)

  // Walking animation
  const walkCycle = useMemo(() => Date.now() * 0.01 * speed * 100, [])

  return (
    <group position={position}>
      {/* Body */}
      <mesh castShadow receiveShadow>
        <capsuleGeometry args={[0.3, height * 0.5, 8, 16]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      
      {/* Head */}
      <mesh position={[0, height * 0.5 + 0.2, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color={style.head} />
      </mesh>
      
      {/* Arms - animated */}
      {[-0.4, 0.4].map((x, i) => (
        <mesh 
          key={i}
          position={[x, height * 0.3, 0]}
          rotation={[Math.sin(walkCycle + i * Math.PI) * 0.5, 0, 0]}
        >
          <capsuleGeometry args={[0.1, height * 0.3, 4, 8]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
      ))}
      
      {/* Legs - animated */}
      {[-0.15, 0.15].map((x, i) => (
        <mesh 
          key={i}
          position={[x, height * 0.1, 0]}
          rotation={[Math.sin(walkCycle + i * Math.PI) * 0.5, 0, 0]}
        >
          <capsuleGeometry args={[0.12, height * 0.4, 4, 8]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
      ))}
    </group>
  )
}

function generatePedestrians() {
  const pedestrians: Array<{position: [number, number, number]}> = []
  
  // Pedestrians walking around
  for (let i = 0; i < 20; i++) {
    pedestrians.push({ 
      position: [(Math.random() - 0.5) * 80, 0, (Math.random() - 0.5) * 80] 
    })
  }
  
  // Pedestrians in park
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2
    const radius = 10 + Math.random() * 15
    pedestrians.push({ 
      position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] 
    })
  }
  
  return pedestrians
}

export function Pedestrians({ 
  era, 
  targetEra, 
  transitionProgress 
}: {
  era: Era
  targetEra: Era
  transitionProgress: number
}) {
  const pedestrians = useMemo(() => generatePedestrians(), [])

  return (
    <group>
      {pedestrians.map((ped, i) => (
        <Pedestrian
          key={i}
          position={ped.position}
          era={era}
          targetEra={targetEra}
          transitionProgress={transitionProgress}
        />
      ))}
    </group>
  )
}