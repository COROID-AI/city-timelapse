import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, Sky, Stars } from '@react-three/drei'
import { useRef, useMemo, useEffect, useState } from 'react'
import { Group, Vector3, Color } from 'three'
import { EraTimeline, Era } from '../types/era'
import { Building } from './entities/Building'
import { VehicleManager } from './entities/VehicleManager'
import { PedestrianManager } from './entities/PedestrianManager'
import { AdvertisementManager } from './entities/AdvertisementManager'
import { StorefrontManager } from './entities/StorefrontManager'
import { useEraTransition } from '../hooks/useEraTransition'

interface CitySceneProps {
  timeline: EraTimeline
}

export function CityScene({ timeline }: CitySceneProps) {
  const { camera } = useThree()
  const sceneRef = useRef<Group>(null)
  const controlsRef = useRef<any>(null)
  const [isMounted, setIsMounted] = useState(false)

  // Apply era transitions
  const transition = useEraTransition(timeline)

  // Set initial camera position with bounds
  useEffect(() => {
    setIsMounted(true)
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    }
  }, [])

  // Camera bounds for orbit controls
  useFrame(() => {
    if (controlsRef.current) {
      // Limit camera distance
      const distance = camera.position.distanceTo(new Vector3(0, 0, 0))
      const minDistance = 30
      const maxDistance = 200

      if (distance < minDistance) {
        camera.position.setLength(minDistance)
      } else if (distance > maxDistance) {
        camera.position.setLength(maxDistance)
      }
    }
  })

  // Grid layout for city block (4x4 buildings)
  const buildingPositions = useMemo(() => {
    const positions: [number, number, number][] = []
    const size = 30
    for (let x = -1.5; x <= 1.5; x += 1) {
      for (let z = -1.5; z <= 1.5; z += 1) {
        positions.push([x * size, 0, z * size])
      }
    }
    return positions
  }, [])

  return (
    <>
      <group ref={sceneRef}>
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[100, 100, 50]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={500}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
        />

        {/* Environment */}
        <Environment preset="city" background={false} />
        <Sky
          distance={4000}
          sunPosition={[100, 100, 50]}
          turbidity={transition.weather === 'hazy' ? 10 : 5}
          rayleigh={transition.weather === 'hazy' ? 2 : 1}
        />

        {/* Stars for futuristic era */}
        {timeline.year === 2055 && (
          <Stars
            radius={100}
            depth={50}
            count={5000}
            saturation={0}
            fade
            speed={1}
          />
        )}

        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color={new Color(0x1a1a1a)} />
        </mesh>

        {/* Roads */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <planeGeometry args={[200, 12]} />
          <meshStandardMaterial color="#222222" />
        </mesh>

        {/* Buildings */}
        {buildingPositions.map((pos, i) => (
          <Building
            key={i}
            position={pos}
            transition={transition}
            index={i}
          />
        ))}

        {/* Vehicles */}
        <VehicleManager transition={transition} />

        {/* Pedestrians */}
        <PedestrianManager transition={transition} />

        {/* Advertisements */}
        <AdvertisementManager transition={transition} />

        {/* Storefronts */}
        <StorefrontManager transition={transition} />
      </group>

      {/* Orbit Controls with bounds and smooth damping */}
      {isMounted && (
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          minDistance={30}
          maxDistance={200}
          maxPolarAngle={Math.PI / 2.5}
          enableZoom={true}
          enablePan={false}
        />
      )}
    </>
  )
}