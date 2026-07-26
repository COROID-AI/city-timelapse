import { useState, useEffect, useRef, useCallback } from 'react';
import { Era, YEAR_OPTIONS, getEraByYear } from '../eras';

interface TimelineSliderProps {
  currentYear: number;
  onYearChange: (year: number) => void;
  isTransitioning: boolean;
  transitionProgress: number;
  eras: Era[];
}

export function TimelineSlider({
  currentYear,
  onYearChange,
  isTransitioning,
  transitionProgress,
  eras,
}: TimelineSliderProps) {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.tagName === 'INPUT') return;

      const currentIndex = YEAR_OPTIONS.indexOf(currentYear);
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onYearChange(YEAR_OPTIONS[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && currentIndex < YEAR_OPTIONS.length - 1) {
        onYearChange(YEAR_OPTIONS[currentIndex + 1]);
      } else if (e.key === 'Home') {
        onYearChange(YEAR_OPTIONS[0]);
      } else if (e.key === 'End') {
        onYearChange(YEAR_OPTIONS[YEAR_OPTIONS.length - 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentYear, onYearChange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const year = parseInt(e.target.value, 10);
    onYearChange(year);
  };

  const handleSliderClick = (e: React.MouseEvent) => {
    if (sliderRef.current) {
      const rect = sliderRef.current.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const index = Math.round(percent * (YEAR_OPTIONS.length - 1));
      const year = YEAR_OPTIONS[Math.max(0, Math.min(YEAR_OPTIONS.length - 1, index))];
      onYearChange(year);
    }
  };

  const handleYearClick = (year: number) => {
    onYearChange(year);
  };

  const currentEra = getEraByYear(currentYear);
  const currentIndex = YEAR_OPTIONS.indexOf(currentYear);

  return (
    <div className="timeline-slider-container">
      <div className="timeline-header">
        <h2 className="timeline-title">City Era Timelapse: 1945–2055</h2>
        <div className="era-label">
          <span className="era-year">{currentEra.year}</span>
          <span className="era-name" style={{ color: currentEra.color }}>
            {currentEra.label}
          </span>
          {isTransitioning && (
            <span className="transition-indicator">
              Transforming... {Math.round(transitionProgress * 100)}%
            </span>
          )}
        </div>
      </div>

      <div
        ref={sliderRef}
        className="timeline-track"
        onClick={handleSliderClick}
        role="slider"
        aria-valuemin={1945}
        aria-valuemax={2055}
        aria-valuenow={currentYear}
        aria-valuetext={`${currentEra.year} - ${currentEra.label}`}
        aria-label="Select city era year"
        tabIndex={0}
      >
        {/* Era segments */}
        <div className="timeline-segments">
          {eras.map((era, index) => {
            const leftPercent = (index / (eras.length - 1)) * 100;
            const widthPercent = (1 / (eras.length - 1)) * 100;
            const isActive = era.year === currentYear;
            const isPassed = era.year < currentYear;

            return (
              <div
                key={era.year}
                className={`timeline-segment ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''}`}
                style={{
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  backgroundColor: isActive
                    ? era.color
                    : isPassed
                      ? `${era.color}40`
                      : `${era.color}20`,
                }}
                onMouseEnter={() => setHoveredYear(era.year)}
                onMouseLeave={() => setHoveredYear(null)}
                onClick={() => handleYearClick(era.year)}
              >
                <div
                  className={`timeline-marker ${isActive ? 'active' : ''}`}
                  style={{
                    borderColor: era.color,
                    boxShadow: isActive ? `0 0 15px ${era.color}` : 'none',
                  }}
                >
                  <span className="timeline-year">{era.year}</span>
                  {(hoveredYear === era.year || isActive) && (
                    <span className="timeline-label">{era.label}</span>
                  )}
                </div>

                {/* Transition progress fill */}
                {isActive && isTransitioning && (
                  <div
                    className="transition-fill"
                    style={{
                      width: `${transitionProgress * 100}%`,
                      backgroundColor: era.color,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Current position indicator */}
        <div
          className="timeline-indicator"
          style={{
            left: `${(currentIndex / (YEAR_OPTIONS.length - 1)) * 100}%`,
            backgroundColor: currentEra.color,
          }}
        >
          <div
            className="timeline-indicator-line"
            style={{ backgroundColor: currentEra.color }}
          />
        </div>

        {/* Hidden range input for accessibility */}
        <input
          type="range"
          min={1945}
          max={2055}
          step={20}
          value={currentYear}
          onChange={handleSliderChange}
          className="timeline-input"
          aria-label="Era year slider"
        />
      </div>

      {/* Era descriptions */}
      <div className="era-description">
        {getEraDescription(currentEra)}
      </div>

      {/* Navigation hint */}
      <div className="nav-hint">
        Use ← → arrow keys or drag the slider to navigate eras
      </div>
    </div>
  );
}

function getEraDescription(era: Era): string {
  const descriptions: Record<number, string> = {
    1945: 'Post-war reconstruction era with brick buildings, modest traffic, and paper signage.',
    1965: 'Swinging sixties with concrete architecture, neon signs, and growing suburban traffic.',
    1985: 'Eighties boom with corporate towers, neon advertisements, and increasing vehicle density.',
    2005: 'Digital age with glass facades, LED displays, and dense mixed traffic.',
    2025: 'Modern smart city with sustainable architecture, digital signage, and autonomous vehicles.',
    2055: 'Futuristic eco-city with holographic displays, flying vehicles, and vertical gardens.',
  };
  return descriptions[era.year] || '';
}
