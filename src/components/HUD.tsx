import React, { useState, useEffect, useRef } from 'react';
import { Era, ERA_LABELS, ERA_COLORS, ERA_MUSIC } from '../App';
import './HUD.css';

interface HUDProps {
  currentEra: Era;
  eraLabel: string;
}

export function HUD({ currentEra, eraLabel }: HUDProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'night'>('day');

  // Cycle time of day
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeOfDay((t) => (t === 'day' ? 'night' : 'day'));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hud-container">
      {/* Top left - Era info */}
      <div className="hud-panel top-left">
        <div
          className="era-badge"
          style={{
            backgroundColor: ERA_COLORS[currentEra],
            boxShadow: `0 0 20px ${ERA_COLORS[currentEra]}`,
          }}
        >
          <span className="era-year">{currentEra}</span>
        </div>
        <div className="era-label">{ERA_LABELS[currentEra]}</div>
      </div>

      {/* Top right - Controls */}
      <div className="hud-panel top-right">
        <button
          className="hud-button"
          onClick={() => setShowInfo(!showInfo)}
          title="Toggle Info"
        >
          <span className="button-icon">ⓘ</span>
        </button>
        <button
          className="hud-button"
          onClick={() => setShowControls(!showControls)}
          title="Toggle Controls"
        >
          <span className="button-icon">🎮</span>
        </button>
      </div>

      {/* Bottom left - Time of day */}
      <div className="hud-panel bottom-left">
        <div className="time-display">
          <span className="time-icon">{timeOfDay === 'day' ? '☀️' : '🌙'}</span>
          <span className="time-text">{timeOfDay === 'day' ? 'Day' : 'Night'}</span>
        </div>
      </div>

      {/* Bottom right - Music info */}
      <div className="hud-panel bottom-right">
        <div className="music-info">
          <span className="music-icon">🎵</span>
          <span className="music-text">{ERA_MUSIC[currentEra]}</span>
        </div>
      </div>

      {/* Info panel */}
      {showInfo && (
        <div className="info-panel">
          <h3>City Timelapse Explorer</h3>
          <p>Navigate through 6 decades of urban evolution.</p>
          <ul>
            <li><strong>1945:</strong> Post-war reconstruction era</li>
            <li><strong>1965:</strong> Urban renewal and expansion</li>
            <li><strong>1985:</strong> Modernization and neon</li>
            <li><strong>2005:</strong> Digital age connectivity</li>
            <li><strong>2025:</strong> Smart city technology</li>
            <li><strong>2055:</strong> Neo-futuristic architecture</li>
          </ul>
          <p className="hint">Use arrow keys or click the timeline to navigate.</p>
        </div>
      )}

      {/* Controls panel */}
      {showControls && (
        <div className="controls-panel">
          <h3>Controls</h3>
          <ul>
            <li><strong>Mouse Drag:</strong> Rotate camera</li>
            <li><strong>Mouse Wheel:</strong> Zoom in/out</li>
            <li><strong>Right Drag:</strong> Pan camera</li>
            <li><strong>← → Arrow Keys:</strong> Navigate timeline</li>
            <li><strong>Space:</strong> Toggle stats</li>
          </ul>
        </div>
      )}
    </div>
  );
}
