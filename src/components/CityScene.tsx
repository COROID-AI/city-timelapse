import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { BuildingGroup } from './buildings/BuildingGroup'
import { VehicleGroup } from './vehicles/VehicleGroup'
import { PedestrianGroup } from './pedestrians/PedestrianGroup'
import { StorefrontGroup } from './storefronts/StorefrontGroup'
import { PostProcessing } from './PostProcessing'
import { SkyAndEnvironment } from './SkyAndEnvironment'
import { EraType } from '../types/era'

interface CitySceneProps {
  era: number
  targetEra: number | null
  transitionProgress: number
  reducedMotion: boolean
}

export function CityScene({ era, targetEra, transitionProgress, reducedMotion }: CitySceneProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const [currentEraState] = useState<EraType>(era as EraType)
  const nextEraState = targetEra as EraType | null

  // Smooth camera transition based on era
  useFrame((state) => {
    const eraCameraPositions: Record<number, [number, number, number]> = {
      1945: [0, 25, 60] as [number, number, number],
      1965: [0, 22, 55] as [number, number, number],
      1985: [0, 20, 50] as [number, number, number],
      2005: [0, 25, 65] as [number, number, number],
      2025: [0, 24, 62] as [number, number, number],
      2055: [0, 30, 75] as [number, number, number],
    }
    
    const targetPos = eraCameraPositions[era]
    state.camera.position.lerp(
      new THREE.Vector3(...targetPos),
      reducedMotion ? 0.05 : 0.02
    )
  })

  return (
    <>
      <SkyAndEnvironment era={era} />
      
      <group ref={groupRef}>
        {/* Ground plane */}
        <mesh 
          receiveShadow 
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.5, 0]}
        >
          <planeGeometry args={[300, 300]} />
          <meshStandardMaterial 
            color={era === 2055 ? '#2a3a2a' : '#1a1a1a'} 
            roughness={0.9}
          />
        </mesh>

        {/* Road system */}
        <RoadSystem era={era} />

        {/* Buildings with instanced meshes for performance */}
        <BuildingGroup 
          era={currentEraState}
          targetEra={nextEraState}
          transitionProgress={transitionProgress}
        />

        {/* Vehicles */}
        <VehicleGroup 
          era={currentEraState}
          targetEra={nextEraState}
          transitionProgress={transitionProgress}
        />

        {/* Pedestrians */}
        <PedestrianGroup 
          era={currentEraState}
          targetEra={nextEraState}
          transitionProgress={transitionProgress}
        />

        {/* Storefronts and signage */}
        <StorefrontGroup 
          era={currentEraState}
          targetEra={nextEraState}
          transitionProgress={transitionProgress}
        />

        {/* Street elements (lights, benches, etc.) */}
        <StreetElements era={era} />

        {/* Transition overlay for smooth era changes */}
        {nextEraState && (
          <>
            <BuildingGroup 
              era={nextEraState}
              targetEra={nextEraState}
              transitionProgress={1 - transitionProgress}
              isTransition={true}
            />
            <VehicleGroup 
              era={nextEraState}
              targetEra={nextEraState}
              transitionProgress={1 - transitionProgress}
              isTransition={true}
            />
            <PedestrianGroup 
              era={nextEraState}
              targetEra={nextEraState}
              transitionProgress={1 - transitionProgress}
              isTransition={true}
            />
            <StorefrontGroup 
              era={nextEraState}
              targetEra={nextEraState}
              transitionProgress={1 - transitionProgress}
              isTransition={true}
            />
          </>
        )}
      </group>

      <PostProcessing era={era} />
      
      {/* Lighting */}
      <EraLighting era={era} />
    </>
  )
}

