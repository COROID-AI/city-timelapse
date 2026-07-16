import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Building } from './Building'
import { Vehicle } from './Vehicle'
import { Pedestrian } from './Pedestrian'
import { Storefront } from './Storefront'
import { Road } from './Road'
import { EnvironmentDetails } from './EnvironmentDetails'
import useStore from '../stores/timelineStore'
import { ERA_CONFIGS, Era } from '../stores/types'

export function CityScene() {
  const groupRef = useRef<THREE.Group>(null!)
  const { currentEra, targetEra, isTransitioning, transitionProgress } = useStore()

  const buildings = useMemo(() => {
    const buildingPositions: [number, number, number][] = []
    const rows = 2
    const cols = 4
    const spacing = 15

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = (col - cols / 2 + 0.5) * spacing
        const z = (row - rows / 2 + 0.5) * spacing
        buildingPositions.push([x, 0, z])
      }
    }
    return buildingPositions
  }, [])

  const vehicles = useMemo(() => {
    return [
      [-20, 0.5, 0],
      [-10, 0.5, 5],
      [0, 0.5, -5],
      [10, 0.5, 3],
      [20, 0.5, -3],
      [-15, 0.5, -10],
      [15, 0.5, 10]
    ]
  }, [])

  const pedestrians = useMemo(() => {
    const positions: [number, number, number][] = []
    for (let i = 0; i < 12; i++) {
      positions.push([
        (Math.random() - 0.5) * 50,
        0,
        (Math.random() - 0.5) * 50
      ])
    }
    return positions
  }, [])

  const storefronts = useMemo(() => {
    return [
      [-7.5, 0, 0],
      [7.5, 0, 0]
    ]
  }, [])

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Gentle rotation for ambient life
      groupRef.current.rotation.y += delta * 0.01
    }
  })

  return (
    <group ref={groupRef}>
      {/* Ground with grid */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial 
          color="#1a1a2e" 
          metalness={0.8} 
          roughness={0.2}
          onBeforeCompile={(shader) => {
            shader.uniforms.gridSize = { value: 100 }
          }}
        />
      </mesh>

      {/* Road network */}
      <Road positions={[[0, 0.01, 0], [0, 0.01, 20], [0, 0.01, -20]]} />

      {/* Buildings */}
      {buildings.map((pos, i) => (
        <Building 
          key={`building-${i}`}
          position={pos}
          currentEra={currentEra}
          targetEra={targetEra}
          transitionProgress={transitionProgress}
          isTransitioning={isTransitioning}
        />
      ))}

      {/* Vehicles */}
      {vehicles.map((pos, i) => (
        <Vehicle 
          key={`vehicle-${i}`}
          position={pos}
          currentEra={currentEra}
          targetEra={targetEra}
          transitionProgress={transitionProgress}
          isTransitioning={isTransitioning}
        />
      ))}

      {/* Pedestrians */}
      {pedestrians.map((pos, i) => (
        <Pedestrian 
          key={`pedestrian-${i}`}
          position={pos}
          currentEra={currentEra}
        />
      ))}

      {/* Storefronts */}
      {storefronts.map((pos, i) => (
        <Storefront 
          key={`storefront-${i}`}
          position={pos}
          currentEra={currentEra}
          targetEra={targetEra}
          transitionProgress={transitionProgress}
          isTransitioning={isTransitioning}
        />
      ))}

      {/* Environment details (street lights, benches, trees) */}
      <EnvironmentDetails currentEra={currentEra} />
    </group>
  )
}