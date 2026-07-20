import React from 'react'
import type { Era } from '../App'

interface TimelineProps {
  eras: Era[]
  currentEra: Era
  onEraChange: (era: Era) => void
  isTransitioning: boolean
}

const eraLabels: Record<Era, string> = {
  1945: 'Post-War',
  1965: 'Modern',
  1985: 'Neon',
  2005: 'Digital',
  2025: 'Present',
  2055: 'Future',
}

const eraColors: Record<Era, string> = {
  1945: '#f59e0b',
  1965: '#10b981',
  1985: '#06b6d4',
  2005: '#8b5cf6',
  2025: '#ec4899',
  2055: '#f97316',
}

export const Timeline: React.FC<TimelineProps> = ({
  eras,
  currentEra,
  onEraChange,
  isTransitioning,
}) => {
  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(12px)',
      borderRadius: '9999px',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    }}>
      <span style={{
        color: 'white',
        fontSize: '14px',
        fontWeight: 500,
        marginRight: '8px',
      }}>Timeline:</span>

      {isTransitioning && (
        <div style={{
          position: 'absolute',
          bottom: '-2px',
          left: 0,
          right: 0,
          height: '4px',
          background: 'rgba(79, 70, 229, 0.3)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            background: '#4f46e5',
            animation: 'pulse 1s infinite',
          }} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {eras.map((era, index) => {
          const isActive = era === currentEra
          return (
            <React.Fragment key={era}>
              <button
                onClick={() => onEraChange(era)}
                disabled={isTransitioning}
                style={{
                  position: 'relative',
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 0.3s',
                  cursor: isTransitioning ? 'not-allowed' : 'pointer',
                  opacity: isTransitioning ? 0.7 : 1,
                  background: isActive ? '#4f46e5' : 'transparent',
                  color: isActive ? 'white' : '#d1d5db',
                  boxShadow: isActive ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isTransitioning && !isActive) {
                    e.currentTarget.style.color = 'white'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isTransitioning && !isActive) {
                    e.currentTarget.style.color = '#d1d5db'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <span style={{ position: 'relative', zIndex: 10 }}>{era}</span>
                <span style={{
                  display: 'block',
                  fontSize: '12px',
                  opacity: 0.7,
                }}>{eraLabels[era]}</span>
              </button>
              {index < eras.length - 1 && (
                <div style={{
                  position: 'relative',
                  width: '6px',
                  height: '6px',
                  background: '#6b7280',
                  borderRadius: '50%',
                  marginLeft: '4px',
                }} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}