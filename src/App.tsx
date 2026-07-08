/**
 * Main App Component
 * City Timelapse - 3D scene with era transitions
 */

import React, { useState, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import * as Slider from '@radix-ui/react-slider'
import './App.css'
import { ERA_IDS, EraId, getEraSpec } from './eras'
import { SfxMixer } from './audio/mixer'
import { CityBlock } from './components/CityBlock'
import { EraParticles } from './components/EraParticles'

function EraSlider({ value, onChange }: { value: EraId; onChange: (era: EraId) => void }) {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-[600px] px-4">
      <div className="bg-black/80 backdrop-blur-md rounded-lg p-4 border border-white/20">
        <div className="flex justify-between mb-2 px-2">
          {ERA_IDS.map((id) => (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`px-3 py-1 rounded text-sm font-mono transition-all ${
                value === id
                  ? 'bg-white text-black'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {id}
            </button>
          ))}
        </div>
        <Slider.Root
          className="relative flex items-center w-full touch-none select-none"
          value={[parseInt(value)]}
          onValueChange={([v]: number[]) => {
            const closestEra = ERA_IDS.reduce((prev, curr) => {
              return Math.abs(parseInt(curr) - v) < Math.abs(parseInt(prev) - v) ? curr : prev
            }, value)
            onChange(closestEra)
          }}
          min={parseInt(ERA_IDS[0])}
          max={parseInt(ERA_IDS[ERA_IDS.length - 1])}
        >
          <Slider.Track className="bg-white/20 relative grow rounded-full h-2">
            <Slider.Range className="absolute bg-white/60 rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb className="block w-5 h-5 bg-white rounded-full shadow-lg hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50" />
        </Slider.Root>
        <div className="text-center mt-2 text-white/80 text-sm">
          {getEraSpec(value).label}
        </div>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="text-white text-xl font-mono">Loading City...</div>
    </div>
  )
}

// Loader component that dismisses loading screen on first frame
function Loader({ onLoaded }: { onLoaded: () => void }) {
  const hasLoaded = React.useRef(false)
  useFrame(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true
      onLoaded()
    }
  })
  return null
}

export default function App() {
  const [currentEra, setCurrentEra] = useState<EraId>('1945')
  const [audioEnabled, setAudioEnabled] = useState(false)
  const mixerRef = useRef<SfxMixer | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    mixerRef.current = new SfxMixer({ masterVolume: 0.4 })

    // Handle user interaction for audio
    const handleInteraction = async () => {
      if (!audioEnabled && mixerRef.current) {
        await mixerRef.current.init()
        setAudioEnabled(true)
        mixerRef.current.setEra(currentEra)
      }
    }

    window.addEventListener('click', handleInteraction, { once: true })
    window.addEventListener('touchstart', handleInteraction, { once: true })

    return () => {
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
      mixerRef.current?.dispose()
    }
  }, [audioEnabled, currentEra])

  useEffect(() => {
    if (audioEnabled && mixerRef.current) {
      mixerRef.current.setEra(currentEra)
    }
  }, [currentEra, audioEnabled])

  return (
    <TooltipProvider>
      <div className="w-full h-screen bg-black overflow-hidden">
        {isLoading && <LoadingScreen />}
        <EraSlider value={currentEra} onChange={setCurrentEra} />

        <Canvas
          shadows
          gl={{ antialias: true, alpha: false }}
          camera={{ position: [15, 15, 15], fov: 60 }}
        >
          <PerspectiveCamera makeDefault position={[15, 15, 15]} />
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[10, 20, 10]}
            intensity={1.5}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          <CityBlock era={currentEra} />
          <EraParticles era={currentEra} />
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={50}
            maxPolarAngle={Math.PI / 2 - 0.1}
          />
          <Loader onLoaded={() => setIsLoading(false)} />
        </Canvas>
      </div>
    </TooltipProvider>
  )
}