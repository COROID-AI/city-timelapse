import React, { useMemo } from 'react'
import { ERA_OPTIONS } from '../app/eras.config'
import type { EraId } from '../app/types'
import { useAppStore } from '../app/store'

export function TimelineSlider() {
  const { targetEraId, setTargetEraId, reduceMotion } = useAppStore()

  const min = 0
  const max = 5

  const options = useMemo(() => ERA_OPTIONS, [])
  const current = options.find((o) => o.id === targetEraId)

  return (
    <div className="w-full max-w-xl px-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-white/80">Timeline</div>
          <div className="text-sm font-semibold text-white">
            {current?.label ?? '—'}{' '}
            <span className="font-normal text-white/70">({current?.year ?? ''})</span>
          </div>
        </div>
        <div className="text-xs text-white/70">{reduceMotion ? 'Reduced motion' : 'Cinematic'}</div>
      </div>

      <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3 backdrop-blur">
        <label className="sr-only" htmlFor="era-slider">
          Choose era
        </label>
        <input
          id="era-slider"
          className="w-full accent-cyan-300"
          type="range"
          min={min}
          max={max}
          step={1}
          value={targetEraId}
          onChange={(e) => setTargetEraId(Number(e.target.value) as EraId)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              // Let native input behavior happen; store will update via onChange.
            }
          }}
          aria-label="Timeline slider"
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={targetEraId}
          aria-valuetext={current?.label}
        />

        <div className="mt-3 flex items-center justify-between text-[11px] text-white/70">
          {options.map((o) => (
            <div key={o.id} className={o.id === targetEraId ? 'text-cyan-200 font-semibold' : ''}>
              {o.label}
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className={
                o.id === targetEraId
                  ? 'rounded-lg border border-cyan-300/60 bg-cyan-200/15 px-3 py-1 text-cyan-100'
                  : 'rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-white/80 hover:bg-white/10'
              }
              onClick={() => setTargetEraId(o.id as EraId)}
              aria-pressed={o.id === targetEraId}
            >
              {o.year}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
