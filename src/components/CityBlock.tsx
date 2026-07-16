import { useEra, Era } from '../contexts/EraContext'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BuildingRow } from './BuildingRow'
import { Road } from './Road'
import { Sidewalk } from './Sidewalk'
import { Vehicles } from './Vehicles'
import { Pedestrians } from './Pedestrians'

const BLOCK_SIZE = 80
const BUILDING_SPACING = 15

export function CityBlock({ onLoaded }: { onLoaded?: () => void }) {
  const { era, transitionProgress } = useEra()
  const { scene } = useThree()
  const [loaded, setLoaded] = useState(false)
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!loaded) {
        setLoaded(true)
        onLoaded?.()
      }
    }, 500)
    
    return () => clearTimeout(timeout)
  }, [loaded, onLoaded])

  useEffect(() => {
    // Dynamic lighting based on era
    const ambientLight = scene.children.find(c => c.userData.isAmbientLight) as THREE.AmbientLight
    const sunLight = scene.children.find(c => c.userData.isSunLight) as THREE.DirectionalLight
    
    if (ambientLight) {
      const intensities: Record<Era, number> = {
        1945: 0.4,
        1965: 0.5,
        1985: 0.6,
        2005: 0.7,
        2025: 0.8,
        2055: 0.9
      }
      ambientLight.intensity = intensities[era]
    }
    
    if (sunLight) {
      const sunColors: Record<Era, number> = {
        1945: 0xffe080,
        1965: 0xffd060,
        1985: 0xffc040,
        2005: 0xffe080,
        2025: 0x80c0ff,
        2055: 0xa0e0ff
      }
      sunLight.color.set(sunColors[era])
    }
  }, [era, scene])

  const getSkyColor = (): number => {
    const colors: Record<Era, number> = {
      1945: 0x87ceeb,
      1965: 0x90c0e0,
      1985: 0xa0d0f0,
      2005: 0x87ceeb,
      2025: 0x6aa9d9,
      2055: 0x5090c0
    }
    return colors[era]
  }

  return (
    <group ref={groupRef}>
      {/* Lighting */}
      <ambientLight 
        userData={{ isAmbientLight: true }}
        intensity={0.5} 
        color={getSkyColor()} 
      />
      <directionalLight
        userData={{ isSunLight: true }}
        position={new THREE.Vector3(100, 150, 80)}
        intensity={1.2}
        color={0xffffff}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={500}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      <hemisphereLight
        position={new THREE.Vector3(0, 100, 0)}
        intensity={0.3}
        groundColor={0x202030}
        color={0xffffff}
      />
      
      {/* Ground - Road and Sidewalks */}
      <Road era={era} transitionProgress={transitionProgress} />
      <Sidewalk side="left" era={era} transitionProgress={transitionProgress} />
      <Sidewalk side="right" era={era} transitionProgress={transitionProgress} />
      
      {/* Building Rows - Two sides of the block */}
      <BuildingRow
        count={6}
        side="left"
        era={era}
        transitionProgress={transitionProgress}
      />
      <BuildingRow
        count={6}
        side="right"
        era={era}
        transitionProgress={transitionProgress}
      />
      
      {/* Vehicles */}
      <Vehicles era={era} transitionProgress={transitionProgress} />
      
      {/* Pedestrians */}
      <Pedestrians era={era} transitionProgress={transitionProgress} />
    </group>
  )
}
