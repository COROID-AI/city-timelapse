import React from 'react'

export const LoadingScreen: React.FC = () => {
  return (
    <div className="loading-container">
      <div className="loading-spinner">
        <div></div>
        <div></div>
      </div>
      <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'white', marginBottom: '16px' }}>
        Loading City Scene
      </h2>
      <p style={{ color: '#d1d5db' }}>Preparing the time machine...</p>
    </div>
  )
}