import React, { useState, useEffect, useRef } from 'react';
import { Era, ERAS, ERA_LABELS, ERA_COLORS } from '../App';
import './TimelineSlider.css';

interface TimelineSliderProps {
  currentEra: Era;
  onEraChange: (era: Era) => void;
  isTransitioning: boolean;
}

export function TimelineSlider({ currentEra, onEraChange, isTransitioning }: TimelineSliderProps) {
  const [hoveredEra, setHoveredEra] = useState<Era | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const idx = ERAS.indexOf(currentEra);
      if (e.key === 'ArrowRight' && idx < ERAS.length - 1) {
        onEraChange(ERAS[idx + 1]);
      }
      if (e.key === 'ArrowLeft' && idx > 0) {
        onEraChange(ERAS[idx - 1]);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentEra, onEraChange]);

  const currentIndex = ERAS.indexOf(currentEra);
  const progressPercent = (currentIndex / (ERAS.length - 1)) * 100;

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <h2 className="timeline-title">City Evolution Timeline</h2>
        <div className="era-description">
          {ERA_LABELS[currentEra]}
        </div>
      </div>

      <div
        className="timeline-slider-wrapper"
        ref={sliderRef}
        onMouseDown={(e) => setDragActive(true)}
        onMouseUp={() => setDragActive(false)}
        onMouseLeave={() => setDragActive(false)}
      >
        {/* Era markers */}
        <div className="timeline-track">
          {ERAS.map((era, index) => {
            const isActive = era === currentEra;
            const isHovered = era === hoveredEra;
            const markerPosition = (index / (ERAS.length - 1)) * 100;

            return (
              <div
                key={era}
                className={`era-marker ${isActive ? 'active' : ''} ${isTransitioning ? 'transitioning' : ''}`}
                style={{
                  left: `${markerPosition}%`,
                  '--era-color': ERA_COLORS[era],
                } as React.CSSProperties}
                onClick={() => !isTransitioning && onEraChange(era)}
                onMouseEnter={() => setHoveredEra(era)}
                onMouseLeave={() => setHoveredEra(null)}
              >
                <div
                  className={`marker-dot ${isActive ? 'active' : ''}`}
                  style={{ backgroundColor: ERA_COLORS[era] }}
                >
                  {isActive && (
                    <div
                      className="marker-glow"
                      style={{ boxShadow: `0 0 20px ${ERA_COLORS[era]}` }}
                    />
                  )}
                </div>
                <div className={`marker-label ${isActive ? 'active' : ''}`}>
                  {era}
                </div>
                {(isHovered || isActive) && (
                  <div className="marker-tooltip">
                    {ERA_LABELS[era]}
                  </div>
                )}
              </div>
            );
          })}

          {/* Progress fill */}
          <div
            className="timeline-progress-fill"
            style={{
              width: `${progressPercent}%`,
              background: `linear-gradient(90deg, ${ERA_COLORS[ERAS[0]]}, ${ERA_COLORS[currentEra]})`,
            }}
          />

          {/* Interactive scrubber */}
          <div
            className={`timeline-scrubber ${isTransitioning ? 'transitioning' : ''}`}
            style={{
              left: `${progressPercent}%`,
              backgroundColor: ERA_COLORS[currentEra],
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        </div>

        {/* Year labels below */}
        <div className="timeline-year-labels">
          {ERAS.map((era, index) => {
            const isActive = era === currentEra;
            return (
              <button
                key={era}
                className={`year-button ${isActive ? 'active' : ''}`}
                style={{
                  color: isActive ? ERA_COLORS[era] : '#888',
                  '--glow-color': ERA_COLORS[era],
                } as React.CSSProperties}
                onClick={() => !isTransitioning && onEraChange(era)}
                disabled={isTransitioning}
              >
                {era}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation hints */}
      <div className="timeline-hints">
        <span className="hint">← Arrow keys to navigate</span>
        <span className="hint-separator">•</span>
        <span className="hint">Click year to jump</span>
        <span className="hint-separator">•</span>
        <span className="hint">Drag to explore</span>
      </div>
    </div>
  );
}
