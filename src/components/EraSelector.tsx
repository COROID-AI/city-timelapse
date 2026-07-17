import { ERAS } from '../types/era'
import type { Era } from '../types/era'

interface EraSelectorProps {
  currentEra: Era
  onEraChange: (era: Era) => void
}

export function EraSelector({ currentEra, onEraChange }: EraSelectorProps) {
  const currentIndex = ERAS.indexOf(currentEra)

  return (
    <div>
      <input
        type="range"
        min={0}
        max={ERAS.length - 1}
        value={currentIndex}
        onChange={(e) => onEraChange(ERAS[parseInt(e.target.value)])}
        className="timeline-slider"
        aria-label="Timeline slider"
      />
      <div className="timeline-labels">
        {ERAS.map((era) => (
          <span key={era} style={{ color: era === currentEra ? '#4fc3f7' : '#aaa' }}>
            {era}
          </span>
        ))}
      </div>
    </div>
  )
}