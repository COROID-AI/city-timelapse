import React, { useEffect } from 'react'
import './TimelineSlider.css'

type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

interface TimelineSliderProps {
  eras: Era[]
  sliderValue: number // 0..(eras.length-1)
  activeEra: Era
  onSliderChange: (value: number) => void
  eraInfo: { title: string; description: string; color: string }
}

export function TimelineSlider({ eras, sliderValue, activeEra, onSliderChange, eraInfo }: TimelineSliderProps) {
  useEffect(() => {
    // Ensures the top indicator animates in after first mount.
  }, [])

  const activeIndex = eras.indexOf(activeEra)
  const progressPct = (activeIndex / (eras.length - 1)) * 100

  return (
    <div className="timeline-container">
      <div
        className="era-indicator visible"
        data-testid="era-indicator"
        style={{
          backgroundColor: eraInfo.color,
          boxShadow: `0 0 30px ${eraInfo.color}80`,
        }}
      >
        <h2>{eraInfo.title}</h2>
        <p>{eraInfo.description}</p>
      </div>

      <div className="slider-wrapper">
        <input
          type="range"
          min={0}
          max={eras.length - 1}
          step={0.01}
          value={sliderValue}
          data-testid="timeline-slider"
          onChange={(e) => onSliderChange(parseFloat(e.target.value))}
          className="timeline-slider"
        />

        <div className="era-labels">
          {eras.map((era) => {
            const index = eras.indexOf(era)
            const isActive = era === activeEra
            return (
              <button
                key={era}
                onClick={() => onSliderChange(index)}
                data-testid={`era-button-${era}`}
                className={`era-button ${isActive ? 'active' : ''}`}
                style={{
                  color: isActive ? eraInfo.color : '#fff',
                  textShadow: isActive ? `0 0 10px ${eraInfo.color}` : 'none',
                }}
              >
                {era}
              </button>
            )
          })}
        </div>

        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${eraInfo.color}, #ff00ff)`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
