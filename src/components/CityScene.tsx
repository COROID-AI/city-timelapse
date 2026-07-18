import { useEra, Era } from '../contexts/EraContext'
import { Buildings } from './Buildings'
import { Roads } from './Roads'
import { Vehicles } from './Vehicles'
import { Pedestrians } from './Pedestrians'
import { Storefronts } from './Storefronts'
import { Billboards } from './Billboards'
import { Sky } from './Sky'
import { Camera } from './Camera'

export function CityScene() {
  const { currentEra } = useEra()

  return (
    <>
      <Camera />
      <Sky />
      
      {/* Lighting that changes per era */}
      <EraLighting era={currentEra} />
      
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <shadowMaterial opacity={0.3} />
      </mesh>

      {/* Roads and sidewalks */}
      <Roads />
      
      {/* Buildings with era-specific styles */}
      <Buildings />
      
      {/* Vehicles */}
      <Vehicles />
      
      {/* Pedestrians */}
      <Pedestrians />
      
      {/* Storefronts and advertisements */}
      <Storefronts />
      
      {/* Standalone billboards */}
      <Billboards />

      {/* Grid helper for reference */}
      <gridHelper args={[500, 50, '#444444', '#222222']} />
    </>
  )
}

function EraLighting({ era }: { era: Era }) {
  const eraColors: Record<Era, string> = {
    '1945': '#ffd780', // Warm, sepia-toned
    '1965': '#ffffff', // Bright, clear
    '1985': '#a0a0a0', // Cool, fluorescent
    '2005': '#e0e0ff', // Modern LED white
    '2025': '#f0f8ff', // Contemporary cool
    '2055': '#c0dfff', // Futuristic blue-tinted
  }

  return (
    <>
      <ambientLight intensity={0.6} color={eraColors[era]} />
      <directionalLight
        position={[100, 150, 100]}
        intensity={1.2}
        color={eraColors[era]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={500}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      <directionalLight
        position={[-100, 100, -50]}
        intensity={0.5}
        color="#ffffff"
      />
    </>
  )
}