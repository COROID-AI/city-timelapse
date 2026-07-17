import React from 'react'
import './LoadingScreen.css'

export const LoadingScreen: React.FC = () => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-spinner" />
        <h2>Loading City Timelapse</h2>
        <p>Preparing the time machine...</p>
      </div>
    </div>
  )
}