import { useEffect, useRef } from 'react';
import { useEraStore, ERAS, Era } from '../state';

export function TimelineSlider() {
  const selectedEra = useEraStore((s) => s.selectedEra);
  const setSelectedEra = useEraStore((s) => s.setSelectedEra);
  const sliderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const newEra = e.key === 'ArrowRight'
          ? Math.min(selectedEra + 1, ERAS.length - 1)
          : Math.max(selectedEra - 1, 0);
        setSelectedEra(newEra as Era);
        sliderRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEra, setSelectedEra]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedEra(Number(e.target.value) as Era);
  };

  return (
    <div className="timeline-container" role="region" aria-label="Timeline">
      <div className="timeline-header">
        <span className="timeline-title">City Era Timeline</span>
        <span className="era-year" aria-live="polite">{ERAS[selectedEra].year}</span>
      </div>
      <div className="slider-wrapper">
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={ERAS.length - 1}
          step={1}
          value={selectedEra}
          onChange={handleChange}
          aria-label="Select era"
          className="timeline-slider"
        />
        <div className="era-labels">
          {ERAS.map((era) => (
            <button
              key={era.index}
              className={`era-label-btn ${era.index === selectedEra ? 'active' : ''}`}
              onClick={() => setSelectedEra(era.index)}
              aria-label={`Go to ${era.year}`}
            >
              <span className="era-year-small">{era.year}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