function RoadSystem({ era }: { era: number }) {
  const roadColor = era === 2055 ? '#333' : '#222'
  const roadWidth = era === 2055 ? 6 : 8
  
  return (
    <>
      {/* Main roads */}
      {[-80, 0, 80].map((x) => (
        <mesh key={`road-x-${x}`} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[roadWidth, 200]} />
          <meshStandardMaterial color={roadColor} roughness={0.8} />
          <mesh position={[x, 0, 0]}>
            <planeGeometry args={[roadWidth, 200]} />
            <meshStandardMaterial color={roadColor} roughness={0.8} />
          </mesh>
        </mesh>
      ))}
      
      {[-80, 0, 80].map((z) => (
        <mesh key={`road-z-${z}`} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, roadWidth]} />
          <meshStandardMaterial color={roadColor} roughness={0.8} />
          <mesh position={[0, 0, z]}>
            <planeGeometry args={[200, roadWidth]} />
            <meshStandardMaterial color={roadColor} roughness={0.8} />
          </mesh>
        </mesh>
      ))}

      {/* Road markings - era appropriate */}
      {era < 2005 && (
        <RoadMarkings era={era} />
      )}
      
      {/* Future road markings (glowing lines) */}
      {era >= 2055 && (
        <FutureRoadMarkings />
      )}
    </>
  )
}

function RoadMarkings({ era }: { era: number }) {
  const stripeColor = era < 1985 ? '#ffd700' : '#fff'
  
  return (
    <>
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh key={`marking-${i}`} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 4]} />
          <meshStandardMaterial color={stripeColor} emissive={era >= 2005 ? '#fff' : '#000'} emissiveIntensity={0.5} />
          <mesh position={[0, 0.01, -70 + i * 8]} />
        </mesh>
      ))}
    </>
  )
}

function FutureRoadMarkings() {
  return (
    <>
      {Array.from({ length: 30 }).map((_, i) => (
        <mesh key={`future-marking-${i}`} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 3]} />
          <meshBasicMaterial color="#00ffff" opacity={0.7} transparent />
          <mesh position={[0, 0.01, -80 + i * 6]}>
            <planeGeometry args={[0.3, 3]} />
            <meshBasicMaterial color="#00ffff" opacity={0.7} transparent />
          </mesh>
        </mesh>
      ))}
    </>
  )
}

function StreetElements({ era }: { era: number }) {
  const elementCount = 20

  return (
    <>
      {/* Street lights */}
      {Array.from({ length: elementCount }).map((_, i) => (
        <StreetLight 
          key={`light-${i}`} 
          position={[-80 + (i % 5) * 40, 0, -80 + Math.floor(i / 5) * 40] as [number, number, number]} 
          era={era} 
        />
      ))}
      
      {/* Benches and trash cans */}
      {era < 2025 && (
        Array.from({ length: 10 }).map((_, i) => (
          <Bench 
            key={`bench-${i}`} 
            position={[-60 + i * 12, 0, -70]} 
            rotation={[0, i % 2 ? Math.PI : 0, 0]}
          />
        ))
      )}
    </>
  )
}

function StreetLight({ position, era }: { position: [number, number, number], era: number }) {
  const isFutureEra = era >= 2055
  
  return (
    <group position={position}>
      {/* Pole */}
      <mesh castShadow>
        <cylinderGeometry args={[0.2, 0.2, 12]} />
        <meshStandardMaterial color={isFutureEra ? '#4a4a6a' : '#333'} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Light fixture */}
      <mesh position={[0, 11.5, 0]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial 
          color={isFutureEra ? '#00ffff' : '#ffd700'} 
          emissive={isFutureEra ? '#00ffff' : '#ffd700'}
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* Light beam (future era has holograms) */}
      {isFutureEra && (
        <mesh position={[0, 11.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[3, 8, 16]} />
          <meshBasicMaterial color="#00ffff" opacity={0.1} transparent />
        </mesh>
      )}
    </group>
  )
}

function Bench({ position, rotation }: { position: [number, number, number], rotation: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[4, 0.5, 1]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[4, 1.8, 0.3]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
    </group>
  )
}

function EraLighting({ era }: { era: number }) {
  const ambientIntensity = era === 2055 ? 0.4 : 0.6
  const sunPosition: [number, number, number] = [
    era < 1985 ? 50 : 30,
    era < 1985 ? 80 : 100,
    era < 2005 ? 30 : -50
  ] as [number, number, number]
  
  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      <directionalLight
        position={sunPosition}
        intensity={era === 2055 ? 1.2 : 1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      
      {/* Additional futuristic lighting */}
      {era >= 2055 && (
        <>
          <pointLight position={[0, 50, 0]} color="#00ffff" intensity={0.3} />
          <pointLight position={[-50, 50, -50]} color="#ff00ff" intensity={0.2} />
        </>
      )}
    </>
  )
}