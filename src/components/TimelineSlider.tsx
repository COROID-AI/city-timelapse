import React from 'react'
import { Era, ERA_ORDER } from '../contexts/EraContext'

interface TimelineSliderProps {
  currentEra: Era
  onEraChange: (era: Era) => void
  transitionProgress?: number
  isTransitioning?: boolean
}

export function TimelineSlider({ 
  currentEra, 
  onEraChange, 
  transitionProgress = 1,
  isTransitioning = false 
}: TimelineSliderProps) {
  const eraLabels: Record<Era, string> = {
    '1945': 'Post-War',
    '1965': 'Mid-Century',
    '1985': 'Modern',
    '2005': 'Digital',
    '2025': 'Smart City',
    '2055': 'Future',
  }

  const eraColors: Record<Era, string> = {
    '1945': 'bg-era-1945',
    '1965': 'bg-era-1965',
    '1985': 'bg-era-1985',
    '2005': 'bg-era-2005',
    '2025': 'bg-era-2025',
    '2055': 'bg-era-2055',
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
      <div className="bg-slate-800/90 backdrop-blur-md rounded-lg px-6 py-3 shadow-xl border border-slate-700">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 font-medium">1945</span>
          <div className="relative">
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              value={ERA_ORDER.indexOf(currentEra)}
              onChange={(e) => onEraChange(ERA_ORDER[parseInt(e.target.value)] as Era)}
              className="w-64 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg
                [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-lg"
              aria-label="Timeline slider"
            />
            <div className="flex justify-between mt-2 px-1">
              {ERA_ORDER.map((era) => (
                <button
                  key={era}
                  onClick={() => onEraChange(era)}
                  className={`flex flex-col items-center gap-1 transition-all ${
                    currentEra === era ? 'scale-110' : 'opacity-60 hover:opacity-100'
                  }`}
                  aria-label={`Switch to ${era} (${eraLabels[era]})`}
                >
                  <div className={`w-2 h-2 rounded-full ${eraColors[era]}`} />
                  <span className="text-xs text-slate-300">{era}</span>
                </button>
              ))}
            </div>
          </div>
          <span className="text-sm text-slate-400 font-medium">2055</span>
        </div>
        <div className="mt-2 text-center">
          <span className="text-lg font-semibold text-white">
            {eraLabels[currentEra]}
          </span>
          {isTransitioning && (
            <span className="text-xs text-slate-400 ml-2">
              (transitioning... {Math.round(transitionProgress * 100)}%)
            </span>
          )}
        </div>
      </div>
    </div>
  )
}