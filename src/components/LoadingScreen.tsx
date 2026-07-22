import React, { useState, useEffect } from 'react';
import './LoadingScreen.css';

export function LoadingScreen() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => setLoading(false), 500);
          return 100;
        }
        return p + Math.random() * 10;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  if (!loading) return null;

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <span className="logo-text">CITY</span>
          <span className="logo-subtext">TIMELAPSE</span>
        </div>
        <div className="loading-bar-container">
          <div className="loading-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="loading-text">
          {progress < 30 && 'Initializing 3D engine...'}
          {progress >= 30 && progress < 60 && 'Loading city assets...'}
          {progress >= 60 && progress < 90 && 'Setting up timeline...'}
          {progress >= 90 && 'Almost ready...'}
        </div>
        <div className="loading-percent">{Math.round(progress)}%</div>
      </div>
    </div>
  );
}
