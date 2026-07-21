import { Era } from '../types'

interface TimelineSliderProps {
  eras: Era[]
  currentEra: number
  onEraChange: (year: number) => void
}

export function TimelineSlider({ eras, currentEra, onEraChange }: TimelineSliderProps) {
  const currentIndex = eras.findIndex(e => e.year === currentEra)
  
  return (
    <div className="bg-black/70 backdrop-blur-md rounded-lg p-4 shadow-2xl border border-white/10">
      <label htmlFor="era-slider" className="sr-only">
        Select time period
      </label>
      
      <div className="flex items-center gap-4">
        {/* Era labels */}
        <div className="hidden md:flex gap-2 text-xs text-white/60">
          {eras.map((era) => (
            <button
              key={era.year}
              onClick={() => onEraChange(era.year)}
              className={`px-2 py-1 rounded transition-colors ${
                era.year === currentEra 
                  ? 'text-white font-semibold bg-white/20' 
                  : 'hover:text-white hover:bg-white/10'
              }`}
              aria-label={`Jump to ${era.name} (${era.year})`}
            >
              {era.year}
            </button>
          ))}
        </div>

        {/* Slider */}
        <input
          id="era-slider"
          type="range"
          min={0}
          max={eras.length - 1}
          value={currentIndex}
          onChange={(e) => onEraChange(eras[parseInt(e.target.value)]?.year ?? eras[0].year)}
          className="flex-1 h-2 bg-white/20 rounded-full appearance-none cursor-pointer slider"
          aria-label="Timeline slider to transition between city eras"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={eras.length}
        />

        {/* Current era display */}
        <div className="text-right min-w-[120px]">
          <div className="text-lg font-bold" style={{ color: eras[currentIndex]?.color }}>
            {currentEra}
          </div>
          <div className="text-xs text-white/60 hidden sm:block">
            {eras[currentIndex]?.name}
          </div>
        </div>
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${eras[currentIndex]?.color};
          cursor: pointer;
          box-shadow: 0 0 8px rgba(255,255,255,0.5);
        }
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${eras[currentIndex]?.color};
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px rgba(255,255,255,0.5);
        }
      `}</style>
    </div>
  )
}