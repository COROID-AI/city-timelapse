import React, { useState, Suspense, lazy } from 'react'
import TimelineSlider from './components/TimelineSlider'

// Lazy load the 3D scene to avoid SSR issues
const CityScene = lazy(() => import('./components/CityScene'))

const eras = [
  { year: 1945, label: '1945', description: 'Post-War Era - Art Deco' },
  { year: 1965, label: '1965', description: 'Modern Era - Modernism' },
  { year: 1985, label: '1985', description: 'Brutalist Era - Brutalism' },
  { year: 2005, label: '2005', description: 'Glass Era - Glass/Modern' },
  { year: 2025, label: '2025', description: 'Contemporary Era - Contemporary' },
  { year: 2055, label: '2055', description: 'Future Era - Futuristic' },
]

function App() {
  const [currentEra, setCurrentEra] = useState(0)

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Timeline Slider - Top UI */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 md:p-6">
        <TimelineSlider
          eras={eras}
          currentEra={currentEra}
          onEraChange={setCurrentEra}
        />
      </div>

      {/* Era Description */}
      <div className="absolute top-20 left-0 right-0 z-10 px-4 md:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {eras[currentEra].label}
          </h1>
          <p className="text-slate-300 text-sm md:text-base">
            {eras[currentEra].description}
          </p>
        </div>
      </div>

      {/* Loading Overlay */}
      <Suspense fallback={
        <div className="absolute inset-0 flex items-center justify-center z-0">
          <div className="text-center">
            <div className="w-10 h-10 md:w-12 md:h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white text-lg">Loading City Scene...</p>
          </div>
        </div>
      }>
        <ErrorBoundaryCurrent>
          <CityScene eraIndex={currentEra} />
        </ErrorBoundaryCurrent>
      </Suspense>

      {/* Instructions */}
      <div className="absolute bottom-4 left-0 right-0 z-10 px-4 md:px-6">
        <div className="max-w-md mx-auto text-center text-slate-400 text-xs md:text-sm">
          <p>Click and drag to orbit • Scroll to zoom • Slide to travel through time</p>
        </div>
      </div>
    </div>
  )
}

// Simple error boundary component
class ErrorBoundaryCurrent extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center z-0">
          <div className="text-center p-6 bg-red-900/50 rounded-lg border border-red-500 max-w-md">
            <h2 className="text-red-300 text-xl font-bold mb-2">Scene Error</h2>
            <p className="text-red-200">Failed to load 3D scene. Please refresh the page.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default App