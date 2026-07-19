import React, { useEffect, useState } from 'react'

interface LoadingScreenProps {
  progress: number
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress }) => {
  const [displayWidth, setDisplayWidth] = useState(0)

  useEffect(() => {
    setDisplayWidth(progress)
  }, [progress])

  return (
    <div className="absolute inset-0 bg-gray-900 z-50 flex flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-8">
          City Era Timelapse
        </h1>
        <p className="text-gray-400 mb-4">Loading 3D City Experience</p>
        
        <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${displayWidth}%` }}
          />
        </div>
        
        <p className="text-white text-sm">{Math.round(progress)}%</p>
      </div>
    </div>
  )
}