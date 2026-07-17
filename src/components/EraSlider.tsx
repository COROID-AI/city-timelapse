import React from 'react'
import { Era } from '../lib/types'
import './EraSlider.css'

interface EraSliderProps {
  years: Era[]
  currentEra: Era
  onEraChange: (era: Era) => void
}

export const EraSlider: React.FC<EraSliderProps> = ({ years, currentEra, onEraChange }) => {
  const currentIndex = years.indexOf(currentEra)

  return (
    <div className="era-slider-container">
      <div className="era-slider-track">
        {years.map((year, index) => (
          <div
            key={year}
            className={`era-marker ${year === currentEra ? 'active' : ''}`}
            style={{ left: `${(index / (years.length - 1)) * 100}%` }}
            onClick={() => onEraChange(year)}
          >
            <div className="era-marker-label">{year}</div>
          </div>
        ))}
        <div
          className="era-slider-progress"
          style={{ width: `${(currentIndex / (years.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  )
}