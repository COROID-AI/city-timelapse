import React from 'react'

export function LoadingScreen() {
  return (
    <div 
      className="w-full h-screen flex flex-col items-center justify-center bg-slate-900"
      role="status"
      aria-live="polite"
      aria-label="Loading 3D city timelapse scene"
    >
      <div 
        className="relative w-64 h-2 bg-slate-700 rounded-full overflow-hidden mb-4"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={50}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 animate-loading-bar" />
      </div>
      <p className="text-slate-300 text-lg" aria-label="Loading status">
        Loading city timelapse...
      </p>
      <p className="text-slate-500 text-sm mt-2" aria-label="Loading details">
        Preparing assets for era transition
      </p>
    </div>
  )
}