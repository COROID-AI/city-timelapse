import React from 'react';
import { useEra, Era } from '../contexts/EraContext';

const ERAS: Era[] = [1945, 1965, 1985, 2005, 2025, 2055];

export const TimelineSlider: React.FC = () => {
  const { currentEra, setEra } = useEra();

  return (
    <div className="timeline-container">
      <div className="timeline-slider">
        <div className="timeline-label">TIME PERIOD</div>
        <div className="timeline-values">
          {ERAS.map((era) => (
            <button
              key={era}
              className={`timeline-value ${currentEra === era ? 'active' : ''}`}
              onClick={() => setEra(era)}
            >
              {era}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};