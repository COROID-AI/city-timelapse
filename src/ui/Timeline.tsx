/**
 * Timeline slider — fixed at the top of the screen.
 *
 * Two coordinated inputs over the same six eras (1945, 1965, 1985, 2005, 2025,
 * 2055):
 *  - A row of clickable era buttons (mouse + touch).
 *  - An accessible native range input (keyboard operable: arrows / Home / End).
 *
 * The fill bar mirrors the continuous `eraProgress` so the user sees the
 * timelapse glide. Selecting an era sets the store target; the SceneDriver
 * advances `frame.progress` toward it.
 */
import { useRef, type KeyboardEvent } from 'react'
import { ERA_YEARS, ERA_COUNT, ERAS } from '../era/config'
import { eraLabel, useCityStore } from '../era/store'

export function Timeline() {
  const selectedEra = useCityStore((s) => s.selectedEra)
  const eraProgress = useCityStore((s) => s.eraProgress)
  const transitioning = useCityStore((s) => s.transitioning)
  const selectEra = useCityStore((s) => s.selectEra)
  const rangeRef = useRef<HTMLInputElement>(null)

  const fillPct = (eraProgress / (ERA_COUNT - 1)) * 100

  const onRange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    // Snap the range to the nearest era index for discrete selection.
    selectEra(v)
  }

  const onRangeKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // Arrow keys step by 1 era; Home/End jump to the ends. The native range
    // already moves in steps of 1 (our min/max/step), so we just round on
    // change. Left/Right also nudge by one era for keyboard users.
    if (e.key === 'Home') {
      e.preventDefault()
      selectEra(0)
      if (rangeRef.current) rangeRef.current.value = '0'
    } else if (e.key === 'End') {
      e.preventDefault()
      selectEra(ERA_COUNT - 1)
      if (rangeRef.current)
        rangeRef.current.value = String(ERA_COUNT - 1)
    }
  }

  return (
    <div className="timeline" role="group" aria-label="Era timeline">
      <div className="timeline-track-wrap">
        <div className="timeline-fill" style={{ width: `${fillPct}%` }} />
        <div className="timeline-thumb" style={{ left: `${fillPct}%` }} />
        <div className="timeline-era-buttons">
          {ERA_YEARS.map((year, i) => (
            <button
              key={year}
              className={`era-btn${i === selectedEra ? ' active' : ''}`}
              onClick={() => {
                selectEra(i)
                if (rangeRef.current) rangeRef.current.value = String(i)
              }}
              aria-pressed={i === selectedEra}
              aria-label={`${year}: ${ERAS[i].name}`}
              title={eraLabel(i)}
            >
              <span className="era-year">{year}</span>
              <span className="era-name">{ERAS[i].name}</span>
            </button>
          ))}
        </div>
      </div>
      <input
        ref={rangeRef}
        className="timeline-range"
        type="range"
        min={0}
        max={ERA_COUNT - 1}
        step={1}
        value={selectedEra}
        onChange={onRange}
        onKeyDown={onRangeKey}
        aria-label="Select era year"
        aria-valuetext={`${ERA_YEARS[selectedEra]}, ${ERAS[selectedEra].name}`}
      />
      <div className={`timeline-status${transitioning ? ' on' : ''}`}>
        {transitioning ? 'morphing…' : `${ERA_YEARS[selectedEra]}`}
      </div>
    </div>
  )
}
