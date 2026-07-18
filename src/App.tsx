import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { CityScene } from './components/CityScene'
import { TimelineSlider } from './components/TimelineSlider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAudio } from './hooks/useAudio'
import './App.css'
import { OrbitRig } from './components/OrbitRig'

type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

const eras: Era[] = ['1945', '1965', '1985', '2005', '2025', '2055']

const eraDescriptions: Record<Era, { title: string; description: string; color: string }> = {
  '1945': { 
    title: 'Post-War Era', 
    description: 'Reconstruction and recovery after WWII. Simple buildings, classic cars, and community spirit.',
    color: '#8B4513'
  },
  '1965': { 
    title: 'Mid-Century', 
    description: 'Economic boom with emerging modernism. Drive-ins, diners, and the rise of consumer culture.',
    color: '#4169E1'
  },
  '1985': { 
    title: 'Modern Era', 
    description: 'Glass towers rise, neon signs appear, and technology begins to transform daily life.',
    color: '#00CED1'
  },
  '2005': { 
    title: 'Contemporary', 
    description: 'Digital age emerges with smartphones, LED lights, and sleek urban design.',
    color: '#32CD32'
  },
  '2025': { 
    title: 'Present Day', 
    description: 'Sustainable cities with EV charging stations, smart infrastructure, and mixed-use spaces.',
    color: '#20B2AA'
  },
  '2055': { 
    title: 'Future Vision', 
    description: 'Advanced eco-architecture, autonomous vehicles, holographic displays, and vertical farms.',
    color: '#9932CC'
  }
}

export default function App() {
  const [sliderValue, setSliderValue] = useState(4) // 0..5, 4 => 2025
  const { playEraTransition } = useAudio()
  
  const activeEra = eras[Math.round(sliderValue)]
  const activeIndex = eras.indexOf(activeEra)
  const fromIndex = Math.floor(sliderValue)
  const toIndex = Math.min(fromIndex + 1, eras.length - 1)
  const blendT = sliderValue - fromIndex

  const eraA = eras[fromIndex]
  const eraB = eras[toIndex]

  useEffect(() => {
    playEraTransition(activeEra)
  }, [activeEra, playEraTransition])

  const eraInfo = useMemo(() => eraDescriptions[activeEra], [activeEra])

  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 900)
    return () => window.clearTimeout(t)
  }, [activeEra])

  return (
    <div className="app-container">
      {loading && <div className="loading-overlay">Loading {eraInfo.title}…</div>}
      <TimelineSlider 
        eras={eras} 
        sliderValue={sliderValue}
        activeEra={activeEra}
        onSliderChange={setSliderValue}
        eraInfo={eraDescriptions[activeEra]}
      />
      
      <ErrorBoundary>
        <Canvas
          shadows
          camera={{ 
            position: [30, 25, 30], 
            fov: 50,
            near: 0.1,
            far: 1000
          }}
          gl={{ 
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
          }}
          style={{ 
            position: 'fixed', 
            inset: 0,
            width: '100%',
            height: '100%'
          }}
        >
          <color attach="background" args={['#0a0a1a']} />

          <OrbitRig />
          
          <Suspense fallback={null}>
            <CityScene eraA={eraA} eraB={eraB} blendT={blendT} />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
    </div>
  )
}