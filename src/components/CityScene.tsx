import { OrbitControls, Sky, Stars } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
import { Buildings } from './Buildings'
import { Vehicles } from './Vehicles'
import { Pedestrians } from './Pedestrians'
import { Storefronts } from './Storefronts'
import { GroundPlane } from './GroundPlane'
import * as THREE from 'three'
import { EraYear } from '../types'

interface CitySceneProps {
  era: EraYear
  reducedMotion: boolean
}

export function CityScene({ era, reducedMotion }: CitySceneProps) {
  const orbitRef = useRef<any>(null)
  
  // Bounded orbit controls
  const bounds = useMemo(() => ({
    minPolarAngle: 0.2,
    maxPolarAngle: Math.PI / 2 - 0.1,
    minDistance: 20,
    maxDistance: 80,
    minAzimuthAngle: -Math.PI * 0.8,
    maxAzimuthAngle: Math.PI * 0.8,
  }), [])

  return (
    <>
      <OrbitControls
        ref={orbitRef}
        {...bounds}
        enableDamping={!reducedMotion}
        dampingFactor={reducedMotion ? 0 : 0.05}
        rotateSpeed={reducedMotion ? 0 : 0.5}
        zoomSpeed={reducedMotion ? 0 : 0.5}
        panSpeed={0}
        enablePan={false}
      />
      
      <Sky 
        distance={420000}
        sunPosition={new THREE.Vector3(0.5, 1, 0.2)}
        inclination={0.5}
        azimuth={0.25}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
        elevation={4}
      />
      
      <Stars 
        radius={100}
        depth={50}
        count={3000}
        saturation={0}
        factor={4}
      />

      <GroundPlane era={era} />
      <Buildings era={era} />
      <Storefronts era={era} />
      <Vehicles era={era} />
      <Pedestrians era={era} />
    </>
  )
}