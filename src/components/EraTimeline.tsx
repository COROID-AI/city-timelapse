import React, { useState } from 'react'
import { Era } from '@/App'

const ERA_LABELS: Era[] = ['1945', '1965', '1985', '2005', '2025', '2055']

const ERA_DESCRIPTIONS: Record<Era, string> = {
  '1945': 'Post-War Era - Brick buildings, classic cars',
  '1965': 'Mid-Century - Modern concrete, muscle cars',
  '1985': 'Urban Development - Glass facades, early tech',
  '2005': 'Digital Age - Contemporary design, smartphones',
  '2025': 'Sustainable Future - Green tech, electric vehicles',
  '2055': 'Sci-Fi Tomorrow - Hover tech, smart cities'
}

export function EraTimeline({ 
  currentEra, 
  onEraChange 
}: { 
  currentEra: Era
  onEraChange: (era: Era) => void 
}) {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-black/70 backdrop-blur-md rounded-lg p-4">
      <div className="flex items-center space-x-4 mb-2">
        {ERA_LABELS.map((era) => (
          <button
            key={era}
            onClick={() => onEraChange(era)}
            className={`px-4 py-2 rounded-md transition-all duration-300 ${
              currentEra === era 
                ? 'bg-blue-500 text-white font-bold scale-110' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {era}
          </button>
        ))}
      </div>
      
      {/* Current era description */}
      <div className="text-center text-sm text-gray-400 mt-2">
        {ERA_DESCRIPTIONS[currentEra]}
      </div>
      
      {/* Visual timeline bar */}
      <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ 
            width: `${(ERA_LABELS.indexOf(currentEra) + 1) * (100 / ERA_LABELS.length)}%` 
          }}
        />
      </div>
    </div>
  )
}