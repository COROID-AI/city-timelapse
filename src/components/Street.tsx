import { useMemo } from 'react'
import type { Era } from '../types/era'

interface StreetProps {
  era: Era
}

export function Street({ era }: StreetProps) {
  // Road markings
  const roadLines = useMemo(() => {
    const lines = []
    for (let i = -20; i < 20; i += 2) {
      lines.push(
        <mesh key={`centerline-${i}`} position={[i, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial color={era === '2055' ? '#00E5FF' : '#fff'} />
        </mesh>,
        <mesh key={`side1-${i}`} position={[i, 0.01, -15]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial color={era === '2055' ? '#00E5FF' : '#fff'} />
        </mesh>,
        <mesh key={`side2-${i}`} position={[i, 0.01, 15]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial color={era === '2055' ? '#00E5FF' : '#fff'} />
        </mesh>
      )
    }
    return lines
  }, [era])

  // Street lights
  const streetLights = useMemo(() => {
    const lights = []
    for (let i = -15; i <= 15; i += 5) {
      lights.push(
        <group key={`light-${i}`} position={[i, 0, -16]}>
          <mesh position={[0, 5, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 5]} />
            <meshStandardMaterial color="#555" />
          </mesh>
          <mesh position={[0, 9.8, 0]}>
            {era === '2055' ? (
              <sphereGeometry args={[0.3, 16, 16]} />
            ) : (
              <boxGeometry args={[0.5, 0.2, 0.1]} />
            )}
            <meshStandardMaterial
              color={era === '2055' ? '#00E5FF' : '#fff'}
              emissive={era === '2055' ? '#00E5FF' : '#fff'}
              emissiveIntensity={era === '2055' ? 1 : 0.5}
            />
          </mesh>
        </group>,
        <group key={`light-r-${i}`} position={[i, 0, 16]}>
          <mesh position={[0, 5, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 5]} />
            <meshStandardMaterial color="#555" />
          </mesh>
          <mesh position={[0, 9.8, 0]}>
            {era === '2055' ? (
              <sphereGeometry args={[0.3, 16, 16]} />
            ) : (
              <boxGeometry args={[0.5, 0.2, 0.1]} />
            )}
            <meshStandardMaterial
              color={era === '2055' ? '#00E5FF' : '#fff'}
              emissive={era === '2055' ? '#00E5FF' : '#fff'}
              emissiveIntensity={era === '2055' ? 1 : 0.5}
            />
          </mesh>
        </group>
      )
    }
    return lights
  }, [era])

  // Sidewalk
  const sidewalkColor = era === '2055' ? '#1a1a2e' : '#333'

  return (
    <group>
      {/* Main road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[25, 30]} />
        <meshStandardMaterial color="#222" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Sidewalks */}
      <mesh position={[-12.5, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2, 25]} />
        <meshStandardMaterial color={sidewalkColor} roughness={0.9} />
      </mesh>
      <mesh position={[12.5, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2, 25]} />
        <meshStandardMaterial color={sidewalkColor} roughness={0.9} />
      </mesh>

      {/* Road lines */}
      {roadLines}

      {/* Street lights */}
      {streetLights}
    </group>
  )
}