import React, { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, ContactShadows } from '@react-three/drei'
import { gsap } from 'gsap'
import * as THREE from 'three'
import type { Era } from '../App'
import { BuildingBlock } from './BuildingBlock'
import { Street } from './Street'
import { Sky } from './Sky'
import { Vehicles } from './Vehicles'
import { Pedestrians } from './Pedestrians'
import { Storefronts } from './Storefronts'

interface CitySceneProps {
  era: Era
}

export const CityScene: React.FC<CitySceneProps> = ({ era }) => {
  const groupRef = useRef<THREE.Group>(null!)
  const prevEraRef = useRef<Era>(era)

  // Era-specific lighting and postprocessing settings
  const eraSettings = useMemo(() => {
    return {
      1945: {
        skyColor: '#87ceeb',
        fogColor: '#a0a0a0',
        fogNear: 50,
        fogFar: 200,
        ambientIntensity: 0.6,
        directionalIntensity: 1,
        postprocessing: { saturation: 0.8, brightness: 0, contrast: 1 },
      },
      1965: {
        skyColor: '#6fb3d2',
        fogColor: '#808080',
        fogNear: 60,
        fogFar: 250,
        ambientIntensity: 0.7,
        directionalIntensity: 1.2,
        postprocessing: { saturation: 1, brightness: 0.1, contrast: 1.1 },
      },
      1985: {
        skyColor: '#000080',
        fogColor: '#202040',
        fogNear: 80,
        fogFar: 300,
        ambientIntensity: 0.4,
        directionalIntensity: 0.8,
        postprocessing: { saturation: 1.5, brightness: 0.2, contrast: 1.2 },
      },
      2005: {
        skyColor: '#4682b4',
        fogColor: '#505060',
        fogNear: 100,
        fogFar: 350,
        ambientIntensity: 0.8,
        directionalIntensity: 1.5,
        postprocessing: { saturation: 1.2, brightness: 0.05, contrast: 1 },
      },
      2025: {
        skyColor: '#87cefa',
        fogColor: '#e0e0e0',
        fogNear: 120,
        fogFar: 400,
        ambientIntensity: 0.9,
        directionalIntensity: 1.8,
        postprocessing: { saturation: 1.1, brightness: 0.1, contrast: 1 },
      },
      2055: {
        skyColor: '#000030',
        fogColor: '#101020',
        fogNear: 150,
        fogFar: 500,
        ambientIntensity: 0.3,
        directionalIntensity: 2,
        postprocessing: { saturation: 1.3, brightness: -0.1, contrast: 1.3 },
      },
    }[era]
  }, [era])

  // Smooth transition animation when era changes
  useEffect(() => {
    if (prevEraRef.current !== era) {
      const tl = gsap.timeline()

      if (groupRef.current) {
        tl.to(
          groupRef.current.rotation,
          {
            y: groupRef.current.rotation.y + (Math.random() - 0.5) * 0.1,
            duration: 2,
            ease: 'power2.inOut',
          },
          0
        )
      }
    }
    prevEraRef.current = era
  }, [era])

  // Generate city grid
  const buildings = useMemo(() => {
    const grid: JSX.Element[] = []
    const blockSize = 40

    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        const key = `building-${x}-${z}`
        grid.push(
          <BuildingBlock
            key={key}
            position={[x * blockSize, 0, z * blockSize]}
            era={era}
          />
        )
      }
    }

    return grid
  }, [era])

  return (
    <>
      <group ref={groupRef}>
        <Sky era={era} />

        <Environment
          preset={era === 2055 ? 'night' : 'city'}
          background
          blur={0}
        />

        <fog
          attach="fog"
          args={[eraSettings.fogColor, eraSettings.fogNear, eraSettings.fogFar]}
        />

        <ambientLight intensity={eraSettings.ambientIntensity} />
        <directionalLight
          position={[100, 100, 50]}
          intensity={eraSettings.directionalIntensity}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        {/* Street and ground */}
        <Street era={era} />

        {/* Storefronts on street */}
        <Storefronts era={era} />

        {/* Vehicles */}
        <Vehicles era={era} />

        {/* Pedestrians */}
        <Pedestrians era={era} />

        {/* Buildings */}
        {buildings}

        {/* Ground plane */}
        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[300, 300]} />
          <meshStandardMaterial color="#333" roughness={0.9} />
        </mesh>

        {/* Contact shadows for visual depth */}
        <ContactShadows
          position={[0, -0.49, 0]}
          opacity={0.3}
          scale={100}
          blur={2}
          far={50}
        />
      </group>
    </>
  )
}