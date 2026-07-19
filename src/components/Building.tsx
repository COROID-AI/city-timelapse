import React, { useRef, useEffect, useMemo } from 'react'
import { gsap } from 'gsap'

interface BuildingProps {
  position: [number, number, number]
  era: number
  index: number
}

interface BuildingStyle {
  height: number
  width: number
  depth: number
  color: string
  windowColor: string
  windowPattern: 'grid' | 'large' | 'small'
}

export const Building: React.FC<BuildingProps> = ({ position, era, index }) => {
  const groupRef = useRef<any>(null!)
  const mainMeshRef = useRef<any>(null!)
  
  // Get building style based on era
  const buildingStyle = useMemo(() => getBuildingStyle(era, index), [era, index])

  // Animate on era change
  useEffect(() => {
    if (mainMeshRef.current) {
      gsap.to(mainMeshRef.current.scale, {
        y: buildingStyle.height / 5,
        duration: 1.5,
        ease: 'power2.inOut',
      })
    }
  }, [era, buildingStyle])

  // Generate windows based on pattern
  const windows = useMemo(() => {
    const count = buildingStyle.windowPattern === 'small' ? 24 :
                  buildingStyle.windowPattern === 'large' ? 8 : 16
    
    const windowElements = []
    const rows = Math.ceil(count / 4)
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 4; col++) {
        if (windowElements.length >= count) break
        
        const windowSize = buildingStyle.windowPattern === 'large' ? 1.5 : 0.8
        const yPos = 2 + row * 3
        
        windowElements.push(
          <mesh
            key={`window-${row}-${col}`}
            position={[
              -2 + col * 1.5,
              yPos,
              2.1
            ]}
          >
            <planeGeometry args={[windowSize, windowSize]} />
            <meshBasicMaterial color={buildingStyle.windowColor} />
          </mesh>
        )
      }
    }
    
    return windowElements
  }, [buildingStyle])

  return (
    <group ref={groupRef} position={position}>
      {/* Building main structure */}
      <mesh ref={mainMeshRef} castShadow receiveShadow>
        <boxGeometry args={[buildingStyle.width, buildingStyle.height, buildingStyle.depth]} />
        <meshStandardMaterial 
          color={buildingStyle.color}
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>
      
      {/* Windows */}
      {windows}
    </group>
  )
}

function getBuildingStyle(era: number, index: number): BuildingStyle {
  const variation = (index % 4) * 0.3 + 1 // Different variations

  if (era <= 1945) {
    return {
      height: 8 * variation,
      width: 4,
      depth: 4,
      color: '#8B4513',
      windowColor: '#DAA520',
      windowPattern: 'grid',
    }
  }

  if (era <= 1965) {
    return {
      height: 12 * variation,
      width: 5,
      depth: 5,
      color: '#A9A9A9',
      windowColor: '#87CEEB',
      windowPattern: 'large',
    }
  }

  if (era <= 1985) {
    return {
      height: 16 * variation,
      width: 6,
      depth: 6,
      color: '#C0C0C0',
      windowColor: '#4682B4',
      windowPattern: 'small',
    }
  }

  if (era <= 2005) {
    return {
      height: 20 * variation,
      width: 7,
      depth: 7,
      color: '#4682B4',
      windowColor: '#00BFFF',
      windowPattern: 'grid',
    }
  }

  if (era <= 2025) {
    return {
      height: 22 * variation,
      width: 6,
      depth: 6,
      color: '#2F4F4F',
      windowColor: '#98FB98',
      windowPattern: 'grid',
    }
  }

  // 2055 - Futuristic
  return {
    height: 25 * variation,
    width: 8,
    depth: 8,
    color: '#9370DB',
    windowColor: '#00FFFF',
    windowPattern: 'grid',
  }
}