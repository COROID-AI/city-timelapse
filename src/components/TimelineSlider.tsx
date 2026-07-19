import React from 'react'
import { Era } from '../types'

interface TimelineSliderProps {
  eras: Era[]
  currentEra: Era
  onEraChange: (era: Era) => void
}

export const TimelineSlider: React.FC<TimelineSliderProps> = ({
  eras,
  currentEra,
  onEraChange,
}) => {
  const currentIndex = eras.findIndex(era => era.year === currentEra.year)

  const ChevronLeft = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )

  const ChevronRight = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-black/70 backdrop-blur-md rounded-full px-6 py-3 flex items-center gap-4">
      <button
        onClick={() => {
          if (currentIndex > 0) {
            onEraChange(eras[currentIndex - 1])
          }
        }}
        disabled={currentIndex === 0}
        className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous era"
      >
        <ChevronLeft />
      </button>

      <div className="flex items-center gap-2 timeline-scrollbar overflow-x-auto">
        {eras.map((era, index) => (
          <button
            key={era.year}
            onClick={() => onEraChange(era)}
            className={`
              px-4 py-2 rounded-full transition-all duration-300 font-medium
              ${index === currentIndex
                ? `bg-era-${era.year} text-white scale-110 shadow-lg`
                : 'bg-white/10 text-white/70 hover:bg-white/20'
              }
            `}
            aria-label={`Jump to ${era.year} era: ${era.description}`}
            aria-current={index === currentIndex ? 'true' : 'false'}
          >
            {era.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => {
          if (currentIndex < eras.length - 1) {
            onEraChange(eras[currentIndex + 1])
          }
        }}
        disabled={currentIndex === eras.length - 1}
        className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Next era"
      >
        <ChevronRight />
      </button>
    </div>
  )
}