import React, { useEffect, useRef } from 'react'
import { useStore } from '../lib/store'
import { ERAS, type Era } from '../lib/types'
import gsap from 'gsap'

export function TimelineSlider() {
  const { currentEra, setTargetEra, setTransitioning, loading } = useStore()
  const sliderRef = useRef<HTMLDivElement>(null)

  const handleEraChange = (era: Era) => {
    if (loading.progress < 100) return
    setTargetEra(era)
    setTransitioning(true)
  }

  useEffect(() => {
    if (sliderRef.current) {
      gsap.fromTo(
        sliderRef.current,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
      )
    }
  }, [])

  return (
    <div 
      ref={sliderRef}
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(10px)',
        padding: '12px 24px',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}
      role="slider"
      aria-label="Timeline era selector"
      aria-valuenow={currentEra}
      aria-valuemin={1945}
      aria-valuemax={2055}
    >
      <span style={{ 
        fontSize: '14px', 
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '500'
      }}>
        Timeline
      </span>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        {ERAS.map((era) => (
          <button
            key={era.era}
            onClick={() => handleEraChange(era.era)}
            disabled={loading.progress < 100}
            style={{
              width: era.era === currentEra ? '48px' : '40px',
              height: era.era === currentEra ? '48px' : '40px',
              borderRadius: '50%',
              border: era.era === currentEra 
                ? '2px solid #00d4ff' 
                : '1px solid rgba(255, 255, 255, 0.3)',
              background: era.era === currentEra 
                ? 'rgba(0, 212, 255, 0.2)' 
                : 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: '600',
              cursor: loading.progress < 100 ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              opacity: loading.progress < 100 ? 0.5 : 1
            }}
            aria-label={`Travel to ${era.label}`}
            title={era.label}
          >
            {era.era}
          </button>
        ))}
      </div>
    </div>
  )
}