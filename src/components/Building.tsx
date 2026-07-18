import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Color } from 'three'
import { lerpHex } from '../utils/color'

type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

interface BuildingProps {
  position: [number, number, number]
  width: number
  height: number
  depth: number
  type: number
  eraA: Era
  eraB: Era
  blendT: number
}

export function Building({ position, width, height, depth, type, eraA, eraB, blendT }: BuildingProps) {
  const groupRef = useRef<Group>(null)
  
  const buildingColor = useMemo(() => {
    const colors: Record<Era, string[]> = {
      '1945': ['#8B4513', '#A0522D', '#CD853F', '#D2691E'],
      '1965': ['#4682B4', '#5F9EA0', '#708090', '#778899'],
      '1985': ['#2F4F4F', '#696969', '#708090', '#778899'],
      '2005': ['#808080', '#A9A9A9', '#696969', '#B0B0B0'],
      '2025': ['#C0C0C0', '#D3D3D3', '#A9A9A9', '#E0E0E0'],
      '2055': ['#00FFFF', '#40E0D0', '#48D1CC', '#20B2AA'],
    }
    return lerpHex(colors[eraA][type % 4], colors[eraB][type % 4], blendT)
  }, [eraA, eraB, blendT, type])

  const windowColor = useMemo(() => {
    const colors: Record<Era, string> = {
      '1945': '#FFFACD',
      '1965': '#87CEEB',
      '1985': '#00CED1',
      '2005': '#00BFFF',
      '2025': '#87CEFA',
      '2055': '#00FFFF',
    }
    return lerpHex(colors[eraA], colors[eraB], blendT)
  }, [eraA, eraB, blendT])

  useFrame(() => {
    // Very subtle breathing so the scene feels alive.
    if (groupRef.current) {
      const s = 0.99 + Math.sin(Date.now() / 1000) * 0.001
      groupRef.current.scale.setScalar(s)
    }
  })

  const windowRows = Math.floor(height / 3)
  const windowCols = Math.floor(width / 2)

  return (
    <group ref={groupRef} position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial 
          color={buildingColor} 
          metalness={era === '2055' ? 0.8 : 0.4} 
          roughness={era === '2055' ? 0.2 : 0.6}
          emissive={era === '2055' ? buildingColor : undefined}
          emissiveIntensity={era === '2055' ? 0.3 : undefined}
        />
      </mesh>
      
      {Array.from({ length: windowRows }).map((_, row) => 
        Array.from({ length: windowCols }).map((_, col) => {
          const x = -width/2 + 1 + col * (width / (windowCols - 1 || 1))
          const y = height/2 - 1 - row * (height / (windowRows - 1 || 1))
          const z = depth/2 + 0.01
          
          const intensityA = eraA === '2055' ? 0.5 : eraA === '2025' ? 0.3 : eraA === '1985' ? 0.2 : 0.1
          const intensityB = eraB === '2055' ? 0.5 : eraB === '2025' ? 0.3 : eraB === '1985' ? 0.2 : 0.1
          const lightIntensity = intensityA + (intensityB - intensityA) * blendT
          
          return (
            <group key={`${row}-${col}`}>
              <mesh position={[x, y, z]}>
                <planeGeometry args={[1.5, 2]} />
                <meshStandardMaterial 
                  color={windowColor}
                  opacity={0.7}
                  transparent
                  emissive={windowColor}
                  emissiveIntensity={lightIntensity}
                />
              </mesh>
              {((row * 31 + col * 17 + type * 7) % 10) < 5 && (
                <pointLight
                  position={[x, y, z + 0.5]}
                  intensity={lightIntensity * 0.2}
                  color={windowColor}
                  distance={5}
                />
              )}
            </group>
          )
        })
      )}
      
      {((type * 9 + Math.floor(width) + Math.floor(depth)) % 10) < 6 && (eraA !== '1945') && (
        <StreetLight 
          position={[-width/2 - 0.5, 0, depth/2]} 
          eraA={eraA}
          eraB={eraB}
          blendT={blendT}
          height={height}
        />
      )}
    </group>
  )
}

function StreetLight({
  position,
  eraA,
  eraB,
  blendT,
  height,
}: {
  position: [number, number, number]
  eraA: Era
  eraB: Era
  blendT: number
  height: number
}) {
  const lightColor = lerpHex(
    eraA === '1945' || eraA === '1965' ? '#FFA500' : '#FFFF00',
    eraB === '1945' || eraB === '1965' ? '#FFA500' : '#FFFF00',
    blendT
  )

  const emissiveIntensity = (eraA === '2055' ? 1 : 0.5) + ((eraB === '2055' ? 1 : 0.5) - (eraA === '2055' ? 1 : 0.5)) * blendT
  
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.1, 0.1, height * 0.8, 8]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0, height * 0.4, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial 
          color={lightColor}
          emissive={lightColor}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
      <pointLight
        position={[0, height * 0.35, 0]}
        intensity={(eraA === '2055' ? 0.8 : 0.4) + ((eraB === '2055' ? 0.8 : 0.4) - (eraA === '2055' ? 0.8 : 0.4)) * blendT}
        color={lightColor}
        distance={20}
        castShadow
      />
    </group>
  )
}