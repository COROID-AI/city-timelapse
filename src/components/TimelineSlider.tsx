import { Era, ERA_LABELS } from '../stores/types'

interface TimelineSliderProps {
  currentEra: Era
  targetEra: Era
  isTransitioning: boolean
  onEraChange: (era: Era) => void
}

export function TimelineSlider({ currentEra, targetEra, isTransitioning, onEraChange }: TimelineSliderProps) {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 backdrop-blur-md rounded-lg px-6 py-4 border border-cyan-500/30">
      <div className="flex flex-col items-center gap-3">
        <h2 className="text-cyan-400 text-sm font-semibold uppercase tracking-wider">
          City Evolution Timeline
        </h2>
        <div className="flex gap-2 items-center">
          {(['1945', '1965', '1985', '2005', '2025', '2055'] as Era[]).map((era) => (
            <button
              key={era}
              onClick={() => onEraChange(era)}
              className={`
                px-4 py-2 rounded-md transition-all duration-300 text-sm font-medium
                ${currentEra === era 
                  ? 'bg-cyan-500 text-black scale-105 shadow-lg shadow-cyan-500/50' 
                  : 'bg-gray-800 text-cyan-300 hover:bg-gray-700 hover:text-cyan-200'
                }
                ${isTransitioning && targetEra === era ? 'ring-2 ring-cyan-400 animate-pulse' : ''}
              `}
            >
              {era}
            </button>
          ))}
        </div>
        {isTransitioning && (
          <div className="text-xs text-cyan-400 animate-pulse">
            Transitioning to {ERA_LABELS[targetEra]}...
          </div>
        )}
        <div className="text-xs text-gray-400">
          {ERA_LABELS[currentEra]}
        </div>
      </div>
    </div>
  )
}