import { useEra, Era } from '../contexts/EraContext'
import { useState, useRef, useEffect } from 'react'

const ERAS: Era[] = [1945, 1965, 1985, 2005, 2025, 2055]

export function TimelineSlider() {
  const { era, setEra } = useEra()
  const currentIndex = ERAS.indexOf(era)
  const sliderRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleEraSelect = (newEra: Era) => {
    setEra(newEra)
  }

  const handleDragMove = (clientX: number) => {
    if (!sliderRef.current || !isDragging) return
    
    const rect = sliderRef.current.getBoundingClientRect()
    const relativeX = (clientX - rect.left) / rect.width
    const newIndex = Math.round(relativeX * (ERAS.length - 1))
    const clampedIndex = Math.max(0, Math.min(ERAS.length - 1, newIndex))
    
    setEra(ERAS[clampedIndex])
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX)
    const handleTouchMove = (e: TouchEvent) => handleDragMove(e.touches[0].clientX)
    const handleEnd = () => setIsDragging(false)
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleEnd)
      document.addEventListener('touchmove', handleTouchMove)
      document.addEventListener('touchend', handleEnd)
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging])

  const getEraLabel = (era: Era): string => {
    const labels: Record<Era, string> = {
      1945: 'Post-War Era',
      1965: 'Modern Suburban',
      1985: 'Urban Renewal',
      2005: 'Digital Age',
      2025: 'Smart City',
      2055: 'Future Metropolis'
    }
    return labels[era]
  }

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      padding: '1rem 2rem',
      zIndex: 1000,
      background: 'linear-gradient(to bottom, rgba(10,10,15,0.95), transparent)',
      backdropFilter: 'blur(10px)',
      pointerEvents: 'none'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        maxWidth: '800px',
        margin: '0 auto',
        pointerEvents: 'auto'
      }}>
        <span style={{ fontSize: '0.875rem', color: '#888', minWidth: '80px' }}>
          {era}
        </span>
        <div
          ref={sliderRef}
          style={{
            flex: 1,
            height: '40px',
            background: 'rgba(30,30,40,0.7)',
            borderRadius: '20px',
            padding: '8px 16px',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseDown={(e) => {
            setIsDragging(true)
            handleDragMove(e.clientX)
          }}
          onTouchStart={(e) => {
            setIsDragging(true)
            handleDragMove(e.touches[0].clientX)
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            gap: '0.5rem'
          }}>
            {ERAS.map((e) => (
              <button
                key={e}
                onClick={() => handleEraSelect(e)}
                style={{
                  flex: 1,
                  height: '100%',
                  background: era === e ? 'linear-gradient(180deg, #4a90d9, #2d6bb5)' : 'transparent',
                  border: 'none',
                  borderRadius: '16px',
                  color: era === e ? '#fff' : '#888',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  padding: '0 0.5rem',
                  minWidth: '40px'
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: `${(currentIndex / (ERAS.length - 1)) * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: '12px',
            height: '12px',
            background: '#4a90d9',
            borderRadius: '50%',
            boxShadow: '0 0 10px rgba(74, 144, 217, 0.8)',
            transition: isDragging ? 'none' : 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }} />
        </div>
        <span style={{ fontSize: '0.875rem', color: '#aaa', minWidth: '120px' }}>
          {getEraLabel(era)}
        </span>
      </div>
    </div>
  )
}
