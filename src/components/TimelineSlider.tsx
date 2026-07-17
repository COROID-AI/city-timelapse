interface TimelineSliderProps {
  year: number
  setYear: (year: number) => void
}

const years = [1945, 1965, 1985, 2005, 2025, 2055]

export function TimelineSlider({ year, setYear }: TimelineSliderProps) {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-black/80 backdrop-blur-md rounded-xl p-5 flex items-center gap-8 shadow-2xl">
      <span className="text-white font-semibold text-xl tracking-wide">Timeline: {year}</span>
      <div className="flex gap-2">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`px-5 py-2.5 rounded-lg transition-all transform ${
              year === y 
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white scale-105 shadow-lg' 
                : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white hover:scale-102'
            }`}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  )
}
