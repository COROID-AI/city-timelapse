import React, { useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, useProgress, Environment, Html } from '@react-three/drei'
import { EffectComposer, Bloom, Film, Noise, Vignette, Outline } from '@react-three/postprocessing'
import { Vector3 } from 'three'
import { useStore, getEraProgress } from '../lib/store'
import { ERA_CONFIGS, getPalette, getLightingPreset, getSkyConfig, interpolateColor } from '../lib/eraConfig'
import { BuildingArchitecture } from './BuildingArchitecture'
import { Vehicle } from './Vehicle'
import gsap from 'gsap'

// Simple pedestrian component
const Pedestrian = ({ position, color }: { position: Vector3; color: number }) => {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[0.5, 1.8, 0.5]} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
    </mesh>
  )
}

// Scene component
export const Scene = () => {
  const { currentEra, targetEra, isTransitioning, transitionProgress, setTransitioning, setTransitionProgress, setCurrentEra, loading } = useStore()

  // Update loading progress
  const progress = useProgress()
  useEffect(() => {
    useStore.setState({ loading: { ...loading, progress: progress.progress } })
  }, [progress.progress])

  // Handle era transition
  useFrame((state, delta) => {
    if (isTransitioning) {
      const newProgress = Math.min(transitionProgress + delta * 0.5, 1)
      setTransitionProgress(newProgress)
      if (newProgress >= 1) {
        setCurrentEra(targetEra)
        setTransitioning(false)
        setTransitionProgress(0)
      }
    }
  })

  const era = getEraProgress(currentEra, targetEra, transitionProgress)
  const config = ERA_CONFIGS[era as keyof typeof ERA_CONFIGS]

  const palette = getPalette(era as any)
  const lighting = getLightingPreset(era as any)
  const sky = getSkyConfig(era as any)

  // Generate a simple city grid
  const buildings = Array.from({ length: 20 }, (_, i) => {
    const x = (i % 5 - 2) * 12
    const z = Math.floor(i / 5) * 12
    const height = Math.random() * 20 + 5
    const color = interpolateColor(palette.buildings[0], palette.buildings[1], Math.random())
    return {
      id: i,
      position: new Vector3(x, height / 2, z),
      size: { width: 10, height, depth: 10 },
      style: config.buildingStyle
    }
  })

  // Vehicles
  const vehicles = Array.from({ length: 10 }, (_, i) => {
    const x = (Math.random() * 4 - 2) * 12
    const z = (Math.random() * 4 - 2) * 12
    const y = 0.5
    const color = interpolateColor(palette.vehicles[0], palette.vehicles[1], Math.random())
    return {
      id: i,
      position: new Vector3(x, y, z),
      era,
      vehicleType: config.vehicleType as any
    }
  })

  // Pedestrians
  const pedestrians = Array.from({ length: 15 }, (_, i) => {
    const x = (Math.random() * 4 - 2) * 12
    const z = (Math.random() * 4 - 2) * 12
    const y = 0.9
    const color = interpolateColor(palette.clothing[0], palette.clothing[1], Math.random())
    return { id: i, position: new Vector3(x, y, z), color }
  })

  // Post-processing effects based on era
  const postEffects = () => {
    const passes: JSX.Element[] = []
    if (config.postProcessing === 'film_grain') {
      passes.push(<Film key="film" />)
    }
    if (config.postProcessing === 'bloom') {
      passes.push(<Bloom key="bloom" luminanceThreshold={0.3} luminanceSmoothing={0.9} intensity={1.5} />)
    }
    if (config.postProcessing === 'color_correction') {
      passes.push(<Vignette key="vignette" offset={0.4} darkness={0.5} />)
    }
    if (config.postProcessing === 'ambient_occlusion') {
      passes.push(<Outline key="outline" visibleEdgeColor="#00d4ff" hiddenEdgeColor="#000" thickness={0.01} />)
    }
    if (config.postProcessing === 'cyberpunk') {
      passes.push(<Noise key="noise" opacity={0.02} />)
    }
    return passes
  }

  return (
    <>
      <ambientLight intensity={lighting.ambient.intensity} color={lighting.ambient.color} />
      <directionalLight intensity={lighting.sun.intensity} position={lighting.sun.position as any} castShadow />
      <hemisphereLight intensity={lighting.hemisphere.intensity} skyColor={lighting.hemisphere.skyColor} groundColor={lighting.hemisphere.groundColor} />
      <Environment preset="city" background={false} />
      {buildings.map(b => (
        <BuildingArchitecture key={b.id} position={b.position} size={b.size} era={era} buildingType={b.style as any} />
      ))}
      {vehicles.map(v => (
        <Vehicle key={v.id} position={v.position} era={v.era} vehicleType={v.vehicleType} />
      ))}
      {pedestrians.map(p => (
        <Pedestrian key={p.id} position={p.position} color={p.color} />
      ))}
      <OrbitControls enablePan enableZoom enableRotate dampingFactor={0.1} />
      <EffectComposer>
        {postEffects()}
      </EffectComposer>
      <Html>
        <div style={{ position: 'absolute', bottom: 20, left: 20, color: '#fff', fontSize: '12px' }}>
          Era: {era}
        </div>
      </Html>
    </>
  )
}