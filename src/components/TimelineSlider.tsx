import React from 'react'
import { useUI, Era } from '../context/UIContext'
import { eras } from '../data/eras'

export const TimelineSlider: React.FC = () => {
  const { currentEra, setEra } = useUI()

  return (
    <div className="timeline-container">
      {eras.map((era) => (
        <span
          key={era}
          className={`timeline-label ${currentEra === era ? 'active' : ''}`}
          onClick={() => setEra(era)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setEra(era)
            }
          }}
        >
          {era}
        </span>
      ))}
      <input
        type="range"
        className="timeline-slider"
        min={0}
        max={eras.length - 1}
        value={eras.indexOf(currentEra)}
        onChange={(e) => setEra(eras[parseInt(e.target.value)] as Era)}
        aria-label="Timeline slider"
      />
    </div>
  )
}