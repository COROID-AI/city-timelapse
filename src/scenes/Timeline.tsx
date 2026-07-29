import React, { useCallback } from 'react'
import { useAppStore } from '../state'
import { ERA_REGISTRY } from '../eras'

export function Timeline() {
  const { eraIndex, setEraIndex, eraFloat } = useAppStore()

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setEraIndex(Math.max(0, eraIndex - 1))
      if (e.key === 'ArrowRight') setEraIndex(Math.min(ERA_REGISTRY.length - 1, eraIndex + 1))
    },
    [eraIndex, setEraIndex]
  )

  return (
    <div className="timeline-container" onKeyDown={handleKeyDown} role="toolbar" aria-label="Era timeline">
      {ERA_REGISTRY.map((era, i) => (
        <button
          key={era.id}
          className={`timeline-btn ${i === eraIndex ? 'active' : ''}`}
          onClick={() => setEraIndex(i)}
          aria-pressed={i === eraIndex}
        >
          {era.label}
        </button>
      ))}
      <input
        type="range"
        className="timeline-slider"
        min={0}
        max={ERA_REGISTRY.length - 1}
        step={0.01}
        value={eraFloat}
        onChange={(e) => setEraIndex(Math.round(Number(e.target.value)))}
        onInput={(e) => {
          const v = Number(e.currentTarget.value)
          useAppStore.getState().setEraFloat(v)
          setEraIndex(Math.round(v))
        }}
        aria-label="Era year slider"
      />
    </div>
  )
}