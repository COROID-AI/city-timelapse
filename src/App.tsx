import { Canvas } from '@react-three/fiber'
import { useProgress, Html } from '@react-three/drei'
import { AppBar, Box, Slider, Typography, useMediaQuery, useTheme, CircularProgress } from '@mui/material'
import { useState, useCallback } from 'react'
import { CityScene } from './components/CityScene'
import { PostProcessing } from './components/PostProcessing'
import { SoundManager } from './components/SoundManager'
import { ErrorBoundary } from './components/ErrorBoundary'
import { EraTimeline, Era } from './types/era'

const ERA_YEARS: Era[] = [1945, 1965, 1985, 2005, 2025, 2055]

function Loader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <Box sx={{ textAlign: 'center', color: 'white' }}>
        <CircularProgress 
          variant="determinate" 
          value={progress} 
          size={60} 
          thickness={4}
          sx={{ color: 'primary.main' }}
        />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading {Math.round(progress)}%
        </Typography>
      </Box>
    </Html>
  )
}

function App() {
  const [timeline, setTimeline] = useState<EraTimeline>({
    year: 1945,
    progress: 0,
  })
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const handleSliderChange = useCallback((_: Event, newValue: number | number[]) => {
    const value = newValue as number
    const eraIndex = Math.floor(value / 100)
    setTimeline({
      year: ERA_YEARS[eraIndex] || 1945,
      progress: 0,
    })
  }, [])

  const getSliderValue = () => {
    const eraIndex = ERA_YEARS.indexOf(timeline.year as Era)
    return eraIndex * 100
  }

  return (
    <>
      {/* Global styles for body */}
      <style>{`
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          font-family: 'Roboto', 'Helvetica', 'Arial', sans-serif;
        }
        @font-face {
          font-family: 'Roboto';
          font-style: normal;
          font-display: swap;
        }
      `}</style>

      <Box sx={{ height: '100vh', width: '100vw', overflow: 'hidden', background: '#1a1a2e' }}>
        <AppBar 
          position="fixed" 
          sx={{ 
            top: 0, 
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography 
              variant={isMobile ? "subtitle1" : "h6"} 
              component="div" 
              sx={{ 
                mb: 1, 
                textAlign: 'center',
                fontWeight: 'bold',
                letterSpacing: 1,
              }}
            >
              City Era Timelapse: {timeline.year}
            </Typography>
            
            {/* Year labels displayed at top */}
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: 2, 
                mb: 1,
                flexWrap: 'wrap',
              }}
            >
              {ERA_YEARS.map((year) => (
                <Typography 
                  key={year} 
                  variant="caption" 
                  sx={{ 
                    color: timeline.year === year ? theme.palette.primary.main : 'text.secondary',
                    fontWeight: timeline.year === year ? 'bold' : 'normal',
                    fontSize: '0.75rem',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    background: timeline.year === year ? 'rgba(25, 118, 210, 0.2)' : 'transparent',
                  }}
                >
                  {year}
                </Typography>
              ))}
            </Box>

            <Slider
              value={getSliderValue()}
              onChange={handleSliderChange}
              min={0}
              max={500}
              step={1}
              marks={ERA_YEARS.map((year, index) => ({
                value: index * 100,
                label: '', // Labels shown above
              }))}
              sx={{
                width: isMobile ? '100%' : 600,
                mx: 'auto',
                '& .MuiSlider-thumb': {
                  transition: 'transform 0.2s ease',
                  '&:hover, &:focus-visible': {
                    transform: 'scale(1.2)',
                  },
                },
              }}
            />
          </Box>
        </AppBar>

        <ErrorBoundary>
          <Canvas
            camera={{ position: [50, 50, 50], fov: 60 }}
            gl={{ 
              antialias: true, 
              alpha: false,
              powerPreference: 'high-performance',
            }}
            dpr={[1, 2]}
            style={{ width: '100%', height: '100%' }}
          >
            <color attach="background" args={['#1a1a2e']} />
            <PostProcessing era={timeline.year as Era} />
            <CityScene timeline={timeline} />
          </Canvas>
        </ErrorBoundary>

        <SoundManager era={timeline.year as Era} />
      </Box>
    </>
  )
}

export default App