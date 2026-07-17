import React, { useEffect, useRef } from 'react'

interface Era {
  year: number
  label: string
  description: string
}

interface TimelineSliderProps {
  eras: Era[]
  currentEra: number
  onEraChange: (index: number) => void
}

const TimelineSlider: React.FC<TimelineSliderProps> = ({ eras, currentEra, onEraChange }) => {
  const indicatorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (indicatorRef.current) {
      const progress = currentEra / (eras.length - 1)
      indicatorRef.current.style.left = `${progress * 100}%`
      indicatorRef.current.style.width = `${100 / eras.length}%`
      indicatorRef.current.style.transform = `translateX(-${progress * 100}%)`
    }
  }, [currentEra, eras.length])

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative bg-slate-800/80 backdrop-blur-md rounded-full p-2 border border-slate-600">
        {/* Progress indicator */}
        <div
          ref={indicatorRef}
          className="absolute top-2 bottom-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${100 / eras.length}%` }}
        />

        {/* Era buttons */}
        <div className="relative flex justify-between">
          {eras.map((era, index) => (
            <button
              key={era.year}
              onClick={() => onEraChange(index)}
              className={`flex-1 px-3 md:px-4 py-2 md:py-3 rounded-full text-xs md:text-sm font-medium transition-all duration-200 relative z-10 ${
                index === currentEra
                  ? 'text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
              aria-label={`Switch to ${era.label} - ${era.description}`}
            >
              {era.label}
            </button>
          ))}
        </div>
      </div>

      {/* Year labels below slider */}
      <div className="flex justify-between mt-2 px-2">
        {eras.map((era) => (
          <span
            key={era.year}
            className={`text-xs ${
              era.year === eras[currentEra].year
                ? 'text-cyan-400 font-semibold'
                : 'text-slate-500'
            }`}
          >
            {era.year}
          </span>
        ))}
      </div>
    </div>
  )
}

export default TimelineSlider