import { Era } from '../App'

interface EraSelectorProps {
  eras: Era[]
  currentEra: Era
  onEraChange: (era: Era) => void
}

const ERA_LABELS: Record<Era, string> = {
  '1945': 'Post-War',
  '1965': 'Modernist',
  '1985': 'Commercial',
  '2005': 'Tech Boom',
  '2025': 'Contemporary',
  '2055': 'Future'
}

export function EraSelector({ eras, currentEra, onEraChange }: EraSelectorProps) {
  const currentIndex = eras.indexOf(currentEra)

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 glass-panel p-4 sm:p-6">
      <h1 className="text-lg sm:text-xl font-bold text-center mb-3 sm:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
        City Evolution: 1945-2055
      </h1>
      
      <div className="flex items-center gap-2 sm:gap-4">
        <label htmlFor="era-slider" className="sr-only">Select time period</label>
        <input
          id="era-slider"
          type="range"
          min={0}
          max={eras.length - 1}
          value={currentIndex}
          onChange={(e) => onEraChange(eras[parseInt(e.target.value)])}
          className="w-48 sm:w-64 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Time period slider"
          role="slider"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={eras.length}
          aria-valuetext={`${currentEra} - ${ERA_LABELS[currentEra]}`}
        />
        
        <div className="flex flex-col items-center min-w-[80px]">
          <span className="text-2xl font-bold text-indigo-300">{currentEra}</span>
          <span className="text-xs text-gray-400">{ERA_LABELS[currentEra]}</span>
        </div>
      </div>

      <div className="flex justify-between mt-2 text-xs text-gray-500 px-1">
        {eras.map((era) => (
          <button
            key={era}
            onClick={() => onEraChange(era)}
            className={`px-1 py-0.5 rounded transition-colors ${
              era === currentEra 
                ? 'text-indigo-300 font-semibold' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
            aria-label={`Jump to ${era}`}
          >
            {era}
          </button>
        ))}
      </div>
    </div>
  )
}