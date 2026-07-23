import React from 'react'
import { useCityEra } from '../era/useCityEra'
import './timeline.css'

const ERA_YEARS = [1945, 1965, 1985, 2005, 2025, 2055] as const

function yearLabel(year: number) {
  if (year === 1945) return '1945'
  if (year === 1965) return '1965'
  if (year === 1985) return '1985'
  if (year === 2005) return '2005'
  if (year === 2025) return '2025'
  return '2055'
}

export function TimelineBar() {
  const { year, setTargetYear, onUserInteracted } = useCityEra()

  const idx = ERA_YEARS.indexOf(year as (typeof ERA_YEARS)[number])

  return (
    <div className="timelineWrap" style={{ pointerEvents: 'auto' }}>
      <div className="timelineCard">
        <div className="timelineTitle">City Era Timelapse</div>

        <div className="timelineRow">
          <input
            aria-label="Timeline year"
            className="timelineRange"
            type="range"
            min={0}
            max={ERA_YEARS.length - 1}
            step={1}
            value={Math.max(0, idx)}
            onChange={(e) => {
              const i = Number(e.target.value)
              const nextYear = ERA_YEARS[i]
              onUserInteracted()
              setTargetYear(nextYear)
            }}
          />
          <div className="yearPill" aria-live="polite">
            {yearLabel(year)}
          </div>
        </div>

        <div className="ticks">
          {ERA_YEARS.map((y, i) => (
            <div key={y} className="tick">
              <div className="tickMark" />
              <div className="tickLabel">{y}</div>
              {i === idx ? <div className="tickGlow" /> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
