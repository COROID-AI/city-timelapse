import { Era } from '../App'
import { Buildings } from './Buildings'
import { Vehicles } from './Vehicles'
import { Pedestrians } from './Pedestrians'
import { Storefronts } from './Storefronts'
import { Sky } from './Sky'
import { Ground } from './Ground'

interface CitySceneProps {
  currentEra: Era
  transitionPhase: number
}

// Era-specific environmental settings
const ERA_ENVIRONMENT: Record<Era, {
  skyColor: string
  fogColor: string
  fogDensity: number
  buildingStyle: string
  vehicleStyle: string
  pedestrianStyle: string
  storefrontStyle: string
}> = {
  '1945': {
    skyColor: '#87CEEB',
    fogColor: '#a0a0a0',
    fogDensity: 0.02,
    buildingStyle: 'pre-war',
    vehicleStyle: 'vintage',
    pedestrianStyle: '1940s',
    storefrontStyle: 'classic'
  },
  '1965': {
    skyColor: '#FFD700',
    fogColor: '#c0c0c0',
    fogDensity: 0.015,
    buildingStyle: 'modernist',
    vehicleStyle: 'classic',
    pedestrianStyle: '1960s',
    storefrontStyle: 'modernist'
  },
  '1985': {
    skyColor: '#FFA500',
    fogColor: '#d0d0d0',
    fogDensity: 0.01,
    buildingStyle: 'commercial',
    vehicleStyle: '80s',
    pedestrianStyle: '1980s',
    storefrontStyle: 'neon'
  },
  '2005': {
    skyColor: '#87CEFA',
    fogColor: '#e0e0e0',
    fogDensity: 0.008,
    buildingStyle: 'contemporary',
    vehicleStyle: 'modern',
    pedestrianStyle: '2000s',
    storefrontStyle: 'digital'
  },
  '2025': {
    skyColor: '#4682B4',
    fogColor: '#f0f0f0',
    fogDensity: 0.005,
    buildingStyle: 'contemporary',
    vehicleStyle: 'electric',
    pedestrianStyle: 'modern',
    storefrontStyle: 'smart'
  },
  '2055': {
    skyColor: '#00BFFF',
    fogColor: '#ffffff',
    fogDensity: 0.003,
    buildingStyle: 'futuristic',
    vehicleStyle: 'futuristic',
    pedestrianStyle: 'future',
    storefrontStyle: 'holographic'
  }
}

export function CityScene({ currentEra, transitionPhase }: CitySceneProps) {
  const env = ERA_ENVIRONMENT[currentEra]

  return (
    <>
      <color attach="background" args={[env.skyColor]} />
      <fog attach="fog" args={[env.fogColor, 50, 100]} />
      
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[50, 100, 50]} 
        intensity={1.2} 
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={200}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      
      <Sky era={currentEra} />
      <Ground era={currentEra} />
      
      <Buildings era={currentEra} transitionPhase={transitionPhase} />
      <Storefronts era={currentEra} transitionPhase={transitionPhase} />
      <Vehicles era={currentEra} transitionPhase={transitionPhase} />
      <Pedestrians era={currentEra} transitionPhase={transitionPhase} />
    </>
  )
}