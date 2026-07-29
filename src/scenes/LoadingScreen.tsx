import React, { useEffect, useState } from 'react'

export function LoadingScreen() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={`loading-screen${visible ? '' : ' hidden'}`} id="loading">
      <div className="loading-content">
        <h2>Loading City Timeline</h2>
        <div className="loading-bar"><div className="loading-fill" /></div>
      </div>
    </div>
  )
}