import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Html, useProgress } from '@react-three/drei'
import { Leva } from 'leva'
import * as THREE from 'three'
import { BuildingSet } from '@/components/BuildingSet'
import { VehicleSet } from '@/components/VehicleSet'
import { StreetFurniture } from '@/components/StreetFurniture'
import { Pedestrians } from '@/components/Pedestrians'
import { SkyEffects } from '@/components/SkyEffects'
import { EraTimeline } from '@/components/EraTimeline'
import { useEraAudio } from '@/hooks/useEraAudio'

export type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

const ERA_ORDER: Era[] = ['1945', '1965', '1985', '2005', '2025', '2055']

function Loader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="text-white text-2xl font-bold">
        Loading... {Math.round(progress)}%
      </div>
    </Html>
  )
}

function CityBlock({ currentEra, targetEra, transitionProgress }: { 
  currentEra: Era
  targetEra: Era 
  transitionProgress: number 
}) {
  const groupRef = useRef<THREE.Group>(null!)
  
  // Smooth transition effect
  useFrame(() => {
    if (groupRef.current) {
      // Subtle atmospheric changes
      const time = Date.now() * 0.0001
      groupRef.current.traverse((obj) => {
        if ((obj as any).userData?.isBuilding) {
          obj.rotation.y = Math.sin(time * 0.1) * 0.001
        }
      })
    }
  })

  return (
    <group ref={groupRef}>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial 
          color={new THREE.Color().lerpColors(
            new THREE.Color('#4a5540'),
            new THREE.Color('#3a3f35'),
            ERA_ORDER.indexOf(currentEra as Era) / ERA_ORDER.length
          )} 
        />
      </mesh>

      {/* Central park/civic area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <circleGeometry args={[30, 32]} />
        <meshStandardMaterial 
          color={new THREE.Color().lerpColors(
            new THREE.Color('#2d5016'),
            new THREE.Color('#1a4d2e'),
            ERA_ORDER.indexOf(currentEra as Era) / ERA_ORDER.length
          )} 
          roughness={0.9}
        />
      </mesh>

      {/* Buildings - different eras have different architectural styles */}
      <BuildingSet era={currentEra} targetEra={targetEra} transitionProgress={transitionProgress} />
      
      {/* Street furniture - lampposts, benches, etc */}
      <StreetFurniture era={currentEra} targetEra={targetEra} transitionProgress={transitionProgress} />
      
      {/* Vehicles - cars, buses, etc */}
      <VehicleSet era={currentEra} targetEra={targetEra} transitionProgress={transitionProgress} />
      
      {/* Pedestrians */}
      <Pedestrians era={currentEra} targetEra={targetEra} transitionProgress={transitionProgress} />
      
      {/* Sky and atmospheric effects */}
      <SkyEffects era={targetEra} />
    </group>
  )
}

export default function App() {
  const [currentEra, setCurrentEra] = useState<Era>('1945')
  const [targetEra, setTargetEra] = useState<Era>('1945')
  const [transitionProgress, setTransitionProgress] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEraAudio(currentEra)

  const handleEraChange = useCallback((era: Era) => {
    if (era !== currentEra && !isTransitioning) {
      setTargetEra(era)
      setIsTransitioning(true)
    }
  }, [currentEra, isTransitioning])

  // Handle transition animation
  useEffect(() => {
    if (isTransitioning) {
      const startTime = Date.now()
      const duration = 2000 // 2 seconds for transition
      
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        setTransitionProgress(progress)
        
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setCurrentEra(targetEra)
          setTransitionProgress(0)
          setIsTransitioning(false)
        }
      }
      
      animate()
    }
  }, [isTransitioning, targetEra])

  return (
    <div className="w-full h-full">
      <Leva collapsed={false} />
      
      <Canvas
        shadows
        camera={{ position: [50, 30, 50], fov: 60 }}
        performance={{ min: 0.8, max: 1, current: 1 }}
      >
        <color attach="background" args={['#0a0a1a']} />
        <fog attach="fog" args={['#0a0a1a', 80, 200]} />
        
        <Environment preset="city" background={false} />
        
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[100, 100, 50]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={500}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
        />
        
        <CityBlock 
          currentEra={currentEra} 
          targetEra={targetEra} 
          transitionProgress={transitionProgress} 
        />
        
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={10}
          maxDistance={150}
          target={[0, 10, 0]}
        />
      </Canvas>

      <EraTimeline 
        currentEra={currentEra} 
        onEraChange={handleEraChange} 
      />
    </div>
  )
}