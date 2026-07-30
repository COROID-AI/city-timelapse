import React from 'react';
import { Era, eraConfigs, eraYears } from '../data/eraData';

interface TimelineSliderProps {
  currentEra: Era;
  onEraChange: (era: Era) => void;
  years: Era[];
}

const TimelineSlider: React.FC<TimelineSliderProps> = React.memo(({ currentEra, onEraChange, years }) => {
  const sliderColors = [
    '#4477aa', // 1945
    '#88aa44', // 1965
    '#cc8844', // 1985
    '#44cc88', // 2005
    '#4488cc', // 2025
    '#6644cc', // 2055
  ];

  return (
    <div className="timeline-container">
      <div className="timeline-slider-wrapper">
        <input
          type="range"
          min={0}
          max={years.length - 1}
          step={1}
          value={years.indexOf(currentEra)}
          onChange={(e) => onEraChange(years[parseInt(e.target.value, 10)])}
          className="timeline-slider"
          aria-label="City era timeline"
        />
        <div className="timeline-labels">
          {years.map((year, i) => (
            <button
              key={year}
              onClick={() => onEraChange(year)}
              className={`era-btn ${currentEra === year ? 'active' : ''}`}
              style={{
                backgroundColor: currentEra === year ? sliderColors[i] : undefined,
                borderColor: sliderColors[i],
              }}
            >
              <span className="era-year">{year}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export default TimelineSlider;
