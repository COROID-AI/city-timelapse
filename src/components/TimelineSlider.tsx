import React, { useMemo } from 'react'
import { EraDefinition } from '../utils/eraConfig'

type Props = {
  eras: readonly EraDefinition[]
  selectedIndex: number
  onSelect: (index: number) => void
}

export function TimelineSlider({ eras, selectedIndex, onSelect }: Props) {
  const years = useMemo(() => eras.map((e) => e.year), [eras])

  return (
    <div className="timelineWrap" role="region" aria-label="City era timeline">
      <div className="timelinePanel">
        <div className="timelineTitle">
          <h1>City Era Timelapse</h1>
          <div className="subtitle">
            {eras[Math.round(selectedIndex)]?.year ?? eras[0]?.year}
          </div>
        </div>

        <div className="timelineMarkers" aria-hidden>
          {years.map((y, idx) => {
            const active = idx === Math.round(selectedIndex)
            return (
              <button
                key={y}
                className={`markerBtn ${active ? 'markerBtnActive' : ''}`}
                onClick={() => onSelect(idx)}
                type="button"
              >
                {y}
              </button>
            )
          })}
        </div>

        <div className="timelineRow timelineSlider">
          <input
            type="range"
            min={0}
            max={eras.length - 1}
            step={1}
            value={Math.round(selectedIndex)}
            aria-label="Select year"
            onChange={(e) => onSelect(Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  )
}
