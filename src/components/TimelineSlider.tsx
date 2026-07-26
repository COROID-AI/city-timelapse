import { useTimeline } from '../context/TimelineContext';
import { ERAS, EraId } from '../types';
import './TimelineSlider.css';

export const TimelineSlider = () => {
  const { currentEra, targetEra, setCurrentEra, isTransitioning, transitionProgress, allEras } = useTimeline();

  const handleEraSelect = (era: EraId) => {
    setCurrentEra(era);
  };

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <h2 className="timeline-title">City Era Timelapse</h2>
        <span className="timeline-subtitle">1945 — 2055</span>
      </div>

      <div className="timeline-slider-wrapper">
        <div className="timeline-track">
          {allEras.map((era, index) => {
            const isActive = era === currentEra;
            const isTarget = era === targetEra;
            const eraData = ERAS.find(e => e.label === era)!;
            const progress = isTransitioning && isTarget ? transitionProgress : 0;

            return (
              <button
                key={era}
                className={`timeline-era ${isActive ? 'active' : ''} ${isTarget && isTransitioning ? 'transitioning' : ''}`}
                onClick={() => handleEraSelect(era)}
                style={{
                  '--era-color': eraData.color,
                  '--transition-progress': progress,
                } as React.CSSProperties}
              >
                <span className="era-year">{era}</span>
                <span className="era-label">{eraData.description}</span>
                {isTarget && isTransitioning && (
                  <div
                    className="era-progress-ring"
                    style={{
                      background: `conic-gradient(from 0deg at center, ${eraData.color}, transparent ${progress * 360}deg)`,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Continuous slider underneath */}
        <div className="slider-container">
          <input
            type="range"
            min="0"
            max={allEras.length - 1}
            value={allEras.indexOf(targetEra)}
            onChange={(e) => handleEraSelect(allEras[parseInt(e.target.value)] as EraId)}
            className="continuous-slider"
            style={{
              background: `linear-gradient(to right, var(--accent), var(--accent) ${
                (allEras.indexOf(targetEra) / (allEras.length - 1)) * 100
              }%, var(--timeline-inactive) ${
                (allEras.indexOf(targetEra) / (allEras.length - 1)) * 100
              }%, var(--timeline-inactive))`,
            }}
          />
          <div
            className="slider-thumb-indicator"
            style={{
              left: `${(allEras.indexOf(targetEra) / (allEras.length - 1)) * 100}%`,
            }}
          >
            <span className="thumb-year">{targetEra}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
